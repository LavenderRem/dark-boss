import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/connection.js';
import { v4 as uuid } from 'uuid';
import type { TaskStatus, TaskPriority } from '@dark-boss/shared';

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
        // column_order: 放到同列末尾
        now,
        now, now,
      ]
    );

    const task = queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
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
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '更新任务失败' });
  }
});

// 移动任务（看板拖拽）
router.patch('/:id/move', (req, res) => {
  try {
    const { status, columnOrder } = req.body as { status: TaskStatus; columnOrder: number };
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
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '移动任务失败' });
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
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '分配任务失败' });
  }
});

// 删除任务
router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除任务失败' });
  }
});

export default router;
