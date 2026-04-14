import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge, type Node, type Edge, type Connection } from '@xyflow/react';
import type { Workflow, WorkflowStatus } from '@dark-boss/shared';

// 执行日志条目
export interface ExecutionLogEntry {
  id: string;
  workflowId: string;
  executionId: string;
  nodeId: string;
  nodeType: string;
  agentId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  inputPreview?: string;
  outputPreview?: string;
  error?: string;
  durationMs?: number;
  tokensUsed?: number;
  cost?: number;
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
  // 前端补充字段
  nodeLabel?: string;
}

interface WorkflowState {
  // 当前工作流
  workflowId: string | null;
  workflowName: string;
  workflowStatus: WorkflowStatus;

  // 画布状态
  nodes: Node[];
  edges: Edge[];

  // 编辑状态
  isDirty: boolean;

  // 执行状态
  isRunning: boolean;
  executingNodeId: string | null;
  activeEdgeIds: Set<string>;
  nodeResults: Map<string, string>;
  workflowResult: string | null;

  // 执行日志
  executionId: string | null;
  executionLogs: ExecutionLogEntry[];
  showLogPanel: boolean;

  // Actions
  setWorkflow: (workflow: Workflow) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: Parameters<typeof import('@xyflow/react').applyNodeChanges>[0]) => void;
  onEdgesChange: (changes: Parameters<typeof import('@xyflow/react').applyEdgeChanges>[0]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  setRunning: (running: boolean) => void;
  setExecutingNode: (nodeId: string | null) => void;
  setActiveEdges: (edgeIds: Set<string>) => void;
  setNodeResult: (nodeId: string, result: string) => void;
  setWorkflowResult: (result: string | null) => void;
  markDirty: () => void;
  markSaved: () => void;
  // 执行日志 Actions
  setExecutionId: (id: string | null) => void;
  setExecutionLogs: (logs: ExecutionLogEntry[]) => void;
  addExecutionLog: (entry: ExecutionLogEntry) => void;
  updateExecutionLog: (nodeId: string, updates: Partial<ExecutionLogEntry>) => void;
  clearExecutionLogs: () => void;
  toggleLogPanel: () => void;
  setShowLogPanel: (show: boolean) => void;
  reset: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflowId: null,
  workflowName: '',
  workflowStatus: 'draft',
  nodes: [],
  edges: [],
  isDirty: false,
  isRunning: false,
  executingNodeId: null,
  activeEdgeIds: new Set(),
  nodeResults: new Map(),
  workflowResult: null,
  executionId: null,
  executionLogs: [],
  showLogPanel: false,

  setWorkflow: (workflow) => set({
    workflowId: workflow.id,
    workflowName: workflow.name,
    workflowStatus: workflow.status,
    nodes: (workflow.nodes || []).map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })),
    edges: (workflow.edges || []).map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: 'data',
    })),
    isDirty: false,
    isRunning: false,
    executingNodeId: null,
    activeEdgeIds: new Set(),
    nodeResults: new Map(),
    workflowResult: null,
    executionId: null,
    executionLogs: [],
  }),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes), isDirty: true });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges), isDirty: true });
  },

  onConnect: (connection) => {
    set({ edges: addEdge({ ...connection, type: 'data' }, get().edges), isDirty: true });
  },

  addNode: (node) => set({ nodes: [...get().nodes, node], isDirty: true }),

  removeNode: (nodeId) => set({
    nodes: get().nodes.filter(n => n.id !== nodeId),
    edges: get().edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    isDirty: true,
  }),

  setRunning: (running) => set({ isRunning: running }),
  setExecutingNode: (nodeId) => set({ executingNodeId: nodeId }),
  setActiveEdges: (edgeIds) => set({ activeEdgeIds: edgeIds }),
  setNodeResult: (nodeId, result) => {
    const newMap = new Map(get().nodeResults);
    newMap.set(nodeId, result);
    set({ nodeResults: newMap });
  },
  setWorkflowResult: (result) => set({ workflowResult: result }),
  markDirty: () => set({ isDirty: true }),
  markSaved: () => set({ isDirty: false }),

  // 执行日志 Actions
  setExecutionId: (id) => set({ executionId: id }),
  setExecutionLogs: (logs) => set({ executionLogs: logs }),
  addExecutionLog: (entry) => set({ executionLogs: [...get().executionLogs, entry] }),
  updateExecutionLog: (nodeId, updates) => set({
    executionLogs: get().executionLogs.map(log =>
      log.nodeId === nodeId ? { ...log, ...updates } : log
    ),
  }),
  clearExecutionLogs: () => set({ executionLogs: [], executionId: null }),
  toggleLogPanel: () => set({ showLogPanel: !get().showLogPanel }),
  setShowLogPanel: (show) => set({ showLogPanel: show }),

  reset: () => set({
    workflowId: null,
    workflowName: '',
    workflowStatus: 'draft',
    nodes: [],
    edges: [],
    isDirty: false,
    isRunning: false,
    executingNodeId: null,
    activeEdgeIds: new Set(),
    nodeResults: new Map(),
    workflowResult: null,
    executionId: null,
    executionLogs: [],
    showLogPanel: false,
  }),
}));
