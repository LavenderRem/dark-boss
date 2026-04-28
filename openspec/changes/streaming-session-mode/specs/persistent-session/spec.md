## ADDED Requirements

### Requirement: 持久进程启动
系统 SHALL 在 Agent 启动时 spawn 一个 Claude CLI 进程，使用 `--input-format stream-json --output-format stream-json --verbose` 参数，并保持进程存活直到 Agent 被停止。

#### Scenario: 首次启动 Agent
- **WHEN** 调用 `spawnAgent(agentId)` 且该 Agent 没有活跃会话
- **THEN** 系统 spawn 一个 CLI 进程，等待 `system/init` 事件获取 `session_id`，将 Agent 状态设为 `idle`，通过 WebSocket 广播 `agent:process_status`

#### Scenario: 进程启动失败
- **WHEN** CLI 进程 spawn 失败或启动超时（30s）
- **THEN** 系统将 Agent 状态设为 `error`，通过 WebSocket 广播错误事件，不自动重试

### Requirement: 通过 stdin 发送消息
系统 SHALL 通过向持久进程的 stdin 写入 NDJSON 格式的 `{"type":"user","message":{"role":"user","content":"<message>"},"session_id":"<id>"}` 来发送用户消息。

#### Scenario: 发送用户消息
- **WHEN** 调用 `sendToAgent(agentId, message)` 且进程处于 `idle` 状态
- **THEN** 系统将消息序列化为 NDJSON 写入 stdin，Agent 状态切换为 `running`，通过 WebSocket 广播状态变更

#### Scenario: 进程正忙时排队
- **WHEN** 调用 `sendToAgent(agentId, message)` 且进程处于 `running` 状态
- **THEN** 消息加入 `messageQueue`，当前消息处理完成后自动出队执行

#### Scenario: 向已崩溃进程发送消息
- **WHEN** 调用 `sendToAgent(agentId, message)` 但进程已退出
- **THEN** 系统自动重建进程，恢复 session，然后发送消息

### Requirement: stdout 事件解析
系统 SHALL 从持久进程的 stdout 读取 NDJSON 行，按消息类型路由到对应处理器。

#### Scenario: 接收 system/init 事件
- **WHEN** stdout 输出 `{"type":"system","subtype":"init","session_id":"..."}`
- **THEN** 系统捕获 `session_id`，记录可用工具列表和模型信息，Agent 状态设为 `idle`

#### Scenario: 接收流式文本输出
- **WHEN** stdout 输出 `{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}}`
- **THEN** 系统合并文本 delta（50ms 缓冲），通过 WebSocket 发送 `TerminalEvent { type: "text" }`

#### Scenario: 接收完整助手响应
- **WHEN** stdout 输出 `{"type":"assistant","message":{...}}`
- **THEN** 系统解析完整的 assistant 消息，提取工具调用、thinking 内容，发送对应的 TerminalEvent

#### Scenario: 接收 result 完成事件
- **WHEN** stdout 输出 `{"type":"result","subtype":"success"}`
- **THEN** 系统记录 token 用量和费用，Agent 状态切回 `idle`，处理队列中的下一条消息

### Requirement: 进程健康监控
系统 SHALL 定期检测持久进程的健康状态，自动处理异常。

#### Scenario: 心跳检测通过
- **WHEN** 每 30s 发送 `{"type":"keep_alive"}` 到 stdin
- **THEN** 进程正常响应 keep_alive，不做额外处理

#### Scenario: 进程假死检测
- **WHEN** 连续 60s 无 stdout 输出且进程未退出
- **THEN** 系统发送 SIGTERM → 5s 后 SIGKILL，重建新进程并恢复 session

#### Scenario: 进程异常退出
- **WHEN** 持久进程以非零退出码退出
- **THEN** 系统记录错误日志，将 Agent 状态设为 `error`，等待新消息触发自动重建

### Requirement: 优雅关闭
系统 SHALL 在停止 Agent 或服务关闭时优雅终止持久进程。

#### Scenario: 停止 Agent
- **WHEN** 调用 `stopAgent(agentId)`
- **THEN** 系统发送 SIGTERM，等待 5s，若未退出则 SIGKILL，清理所有状态，广播 `agent:process_status { status: "stopped" }`

#### Scenario: 服务关闭
- **WHEN** 服务进程收到 SIGTERM/SIGINT
- **THEN** 系统对所有活跃 Agent 执行 SIGKILL，清理所有 session 记录

### Requirement: 闲置超时自动关闭
系统 SHALL 在 Agent 长时间无消息时自动关闭其持久进程以释放资源。

#### Scenario: 闲置超时
- **WHEN** Agent 持续 10 分钟没有新消息
- **THEN** 系统关闭其 CLI 进程，将 Agent 状态设为 `idle`（保留 session 记录），下次消息时自动重建进程
