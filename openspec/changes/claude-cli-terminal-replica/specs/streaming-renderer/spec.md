## ADDED Requirements

### Requirement: 逐 token 增量渲染

文本类型的事件 SHALL 支持增量写入，即收到部分文本时立即渲染到终端，不等待完整块。

#### Scenario: 流式文本输出
- **WHEN** 后端收到 stream-json 的 content_block_delta 事件包含部分文本 `"我来帮你"`
- **THEN** 前端立即将 `"我来帮你"` write 到终端，不换行

#### Scenario: 文本块结束
- **WHEN** 收到 content_block_stop 或完整 text 事件
- **THEN** 追加换行，结束当前文本块

### Requirement: 工具调用整体渲染

工具调用事件 SHALL 一次性渲染完整块（标题 + 参数摘要 + 结果），不做流式增量。

#### Scenario: tool_use 事件渲染
- **WHEN** 收到完整的 `{ type: 'tool_use', name: 'Read', input: {...} }`
- **THEN** 一次性渲染完整的 `⏺ Read(...)` 块

#### Scenario: tool_result 事件渲染
- **WHEN** 收到完整的 `{ type: 'tool_result', content: '...' }`
- **THEN** 一次性渲染完整内容（带行号或 diff 格式）

### Requirement: 自动滚动到底部

#### Scenario: 新输出到达时自动滚动
- **WHEN** 终端输出新内容且用户未手动上滚
- **THEN** 自动滚动到终端底部显示最新内容

#### Scenario: 用户上滚时不强制滚动
- **WHEN** 用户手动向上滚动终端
- **THEN** 新输出到达时不自动滚动到底部，保持用户当前位置

#### Scenario: 用户滚动回底部恢复自动滚动
- **WHEN** 用户滚动回终端底部
- **THEN** 恢复自动滚动行为
