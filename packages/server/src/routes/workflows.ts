import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/connection.js';
import { v4 as uuid } from 'uuid';
import type { CreateWorkflowRequest, UpdateWorkflowRequest } from '@dark-boss/shared';

// 辅助：解析日志行中的 JSON 字段
function parseLogRow(r: Record<string, unknown>) {
  return {
    ...r,
    tokensUsed: r.tokens_used,
    cost: r.cost,
    durationMs: r.duration_ms,
    inputPreview: r.input_preview,
    outputPreview: r.output_preview,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    executionId: r.execution_id,
    nodeId: r.node_id,
    nodeType: r.node_type,
    agentId: r.agent_id,
    workflowId: r.workflow_id,
  };
}

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
    if (!workflow) return res.status(500).json({ error: '创建工作流失败' });
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
    if (!updated) return res.status(404).json({ error: '工作流不存在' });
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

    // 从请求体获取用户输入
    const { input } = req.body as { input?: string };

    // 异步执行，立即返回
    const { executeWorkflow } = await import('../services/workflow-engine.js');
    executeWorkflow(req.params.id, input || '').catch(err => {
      console.error('工作流执行失败:', err);
    });

    res.json({ success: true, message: '工作流开始执行' });
  } catch (err) {
    console.error('启动工作流失败:', err);
    res.status(500).json({ error: '启动工作流失败' });
  }
});

// 获取工作流所有执行记录列表（按 execution_id 分组）
router.get('/:id/executions', (req, res) => {
  try {
    const rows = queryAll(
      'SELECT execution_id, MIN(created_at) as started_at, MAX(completed_at) as completed_at, GROUP_CONCAT(status) as statuses FROM workflow_execution_logs WHERE workflow_id = ? GROUP BY execution_id ORDER BY started_at DESC',
      [req.params.id]
    );
    const executions = rows.map(r => ({
      executionId: r.execution_id,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      // 有任意 failed 则标记为 failed，否则看有没有 completed
      status: String(r.statuses || '').includes('failed') ? 'failed' : 'completed',
    }));
    res.json(executions);
  } catch (err) {
    res.status(500).json({ error: '获取执行记录失败' });
  }
});

// 获取最近一次执行的日志详情
router.get('/:id/executions/latest', (req, res) => {
  try {
    const row = queryOne(
      'SELECT execution_id FROM workflow_execution_logs WHERE workflow_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.params.id]
    );
    if (!row) return res.json([]);
    const logs = queryAll(
      'SELECT * FROM workflow_execution_logs WHERE execution_id = ? ORDER BY started_at ASC',
      [row.execution_id]
    );
    res.json(logs.map(parseLogRow));
  } catch (err) {
    res.status(500).json({ error: '获取执行日志失败' });
  }
});

// 获取指定执行的所有节点日志
router.get('/:id/executions/:executionId', (req, res) => {
  try {
    const logs = queryAll(
      'SELECT * FROM workflow_execution_logs WHERE workflow_id = ? AND execution_id = ? ORDER BY started_at ASC',
      [req.params.id, req.params.executionId]
    );
    res.json(logs.map(parseLogRow));
  } catch (err) {
    res.status(500).json({ error: '获取执行日志失败' });
  }
});

export default router;
