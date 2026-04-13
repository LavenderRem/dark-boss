import { Router } from 'express';
import {
  getAgentPerformanceOverview,
  getDashboardStats,
  getAgentTrend,
  getTeamTrend,
  generateReport,
} from '../services/performance-service.js';

const router = Router();

// 团队整体统计
router.get('/dashboard', (_req, res) => {
  try {
    const stats = getDashboardStats();
    res.json(stats);
  } catch (err) {
    console.error('获取团队统计失败:', err);
    res.status(500).json({ error: '获取团队统计失败' });
  }
});

// 团队趋势数据
router.get('/trend', (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const trend = getTeamTrend(days);
    res.json(trend);
  } catch (err) {
    console.error('获取团队趋势失败:', err);
    res.status(500).json({ error: '获取团队趋势失败' });
  }
});

// 所有 Agent 绩效概览
router.get('/agents', (_req, res) => {
  try {
    const overview = getAgentPerformanceOverview();
    res.json(overview);
  } catch (err) {
    console.error('获取绩效概览失败:', err);
    res.status(500).json({ error: '获取绩效概览失败' });
  }
});

// 单个 Agent 绩效详情 + 趋势
router.get('/agents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const days = parseInt(req.query.days as string) || 7;

    const overview = getAgentPerformanceOverview();
    const agentPerf = overview.find(a => a.agentId === id);
    if (!agentPerf) return res.status(404).json({ error: 'Agent 不存在' });

    const trend = getAgentTrend(id, days);

    res.json({ ...agentPerf, trend });
  } catch (err) {
    console.error('获取 Agent 绩效失败:', err);
    res.status(500).json({ error: '获取 Agent 绩效失败' });
  }
});

// 获取/生成 AI 绩效报告
router.get('/agents/:id/report', async (req, res) => {
  try {
    const { id } = req.params;
    const period = (req.query.period as 'weekly' | 'monthly') || 'weekly';

    const report = await generateReport(id, period);
    if (!report) return res.status(404).json({ error: 'Agent 不存在' });

    res.json(report);
  } catch (err) {
    console.error('生成绩效报告失败:', err);
    res.status(500).json({ error: '生成绩效报告失败' });
  }
});

export default router;
