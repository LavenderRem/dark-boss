import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/connection.js';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/', (_req, res) => {
  try {
    const depts = queryAll('SELECT * FROM departments ORDER BY sort_order, created_at');
    res.json(depts);
  } catch (err) {
    res.status(500).json({ error: '获取部门列表失败' });
  }
});

router.post('/', (req, res) => {
  try {
    const id = uuid();
    const now = Date.now();
    run(
      'INSERT INTO departments (id, name, description, parent_id, head_agent_id, color, icon, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.body.name, req.body.description || null, req.body.parentId || null, req.body.headAgentId || null, req.body.color || '#1890ff', req.body.icon || null, req.body.sortOrder || 0, now, now]
    );
    const dept = queryOne('SELECT * FROM departments WHERE id = ?', [id]);
    res.status(201).json(dept);
  } catch (err) {
    res.status(500).json({ error: '创建部门失败' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM departments WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除部门失败' });
  }
});

// 更新部门
router.patch('/:id', (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM departments WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '部门不存在' });

    const sets: string[] = [];
    const vals: unknown[] = [];

    if (req.body.name !== undefined) { sets.push('name = ?'); vals.push(req.body.name); }
    if (req.body.description !== undefined) { sets.push('description = ?'); vals.push(req.body.description); }
    if (req.body.color !== undefined) { sets.push('color = ?'); vals.push(req.body.color); }
    if (req.body.icon !== undefined) { sets.push('icon = ?'); vals.push(req.body.icon); }
    if (req.body.headAgentId !== undefined) { sets.push('head_agent_id = ?'); vals.push(req.body.headAgentId); }
    if (req.body.sortOrder !== undefined) { sets.push('sort_order = ?'); vals.push(req.body.sortOrder); }

    sets.push('updated_at = ?');
    vals.push(Date.now());
    vals.push(req.params.id);

    run(`UPDATE departments SET ${sets.join(', ')} WHERE id = ?`, vals);
    const updated = queryOne('SELECT * FROM departments WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '更新部门失败' });
  }
});

// 移动部门（更改父级）
router.post('/:id/move', (req, res) => {
  try {
    const { parentId, sortOrder } = req.body as { parentId: string | null; sortOrder?: number };
    const existing = queryOne('SELECT id FROM departments WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '部门不存在' });

    // 防止循环引用
    if (parentId === req.params.id) return res.status(400).json({ error: '不能将自己设为父级' });

    run(
      'UPDATE departments SET parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?',
      [parentId || null, sortOrder || 0, Date.now(), req.params.id]
    );

    const updated = queryOne('SELECT * FROM departments WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '移动部门失败' });
  }
});

export default router;
