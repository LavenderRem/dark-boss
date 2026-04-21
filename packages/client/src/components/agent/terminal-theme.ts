/**
 * xterm.js 终端主题和颜色配置
 * 与应用整体暗黑风格保持一致
 */
import type { ITheme } from '@xterm/xterm';

/** 暗黑终端主题 */
export const TERMINAL_THEME: ITheme = {
  background: '#0d1117',
  foreground: '#e8e8e8',
  cursor: '#69b7ff',
  cursorAccent: '#0d1117',
  selectionBackground: '#264f78',
  selectionForeground: '#e8e8e8',
  selectionInactiveBackground: '#1a3a5c',
  black: '#0d1117',
  red: '#ff6b6b',
  green: '#8ce99a',
  yellow: '#ffd43b',
  blue: '#69b7ff',
  magenta: '#da77f2',
  cyan: '#66d9e8',
  white: '#e8e8e8',
  brightBlack: '#595959',
  brightRed: '#ff8787',
  brightGreen: '#b2f2bb',
  brightYellow: '#ffe066',
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
