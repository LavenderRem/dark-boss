## ADDED Requirements

### Requirement: 聊天式提示符

终端 SHALL 使用 `> ` 作为输入提示符，替代当前的 `[agentName]$ ` shell 风格提示符。

#### Scenario: 空闲状态提示符
- **WHEN** 终端初始化或 Agent 回复完成后
- **THEN** 显示 `> ` 提示符（绿色），光标在其后闪烁

#### Scenario: 输入中状态
- **WHEN** 用户正在输入消息
- **THEN** `> ` 保持显示，用户输入的字符紧跟其后

### Requirement: 多行输入支持

终端 SHALL 支持 Shift+Enter 换行和 Enter 发送。

#### Scenario: Enter 发送消息
- **WHEN** 用户按下 Enter 键且输入缓冲区不为空
- **THEN** 提交当前输入内容，清除输入缓冲区，不清除已输入的文字

#### Scenario: Shift+Enter 换行
- **WHEN** 用户按下 Shift+Enter
- **THEN** 在当前输入中插入换行，终端显示新行以 `  · ` 前缀标记续行

#### Scenario: 空输入忽略
- **WHEN** 用户在空输入时按 Enter
- **THEN** 不发送任何消息，仅换行重新显示 `> ` 提示符

### Requirement: Ctrl+C 取消输入

#### Scenario: 取消当前输入
- **WHEN** 用户按下 Ctrl+C 且有输入内容
- **THEN** 清除当前输入，显示 `^C`，换行显示新的 `> ` 提示符

### Requirement: Agent 运行时禁止输入

#### Scenario: Agent 执行中输入
- **WHEN** Agent 状态为 `running` 且用户尝试输入
- **THEN** 终端不响应输入（光标隐藏或变暗），底部显示 "Agent 正在执行..."

#### Scenario: Agent 完成后恢复输入
- **WHEN** Agent 状态从 `running` 变为 `idle`
- **THEN** 恢复 `> ` 提示符和输入功能
