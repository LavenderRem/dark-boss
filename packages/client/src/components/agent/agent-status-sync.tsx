/**
 * Agent 状态全局同步组件
 *
 * 订阅 WebSocket agent:process_status 事件，将进程状态实时同步到
 * React Query 的 agents 缓存，使所有 Agent 卡片自动更新。
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWsMessage } from '../../hooks/use-ws.js';
import type { Agent, AgentProcessStatusPayload, AgentStatus } from '@dark-boss/shared';

// 进程状态 → 业务状态映射
const PROCESS_TO_AGENT_STATUS: Record<string, AgentStatus> = {
  starting: 'working',
  running: 'working',
  idle: 'idle',
  stopped: 'offline',
  error: 'error',
};

export function AgentStatusSync() {
  const queryClient = useQueryClient();

  useWsMessage(useCallback((msg) => {
    if (msg.type !== 'agent:process_status') return;

    const payload = msg.payload as AgentProcessStatusPayload;
    const newStatus = PROCESS_TO_AGENT_STATUS[payload.status];
    if (!newStatus) return;

    queryClient.setQueryData<Agent[]>(['agents'], (old) => {
      if (!old) return old;
      return old.map(a =>
        a.id === payload.agentId ? { ...a, status: newStatus } : a
      );
    });
  }, [queryClient]));

  return null;
}
