## 1. 数据结构与类型定义

- [x] 1.1 定义 stream-json 协议类型：`StreamJsonUserMessage`、`StreamJsonControlResponse`、`StreamJsonInitEvent`、`StreamJsonAssistantEvent`、`StreamJsonResultEvent`、`StreamJsonControlRequest`
- [x] 1.2 重构 `AgentSession` 接口：移除 `currentProcess` 的逐消息语义，新增 `processState: 'starting' | 'ready' | 'busy' | 'idle' | 'dead'`、`lastHeartbeatAt`、`idleTimeout` 字段

## 2. 持久进程管理核心

- [x] 2.1 实现 `spawnPersistentProcess(agentId, agent)`：spawn CLI 进程并传入 `--input-format stream-json --output-format stream-json --verbose`，绑定 stdout/stderr 处理器
- [x] 2.2 实现 `initSessionFromStdout(agentId)`：解析 `system/init` 事件，捕获 `session_id`、`tools`、`model`，将 `processState` 设为 `ready`
- [x] 2.3 实现 `sendUserMessage(agentId, message)`：构造 `{"type":"user","message":{...},"session_id":"..."}` NDJSON 写入 stdin
- [x] 2.4 移除 `prewarmSession()` 函数（不再需要）
- [x] 2.5 重写 `spawnAgent()`：调用 `spawnPersistentProcess` 替代原有的仅初始化上下文逻辑

## 3. stdout 事件路由

- [x] 3.1 重写 `handleStreamJson()` 为基于 `type` 字段的路由分发：`system` → init 处理、`stream_event` → 流式 delta、`assistant` → 完整响应、`result` → 完成处理、`control_request` → 权限处理
- [x] 3.2 实现 `handleStreamEvent(agentId, event)`：处理 `content_block_start/delta/stop`，复用现有文本缓冲和工具调用追踪逻辑
- [x] 3.3 实现 `handleAssistantMessage(agentId, event)`：解析完整 assistant 消息的 content 数组，发送 TerminalEvent
- [x] 3.4 实现 `handleResultMessage(agentId, event)`：提取 token 用量和费用，切回 `idle` 状态，处理消息队列

## 4. 权限处理

- [x] 4.1 实现 `handleControlRequest(agentId, event)`：识别 `can_use_tool` subtype，通过 WebSocket 发送 `TerminalEvent { type: "permission" }`
- [x] 4.2 重写 `handlePermissionResponse(agentId, response)`：构造 `control_response` NDJSON 写入 stdin，替代当前的 stdin 直写模式

## 5. 健康监控与自动恢复

- [x] 5.1 实现心跳定时器：每 30s 发送 `{"type":"keep_alive"}`，检测 stdout 是否有响应
- [x] 5.2 实现进程假死检测：连续 60s 无 stdout 输出时，SIGTERM → 5s SIGKILL，重建进程
- [x] 5.3 实现崩溃自动重建：进程异常退出时自动 spawn 新进程并 `--resume` 恢复 session
- [x] 5.4 实现闲置超时关闭：10 分钟无消息时关闭进程释放资源，下次消息时自动重建

## 6. 消息队列与状态管理

- [x] 6.1 重写 `processQueue()`：适配新的 `processState` 状态机（ready → busy → ready 循环）
- [x] 6.2 重写 `executeMessage()`：从 spawn 新进程改为 `sendUserMessage()`
- [x] 6.3 重写 `stopAgent()`：终止持久进程，清理心跳定时器和闲置超时
- [x] 6.4 重写 `shutdownAll()`：批量终止所有持久进程

## 7. 验证与测试

- [x] 7.1 验证首条消息能正常收到 `system/init` → `result` 完整流程
- [x] 7.2 验证后续消息无需重新 spawn 进程即可发送和接收
- [ ] 7.3 验证权限请求能正确转发到前端并接收响应
- [ ] 7.4 验证进程崩溃后自动重建并恢复 session
- [ ] 7.5 验证闲置超时后进程被正确关闭，新消息能触发重建
- [x] 7.6 验证前端 TerminalEvent 协议完全不变，无需前端改动
