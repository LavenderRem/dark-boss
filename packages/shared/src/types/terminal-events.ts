/**
 * 终端事件类型定义
 * 后端 -> 前端的类型化终端事件协议，替代旧的 { text, channel } 格式
 */

/** Claude 回复文本 */
export interface TextTerminalEvent {
  type: 'text';
  content: string;
}

/** 工具调用 */
export interface ToolUseTerminalEvent {
  type: 'tool_use';
  name: string;
  input: Record<string, unknown>;
}

/** 工具执行结果 */
export interface ToolResultTerminalEvent {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError: boolean;
}

/** 权限确认请求 */
export interface PermissionTerminalEvent {
  type: 'permission';
  toolName: string;
  input: Record<string, unknown>;
  options: string[];
}

/** 状态更新（模型/token/费用） */
export interface StatusTerminalEvent {
  type: 'status';
  model: string;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

/** 错误信息 */
export interface ErrorTerminalEvent {
  type: 'error';
  message: string;
}

/** 用户输入回显 */
export interface UserInputTerminalEvent {
  type: 'user_input';
  content: string;
}

/** 终端事件联合类型 */
export type TerminalEvent =
  | TextTerminalEvent
  | ToolUseTerminalEvent
  | ToolResultTerminalEvent
  | PermissionTerminalEvent
  | StatusTerminalEvent
  | ErrorTerminalEvent
  | UserInputTerminalEvent;

/** 终端事件 WebSocket payload */
export interface TerminalEventPayload {
  agentId: string;
  event: TerminalEvent;
}

/** 权限响应 payload（前端 -> 后端） */
export interface PermissionResponsePayload {
  agentId: string;
  response: string;
}

/** 终端状态信息 */
export interface TerminalStatus {
  model: string;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

/** 模型标识 -> 可读名称映射 */
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'sonnet': 'Sonnet 4.6',
  'sonnet-4-6': 'Sonnet 4.6',
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'opus': 'Opus 4.7',
  'opus-4-7': 'Opus 4.7',
  'claude-opus-4-7': 'Opus 4.7',
  'haiku': 'Haiku 4.5',
  'haiku-4-5': 'Haiku 4.5',
  'claude-haiku-4-5': 'Haiku 4.5',
};

/** 根据模型标识获取可读名称 */
export function getModelDisplayName(model: string): string {
  return MODEL_DISPLAY_NAMES[model] ?? model;
}
