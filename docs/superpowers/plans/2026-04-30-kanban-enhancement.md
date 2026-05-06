# 协作看板增强实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将协作看板从基础 CRUD 升级为支持任务层级、实时进度、工作量视图、通知系统和多视图的 AI Agent 协作枢纽。

**Architecture:** 6 个独立模块按依赖顺序实施（A→B→C→E→D→F）。Module A 扩展数据模型和共享类型，后续模块复用。前端将 612 行的单文件拆分为组件+hooks 目录结构。后端在现有路由和服务上扩展，复用 WebSocket broadcast 基础设施。

**Tech Stack:** TypeScript 全栈 · Express 5 · sql.js · React 19 · Zustand · @tanstack/react-query · @dnd-kit · Ant Design 5

**Spec:** `docs/superpowers/specs/2026-04-30-kanban-enhancement-design.md`

---

## 文件结构映射

### 共享类型（packages/shared/src/types/）

| 文件 | 操作 | 职责 |
|------|------|------|
| `task.ts` | 修改 | 新增 TaskType、Notification 等类型，扩展 Task 接口 |
| `event.ts` | 修改 | 新增 task:progress、task:activity、notification:* 事件类型 |

### 后端（packages/server/src/）

| 文件 | 操作 | 职责 |
|------|------|------|
| `db/connection.ts` | 修改 | 新增表字段、task_dependencies/task_events/notifications 表 |
| `routes/tasks.ts` | 修改 | 新增依赖、子任务、事件 API；扩展创建/更新逻辑 |
| `routes/notifications.ts` | 创建 | 通知 CRUD API |
| `services/task-executor.ts` | 修改 | 任务执行时更新 progress/activity_summary，记录 task_events |
| `services/notification-service.ts` | 创建 | 通知生成逻辑（完成/逾期/阻塞/分配） |
| `ws/connection.ts` | 修改 | 新增 task:progress/task:activity/notification:* 消息处理 |

### 前端（packages/client/src/）

| 文件 | 操作 | 职责 |
|------|------|------|
| `pages/kanban/index.tsx` | 修改 | 拆分为壳子，保留路由入口和查询 |
| `pages/kanban/components/task-card.tsx` | 创建 | 增强任务卡片（类型标签、进度条、标签、活动） |
| `pages/kanban/components/task-card-activity.tsx` | 创建 | 卡片活动状态指示器 |
| `pages/kanban/components/task-detail-drawer.tsx` | 修改 | 扩展依赖区域和子任务清单 |
| `pages/kanban/components/kanban-view.tsx` | 创建 | 看板视图（从 index.tsx 提取） |
| `pages/kanban/components/list-view.tsx` | 创建 | 列表视图 |
| `pages/kanban/components/agent-view.tsx` | 创建 | Agent 视角视图 |
| `pages/kanban/components/workload-overview.tsx` | 创建 | 负载概览条 |
| `pages/kanban/components/view-switcher.tsx` | 创建 | 视图切换器 |
| `pages/kanban/components/notification-bell.tsx` | 创建 | 通知铃铛组件 |
| `pages/kanban/hooks/use-agent-workload.ts` | 创建 | Agent 负载计算 Hook |
| `pages/kanban/hooks/use-task-filters.ts` | 创建 | 筛选逻辑提取 |
| `pages/kanban/hooks/use-kanban-dnd.ts` | 创建 | 拖拽逻辑提取 |
| `components/layout/app-layout.tsx` | 修改 | Header 右侧添加通知铃铛 |

---

## Phase 1: Module A — 数据模型与共享类型

### Task 1: 扩展共享类型

**Files:**
- Modify: `packages/shared/src/types/task.ts`

- [ ] **Step 1: 在 task.ts 中新增类型和扩展 Task 接口**

在现有 `TaskPriority` 定义之后添加 `TaskType`，在 `Task` 接口中添加新字段：

```typescript
// 新增任务类型
export type TaskType = 'epic' | 'story' | 'task' | 'subtask';

// 新增通知类型
export type NotificationType =
  | 'task_completed'
  | 'task_overdue'
  | 'task_blocked'
  | 'task_assigned'
  | 'task_handoff'
  | 'permission_request';

// 在 Task 接口中新增字段（在 updatedAt 之后添加）
parentTaskId: string | null;
taskType: TaskType;
tags: string[];
blockedBy: string[];
progress: number;
activitySummary: string | null;
```

同步更新 `CreateTaskRequest` 接口添加：

```typescript
parentTaskId?: string;
taskType?: TaskType;
tags?: string[];
```

- [ ] **Step 2: 验证类型编译通过**

Run: `cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/shared typecheck 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 3: 扩展事件类型**

在 `packages/shared/src/types/event.ts` 中：

在 `ServerEventType` 联合类型中添加：
```typescript
| 'task:progress'
| 'task:activity'
| 'notification:new'
| 'notification:read'
```

新增 payload 接口：
```typescript
export interface TaskProgressPayload {
  taskId: string;
  progress: number;
  summary: string;
}

export interface TaskActivityPayload {
  taskId: string;
  agentId: string;
  activityType: string;
  detail: string;
  timestamp: number;
}

export interface NotificationPayload {
  id: string;
  type: string;
  taskId: string;
  message: string;
  createdAt: number;
}
```

- [ ] **Step 4: 验证全项目类型检查**

Run: `cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/shared typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/task.ts packages/shared/src/types/event.ts
git commit -m "feat(kanban): 扩展任务和事件共享类型支持层级、进度、通知"
```

---

### Task 2: 数据库 Schema 扩展

**Files:**
- Modify: `packages/server/src/db/connection.ts`

- [ ] **Step 1: 在 tasks 表 CREATE TABLE 中添加新字段**

在 `connection.ts` 的 `createTables()` 函数中，找到 tasks 的 `CREATE TABLE IF NOT EXISTS tasks` 语句，在 `updated_at INTEGER NOT NULL` 之前添加新字段：

```sql
parent_task_id TEXT REFERENCES tasks(id),
task_type TEXT NOT NULL DEFAULT 'task',
tags TEXT,
blocked_by TEXT,
progress INTEGER DEFAULT 0,
activity_summary TEXT,
```

- [ ] **Step 2: 添加 task_dependencies 表**

在 `createTables()` 函数中 tasks 表创建之后添加：

```sql
CREATE TABLE IF NOT EXISTS task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'blocks',
  created_at INTEGER NOT NULL,
  UNIQUE(task_id, depends_on_id)
);
```

- [ ] **Step 3: 添加 task_events 表**

```sql
CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id),
  payload TEXT,
  created_at INTEGER NOT NULL
);
```

- [ ] **Step 4: 添加 notifications 表**

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id),
  message TEXT NOT NULL,
  detail TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

- [ ] **Step 5: 添加 migration 辅助函数**

对于已有数据库（字段不存在的情况），在 `createTables()` 末尾添加迁移逻辑：

```typescript
// 迁移：为已有 tasks 表添加新字段
function migrateTasksTable() {
  const columns = db!.exec("PRAGMA table_info(tasks)")[0]?.values.map(c => c[1]) || [];
  const newColumns = [
    { name: 'parent_task_id', def: 'TEXT REFERENCES tasks(id)' },
    { name: 'task_type', def: "TEXT NOT NULL DEFAULT 'task'" },
    { name: 'tags', def: 'TEXT' },
    { name: 'blocked_by', def: 'TEXT' },
    { name: 'progress', def: 'INTEGER DEFAULT 0' },
    { name: 'activity_summary', def: 'TEXT' },
  ];
  for (const col of newColumns) {
    if (!columns.includes(col.name)) {
      db!.run(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.def}`);
    }
  }
}
```

在 `createTables()` 末尾调用 `migrateTasksTable()`。

- [ ] **Step 6: 验证数据库初始化**

Run: `cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/server typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/db/connection.ts
git commit -m "feat(db): 扩展 tasks 表并新增 task_dependencies/task_events/notifications 表"
```

---

### Task 3: 后端任务路由扩展

**Files:**
- Modify: `packages/server/src/routes/tasks.ts`

- [ ] **Step 1: 更新创建任务路由，支持新字段**

在 `router.post('/')` handler 中，修改 INSERT 语句和参数，增加 `parent_task_id, task_type, tags` 字段：

```typescript
router.post('/', (req, res) => {
  const id = uuid();
  const now = Date.now();
  const body = req.body;

  run(
    `INSERT INTO tasks (id, title, description, status, priority, assigned_agent_id,
      department_id, workflow_id, estimated_minutes, due_at, column_order,
      parent_task_id, task_type, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, body.title, body.description || null, body.status || 'todo',
     body.priority || 'medium', body.assignedAgentId || null,
     body.departmentId || null, body.workflowId || null,
     body.estimatedMinutes || null, body.dueAt || null, now,
     body.parentTaskId || null, body.taskType || 'task',
     body.tags ? JSON.stringify(body.tags) : null, now, now]
  );

  // 记录创建事件
  run(
    `INSERT INTO task_events (id, task_id, event_type, payload, created_at)
     VALUES (?, ?, 'created', ?, ?)`,
    [uuid(), id, JSON.stringify({ createdBy: body.assignedAgentId }), now]
  );

  const task = queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
  broadcast('task:updated', { taskId: id, action: 'created' });
  res.status(201).json(task);
});
```

- [ ] **Step 2: 更新任务更新路由，支持 tags 和 taskType 修改**

在 `router.patch('/:id')` handler 中，扩展可更新字段：

```typescript
const allowedFields = ['title', 'description', 'priority', 'assignedAgentId',
  'departmentId', 'estimatedMinutes', 'dueAt', 'status', 'tags', 'taskType'];
const updates: string[] = [];
const params: unknown[] = [];

for (const field of allowedFields) {
  if (body[field] !== undefined) {
    const dbField = field === 'assignedAgentId' ? 'assigned_agent_id'
      : field === 'departmentId' ? 'department_id'
      : field === 'estimatedMinutes' ? 'estimated_minutes'
      : field === 'taskType' ? 'task_type'
      : field;
    const value = field === 'tags' && Array.isArray(body[field])
      ? JSON.stringify(body[field])
      : body[field];
    updates.push(`${dbField} = ?`);
    params.push(value);
  }
}
```

- [ ] **Step 3: 添加依赖关系 API**

在 `tasks.ts` 路由文件末尾添加：

```typescript
// 添加依赖关系
router.post('/:id/dependencies', (req, res) => {
  const taskId = req.params.id;
  const { dependsOnId } = req.body;
  if (!dependsOnId) return res.status(400).json({ error: '必须指定 dependsOnId' });

  const dep = queryOne('SELECT id FROM tasks WHERE id = ?', [dependsOnId]);
  if (!dep) return res.status(404).json({ error: '依赖的任务不存在' });

  const id = uuid();
  const now = Date.now();
  run(
    `INSERT OR IGNORE INTO task_dependencies (id, task_id, depends_on_id, created_at)
     VALUES (?, ?, ?, ?)`,
    [id, taskId, dependsOnId, now]
  );

  // 更新 blocked_by 缓存
  const deps = queryAll(
    'SELECT depends_on_id FROM task_dependencies WHERE task_id = ?',
    [taskId]
  ).map((r: any) => r.depends_on_id);
  run('UPDATE tasks SET blocked_by = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(deps), now, taskId]);

  broadcast('task:updated', { taskId, action: 'dependency_added', dependsOnId });
  res.status(201).json({ id, taskId, dependsOnId });
});

// 移除依赖关系
router.delete('/:id/dependencies/:depId', (req, res) => {
  const { id, depId } = req.params;
  run('DELETE FROM task_dependencies WHERE task_id = ? AND id = ?', [id, depId]);

  const now = Date.now();
  const deps = queryAll(
    'SELECT depends_on_id FROM task_dependencies WHERE task_id = ?',
    [id]
  ).map((r: any) => r.depends_on_id);
  run('UPDATE tasks SET blocked_by = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(deps), now, id]);

  broadcast('task:updated', { taskId: id, action: 'dependency_removed', depId });
  res.json({ success: true });
});

// 获取子任务
router.get('/:id/children', (req, res) => {
  const children = queryAll(
    'SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY column_order ASC, created_at ASC',
    [req.params.id]
  );
  res.json(children);
});

// 获取任务事件历史
router.get('/:id/events', (req, res) => {
  const events = queryAll(
    'SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.params.id]
  );
  res.json(events);
});
```

- [ ] **Step 4: 验证后端类型检查**

Run: `cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/server typecheck`
Expected: PASS

- [ ] **Step 5: 手动验证 API**

Run: `cd d:/AI/Projects/dark-boss && pnpm dev:server`

在另一个终端测试：
```bash
# 创建带新字段的任务
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"测试任务","taskType":"epic","tags":["auth","frontend"]}'

# 查看任务列表确认新字段
curl http://localhost:3000/api/v1/tasks | head -c 500

# 添加依赖
curl -X POST http://localhost:3000/api/v1/tasks/<taskId>/dependencies \
  -H "Content-Type: application/json" \
  -d '{"dependsOnId":"<otherTaskId>"}'
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/tasks.ts
git commit -m "feat(tasks): 扩展任务路由支持层级、依赖、标签和事件历史"
```

---

### Task 4: 前端增强任务卡片

**Files:**
- Create: `packages/client/src/pages/kanban/components/task-card.tsx`
- Create: `packages/client/src/pages/kanban/components/task-card-activity.tsx`

- [ ] **Step 1: 创建活动状态指示器组件**

创建 `packages/client/src/pages/kanban/components/task-card-activity.tsx`：

```tsx
import { Badge } from 'antd';
import type { Task } from '@dark-boss/shared';

interface TaskCardActivityProps {
  task: Task;
  agents: { id: string; name: string; role: string }[];
}

const ACTIVITY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: '#00d992', bg: '#1a3a2a', label: '● 活跃' },
  thinking: { color: '#4cb3d4', bg: '#1a2a3a', label: '💭 思考中' },
  waiting_permission: { color: '#ffba00', bg: '#2a2a1a', label: '⏸ 等待权限' },
  error: { color: '#fb565b', bg: '#2a1a1a', label: '⚠ 出错' },
};

export function TaskCardActivity({ task, agents }: TaskCardActivityProps) {
  if (task.status !== 'in_progress' || !task.activitySummary) return null;

  // 根据 activitySummary 内容推断状态
  const getActivityType = (): string => {
    const s = task.activitySummary || '';
    if (s.includes('等待权限') || s.includes('permission')) return 'waiting_permission';
    if (s.includes('思考') || s.includes('thinking')) return 'thinking';
    if (s.includes('错误') || s.includes('error')) return 'error';
    return 'active';
  };

  const activityType = getActivityType();
  const style = ACTIVITY_STYLES[activityType];

  return (
    <div style={{
      background: style.bg,
      borderRadius: 4,
      padding: '4px 8px',
      marginBottom: 6,
      fontSize: 11,
    }}>
      <div style={{ color: style.color }}>{style.label}</div>
      <div style={{ color: '#595959', fontSize: 10, marginTop: 2 }}>
        {task.activitySummary}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建增强任务卡片组件**

创建 `packages/client/src/pages/kanban/components/task-card.tsx`：

```tsx
import { Card, Tag, Typography, Space } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import type { Task, TaskPriority, TaskType, Agent } from '@dark-boss/shared';
import { AGENT_ROLES } from '@dark-boss/shared';
import { TaskCardActivity } from './task-card-activity.js';

const { Text } = Typography;

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  critical: { label: '紧急', color: '#fb565b' },
  high: { label: '高', color: '#fa8c16' },
  medium: { label: '中', color: '#00d992' },
  low: { label: '低', color: '#8b949e' },
};

const TASK_TYPE_CONFIG: Record<TaskType, { label: string; color: string }> = {
  epic: { label: 'EPIC', color: '#fa8c16' },
  story: { label: 'STORY', color: '#722ed1' },
  task: { label: 'TASK', color: '#00d992' },
  subtask: { label: 'SUB', color: '#8b949e' },
};

const TAG_COLORS: Record<string, string> = {
  auth: '#4cb3d4', frontend: '#68a063', backend: '#8b5cf6',
  bug: '#fb565b', API: '#722ed1', performance: '#ffba00',
  urgent: '#f97316', docs: '#8b949e',
};

interface TaskCardProps {
  task: Task;
  agents: Agent[];
  onClick: (task: Task) => void;
}

export function TaskCard({ task, agents, onClick }: TaskCardProps) {
  const assignee = agents.find(a => a.id === task.assignedAgentId);
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const typeConfig = TASK_TYPE_CONFIG[task.taskType || 'task'];
  const roleInfo = assignee ? (AGENT_ROLES[assignee.role] || AGENT_ROLES.custom) : null;
  const isOverdue = task.dueAt && task.status !== 'done' && task.status !== 'cancelled'
    && new Date(task.dueAt).getTime() < Date.now();
  const isBlocked = task.blockedBy && task.blockedBy.length > 0;

  return (
    <Card
      size="small"
      style={{
        background: '#2a2a2a',
        borderLeft: `3px solid ${isBlocked ? '#fb565b' : priorityConfig.color}`,
        cursor: 'pointer',
      }}
      styles={{ body: { padding: '8px 12px' } }}
      onClick={() => onClick(task)}
    >
      {/* 类型标签 + 标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {task.taskType && task.taskType !== 'task' && (
              <Tag style={{
                background: typeConfig.color,
                color: '#050507',
                fontSize: 10,
                lineHeight: '16px',
                padding: '0 4px',
                fontWeight: 'bold',
                border: 'none',
              }}>
                {typeConfig.label}
              </Tag>
            )}
            <span style={{ color: '#f2f2f2', fontSize: 13, fontWeight: 500 }}>
              {task.title}
            </span>
          </div>
          <Space size={4}>
            <Tag color={priorityConfig.color} style={{ fontSize: 11, lineHeight: '18px', padding: '0 4px' }}>
              {priorityConfig.label}
            </Tag>
            {task.estimatedMinutes && (
              <Text style={{ color: '#595959', fontSize: 11 }}>
                <ClockCircleOutlined /> {task.estimatedMinutes}分钟
              </Text>
            )}
            {isOverdue && (
              <Tag color="error" style={{ fontSize: 10, lineHeight: '16px', padding: '0 3px', margin: 0 }}>
                逾期
              </Tag>
            )}
          </Space>
        </div>
      </div>

      {/* 活动状态（Module B） */}
      <TaskCardActivity task={task} agents={agents} />

      {/* 进度条 */}
      {task.progress > 0 && task.status === 'in_progress' && (
        <div style={{ marginTop: 6 }}>
          <div style={{
            height: 3,
            background: '#3d3a39',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${task.progress}%`,
              height: '100%',
              background: task.progress >= 80 ? '#00d992' : '#ffba00',
              borderRadius: 2,
            }} />
          </div>
        </div>
      )}

      {/* 标签行 */}
      {task.tags && task.tags.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {task.tags.slice(0, 3).map(tag => (
            <span key={tag} style={{
              background: `${TAG_COLORS[tag] || '#8b949e'}20`,
              color: TAG_COLORS[tag] || '#8b949e',
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 9999,
            }}>
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span style={{ color: '#595959', fontSize: 10 }}>+{task.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* 底部：负责人 + 活动时间 */}
      <div style={{
        marginTop: 6,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        {assignee ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14 }}>{roleInfo?.icon}</span>
            <Text style={{ color: '#8b949e', fontSize: 11 }}>{assignee.name}</Text>
          </div>
        ) : <div />}
        {task.activitySummary && (
          <Text style={{ color: '#595959', fontSize: 10 }}>
            活动中
          </Text>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: 验证前端类型检查**

Run: `cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/client typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/pages/kanban/components/task-card.tsx
git add packages/client/src/pages/kanban/components/task-card-activity.tsx
git commit -m "feat(kanban): 创建增强任务卡片组件，支持类型标签、进度条、标签、活动状态"
```

---

### Task 5: 扩展任务详情抽屉

**Files:**
- Modify: `packages/client/src/pages/kanban/components/task-detail-drawer.tsx`

- [ ] **Step 1: 在详情抽屉中添加依赖区域和子任务清单**

在 `task-detail-drawer.tsx` 的 Drawer 内容中，在"执行结果"区域之前，新增三个区域：

```tsx
{/* 依赖关系区域 */}
{task.blockedBy && task.blockedBy.length > 0 && (
  <div style={{ marginBottom: 16 }}>
    <div style={{ color: '#ffba00', fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>
      ⛔ 被阻塞于
    </div>
    {task.blockedBy.map(depId => {
      const depTask = allTasks.find(t => t.id === depId);
      return depTask ? (
        <div key={depId} style={{
          background: '#2a1a1a',
          border: '1px solid #fb565b',
          borderRadius: 4,
          padding: '8px 10px',
          marginBottom: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ color: '#f2f2f2', fontSize: 12 }}>{depTask.title}</span>
          <span style={{ color: '#ffba00', fontSize: 11 }}>{depTask.status}</span>
        </div>
      ) : null;
    })}
  </div>
)}

{/* 子任务清单 */}
{childTasks.length > 0 && (
  <div style={{ marginBottom: 16 }}>
    <div style={{ color: '#4cb3d4', fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>
      📋 子任务 ({childTasks.filter(c => c.status === 'done').length}/{childTasks.length})
    </div>
    {childTasks.map(child => (
      <div key={child.id} style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        borderRadius: 4,
        background: child.status === 'in_progress' ? '#1a1a1a' : 'transparent',
      }}>
        <span style={{ color: child.status === 'done' ? '#00d992' : child.status === 'in_progress' ? '#ffba00' : '#595959' }}>
          {child.status === 'done' ? '✓' : child.status === 'in_progress' ? '◐' : '○'}
        </span>
        <span style={{
          color: child.status === 'done' ? '#8b949e' : '#f2f2f2',
          fontSize: 12,
          textDecoration: child.status === 'done' ? 'line-through' : 'none',
        }}>
          {child.title}
        </span>
      </div>
    ))}
  </div>
)}
```

需要在组件 props 中新增 `allTasks` 参数以查找依赖任务，组件内需要查询子任务：

```typescript
const { data: childTasks = [] } = useQuery({
  queryKey: ['tasks', 'children', task?.id],
  queryFn: () => api.get<Task[]>(`/tasks/${task?.id}/children`),
  enabled: !!task?.id,
});
```

同时更新 props 接口：
```typescript
interface TaskDetailDrawerProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  agents: Agent[];
  departments: { id: string; name: string }[];
  workflows: { id: string; name: string }[];
  allTasks: Task[];  // 新增：用于查找依赖任务
  onEdit: (task: Task) => void;
}
```

- [ ] **Step 2: 验证前端类型检查**

Run: `cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/client typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/pages/kanban/components/task-detail-drawer.tsx
git commit -m "feat(kanban): 扩展任务详情抽屉，添加依赖关系和子任务清单展示"
```

---

### Task 6: 替换看板页中的旧卡片为新卡片组件

**Files:**
- Modify: `packages/client/src/pages/kanban/index.tsx`

- [ ] **Step 1: 替换 TaskCard 和 SortableTaskCard 组件引用**

在 `index.tsx` 中：

1. 删除旧的 `TaskCard` 函数组件定义（约 line 47-99）
2. 删除旧的 `SortableTaskCard` 组件（约 line 102-124），替换为使用新 `TaskCard` 的版本
3. 添加导入：

```typescript
import { TaskCard } from './components/task-card.js';
```

新的 SortableTaskCard：

```tsx
function SortableTaskCard({ task, agents, onClick }: {
  task: Task;
  agents: Agent[];
  onClick: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: 8,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} agents={agents} onClick={onClick} />
    </div>
  );
}
```

4. 更新 `TaskDetailDrawer` 的 props，传入 `allTasks={tasks}`

5. 在创建/编辑任务的 Modal 表单中添加 `taskType` 和 `tags` 字段

- [ ] **Step 2: 验证看板页面功能正常**

Run: `cd d:/AI/Projects/dark-boss && pnpm dev`

打开 http://localhost:5173/app/kanban 验证：
- 卡片正常显示（类型标签、标签、进度条）
- 拖拽排序正常工作
- 点击卡片打开详情抽屉
- 详情抽屉中显示子任务和依赖关系

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/pages/kanban/index.tsx
git commit -m "refactor(kanban): 替换旧卡片为增强卡片组件，支持类型标签和标签显示"
```

---

## Phase 2: Module B — 实时进度追踪

### Task 7: 后端进度更新和活动记录

**Files:**
- Modify: `packages/server/src/services/task-executor.ts`

- [ ] **Step 1: 在任务执行过程中更新 activity_summary 和 progress**

在 `executeTask` 函数中，状态更新为 `in_progress` 之后、Claude API 调用之前，添加：

```typescript
// 更新活动摘要
run(
  "UPDATE tasks SET activity_summary = ?, updated_at = ? WHERE id = ?",
  ['正在准备执行任务...', Date.now(), taskId]
);
broadcast('task:activity', {
  taskId, agentId: task.assigned_agent_id,
  activityType: 'started', detail: '正在准备执行任务...',
  timestamp: Date.now(),
});
```

在 Claude API 调用返回结果后（`result` 变量赋值之后），更新：

```typescript
// 更新进度和活动摘要
const progressPercent = 100;
run(
  "UPDATE tasks SET progress = ?, activity_summary = ?, updated_at = ? WHERE id = ?",
  [progressPercent, '任务执行完成', Date.now(), taskId]
);
broadcast('task:progress', {
  taskId, progress: progressPercent, summary: '任务执行完成',
});
```

在 catch 块中添加：

```typescript
run(
  "UPDATE tasks SET activity_summary = ?, updated_at = ? WHERE id = ?",
  [`执行失败: ${errorMsg}`, Date.now(), taskId]
);
```

- [ ] **Step 2: 在任务事件记录中添加关键节点**

在 executeTask 函数中添加事件记录：

```typescript
// 任务开始时
run(
  `INSERT INTO task_events (id, task_id, event_type, agent_id, payload, created_at)
   VALUES (?, ?, 'status_changed', ?, ?, ?)`,
  [uuid(), taskId, task.assigned_agent_id,
   JSON.stringify({ from: task.status, to: 'in_progress' }), Date.now()]
);

// 任务完成时
run(
  `INSERT INTO task_events (id, task_id, event_type, agent_id, payload, created_at)
   VALUES (?, ?, 'completed', ?, ?, ?)`,
  [uuid(), taskId, task.assigned_agent_id,
   JSON.stringify({ tokens: result.tokens, cost: result.cost }), Date.now()]
);
```

- [ ] **Step 3: 验证后端类型检查**

Run: `cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/server typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/services/task-executor.ts
git commit -m "feat(tasks): 任务执行时更新进度、活动摘要和事件记录"
```

---

### Task 8: 前端 WebSocket 事件监听实时进度

**Files:**
- Modify: `packages/client/src/pages/kanban/index.tsx`

- [ ] **Step 1: 扩展 WebSocket 事件监听**

在现有的 `useEffect` WebSocket 监听中，增加 `task:progress` 和 `task:activity` 事件处理：

```typescript
useEffect(() => {
  const handler = (event: Event) => {
    const { type, payload } = (event as CustomEvent).detail;
    if (type === 'task:updated') {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
    if (type === 'task:progress') {
      // 乐观更新：直接修改缓存中对应任务的 progress 和 activitySummary
      queryClient.setQueryData<Task[]>(['tasks'], (old) => {
        if (!old) return old;
        return old.map(t => t.id === payload.taskId
          ? { ...t, progress: payload.progress, activitySummary: payload.summary }
          : t
        );
      });
    }
    if (type === 'task:activity') {
      queryClient.setQueryData<Task[]>(['tasks'], (old) => {
        if (!old) return old;
        return old.map(t => t.id === payload.taskId
          ? { ...t, activitySummary: payload.detail }
          : t
        );
      });
    }
  };
  window.addEventListener('ws:message', handler);
  return () => window.removeEventListener('ws:message', handler);
}, [queryClient]);
```

- [ ] **Step 2: 验证实时进度更新**

Run: `cd d:/AI/Projects/dark-boss && pnpm dev`

1. 创建任务并分配给 Agent
2. 执行任务
3. 观察卡片上进度条和活动摘要是否实时更新

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/pages/kanban/index.tsx
git commit -m "feat(kanban): 前端监听 task:progress/task:activity 事件实现实时进度更新"
```

---

## Phase 3: Module C — Agent 工作量视图

### Task 9: 创建工作量计算 Hook

**Files:**
- Create: `packages/client/src/pages/kanban/hooks/use-agent-workload.ts`

- [ ] **Step 1: 编写 useAgentWorkload Hook**

```typescript
import { useMemo } from 'react';
import type { Task, Agent } from '@dark-boss/shared';

export interface AgentWorkload {
  agentId: string;
  agent: Agent;
  inProgressCount: number;
  todoCount: number;
  totalCount: number;
  loadPercent: number;
  level: 'idle' | 'moderate' | 'busy' | 'offline';
}

export function useAgentWorkload(tasks: Task[], agents: Agent[]): AgentWorkload[] {
  return useMemo(() => {
    return agents.map(agent => {
      const agentTasks = tasks.filter(t => t.assignedAgentId === agent.id);
      const inProgressCount = agentTasks.filter(t => t.status === 'in_progress').length;
      const todoCount = agentTasks.filter(t => t.status === 'todo').length;
      const totalCount = agentTasks.length;

      // 负载上限按 5 个任务算 100%
      const loadPercent = Math.min(Math.round((inProgressCount / 5) * 100), 100);

      let level: AgentWorkload['level'];
      if (agent.status === 'offline') level = 'offline';
      else if (inProgressCount === 0) level = 'idle';
      else if (inProgressCount <= 2) level = 'moderate';
      else level = 'busy';

      return { agentId: agent.id, agent, inProgressCount, todoCount, totalCount, loadPercent, level };
    });
  }, [tasks, agents]);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/pages/kanban/hooks/use-agent-workload.ts
git commit -m "feat(kanban): 创建 Agent 工作量计算 Hook"
```

---

### Task 10: 创建负载概览条组件

**Files:**
- Create: `packages/client/src/pages/kanban/components/workload-overview.tsx`

- [ ] **Step 1: 编写 WorkloadOverview 组件**

组件接收 `workloads` 和 `onAgentClick` 回调。每个 Agent 一张小卡片，显示图标、名称、状态、任务计数和负载进度条。点击触发筛选。

关键样式：
- idle: 绿色边框 + `#1a3a2a` 背景
- moderate: 默认边框 + `#1a1a1a` 背景
- busy: 红色边框 + `#2a1a1a` 背景
- offline: 灰色 + 50% opacity

进度条颜色：idle=`#00d992`, moderate=`#ffba00`, busy=`#fb565b`, offline=`#8b949e`

- [ ] **Step 2: 集成到看板页面**

在 `index.tsx` 的筛选栏下方添加 `<WorkloadOverview>`：

```tsx
import { useAgentWorkload } from './hooks/use-agent-workload.js';
import { WorkloadOverview } from './components/workload-overview.js';

// 在 KanbanPage 组件内
const workloads = useAgentWorkload(tasks, agents);

// 在筛选栏 JSX 之后、DndContext 之前
<WorkloadOverview
  workloads={workloads}
  selectedAgentId={filterAgent}
  onAgentClick={(agentId) => setFilterAgent(agentId === filterAgent ? undefined : agentId)}
/>
```

- [ ] **Step 3: 验证看板页面负载概览**

Run: `cd d:/AI/Projects/dark-boss && pnpm dev`

打开看板页面，确认筛选栏下方显示 Agent 负载概览条，点击 Agent 卡片触发筛选。

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/pages/kanban/components/workload-overview.tsx
git add packages/client/src/pages/kanban/index.tsx
git commit -m "feat(kanban): 添加团队负载概览条，点击 Agent 可筛选任务"
```

---

### Task 11: 智能分配建议

**Files:**
- Create: `packages/client/src/pages/kanban/utils/assignment-suggestion.ts`
- Modify: `packages/client/src/pages/kanban/index.tsx`

- [ ] **Step 1: 编写分配建议工具函数**

创建 `packages/client/src/pages/kanban/utils/assignment-suggestion.ts`：

```typescript
import type { Task, Agent } from '@dark-boss/shared';
import { AGENT_ROLES } from '@dark-boss/shared';

interface Suggestion {
  agentId: string;
  score: number;
  reason: string;
}

export function getAssignmentSuggestions(
  task: { title: string; description?: string | null; tags?: string[] },
  agents: Agent[],
  workloadMap: Map<string, number> // agentId → inProgressCount
): Suggestion[] {
  const taskText = `${task.title} ${(task.description || '')} ${(task.tags || []).join(' ')}`.toLowerCase();

  return agents
    .filter(a => a.status !== 'offline')
    .map(agent => {
      const roleInfo = AGENT_ROLES[agent.role];
      const roleKeywords = `${roleInfo.label} ${agent.role}`.toLowerCase();
      const roleMatch = roleKeywords.split(/\s+/).some(kw => taskText.includes(kw));
      const load = workloadMap.get(agent.id) || 0;
      const isOverloaded = load >= 3;

      // 评分：角色匹配 +40，负载低 +30，不过载 +20
      let score = 0;
      if (roleMatch) score += 40;
      score += Math.max(0, 30 - load * 10);
      if (!isOverloaded) score += 20;

      const reasons: string[] = [];
      if (roleMatch) reasons.push(`${roleInfo.label}角色匹配`);
      if (load === 0) reasons.push('当前空闲');
      else if (load <= 2) reasons.push(`负载适中(${load}个任务)`);
      if (isOverloaded) reasons.push('⚠ 负载过高');

      return { agentId: agent.id, score, reason: reasons.join('，') };
    })
    .sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 2: 在创建/编辑任务 Modal 的负责人选择器中显示负载信息**

修改 `index.tsx` 中的负责人 Select 组件，在每个 option 中显示负载百分比：

```tsx
<Select
  allowClear
  placeholder="负责人"
  value={form.getFieldValue('assignedAgentId')}
  onChange={(val) => form.setFieldValue('assignedAgentId', val)}
  style={{ width: '100%' }}
>
  {getAssignmentSuggestions(
    { title: form.getFieldValue('title') || '' },
    agents,
    new Map(workloads.map(w => [w.agentId, w.inProgressCount]))
  ).map(suggestion => {
    const agent = agents.find(a => a.id === suggestion.agentId)!;
    const r = AGENT_ROLES[agent.role] || AGENT_ROLES.custom;
    const workload = workloads.find(w => w.agentId === agent.id);
    return (
      <Select.Option key={agent.id} value={agent.id}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{r.icon} {agent.name}</span>
          <span style={{ fontSize: 10, color: '#8b949e' }}>
            {workload?.loadPercent || 0}%
          </span>
        </div>
      </Select.Option>
    );
  })}
</Select>
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/pages/kanban/utils/assignment-suggestion.ts
git add packages/client/src/pages/kanban/index.tsx
git commit -m "feat(kanban): 添加智能分配建议，负责人选择器显示负载和推荐排序"
```

---

## Phase 4: Module E — 增强卡片与多视图

### Task 12: 提取筛选和拖拽 Hooks

**Files:**
- Create: `packages/client/src/pages/kanban/hooks/use-task-filters.ts`
- Create: `packages/client/src/pages/kanban/hooks/use-kanban-dnd.ts`

- [ ] **Step 1: 提取筛选逻辑到 useTaskFilters**

将 `index.tsx` 中的筛选状态和 `filteredTasks` 计算提取到 Hook：

```typescript
export function useTaskFilters(tasks: Task[]) {
  const [searchText, setSearchText] = useState('');
  const [filterAgent, setFilterAgent] = useState<string | undefined>();
  const [filterDept, setFilterDept] = useState<string | undefined>();
  const [filterPriority, setFilterPriority] = useState<TaskPriority | undefined>();
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (searchText) {
        const lower = searchText.toLowerCase();
        if (!t.title.toLowerCase().includes(lower) &&
            !(t.description || '').toLowerCase().includes(lower)) return false;
      }
      if (filterAgent && t.assignedAgentId !== filterAgent) return false;
      if (filterDept && t.departmentId !== filterDept) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterTags.length > 0 && !(t.tags || []).some(tag => filterTags.includes(tag))) return false;
      return true;
    });
  }, [tasks, searchText, filterAgent, filterDept, filterPriority, filterTags]);

  return {
    searchText, setSearchText,
    filterAgent, setFilterAgent,
    filterDept, setFilterDept,
    filterPriority, setFilterPriority,
    filterTags, setFilterTags,
    filteredTasks,
  };
}
```

- [ ] **Step 2: 提取拖拽逻辑到 useKanbanDnd**

```typescript
export function useKanbanDnd(
  tasks: Task[],
  onMove: (params: { id: string; status: TaskStatus; columnOrder: number }) => void
) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  }, [tasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    const targetColumn = COLUMNS.find(c => c.status === overId);
    if (targetColumn) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== targetColumn.status) {
        onMove({ id: taskId, status: targetColumn.status, columnOrder: Date.now() });
      }
      return;
    }

    const targetTask = tasks.find(t => t.id === overId);
    if (targetTask && taskId !== overId) {
      onMove({ id: taskId, status: targetTask.status, columnOrder: targetTask.columnOrder });
    }
  }, [tasks, onMove]);

  return { activeTask, sensors, handleDragStart, handleDragEnd };
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/pages/kanban/hooks/use-task-filters.ts
git add packages/client/src/pages/kanban/hooks/use-kanban-dnd.ts
git commit -m "refactor(kanban): 提取筛选和拖拽逻辑到自定义 Hooks"
```

---

### Task 13: 创建视图切换器和列表视图

**Files:**
- Create: `packages/client/src/pages/kanban/components/view-switcher.tsx`
- Create: `packages/client/src/pages/kanban/components/list-view.tsx`
- Create: `packages/client/src/pages/kanban/components/agent-view.tsx`

- [ ] **Step 1: 创建 ViewSwitcher 组件**

```tsx
export type ViewMode = 'kanban' | 'list' | 'agent';

interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: 'kanban', label: '看板' },
  { key: 'list', label: '列表' },
  { key: 'agent', label: 'Agent' },
];

export function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  return (
    <div style={{ display: 'flex', background: '#101010', border: '1px solid #3d3a39', borderRadius: 6, overflow: 'hidden' }}>
      {VIEWS.map(v => (
        <div
          key={v.key}
          onClick={() => onChange(v.key)}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            cursor: 'pointer',
            color: value === v.key ? '#050507' : '#b8b3b0',
            background: value === v.key ? '#00d992' : 'transparent',
            fontWeight: value === v.key ? 500 : 400,
            borderLeft: v.key !== 'kanban' ? '1px solid #3d3a39' : 'none',
          }}
        >
          {v.label}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 创建 ListView 组件**

列表视图使用 Ant Design Table 组件，列为：标题、类型、优先级、负责人、状态、截止时间。点击行打开详情抽屉。

```tsx
import { Table, Tag } from 'antd';
import type { Task, Agent } from '@dark-boss/shared';

interface ListViewProps {
  tasks: Task[];
  agents: Agent[];
  onTaskClick: (task: Task) => void;
}

export function ListView({ tasks, agents, onTaskClick }: ListViewProps) {
  const columns = [
    {
      title: '任务', dataIndex: 'title', key: 'title',
      render: (text: string, record: Task) => (
        <span style={{ color: '#f2f2f2', cursor: 'pointer' }} onClick={() => onTaskClick(record)}>
          {text}
        </span>
      ),
    },
    {
      title: '类型', dataIndex: 'taskType', key: 'taskType', width: 80,
      render: (type: string) => <Tag>{type || 'task'}</Tag>,
    },
    {
      title: '优先级', dataIndex: 'priority', key: 'priority', width: 80,
      render: (p: string) => <Tag color={p === 'critical' ? '#fb565b' : p === 'high' ? '#fa8c16' : '#00d992'}>{p}</Tag>,
    },
    {
      title: '负责人', key: 'assignee', width: 120,
      render: (_: unknown, record: Task) => {
        const agent = agents.find(a => a.id === record.assignedAgentId);
        return agent ? <span style={{ color: '#b8b3b0' }}>{agent.name}</span> : <span style={{ color: '#595959' }}>未分配</span>;
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => <Tag color={s === 'done' ? '#00d992' : s === 'in_progress' ? '#ffba00' : '#8b949e'}>{s}</Tag>,
    },
    {
      title: '截止', dataIndex: 'dueAt', key: 'dueAt', width: 120,
      render: (d: string) => d ? new Date(d).toLocaleDateString('zh-CN') : '-',
    },
  ];

  return (
    <Table
      dataSource={tasks}
      columns={columns}
      rowKey="id"
      size="small"
      pagination={false}
      style={{ background: 'transparent' }}
      onRow={(record) => ({ onClick: () => onTaskClick(record), style: { cursor: 'pointer' } })}
    />
  );
}
```

- [ ] **Step 3: 创建 AgentView 组件**

按 Agent 分组显示任务，每个 Agent 一列。

```tsx
import { Card, Typography, Tag } from 'antd';
import type { Task, Agent } from '@dark-boss/shared';
import { AGENT_ROLES } from '@dark-boss/shared';
import { TaskCard } from './task-card.js';

interface AgentViewProps {
  tasks: Task[];
  agents: Agent[];
  onTaskClick: (task: Task) => void;
}

export function AgentView({ tasks, agents, onTaskClick }: AgentViewProps) {
  const onlineAgents = agents.filter(a => a.status !== 'offline');

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
      {onlineAgents.map(agent => {
        const roleInfo = AGENT_ROLES[agent.role] || AGENT_ROLES.custom;
        const agentTasks = tasks.filter(t => t.assignedAgentId === agent.id);
        const statusColor = agent.status === 'working' ? '#00d992' : agent.status === 'waiting' ? '#ffba00' : '#8b949e';

        return (
          <Card
            key={agent.id}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f2f2f2' }}>
                <span style={{ fontSize: 18 }}>{roleInfo.icon}</span>
                <span>{agent.name}</span>
                <Tag color={statusColor} style={{ fontSize: 10, marginLeft: 4 }}>{agent.status}</Tag>
              </div>
            }
            style={{ minWidth: 260, flex: 1, background: '#101010', border: '1px solid #3d3a39' }}
            styles={{ header: { borderBottom: '1px solid #3d3a39', padding: '8px 12px' }, body: { padding: 8 } }}
          >
            {agentTasks.length === 0 ? (
              <div style={{ color: '#595959', fontSize: 12, textAlign: 'center', padding: 20 }}>暂无任务</div>
            ) : (
              agentTasks.map(task => (
                <TaskCard key={task.id} task={task} agents={agents} onClick={onTaskClick} />
              ))
            )}
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 集成视图切换到看板页面**

在 `index.tsx` 中添加视图状态和切换：

```tsx
const [viewMode, setViewMode] = useState<ViewMode>('kanban');

// 在标题栏 JSX 中
<ViewSwitcher value={viewMode} onChange={setViewMode} />

// 在 DndContext 区域替换为条件渲染
{viewMode === 'kanban' && <KanbanView ... />}
{viewMode === 'list' && <ListView tasks={filteredTasks} agents={agents} onTaskClick={handleTaskClick} />}
{viewMode === 'agent' && <AgentView tasks={filteredTasks} agents={agents} onTaskClick={handleTaskClick} />}
```

- [ ] **Step 5: 验证三种视图切换**

Run: `cd d:/AI/Projects/dark-boss && pnpm dev`

打开看板页面，切换三种视图确认正常工作。

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/pages/kanban/components/view-switcher.tsx
git add packages/client/src/pages/kanban/components/list-view.tsx
git add packages/client/src/pages/kanban/components/agent-view.tsx
git add packages/client/src/pages/kanban/index.tsx
git commit -m "feat(kanban): 添加三种视图切换（看板/列表/Agent 视角）"
```

---

## Phase 5: Module D — 通知与提醒系统

### Task 14: 后端通知服务

**Files:**
- Create: `packages/server/src/services/notification-service.ts`

- [ ] **Step 1: 创建通知生成服务**

```typescript
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/connection.js';
import { broadcast } from '../ws/connection.js';

function run(sql: string, params: unknown[] = []) { getDb()!.run(sql, params); }
function queryOne(sql: string, params: unknown[] = []) { return getDb()!.exec(sql, params)[0]?.values[0]; }

export function createNotification(params: {
  type: string;
  taskId?: string;
  agentId?: string;
  message: string;
  detail?: unknown;
}) {
  const id = uuid();
  const now = Date.now();
  run(
    `INSERT INTO notifications (id, type, task_id, agent_id, message, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, params.type, params.taskId || null, params.agentId || null,
     params.message, params.detail ? JSON.stringify(params.detail) : null, now]
  );
  broadcast('notification:new', { id, type: params.type, taskId: params.taskId, message: params.message, createdAt: now });
  return id;
}

// 逾期检查（定时调用）
export function checkOverdueTasks() {
  const now = Date.now();
  const threshold = now + 30 * 60 * 1000; // 30 分钟后
  const tasks = getDb()!.exec(
    `SELECT id, title, assigned_agent_id FROM tasks
     WHERE due_at IS NOT NULL AND due_at < ? AND status NOT IN ('done', 'cancelled')`,
    [threshold]
  )[0]?.values || [];

  for (const [taskId, title, agentId] of tasks) {
    // 避免重复通知：检查最近是否已发过逾期通知
    const recent = getDb()!.exec(
      `SELECT id FROM notifications WHERE task_id = ? AND type = 'task_overdue' AND created_at > ?`,
      [taskId, now - 30 * 60 * 1000] as unknown as unknown[]
    )[0]?.values;
    if (recent && recent.length > 0) continue;

    createNotification({
      type: 'task_overdue',
      taskId: taskId as string,
      agentId: agentId as string,
      message: `⚠ 任务即将逾期: ${title}`,
    });
  }
}
```

- [ ] **Step 2: 在任务操作中埋点生成通知**

在 `routes/tasks.ts` 中引入 notification-service 并在关键操作中调用：

```typescript
import { createNotification } from '../services/notification-service.js';

// 任务分配时
router.post('/:id/assign/:agentId', (req, res) => {
  // ... 现有逻辑 ...
  const agent = queryOne('SELECT name FROM agents WHERE id = ?', [req.params.agentId]);
  createNotification({
    type: 'task_assigned',
    taskId: req.params.id,
    agentId: req.params.agentId,
    message: `${agent?.name || 'Agent'} 被分配了任务 "${task?.title}"`,
  });
  // ... 返回响应 ...
});

// 任务状态变更时（在 move 路由中）
router.patch('/:id/move', (req, res) => {
  // ... 现有逻辑 ...
  if (body.status === 'done') {
    createNotification({
      type: 'task_completed',
      taskId: req.params.id,
      agentId: task?.assigned_agent_id,
      message: `任务 "${task?.title}" 已完成`,
    });
  }
  // ...
});
```

- [ ] **Step 3: 设置逾期定时检查**

在 `packages/server/src/index.ts` 或启动入口中：

```typescript
import { checkOverdueTasks } from './services/notification-service.js';

// 每 5 分钟检查逾期任务
setInterval(checkOverdueTasks, 5 * 60 * 1000);
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/services/notification-service.ts
git add packages/server/src/routes/tasks.ts
git commit -m "feat(notifications): 创建通知服务并在任务操作中埋点生成通知"
```

---

### Task 15: 后端通知 API 路由

**Files:**
- Create: `packages/server/src/routes/notifications.ts`

- [ ] **Step 1: 创建通知路由**

```typescript
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/connection.js';

const router = Router();

function queryAll(sql: string, params: unknown[] = []) {
  return getDb()!.exec(sql, params)[0]?.values.map(row => {
    const cols = getDb()!.exec(sql.replace('SELECT *', 'SELECT *'))[0]?.columns;
    if (!cols) return {};
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  }) || [];
}

// 获取通知列表
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const notifications = queryAll(
    'SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
  res.json(notifications);
});

// 标记已读
router.patch('/:id/read', (req, res) => {
  getDb()!.run('UPDATE notifications SET read = 1 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// 全部已读
router.post('/read-all', (_req, res) => {
  getDb()!.run('UPDATE notifications SET read = 1 WHERE read = 0');
  res.json({ success: true });
});

// 未读数
router.get('/unread-count', (_req, res) => {
  const result = getDb()!.exec("SELECT COUNT(*) as count FROM notifications WHERE read = 0")[0]?.values[0];
  res.json({ count: result?.[0] || 0 });
});

export default router;
```

- [ ] **Step 2: 注册路由到 app**

在服务器入口文件中添加：

```typescript
import notificationsRouter from './routes/notifications.js';
app.use('/api/v1/notifications', notificationsRouter);
```

- [ ] **Step 3: 验证 API**

Run: `cd d:/AI/Projects/dark-boss && pnpm dev:server`

```bash
curl http://localhost:3000/api/v1/notifications
curl http://localhost:3000/api/v1/notifications/unread-count
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/routes/notifications.ts
git commit -m "feat(notifications): 创建通知 API 路由（列表/已读/未读数）"
```

---

### Task 16: 前端通知铃铛组件

**Files:**
- Create: `packages/client/src/pages/kanban/components/notification-bell.tsx`
- Modify: `packages/client/src/components/layout/app-layout.tsx`

- [ ] **Step 1: 创建 NotificationBell 组件**

组件包含铃铛图标、未读计数角标、下拉通知面板。使用 React Query 获取通知列表和未读数，WebSocket 监听 `notification:new` 事件刷新。

- [ ] **Step 2: 集成到导航栏**

在 `app-layout.tsx` 的 Header 右侧（Token 使用量旁边）添加 `<NotificationBell />`。

- [ ] **Step 3: 验证通知流程**

Run: `cd d:/AI/Projects/dark-boss && pnpm dev`

1. 分配一个任务给 Agent → 通知铃铛应显示新通知
2. 点击铃铛查看通知列表
3. 点击"全部已读"清除角标

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/pages/kanban/components/notification-bell.tsx
git add packages/client/src/components/layout/app-layout.tsx
git commit -m "feat(notifications): 添加通知铃铛组件并集成到导航栏"
```

---

## Phase 6: Module F — 高级管理功能

### Task 17: 任务模板与 WIP 限制

**Files:**
- Create: `packages/client/src/pages/kanban/utils/task-templates.ts`
- Create: `packages/client/src/pages/kanban/components/wip-limits.tsx`
- Modify: `packages/client/src/pages/kanban/index.tsx`

- [ ] **Step 1: 创建任务模板工具**

```typescript
export interface TaskTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  defaultTaskType: 'epic' | 'story' | 'task';
  subtasks: string[];
  defaultTags: string[];
  defaultRole?: string;
}

export const BUILTIN_TEMPLATES: TaskTemplate[] = [
  {
    id: 'bug-fix',
    name: 'Bug 修复',
    icon: '🐛',
    description: '自动创建 3 个子任务',
    defaultTaskType: 'task',
    subtasks: ['复现并定位问题', '编写修复代码', '添加回归测试'],
    defaultTags: ['bug'],
  },
  {
    id: 'feature',
    name: '新功能开发',
    icon: '✨',
    description: '自动创建 4 个子任务',
    defaultTaskType: 'story',
    subtasks: ['需求分析与设计', '编码实现', '代码审查', '测试验证'],
    defaultTags: [],
  },
  {
    id: 'code-review',
    name: '代码审查',
    icon: '🔍',
    description: '自动分配给架构师',
    defaultTaskType: 'task',
    subtasks: ['审查代码质量', '检查安全性', '生成审查报告'],
    defaultTags: [],
    defaultRole: 'architect',
  },
];

// localStorage 操作
export function getCustomTemplates(): TaskTemplate[] {
  try { return JSON.parse(localStorage.getItem('kanban-templates') || '[]'); }
  catch { return []; }
}

export function saveCustomTemplate(template: TaskTemplate) {
  const templates = getCustomTemplates();
  templates.push(template);
  localStorage.setItem('kanban-templates', JSON.stringify(templates));
}
```

- [ ] **Step 2: 创建 WIP 限制组件**

```typescript
// WIP 配置存储在 localStorage
export function getWipLimits(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem('kanban-wip-limits') || '{}'); }
  catch { return {}; }
}

export function setWipLimit(status: string, limit: number | null) {
  const limits = getWipLimits();
  if (limit === null) delete limits[status];
  else limits[status] = limit;
  localStorage.setItem('kanban-wip-limits', JSON.stringify(limits));
}

export function checkWipLimit(status: string, currentCount: number): { exceeded: boolean; limit: number } {
  const limits = getWipLimits();
  const limit = limits[status];
  if (!limit) return { exceeded: false, limit: 0 };
  return { exceeded: currentCount >= limit, limit };
}
```

- [ ] **Step 3: 在看板页面集成模板和 WIP**

1. 新建任务时显示模板选择按钮
2. 选择模板后自动填充表单（类型、标签）
3. 列头显示 `当前数 / 上限`
4. 拖拽时检查 WIP，超限弹出确认

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/pages/kanban/utils/task-templates.ts
git add packages/client/src/pages/kanban/components/wip-limits.tsx
git add packages/client/src/pages/kanban/index.tsx
git commit -m "feat(kanban): 添加任务模板和 WIP 限制功能"
```

---

### Task 18: 批量操作与快捷键

**Files:**
- Create: `packages/client/src/pages/kanban/components/batch-actions.tsx`
- Create: `packages/client/src/pages/kanban/hooks/use-keyboard-shortcuts.ts`

- [ ] **Step 1: 创建批量操作组件**

底部浮动操作栏，选中任务后显示。支持批量修改状态/优先级/负责人/删除。

后端 API 在 `routes/tasks.ts` 中添加：

```typescript
router.patch('/batch', (req, res) => {
  const { taskIds, updates } = req.body;
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return res.status(400).json({ error: '必须指定 taskIds' });
  }

  const allowedFields = ['status', 'priority', 'assigned_agent_id'];
  const setClauses: string[] = [];
  const params: unknown[] = [];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      params.push(updates[field]);
    }
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: '没有可更新的字段' });
  }

  setClauses.push('updated_at = ?');
  params.push(Date.now());

  const placeholders = taskIds.map(() => '?').join(',');
  params.push(...taskIds);

  run(
    `UPDATE tasks SET ${setClauses.join(', ')} WHERE id IN (${placeholders})`,
    params
  );

  for (const id of taskIds) {
    broadcast('task:updated', { taskId: id, action: 'batch_updated' });
  }

  res.json({ success: true, updatedCount: taskIds.length });
});
```

- [ ] **Step 2: 创建快捷键 Hook**

```typescript
import { useEffect } from 'react';

export function useKeyboardShortcuts(handlers: {
  onCreate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onViewChange?: (view: number) => void;
  onEscape?: () => void;
  onSelectAll?: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 如果焦点在输入框中，不处理
      if ((e.target as HTMLElement).tagName === 'INPUT' ||
          (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'n': handlers.onCreate?.(); break;
        case 'e': handlers.onEdit?.(); break;
        case 'Delete': handlers.onDelete?.(); break;
        case 'Escape': handlers.onEscape?.(); break;
        case '1': handlers.onViewChange?.(0); break;
        case '2': handlers.onViewChange?.(1); break;
        case '3': handlers.onViewChange?.(2); break;
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handlers.onSelectAll?.();
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlers]);
}
```

- [ ] **Step 3: 集成到看板页面**

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/pages/kanban/components/batch-actions.tsx
git add packages/client/src/pages/kanban/hooks/use-keyboard-shortcuts.ts
git add packages/client/src/pages/kanban/index.tsx
git add packages/server/src/routes/tasks.ts
git commit -m "feat(kanban): 添加批量操作和键盘快捷键支持"
```

---

### Task 19: 最终集成测试与清理

- [ ] **Step 1: 运行全项目类型检查**

Run: `cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/shared typecheck && pnpm --filter @dark-boss/server typecheck && pnpm --filter @dark-boss/client typecheck`
Expected: 全部 PASS

- [ ] **Step 2: 启动完整应用进行冒烟测试**

Run: `cd d:/AI/Projects/dark-boss && pnpm dev`

验证清单：
- [ ] 看板页面正常加载
- [ ] 三种视图切换正常（看板/列表/Agent）
- [ ] 创建带标签和类型的任务
- [ ] 拖拽任务到不同列
- [ ] 详情抽屉显示子任务和依赖
- [ ] Agent 负载概览条显示
- [ ] 通知铃铛显示未读数
- [ ] 键盘快捷键工作

- [ ] **Step 3: 代码清理 — 确保 .superpowers/ 在 .gitignore 中**

Run: `grep -q '.superpowers' d:/AI/Projects/dark-boss/.gitignore || echo '.superpowers/' >> d:/AI/Projects/dark-boss/.gitignore`

- [ ] **Step 4: Final Commit**

```bash
git add -A
git commit -m "chore: 协作看板增强完成，6 个模块全部集成"
```
