## Context

当前 `agent-process-manager.ts` 采用逐消息 spawn 模式：每条用户消息执行 `spawn("claude", ["-p", message, "--resume", sessionId])`，进程处理完毕后退出。即使有 `--resume` 复用会话上下文，每次仍需 ~12s 的进程启动开销（Go 二进制加载 ~4s、CLI 初始化 ~3s、MCP 连接 ~3s）。

预启动（prewarm）仅发送 "hi" 获取 `session_id`，进程随即退出，后续消息仍从零开始。

Claude CLI 原生支持流式会话模式：
```bash
claude -p --input-format stream-json --output-format stream-json --verbose
```
启动后通过 stdin NDJSON 持续发送消息，进程保持存活，后续消息延迟 <2s。

前端通过 WebSocket 消费终端事件，协议为 `TerminalEvent` 类型化消息。本次改造只涉及后端进程管理层，前端和 WebSocket 协议完全不变。

## Goals / Non-Goals

**Goals:**
- 将 Agent 进程从"逐消息 spawn"切换为"持久进程 + stdin 消息发送"
- 后续消息响应延迟从 ~12s 降至 <2s
- 保持现有 WebSocket 事件协议不变，前端零改动
- 支持进程健康监控和崩溃自动重建
- 正确处理权限请求（control_request/control_response 协议）

**Non-Goals:**
- 不引入 Claude Agent SDK 依赖（仍直接使用 CLI 子进程）
- 不修改前端代码或 WebSocket 协议
- 不修改数据库 schema
- 不实现多 Agent 子代理编排（这是 Agent SDK 的能力，超出本次范围）
- 不处理 Agent 进程的水平扩展（单实例部署场景）

## Decisions

### 1. 使用 `--input-format stream-json` 而非 Agent SDK

**选择**: 直接使用 CLI 的 `--input-format stream-json` 参数

**替代方案**: 使用 `@anthropic-ai/claude-agent-sdk` 的 `query()` / `startup()` API

**理由**:
- Agent SDK 底层仍是 spawn CLI 子进程，无性能差异
- 当前代码已实现完整的流解析和事件映射，无需引入额外依赖
- 直接控制协议更灵活，可自定义心跳、超时、重建策略
- 避免额外 ~190MB 的 SDK 二进制依赖

### 2. 进程生命周期：按 Agent 粒度管理

**选择**: 每个 Agent 对应一个持久 CLI 进程，启动 Agent 时 spawn，停止 Agent 时终止

**替代方案**: 进程池模式，按需分配

**理由**:
- 项目规模为单实例、少量并发 Agent，不需要复杂的池管理
- 每个 Agent 有独立的 `cwd`、`model`、`permission_mode`、`custom_instructions`，进程隔离更安全
- 实现简单，状态管理清晰

### 3. 消息协议：NDJSON over stdin/stdout

**选择**: stdin 发送 `{"type":"user","message":{...},"session_id":"..."}` + `\n`

**理由**:
- 这是 Claude CLI 原生支持的双向流式协议
- stdout 返回 `system/init`、`assistant`、`result`、`control_request` 等类型化消息
- 与当前 `handleStreamJson()` 的事件解析高度兼容

### 4. 权限处理：control_response 协议

**选择**: 监听 stdout 的 `control_request` 事件，通过 stdin 回复 `control_response`

**替代方案**: 使用 `--dangerously-skip-permissions` 跳过所有权限

**理由**:
- 当前项目已支持权限模式选择（bypass / default / acceptEdits）
- `control_response` 协议允许精细控制每个工具调用的权限
- 保持与现有权限响应流程的兼容性

### 5. 健康监控：心跳 + 超时检测

**选择**: 定时发送 `{"type":"keep_alive"}` 到 stdin，检测 stdout 是否有响应

**理由**:
- CLI 支持 keep_alive 双向消息
- 可检测进程假死（进程存在但不再响应）
- 比仅检测进程存活更可靠

## Risks / Trade-offs

**[长驻进程内存占用]** → 每个 Agent 长驻一个 CLI 进程（~216MB），10 个 Agent 即 ~2GB。限制最大并发 Agent 数量（建议 5-8），并在 Agent 闲置超时后自动关闭进程。

**[进程僵死/泄漏]** → 实现 keep_alive 心跳检测，超过 60s 无响应自动重建进程。服务关闭时强制清理所有子进程。

**[Windows 兼容性]** → Windows 上 CLI 启动约 80s，需设置 `CLAUDE_CODE_STREAM_CLOSE_TIMEOUT=180000`。在启动流程中提示用户首次等待时间较长。

**[协议未官方文档化]** → stream-json 输入协议由多个开源项目逆向验证，存在版本兼容风险。锁定 CLI 版本，升级时验证协议兼容性。

**[回滚策略]** → 保留原有逐消息 spawn 代码路径作为 fallback，通过环境变量或配置切换模式。
