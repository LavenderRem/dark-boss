# 协作看板增强设计

> 日期: 2026-04-30
> 状态: 待实施
> 范围: 协作看板全面升级，6 个独立模块

## 背景

Dark Boss 的协作看板当前实现了基础的 CRUD、拖拽排序、筛选和 WebSocket 同步功能。但作为"AI Agent 自主协作平台"的核心枢纽，存在四个关键痛点：

1. **实时进度不可见** — Agent 执行任务时只看到 status 变化，看不到具体活动
2. **缺少通知与提醒** — 任务完成、逾期、阻塞等事件无感知
3. **任务关系不清晰** — 复杂任务分解后无可视化的父子关系和依赖
4. **Agent 工作量不透明** — 无法看到每个 Agent 的负载分布

## 设计目标

- 以 Agent 自主协作为主场景，用户主要做监督和审核
- 模块化升级，6 个模块独立开发、可按优先级交付
- 均衡提升 AI 协作深度、用户体验和管理能力

## 模块总览

| 模块 | 优先级 | 目标 |
|------|--------|------|
| A. 任务层级与依赖 | P0 | 父子任务、依赖关系、阻塞标记 |
| B. 实时进度追踪 | P0 | Agent 活动流、进度条、权限内联审批 |
| C. Agent 工作量视图 | P0 | 负载概览、智能分配建议 |
| D. 通知与提醒系统 | P1 | 通知中心、6 种通知类型 |
| E. 增强卡片与多视图 | P1 | 标签系统、列表视图、Agent 视角 |
| F. 高级管理功能 | P2 | 任务模板、WIP 限制、批量操作、快捷键 |

---

## Module A: 任务层级与依赖

### 数据模型变更

**tasks 表新增字段：**

```sql
ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id);
ALTER TABLE tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'task';
ALTER TABLE tasks ADD COLUMN tags TEXT; -- JSON 数组，如 ["auth","frontend"]
ALTER TABLE tasks ADD COLUMN blocked_by TEXT; -- JSON 数组（冗余缓存，source of truth 是 task_dependencies 表）
ALTER TABLE tasks ADD COLUMN progress INTEGER DEFAULT 0; -- 0-100
ALTER TABLE tasks ADD COLUMN activity_summary TEXT; -- Agent 最近活动摘要
```

**新增 task_dependencies 表：**

```sql
CREATE TABLE IF NOT EXISTS task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'blocks', -- blocks | blocks_on
  created_at INTEGER NOT NULL,
  UNIQUE(task_id, depends_on_id)
);
```

**新增 task_events 表：**

```sql
CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- created | assigned | status_changed | progress | completed | blocked
  agent_id TEXT REFERENCES agents(id),
  payload TEXT, -- JSON
  created_at INTEGER NOT NULL
);
```

### 任务类型层级

四层结构，通过 `task_type` 字段区分：

| 类型 | 标识 | 用途 | 示例 |
|------|------|------|------|
| Epic | `epic` | 大型功能，由 Boss 分解 | 用户认证系统 |
| Story | `story` | 可交付的用户故事 | 实现登录页面 |
| Task | `task` | 单个 Agent 可完成（默认） | 编写登录表单组件 |
| Subtask | `subtask` | 任务内的检查项/步骤 | 添加表单验证 |

### 卡片增强

- 顶部显示任务类型标签（EPIC/STORY/TASK），颜色区分
- 子任务进度条（完成数/总数），自动根据子任务计算
- 标签行，显示 `tags` 字段中的标签
- 底部增加"最近活动时间"

### 依赖关系

- 详情抽屉中新增三个区域：
  - **被阻塞于 (Blocked By)**：列出当前任务依赖的未完成任务，红色边框
  - **阻塞了 (Blocking)**：列出依赖当前任务的其他任务
  - **子任务清单**：checkbox 风格，完成项带删除线
- 卡片在被阻塞时增加红色边框标识

### 新增 API

```
POST   /tasks/:id/dependencies    — 添加依赖关系
DELETE /tasks/:id/dependencies/:depId — 移除依赖关系
GET    /tasks/:id/children        — 获取子任务列表
GET    /tasks/:id/events          — 获取任务事件历史
```

### 共享类型扩展

```typescript
export type TaskType = 'epic' | 'story' | 'task' | 'subtask';

// Task 接口新增字段
parentTaskId: string | null;
taskType: TaskType;
tags: string[];
blockedBy: string[];
progress: number;
activitySummary: string | null;
```

---

## Module B: 实时进度追踪

### 活动状态枚举

Agent 在任务上的活动状态，映射自已有的 Agent 进程事件：

| 卡片状态 | 颜色 | 数据来源 |
|----------|------|----------|
| 活跃 | `#00d992` 绿 | agent:tool_start / agent:output |
| 思考中 | `#4cb3d4` 蓝 | agent:process_status (thinking) |
| 等待权限 | `#ffba00` 黄 | agent:permission_request |
| 出错 | `#fb565b` 红 | agent:error |

### 数据流

复用已有的 Agent 终端事件，新增映射层：

```
agent:tool_start     → task:activity { activityType: "tool_use", detail: "正在使用 {toolName}" }
agent:output          → 保持"活跃"状态，更新时间戳
agent:tool_result     → 工具完成，检查进度更新
agent:process_status  → 映射为卡片状态指示器
agent:permission_request → 卡片显示"等待权限"+ 内联操作按钮
```

### 新增 WebSocket 事件

```typescript
// task:progress — 进度更新
{ taskId: string; progress: number; summary: string }

// task:activity — Agent 活动变更
{ taskId: string; agentId: string; activityType: string; detail: string; timestamp: number }
```

### 进度计算策略

按优先级选择：

1. **有子任务**：`完成任务数 / 总任务数 × 100`
2. **无子任务 + 有预估时间**：`已用时间 / 预估时间 × 100`（上限 90%，保留最后 10% 给完成确认）
3. **无子任务 + 无预估**：按工具调用次数线性增长（每 5 次工具调用 +10%，上限 80%），任务完成时直接设为 100%

### 权限内联审批

当 Agent 请求权限时：
- 卡片显示黄色"等待权限"状态 + 具体请求内容
- 提供"允许"和"拒绝"按钮，直接在卡片上操作
- 点击后通过 WebSocket `agent:permission_response` 发送响应

### 后端变更

在 `task-executor.ts` 中：
- 任务执行过程中，根据 Agent 事件更新 `activity_summary` 和 `progress` 字段
- 通过 WebSocket 广播 `task:progress` 和 `task:activity` 事件
- 记录关键事件到 `task_events` 表

---

## Module C: Agent 工作量视图

### 负载概览条

看板筛选栏下方新增"团队负载概览"区域：

- 每个 Agent 一张小卡片，显示：头像/图标、名称、状态、进行中/待办任务数、负载进度条
- 颜色编码：空闲（绿）、适中（黄）、过载（红）、离线（灰）
- 点击 Agent 卡片可筛选该 Agent 的任务
- **数据来源**：纯前端聚合，从已有的 tasks + agents 查询结果计算，不新增 API

### 负载等级

| 等级 | 条件 | 颜色 |
|------|------|------|
| 空闲 | 0 个进行中任务 | `#00d992` |
| 适中 | 1-2 个进行中任务 | `#ffba00` |
| 繁忙 | 3+ 个进行中任务 | `#fb565b` |

### 智能分配建议

创建/分配任务时，负责人选择器增强：

- 每个 Agent 旁显示负载百分比
- 按"角色匹配度 + 负载升序"排序，最匹配且最空闲的排在最前
- 过载 Agent 标记红色警告，降低不透明度
- 底部显示推荐理由文本框

### 推荐算法

1. 过滤在线 Agent（status ≠ offline）
2. 按角色匹配度排序（任务关键词 vs AGENT_ROLES 关键词）
3. 同角色按负载升序（进行中任务数少的优先）
4. 过载 Agent（3+）标记 ⚠ 但不阻止选择

### 前端实现

- 负载计算函数封装为 `useAgentWorkload` 自定义 Hook
- 接收 tasks + agents 数据，返回每个 Agent 的负载信息
- 推荐逻辑封装为 `getAssignmentSuggestion(task, agents, tasks)` 工具函数

---

## Module D: 通知与提醒系统

### 通知中心 UI

- 顶部导航栏右侧铃铛图标 + 未读计数角标
- 点击展开下拉面板，显示通知列表
- 未读通知高亮背景 + 绿色圆点标识
- "全部已读"按钮一键标记

### 通知类型

| 类型 | 标识 | 触发条件 | 颜色 |
|------|------|----------|------|
| 完成 | `task_completed` | 任务状态变为 done | `#00d992` |
| 逾期 | `task_overdue` | 任务接近/已超过 dueAt | `#fb565b` |
| 阻塞 | `task_blocked` | 依赖任务未完成，当前任务无法推进 | `#ffba00` |
| 分配 | `task_assigned` | 任务被分配给 Agent | `#4cb3d4` |
| 交接 | `task_handoff` | 任务在 Agent 间传递 | `#722ed1` |
| 权限 | `permission_request` | Agent 请求操作权限 | `#ffba00` |

### 数据模型

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id),
  message TEXT NOT NULL,
  detail TEXT, -- JSON 额外信息
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

### WebSocket 事件

```typescript
// notification:new — 新通知
{ id: string; type: string; taskId: string; message: string; createdAt: number }

// notification:read — 标记已读
{ id: string }
```

### 后端触发逻辑

在现有任务操作中埋点生成通知：

- 任务状态变更 → 检查是否变为 done → 生成完成通知（同步 `blocked_by` 缓存字段）
- 定时检查（每 5 分钟） → dueAt 临近 30 分钟 → 生成逾期预警
- 依赖关系变更 → 同步更新 `blocked_by` 缓存 → 检查是否新阻塞了其他任务 → 生成阻塞通知
- 任务分配 → 生成分配通知
- Agent 权限请求 → 生成权限通知

### 新增 API

```
GET    /notifications         — 获取通知列表
PATCH  /notifications/:id/read — 标记已读
POST   /notifications/read-all — 全部已读
GET    /notifications/unread-count — 未读数
```

---

## Module E: 增强卡片与多视图

### 标签系统

- `tags` 字段存储 JSON 数组（如 `["auth","frontend"]`）
- 预设 8 种标签颜色：

| 标签 | 颜色 |
|------|------|
| auth | `#4cb3d4` |
| frontend | `#68a063` |
| backend | `#8b5cf6` |
| bug | `#fb565b` |
| API | `#722ed1` |
| performance | `#ffba00` |
| urgent | `#f97316` |
| docs | `#8b949e` |

- 用户自定义标签存储在 localStorage，颜色从预设调色板选取
- 筛选栏新增标签筛选下拉

### 三种视图

通过标题栏右侧的视图切换器（看板/列表/Agent）切换：

1. **看板视图**（现有）— 保持不变，仅增强卡片
2. **列表视图** — 表格形式，列为：任务标题、优先级、负责人、状态、截止时间。支持排序和筛选。点击行展开详情
3. **Agent 视角** — 按 Agent 分组，每个 Agent 显示其名下所有任务。直观看到每个人的工作分布

三种视图共享同一数据源（tasks + agents 查询），仅切换渲染组件。

### 前端组件拆分

当前看板页面 612 行，需拆分为：

```
pages/kanban/
  index.tsx                    — 页面壳子，路由入口
  components/
    kanban-view.tsx            — 看板视图（现有逻辑提取）
    list-view.tsx              — 列表视图
    agent-view.tsx             — Agent 视角视图
    task-card.tsx              — 增强任务卡片
    task-card-activity.tsx     — 卡片上的活动状态指示器
    task-detail-drawer.tsx     — 详情抽屉（已有，扩展依赖区域）
    workload-overview.tsx      — 负载概览条
    view-switcher.tsx          — 视图切换器
  hooks/
    use-agent-workload.ts      — Agent 负载计算
    use-task-filters.ts        — 筛选逻辑提取
    use-kanban-dnd.ts          — 拖拽逻辑提取
```

---

## Module F: 高级管理功能

### 任务模板

- 预设 3 个模板：Bug 修复、新功能开发、代码审查
- 模板定义：标题模式、默认子任务列表、默认标签、默认负责人角色
- 用户可将现有任务结构保存为自定义模板
- 存储位置：localStorage（轻量，不新增数据库表）

### WIP 限制

- 每列可设置最大任务数（默认无限制）
- 达到上限时：拖入弹出确认对话框（软性阻止），非硬性拒绝
- 列头显示 `当前数 / 上限`
- 存储位置：localStorage

### 批量操作

- Ctrl + 点击任务卡片多选
- 选中后底部浮动操作栏：批量修改状态/优先级/负责人/删除
- 后端新增批量 API：`PATCH /tasks/batch`

### 快捷键

| 按键 | 功能 |
|------|------|
| N | 新建任务 |
| E | 编辑选中任务 |
| Delete | 删除选中任务 |
| 1-5 | 切换视图（看板/列表/Agent） |
| Esc | 关闭弹窗/抽屉 |
| Ctrl+A | 全选当前视图任务 |

### 拖拽优化

- 空列显示虚线占位区 + "拖入任务"提示文字
- 拖拽时目标列边框高亮为 `#00d992`
- 列头显示任务计数 + WIP 状态

---

## 模块间依赖关系

```
Module A (数据模型) ← Module B, C, D, E 都依赖 A 的字段
Module B (实时进度) ← 依赖 A 的 progress/activity_summary 字段
Module D (通知)     ← 依赖 A 的依赖关系和 B 的状态变化
Module E (多视图)   ← 依赖 A 的标签和层级数据
Module C (工作量)   ← 独立，仅前端聚合
Module F (管理)     ← 依赖 A 的模板和 E 的视图框架
```

建议实施顺序：A → B → C → E → D → F

---

## 技术约束

- 前端遵循 VoltAgent 设计系统（DESIGN.md），使用 `var(--color-*)` CSS 变量
- 禁止使用蓝色作为主色
- 所有新 API 端点在 `/api/v1` 路径下
- 前端数据 camelCase，后端/数据库 snake_case
- WebSocket 事件复用已有的 ws/connection.ts 基础设施
- 文件控制在 400 行以内，超出则拆分
