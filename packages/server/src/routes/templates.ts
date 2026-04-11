import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/connection.js';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/', (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const templates = category
      ? queryAll('SELECT * FROM templates WHERE category = ?', [category])
      : queryAll('SELECT * FROM templates ORDER BY install_count DESC');
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: '获取模板列表失败' });
  }
});

router.post('/:id/install', (req, res) => {
  try {
    const template = queryOne('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (!template) return res.status(404).json({ error: '模板不存在' });

    const { cwd, name, model, departmentId } = req.body as {
      cwd: string;
      name?: string;
      model?: 'sonnet' | 'opus' | 'haiku';
      departmentId?: string;
    };
    if (!cwd) return res.status(400).json({ error: '必须指定工作目录 (cwd)' });

    const agentId = uuid();
    const now = Date.now();
    const agentModel = model || template.model || 'sonnet';

    run(
      `INSERT INTO agents (id, name, role, cwd, model, permission_mode, status, custom_instructions, allowed_tools, mcp_servers, template_id, department_id, created_at, last_activity_at)
       VALUES (?, ?, ?, ?, ?, 'bypass', 'idle', ?, ?, ?, ?, ?, ?, ?)`,
      [agentId, name || template.name, template.role, cwd, agentModel,
        template.custom_instructions, template.allowed_tools, template.mcp_servers,
        template.id, departmentId || null, now, now]
    );

    run('UPDATE templates SET install_count = install_count + 1 WHERE id = ?', [template.id]);

    const agent = queryOne('SELECT * FROM agents WHERE id = ?', [agentId]);
    res.status(201).json(agent);
  } catch (err) {
    console.error('安装模板失败:', err);
    res.status(500).json({ error: '安装模板失败' });
  }
});

// 模板评分
router.post('/:id/rate', (req, res) => {
  try {
    const { score } = req.body as { score: number };
    if (!score || score < 1 || score > 5) return res.status(400).json({ error: '评分必须在 1-5 之间' });

    const template = queryOne<{ id: string; rating: number }>('SELECT id, rating FROM templates WHERE id = ?', [req.params.id]);
    if (!template) return res.status(404).json({ error: '模板不存在' });

    // 简单加权平均：新评分 = (旧评分 * 0.7 + 新评分 * 0.3)，保留 1 位小数
    const newRating = template.rating > 0
      ? Math.round((template.rating * 0.7 + score * 0.3) * 10) / 10
      : score;

    run('UPDATE templates SET rating = ?, updated_at = ? WHERE id = ?', [newRating, Date.now(), req.params.id]);

    res.json({ rating: newRating });
  } catch (err) {
    res.status(500).json({ error: '评分失败' });
  }
});

export default router;
