import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/connection.js';
import { broadcast } from '../ws/connection.js';
import { v4 as uuid } from 'uuid';
import { createNotification } from '../services/notification-service.js';

const router = Router();

// 批量更新任务（放在 /:id 之前避免路由冲突）
router.patch('/batch', (req, res) => {
  try {
    const { taskIds, updates } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: '必须指定 taskIds' });
    }

    const allowedFields = ['status', 'priority', 'assigned_agent_id'];
    const setClauses: string[] = [];
    const params: unknown[] = [];

    for (const field of allowedFields) {
      const key = field === 'assigned_agent_id' ? 'assignedAgentId' : field;
      if (updates[key] !== undefined) {
        setClauses.push(`${field} = ?`);
        params.push(updates[key]);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: '没有可更新的字段' });
    }

    setClauses.push('updated_at = ?');
    params.push(Date.now());

    const placeholders = taskIds.map(() => '?').join(',');
    params.push(...taskIds);

    run(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id IN (${placeholders})`, params);

    for (const id of taskIds) {
      broadcast('task:updated', { taskId: id, action: 'batch_updated' });
    }

    res.json({ success: true, updatedCount: taskIds.length });
  } catch (err) {
    console.error('批量更新任务失败:', err);
    res.status(500).json({ error: '批量更新任务失败' });
  }
});

// 按工作流查询关联任务（放在 /:id 之前避免路由冲突）
router.get('/by-workflow/:workflowId', (req, res) => {
  try {
    const tasks = queryAll(
      'SELECT * FROM tasks WHERE workflow_id = ? ORDER BY created_at ASC',
      [req.params.workflowId]
    );
    res.json(tasks);
  } catch (err) {
    console.error('查询工作流任务失败:', err);
    res.status(500).json({ error: '查询工作流任务失败' });
  }
});

// 列出任务（支持按状态和部门筛选）
router.get('/', (req, res) => {
  try {
    const { status, department_id } = req.query;
    let sql = 'SELECT * FROM tasks';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (department_id) {
      conditions.push('department_id = ?');
      params.push(department_id);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY status, column_order, created_at DESC';

    const tasks = queryAll(sql, params);
    res.json(tasks);
  } catch (err) {
    console.error('获取任务列表失败:', err);
    res.status(500).json({ error: '获取任务列表失败' });
  }
});

// 获取单个任务
router.get('/:id', (req, res) => {
  try {
    const task = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) return res.status(404).json({ error: '任务不存在' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: '获取任务失败' });
  }
});

// 创建任务
router.post('/', (req, res) => {
  try {
    const id = uuid();
    const now = Date.now();
    const body = req.body;

    run(
      `INSERT INTO tasks (id, title, description, status, priority, assigned_agent_id, department_id, workflow_id, estimated_minutes, due_at, column_order, parent_task_id, task_type, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, body.title, body.description || null,
        body.status || 'todo', body.priority || 'medium',
        body.assignedAgentId || null, body.departmentId || null,
        body.workflowId || null, body.estimatedMinutes || null,
        body.dueAt || null, now,
        body.parentTaskId || null,
        body.taskType || 'task',
        body.tags ? JSON.stringify(body.tags) : null,
        now, now,
      ]
    );

    // 创建任务事件
    run(
      `INSERT INTO task_events (id, task_id, event_type, agent_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuid(), id, 'task_created', body.assignedAgentId || null, JSON.stringify({ status: body.status || 'todo' }), now]
    );

    const task = queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
    broadcast('task:updated', { taskId: id, action: 'created' });
    res.status(201).json(task);
  } catch (err) {
    console.error('创建任务失败:', err);
    res.status(500).json({ error: '创建任务失败' });
  }
});

// 更新任务
router.patch('/:id', (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '任务不存在' });

    const sets: string[] = [];
    const vals: unknown[] = [];

    if (req.body.title !== undefined) { sets.push('title = ?'); vals.push(req.body.title); }
    if (req.body.description !== undefined) { sets.push('description = ?'); vals.push(req.body.description); }
    if (req.body.status !== undefined) { sets.push('status = ?'); vals.push(req.body.status); }
    if (req.body.priority !== undefined) { sets.push('priority = ?'); vals.push(req.body.priority); }
    if (req.body.assignedAgentId !== undefined) { sets.push('assigned_agent_id = ?'); vals.push(req.body.assignedAgentId); }
    if (req.body.workflowNodeId !== undefined) { sets.push('workflow_node_id = ?'); vals.push(req.body.workflowNodeId); }
    if (req.body.dueAt !== undefined) { sets.push('due_at = ?'); vals.push(req.body.dueAt); }
    if (req.body.tags !== undefined) { sets.push('tags = ?'); vals.push(req.body.tags !== null ? JSON.stringify(req.body.tags) : null); }
    if (req.body.taskType !== undefined) { sets.push('task_type = ?'); vals.push(req.body.taskType); }

    sets.push('updated_at = ?');
    vals.push(Date.now());
    vals.push(req.params.id);

    run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, vals);

    const updated = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    broadcast('task:updated', { taskId: req.params.id, action: 'updated' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '更新任务失败' });
  }
});

// 移动任务（看板拖拽）
router.patch('/:id/move', (req, res) => {
  try {
    const { status, columnOrder } = req.body as { status: string; columnOrder: number };
    if (!status) return res.status(400).json({ error: '必须指定目标状态' });

    const existing = queryOne('SELECT id, status FROM tasks WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '任务不存在' });

    const now = Date.now();
    const updates: string[] = ['status = ?', 'column_order = ?', 'updated_at = ?'];
    const vals: unknown[] = [status, columnOrder ?? now, now];

    // 自动设置 startedAt
    if (status === 'in_progress' && existing.status !== 'in_progress') {
      updates.push('started_at = ?');
      vals.push(now);
    }
    // 自动设置 completedAt
    if (status === 'done' && existing.status !== 'done') {
      updates.push('completed_at = ?');
      vals.push(now);
    }

    vals.push(req.params.id);
    run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, vals);

    const updated = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    broadcast('task:updated', { taskId: req.params.id, action: 'moved', status });

    // 如果任务标记为完成，发送通知
    if (status === 'done' && existing.status !== 'done') {
      const task = queryOne('SELECT id, title, assigned_agent_id FROM tasks WHERE id = ?', [req.params.id]);
      if (task && task.assigned_agent_id) {
        createNotification({
          type: 'task_completed',
          taskId: req.params.id,
          agentId: task.assigned_agent_id as string,
          message: `任务已完成：${task.title}`,
          detail: '恭喜！任务已成功完成',
        });
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '移动任务失败' });
  }
});

// Agent 拉取下一个任务并执行（放在 /:id 之前避免路由冲突）
router.post('/agent/:agentId/pull-task', async (req, res) => {
  try {
    const agent = queryOne('SELECT id FROM agents WHERE id = ?', [req.params.agentId]);
    if (!agent) return res.status(404).json({ error: 'Agent 不存在' });

    const { pullAndExecuteTask } = await import('../services/task-executor.js');
    const taskId = await pullAndExecuteTask(req.params.agentId);

    if (!taskId) {
      return res.json({ success: true, message: '没有待办任务', taskId: null });
    }
    res.json({ success: true, message: '已拉取任务并开始执行', taskId });
  } catch (err) {
    console.error('拉取任务失败:', err);
    res.status(500).json({ error: '拉取任务失败' });
  }
});

// 分配任务给 Agent
router.post('/:id/assign/:agentId', (req, res) => {
  try {
    const task = queryOne('SELECT id, title FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) return res.status(404).json({ error: '任务不存在' });

    const agent = queryOne('SELECT id, name FROM agents WHERE id = ?', [req.params.agentId]);
    if (!agent) return res.status(404).json({ error: 'Agent 不存在' });

    run('UPDATE tasks SET assigned_agent_id = ?, updated_at = ? WHERE id = ?', [req.params.agentId, Date.now(), req.params.id]);

    const updated = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    broadcast('task:updated', { taskId: req.params.id, action: 'assigned' });

    // 创建任务分配通知
    createNotification({
      type: 'task_assigned',
      taskId: req.params.id,
      agentId: req.params.agentId,
      message: `您收到了新任务：${task.title}`,
      detail: `任务已分配给 ${agent.name}，请及时查看`,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '分配任务失败' });
  }
});

// 执行任务（手动触发）
router.post('/:id/execute', async (req, res) => {
  try {
    const existing = queryOne('SELECT id, status, assigned_agent_id FROM tasks WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '任务不存在' });
    if (existing.status === 'done') return res.status(400).json({ error: '任务已完成' });
    if (!existing.assigned_agent_id) return res.status(400).json({ error: '任务未指派给员工' });

    // 异步执行，立即返回
    const { executeTask } = await import('../services/task-executor.js');
    executeTask(req.params.id).catch(err => {
      console.error('任务执行失败:', err);
    });

    res.json({ success: true, message: '任务开始执行' });
  } catch (err) {
    console.error('启动任务执行失败:', err);
    res.status(500).json({ error: '启动任务执行失败' });
  }
});

// 删除任务
router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    broadcast('task:updated', { taskId: req.params.id, action: 'deleted' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除任务失败' });
  }
});

// Boss 委托：将任务分解并分配给团队成员
router.post('/delegate', async (req, res) => {
  try {
    const { bossAgentId, taskDescription } = req.body as {
      bossAgentId: string;
      taskDescription: string;
    };
    if (!bossAgentId || !taskDescription) {
      return res.status(400).json({ error: '必须指定 bossAgentId 和 taskDescription' });
    }

    const { delegateTask, executeDelegation } = await import('../services/boss-delegation.js');
    const result = await delegateTask(bossAgentId, taskDescription);

    // 异步执行子任务
    executeDelegation(result.parentTaskId).catch(err => {
      console.error('[Boss 委托] 子任务执行失败:', err);
    });

    res.json({
      success: true,
      parentTaskId: result.parentTaskId,
      subTaskCount: result.subTasks.length,
      subTasks: result.subTasks,
    });
  } catch (err) {
    console.error('Boss 委托失败:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Boss 委托失败' });
  }
});

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
    `INSERT OR IGNORE INTO task_dependencies (id, task_id, depends_on_id, created_at) VALUES (?, ?, ?, ?)`,
    [id, taskId, dependsOnId, now]
  );

  // 更新 blocked_by 缓存
  const deps = queryAll('SELECT depends_on_id FROM task_dependencies WHERE task_id = ?', [taskId]).map((r: any) => r.depends_on_id);
  run('UPDATE tasks SET blocked_by = ?, updated_at = ? WHERE id = ?', [JSON.stringify(deps), now, taskId]);

  broadcast('task:updated', { taskId, action: 'dependency_added', dependsOnId });
  res.status(201).json({ id, taskId, dependsOnId });
});

// 移除依赖关系
router.delete('/:id/dependencies/:depId', (req, res) => {
  const { id, depId } = req.params;
  run('DELETE FROM task_dependencies WHERE task_id = ? AND id = ?', [id, depId]);

  const now = Date.now();
  const deps = queryAll('SELECT depends_on_id FROM task_dependencies WHERE task_id = ?', [id]).map((r: any) => r.depends_on_id);
  run('UPDATE tasks SET blocked_by = ?, updated_at = ? WHERE id = ?', [JSON.stringify(deps), now, id]);

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

export default router;
