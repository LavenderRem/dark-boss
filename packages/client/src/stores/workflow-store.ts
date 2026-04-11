import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge, type Node, type Edge, type Connection } from '@xyflow/react';
import type { Workflow, WorkflowStatus } from '@dark-boss/shared';

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
  executingNodeId: string | null;
  activeEdgeIds: Set<string>;

  // Actions
  setWorkflow: (workflow: Workflow) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: Parameters<typeof import('@xyflow/react').applyNodeChanges>[0]) => void;
  onEdgesChange: (changes: Parameters<typeof import('@xyflow/react').applyEdgeChanges>[0]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  setExecutingNode: (nodeId: string | null) => void;
  setActiveEdges: (edgeIds: Set<string>) => void;
  markDirty: () => void;
  markSaved: () => void;
  reset: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflowId: null,
  workflowName: '',
  workflowStatus: 'draft',
  nodes: [],
  edges: [],
  isDirty: false,
  executingNodeId: null,
  activeEdgeIds: new Set(),

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
    executingNodeId: null,
    activeEdgeIds: new Set(),
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

  setExecutingNode: (nodeId) => set({ executingNodeId: nodeId }),
  setActiveEdges: (edgeIds) => set({ activeEdgeIds: edgeIds }),
  markDirty: () => set({ isDirty: true }),
  markSaved: () => set({ isDirty: false }),
  reset: () => set({
    workflowId: null,
    workflowName: '',
    workflowStatus: 'draft',
    nodes: [],
    edges: [],
    isDirty: false,
    executingNodeId: null,
    activeEdgeIds: new Set(),
  }),
}));
