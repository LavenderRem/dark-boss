// 任务状态（看板列）
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';

// 任务优先级
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

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
}

// 移动任务请求（看板拖拽）
export interface MoveTaskRequest {
  status: TaskStatus;
  columnOrder: number;
}
