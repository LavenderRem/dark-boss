import type { Agent } from '@dark-boss/shared';
import { getAssignmentSuggestions } from './assignment-suggestion';
import type { AgentWorkload } from '../hooks/use-agent-workload';

export function getSortedAgentsForAssign(
  agents: Agent[],
  workloads: AgentWorkload[],
  taskTitle: string,
  taskDescription: string | null,
  taskTags: string[]
): Agent[] {
  const workloadMap = new Map(workloads.map(w => [w.agentId, w.inProgressCount]));
  const suggestions = getAssignmentSuggestions(
    {
      title: taskTitle,
      description: taskDescription,
      tags: taskTags,
    },
    agents,
    workloadMap
  );

  const suggestionOrder = new Map(suggestions.map((s, idx) => [s.agentId, idx]));

  return [...agents].sort((a, b) => {
    const aOrder = suggestionOrder.get(a.id) ?? 999;
    const bOrder = suggestionOrder.get(b.id) ?? 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });
}
