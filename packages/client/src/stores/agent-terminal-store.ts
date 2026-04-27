/**
 * Agent 终端全局状态 Store
 * 按 agentId 保存每个 Agent 的终端事件流、进程状态，切换员工时状态不丢失
 */
import { create } from 'zustand';
import type {
  TerminalEvent,
  TerminalStatus,
} from '@dark-boss/shared';

// 单个 Agent 的终端状态
interface AgentTerminalState {
  events: TerminalEvent[];
  processStatus: string;
  status: TerminalStatus;
  permissionPending: {
    toolName: string;
    input: Record<string, unknown>;
    options: string[];
  } | null;
}

// Store 结构
interface AgentTerminalStore {
  // 按 agentId 索引的终端状态
  terminals: Record<string, AgentTerminalState>;

  // 追加终端事件
  appendEvent: (agentId: string, event: TerminalEvent) => void;
  // 批量追加终端事件
  appendEvents: (agentId: string, events: TerminalEvent[]) => void;
  // 设置进程状态
  setProcessStatus: (agentId: string, status: string) => void;
  // 更新终端状态（模型/token/费用）
  updateStatus: (agentId: string, status: TerminalStatus) => void;
  // 设置待响应的权限请求
  setPermissionPending: (agentId: string, permission: AgentTerminalState['permissionPending']) => void;
  // 清空某个 Agent 的事件
  clearEvents: (agentId: string) => void;
  // 获取某个 Agent 的终端状态
  getTerminal: (agentId: string) => AgentTerminalState;
}

const MAX_EVENTS = 5000;

const DEFAULT_STATUS: TerminalStatus = {
  model: '',
  tokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  cost: 0,
};

const DEFAULT_TERMINAL: AgentTerminalState = {
  events: [],
  processStatus: 'stopped',
  status: DEFAULT_STATUS,
  permissionPending: null,
};

export const useAgentTerminalStore = create<AgentTerminalStore>((set, get) => ({
  terminals: {},

  appendEvent: (agentId, event) => {
    set(state => {
      const current = state.terminals[agentId] || { ...DEFAULT_TERMINAL, events: [] };
      const nextEvents = [...current.events, event];

      // 如果是权限事件，同时设置 permissionPending
      const permissionPending = event.type === 'permission'
        ? { toolName: event.toolName, input: event.input, options: event.options }
        : current.permissionPending;

      // 如果是状态事件，同时更新 status
      const statusUpdate = event.type === 'status'
        ? { model: event.model, tokens: event.tokens, inputTokens: event.inputTokens, outputTokens: event.outputTokens, cost: event.cost }
        : current.status;

      return {
        terminals: {
          ...state.terminals,
          [agentId]: {
            ...current,
            events: nextEvents.length > MAX_EVENTS ? nextEvents.slice(-MAX_EVENTS) : nextEvents,
            permissionPending,
            status: statusUpdate,
          },
        },
      };
    });
  },

  appendEvents: (agentId, newEvents) => {
    if (newEvents.length === 0) return;
    set(state => {
      const current = state.terminals[agentId] || { ...DEFAULT_TERMINAL, events: [] };
      const nextEvents = [...current.events, ...newEvents];

      // 从新事件中提取最新状态（从后往前找）
      let permissionPending = current.permissionPending;
      let statusUpdate = current.status;

      for (let i = newEvents.length - 1; i >= 0; i--) {
        const event = newEvents[i];
        if (!permissionPending && event.type === 'permission') {
          permissionPending = { toolName: event.toolName, input: event.input, options: event.options };
        }
        if (event.type === 'status') {
          statusUpdate = { model: event.model, tokens: event.tokens, inputTokens: event.inputTokens, outputTokens: event.outputTokens, cost: event.cost };
        }
      }

      return {
        terminals: {
          ...state.terminals,
          [agentId]: {
            ...current,
            events: nextEvents.length > MAX_EVENTS ? nextEvents.slice(-MAX_EVENTS) : nextEvents,
            permissionPending,
            status: statusUpdate,
          },
        },
      };
    });
  },

  setProcessStatus: (agentId, status) => {
    set(state => {
      const current = state.terminals[agentId] || { ...DEFAULT_TERMINAL, events: [] };
      return {
        terminals: {
          ...state.terminals,
          [agentId]: { ...current, processStatus: status },
        },
      };
    });
  },

  updateStatus: (agentId, status) => {
    set(state => {
      const current = state.terminals[agentId] || { ...DEFAULT_TERMINAL, events: [] };
      return {
        terminals: {
          ...state.terminals,
          [agentId]: { ...current, status },
        },
      };
    });
  },

  setPermissionPending: (agentId, permission) => {
    set(state => {
      const current = state.terminals[agentId] || { ...DEFAULT_TERMINAL, events: [] };
      return {
        terminals: {
          ...state.terminals,
          [agentId]: { ...current, permissionPending: permission },
        },
      };
    });
  },

  clearEvents: (agentId) => {
    set(state => {
      const current = state.terminals[agentId];
      if (!current) return state;
      return {
        terminals: {
          ...state.terminals,
          [agentId]: { ...current, events: [] },
        },
      };
    });
  },

  getTerminal: (agentId) => {
    return get().terminals[agentId] || DEFAULT_TERMINAL;
  },
}));
