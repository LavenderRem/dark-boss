// 任务状态（看板列）
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';

// 任务优先级
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

// 任务类型
export type TaskType = 'epic' | 'story' | 'task' | 'subtask';

// 通知类型
export type NotificationType =
  | 'task_completed'
  | 'task_overdue'
  | 'task_blocked'
  | 'task_assigned'
  | 'task_handoff'
  | 'permission_request'
  | 'task_due_soon'
  | 'agent_mentioned'
  | 'system';

// 通知
export interface Notification {
  id: string;
  type: NotificationType;
  taskId: string | null;
  agentId: string | null;
  message: string;
  detail: string | null;
  read: boolean;
  createdAt: number;
}

// 任务
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgentId: string | null;
  departmentId: string | null;
  createdByAgentId: string | null;
  workflowId: string | null;
  workflowNodeId: string | null;
  columnOrder: number;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  dueAt: Date | null;
  result: string | null;
  createdAt: Date;
  updatedAt: Date;
  parentTaskId: string | null;
  taskType: TaskType;
  tags: string[];
  blockedBy: string[];
  progress: number;
  activitySummary: string | null;
}

// 创建任务请求
export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assignedAgentId?: string;
  departmentId?: string;
  workflowId?: string;
  estimatedMinutes?: number;
  dueAt?: Date;
  parentTaskId?: string;
  taskType?: TaskType;
  tags?: string[];
}

// 移动任务请求（看板拖拽）
export interface MoveTaskRequest {
  status: TaskStatus;
  columnOrder: number;
}
