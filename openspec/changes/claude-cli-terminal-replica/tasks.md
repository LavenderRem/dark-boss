## 1. 共享类型定义

- [x] 1.1 在 `packages/shared/src` 中创建 `terminal-events.ts`，定义 `TerminalEvent` 联合类型及各事件 payload 接口（text, tool_use, tool_result, permission, status, error, user_input）
- [x] 1.2 在 `packages/shared/src/constants/index.ts` 中导出新类型，确保前后端可通过 `@dark-boss/shared` 导入
- [x] 1.3 运行 `pnpm build` 验证共享包类型编译通过

## 2. 后端事件协议升级

- [x] 2.1 重写 `agent-process-manager.ts` 的 `handleStreamJson` 函数，将 stream-json 事件转换为 `TerminalEvent` 类型化对象，通过 `agent:terminal_event` 频道广播
- [x] 2.2 为 `tool_use` 事件保留完整的 `event.input` 对象，不做 JSON.stringify
- [x] 2.3 为 `tool_result` 事件保留完整内容，不截断到 500 字符
- [x] 2.4 新增 `permission` 事件透传，将 Claude CLI 的权限请求转发到前端
- [x] 2.5 新增 `status` 事件广播，包含 model 名称、token 用量、预估费用
- [x] 2.6 保留旧的 `agent:process_output` 广播作为 fallback，标记为 @deprecated
- [x] 2.7 更新 `sendToAgent` 函数，将 stdin 改为 pipe 模式以支持权限交互回传
- [x] 2.8 新增 `agent:permission_response` WebSocket 消息处理，将用户权限响应写入 Claude CLI stdin

## 3. 前端 Store 重构

- [x] 3.1 重写 `agent-terminal-store.ts`，将 `lines: TerminalLine[]` 改为 `events: TerminalEvent[]`
- [x] 3.2 新增 `status` 状态字段追踪模型名、token 数、费用
- [x] 3.3 新增 `permissionPending` 状态字段追踪待响应的权限请求
- [x] 3.4 WebSocket hook 中新增 `agent:terminal_event` 消息监听，按事件类型分发到 store
- [x] 3.5 保留对旧 `agent:process_output` 消息的兼容转换（转为 text 事件）

## 4. 终端渲染引擎重写

- [x] 4.1 完全重写 `terminal-theme.ts`，新增 `renderToolUse(name, input)` 函数 — `⏺ ToolName(key: value)` 格式
- [x] 4.2 新增 `renderFileContent(path, content, startLine)` 函数 — 带行号的文件内容渲染，超过 100 行时首尾各显示 20 行
- [x] 4.3 新增 `renderDiff(path, diffLines)` 函数 — 红绿 diff 视图渲染
- [x] 4.4 新增 `renderPermissionPrompt(toolName, input)` 函数 — `Allow ToolName for path? [y/n/a/e]` 格式
- [x] 4.5 新增 `renderTextBlock(content)` 函数 — 段落分隔 + 首行缩进
- [x] 4.6 新增 `renderStatusBar(model, tokens, cost)` 函数 — `── ModelName · N tokens · $X.XXX ──` 格式
- [x] 4.7 新增 `renderPrompt()` 函数 — `> ` 聊天式提示符（绿色）
- [x] 4.8 新增 `renderUserInput(content)` 函数 — `  > content` 蓝色回显
- [x] 4.9 更新 ANSI 颜色常量，匹配 Claude Code CLI 配色方案

## 5. xterm-terminal.tsx 重构

- [x] 5.1 修改输入处理逻辑：`> ` 提示符替代 `[agentName]$ `，Enter 发送，Shift+Enter 换行
- [x] 5.2 实现多行输入：续行以 `  · ` 前缀标记
- [x] 5.3 Agent 运行时禁止输入：隐藏光标或 dim 提示符
- [x] 5.4 实现权限交互捕获：检测权限提示后的 y/n/a/e 键入
- [x] 5.5 实现流式增量渲染：text 事件用 `terminal.write()` 逐块写入，不等待整行
- [x] 5.6 实现工具调用/结果的整体块渲染
- [x] 5.7 实现底部状态栏：在输出区和输入区之间渲染 `── Model · tokens · $cost ──`
- [x] 5.8 实现自动滚动逻辑：新输出时自动滚到底，用户上滚时暂停

## 6. agent-terminal.tsx 容器调整

- [x] 6.1 更新 `AgentTerminal` 组件，订阅新的 `agent:terminal_event` 消息
- [x] 6.2 简化工具栏，移除已被状态栏替代的状态显示
- [x] 6.3 传递 `permissionPending` 状态给 xterm-terminal 以支持权限交互
- [x] 6.4 新增 `agent:permission_response` WebSocket 发送处理

## 7. 集成验证

- [x] 7.1 运行 `pnpm build` 确保全项目编译通过
- [x] 7.2 启动开发服务器，创建 Agent 并启动会话
- [x] 7.3 验证终端渲染：发送消息后观察文本、工具调用、文件内容的显示效果
- [x] 7.4 验证输入模式：`> ` 提示符、多行输入、Enter 发送
- [x] 7.5 验证状态栏：确认模型名、token 数、费用实时更新
- [x] 7.6 验证流式输出：确认文本逐字显示而非整块出现
- [x] 7.7 验证向后兼容：确认旧格式消息仍能正常显示
