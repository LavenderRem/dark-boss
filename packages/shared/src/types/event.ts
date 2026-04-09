// WebSocket 事件类型

// 服务器 -> 客户端
export type ServerEventType =
  | 'agent:status'         // Agent 状态变更
  | 'agent:output'         // 流式文本输出
  | 'agent:tool_start'     // 工具使用开始
  | 'agent:tool_result'    // 工具使用结果
  | 'agent:error'          // 错误事件
  | 'agent:complete'       // 任务完成
  | 'workflow:progress'    // 工作流步骤进度
  | 'workflow:node_start'  // 节点开始执行
  | 'workflow:node_complete' // 节点完成
  | 'workflow:edge_active' // 数据流经边
  | 'task:updated'         // 任务状态变更
  | 'chat:message'         // 新聊天消息
  | 'system:notification'; // 系统通知

// 客户端 -> 服务器
export type ClientEventType =
  | 'agent:subscribe'      // 订阅 Agent 输出
  | 'agent:unsubscribe'    // 取消订阅
  | 'agent:message'        // 发送消息给 Agent
  | 'agent:interrupt'      // 中断 Agent
  | 'workflow:execute'     // 开始工作流
  | 'workflow:pause'       // 暂停工作流
  | 'chat:typing';         // 打字指示器

// 通用 WebSocket 消息
export interface WsMessage<T extends string = string, P = unknown> {
  type: T;
  payload: P;
  timestamp: number;
}

// Agent 状态变更事件
export interface AgentStatusPayload {
  agentId: string;
  status: import('./agent').AgentStatus;
  currentTask?: string | null;
  currentTool?: string | null;
}

// Agent 输出事件
export interface AgentOutputPayload {
  agentId: string;
  text: string;
}

// Agent 工具开始事件
export interface AgentToolStartPayload {
  agentId: string;
  toolName: string;
  toolInput: unknown;
  toolUseId: string;
}

// Agent 工具结果事件
export interface AgentToolResultPayload {
  agentId: string;
  toolUseId: string;
  output: string;
}

// Agent 完成事件
export interface AgentCompletePayload {
  agentId: string;
  result: string;
  sessionId: string;
  tokensUsed: number;
  cost: number;
}

// Agent 错误事件
export interface AgentErrorPayload {
  agentId: string;
  error: string;
}

// 工作流节点事件
export interface WorkflowNodePayload {
  workflowId: string;
  nodeId: string;
  agentId?: string;
}

// 任务更新事件
export interface TaskUpdatedPayload {
  taskId: string;
  status: import('./task').TaskStatus;
  assignedAgentId?: string | null;
}

// 聊天消息事件
export interface ChatMessagePayload {
  channelId: string;
  messageId: string;
  senderType: 'agent' | 'user' | 'system';
  senderAgentId?: string;
  content: string;
}
