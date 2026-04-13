import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/connection.js';
import { v4 as uuid } from 'uuid';
import { handleAgentMention } from '../services/chat-agent-service.js';

const router = Router();

// 列出频道
router.get('/channels', (_req, res) => {
  try {
    const channels = queryAll('SELECT * FROM chat_channels ORDER BY created_at DESC');
    const parsed = channels.map(c => ({
      ...c,
      participant_agent_ids: typeof c.participant_agent_ids === 'string' ? JSON.parse(c.participant_agent_ids) : c.participant_agent_ids,
    }));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: '获取频道列表失败' });
  }
});

// 创建频道
router.post('/channels', (req, res) => {
  try {
    const id = uuid();
    const now = Date.now();
    run(
      'INSERT INTO chat_channels (id, name, type, department_id, participant_agent_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        id, req.body.name, req.body.type || 'team',
        req.body.departmentId || null,
        req.body.participantAgentIds ? JSON.stringify(req.body.participantAgentIds) : null,
        now,
      ]
    );
    const channel = queryOne('SELECT * FROM chat_channels WHERE id = ?', [id]);
    res.status(201).json(channel);
  } catch (err) {
    res.status(500).json({ error: '创建频道失败' });
  }
});

// 获取频道消息（分页）
router.get('/channels/:id/messages', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string | undefined;

    let sql = 'SELECT * FROM chat_messages WHERE channel_id = ?';
    const params: unknown[] = [req.params.id];

    if (before) {
      sql += ' AND created_at < ?';
      params.push(parseInt(before));
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const messages = queryAll(sql, params);
    // 反转为正序
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: '获取消息失败' });
  }
});

// 发送消息
router.post('/channels/:id/messages', async (req, res) => {
  try {
    const id = uuid();
    const now = Date.now();
    const { content, senderType = 'user', senderAgentId, mentionsAgentIds, messageType = 'text' } = req.body;

    if (!content) return res.status(400).json({ error: '消息内容不能为空' });

    run(
      `INSERT INTO chat_messages (id, channel_id, sender_type, sender_agent_id, content, mentions_agent_ids, message_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, req.params.id, senderType, senderAgentId || null,
        content,
        mentionsAgentIds ? JSON.stringify(mentionsAgentIds) : null,
        messageType, now,
      ]
    );

    const message = queryOne('SELECT * FROM chat_messages WHERE id = ?', [id]);

    // 广播消息
    const { broadcast } = await import('../ws/connection.js');
    broadcast('chat:message', {
      channelId: req.params.id,
      messageId: id,
      senderType,
      senderAgentId: senderAgentId || null,
      content,
      messageType,
    });

    // 异步触发 Agent 回复（不阻塞 HTTP 响应）
    if (mentionsAgentIds && mentionsAgentIds.length > 0) {
      handleAgentMention(req.params.id, mentionsAgentIds, content);
    }

    res.status(201).json(message);
  } catch (err) {
    console.error('发送消息失败:', err);
    res.status(500).json({ error: '发送消息失败' });
  }
});

export default router;
