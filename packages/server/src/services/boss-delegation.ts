/**
 * Boss 委托机制
 * Boss Agent 自动将任务分解为子任务并指派给合适的员工
 */
import { queryAll, queryOne, run } from '../db/connection.js';
import { broadcast } from '../ws/connection.js';
import { singleQuery, isSdkAvailable } from './claude-client.js';
import { executeTask } from './task-executor.js';
import { v4 as uuid } from 'uuid';

// 角色能力映射（用于任务匹配）
const ROLE_CAPABILITIES: Record<string, string[]> = {
  frontend: ['UI', '页面', '前端', 'React', 'Vue', 'CSS', '组件', '样式', '交互'],
  backend: ['API', '接口', '后端', '服务', '数据库', 'Node', 'Python', '服务器'],
  fullstack: ['全栈', '前端', '后端', '功能', '页面', '接口'],
  architect: ['架构', '设计', '重构', '技术选型', '系统', '方案', '评审'],
  tester: ['测试', 'QA', '质量', '用例', '自动化', '回归'],
  devops: ['部署', 'CI', 'CD', 'Docker', '运维', '监控', '容器', 'Kubernetes'],
  dba: ['SQL', '数据库', '索引', '查询', '优化', '迁移'],
  pm: ['需求', 'PRD', '文档', '分析', '规划', '优先级'],
  po: ['产品', '路线图', '规划', '目标', 'OKR'],
  designer: ['设计', 'UI', 'UX', '原型', '交互', '视觉'],
};

interface AgentRow {
  id: string;
  name: string;
  role: string;
  model: string;
  is_boss: number;
  status: string;
  custom_instructions: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
}

/**
 * 分解任务并委托给团队成员
 */
export async function delegateTask(bossAgentId: string, taskDescription: string): Promise<{
  parentTaskId: string;
  subTasks: Array<{ id: string; title: string; assignedAgentId: string }>;
}> {
  if (!isSdkAvailable()) {
    throw new Error('Claude API 未配置，无法执行 Boss 委托');
  }

  // 获取 Boss Agent 信息
  const boss = queryOne<AgentRow>('SELECT * FROM agents WHERE id = ? AND is_boss = 1', [bossAgentId]);
  if (!boss) throw new Error('Boss Agent 不存在');

  // 获取团队成员（非 Boss 的所有 Agent）
  const team = queryAll<AgentRow>("SELECT * FROM agents WHERE id != ? AND status != 'offline'", [bossAgentId]);
  if (team.length === 0) throw new Error('没有可用的团队成员');

  // 创建父任务
  const parentTaskId = createTaskRecord({
    title: `[Boss 委托] ${taskDescription.slice(0, 100)}`,
    description: taskDescription,
    assignedAgentId: bossAgentId,
    status: 'in_progress',
  });

  // 调用 Claude API 分解任务
  const teamContext = team.map(a =>
    `- ${a.name} (${a.role}): ${ROLE_CAPABILITIES[a.role]?.join('、') || '通用'}`
  ).join('\n');

  const decomposePrompt = [
    `你是一个团队管理者（Boss），需要将以下任务分解为子任务并分配给合适的团队成员。`,
    ``,
    `## 原始任务`,
    taskDescription,
    ``,
    `## 可用团队成员`,
    teamContext,
    ``,
    `## 输出要求`,
    `请以 JSON 数组格式输出子任务，每个子任务包含:`,
    `- title: 子任务标题（简短描述）`,
    `- description: 子任务详细描述`,
    `- assigneeRole: 建议的角色（从团队成员的角色中选择）`,
    `- priority: 优先级 (critical/high/medium/low)`,
    ``,
    `只输出 JSON 数组，不要其他文字。`,
  ].join('\n');

  let subTaskPlans: Array<{
    title: string;
    description: string;
    assigneeRole: string;
    priority: string;
  }>;

  try {
    const result = await singleQuery(decomposePrompt, 'sonnet', boss.custom_instructions || undefined);
    // 解析 JSON 结果
    const jsonMatch = result.result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('无法解析任务分解结果');
    subTaskPlans = JSON.parse(jsonMatch[0]);
  } catch (err) {
    // 解析失败，创建单一子任务
    console.error('[Boss 委托] 任务分解失败，创建单一子任务:', err);
    subTaskPlans = [{
      title: taskDescription.slice(0, 100),
      description: taskDescription,
      assigneeRole: team[0].role,
      priority: 'medium',
    }];
  }

  // 为每个子任务匹配最合适的 Agent 并创建任务
  const subTasks: Array<{ id: string; title: string; assignedAgentId: string }> = [];

  for (const plan of subTaskPlans) {
    const bestAgent = findBestAgent(team, plan.assigneeRole);
    if (!bestAgent) continue;

    const subTaskId = createTaskRecord({
      title: plan.title,
      description: plan.description,
      assignedAgentId: bestAgent.id,
      status: 'todo',
      priority: plan.priority,
    });

    subTasks.push({ id: subTaskId, title: plan.title, assignedAgentId: bestAgent.id });
  }

  console.log(`[Boss 委托] Boss ${boss.name} 分解出 ${subTasks.length} 个子任务`);
  broadcast('task:updated', {
    taskId: parentTaskId,
    action: 'delegated',
    subTaskCount: subTasks.length,
  });

  return { parentTaskId, subTasks };
}

/**
 * 监控子任务完成情况，全部完成后汇总结果
 */
export async function monitorDelegation(parentTaskId: string): Promise<void> {
  const subTasks = queryAll<TaskRow>(
    'SELECT * FROM tasks WHERE workflow_id IS NULL AND title NOT LIKE ?',
    [`[Boss 委托]%`]
  );

  // 查找属于该父任务的子任务（通过描述中的引用）
  const pendingCount = subTasks.filter(t => t.status !== 'done' && t.status !== 'review').length;

  if (pendingCount === 0) {
    // 所有子任务完成，汇总结果
    await synthesizeResults(parentTaskId);
  }
}

/**
 * 汇总子任务结果
 */
async function synthesizeResults(parentTaskId: string): Promise<void> {
  const parentTask = queryOne<TaskRow>('SELECT * FROM tasks WHERE id = ?', [parentTaskId]);
  if (!parentTask) return;

  // 更新父任务为完成
  run(
    "UPDATE tasks SET status = 'review', result = ?, completed_at = ?, updated_at = ? WHERE id = ?",
    ['所有子任务已完成', Date.now(), Date.now(), parentTaskId]
  );

  broadcast('task:updated', { taskId: parentTaskId, action: 'completed', status: 'review' });
}

/**
 * 自动执行 Boss 委托的所有子任务
 */
export async function executeDelegation(_parentTaskId: string): Promise<void> {
  // 查找待执行的子任务并依次执行
  const subTasks = queryAll<{ id: string; status: string }>(
    "SELECT id, status FROM tasks WHERE status = 'todo' ORDER BY created_at ASC"
  );

  for (const task of subTasks) {
    try {
      await executeTask(task.id);
    } catch (err) {
      console.error(`[Boss 委托] 子任务 ${task.id} 执行失败:`, err);
    }
  }
}

/**
 * 创建任务记录
 */
function createTaskRecord(params: {
  title: string;
  description?: string | null;
  assignedAgentId?: string | null;
  status?: string;
  priority?: string;
}): string {
  const id = uuid();
  const now = Date.now();

  run(
    `INSERT INTO tasks (id, title, description, status, priority, assigned_agent_id, department_id, column_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    [
      id,
      params.title,
      params.description || null,
      params.status || 'todo',
      params.priority || 'medium',
      params.assignedAgentId || null,
      now,
      now,
      now,
    ]
  );

  return id;
}

/**
 * 根据角色匹配最合适的 Agent
 */
function findBestAgent(agents: AgentRow[], requiredRole: string): AgentRow | null {
  // 优先匹配角色
  const exactMatch = agents.find(a => a.role === requiredRole);
  if (exactMatch) return exactMatch;

  // 匹配角色能力
  for (const agent of agents) {
    const caps = ROLE_CAPABILITIES[agent.role] || [];
    if (caps.some(c => requiredRole.toLowerCase().includes(c.toLowerCase()))) {
      return agent;
    }
  }

  // 返回第一个可用的 Agent
  return agents[0] || null;
}
