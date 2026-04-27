## ADDED Requirements

### Requirement: ⏺ 工具调用渲染

系统 SHALL 使用 `⏺` 图标前缀渲染工具调用，格式为 `⏺ ToolName(key: value, key: value)`，参数按工具类型智能摘要显示。

#### Scenario: Read 工具调用渲染
- **WHEN** 收到 `{ type: 'tool_use', name: 'Read', input: { file_path: 'src/App.tsx', offset: 1, limit: 30 } }`
- **THEN** 渲染为 `⏺ Read(file_path: "src/App.tsx", offset: 1, limit: 30)`（绿色加粗）

#### Scenario: Edit 工具调用渲染
- **WHEN** 收到 `{ type: 'tool_use', name: 'Edit', input: { file_path: 'src/App.tsx' } }`
- **THEN** 渲染为 `⏺ Edit(file_path: "src/App.tsx")`（绿色加粗）

#### Scenario: Bash 工具调用渲染
- **WHEN** 收到 `{ type: 'tool_use', name: 'Bash', input: { command: 'npm run build' } }`
- **THEN** 渲染为 `⏺ Bash(command: "npm run build")`（绿色加粗）

### Requirement: 文件内容带行号渲染

当 `tool_result` 包含文件内容时，系统 SHALL 带行号渲染，格式为 `  N │ content`。

#### Scenario: 短文件完整渲染
- **WHEN** Read 工具返回 10 行内容，startLine 为 1
- **THEN** 每行渲染为 `   1 │ <content>`、`   2 │ <content>` 等格式（灰色行号 + 白色内容）

#### Scenario: 长文件折叠渲染
- **WHEN** Read 工具返回超过 100 行内容
- **THEN** 渲染首 20 行和尾 20 行，中间显示 `  ... (N lines hidden)`

### Requirement: Diff 视图渲染

当工具结果包含代码差异时，系统 SHALL 使用红绿色标识增删行。

#### Scenario: Edit 工具 diff 渲染
- **WHEN** Edit 工具返回包含旧内容和新内容
- **THEN** 删除行渲染为红色 `  - <old line>`，新增行渲染为绿色 `  + <new line>`

#### Scenario: 多处差异渲染
- **WHEN** 文件中有多处修改
- **THEN** 每处差异之间保留 2 行上下文，超过时用 `  ...` 分隔

### Requirement: 文本块渲染

Claude 的自然语言回复 SHALL 使用段落分隔，首行缩进 2 个空格，不使用特殊前缀。

#### Scenario: 单段落回复
- **WHEN** 收到 `{ type: 'text', content: '这是回复内容。' }`
- **THEN** 渲染为 `  这是回复内容。`（白色，正常字重）

#### Scenario: 多段落回复
- **WHEN** 收到包含换行符的文本
- **THEN** 段落之间用空行分隔，每段首行缩进 2 空格

### Requirement: 权限提示渲染

当 Claude 需要权限确认时，系统 SHALL 在终端内渲染交互式提示。

#### Scenario: 权限请求显示
- **WHEN** 收到 `{ type: 'permission', toolName: 'Edit', input: { file_path: 'src/App.tsx' } }`
- **THEN** 渲染为 `Allow Edit for src/App.tsx? [y/n/a/e]`（黄色加粗），等待用户键入

#### Scenario: 用户确认权限
- **WHEN** 用户在权限提示后键入 `y`
- **THEN** 终端显示 `y`，换行，通过 `agent:permission_response` 发送响应

### Requirement: 错误信息渲染

错误信息 SHALL 使用红色加粗 + `✖` 前缀。

#### Scenario: 错误显示
- **WHEN** 收到 `{ type: 'error', message: '文件不存在' }`
- **THEN** 渲染为 `✖ 文件不存在`（红色加粗）

### Requirement: 用户输入回显

用户输入的消息 SHALL 使用 `>` 前缀回显，蓝色显示。

#### Scenario: 用户消息回显
- **WHEN** 用户提交消息 "请帮我查看 App.tsx"
- **THEN** 终端渲染为 `  > 请帮我查看 App.tsx`（蓝色）
