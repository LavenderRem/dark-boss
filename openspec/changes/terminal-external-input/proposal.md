## Why

xterm.js 终端内的文本输入在 Windows 上存在 Backspace 无法删除字符的根本性问题（尤其是 CJK 中文字符），多次尝试修复 attachCustomKeyEventHandler 和光标移动逻辑均未解决。终端模拟器本身不适合作为富文本编辑器使用，应将输入职责分离到原生 HTML 表单控件中。

## What Changes

- **BREAKING**: 移除 xterm-terminal.tsx 中所有终端内输入处理逻辑（onData 键盘拦截、inputBuffer、visualWidth 计算、权限交互捕获），终端变为纯显示模式（`disableStdin: true`）
- 在 agent-terminal.tsx 的终端区域下方新增独立对话框组件，包含文本输入框和发送按钮
- 对话框在 Agent 运行时禁用输入，空闲/就绪时允许输入
- Enter 发送消息，Shift+Enter 换行
- 权限交互（y/n/a/e）也通过对话框完成，发送后自动切换回普通消息模式

## Capabilities

### New Capabilities
- `terminal-input-dialog`: 终端底部独立输入对话框，替代 xterm.js 内置输入，支持文本编辑、发送消息、权限响应

### Modified Capabilities
（无已有 spec 需要修改）

## Impact

- **前端组件**:
  - `xterm-terminal.tsx` — 大幅简化，移除输入相关代码和 props（onSubmit、onPermissionResponse）
  - `agent-terminal.tsx` — 新增输入对话框 UI，管理输入状态
- **后端**: 无变更
- **共享类型**: 无变更
- **依赖**: 无新增依赖
