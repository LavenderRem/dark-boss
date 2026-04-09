// 工作流状态
export type WorkflowStatus = 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'failed';

// 工作流节点类型
export type WorkflowNodeType = 'agent' | 'input' | 'output' | 'router' | 'aggregator' | 'condition';

// 工作流节点
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    agentId?: string;
    prompt?: string;
    model?: 'sonnet' | 'opus' | 'haiku';
    condition?: string;
    [key: string]: unknown;
  };
}

// 工作流边
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: {
    label?: string;
    condition?: string;
    [key: string]: unknown;
  };
}

// 工作流
export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  currentStepIndex: number;
  variables: Record<string, unknown> | null;
  departmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt: Date | null;
}

// 创建工作流请求
export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  departmentId?: string;
}

// 更新工作流请求（保存画布）
export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  departmentId?: string | null;
}
