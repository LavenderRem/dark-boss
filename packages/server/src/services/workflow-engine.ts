import { queryOne, run } from '../db/connection.js';
import { broadcast } from '../ws/connection.js';
import { singleQuery, isSdkAvailable } from './claude-client.js';
import type { WorkflowNode, WorkflowEdge } from '@dark-boss/shared';
import { v4 as uuid } from 'uuid';

// 角色描述映射（与 chat-agent-service.ts 保持一致）
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

interface ExecutionContext {
  workflowId: string;
  executionId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  nodeOutputs: Map<string, string>;
  completed: Set<string>;
  workflowInput: string;
  finalOutputs: Map<string, string>;
  nodeStartTimes: Map<string, number>;
}

// 拓扑排序：找出可执行的节点顺序
function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[][] {
  const adjacency = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adjacency.set(node.id, new Set());
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // 分层：每一层是可以并行执行的节点
  const layers: string[][] = [];
  const visited = new Set<string>();

  while (visited.size < nodes.length) {
    const layer: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0 && !visited.has(nodeId)) {
        layer.push(nodeId);
      }
    }

    if (layer.length === 0) break; // 循环依赖，停止
    layers.push(layer);

    for (const nodeId of layer) {
      visited.add(nodeId);
      for (const dep of (adjacency.get(nodeId) || [])) {
        inDegree.set(dep, (inDegree.get(dep) || 1) - 1);
      }
    }
  }

  return layers;
}

// 收集上游节点的输出
function getUpstreamOutputs(ctx: ExecutionContext, nodeId: string): string[] {
  return ctx.edges
    .filter(e => e.target === nodeId)
    .map(e => ctx.nodeOutputs.get(e.source))
    .filter((v): v is string => !!v);
}

// 截断文本用于预览
function truncate(text: string, maxLen: number = 2000): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...(已截断)' : text;
}

// 写入执行日志到数据库
function insertExecutionLog(params: {
  id: string;
  workflowId: string;
  executionId: string;
  nodeId: string;
  nodeType: string;
  agentId?: string;
  status: string;
  inputPreview?: string;
  outputPreview?: string;
  error?: string;
  durationMs?: number;
  tokensUsed?: number;
  cost?: number;
  startedAt?: number;
  completedAt?: number;
}): void {
  const now = Date.now();
  run(
    `INSERT OR REPLACE INTO workflow_execution_logs
     (id, workflow_id, execution_id, node_id, node_type, agent_id, status,
      input_preview, output_preview, error, duration_ms, tokens_used, cost,
      started_at, completed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.id, params.workflowId, params.executionId, params.nodeId,
      params.nodeType, params.agentId || null, params.status,
      params.inputPreview ? truncate(params.inputPreview) : null,
      params.outputPreview ? truncate(params.outputPreview) : null,
      params.error || null,
      params.durationMs ?? null,
      params.tokensUsed ?? null,
      params.cost ?? null,
      params.startedAt ?? null,
      params.completedAt ?? null,
      now,
    ]
  );
}

// 更新执行日志状态
function updateExecutionLog(logId: string, updates: {
  status: string;
  outputPreview?: string;
  error?: string;
  durationMs?: number;
  tokensUsed?: number;
  cost?: number;
  completedAt?: number;
}): void {
  const sets: string[] = ['status = ?'];
  const vals: unknown[] = [updates.status];

  if (updates.outputPreview !== undefined) {
    sets.push('output_preview = ?');
    vals.push(truncate(updates.outputPreview));
  }
  if (updates.error !== undefined) {
    sets.push('error = ?');
    vals.push(updates.error);
  }
  if (updates.durationMs !== undefined) {
    sets.push('duration_ms = ?');
    vals.push(updates.durationMs);
  }
  if (updates.tokensUsed !== undefined) {
    sets.push('tokens_used = ?');
    vals.push(updates.tokensUsed);
  }
  if (updates.cost !== undefined) {
    sets.push('cost = ?');
    vals.push(updates.cost);
  }
  if (updates.completedAt !== undefined) {
    sets.push('completed_at = ?');
    vals.push(updates.completedAt);
  }

  vals.push(logId);
  run(`UPDATE workflow_execution_logs SET ${sets.join(', ')} WHERE id = ?`, vals);
}

// 执行工作流
export async function executeWorkflow(workflowId: string, input: string = ''): Promise<string> {
  const row = queryOne('SELECT * FROM workflows WHERE id = ?', [workflowId]);
  if (!row) throw new Error('工作流不存在');

  const nodes: WorkflowNode[] = typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes;
  const edges: WorkflowEdge[] = typeof row.edges === 'string' ? JSON.parse(row.edges) : row.edges;

  if (nodes.length === 0) throw new Error('工作流没有节点');

  const executionId = uuid();

  // 更新状态为运行中
  run("UPDATE workflows SET status = 'running', updated_at = ?, last_run_at = ? WHERE id = ?", [Date.now(), Date.now(), workflowId]);
  broadcast('workflow:progress', { workflowId, executionId, status: 'running' });

  const ctx: ExecutionContext = {
    workflowId,
    executionId,
    nodes,
    edges,
    nodeOutputs: new Map(),
    completed: new Set(),
    workflowInput: input,
    finalOutputs: new Map(),
    nodeStartTimes: new Map(),
  };

  const layers = topologicalSort(nodes, edges);
  console.log(`[工作流引擎] 工作流 ${workflowId} 开始执行 (executionId=${executionId})，${layers.length} 层，${nodes.length} 个节点`);

  try {
    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx];
      console.log(`[工作流引擎] 执行第 ${layerIdx + 1} 层: ${layer.join(', ')}`);

      // 并行执行同一层的节点
      await Promise.all(layer.map(nodeId => executeNode(ctx, nodeId)));

      // 层间广播进度
      broadcast('workflow:progress', {
        workflowId,
        executionId,
        layerIndex: layerIdx,
        totalLayers: layers.length,
        completedNodes: ctx.completed.size,
        totalNodes: nodes.length,
      });
    }

    // 将最终结果存入数据库
    const results = Object.fromEntries(ctx.finalOutputs);
    run(
      "UPDATE workflows SET status = 'completed', variables = ?, updated_at = ? WHERE id = ?",
      [JSON.stringify(results), Date.now(), workflowId]
    );
    broadcast('workflow:progress', { workflowId, executionId, status: 'completed', results });
    console.log(`[工作流引擎] 工作流 ${workflowId} 执行完成`);
    return executionId;
  } catch (err) {
    run("UPDATE workflows SET status = 'failed', updated_at = ? WHERE id = ?", [Date.now(), workflowId]);
    broadcast('workflow:progress', { workflowId, executionId, status: 'failed', error: String(err) });
    console.error(`[工作流引擎] 工作流 ${workflowId} 执行失败:`, err);
    return executionId;
  }
}

// 执行单个节点（按类型分发）
async function executeNode(ctx: ExecutionContext, nodeId: string): Promise<void> {
  const node = ctx.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const startedAt = Date.now();
  ctx.nodeStartTimes.set(nodeId, startedAt);

  // 收集上游输入用于日志
  const upstreamOutputs = getUpstreamOutputs(ctx, nodeId);
  const inputPreview = node.type === 'input'
    ? ctx.workflowInput
    : upstreamOutputs.join('\n');

  // 写入开始日志
  const logId = uuid();
  insertExecutionLog({
    id: logId,
    workflowId: ctx.workflowId,
    executionId: ctx.executionId,
    nodeId,
    nodeType: node.type,
    agentId: node.data?.agentId,
    status: 'running',
    inputPreview,
    startedAt,
  });

  // 广播节点开始
  broadcast('workflow:node_start', { workflowId: ctx.workflowId, executionId: ctx.executionId, nodeId, nodeType: node.type, agentId: node.data?.agentId });
  console.log(`[工作流引擎] 节点 ${nodeId} (${node.data?.label || node.type}) 开始执行`);

  let output: string;
  let tokensUsed: number | undefined;
  let cost: number | undefined;

  try {
    switch (node.type) {
      case 'input':
        output = await executeInputNode(ctx, node);
        break;
      case 'agent': {
        const agentResult = await executeAgentNode(ctx, node);
        output = agentResult.output;
        tokensUsed = agentResult.tokens;
        cost = agentResult.cost;
        break;
      }
      case 'router':
        output = executePassthroughNode(ctx, node);
        break;
      case 'aggregator':
        output = executeAggregatorNode(ctx, node);
        break;
      case 'output':
        output = executeOutputNode(ctx, node);
        break;
      default:
        output = `[未知节点类型: ${node.type}]`;
    }

    ctx.nodeOutputs.set(nodeId, output);
    ctx.completed.add(nodeId);

    const completedAt = Date.now();
    const durationMs = completedAt - startedAt;

    // 更新日志为完成
    updateExecutionLog(logId, {
      status: 'completed',
      outputPreview: output,
      durationMs,
      tokensUsed,
      cost,
      completedAt,
    });

    // 广播节点完成
    broadcast('workflow:node_complete', {
      workflowId: ctx.workflowId,
      executionId: ctx.executionId,
      nodeId,
      nodeType: node.type,
      agentId: node.data?.agentId,
      result: output,
      durationMs,
      tokensUsed,
      cost,
    });

    // 标记相关边为活跃
    const activeEdges = ctx.edges
      .filter(e => e.source === nodeId)
      .map(e => e.id);
    broadcast('workflow:edge_active', { workflowId: ctx.workflowId, edgeIds: activeEdges });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '未知错误';
    const completedAt = Date.now();

    updateExecutionLog(logId, {
      status: 'failed',
      error: errorMsg,
      durationMs: completedAt - startedAt,
      completedAt,
    });

    broadcast('workflow:node_complete', {
      workflowId: ctx.workflowId,
      executionId: ctx.executionId,
      nodeId,
      nodeType: node.type,
      agentId: node.data?.agentId,
      result: `执行失败: ${errorMsg}`,
    });

    throw err;
  }
}

// 输入节点：透传用户输入
async function executeInputNode(_ctx: ExecutionContext, node: WorkflowNode): Promise<string> {
  const prompt = node.data?.prompt as string | undefined;
  const input = _ctx.workflowInput;
  if (prompt && input) {
    return `${prompt}\n\n${input}`;
  }
  return input || (prompt || '');
}

// Agent 节点：调用 Claude API
async function executeAgentNode(
  ctx: ExecutionContext, node: WorkflowNode
): Promise<{ output: string; tokens?: number; cost?: number }> {
  const agentId = node.data?.agentId as string | undefined;

  if (!agentId) {
    return { output: `[${node.data?.label || 'Agent'}] 未关联员工，跳过执行` };
  }

  // 检查 SDK 是否可用
  if (!isSdkAvailable()) {
    return { output: `[${node.data?.label || 'Agent'}] Claude API 未配置，无法执行` };
  }

  // 从数据库获取 Agent 信息
  const agent = queryOne<{
    name: string; role: string; model: string;
    custom_instructions: string | null;
  }>('SELECT name, role, model, custom_instructions FROM agents WHERE id = ?', [agentId]);

  if (!agent) {
    return { output: `[${node.data?.label || 'Agent'}] 员工不存在 (ID: ${agentId})` };
  }

  // 收集上游输出作为上下文
  const upstreamOutputs = getUpstreamOutputs(ctx, node.id);
  const upstreamContext = upstreamOutputs.length > 0
    ? upstreamOutputs.map((o, i) => `### 上游输入 ${i + 1}\n${o}`).join('\n\n')
    : '';

  // 构建提示词
  const nodePrompt = (node.data?.prompt as string) || '';
  const roleDesc = ROLE_DESCRIPTIONS[agent.role] || 'AI 助手';
  const model = (node.data?.model as 'sonnet' | 'opus' | 'haiku') || (agent.model as 'sonnet' | 'opus' | 'haiku') || 'sonnet';

  const systemPrompt = agent.custom_instructions || `你是${agent.name}，一位${roleDesc}。请根据上游节点的输入完成你的任务。`;
  const userPrompt = [
    nodePrompt ? `## 任务要求\n${nodePrompt}` : '',
    upstreamContext ? `## 输入数据\n${upstreamContext}` : '',
  ].filter(Boolean).join('\n\n') || '请开始工作。';

  console.log(`[工作流引擎] Agent ${agent.name} 开始调用 Claude API (model=${model})`);

  try {
    const result = await singleQuery(userPrompt, model, systemPrompt);
    console.log(`[工作流引擎] Agent ${agent.name} 回复完成: ${result.result.length} 字符, ${result.tokens} tokens, ${result.durationMs}ms`);

    // 更新 Agent 的 Token/费用统计
    run(
      'UPDATE agents SET tokens_used = tokens_used + ?, total_cost = total_cost + ?, last_activity_at = ? WHERE id = ?',
      [result.tokens, result.cost, Date.now(), agentId]
    );

    return {
      output: result.result,
      tokens: result.tokens,
      cost: result.cost,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '未知错误';
    console.error(`[工作流引擎] Agent ${agent.name} 调用失败:`, errorMsg);
    return { output: `[${agent.name}] 执行失败: ${errorMsg}` };
  }
}

// Router 节点：透传上游输出到每条出边
function executePassthroughNode(ctx: ExecutionContext, node: WorkflowNode): string {
  const upstreamOutputs = getUpstreamOutputs(ctx, node.id);
  return upstreamOutputs.join('\n') || '';
}

// Aggregator 节点：合并所有上游输出
function executeAggregatorNode(ctx: ExecutionContext, node: WorkflowNode): string {
  const upstreamOutputs = getUpstreamOutputs(ctx, node.id);
  if (upstreamOutputs.length === 0) return '';
  if (upstreamOutputs.length === 1) return upstreamOutputs[0];

  return upstreamOutputs
    .map((output, i) => `--- 结果 ${i + 1} ---\n${output}`)
    .join('\n\n');
}

// Output 节点：记录最终结果
function executeOutputNode(ctx: ExecutionContext, node: WorkflowNode): string {
  const upstreamOutputs = getUpstreamOutputs(ctx, node.id);
  const result = upstreamOutputs.join('\n') || '';
  ctx.finalOutputs.set(node.id, result);
  return result;
}
