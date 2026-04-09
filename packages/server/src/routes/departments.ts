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

export default router;
