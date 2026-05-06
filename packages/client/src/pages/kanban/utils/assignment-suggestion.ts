import type { Agent } from '@dark-boss/shared';
import { AGENT_ROLES } from '@dark-boss/shared';

interface Suggestion {
  agentId: string;
  score: number;
  reason: string;
}

function parseTags(tags: string[] | string | null | undefined): string[] {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string' && tags) { try { return JSON.parse(tags); } catch { return []; } }
  return [];
}

export function getAssignmentSuggestions(
  task: { title: string; description?: string | null; tags?: string[] | string },
  agents: Agent[],
  workloadMap: Map<string, number>
): Suggestion[] {
  const tagsArr = parseTags(task.tags);
  const taskText = `${task.title} ${(task.description || '')} ${tagsArr.join(' ')}`.toLowerCase();

  return agents
    .filter(a => a.status !== 'offline')
    .map(agent => {
      const roleInfo = AGENT_ROLES[agent.role];
      const roleKeywords = `${roleInfo.label} ${agent.role}`.toLowerCase();
      const roleMatch = roleKeywords.split(/\s+/).some(kw => taskText.includes(kw));
      const load = workloadMap.get(agent.id) || 0;
      const isOverloaded = load >= 3;

      let score = 0;
      if (roleMatch) score += 40;
      score += Math.max(0, 30 - load * 10);
      if (!isOverloaded) score += 20;

      const reasons: string[] = [];
      if (roleMatch) reasons.push(`${roleInfo.label}角色匹配`);
      if (load === 0) reasons.push('当前空闲');
      else if (load <= 2) reasons.push(`负载适中(${load}个任务)`);
      if (isOverloaded) reasons.push('⚠ 负载过高');

      return { agentId: agent.id, score, reason: reasons.join('，') };
    })
    .sort((a, b) => b.score - a.score);
}
