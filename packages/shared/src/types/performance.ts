// 绩效快照
export interface PerformanceSnapshot {
  id: string;
  agentId: string;
  period: 'daily' | 'weekly' | 'monthly';
  periodStart: number;
  periodEnd: number;
  tasksCompleted: number;
  tasksFailed: number;
  avgCompletionMinutes: number | null;
  tokensUsed: number;
  totalCost: number;
  efficiencyScore: number | null;
  createdAt: number;
}

// 绩效报告（AI 生成）
export interface PerformanceReport {
  id: string;
  agentId: string;
  period: string;
  periodStart: number;
  periodEnd: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  score: number;
  createdAt: number;
}

// Agent 绩效概览（聚合视图）
export interface AgentPerformanceOverview {
  agentId: string;
  agentName: string;
  agentRole: string;
  agentStatus: string;
  departmentName: string | null;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksFailed: number;
  avgCompletionMinutes: number | null;
  tokensUsed: number;
  totalCost: number;
  efficiencyScore: number | null;
  last7DaysTasksCompleted: number;
  last7DaysTokensUsed: number;
}

// 团队仪表盘统计
export interface DashboardPerformanceStats {
  totalTasksCompleted: number;
  totalTasksInProgress: number;
  totalTasksFailed: number;
  avgEfficiencyScore: number;
  totalTokensUsed: number;
  totalCost: number;
  agentCount: number;
  activeAgentCount: number;
}

// 趋势数据点
export interface TrendDataPoint {
  date: string;
  tasksCompleted: number;
  tokensUsed: number;
  cost: number;
  efficiencyScore: number;
}
