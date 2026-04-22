import type { AgentRole } from '../types/agent.js';

// 默认 Agent 角色定义
export const AGENT_ROLES: Record<AgentRole, { label: string; icon: string; color: string }> = {
  frontend:  { label: '前端开发', icon: '💻', color: '#61dafb' },
  backend:   { label: '后端开发', icon: '⚙️', color: '#68a063' },
  fullstack: { label: '全栈开发', icon: '🔧', color: '#8b5cf6' },
  architect: { label: '架构师',   icon: '🏗️', color: '#f59e0b' },
  tester:    { label: '测试工程师', icon: '🧪', color: '#ef4444' },
  devops:    { label: '运维工程师', icon: '🚀', color: '#3b82f6' },
  dba:       { label: '数据库管理', icon: '🗄️', color: '#06b6d4' },
  pm:        { label: '产品经理',  icon: '📋', color: '#10b981' },
  po:        { label: '产品负责人', icon: '🎯', color: '#ec4899' },
  designer:  { label: '设计师',    icon: '🎨', color: '#f97316' },
  custom:    { label: '自定义',    icon: '👤', color: '#6b7280' },
};

// 默认允许的工具列表
export const DEFAULT_TOOLS = [
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Agent',
];

// Agent 状态颜色
export const AGENT_STATUS_COLORS: Record<string, string> = {
  idle: '#00d992',
  working: '#00d992',
  waiting: '#ffba00',
  error: '#fb565b',
  offline: '#8b949e',
};

// Agent 状态标签
export const AGENT_STATUS_LABELS: Record<string, string> = {
  idle: '空闲',
  working: '工作中',
  waiting: '等待中',
  error: '出错',
  offline: '离线',
};
