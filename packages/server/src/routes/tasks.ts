import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/connection.js';
import { broadcast } from '../ws/connection.js';
import { v4 as uuid } from 'uuid';

const router = Router();

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
      `INSERT INTO tasks (id, title, description, status, priority, assigned_agent_id, department_id, workflow_id, estimated_minutes, due_at, column_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, body.title, body.description || null,
        body.status || 'todo', body.priority || 'medium',
        body.assignedAgentId || null, body.departmentId || null,
        body.workflowId || null, body.estimatedMinutes || null,
        body.dueAt || null,
        now, now, now,
      ]
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
    if (req.body.dueAt !== undefined) { sets.push('due_at = ?'); vals.push(req.body.dueAt); }

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
    const task = queryOne('SELECT id FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) return res.status(404).json({ error: '任务不存在' });

    const agent = queryOne('SELECT id FROM agents WHERE id = ?', [req.params.agentId]);
    if (!agent) return res.status(404).json({ error: 'Agent 不存在' });

    run('UPDATE tasks SET assigned_agent_id = ?, updated_at = ? WHERE id = ?', [req.params.agentId, Date.now(), req.params.id]);

    const updated = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    broadcast('task:updated', { taskId: req.params.id, action: 'assigned' });
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

export default router;
