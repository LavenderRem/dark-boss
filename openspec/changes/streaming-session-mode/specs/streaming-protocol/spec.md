## ADDED Requirements

### Requirement: stdin 消息格式
系统 SHALL 使用 NDJSON 格式向 CLI 进程的 stdin 写入消息，每条消息为单行 JSON 后跟换行符 `\n`。

#### Scenario: 发送用户消息
- **WHEN** 用户发送一条文本消息
- **THEN** 系统写入 `{"type":"user","message":{"role":"user","content":"<text>"},"parent_tool_use_id":null,"session_id":"<id>"}\n`，并 flush stdin

#### Scenario: 发送权限批准
- **WHEN** CLI 请求权限批准（`control_request` 中的 `can_use_tool` 请求）
- **THEN** 系统写入 `{"type":"control_response","response":{"subtype":"success","request_id":"<rid>","response":{"behavior":"allow","updatedInput":<original-input>}}}\n`

#### Scenario: 发送权限拒绝
- **WHEN** 用户通过前端拒绝权限请求
- **THEN** 系统写入 `{"type":"control_response","response":{"subtype":"success","request_id":"<rid>","response":{"behavior":"deny","message":"<reason>","interrupt":false}}}\n`

#### Scenario: 发送心跳
- **WHEN** 健康监控定时器触发
- **THEN** 系统写入 `{"type":"keep_alive"}\n`

### Requirement: stdout 事件类型路由
系统 SHALL 根据 stdout NDJSON 消息的 `type` 字段路由到对应处理器。

#### Scenario: 处理 system/init
- **WHEN** 收到 `{"type":"system","subtype":"init",...}`
- **THEN** 提取 `session_id`、`tools`、`model`，初始化 session 上下文，广播就绪状态

#### Scenario: 处理 stream_event
- **WHEN** 收到 `{"type":"stream_event","event":{...}}`
- **THEN** 根据 `event.type` 分发：
  - `content_block_start` → 初始化工具调用追踪或文本块
  - `content_block_delta` → 累积文本 delta（50ms 缓冲）或工具参数 delta
  - `content_block_stop` → 刷新缓冲区，发送完整事件

#### Scenario: 处理 assistant 消息
- **WHEN** 收到 `{"type":"assistant","message":{...}}`
- **THEN** 解析 `message.content` 数组，提取 `text`、`tool_use`、`thinking` 块，发送对应的 TerminalEvent

#### Scenario: 处理 result 消息
- **WHEN** 收到 `{"type":"result",...}`
- **THEN** 提取 `usage`（token 用量）、`total_cost_usd`、`duration_ms`，发送 status TerminalEvent，将 Agent 状态切回 `idle`

#### Scenario: 处理 control_request
- **WHEN** 收到 `{"type":"control_request","request":{...}}`
- **THEN** 根据 `request.subtype` 分发：
  - `can_use_tool` → 通过 WebSocket 发送 `TerminalEvent { type: "permission" }` 到前端，等待用户响应
  - 其他 subtype → 记录日志

#### Scenario: 处理 rate_limit_event
- **WHEN** 收到 `{"type":"rate_limit_event",...}`
- **THEN** 提取 `retry_after_ms`，发送 TerminalEvent 通知前端速率限制

#### Scenario: 处理未识别事件
- **WHEN** 收到未知 `type` 的消息
- **THEN** 记录日志，不发送到前端（避免噪音）

### Requirement: 权限请求流程
系统 SHALL 将 CLI 的 `control_request` 权限请求转发到前端，并将前端的响应回传给 CLI。

#### Scenario: 工具权限请求
- **WHEN** CLI 发送 `control_request` 且 `request.subtype === "can_use_tool"`
- **THEN** 系统提取 `tool_name`、`input`、`description`，发送 `TerminalEvent { type: "permission", toolName, toolInput, requestId }` 到前端

#### Scenario: 用户批准权限
- **WHEN** 前端通过 WebSocket 发送权限批准响应
- **THEN** 系统构造 `control_response`（behavior: "allow", updatedInput: 原始 input）写入 stdin

#### Scenario: 用户拒绝权限
- **WHEN** 前端通过 WebSocket 发送权限拒绝响应
- **THEN** 系统构造 `control_response`（behavior: "deny", message: 拒绝原因）写入 stdin

### Requirement: 会话恢复
系统 SHALL 在进程重建时使用 `--resume` 参数恢复之前的会话上下文。

#### Scenario: 进程崩溃后重建
- **WHEN** 持久进程崩溃且存在 `session_id`
- **THEN** 系统使用 `--resume <session_id>` 重新启动 CLI 进程，新进程继承之前的对话上下文

#### Scenario: session_id 丢失
- **WHEN** 持久进程崩溃且 `session_id` 为 null
- **THEN** 系统启动全新的 CLI 进程（不使用 `--resume`），session 上下文从头开始
