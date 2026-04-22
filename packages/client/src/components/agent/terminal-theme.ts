/**
 * xterm.js 终端主题和颜色配置
 * 基于 VoltAgent 设计系统
 */
import type { ITheme } from '@xterm/xterm';

/** 暗黑终端主题 */
export const TERMINAL_THEME: ITheme = {
  background: '#050507',
  foreground: '#f2f2f2',
  cursor: '#00d992',
  cursorAccent: '#050507',
  selectionBackground: 'rgba(0, 217, 146, 0.3)',
  selectionForeground: '#f2f2f2',
  selectionInactiveBackground: 'rgba(0, 217, 146, 0.15)',
  black: '#050507',
  red: '#fb565b',
  green: '#00d992',
  yellow: '#ffba00',
  blue: '#4cb3d4',
  magenta: '#818cf8',
  cyan: '#4cb3d4',
  white: '#f2f2f2',
  brightBlack: '#595959',
  brightRed: '#fd9c9f',
  brightGreen: '#2fd6a1',
  brightYellow: '#ffdd80',
  brightBlue: '#74c0fc',
  brightMagenta: '#e599f7',
  brightCyan: '#99e9f2',
  brightWhite: '#ffffff',
};

/** 终端字体配置 */
export const TERMINAL_FONT = {
  family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  size: 13,
  lineHeight: 1.4,
};

/** 输出通道 -> ANSI 颜色转义码 */
export const CHANNEL_ANSI: Record<string, string> = {
  stdout: '\x1b[37m',       // 白色
  stderr: '\x1b[31m',       // 红色
  stdin: '\x1b[34m',        // 蓝色
  tool: '\x1b[33m',         // 黄色
  tool_result: '\x1b[32m',  // 绿色
};

/** ANSI 格式常量 */
export const ANSI_RESET = '\x1b[0m';
export const ANSI_BOLD = '\x1b[1m';
export const ANSI_DIM = '\x1b[2m';
export const ANSI_UNDERLINE = '\x1b[4m';

/** 将文本包装为 ANSI 着色 */
export function colorize(text: string, channel: string): string {
  const ansi = CHANNEL_ANSI[channel] ?? CHANNEL_ANSI.stdout;
  return `${ansi}${text}${ANSI_RESET}`;
}

/** 生成彩色提示符 [agentName]$ */
export function formatPrompt(agentName: string): string {
  return `${ANSI_BOLD}\x1b[36m[${agentName}]\x1b[37m$ ${ANSI_RESET}`;
}

/** 工具调用 → 带边框的块 */
export function formatToolCall(toolName: string, toolInput?: string): string {
  const padding = Math.max(0, 40 - toolName.length);
  const top = `${ANSI_DIM}\x1b[33m┌── \x1b[1m\x1b[33m${toolName} \x1b[2m\x1b[33m${'─'.repeat(padding)}${ANSI_RESET}`;
  const inputLines = toolInput
    ? toolInput.split('\n').slice(0, 8).map(l => `${ANSI_DIM}\x1b[33m│${ANSI_RESET} ${l}`)
    : [];
  const bottom = `${ANSI_DIM}\x1b[33m└${'─'.repeat(48)}${ANSI_RESET}`;
  return [top, ...inputLines, bottom].join('\r\n');
}

/** 工具结果 → 绿色左边框 */
export function formatToolResult(output: string): string {
  const truncated = output.length > 200 ? output.slice(0, 200) + '...' : output;
  return truncated.split('\n').map(l => `${ANSI_DIM}\x1b[32m│${ANSI_RESET} ${l}`).join('\r\n');
}

/** 错误 → 红色加粗 */
export function formatError(message: string): string {
  return `${ANSI_BOLD}\x1b[31m✖ ${message}${ANSI_RESET}`;
}

/** 分隔线 */
export function formatSeparator(label: string): string {
  return `${ANSI_DIM}${'─'.repeat(10)} ${label} ${'─'.repeat(10)}${ANSI_RESET}`;
}
