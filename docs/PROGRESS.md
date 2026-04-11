# 开发进度与计划

> 本文档记录项目开发进度，供跨环境/跨会话恢复上下文使用。

## 当前状态

**Phase 1：基础 + 员工网格 + 基础控制 — ✅ 已完成**
**Phase 2：工作流画布 + 实时执行 — ✅ 已完成**
**Phase 3：组织架构 + 看板 + 群聊 — ✅ 已完成**
**Phase 4：绩效系统 + 招聘市场 + UI 打磨 — ✅ 已完成**

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
- [ ] AI 报告接入 Claude Agent SDK（当前为模板化生成）
- [ ] Agent 自动回复消息（接入 Claude SDK）
- [ ] 消息附件/富文本支持

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

# 新增依赖
pnpm --filter @dark-boss/client add @dnd-kit/utilities
```

### 新增文件清单
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

### 待优化（Phase 2 遗留）
- [ ] 工作流保存/加载 UI（当前 store 只在内存，未接 API）
- [ ] 实时执行可视化的节点高亮动画（broadcast 已实现，前端消费待接）
- [ ] 边上 "插入节点" 交互（事件已注册，处理逻辑待实现）
- [ ] 工作流列表页（选择/切换工作流）
- [ ] 执行日志查看器面板
- [ ] 前端 build chunk 优化（antd 全量打包 2.4MB）

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

### 待优化（Phase 3 遗留）
- [ ] 组织架构拖拽排序部门
- [ ] 看板 dnd-kit SortableContext 同列内排序
- [ ] 聊天 WebSocket 实时接收新消息
- [ ] Agent 自动回复消息（接入 Claude SDK）
- [ ] 消息附件/富文本支持

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
| 任务 | GET/POST | /tasks |
| 任务 | PATCH/DELETE | /tasks/:id |
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
