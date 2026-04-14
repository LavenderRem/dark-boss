# 实施计划：协作看板功能完善

## 需求重述

完善协作看板的 7 项未完成功能，实现从"任务管理"到"Agent 任务执行闭环"的完整体验。

| # | 功能 | 复杂度 | 说明 |
|---|------|--------|------|
| 1 | 任务详情面板 | 中 | Drawer 展示完整信息、结果、耗时 |
| 2 | 截止日期管理 | 低 | 创建/编辑弹窗加 DatePicker |
| 3 | 搜索与筛选 | 中 | 按负责人/部门/优先级/关键词筛选 |
| 4 | 实时 WebSocket 同步 | 低 | 事件类型已定义，需广播+消费 |
| 5 | 任务结果展示 | 低 | 详情面板中展示 Agent 执行输出 |
| 6 | 工作流关联 | 低 | 创建任务时可选关联工作流 |
| 7 | Agent 自动执行任务 | 高 | 分配任务后 Agent 自动认领执行 |

---

## Phase 7 实施计划

### 7.1 任务详情面板

**新建文件**: `packages/client/src/pages/kanban/components/task-detail-drawer.tsx`

Drawer 组件，点击任务卡片打开，展示：
- 标题、描述、优先级、状态
- 指派人 + 角色/部门信息
- 时间信息（创建/开始/完成/截止）
- 预估时间 vs 实际时间
- **执行结果**（`result` 字段，Markdown 渲染）
- 状态变更历史时间线（基于 startedAt/completedAt）
- 操作按钮：编辑、删除、执行（触发 Agent）

**修改文件**: `packages/client/src/pages/kanban/index.tsx`
- 卡片点击打开详情 Drawer（替代 Dropdown 或共存）
- 传递 task、agents、departments、onEdit、onDelete、onExecute

### 7.2 截止日期管理

**修改文件**: `packages/client/src/pages/kanban/index.tsx`
- 创建弹窗添加 DatePicker（deadline 字段）
- 编辑弹窗添加 DatePicker
- 任务卡片上显示截止日期，逾期标红

**修改文件**: `packages/server/src/routes/tasks.ts`
- PATCH 路由已支持 `dueAt`，无需后端改动

**新增依赖**: antd DatePicker（已内置，无需安装）

### 7.3 搜索与筛选

**修改文件**: `packages/client/src/pages/kanban/index.tsx`
- 看板顶部添加筛选栏：
  - Input.Search 搜索标题/描述
  - Select 筛选负责人
  - Select 筛选部门
  - Select 筛选优先级
- 前端过滤（任务量小，不需要后端分页）

### 7.4 实时 WebSocket 同步

**发现**: `packages/shared/src/types/event.ts` 已定义 `task:updated` 事件类型

**修改文件**: `packages/server/src/routes/tasks.ts`
- 所有写操作（POST/PATCH/move/assign/delete）完成后调用 `broadcast('task:updated', { taskId, action, task })`

**修改文件**: `packages/client/src/pages/kanban/index.tsx`
- 监听 `ws:message` 事件，匹配 `task:updated`
- 收到事件后 `queryClient.invalidateQueries({ queryKey: ['tasks'] })` 刷新列表

### 7.5 任务结果展示

集成在 7.1 任务详情面板中：
- `task.result` 非空时显示"执行结果"区域
- 使用 MarkdownRenderer 渲染（已有组件）
- 显示 Token 消耗和费用（从 agent_events 关联查询）

### 7.6 工作流关联

**修改文件**: `packages/client/src/pages/kanban/index.tsx`
- 创建弹窗添加"关联工作流" Select
- 查询 `/workflows` 获取可选列表

**修改文件**: `packages/server/src/routes/tasks.ts`
- POST 创建时保存 `workflowId`（已支持）

### 7.7 Agent 自动执行任务

这是最核心的功能，实现任务→Agent 执行闭环。

**新建文件**: `packages/server/src/services/task-executor.ts`

任务执行服务：
- `executeTask(taskId: string)` — 执行单个任务
  - 从数据库读取任务详情（标题、描述、指派 Agent）
  - 构建系统提示词（角色描述 + 任务上下文）
  - 调用 `singleQuery()` 执行
  - 更新任务状态（todo → in_progress → done/review）
  - 保存执行结果到 `result` 字段
  - 记录实际耗时 `actualMinutes`
  - 广播 `task:updated` 事件
- `executeTaskByAgent(agentId: string)` — 拉取该 Agent 的下一个待办任务并执行
  - 查询 `status = 'todo' AND assigned_agent_id = ? ORDER BY priority DESC, created_at ASC LIMIT 1`
  - 调用 executeTask

**修改文件**: `packages/server/src/routes/tasks.ts`
- 新增 `POST /tasks/:id/execute` — 手动触发执行指定任务
- 新增 `POST /agents/:id/pull-task` — Agent 拉取并执行下一个任务

**修改文件**: `packages/client/src/pages/kanban/index.tsx`
- 任务卡片 / 详情面板添加"执行"按钮（仅已指派 Agent 且状态为 todo/in_progress 时显示）
- 执行中显示 Loading 状态
- WebSocket 实时更新任务状态

**修改文件**: `packages/client/src/pages/kanban/components/task-detail-drawer.tsx`
- "执行任务"按钮
- 执行中状态指示

---

## 文件变更汇总

### 新增文件
```
packages/server/src/services/task-executor.ts                    # 任务执行服务
packages/client/src/pages/kanban/components/task-detail-drawer.tsx  # 任务详情面板
```

### 修改文件
```
packages/server/src/routes/tasks.ts      # 新增执行端点 + broadcast
packages/client/src/pages/kanban/index.tsx  # 筛选栏 + 详情面板 + 截止日期 + WebSocket
```

### 无需新增依赖（antd DatePicker + 已有 MarkdownRenderer 均已就绪）

---

## 执行顺序

| 步骤 | 内容 | 依赖 |
|------|------|------|
| 1 | 任务详情面板 | 无 |
| 2 | 截止日期管理 | 无 |
| 3 | 搜索与筛选 | 无 |
| 4 | 实时 WebSocket 同步 | 无 |
| 5 | 任务结果展示 | 依赖步骤 1（详情面板） |
| 6 | 工作流关联 | 无 |
| 7 | Agent 自动执行 | 依赖步骤 4（WebSocket） |

步骤 1-4 和 6 互相独立，可以按序快速实现；步骤 5 集成到步骤 1 中；步骤 7 最后实现。

---

## 风险评估

| 风险 | 等级 | 应对 |
|------|------|------|
| Agent 执行耗时过长 | 中 | 前端用 WebSocket 推送状态，用户可中断 |
| 多任务并发执行 | 低 | 同一 Agent 串行执行（已有并发控制） |
| Claude API 未配置 | 低 | 降级提示，不阻塞 UI |
