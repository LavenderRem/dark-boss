import { useMemo } from 'react';
import type { Task, Agent } from '@dark-boss/shared';

export interface AgentWorkload {
  agentId: string;
  agent: Agent;
  inProgressCount: number;
  todoCount: number;
  totalCount: number;
  loadPercent: number;
  level: 'idle' | 'moderate' | 'busy' | 'offline';
}

export function useAgentWorkload(tasks: Task[], agents: Agent[]): AgentWorkload[] {
  return useMemo(() => {
    return agents.map(agent => {
      const agentTasks = tasks.filter(t => t.assignedAgentId === agent.id);
      const inProgressCount = agentTasks.filter(t => t.status === 'in_progress').length;
      const todoCount = agentTasks.filter(t => t.status === 'todo').length;
      const totalCount = agentTasks.length;
      const loadPercent = Math.min(Math.round((inProgressCount / 5) * 100), 100);

      let level: AgentWorkload['level'];
      if (agent.status === 'offline') level = 'offline';
      else if (inProgressCount === 0) level = 'idle';
      else if (inProgressCount <= 2) level = 'moderate';
      else level = 'busy';

      return { agentId: agent.id, agent, inProgressCount, todoCount, totalCount, loadPercent, level };
    });
  }, [tasks, agents]);
}
