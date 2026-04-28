## Why

当前 Agent 进程管理器采用"逐消息 spawn"模式——每条用户消息都会启动一个新的 Claude CLI 子进程（~12s 开销），即使使用了 `--resume` 保持上下文，每次仍需重新初始化 CLI 二进制（~190MB）、连接 MCP 服务器、创建 Prompt Cache。这导致后续消息的响应延迟高达 12-15 秒，其中 75% 是可消除的启动开销。

Claude CLI 原生支持 `--input-format stream-json` 流式会话模式，允许保持进程存活、通过 stdin 持续发送消息，后续消息延迟可降至 <2s。

## What Changes

- 重写 `agent-process-manager.ts`，从"逐消息 spawn"模式切换为"持久进程 + 流式输入"模式
- 新增 `initPersistentSession()` 函数：启动 CLI 进程并保持存活，通过 stdin/stdout NDJSON 协议通信
- 改造 `executeMessage()`：从 spawn 新进程改为向已存活进程的 stdin 写入 `{"type":"user"}` 消息
- 改造 `handleStreamJson()`：基于消息类型（`system/init`、`assistant`、`result`、`control_request`）路由处理
- 移除 `prewarmSession()`（不再需要，进程本身就是持久的）
- 新增进程健康监控：心跳检测、崩溃自动重建、超时清理
- 新增权限处理：通过 `control_response` 协议响应权限请求，替代当前的 stdin 直写模式

## Capabilities

### New Capabilities
- `persistent-session`: 持久化 CLI 进程生命周期管理——启动、消息发送、健康监控、崩溃重建、优雅关闭
- `streaming-protocol`: Claude CLI stream-json 双向协议实现——stdin 消息发送、stdout 事件解析、权限响应、进程控制

### Modified Capabilities

（无现有 spec，所有能力均为新建）

## Impact

- **核心文件**: `packages/server/src/services/agent-process-manager.ts`（主要重写）
- **依赖文件**: `packages/server/src/utils/config.ts`（可能需要新增环境变量）
- **API 无变化**: WebSocket 事件协议保持不变，前端无需改动
- **性能影响**: 后续消息延迟从 ~12s 降至 <2s（6-10x 提升）
- **内存影响**: 每个 Agent 长驻一个 CLI 进程（~216MB），需要合理控制并发 Agent 数量
- **风险**: 长驻进程可能泄漏或僵死，需要健康监控和自动恢复机制
