# 开发进度与计划

> 本文档记录项目开发进度，供跨环境/跨会话恢复上下文使用。

## 当前状态

**Phase 1：基础 + 员工网格 + 基础控制 — ✅ 已完成**
**Phase 2：工作流画布 + 实时执行 — ✅ 已完成**
**Phase 3：组织架构 + 看板 + 群聊 — ✅ 已完成**
**Phase 4：绩效系统 + 招聘市场 + UI 打磨 — ✅ 已完成**
**Phase 5：Claude Code SDK 集成 — ✅ 已完成**
**Phase 6：执行日志查看器面板 — ✅ 已完成**
**Phase 7：协作看板功能完善 — ✅ 已完成**

---

## Phase 4 完成清单

### 后端（已完成）
- [x] 绩效快照表 `performance_snapshots`（每日指标聚合）
- [x] 绩效报告表 `performance_reports`（AI 生成报告存储）
- [x] 绩效计算服务 `performance-service.ts`
  - `calculateAgentMetrics()` — 从 tasks/agent_events 聚合指标
  - `snapshotAll()` — 定时为所有活跃 Agent 生成每日快照（每小时执行）
  - `generateReport()` — 模板化生成 AI 绩效报告
  - `getAgentPerformanceOverview()` — Agent 绩效概览
  - `getDashboardStats()` — 团队整体统计
  - `getAgentTrend()` — 趋势数据
- [x] 绩效 API 路由 `performance.ts`（4 个端点）
- [x] 模板安装接口扩展（支持 model、departmentId 参数）

### 前端（已完成）
- [x] 绩效考核页面 (`pages/performance/index.tsx`)
  - 团队概览统计卡片（任务完成、效率分、Token、费用）
  - 效率排行 Bar Chart（recharts）
  - 任务分布 Pie Chart
  - 近期产出趋势图
  - Agent 绩效明细表格（排序 + 报告按钮）
  - AI 绩效报告弹窗（评分、总结、优势、待改进）
- [x] 招聘市场页面 (`pages/market/index.tsx`)
  - 分类筛选标签（全部/前端/后端/全栈/架构/测试/运维/产品）
  - 模板卡片网格（图标、描述、工具标签、安装数）
  - 招聘弹窗（自定义名称、工作目录、模型选择、所属部门）
- [x] UI 打磨
  - Header 实时统计（员工数、在线数、Token 消耗，30s 刷新）
  - 各页面骨架屏 Loading（org-chart、kanban、performance、market）
  - 空状态优化（Empty 组件）

### 新增/修改文件清单
```
# 新增
packages/shared/src/types/performance.ts        # 绩效类型定义
packages/server/src/services/performance-service.ts  # 绩效计算服务
packages/server/src/routes/performance.ts        # 绩效 API 路由
packages/client/src/pages/performance/index.tsx  # 绩效考核页面
packages/client/src/pages/market/index.tsx       # 招聘市场页面

# 修改
packages/shared/src/index.ts                     # 导出 performance 类型
packages/server/src/db/connection.ts             # 新增 2 个表 + 索引
packages/server/src/routes/index.ts              # 注册 performance 路由
packages/server/src/routes/templates.ts          # 扩展安装参数
packages/server/src/index.ts                     # 添加绩效定时任务
packages/client/src/App.tsx                      # 注册新页面路由
packages/client/src/components/layout/app-layout.tsx  # Header 实时统计
packages/client/src/pages/org-chart/index.tsx    # 骨架屏 Loading
packages/client/src/pages/kanban/index.tsx       # 骨架屏 Loading
```

### 新增依赖
```bash
pnpm --filter @dark-boss/client add recharts
```

### 新增 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /performance/dashboard | 团队整体统计 |
| GET | /performance/agents | 所有 Agent 绩效概览 |
| GET | /performance/agents/:id | 单个 Agent 绩效详情 + 趋势 |
| GET | /performance/agents/:id/report | 获取/生成 AI 绩效报告 |

---

## Phase 4 ~~计划~~ → 已完成

### 任务分解

| # | 任务 | 关键文件 |
|---|------|----------|
| 4.1 | 绩效指标定时计算 (cron) | `performance-service.ts`, `connection.ts` |
| 4.2 | 绩效仪表盘页面 | `pages/performance/index.tsx` |
| 4.3 | AI 生成绩效考核报告 | `performance-service.ts` (generateReport) |
| 4.4 | 招聘市场页面 | `pages/market/index.tsx` |
| 4.5 | 模板安装流程完善 | `routes/templates.ts` |
| 4.6 | UI 打磨（骨架屏、过渡动画、空状态） | 各页面组件 |

---

## 待优化（Phase 4 遗留）→ 全部已完成

- [x] 员工管理页面完整实现（CRUD + 详情弹窗 + 编辑/删除）
- [x] 工作流保存/加载 UI 接入 API（保存按钮调 PATCH，进入页面自动加载）
- [x] 工作流列表页（卡片网格展示，选择/切换/新建/删除工作流）
- [x] 聊天 WebSocket 实时接收新消息（自动重连 + 按 channelId 过滤）
- [x] 看板 dnd-kit SortableContext 同列内排序（useSortable + CSS.Transform）
- [x] 边上 "插入节点" 交互（点击 + 按钮在边中间插入 Agent 节点 + 自动连线）
- [x] 绩效趋势图从真实快照数据渲染（LineChart 时间序列 + 团队趋势 API）
- [x] 模板评分系统（Rate 组件 + 后端加权平均）
- [x] 组织架构拖拽排序部门（Tree draggable + onDrop + move API）
- [x] 执行日志查看器面板（员工详情 Tabs + agent_events 表查询）
- [x] 前端 build chunk 优化（Vite manualChunks 分包：react/antd/flow/charts/dnd）
- [x] AI 报告接入 Claude Code SDK（降级到模板化生成作为回退）
- [x] Agent 自动回复消息（接入 Claude Code CLI 子进程 + WebSocket 流式推送）
- [x] 消息富文本/Markdown 支持（react-markdown + 代码高亮 + 流式渲染）

---

## Phase 5 完成清单：Claude Code SDK 集成

### 后端（已完成）
- [x] Claude Code SDK 封装层 `claude-client.ts`（CLI 子进程调用 + 会话管理）
  - `streamQuery()` — 流式调用（聊天回复），解析 stream-json 输出
  - `singleQuery()` — 单次调用（绩效报告），解析 json 输出
  - 会话管理（agentId -> sessionId 映射）
  - 进程管理（abort 中断 + 超时控制）
- [x] 绩效报告 AI 生成 `performance-service.ts`
  - `generateReport()` 改为异步
  - 接入 Claude Code CLI 生成智能报告
  - 降级策略：API Key 未配置或调用失败时回退到模板化生成
- [x] Agent 聊天自动回复服务 `chat-agent-service.ts`
  - `handleAgentMention()` — @ 提及触发 Agent 回复
  - 流式 WebSocket 推送（agent:output / agent:complete / agent:status）
  - 并发控制（同一 Agent 同时只处理一个请求）
  - 状态管理（working -> idle/error）
- [x] WebSocket 扩展 `connection.ts`
  - 新增 `agent:message` 事件处理（触发 Agent 回复）
  - 新增 `agent:interrupt` 事件处理（中断 Agent 回复）
- [x] 聊天路由扩展 `chat.ts`
  - 消息发送后异步触发 Agent 回复
  - 支持 `messageType` 字段传递

### 前端（已完成）
- [x] Markdown 渲染组件 `markdown-renderer.tsx`
  - react-markdown + remark-gfm + rehype-highlight
  - 暗色主题适配
  - 代码块带语言标签和复制按钮
  - 自定义表格、引用、列表样式
- [x] 流式消息组件 `streaming-message.tsx`
  - 监听 agent:output 事件，累积文本
  - 实时 Markdown 渲染
  - 打字指示器动画
  - 完成/错误状态处理
- [x] 聊天页面增强 `chat/index.tsx`
  - Agent 消息自动使用 Markdown 渲染
  - 流式回复实时显示
  - agent:output / agent:complete WebSocket 事件处理

### 新增文件
```
packages/server/src/services/claude-client.ts        # Claude Code CLI 封装层
packages/server/src/services/chat-agent-service.ts    # Agent 聊天自动回复服务
packages/client/src/components/chat/markdown-renderer.tsx  # Markdown 渲染组件
packages/client/src/components/chat/streaming-message.tsx  # 流式消息组件
```

### 修改文件
```
packages/server/src/utils/config.ts               # 新增 anthropicApiKey 配置
packages/server/src/index.ts                      # API Key 启动检查 + 警告
packages/server/src/services/performance-service.ts  # generateReport 改异步 + SDK 调用
packages/server/src/routes/performance.ts          # 路由加 async
packages/server/src/ws/connection.ts               # 新增 agent:message/interrupt 事件
packages/server/src/routes/chat.ts                 # 消息后触发 Agent 回复
packages/shared/src/types/event.ts                 # ChatMessagePayload 增加 messageType
packages/client/src/pages/chat/index.tsx           # Markdown 渲染 + 流式消息
```

### 新增依赖
```bash
pnpm --filter @dark-boss/client add react-markdown remark-gfm rehype-highlight
```

### 使用说明

1. 设置环境变量：
```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

2. 确保 `claude` CLI 已全局安装（`npm install -g @anthropic-ai/claude-code`）

3. 启动服务：
```bash
pnpm dev
```

4. 在聊天中 @ 一个 Agent 即可触发自动回复
5. 点击绩效报告按钮可生成 AI 分析报告

### 待优化（Phase 5 遗留）
- [ ] Agent 工作目录选择器（当前使用默认 /workspace/project1）
- [ ] 消息附件/文件上传功能
- [ ] Agent 回复历史上下文优化（当前最近 20 条）
- [ ] 多轮对话支持（Agent 记忆跨消息上下文）
- [ ] Agent 回复成本统计面板

---

## Phase 6 完成清单：执行日志查看器面板

### 后端（已完成）
- [x] `workflow_execution_logs` 表（记录每个节点的执行状态、输入/输出、耗时、token、费用）
- [x] 工作流引擎写入执行日志（每次执行生成 executionId，节点开始/完成时写入/更新日志）
- [x] 执行日志 API 端点
  - `GET /workflows/:id/executions` — 执行记录列表
  - `GET /workflows/:id/executions/latest` — 最近一次执行日志
  - `GET /workflows/:id/executions/:executionId` — 指定执行的节点日志

### 前端（已完成）
- [x] workflow-store 扩展（executionId、executionLogs、showLogPanel 状态）
- [x] ExecutionLogPanel 组件（底部 Drawer、Timeline 展示、实时 WebSocket 更新）
- [x] 工具栏"执行日志"按钮（FileSearchOutlined 图标）
- [x] 画布页面集成（传递 onToggleLogPanel、添加 ExecutionLogPanel）

### 新增文件
```
packages/client/src/pages/canvas/components/execution-log-panel.tsx  # 执行日志面板
```

### 修改文件
```
packages/server/src/db/connection.ts              # 新增 workflow_execution_logs 表 + 索引
packages/server/src/services/workflow-engine.ts    # 执行过程写入日志（insertExecutionLog/updateExecutionLog）
packages/server/src/routes/workflows.ts            # 新增 3 个执行日志端点
packages/client/src/stores/workflow-store.ts       # 新增 ExecutionLogEntry 类型 + 6 个日志 Actions
packages/client/src/pages/canvas/index.tsx         # 集成 ExecutionLogPanel + 传递 executionId
packages/client/src/pages/canvas/components/flow-canvas.tsx  # 传递 onToggleLogPanel
packages/client/src/pages/canvas/components/flow-toolbar.tsx  # 新增日志按钮
```

### 新增 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /workflows/:id/executions | 执行记录列表（按 execution_id 分组） |
| GET | /workflows/:id/executions/latest | 最近一次执行的节点日志 |
| GET | /workflows/:id/executions/:executionId | 指定执行的节点日志 |

---

## Phase 7 完成清单：协作看板功能完善

### 后端（已完成）
- [x] 任务执行服务 `task-executor.ts`
  - `executeTask(taskId)` — 指派 Agent 调用 Claude API 执行任务
  - `pullAndExecuteTask(agentId)` — Agent 拉取优先级最高的待办任务并执行
  - 自动状态流转（todo → in_progress → review）
  - 结果写入 `result` 字段 + Token/费用统计
- [x] 任务路由 `tasks.ts` 扩展
  - `POST /tasks/:id/execute` — 手动触发执行
  - `POST /tasks/agent/:agentId/pull-task` — Agent 拉取任务
  - 所有写操作广播 `task:updated` WebSocket 事件

### 前端（已完成）
- [x] 任务详情面板 `task-detail-drawer.tsx`
  - 完整信息展示（标题、描述、优先级、状态、指派人）
  - 时间信息（创建/开始/完成/截止 + 逾期标红）
  - 预估 vs 实际耗时对比
  - 执行结果 Markdown 渲染
  - 操作按钮（编辑/删除/执行）
- [x] 截止日期管理（创建/编辑弹窗 DatePicker）
- [x] 搜索与筛选栏（关键词/负责人/部门/优先级）
- [x] 实时 WebSocket 同步（监听 `task:updated` 自动刷新）
- [x] 工作流关联（创建弹窗可选关联工作流）
- [x] 任务执行按钮（详情面板 + 执行中状态指示）

### 新增文件
```
packages/server/src/services/task-executor.ts                    # 任务执行服务
packages/client/src/pages/kanban/components/task-detail-drawer.tsx  # 任务详情面板
```

### 修改文件
```
packages/server/src/routes/tasks.ts      # 新增执行端点 + broadcast
packages/client/src/pages/kanban/index.tsx  # 筛选栏 + 详情面板 + 截止日期 + WebSocket + 工作流
```

### 新增依赖
```bash
pnpm --filter @dark-boss/client add dayjs
```

### 新增 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /tasks/:id/execute | 手动触发任务执行 |
| POST | /tasks/agent/:agentId/pull-task | Agent 拉取并执行下一个任务 |

### 本轮新增/修改文件
```
# 新增
packages/client/src/pages/agents/index.tsx          # 员工管理页面（完整 CRUD + 事件日志面板）

# 修改
packages/client/src/App.tsx                          # 注册员工管理页面
packages/client/src/pages/canvas/index.tsx           # 工作流列表 + 保存/加载/执行
packages/client/src/pages/canvas/components/flow-canvas.tsx  # 接入保存/执行 + 边插入节点
packages/client/src/pages/chat/index.tsx             # WebSocket 实时消息
packages/client/src/pages/kanban/index.tsx           # SortableTaskCard 同列排序
packages/client/src/pages/performance/index.tsx      # 真实快照趋势图
packages/client/src/pages/market/index.tsx           # 模板评分 Rate 组件
packages/client/src/pages/org-chart/index.tsx        # 部门拖拽排序
packages/server/src/routes/agents.ts                 # Agent 事件日志 API
packages/server/src/routes/performance.ts            # 团队趋势 API
packages/server/src/services/performance-service.ts  # getTeamTrend 函数
packages/server/src/routes/templates.ts              # 评分 API
packages/client/vite.config.ts                       # manualChunks 分包配置
```

### 工作流画布文件清单
```
packages/server/src/routes/workflows.ts      # 工作流 API
packages/server/src/ws/connection.ts          # WebSocket 服务
packages/server/src/services/workflow-engine.ts # 执行引擎
packages/client/src/pages/canvas/index.tsx    # 画布页面入口
packages/client/src/pages/canvas/components/
  flow-canvas.tsx      # 主画布组件
  agent-node.tsx       # Agent 节点
  input-output-nodes.tsx # 输入/输出/Router/Aggregator 节点
  data-edge.tsx        # 数据流边
  node-sidebar.tsx     # 侧边栏
  flow-toolbar.tsx     # 工具栏
packages/client/src/pages/canvas/hooks/
  use-auto-layout.ts   # elkjs 自动布局
packages/client/src/stores/
  workflow-store.ts    # Zustand 状态管理
```

### 待优化（Phase 2 遗留）→ 全部已完成
- [x] 工作流保存/加载 UI（Ctrl+S 保存 + API 加载）
- [x] 实时执行可视化的节点高亮动画（WebSocket + 节点脉冲 + 边激活）
- [x] 边上 "插入节点" 交互（+ 按钮 + 自动连线）
- [x] 工作流列表页（卡片网格 + 状态标签 + 新建/删除）
- [x] 执行日志查看器面板（底部 Drawer + Timeline + 实时 WebSocket）
- [x] 前端 build chunk 优化（Vite manualChunks 分包）

---

## Phase 3 完成清单

### 后端（已完成）
- [x] 部门树 API（CRUD + 移动/重排父级）`departments.ts`
- [x] 任务 CRUD + 看板操作 API `tasks.ts`（含移动、分配）
- [x] 聊天频道 + 消息 API `chat.ts`（含分页、WebSocket 广播）

### 前端
- [x] 组织架构页面 (`pages/org-chart/index.tsx`)
- [x] 协作看板页面 (`pages/kanban/index.tsx`)
- [x] 团队群聊页面 (`pages/chat/index.tsx`)

### 待优化（Phase 3 遗留）→ 4/5 已完成
- [x] 组织架构拖拽排序部门（Phase 4 完成）
- [x] 看板 dnd-kit SortableContext 同列内排序（Phase 4 完成）
- [x] 聊天 WebSocket 实时接收新消息（Phase 4 完成）
- [x] Agent 自动回复消息（Phase 5 完成，接入 Claude Code CLI）
- [ ] 消息附件/文件上传功能

---

## 快速恢复指南

### 启动开发环境

```bash
cd g:\AIProjects\dark-boss
pnpm install          # 安装依赖
rm -rf ~/.dark-boss/data.db  # 可选：重置数据库（新增表时需要）
pnpm dev              # 启动前后端
```

- 前端: http://localhost:5173
- 后端: http://localhost:3000
- WebSocket: ws://localhost:3000/ws

### 项目结构速查

```
packages/shared/src/types/  → 全部类型定义
packages/server/src/db/     → 数据库 (connection.ts, seed.ts)
packages/server/src/routes/ → REST API 路由
packages/server/src/ws/     → WebSocket
packages/server/src/services/ → 执行引擎 + 绩效服务
packages/client/src/pages/  → 前端页面
packages/client/src/stores/ → Zustand 状态管理
docs/adr/                   → 架构决策记录
```

### API 端点汇总

基础路径: `/api/v1`

| 资源 | 方法 | 路径 |
|------|------|------|
| Agent | GET/POST | /agents |
| Agent | GET/PATCH/DELETE | /agents/:id |
| 部门 | GET/POST | /departments |
| 部门 | DELETE | /departments/:id |
| 模板 | GET | /templates |
| 模板安装 | POST | /templates/:id/install |
| 工作流 | GET/POST | /workflows |
| 工作流 | GET/PATCH/DELETE | /workflows/:id |
| 执行 | POST | /workflows/:id/execute |
| 执行记录列表 | GET | /workflows/:id/executions |
| 最近执行日志 | GET | /workflows/:id/executions/latest |
| 指定执行日志 | GET | /workflows/:id/executions/:executionId |
| 任务 | GET/POST | /tasks |
| 任务 | PATCH/DELETE | /tasks/:id |
| 任务执行 | POST | /tasks/:id/execute |
| Agent 拉取任务 | POST | /tasks/agent/:agentId/pull-task |
| 聊天频道 | GET/POST | /chat/channels |
| 聊天消息 | GET/POST | /chat/channels/:id/messages |
| 绩效概览 | GET | /performance/dashboard |
| 绩效趋势 | GET | /performance/trend |
| 绩效列表 | GET | /performance/agents |
| 绩效详情 | GET | /performance/agents/:id |
| 绩效报告 | GET | /performance/agents/:id/report |
| 事件日志 | GET | /agents/:id/events |
| 模板评分 | POST | /templates/:id/rate |
| 健康 | GET | /api/health |
