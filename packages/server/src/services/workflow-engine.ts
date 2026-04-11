import { queryOne, run } from '../db/connection.js';
import { broadcast } from '../ws/connection.js';
import type { WorkflowNode, WorkflowEdge } from '@dark-boss/shared';

interface ExecutionContext {
  workflowId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  nodeOutputs: Map<string, string>;
  completed: Set<string>;
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

// 执行工作流（模拟版）
export async function executeWorkflow(workflowId: string): Promise<void> {
  const row = queryOne('SELECT * FROM workflows WHERE id = ?', [workflowId]);
  if (!row) throw new Error('工作流不存在');

  const nodes: WorkflowNode[] = typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes;
  const edges: WorkflowEdge[] = typeof row.edges === 'string' ? JSON.parse(row.edges) : row.edges;

  if (nodes.length === 0) throw new Error('工作流没有节点');

  // 更新状态为运行中
  run("UPDATE workflows SET status = 'running', updated_at = ? WHERE id = ?", [Date.now(), workflowId]);
  broadcast('workflow:progress', { workflowId, status: 'running' });

  const ctx: ExecutionContext = {
    workflowId,
    nodes,
    edges,
    nodeOutputs: new Map(),
    completed: new Set(),
  };

  const layers = topologicalSort(nodes, edges);
  console.log(`[工作流引擎] 工作流 ${workflowId} 开始执行，${layers.length} 层，${nodes.length} 个节点`);

  try {
    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx];
      console.log(`[工作流引擎] 执行第 ${layerIdx + 1} 层: ${layer.join(', ')}`);

      // 并行执行同一层的节点
      await Promise.all(layer.map(nodeId => executeNode(ctx, nodeId)));

      // 层间广播进度
      broadcast('workflow:progress', {
        workflowId,
        layerIndex: layerIdx,
        totalLayers: layers.length,
        completedNodes: ctx.completed.size,
        totalNodes: nodes.length,
      });
    }

    // 执行完成
    run("UPDATE workflows SET status = 'completed', updated_at = ? WHERE id = ?", [Date.now(), workflowId]);
    broadcast('workflow:progress', { workflowId, status: 'completed' });
    console.log(`[工作流引擎] 工作流 ${workflowId} 执行完成`);
  } catch (err) {
    run("UPDATE workflows SET status = 'failed', updated_at = ? WHERE id = ?", [Date.now(), workflowId]);
    broadcast('workflow:progress', { workflowId, status: 'failed', error: String(err) });
    console.error(`[工作流引擎] 工作流 ${workflowId} 执行失败:`, err);
  }
}

// 执行单个节点（模拟版：等待 2-4 秒模拟 Agent 工作）
async function executeNode(ctx: ExecutionContext, nodeId: string): Promise<void> {
  const node = ctx.nodes.find(n => n.id === nodeId);
  if (!node) return;

  // 广播节点开始
  broadcast('workflow:node_start', { workflowId: ctx.workflowId, nodeId, agentId: node.data?.agentId });
  console.log(`[工作流引擎] 节点 ${nodeId} (${node.data?.label || node.type}) 开始执行`);

  // 模拟执行：等待随机时间
  const duration = 2000 + Math.random() * 2000;
  await new Promise(resolve => setTimeout(resolve, duration));

  // 模拟输出
  const output = `[${node.data?.label || node.type}] 执行完成，耗时 ${Math.round(duration / 1000)}秒`;
  ctx.nodeOutputs.set(nodeId, output);
  ctx.completed.add(nodeId);

  // 广播节点完成
  broadcast('workflow:node_complete', {
    workflowId: ctx.workflowId,
    nodeId,
    agentId: node.data?.agentId,
    result: output,
  });

  // 标记相关边为活跃
  const activeEdges = ctx.edges
    .filter(e => e.source === nodeId)
    .map(e => e.id);
  broadcast('workflow:edge_active', { workflowId: ctx.workflowId, edgeIds: activeEdges });
}
