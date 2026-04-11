import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/connection.js';
import { v4 as uuid } from 'uuid';
import type { CreateWorkflowRequest, UpdateWorkflowRequest, WorkflowNode, WorkflowEdge } from '@dark-boss/shared';

const router = Router();

// 列出所有工作流
router.get('/', (_req, res) => {
  try {
    const rows = queryAll('SELECT * FROM workflows ORDER BY updated_at DESC');
    const workflows = rows.map(r => ({
      ...r,
      nodes: typeof r.nodes === 'string' ? JSON.parse(r.nodes) : r.nodes,
      edges: typeof r.edges === 'string' ? JSON.parse(r.edges) : r.edges,
      variables: typeof r.variables === 'string' ? JSON.parse(r.variables) : r.variables,
    }));
    res.json(workflows);
  } catch (err) {
    console.error('获取工作流列表失败:', err);
    res.status(500).json({ error: '获取工作流列表失败' });
  }
});

// 获取单个工作流
router.get('/:id', (req, res) => {
  try {
    const row = queryOne('SELECT * FROM workflows WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: '工作流不存在' });
    res.json({
      ...row,
      nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes,
      edges: typeof row.edges === 'string' ? JSON.parse(row.edges) : row.edges,
      variables: typeof row.variables === 'string' ? JSON.parse(row.variables) : row.variables,
    });
  } catch (err) {
    res.status(500).json({ error: '获取工作流失败' });
  }
});

// 创建工作流
router.post('/', (req, res) => {
  try {
    const body = req.body as CreateWorkflowRequest;
    const id = uuid();
    const now = Date.now();

    run(
      `INSERT INTO workflows (id, name, description, status, nodes, edges, department_id, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', '[]', '[]', ?, ?, ?)`,
      [id, body.name, body.description || null, body.departmentId || null, now, now]
    );

    const workflow = queryOne('SELECT * FROM workflows WHERE id = ?', [id]);
    res.status(201).json({
      ...workflow,
      nodes: JSON.parse(workflow.nodes as string || '[]'),
      edges: JSON.parse(workflow.edges as string || '[]'),
    });
  } catch (err) {
    console.error('创建工作流失败:', err);
    res.status(500).json({ error: '创建工作流失败' });
  }
});

// 更新工作流（保存画布）
router.patch('/:id', (req, res) => {
  try {
    const body = req.body as UpdateWorkflowRequest;
    const existing = queryOne('SELECT * FROM workflows WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '工作流不存在' });

    const sets: string[] = [];
    const vals: unknown[] = [];

    if (body.name !== undefined) { sets.push('name = ?'); vals.push(body.name); }
    if (body.description !== undefined) { sets.push('description = ?'); vals.push(body.description); }
    if (body.nodes !== undefined) { sets.push('nodes = ?'); vals.push(JSON.stringify(body.nodes)); }
    if (body.edges !== undefined) { sets.push('edges = ?'); vals.push(JSON.stringify(body.edges)); }
    if (body.departmentId !== undefined) { sets.push('department_id = ?'); vals.push(body.departmentId); }

    sets.push('updated_at = ?');
    vals.push(Date.now());
    vals.push(req.params.id);

    run(`UPDATE workflows SET ${sets.join(', ')} WHERE id = ?`, vals);

    const updated = queryOne('SELECT * FROM workflows WHERE id = ?', [req.params.id]);
    res.json({
      ...updated,
      nodes: JSON.parse(updated.nodes as string || '[]'),
      edges: JSON.parse(updated.edges as string || '[]'),
    });
  } catch (err) {
    res.status(500).json({ error: '更新工作流失败' });
  }
});

// 删除工作流
router.delete('/:id', (req, res) => {
  try {
    const existing = queryOne('SELECT id, status FROM workflows WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '工作流不存在' });
    if (existing.status === 'running') return res.status(400).json({ error: '工作流正在运行中，无法删除' });
    run('DELETE FROM workflows WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除工作流失败' });
  }
});

// 执行工作流
router.post('/:id/execute', async (req, res) => {
  try {
    const existing = queryOne('SELECT id, status, nodes FROM workflows WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '工作流不存在' });
    if (existing.status === 'running') return res.status(400).json({ error: '工作流正在运行中' });

    const nodes = typeof existing.nodes === 'string' ? JSON.parse(existing.nodes) : existing.nodes;
    if (!nodes || nodes.length === 0) return res.status(400).json({ error: '工作流没有节点，请先添加节点' });

    // 异步执行，立即返回
    const { executeWorkflow } = await import('../services/workflow-engine.js');
    executeWorkflow(req.params.id).catch(err => {
      console.error('工作流执行失败:', err);
    });

    res.json({ success: true, message: '工作流开始执行' });
  } catch (err) {
    console.error('启动工作流失败:', err);
    res.status(500).json({ error: '启动工作流失败' });
  }
});

export default router;
