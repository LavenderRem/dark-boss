## ADDED Requirements

### Requirement: 类型化终端事件协议

系统 SHALL 定义 `TerminalEvent` 联合类型作为后端到前端的终端事件协议，替代当前的 `{ text: string, channel: string }` 格式。

事件类型 SHALL 包含：
- `text` — Claude 回复文本
- `tool_use` — 工具调用（包含工具名和完整输入参数）
- `tool_result` — 工具执行结果（包含完整内容，不截断）
- `permission` — 权限确认请求
- `status` — 模型/token/费用状态更新
- `error` — 错误信息
- `user_input` — 用户输入的回显

#### Scenario: 工具调用事件包含完整参数结构
- **WHEN** 后端收到 stream-json 的 `tool_use` 事件
- **THEN** 广播 `{ agentId, event: { type: 'tool_use', name: 'Read', input: { file_path: 'src/App.tsx' } } }`

#### Scenario: 工具结果不截断
- **WHEN** 后端收到 stream-json 的 `tool_result` 事件且内容超过 500 字符
- **THEN** 广播完整的 `{ type: 'tool_result', content: <完整内容>, isError: false }`

#### Scenario: 向后兼容
- **WHEN** 前端收到旧格式 `agent:process_output` 消息
- **THEN** 将其转换为 `{ type: 'text', content: payload.text }` 处理

### Requirement: WebSocket 事件传输

后端 SHALL 通过 `agent:terminal_event` WebSocket 频道发送类型化事件。旧频道 `agent:process_output` SHALL 保留作为 fallback，但不再主动使用。

#### Scenario: 新格式事件发送
- **WHEN** `handleStreamJson` 处理 stream-json 事件
- **THEN** 通过 `broadcast('agent:terminal_event', { agentId, event })` 发送

#### Scenario: 错误事件降级
- **WHEN** stream-json 行无法解析为已知事件类型
- **THEN** 作为 `{ type: 'text', content: <原始文本> }` 发送，不丢弃

### Requirement: 共享类型定义

`TerminalEvent` 联合类型及各事件 payload 类型 SHALL 定义在 `packages/shared` 中，前后端共用。

#### Scenario: 类型导入
- **WHEN** 前端或后端需要使用终端事件类型
- **THEN** 从 `@dark-boss/shared` 导入 `TerminalEvent` 及相关类型
