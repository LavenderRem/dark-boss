# 开发进度与计划

> 本文档记录项目开发进度，供跨环境/跨会话恢复上下文使用。

## 当前状态

**Phase 1：基础 + 员工网格 + 基础控制 — ✅ 已完成**
**Phase 2：工作流画布 + 实时执行 — ✅ 已完成**
**Phase 3：组织架构 + 看板 + 群聊 — ✅ 已完成**

---

## Phase 2 完成清单

### 后端
- [x] 工作流 CRUD API (GET/POST/PATCH/DELETE /api/v1/workflows)
- [x] 工作流执行端点 (POST /workflows/:id/execute)
- [x] WebSocket 服务器 (ws://localhost:3000/ws)
- [x] 广播函数 broadcast() 用于实时推送事件
- [x] 工作流执行引擎 (拓扑排序 + 并行执行 + 事件广播)

### 前端
- [x] React Flow 画布 + 深色主题
- [x] 5 种自定义节点：AgentNode, InputNode, OutputNode, RouterNode, AggregatorNode
- [x] 自定义 DataEdge (带 "+" 插入按钮)
- [x] 节点侧边栏 (基础组件 + 员工列表，支持拖拽到画布)
- [x] 画布工具栏 (新建/保存/自动布局/执行/暂停)
- [x] elkjs 自动布局 hook
- [x] Zustand workflow-store (节点/边/执行状态管理)
- [x] 路由接入 /canvas 页面

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
  - 部门树形展示 + 颜色标记
  - 右键菜单：添加子部门、编辑、删除
  - 部门详情面板（成员列表）
  - 创建/编辑弹窗（名称、描述、颜色、负责人）
- [x] 协作看板页面 (`pages/kanban/index.tsx`)
  - 5 列看板：待规划 / 待办 / 进行中 / 审核中 / 已完成
  - dnd-kit 拖拽（跨列移动任务）
  - 任务卡片（优先级颜色、指派人、预估时间）
  - 创建/编辑/删除任务
- [x] 团队群聊页面 (`pages/chat/index.tsx`)
  - 频道列表（团队/私聊/部门）
  - 消息气泡（区分用户/Agent/系统消息）
  - @提及 高亮 + 提取 Agent IDs
  - 创建频道弹窗
  - 消息输入框（Shift+Enter 换行）

### 新增文件清单
```
packages/client/src/pages/org-chart/index.tsx   # 组织架构页面
packages/client/src/pages/kanban/index.tsx      # 看板页面
packages/client/src/pages/chat/index.tsx        # 聊天页面
```

### 待优化（Phase 3 遗留）
- [ ] 组织架构拖拽排序部门
- [ ] 看板 dnd-kit SortableContext 同列内排序
- [ ] 聊天 WebSocket 实时接收新消息（当前用轮询/刷新）
- [ ] Agent 自动回复消息（接入 Claude SDK）
- [ ] 消息附件/富文本支持

---

## Phase 3 ~~计划~~ → 已完成

### 任务分解

| # | 任务 | 关键文件 |
|---|------|----------|
| 3.1 | 部门树 API（移动、重排父级） | `server/src/routes/departments.ts` 扩展 |
| 3.2 | 组织架构页面 + 拖拽 | `client/src/pages/org-chart/` |
| 3.3 | 任务 CRUD + 看板操作 API | `server/src/routes/tasks.ts` |
| 3.4 | KanbanBoard（dnd-kit） | `client/src/pages/kanban/` |
| 3.5 | TaskCard + TaskColumn | `client/src/pages/kanban/components/` |
| 3.6 | 聊天频道 + 消息 API | `server/src/routes/chat.ts` |
| 3.7 | 聊天 UI | `client/src/pages/chat/` |
| 3.8 | Agent @提及参与聊天 | `server/src/services/chat-service.ts` |

### 需要额外安装的包

```bash
pnpm --filter @dark-boss/client add @dnd-kit/core @dnd-kit/sortable
```

---

## Phase 4 计划：绩效系统 + 市场 + 打磨

| # | 任务 |
|---|------|
| 4.1 | 绩效指标定时计算 (cron) |
| 4.2 | 绩效仪表盘页面 |
| 4.3 | AI 生成绩效考核报告 |
| 4.4 | 招聘市场页面 |
| 4.5 | 模板安装流程完善 |
| 4.6 | UI 打磨（骨架屏、过渡动画、空状态） |

---

## 快速恢复指南

### 启动开发环境

```bash
cd g:\AIProjects\dark-boss
pnpm install          # 安装依赖
rm -rf ~/.dark-boss/data.db  # 可选：重置数据库
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
packages/server/src/services/ → 执行引擎
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
| 健康 | GET | /api/health |
