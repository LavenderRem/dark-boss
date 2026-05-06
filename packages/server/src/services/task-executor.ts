import { v4 as uuid } from 'uuid';
import { queryOne, run } from '../db/connection.js';
import { broadcast } from '../ws/connection.js';
import { singleQuery, isSdkAvailable } from './claude-client.js';

// 角色描述映射
const ROLE_DESCRIPTIONS: Record<string, string> = {
  frontend: '前端开发工程师，擅长 React、Vue、TypeScript、CSS',
  backend: '后端开发工程师，擅长 Node.js、Python、API 设计',
  fullstack: '全栈开发工程师，前后端兼顾',
  architect: '架构师，擅长系统设计、代码审查、技术选型',
  tester: '测试工程师，擅长测试用例设计、质量保障',
  devops: '运维工程师，擅长 CI/CD、Docker、Kubernetes',
  dba: '数据库管理员，擅长 SQL 优化、数据库设计',
  pm: '产品经理，擅长需求分析、PRD 编写、项目管理',
  po: '产品负责人，负责产品规划和优先级排序',
  designer: '设计师，擅长 UI/UX 设计、交互设计',
  custom: 'AI 助手',
};

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_agent_id: string | null;
  estimated_minutes: number | null;
  started_at: number | null;
  due_at: number | null;
}

interface AgentRow {
  name: string;
  role: string;
  model: string;
  custom_instructions: string | null;
}

// 执行指定任务
export async function executeTask(taskId: string): Promise<void> {
  const task = queryOne<TaskRow>('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) throw new Error('任务不存在');
  if (task.status === 'done') throw new Error('任务已完成');
  if (!task.assigned_agent_id) throw new Error('任务未指派给员工');

  // 检查 SDK 是否可用
  if (!isSdkAvailable()) {
    throw new Error('Claude API 未配置，无法执行任务');
  }

  // 获取 Agent 信息
  const agent = queryOne<AgentRow>(
    'SELECT name, role, model, custom_instructions FROM agents WHERE id = ?',
    [task.assigned_agent_id]
  );
  if (!agent) throw new Error('指派的员工不存在');

  // 更新状态为进行中
  const now = Date.now();
  run(
    "UPDATE tasks SET status = 'in_progress', started_at = ?, progress = 10, activity_summary = ?, updated_at = ? WHERE id = ?",
    [now, 'Agent 已接手任务，准备执行', now, taskId]
  );
  broadcast('task:progress', { taskId, progress: 10, activitySummary: 'Agent 已接手任务，准备执行' });
  broadcast('task:activity', { taskId, activity: 'Agent 已接手任务，准备执行' });
  broadcast('task:updated', { taskId, action: 'started', status: 'in_progress' });

  // 记录状态变更事件
  run(
    `INSERT INTO task_events (id, task_id, event_type, agent_id, payload, created_at) VALUES (?, ?, 'status_changed', ?, ?, ?)`,
    [uuid(), taskId, task.assigned_agent_id, JSON.stringify({ from: task.status, to: 'in_progress' }), now]
  );

  console.log(`[任务执行器] 任务 "${task.title}" 开始执行 (Agent: ${agent.name})`);

  try {
    // 构建提示词
    const roleDesc = ROLE_DESCRIPTIONS[agent.role] || 'AI 助手';
    const systemPrompt = agent.custom_instructions || `你是${agent.name}，一位${roleDesc}。请完成分配给你的任务。`;
    const model = (agent.model as 'sonnet' | 'opus' | 'haiku') || 'sonnet';

    const userPrompt = [
      `## 任务：${task.title}`,
      task.description ? `\n### 描述\n${task.description}` : '',
      task.estimated_minutes ? `\n### 预估时间\n${task.estimated_minutes} 分钟` : '',
      task.due_at ? `\n### 截止日期\n${new Date(task.due_at).toLocaleString('zh-CN')}` : '',
    ].filter(Boolean).join('\n');

    // 更新进度：正在执行 Claude API 调用
    run(
      "UPDATE tasks SET progress = 50, activity_summary = ?, updated_at = ? WHERE id = ?",
      ['正在调用 Claude API 执行任务', Date.now(), taskId]
    );
    broadcast('task:progress', { taskId, progress: 50, activitySummary: '正在调用 Claude API 执行任务' });

    const result = await singleQuery(userPrompt, model, systemPrompt);
    console.log(`[任务执行器] 任务 "${task.title}" 执行完成: ${result.result.length} 字符, ${result.tokens} tokens`);

    // 计算实际耗时（分钟）
    const actualMinutes = task.estimated_minutes
      ? Math.round((Date.now() - now) / 60000)
      : null;

    // 更新任务为完成状态
    const completedAt = Date.now();
    run(
      `UPDATE tasks SET status = 'review', progress = 100, activity_summary = ?, result = ?, actual_minutes = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
      ['任务执行完成', result.result, actualMinutes || null, completedAt, completedAt, taskId]
    );
    broadcast('task:progress', { taskId, progress: 100, activitySummary: '任务执行完成' });

    // 记录任务完成事件
    run(
      `INSERT INTO task_events (id, task_id, event_type, agent_id, payload, created_at) VALUES (?, ?, 'completed', ?, ?, ?)`,
      [uuid(), taskId, task.assigned_agent_id, JSON.stringify({ result_length: result.result.length, tokens: result.tokens }), completedAt]
    );

    // 更新 Agent 的 Token/费用统计
    run(
      'UPDATE agents SET tokens_used = tokens_used + ?, total_cost = total_cost + ?, last_activity_at = ? WHERE id = ?',
      [result.tokens, result.cost, completedAt, task.assigned_agent_id]
    );

    broadcast('task:updated', { taskId, action: 'completed', status: 'review' });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '未知错误';
    console.error(`[任务执行器] 任务 "${task.title}" 执行失败:`, errorMsg);

    const errorTime = Date.now();
    run(
      "UPDATE tasks SET status = 'todo', progress = 0, activity_summary = ?, updated_at = ? WHERE id = ?",
      [`执行失败: ${errorMsg}`, errorTime, taskId]
    );
    broadcast('task:progress', { taskId, progress: 0, activitySummary: `执行失败: ${errorMsg}` });
    broadcast('task:updated', { taskId, action: 'failed', error: errorMsg });
    throw new Error(`任务执行失败: ${errorMsg}`);
  }
}

// Agent 拉取并执行下一个待办任务
export async function pullAndExecuteTask(agentId: string): Promise<string | null> {
  // 查找该 Agent 优先级最高的待办任务
  const task = queryOne<{ id: string; title: string }>(
    `SELECT id, title FROM tasks
     WHERE assigned_agent_id = ? AND status IN ('todo', 'backlog')
     ORDER BY
       CASE priority
         WHEN 'critical' THEN 0
         WHEN 'high' THEN 1
         WHEN 'medium' THEN 2
         WHEN 'low' THEN 3
       END,
       created_at ASC
     LIMIT 1`,
    [agentId]
  );

  if (!task) {
    console.log(`[任务执行器] Agent ${agentId} 没有待办任务`);
    return null;
  }

  console.log(`[任务执行器] Agent ${agentId} 拉取任务: "${task.title}"`);
  await executeTask(task.id);
  return task.id;
}
