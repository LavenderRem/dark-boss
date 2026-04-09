# ADR-0005: Claude Agent SDK 替代 CLI 子进程

**Date**: 2026-04-09
**Status**: proposed
**Deciders**: 用户 (LavenderRem)

## Context

Dark Boss 需要程序化控制 Claude Code Agent 实例——启动、发送消息、接收输出、停止、恢复会话。Tide Commander 使用 `child_process.spawn('claude', [...args])` 启动 CLI 子进程并通过 tmux 管理会话。但 tmux 在 Windows 上不可用，需要 node-pty 模拟终端，而 node-pty 同样需要原生编译。

## Decision

Agent 控制层采用 Claude Agent SDK (TypeScript)，通过 `query()` 函数的异步迭代器获取结构化事件流。不再使用 CLI 子进程 + tmux/node-pty 方案。

## Alternatives Considered

### CLI 子进程 + node-pty（Tide Commander 方案）
- **Pros**: Tide Commander 已验证可行（130K 行 TypeScript 代码）；完整复刻 CLI 所有行为；agent 输出完全忠实于终端体验
- **Cons**: Windows 上无 tmux，需 node-pty（原生编译依赖）；需要解析 CLI 的 JSON Lines 输出（Tide Commander 的 backend.ts 28KB + session-loader.ts 40KB 证明了解析复杂度）；进程管理脆弱（僵尸进程、信号处理）
- **Why not**: Windows 原生模块编译问题（同 ADR-0002）；解析 stdout 的开发量远大于使用 SDK

### Claude Client SDK (messages API)
- **Pros**: 最底层控制，完全自定义工具执行逻辑；不依赖 Claude Code 的内置工具
- **Cons**: 需要自己实现整个 Agent 循环（prompt → tool call → execute → result → repeat）；不支持子 Agent、MCP 服务器、会话恢复等高级特性；开发量巨大
- **Why not**: 重新实现 Agent 循环不划算。Agent SDK 已经封装了 Claude Code 的全部能力。

### Docker 容器隔离
- **Pros**: 每个 Agent 运行在隔离容器中，完全独立；可水平扩展
- **Cons**: 启动慢（秒级 vs 毫秒级）；资源开销大（每个容器 ~100MB）；需要 Docker Desktop；增加部署复杂度
- **Why not**: 单用户桌面应用不需要容器隔离。当前场景 10 个以内的 Agent 完全可以在同一进程内管理。

## Consequences

### Positive
- Windows 原生支持：SDK 在 Node.js 异步上下文中运行，无需 tmux/node-pty
- 结构化事件流：直接获得类型化事件（assistant, tool_use, tool_result, result），无需解析 stdout
- 内置高级特性：子 Agent（`agents` 配置）、会话恢复（`resume`）、MCP 服务器（`mcpServers`）、权限控制（`allowedTools`）
- 进程管理简单：通过 AbortController 终止，无需处理僵尸子进程

### Negative
- SDK 相对较新（2026 年初发布），可能存在边缘情况
- 依赖 @anthropic-ai/claude-agent-sdk 包的稳定性和版本兼容性
- 当前 Phase 1 未实际集成 SDK，Agent 控制层还是占位状态

### Risks
- SDK API 可能在后续版本中发生破坏性变更。缓解：封装 AgentProcess 类抽象 SDK 接口，变更时只需修改一层。
- SDK 可能不支持某些 Claude Code CLI 的高级特性（如 hooks、skills）。缓解：如遇不支持的情况，可 fallback 到 CLI 子进程方案（保留接口兼容）。
