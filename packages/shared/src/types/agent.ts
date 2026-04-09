// Agent 状态
export type AgentStatus = 'idle' | 'working' | 'waiting' | 'error' | 'offline';

// Agent 角色（职位）
export type AgentRole =
  | 'frontend'      // 前端开发
  | 'backend'       // 后端开发
  | 'fullstack'     // 全栈开发
  | 'architect'     // 架构师
  | 'tester'        // 测试工程师
  | 'devops'        // 运维工程师
  | 'dba'           // 数据库管理员
  | 'pm'            // 产品经理
  | 'po'            // 产品负责人
  | 'designer'      // 设计师
  | 'custom';       // 自定义

// Agent 配置
export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  sessionId: string | null;
  cwd: string;
  model: 'sonnet' | 'opus' | 'haiku';
  permissionMode: 'bypass' | 'acceptEdits' | 'plan';
  tokensUsed: number;
  totalCost: number;
  currentTask: string | null;
  currentTool: string | null;
  departmentId: string | null;
  bossAgentId: string | null;
  isBoss: boolean;
  customInstructions: string | null;
  allowedTools: string[];
  mcpServers: Record<string, MCPServerConfig> | null;
  templateId: string | null;
  createdAt: Date;
  lastActivityAt: Date | null;
}

// MCP 服务器配置
export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

// 创建 Agent 请求
export interface CreateAgentRequest {
  name: string;
  role: AgentRole;
  cwd: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  permissionMode?: 'bypass' | 'acceptEdits' | 'plan';
  customInstructions?: string;
  allowedTools?: string[];
  mcpServers?: Record<string, MCPServerConfig>;
  departmentId?: string;
  isBoss?: boolean;
  templateId?: string;
}

// 更新 Agent 请求
export interface UpdateAgentRequest {
  name?: string;
  role?: AgentRole;
  customInstructions?: string;
  allowedTools?: string[];
  departmentId?: string | null;
  bossAgentId?: string | null;
}
