## 1. 简化 xterm-terminal.tsx

- [x] 1.1 设置 `disableStdin: true`，移除 `attachCustomKeyEventHandler` 中的输入拦截逻辑（仅保留 Ctrl+F 搜索）
- [x] 1.2 移除 `onSubmit` 和 `onPermissionResponse` props，移除 `onData` 终端输入处理（inputBufferRef、inputLineRef、visualWidth、handlePermissionInput）
- [x] 1.3 移除终端初始化中的欢迎信息和提示符写入（`> ` 不再由终端渲染）
- [x] 1.4 移除 `processStatus` useEffect 中运行时的 dim 光标提示
- [x] 1.5 清理未使用的 import 和 ref（useImperativeHandle、forwardRef 的 writePrompt/writeSeparator 可保留供容器使用）

## 2. agent-terminal.tsx 增加输入对话框

- [x] 2.1 新增 `useState` 管理输入文本状态
- [x] 2.2 在终端区域和状态栏之间添加输入区域：`Input.TextArea`（autoSize, maxRows 4）+ 发送 `Button`
- [x] 2.3 实现发送逻辑：Enter 发送（Shift+Enter 换行），空消息不发送，发送后清空输入框
- [x] 2.4 根据 processStatus 禁用/启用输入框和按钮（running/starting 时禁用）
- [x] 2.5 实现 Ctrl+F 搜索：在容器 div 上监听 keydown 事件，调用 searchAddon 触发搜索栏

## 3. 权限交互模式

- [x] 3.1 当 `permissionPending` 不为 null 时，输入框 placeholder 切换为权限提示文字
- [x] 3.2 发送内容通过 `handlePermissionResponse` 发送 `agent:permission_response` 消息

## 4. 验证

- [x] 4.1 运行 `pnpm build` 确认编译通过
- [ ] 4.2 启动开发服务器，验证输入框正常工作（输入、删除、发送）
- [ ] 4.3 验证终端仅显示输出，不接受键盘输入
- [ ] 4.4 验证 Agent 运行时输入框禁用
