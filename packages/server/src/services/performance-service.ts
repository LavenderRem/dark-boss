import { queryAll, queryOne, run } from '../db/connection.js';
import { v4 as uuid } from 'uuid';
import { singleQuery, isSdkAvailable } from './claude-client.js';

// 计算单个 Agent 的绩效指标
export function calculateAgentMetrics(agentId: string, periodStart: number, periodEnd: number) {
  // 已完成任务
  const completedTasks = queryAll<{
    id: string;
    started_at: number;
    completed_at: number;
    estimated_minutes: number | null;
    actual_minutes: number | null;
  }>(
    `SELECT id, started_at, completed_at, estimated_minutes, actual_minutes
     FROM tasks
     WHERE assigned_agent_id = ? AND status = 'done'
       AND completed_at >= ? AND completed_at <= ?`,
    [agentId, periodStart, periodEnd]
  );

  // 失败/取消的任务
  const failedTasks = queryAll<{ id: string }>(
    `SELECT id FROM tasks
     WHERE assigned_agent_id = ? AND status = 'cancelled'
       AND updated_at >= ? AND updated_at <= ?`,
    [agentId, periodStart, periodEnd]
  );

  // 进行中的任务
  const inProgressTasks = queryAll<{ id: string }>(
    `SELECT id FROM tasks
     WHERE assigned_agent_id = ? AND status IN ('in_progress', 'review')
       AND updated_at >= ? AND updated_at <= ?`,
    [agentId, periodStart, periodEnd]
  );

  // Token 和费用（从 agent 表获取累计值，用期间差值）
  const agent = queryOne<{ tokens_used: number; total_cost: number }>(
    'SELECT tokens_used, total_cost FROM agents WHERE id = ?',
    [agentId]
  );

  // 平均完成时间（分钟）
  let avgCompletionMinutes: number | null = null;
  if (completedTasks.length > 0) {
    const validDurations = completedTasks
      .filter(t => t.started_at && t.completed_at)
      .map(t => (t.completed_at - t.started_at) / 60000);
    if (validDurations.length > 0) {
      avgCompletionMinutes = validDurations.reduce((a, b) => a + b, 0) / validDurations.length;
    }
  }

  const tasksCompleted = completedTasks.length;
  const tasksFailed = failedTasks.length;
  const tokensUsed = agent?.tokens_used || 0;
  const totalCost = agent?.total_cost || 0;

  // 效率评分算法（0-100）
  let efficiencyScore: number | null = null;
  if (tasksCompleted > 0 || tasksFailed > 0) {
    const completionRate = tasksCompleted / (tasksCompleted + tasksFailed + inProgressTasks.length);
    const speedScore = avgCompletionMinutes !== null
      ? Math.max(0, 100 - avgCompletionMinutes) // 越快分越高
      : 50;
    efficiencyScore = Math.round(completionRate * 60 + speedScore * 0.4);
    efficiencyScore = Math.max(0, Math.min(100, efficiencyScore));
  }

  return {
    tasksCompleted,
    tasksFailed,
    avgCompletionMinutes,
    tokensUsed,
    totalCost,
    efficiencyScore,
  };
}

// 为所有活跃 Agent 生成每日快照
export function snapshotAll() {
  const now = Date.now();
  const dayStart = new Date(now).setHours(0, 0, 0, 0);
  const agents = queryAll<{ id: string; status: string }>(
    "SELECT id, status FROM agents WHERE status != 'offline'"
  );

  let count = 0;
  for (const agent of agents) {
    // 检查今天是否已有快照
    const existing = queryOne<{ id: string }>(
      `SELECT id FROM performance_snapshots
       WHERE agent_id = ? AND period = 'daily' AND period_start = ?`,
      [agent.id, dayStart]
    );
    if (existing) continue;

    const metrics = calculateAgentMetrics(agent.id, dayStart, now);

    run(
      `INSERT INTO performance_snapshots
       (id, agent_id, period, period_start, period_end, tasks_completed, tasks_failed,
        avg_completion_minutes, tokens_used, total_cost, efficiency_score, created_at)
       VALUES (?, ?, 'daily', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), agent.id, dayStart, now, metrics.tasksCompleted, metrics.tasksFailed,
        metrics.avgCompletionMinutes, metrics.tokensUsed, metrics.totalCost,
        metrics.efficiencyScore, now]
    );
    count++;
  }

  if (count > 0) {
    console.log(`[绩效] 已生成 ${count} 个 Agent 每日快照`);
  }
}

// 获取所有 Agent 绩效概览
export function getAgentPerformanceOverview() {
  const agents = queryAll<{
    id: string;
    name: string;
    role: string;
    status: string;
    tokens_used: number;
    total_cost: number;
    department_id: string | null;
  }>('SELECT id, name, role, status, tokens_used, total_cost, department_id FROM agents');

  return agents.map(agent => {
    // 部门名称
    let departmentName: string | null = null;
    if (agent.department_id) {
      const dept = queryOne<{ name: string }>(
        'SELECT name FROM departments WHERE id = ?',
        [agent.department_id]
      );
      departmentName = dept?.name || null;
    }

    // 总完成任务
    const completedResult = queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM tasks WHERE assigned_agent_id = ? AND status = 'done'",
      [agent.id]
    );

    // 进行中任务
    const inProgressResult = queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM tasks WHERE assigned_agent_id = ? AND status IN ('in_progress', 'review')",
      [agent.id]
    );

    // 失败任务
    const failedResult = queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM tasks WHERE assigned_agent_id = ? AND status = 'cancelled'",
      [agent.id]
    );

    // 平均完成时间
    const avgResult = queryOne<{ avg: number | null }>(
      `SELECT AVG((completed_at - started_at) / 60000.0) as avg
       FROM tasks
       WHERE assigned_agent_id = ? AND status = 'done' AND started_at IS NOT NULL AND completed_at IS NOT NULL`,
      [agent.id]
    );

    // 最新效率分
    const latestSnapshot = queryOne<{ efficiency_score: number | null }>(
      `SELECT efficiency_score FROM performance_snapshots
       WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1`,
      [agent.id]
    );

    // 近 7 天任务完成数
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekResult = queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM tasks WHERE assigned_agent_id = ? AND status = 'done' AND completed_at >= ?",
      [agent.id, weekAgo]
    );

    // 近 7 天 Token（agent_events.tokens 是 JSON TEXT，需要从 agents 表获取累计值）
    const weekTokens = queryOne<{ tokens_used: number | null }>(
      'SELECT tokens_used FROM agents WHERE id = ?',
      [agent.id]
    );

    return {
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role,
      agentStatus: agent.status,
      departmentName,
      tasksCompleted: completedResult?.count || 0,
      tasksInProgress: inProgressResult?.count || 0,
      tasksFailed: failedResult?.count || 0,
      avgCompletionMinutes: avgResult?.avg || null,
      tokensUsed: agent.tokens_used,
      totalCost: agent.total_cost,
      efficiencyScore: latestSnapshot?.efficiency_score ?? null,
      last7DaysTasksCompleted: weekResult?.count || 0,
      last7DaysTokensUsed: weekTokens?.tokens_used || 0,
    };
  });
}

// 获取团队整体统计
export function getDashboardStats() {
  const agentCount = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM agents');
  const activeAgentCount = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM agents WHERE status != 'offline'"
  );
  const totalTokens = queryOne<{ sum: number | null }>(
    'SELECT SUM(tokens_used) as sum FROM agents'
  );
  const totalCost = queryOne<{ sum: number | null }>(
    'SELECT SUM(total_cost) as sum FROM agents'
  );
  const completedTasks = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM tasks WHERE status = 'done'"
  );
  const inProgressTasks = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM tasks WHERE status IN ('in_progress', 'review')"
  );
  const failedTasks = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM tasks WHERE status = 'cancelled'"
  );

  // 平均效率分
  const avgScore = queryOne<{ avg: number | null }>(
    `SELECT AVG(efficiency_score) as avg FROM performance_snapshots
     WHERE created_at >= ?`,
    [Date.now() - 7 * 24 * 60 * 60 * 1000]
  );

  return {
    totalTasksCompleted: completedTasks?.count || 0,
    totalTasksInProgress: inProgressTasks?.count || 0,
    totalTasksFailed: failedTasks?.count || 0,
    avgEfficiencyScore: avgScore?.avg ? Math.round(avgScore.avg) : 0,
    totalTokensUsed: totalTokens?.sum || 0,
    totalCost: totalCost?.sum || 0,
    agentCount: agentCount?.count || 0,
    activeAgentCount: activeAgentCount?.count || 0,
  };
}

// 获取单个 Agent 绩效趋势
export function getAgentTrend(agentId: string, days: number = 7) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return queryAll<{
    period_start: number;
    tasks_completed: number;
    tokens_used: number;
    total_cost: number;
    efficiency_score: number | null;
  }>(
    `SELECT period_start, tasks_completed, tokens_used, total_cost, efficiency_score
     FROM performance_snapshots
     WHERE agent_id = ? AND period = 'daily' AND period_start >= ?
     ORDER BY period_start ASC`,
    [agentId, since]
  );
}

// 获取团队级趋势（按天聚合所有 Agent）
export function getTeamTrend(days: number = 7) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return queryAll<{
    period_start: number;
    tasks_completed: number;
    tokens_used: number;
    total_cost: number;
    avg_efficiency: number;
  }>(
    `SELECT period_start,
            SUM(tasks_completed) as tasks_completed,
            SUM(tokens_used) as tokens_used,
            SUM(total_cost) as total_cost,
            AVG(efficiency_score) as avg_efficiency
     FROM performance_snapshots
     WHERE period = 'daily' AND period_start >= ?
     GROUP BY period_start
     ORDER BY period_start ASC`,
    [since]
  );
}

// 生成 AI 绩效报告（接入 Claude Code SDK）
export async function generateReport(agentId: string, period: 'weekly' | 'monthly' = 'weekly') {
  const now = Date.now();
  const periodDays = period === 'weekly' ? 7 : 30;
  const periodStart = now - periodDays * 24 * 60 * 60 * 1000;

  const agent = queryOne<{ name: string; role: string }>(
    'SELECT name, role FROM agents WHERE id = ?',
    [agentId]
  );
  if (!agent) throw new Error('Agent 不存在');

  const metrics = calculateAgentMetrics(agentId, periodStart, now);

  let summary: string;
  let strengths: string[];
  let improvements: string[];
  let score: number;

  // 尝试使用 Claude SDK 生成智能报告
  if (isSdkAvailable()) {
    try {
      const completionRate = metrics.tasksCompleted + metrics.tasksFailed > 0
        ? Math.round(metrics.tasksCompleted / (metrics.tasksCompleted + metrics.tasksFailed) * 100)
        : 0;

      const prompt = `请根据以下 AI Agent 绩效数据，生成一份专业的绩效分析报告。

Agent 信息：
- 名称：${agent.name}
- 角色：${agent.role}
- 统计周期：近 ${periodDays} 天

绩效指标：
- 完成任务数：${metrics.tasksCompleted}
- 失败任务数：${metrics.tasksFailed}
- 平均完成时间：${metrics.avgCompletionMinutes !== null ? Math.round(metrics.avgCompletionMinutes) + ' 分钟' : '暂无数据'}
- Token 消耗：${metrics.tokensUsed}
- 总费用：$${metrics.totalCost.toFixed(2)}
- 效率评分：${metrics.efficiencyScore ?? '暂无'} / 100
- 任务完成率：${completionRate}%

请用中文输出 JSON 格式的报告，严格遵循以下格式（不要添加任何其他文本）：
{
  "summary": "一段 2-3 句话的绩效总结",
  "strengths": ["优势1", "优势2", "优势3"],
  "improvements": ["改进建议1", "改进建议2"],
  "score": 85
}

要求：
- summary 需要包含具体数据引用
- strengths 列出 2-3 个优势
- improvements 列出 1-2 个具体可操作的改进建议
- score 为 0-100 的整数评分，需与效率评分逻辑一致`;

      const result = await singleQuery(prompt, 'haiku', '你是一名专业的 AI Agent 绩效评估专家。请根据数据生成客观、专业的绩效分析报告。');

      // 解析 JSON 响应
      const jsonMatch = result.result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          summary: string;
          strengths: string[];
          improvements: string[];
          score: number;
        };
        summary = parsed.summary;
        strengths = parsed.strengths;
        improvements = parsed.improvements;
        score = Math.max(0, Math.min(100, parsed.score));
      } else {
        // JSON 解析失败，使用原始文本
        summary = result.result;
        strengths = ['AI 生成了详细的分析报告'];
        improvements = ['建议进一步分析报告内容'];
        score = metrics.efficiencyScore ?? 50;
      }
    } catch (err) {
      console.warn('[绩效报告] Claude SDK 调用失败，回退到模板化生成:', err instanceof Error ? err.message : err);
      ({ summary, strengths, improvements, score } = generateTemplateReport(agent, metrics, periodDays));
    }
  } else {
    // 无 API Key，使用模板化生成
    ({ summary, strengths, improvements, score } = generateTemplateReport(agent, metrics, periodDays));
  }

  // 检查是否已有报告（同周期）
  const existing = queryOne<{ id: string }>(
    `SELECT id FROM performance_reports
     WHERE agent_id = ? AND period = ? AND period_start >= ?
     ORDER BY created_at DESC LIMIT 1`,
    [agentId, period, periodStart]
  );

  if (existing) {
    run(
      `UPDATE performance_reports
       SET summary = ?, strengths = ?, improvements = ?, score = ?
       WHERE id = ?`,
      [summary, JSON.stringify(strengths), JSON.stringify(improvements), score, existing.id]
    );
    return queryOne('SELECT * FROM performance_reports WHERE id = ?', [existing.id]);
  }

  const id = uuid();
  run(
    `INSERT INTO performance_reports
     (id, agent_id, period, period_start, period_end, summary, strengths, improvements, score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, agentId, period, periodStart, now, summary, JSON.stringify(strengths),
      JSON.stringify(improvements), score, now]
  );

  return queryOne('SELECT * FROM performance_reports WHERE id = ?', [id]);
}

// 模板化报告生成（降级方案）
function generateTemplateReport(
  agent: { name: string; role: string },
  metrics: ReturnType<typeof calculateAgentMetrics>,
  periodDays: number,
) {
  const completionRate = metrics.tasksCompleted + metrics.tasksFailed > 0
    ? Math.round(metrics.tasksCompleted / (metrics.tasksCompleted + metrics.tasksFailed) * 100)
    : 0;

  const summary = `${agent.name}（${agent.role}）在近 ${periodDays} 天内完成了 ${metrics.tasksCompleted} 个任务，` +
    `任务完成率 ${completionRate}%。` +
    (metrics.avgCompletionMinutes !== null
      ? `平均任务完成时间为 ${Math.round(metrics.avgCompletionMinutes)} 分钟。`
      : '') +
    `消耗 Token ${metrics.tokensUsed}，总费用 $${metrics.totalCost.toFixed(2)}。` +
    `综合效率评分：${metrics.efficiencyScore ?? '暂无'}。`;

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (completionRate >= 80) strengths.push('任务完成率优秀，表现稳定');
  if (completionRate >= 50 && completionRate < 80) strengths.push('任务完成率良好');
  if (metrics.avgCompletionMinutes !== null && metrics.avgCompletionMinutes < 30) {
    strengths.push('任务响应速度快，执行力强');
  }
  if (metrics.efficiencyScore !== null && metrics.efficiencyScore >= 70) {
    strengths.push('综合效率评分优秀');
  }
  if (strengths.length === 0) strengths.push('已进入工作状态，等待更多数据积累');

  if (completionRate < 50) improvements.push('任务完成率偏低，建议关注任务分配合理性');
  if (metrics.avgCompletionMinutes !== null && metrics.avgCompletionMinutes > 60) {
    improvements.push('部分任务耗时较长，建议优化执行流程');
  }
  if (metrics.totalCost > 10) improvements.push('费用较高，建议关注 Token 使用效率');
  if (improvements.length === 0) improvements.push('暂无明显问题，继续保持');

  const score = metrics.efficiencyScore ?? 50;

  return { summary, strengths, improvements, score };
}
