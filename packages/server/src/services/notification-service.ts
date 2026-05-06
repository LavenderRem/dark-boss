import { v4 as uuid } from 'uuid';
import { getDb, queryAll } from '../db/connection.js';
import { broadcast } from '../ws/connection.js';

export interface CreateNotificationParams {
  type: string;
  taskId?: string;
  agentId?: string;
  message: string;
  detail?: string;
}

/**
 * 创建通知并广播 WebSocket 事件
 */
export function createNotification(params: CreateNotificationParams) {
  const db = getDb();
  const id = uuid();
  const now = Date.now();

  db.run(
    `INSERT INTO notifications (id, type, task_id, agent_id, message, detail, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, params.type, params.taskId || null, params.agentId || null, params.message, params.detail || null, 0, now]
  );

  // 广播通知事件
  broadcast('notification:new', {
    id,
    type: params.type,
    taskId: params.taskId,
    agentId: params.agentId,
    message: params.message,
    detail: params.detail,
    read: false,
    createdAt: now,
  });
}

/**
 * 定时检查逾期任务
 * 查找 due_at < now + 30min 且状态不是 done/cancelled 的任务
 * 避免在 30 分钟内重复通知同一任务
 */
export function checkOverdueTasks() {
  const now = Date.now();
  const thirtyMinutes = 30 * 60 * 1000;
  const notificationThreshold = now + thirtyMinutes;

  // 查找即将到期或已逾期且未完成的任务
  const tasks = queryAll(
    `SELECT * FROM tasks
     WHERE due_at IS NOT NULL
     AND due_at < ?
     AND status NOT IN ('done', 'cancelled')
     ORDER BY due_at ASC`,
    [notificationThreshold]
  );

  for (const task of tasks) {
    const dueAt = task.due_at as number;
    const isOverdue = dueAt < now;

    // 检查是否在 30 分钟内已经发送过通知
    const recentNotification = queryAll(
      `SELECT * FROM notifications
       WHERE task_id = ?
       AND type = ?
       AND created_at > ?`,
      [task.id, isOverdue ? 'task_overdue' : 'task_due_soon', now - thirtyMinutes]
    );

    if (recentNotification.length > 0) {
      continue; // 已在 30 分钟内通知过，跳过
    }

    // 创建通知
    const message = isOverdue
      ? `任务 "${task.title}" 已逾期`
      : `任务 "${task.title}" 即将到期`;

    createNotification({
      type: isOverdue ? 'task_overdue' : 'task_due_soon',
      taskId: task.id as string,
      agentId: (task.assigned_agent_id as string | undefined) || undefined,
      message,
      detail: isOverdue
        ? `任务已于 ${new Date(dueAt).toLocaleString('zh-CN')} 到期，请尽快处理`
        : `任务将于 ${new Date(dueAt).toLocaleString('zh-CN')} 到期`,
    });
  }
}
