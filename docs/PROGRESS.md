# 开发进度与计划

> 本文档记录项目开发进度，供跨环境/跨会话恢复上下文使用。

## 当前状态

**Phase 1：基础 + 员工网格 + 基础控制 — ✅ 已完成**
**Phase 2：工作流画布 + 实时执行 — ⏳ 待开始**

---

## Phase 1 完成清单

### 后端 (packages/server)
- [x] Express 5 + sql.js (WASM SQLite) 数据库
- [x] 6 张表：agents, departments, workflows, tasks, templates, agent_events
- [x] Agent CRUD API (GET/POST/PATCH/DELETE /api/v1/agents)
- [x] 部门 CRUD API (GET/POST/DELETE /api/v1/departments)
- [x] 模板浏览+安装 API (GET /templates, POST /templates/:id/install)
- [x] 初始数据：4 个默认部门 + 7 个内置 Agent 模板
- [x] 健康检查 GET /api/health
- [x] 数据存储在 ~/.dark-boss/data.db

### 前端 (packages/client)
- [x] React 19 + Vite 6 + Ant Design 5 深色主题
- [x] 企业侧边栏导航（8 个页面入口）
- [x] 仪表盘页面：4 张统计卡片 + Agent 网格
- [x] API 客户端 + Vite 代理到后端
- [x] 中文 UI 全覆盖

### 共享 (packages/shared)
- [x] Agent, Department, Workflow, Task, Event 等完整类型定义
- [x] 角色常量（11 种 AgentRole）、状态颜色、中文标签

### 未完成（Phase 1 遗留）
- [ ] Agent 实际控制层（Claude Agent SDK 集成）— 需要 @anthropic-ai/claude-agent-sdk
- [ ] WebSocket 实时通信（ws 包已安装但未实现）
- [ ] Agent 启动/停止/中断端点（路由占位但未接 SDK）
- [ ] Agent 详情页（xterm 终端输出流）
- [ ] Agent 创建弹窗（从模板选择）

### 技术决策
- [x] 5 份 ADR 已归档至 docs/adr/
- [x] CLAUDE.md 已更新（命令表 + API 端点）
- [x] CONTRIBUTING.md 已生成

---

## Phase 2 计划：工作流画布 + 实时执行

### 目标
实现完整的 2D 工作流编辑器：拖拽 Agent 节点、连线、保存、一键执行、实时进度可视化。

### 任务分解

| # | 任务 | 关键文件 | 依赖 |
|---|------|----------|------|
| 2.1 | 工作流 CRUD API | `server/src/routes/workflows.ts` | 无 |
| 2.2 | React Flow 画布基础 | `client/src/pages/canvas/components/flow-canvas.tsx` | @xyflow/react 已安装 |
| 2.3 | 自定义 AgentNode 节点 | `client/src/pages/canvas/components/agent-node.tsx` | 2.2 |
| 2.4 | 自定义 DataEdge 边 | `client/src/pages/canvas/components/data-edge.tsx` | 2.2 |
| 2.5 | 节点侧边栏（拖拽 Agent） | `client/src/pages/canvas/components/node-sidebar.tsx` | 2.2 |
| 2.6 | elkjs 自动布局 | `client/src/pages/canvas/hooks/use-auto-layout.ts` | 2.2 |
| 2.7 | 画布工具栏 | `client/src/pages/canvas/components/flow-toolbar.tsx` | 2.2 |
| 2.8 | 工作流状态管理 | `client/src/stores/workflow-store.ts` | 2.1 |
| 2.9 | 工作流执行引擎 | `server/src/services/workflow-engine.ts` | 2.1 + Agent SDK |
| 2.10 | 实时执行可视化 | 画布节点高亮 + 边流动动画 | 2.9 + WebSocket |
| 2.11 | 执行日志查看器 | `client/src/pages/canvas/components/execution-log.tsx` | 2.10 |
| 2.12 | 工作流变量系统 | `server/src/services/workflow-engine.ts` 扩展 | 2.9 |

### 技术要点

**React Flow 画布**
- 使用 `@xyflow/react` v12 (已安装)
- 自定义节点类型：`agent`(Agent 节点), `input`, `output`, `router`(并行分发), `aggregator`(合并)
- 自定义边类型：`data`(数据流), `conditional`(条件路由)
- 边上右键可 "插入 Agent"（CrewForm 验证过的交互模式）
- Dagre/elkjs 自动布局（需要安装 `elkjs` 包）

**工作流执行引擎**
- 拓扑排序节点 → 识别可并行执行的独立节点
- 为每个节点创建任务并分配给对应 Agent
- 上游节点输出通过边传递给下游节点
- 通过 WebSocket 广播每步进度

**关键参考**
- CrewForm 的 React Flow + Dagre 实现：https://dev.to/vincent_grobler_776512b17/how-we-built-a-visual-drag-and-drop-workflow-builder-for-ai-agent-teams-react-flow-dagre-211j
- React Flow 官方 Workflow Editor 模板：https://reactflow.dev/components/templates/workflow-editor

### 需要额外安装的包

```bash
# 前端
pnpm --filter @dark-boss/client add elkjs
pnpm --filter @dark-boss/client add -D @types/elkjs

# 后端（Agent SDK 集成时）
pnpm --filter @dark-boss/server add @anthropic-ai/claude-agent-sdk
```

---

## Phase 3 计划：组织架构 + 看板 + 群聊

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

### 项目结构速查

```
packages/shared/src/types/  → 全部类型定义
packages/server/src/db/     → 数据库 (connection.ts, seed.ts)
packages/server/src/routes/ → REST API 路由
packages/client/src/pages/  → 前端页面
packages/client/src/stores/ → Zustand 状态管理
docs/adr/                   → 架构决策记录
```

### 技术债务

1. **Agent 控制层未接入**：当前 Agent 只有 CRUD，无法实际启动 Claude 实例。需要集成 `@anthropic-ai/claude-agent-sdk`
2. **WebSocket 未实现**：ws 包已安装但未编写 handler。需要 `server/src/ws/` 目录
3. **数据库持久化策略**：sql.js 是内存数据库，当前每 30 秒 save()。关键写操作后应立即 save()
4. **错误处理粗糙**：路由中的 catch 只返回 500，需要区分 400/404/409 等
5. **前端只有仪表盘可用**：其余 7 个页面是占位符
