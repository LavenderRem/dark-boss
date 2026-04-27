## ADDED Requirements

### Requirement: 独立输入对话框
系统 SHALL 在终端显示区域下方提供独立的文本输入对话框，包含文本输入框和发送按钮，替代 xterm.js 终端内输入。

#### Scenario: 正常发送消息
- **WHEN** Agent 状态为 idle 或 stopped，用户在输入框输入文本并点击发送按钮或按 Enter
- **THEN** 系统通过 `agent:send_message` WebSocket 消息发送文本内容，清空输入框

#### Scenario: Agent 运行中禁用输入
- **WHEN** Agent 状态为 running 或 starting
- **THEN** 输入框和发送按钮 SHALL 处于禁用状态，用户无法输入或发送

#### Scenario: 多行输入
- **WHEN** 用户按 Shift+Enter
- **THEN** 输入框插入换行符，不触发发送

#### Scenario: 空消息不发送
- **WHEN** 输入框内容为空或仅包含空白字符，用户点击发送或按 Enter
- **THEN** 系统不发送消息，输入框保持原状

### Requirement: 终端纯显示模式
系统 SHALL 将 xterm.js 终端设为纯显示模式（disableStdin: true），移除所有终端内输入处理逻辑。

#### Scenario: 终端不接受键盘输入
- **WHEN** 用户在终端区域按下任意键
- **THEN** 终端不响应任何键盘输入，仅作为输出显示区域

#### Scenario: 已有渲染功能不受影响
- **WHEN** 后端发送 terminal_event
- **THEN** 终端正常渲染事件（文本、工具调用、文件内容、diff 等），与变更前行为一致

### Requirement: 权限交互模式
系统 SHALL 在 permissionPending 不为 null 时将输入框切换为权限响应模式。

#### Scenario: 权限提示显示
- **WHEN** 后端发送 permission 事件
- **THEN** 输入框 placeholder 显示 "Allow ToolName? 输入 y/n/a/e"，输入框获得焦点

#### Scenario: 发送权限响应
- **WHEN** 用户在权限模式下输入 y/n/a/e 并发送
- **THEN** 系统通过 `agent:permission_response` WebSocket 消息发送响应，清除 permissionPending 状态

#### Scenario: 权限响应后恢复正常模式
- **WHEN** 权限响应已发送
- **THEN** 输入框恢复为普通消息输入模式

### Requirement: Ctrl+F 搜索保留
系统 SHALL 保留终端搜索功能，通过容器层键盘事件监听触发。

#### Scenario: 触发搜索
- **WHEN** 用户在终端容器区域按 Ctrl+F
- **THEN** 终端显示搜索栏，与变更前行为一致
