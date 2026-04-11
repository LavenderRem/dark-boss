import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/connection.js';
import { v4 as uuid } from 'uuid';
import type { CreateAgentRequest, UpdateAgentRequest } from '@dark-boss/shared';

const router = Router();

// 列出所有 Agent
router.get('/', (_req, res) => {
  try {
    const agents = queryAll('SELECT * FROM agents ORDER BY created_at DESC');
    // 解析 JSON 字段
    const parsed = agents.map(a => ({
      ...a,
      allowed_tools: typeof a.allowed_tools === 'string' ? JSON.parse(a.allowed_tools as string) : a.allowed_tools,
      mcp_servers: typeof a.mcp_servers === 'string' ? JSON.parse(a.mcp_servers as string) : a.mcp_servers,
      is_boss: !!a.is_boss,
    }));
    res.json(parsed);
  } catch (err) {
    console.error('获取 Agent 列表失败:', err);
    res.status(500).json({ error: '获取 Agent 列表失败' });
  }
});

// 获取单个 Agent
router.get('/:id', (req, res) => {
  try {
    const agent = queryOne('SELECT * FROM agents WHERE id = ?', [req.params.id]);
    if (!agent) return res.status(404).json({ error: 'Agent 不存在' });
    res.json({
      ...agent,
      allowed_tools: typeof agent.allowed_tools === 'string' ? JSON.parse(agent.allowed_tools as string) : agent.allowed_tools,
      mcp_servers: typeof agent.mcp_servers === 'string' ? JSON.parse(agent.mcp_servers as string) : agent.mcp_servers,
      is_boss: !!agent.is_boss,
    });
  } catch (err) {
    res.status(500).json({ error: '获取 Agent 失败' });
  }
});

// 创建 Agent
router.post('/', (req, res) => {
  try {
    const body = req.body as CreateAgentRequest;
    const id = uuid();
    const now = Date.now();

    run(
      `INSERT INTO agents (id, name, role, cwd, model, permission_mode, status, department_id, is_boss, custom_instructions, allowed_tools, mcp_servers, template_id, created_at, last_activity_at)
       VALUES (?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, body.name, body.role, body.cwd,
        body.model || 'sonnet', body.permissionMode || 'bypass',
        body.departmentId || null, body.isBoss ? 1 : 0,
        body.customInstructions || null,
        body.allowedTools ? JSON.stringify(body.allowedTools) : null,
        body.mcpServers ? JSON.stringify(body.mcpServers) : null,
        body.templateId || null,
        now, now,
      ]
    );

    const agent = queryOne('SELECT * FROM agents WHERE id = ?', [id]);
    res.status(201).json(agent);
  } catch (err) {
    console.error('创建 Agent 失败:', err);
    res.status(500).json({ error: '创建 Agent 失败' });
  }
});

// 更新 Agent
router.patch('/:id', (req, res) => {
  try {
    const body = req.body as UpdateAgentRequest;
    const existing = queryOne('SELECT * FROM agents WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Agent 不存在' });

    const sets: string[] = [];
    const vals: unknown[] = [];

    if (body.name) { sets.push('name = ?'); vals.push(body.name); }
    if (body.role) { sets.push('role = ?'); vals.push(body.role); }
    if (body.customInstructions !== undefined) { sets.push('custom_instructions = ?'); vals.push(body.customInstructions); }
    if (body.allowedTools) { sets.push('allowed_tools = ?'); vals.push(JSON.stringify(body.allowedTools)); }
    if (body.departmentId !== undefined) { sets.push('department_id = ?'); vals.push(body.departmentId); }
    if (body.bossAgentId !== undefined) { sets.push('boss_agent_id = ?'); vals.push(body.bossAgentId); }

    sets.push('last_activity_at = ?');
    vals.push(Date.now());
    vals.push(req.params.id);

    run(`UPDATE agents SET ${sets.join(', ')} WHERE id = ?`, vals);

    const updated = queryOne('SELECT * FROM agents WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '更新 Agent 失败' });
  }
});

// 删除 Agent
router.delete('/:id', (req, res) => {
  try {
    const agent = queryOne('SELECT * FROM agents WHERE id = ?', [req.params.id]);
    if (!agent) return res.status(404).json({ error: 'Agent 不存在' });
    if (agent.status === 'working') return res.status(400).json({ error: 'Agent 正在工作中，请先停止' });
    run('DELETE FROM agents WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除 Agent 失败' });
  }
});

// 获取 Agent 事件日志
router.get('/:id/events', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const events = queryAll(
      'SELECT * FROM agent_events WHERE agent_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.params.id, limit, offset]
    );
    const total = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM agent_events WHERE agent_id = ?',
      [req.params.id]
    );
    res.json({ events, total: total?.count || 0 });
  } catch (err) {
    res.status(500).json({ error: '获取事件日志失败' });
  }
});

export default router;
