## ADDED Requirements

### Requirement: 底部状态栏显示

终端 SHALL 在底部固定区域显示当前 Agent 的状态信息，包括模型名称、累计 token 用量和预估费用。

#### Scenario: 空闲状态栏
- **WHEN** Agent 处于 idle 状态
- **THEN** 底部状态栏显示 `── Sonnet 4.6 · 0 tokens · $0.000 ──`（灰色 dim 样式）

#### Scenario: 运行中状态栏
- **WHEN** Agent 正在执行
- **THEN** 状态栏 token 数实时更新，格式 `── Sonnet 4.6 · 2,341 tokens · $0.008 ──`

#### Scenario: 收到 token 用量更新
- **WHEN** 收到 `{ type: 'status', tokens: 2341, model: 'sonnet-4-6', cost: 0.008 }`
- **THEN** 状态栏立即更新显示新的 token 数和费用

### Requirement: 状态栏格式

状态栏 SHALL 使用 `──` 分隔线包裹，位于终端输出区域下方、输入区域上方。

#### Scenario: 格式规范
- **WHEN** 渲染状态栏
- **THEN** 格式为 `── <ModelName> · <tokens> tokens · $<cost> ──`，全行使用 ANSI dim 样式

### Requirement: 模型名称映射

系统 SHALL 将 API 模型标识映射为可读名称。

#### Scenario: 模型名称映射
- **WHEN** 收到 model 值为 `sonnet-4-6` 或 `sonnet`
- **THEN** 状态栏显示 `Sonnet 4.6`
- **WHEN** 收到 model 值为 `opus-4-7` 或 `opus`
- **THEN** 状态栏显示 `Opus 4.7`
- **WHEN** 收到 model 值为 `haiku-4-5` 或 `haiku`
- **THEN** 状态栏显示 `Haiku 4.5`
