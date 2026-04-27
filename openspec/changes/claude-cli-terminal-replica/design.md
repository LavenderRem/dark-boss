## Context

Dark Boss 的 Agent 终端当前使用自定义 shell 风格渲染：`[agentName]$ ` 提示符 + box-drawing 字符框。后端 `handleStreamJson` 将 Claude CLI 的 stream-json 输出压缩为 `{ text, channel }` 简单格式，丢失了工具参数结构、完整结果内容、流式 delta 等关键语义。前端 `terminal-theme.ts` 仅提供 5 种 channel 级别的 ANSI 着色。

目标是在 xterm.js 终端中完整复刻 Claude Code CLI 的视觉风格和交互模式。Claude Code CLI 本身就是终端应用，使用 ANSI 转义码渲染，因此 xterm.js 天然适合作为渲染引擎。

## Goals / Non-Goals

**Goals:**
- 视觉上 1:1 还原 Claude Code CLI 的终端输出风格
- 功能上支持：工具调用展示（文件内容+行号、diff 视图）、流式增量输出、权限确认交互
- 输入模式从 shell 行编辑改为 Claude Code CLI 的 `>` 聊天式提示符
- 底部状态栏显示模型名、token 用量、费用
- 后端保留完整的 stream-json 事件语义，不截断不丢弃

**Non-Goals:**
- 不实现 Claude Code CLI 的全部命令（/help、/clear 等斜杠命令）
- 不实现终端内的 markdown 语法高亮（保持纯文本 ANSI 渲染）
- 不实现多会话标签页（保持单 agent 单终端）
- 不替换 xterm.js 为自定义 HTML 渲染器

## Decisions

### D1: 保持 xterm.js 作为渲染引擎

**选择**: 继续使用 xterm.js，通过增强 ANSI 格式化复刻 Claude Code CLI 风格

**替代方案**: 自定义 HTML 渲染器（如 React 组件列表）
- 放弃原因：需要自建滚动、选择、搜索；xterm.js 已内置这些能力；Claude CLI 本身就是终端 ANSI 输出

### D2: 前端格式化、后端透传

**选择**: 后端发送类型化事件（保留完整数据结构），前端 `terminal-theme.ts` 负责所有 ANSI 渲染

**替代方案**: 后端生成 ANSI 字符串，前端直接 write
- 放弃原因：渲染逻辑集中在前端更容易调试和迭代；后端保持无状态数据透传

### D3: 事件协议设计

**选择**: 新增 WebSocket 事件类型 `agent:terminal_event`，payload 包含 `type` 和 `data` 字段

```typescript
// 新协议
{ agentId, event: TerminalEvent }

// TerminalEvent 联合类型
type TerminalEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolUseId: string; content: string; isError: boolean }
  | { type: 'permission'; toolName: string; input: Record<string, unknown>; options: string[] }
  | { type: 'status'; model: string; tokens: number; cost: number }
  | { type: 'error'; message: string }
  | { type: 'user_input'; content: string }
```

**替代方案**: 继续用 `agent:process_output` 扩展 channel 枚举
- 放弃原因：channel 是字符串枚举，无法携带结构化数据；新协议更清晰

### D4: 流式渲染策略

**选择**: 使用 `terminal.write()` 逐块增量写入，不用 `terminal.writeln()` 等整行

- `text` 事件：直接 write 内容，末尾追加换行
- `tool_use` 事件：一次性 write 完整的 ANSI 格式化块
- `tool_result` 事件：同上

### D5: 输入模式改造

**选择**: `>` 提示符 + 多行输入支持（Shift+Enter 换行，Enter 发送）

- 当前: `[agentName]$ ` + 单行 shell 编辑
- 改后: `> ` + 多行输入，Enter 发送消息，Shift+Enter 换行

### D6: 权限交互

**选择**: 终端内渲染权限提示，捕获 y/n/a/e 键入回传后端

- 终端显示: `Allow Read for src/App.tsx? [y/n/a/e]`
- 用户键入后: 通过 `agent:permission_response` WebSocket 事件回传
- 后端需要将响应通过 stdin 传递给 Claude CLI 进程

## Risks / Trade-offs

**[R1] Claude CLI stream-json 格式不完全透明** → 通过实际运行 `claude -p "test" --output-format stream-json --verbose` 捕获真实输出样本，在实现时参照

**[R2] 大文件内容渲染性能** → 对超过 100 行的文件内容只渲染首尾各 20 行，中间用 `... (N lines hidden)` 提示

**[R3] 权限交互需要 stdin 双向通信** → 当前 `-p` 模式 stdin=ignore，需要改为 stdin=pipe 并在权限请求时写入 stdin

**[R4] WebSocket 协议变更的向后兼容** → 新旧协议并行运行，新字段可选，旧 `agent:process_output` 保留作为 fallback

**[R5] Unicode 图标在终端字体中的支持** → `⏺` 在 JetBrains Mono 中支持良好，备选 `●` 或 `▸`
