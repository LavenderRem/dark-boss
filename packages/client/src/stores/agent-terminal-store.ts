/**
 * Agent 终端全局状态 Store
 * 按 agentId 保存每个 Agent 的终端输出、进程状态，切换员工时状态不丢失
 */
import { create } from 'zustand';

// 单条终端输出
export interface TerminalLine {
  text: string;
  channel: string;
  time: number;
  toolName?: string;
  toolInput?: string;
}

// 单个 Agent 的终端状态
interface AgentTerminalState {
  lines: TerminalLine[];
  processStatus: string;
}

// Store 结构
interface AgentTerminalStore {
  // 按 agentId 索引的终端状态
  terminals: Record<string, AgentTerminalState>;

  // 追加一行输出
  appendLine: (agentId: string, line: TerminalLine) => void;
  // 设置进程状态
  setProcessStatus: (agentId: string, status: string) => void;
  // 清空某个 Agent 的输出
  clearLines: (agentId: string) => void;
  // 获取某个 Agent 的终端状态（不存在则返回默认值）
  getTerminal: (agentId: string) => AgentTerminalState;
}

const MAX_LINES = 5000;

// 稳定引用的默认值，避免每次返回新对象
const EMPTY_LINES: TerminalLine[] = [];
const DEFAULT_TERMINAL: AgentTerminalState = {
  lines: EMPTY_LINES,
  processStatus: 'stopped',
};

export const useAgentTerminalStore = create<AgentTerminalStore>((set, get) => ({
  terminals: {},

  appendLine: (agentId, line) => {
    set(state => {
      const current = state.terminals[agentId] || { ...DEFAULT_TERMINAL };
      const nextLines = [...current.lines, line];
      return {
        terminals: {
          ...state.terminals,
          [agentId]: {
            ...current,
            lines: nextLines.length > MAX_LINES ? nextLines.slice(-MAX_LINES) : nextLines,
          },
        },
      };
    });
  },

  setProcessStatus: (agentId, status) => {
    set(state => {
      const current = state.terminals[agentId] || { ...DEFAULT_TERMINAL };
      return {
        terminals: {
          ...state.terminals,
          [agentId]: { ...current, processStatus: status },
        },
      };
    });
  },

  clearLines: (agentId) => {
    set(state => {
      const current = state.terminals[agentId];
      if (!current) return state;
      return {
        terminals: {
          ...state.terminals,
          [agentId]: { ...current, lines: [] },
        },
      };
    });
  },

  getTerminal: (agentId) => {
    return get().terminals[agentId] || DEFAULT_TERMINAL;
  },
}));
