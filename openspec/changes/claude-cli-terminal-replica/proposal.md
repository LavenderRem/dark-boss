## Why

当前员工详情中的终端使用简陋的 shell 风格渲染（`[agentName]$ ` 提示符、box-drawing 字符框），与 Claude Code CLI 的专业终端体验差距巨大。用户无法直观看到工具调用的文件内容、代码差异、权限确认等关键信息。需要完全复刻 Claude Code CLI 的视觉风格和交互模式，让 Dark Boss 的 Agent 终端成为真正的 Claude Code 替代界面。

## What Changes

- **后端事件协议升级**：将 `handleStreamJson` 从粗粒度 `{ text, channel }` 改为类型化事件流，保留完整的 stream-json 语义（工具输入参数、完整结果内容、流式 delta 等）
- **终端渲染引擎重写**：`terminal-theme.ts` 从 box-drawing 框线风格改为 Claude Code CLI 的 `⏺` 图标风格，新增文件内容（带行号）、diff 视图、权限提示、状态栏等渲染器
- **输入模式改造**：从 shell 行编辑 `[agentName]$ ` 改为 Claude Code CLI 的聊天式 `>` 提示符，支持多行输入
- **流式增量渲染**：支持逐 token/逐块 写入终端，实现实时流式输出效果
- **底部状态栏**：显示模型名称、token 用量、预估费用
- **权限交互支持**：在终端内渲染权限确认提示 `[y/n/a/e]`，用户输入后通过 WebSocket 回传后端

## Capabilities

### New Capabilities

- `terminal-event-protocol`: 定义后端到前端的类型化终端事件协议，替代当前的 `{ text, channel }` 简单格式
- `cli-style-renderer`: Claude Code CLI 风格的 ANSI 终端渲染器，包含工具调用、文件内容、diff、权限提示等视觉元素
- `chat-input-mode`: 聊天式终端输入模式，替代 shell 行编辑
- `terminal-status-bar`: 终端底部状态栏，显示模型、token 用量、费用信息
- `streaming-renderer`: 流式增量终端渲染，支持逐 token 实时输出

### Modified Capabilities

## Impact

- **后端**：`agent-process-manager.ts` 的 `handleStreamJson` 函数重写，WebSocket 广播协议变更
- **前端**：`terminal-theme.ts` 完全重写，`xterm-terminal.tsx` 大幅重构，`agent-terminal.tsx` 和 `agent-terminal-store.ts` 调整
- **共享类型**：`packages/shared` 新增终端事件类型定义
- **API 协议**：WebSocket 消息类型从 `agent:process_output` 扩展为多个类型化事件
- **依赖**：无新依赖引入，继续使用 xterm.js
