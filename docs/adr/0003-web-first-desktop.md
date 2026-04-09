# ADR-0003: Web-first 桌面封装策略

**Date**: 2026-04-09
**Status**: accepted
**Deciders**: 用户 (LavenderRem)

## Context

Dark Boss 是一个桌面开发工具，用户在本地机器上运行，通过浏览器界面管理 AI Agent。需要决定应用是以纯 Web 形式运行，还是封装为原生桌面应用 (Electron 或 Tauri)。

## Decision

Phase 1-3 采用纯 Web 方案（Express 后端 + Vite 前端，浏览器访问）。Phase 4 及以后可选用 Tauri v2 封装为桌面应用。

## Alternatives Considered

### Electron
- **Pros**: 成熟生态，OctoAlly 和 AgentsRoom 都用 Electron；系统托盘、原生窗口菜单、自动更新等开箱即用
- **Cons**: 安装包巨大（~150MB+）；内存占用高（Chromium + Node.js 双进程）；每次启动需要编译原生模块
- **Why not**: 对开发阶段来说太重了。纯 Web 方案 `pnpm dev` 秒级启动，调试方便

### Tauri v2
- **Pros**: 安装包小（~10MB）；Rust 后端性能优秀；内存占用低；系统托盘、原生菜单、文件系统 API 都支持
- **Cons**: 需要 Rust 工具链；与前端通信的 IPC 模型比直接 HTTP 复杂；生态不如 Electron 成熟
- **Why not**: 开发阶段引入 Rust 工具链增加复杂度。但作为 Phase 4 的桌面封装方案是最佳选择——安装包小、性能好

### 纯 Web（当前选择）
- **Pros**: 开发最快，零额外依赖；`pnpm dev` 即可运行；浏览器 DevTools 调试；Vite HMR 秒级热更新
- **Cons**: 需要手动打开浏览器；无系统托盘；无原生文件对话框；无法开机自启
- **Why chosen**: 开发效率优先。所有功能验证完毕后再考虑桌面封装

## Consequences

### Positive
- 开发迭代最快：改代码 → 浏览器自动刷新
- 零安装摩擦：用户只需 Node.js，`pnpm dev` 即用
- 调试体验好：Chrome DevTools + VS Code 断点

### Negative
- 用户需要手动打开浏览器并记住端口号
- 无法集成系统托盘、通知、全局快捷键等桌面特性

### Risks
- 后期迁移到 Tauri 时需要适配 IPC 通信层。缓解：当前架构已通过 HTTP API 解耦前后端，Tauri 的 webview 直接复用前端代码，迁移成本低。
