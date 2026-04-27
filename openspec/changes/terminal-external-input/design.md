## Context

当前 Agent 终端使用 xterm.js 进行显示和输入。在 Windows 平台上，xterm.js 的 `attachCustomKeyEventHandler` 和 `onData` 机制无法正确处理 Backspace 删除 CJK 字符——Backspace 键被事件拦截器吞掉或光标移动计算错误。多次尝试修复（包括 visualWidth 计算、keydown/keypress 分离、不同转义码处理）均未解决根本问题。

涉及的文件：
- `packages/client/src/components/agent/xterm-terminal.tsx` — xterm.js 终端组件（含输入处理）
- `packages/client/src/components/agent/agent-terminal.tsx` — 终端容器组件

## Goals / Non-Goals

**Goals:**
- 将用户输入从 xterm.js 终端内完全分离，使用原生 HTML 输入控件
- 终端变为纯显示模式，不再处理任何键盘输入
- 输入框支持正常编辑（Backspace、光标移动、中文输入法等）
- 权限交互（y/n/a/e）通过同一输入框完成

**Non-Goals:**
- 不改变后端协议或 WebSocket 消息格式
- 不改变终端渲染引擎（terminal-theme.ts）
- 不实现命令历史或 Tab 补全（保留后续扩展空间但不在此变更中实现）

## Decisions

### 1. 输入框位置：终端下方独立区域

**选择**: 在终端和状态栏之间放置输入框

**备选方案**:
- A) 终端下方独立区域（采用）— 视觉上与终端整体感强，不遮挡输出
- B) 固定在页面底部的浮动输入栏 — 会遮挡内容，与页面布局冲突

**理由**: 终端容器 `agent-terminal.tsx` 已有 flex 列布局（toolbar → terminal → status bar），在 terminal 和 status bar 之间插入输入区域最自然。

### 2. 输入控件：Ant Design Input.TextArea

**选择**: 使用 `Input.TextArea` 配合 `autoSize`，单行显示，多行时自动扩展（最多 4 行）

**理由**:
- 原生 HTML 控件完美支持 Backspace、中文输入法、光标移动、复制粘贴
- Ant Design 组件已有项目依赖，风格统一
- autoSize 使输入框在内容少时保持单行紧凑，内容多时自动扩展

### 3. 终端简化：disableStdin + 移除输入 props

**选择**: 设置 `disableStdin: true`，移除 `onSubmit`、`onPermissionResponse` props 和所有 `onData`/`attachCustomKeyEventHandler` 输入拦截逻辑

**理由**: 终端不再需要任何输入功能，全部键盘事件由浏览器原生处理。Ctrl+F 搜索功能改由容器层监听 `keydown` 事件调用 searchAddon。

### 4. 权限交互：输入框模式切换

**选择**: 当 `permissionPending` 不为 null 时，输入框显示提示文字 "Allow ToolName? 输入 y/n/a/e"，发送内容作为权限响应

**理由**: 无需单独的权限 UI，复用同一输入框，逻辑更简单。

## Risks / Trade-offs

- **终端内无法输入** → 用户可能期望在终端内直接打字。通过在输入框获取焦点和绿色 `>` 前缀来暗示输入位置，降低困惑。
- **权限交互不够直观** → y/n/a/e 选项可能不明显。在权限模式下输入框 placeholder 显示选项说明。
- **Ctrl+F 搜索功能丢失** → 终端 disableStdin 后 attachCustomKeyEventHandler 不再需要，但搜索功能需在容器层重新挂载键盘监听。
