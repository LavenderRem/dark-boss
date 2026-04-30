import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/connection.js';
import { v4 as uuid } from 'uuid';
import type { CreateAgentRequest, UpdateAgentRequest } from '@dark-boss/shared';
import { invalidateAgentDirs } from './files.js';

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
       VALUES (?, ?, ?, ?, ?, ?, 'offline', ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    // 新 Agent 可能有新的工作目录，刷新文件浏览允许列表
    invalidateAgentDirs();
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

// 获取 Agent 会话历史
router.get('/:id/sessions', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const sessions = queryAll(
      'SELECT * FROM agent_sessions WHERE agent_id = ? ORDER BY updated_at DESC LIMIT ?',
      [req.params.id, limit]
    );
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: '获取会话历史失败' });
  }
});

// 恢复 Agent 会话
router.post('/:id/sessions/:sessionId/restore', (req, res) => {
  try {
    const session = queryOne(
      'SELECT * FROM agent_sessions WHERE agent_id = ? AND session_id = ?',
      [req.params.id, req.params.sessionId]
    );
    if (!session) return res.status(404).json({ error: '会话不存在' });

    // 更新会话状态为活跃
    run(
      "UPDATE agent_sessions SET status = 'active', updated_at = ? WHERE id = ?",
      [Date.now(), session.id]
    );

    res.json({ success: true, sessionId: req.params.sessionId });
  } catch (err) {
    res.status(500).json({ error: '恢复会话失败' });
  }
});

// 获取 Agent 上下文使用详情
router.get('/:id/context', (req, res) => {
  try {
    const agent = queryOne<{ id: string; model: string; tokens_used: number }>(
      'SELECT id, model, tokens_used FROM agents WHERE id = ?',
      [req.params.id]
    );
    if (!agent) return res.status(404).json({ error: 'Agent 不存在' });

    // 获取当前活跃会话
    const activeSession = queryOne<{ session_id: string; token_count: number; created_at: number }>(
      "SELECT session_id, token_count, created_at FROM agent_sessions WHERE agent_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1",
      [req.params.id]
    );

    // 模型上下文窗口大小
    const contextLimits: Record<string, number> = {
      sonnet: 200000,
      opus: 200000,
      haiku: 200000,
    };
    const maxTokens = contextLimits[agent.model] || 200000;
    const usedTokens = activeSession?.token_count || 0;
    const usagePercent = maxTokens > 0 ? Math.min((usedTokens / maxTokens) * 100, 100) : 0;

    res.json({
      agentId: agent.id,
      model: agent.model,
      maxTokens,
      usedTokens,
      usagePercent: Math.round(usagePercent * 10) / 10,
      status: usagePercent < 60 ? 'green' : usagePercent < 80 ? 'yellow' : 'red',
      sessionId: activeSession?.session_id || null,
      totalTokensUsed: agent.tokens_used,
    });
  } catch (err) {
    res.status(500).json({ error: '获取上下文信息失败' });
  }
});

export default router;
