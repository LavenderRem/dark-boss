# ADR-0001: TypeScript 全栈统一后端技术栈

**Date**: 2026-04-09
**Status**: accepted
**Deciders**: 用户 (LavenderRem)

## Context

Dark Boss (暗黑老板) 是一个图形化 Claude Code 多 Agent 编排平台，需要前后端协作紧密。后端需要与 Claude Agent SDK 交互控制 AI Agent 实例。用户是全栈开发工程师，单人开发，需要最大化开发效率。

## Decision

使用 TypeScript 作为前后端统一语言，Node.js 24 作为后端运行时，通过 pnpm workspaces 构建 monorepo。

## Alternatives Considered

### Java (Spring Boot)
- **Pros**: 中国企业级生态最成熟 (Spring Boot, MyBatis-Plus)；真正的多线程并发支持 50+ Agent；Spring Security 权限框架完善
- **Cons**: 无官方 Claude Agent SDK，需通过 ProcessBuilder 封装 CLI 子进程并解析 stdout，开发量增加 3-5 倍；前后端类型无法共享；启动慢，热重载慢；单人开发 Java + React 双栈心智负担大
- **Why not**: Agent SDK 支持是核心短板。无 SDK 意味着所有 Agent 交互（子 Agent、会话恢复、MCP 集成、权限控制）都需要手动实现，ROI 不划算

### Python (FastAPI)
- **Pros**: 官方 Claude Agent SDK (`claude-agent-sdk`)；AI/ML 生态最强；FastAPI 开发速度快，自动 OpenAPI 文档
- **Cons**: GIL 限制高并发场景；前后端类型无法共享，需手动同步；Python 的类型系统不如 TypeScript 严格；Windows 上打包分发体验不如 Node.js
- **Why not**: 前后端分裂是单人开发的最大障碍。TypeScript 可以在 shared 包中统一类型定义，前后端一份代码。

## Consequences

### Positive
- 全栈类型共享：shared 包定义一次类型，前后端直接复用
- 单人开发效率最高：一个语言、一套工具链、一个包管理器
- Agent SDK 原生支持：TypeScript SDK 提供结构化事件流、会话恢复、子 Agent
- Windows 原生支持：Node.js 在 Windows 上无兼容性问题

### Negative
- 单线程模型限制了 50+ Agent 并发场景（当前 10 个以内足够）
- 企业级治理能力不如 Java (Spring Security, Spring Boot Actuator)
- 中国企业市场中 TypeScript 后端不如 Java "正统"

### Risks
- 如果未来需要支持 50+ 并发 Agent，可能需要引入 Worker Threads 或迁移部分服务到 Go/Rust。缓解：当前架构用事件驱动 I/O，10 个 Agent 完全够用，到瓶颈时再优化。
