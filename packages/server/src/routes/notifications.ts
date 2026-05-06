import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/connection.js';

const router = Router();

interface Notification {
  id: string;
  type: string;
  task_id: string | null;
  agent_id: string | null;
  message: string;
  detail: string | null;
  read: number;
  created_at: number;
}

// 获取通知列表
router.get('/', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const notifications = queryAll<Notification>(
      `SELECT * FROM notifications
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );

    res.json(notifications);
  } catch (err) {
    console.error('获取通知列表失败:', err);
    res.status(500).json({ error: '获取通知列表失败' });
  }
});

// 标记单个通知为已读
router.patch('/:id/read', (req, res) => {
  try {
    const existing = queryOne('SELECT id FROM notifications WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '通知不存在' });
    }

    run('UPDATE notifications SET read = 1 WHERE id = ?', [req.params.id]);

    const updated = queryOne<Notification>('SELECT * FROM notifications WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('标记通知已读失败:', err);
    res.status(500).json({ error: '标记通知已读失败' });
  }
});

// 全部标记为已读
router.post('/read-all', (_req, res) => {
  try {
    const now = Date.now();
    run('UPDATE notifications SET read = 1 WHERE read = 0');

    const unreadCount = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM notifications WHERE read = 0'
    );

    res.json({
      success: true,
      unreadCount: unreadCount?.count || 0,
      timestamp: now,
    });
  } catch (err) {
    console.error('批量标记已读失败:', err);
    res.status(500).json({ error: '批量标记已读失败' });
  }
});

// 获取未读数量
router.get('/unread-count', (_req, res) => {
  try {
    const result = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM notifications WHERE read = 0'
    );

    res.json({ count: result?.count || 0 });
  } catch (err) {
    console.error('获取未读数量失败:', err);
    res.status(500).json({ error: '获取未读数量失败' });
  }
});

export default router;
