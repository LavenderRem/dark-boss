/**
 * Claude Code CLI 风格终端渲染引擎
 * 使用 ANSI 转义码复刻 Claude Code CLI 的视觉效果
 */
import type { ITheme } from '@xterm/xterm';
import type { TerminalEvent } from '@dark-boss/shared';
import { getModelDisplayName } from '@dark-boss/shared';

// ─── ANSI 常量 ─────────────────────────────────────────────

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// 前景色
const F_RED = '\x1b[31m';
const F_GREEN = '\x1b[32m';
const F_YELLOW = '\x1b[33m';
const F_BLUE = '\x1b[34m';
const F_CYAN = '\x1b[36m';
const F_BRIGHT_BLACK = '\x1b[90m';

// ─── xterm.js 主题配置 ──────────────────────────────────────

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

export const TERMINAL_FONT = {
  family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  size: 13,
  lineHeight: 1.4,
};

// ─── 渲染函数 ───────────────────────────────────────────────

/**
 * ⏺ 工具调用渲染
 * 格式: ⏺ ToolName(key: value, key: value)
 */
export function renderToolUse(name: string, input: Record<string, unknown>): string {
  const params = formatToolParams(name, input);
  return `${BOLD}${F_GREEN}⏺ ${name}${RESET}${F_GREEN}(${params})${RESET}\r\n`;
}

/**
 * 智能参数摘要 — 根据工具类型选择最重要的参数
 */
function formatToolParams(name: string, input: Record<string, unknown>): string {
  const entries = Object.entries(input);
  if (entries.length === 0) return '';

  // 按工具类型优先显示参数
  const priorityKeys: Record<string, string[]> = {
    Read: ['file_path', 'offset', 'limit'],
    Write: ['file_path'],
    Edit: ['file_path', 'replace_all'],
    Bash: ['command'],
    Glob: ['pattern'],
    Grep: ['pattern', 'path'],
    Agent: ['description'],
  };

  const priority = priorityKeys[name] ?? entries.map(([k]) => k);
  const ordered = [...priority, ...entries.map(([k]) => k)].filter(
    (k, i, arr) => arr.indexOf(k) === i && input[k] !== undefined
  );

  const parts = ordered.slice(0, 4).map(key => {
    const val = input[key];
    const valStr = typeof val === 'string'
      ? val.length > 60 ? `"${val.slice(0, 57)}..."` : `"${val}"`
      : String(val);
    return `${F_CYAN}${key}${RESET}${F_GREEN}: ${F_YELLOW}${valStr}${RESET}`;
  });

  const result = parts.join(`${F_GREEN}, ${RESET}`);
  const remaining = entries.length - parts.length;
  if (remaining > 0) {
    return result + `${F_GREEN}, ...${RESET}`;
  }
  return result;
}

/**
 * 文件内容带行号渲染
 * 格式:   N │ content
 */
export function renderFileContent(content: string, startLine = 1): string {
  const lines = content.split('\n');
  const MAX_VISIBLE = 100;
  const CONTEXT = 20;

  // 如果行数超过阈值，折叠显示
  if (lines.length > MAX_VISIBLE) {
    const headLines = lines.slice(0, CONTEXT);
    const tailLines = lines.slice(-CONTEXT);
    const hidden = lines.length - CONTEXT * 2;
    const head = formatLineNumbers(headLines, startLine);
    const tail = formatLineNumbers(tailLines, startLine + lines.length - CONTEXT);
    return `${head}${DIM}${F_BRIGHT_BLACK}  ... (${hidden} lines hidden)${RESET}\r\n${tail}`;
  }

  return formatLineNumbers(lines, startLine);
}

function formatLineNumbers(lines: string[], startLine: number): string {
  const maxDigits = String(startLine + lines.length - 1).length;
  return lines.map((line, i) => {
    const lineNum = String(startLine + i).padStart(maxDigits);
    return `${DIM}${F_BRIGHT_BLACK}${lineNum} │${RESET} ${escapeLine(line)}`;
  }).join('\r\n') + '\r\n';
}

/**
 * Diff 视图渲染
 * 红色删除 / 绿色新增
 */
export function renderDiff(oldText: string, newText: string, _path?: string): string {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: string[] = [];

  // 简单逐行比较（不做真正的 diff 算法，保持简单）
  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine !== undefined && newLine !== undefined && oldLine !== newLine) {
      if (oldLine) result.push(`${F_RED}  - ${escapeLine(oldLine)}${RESET}`);
      if (newLine) result.push(`${F_GREEN}  + ${escapeLine(newLine)}${RESET}`);
    } else if (oldLine === undefined && newLine !== undefined) {
      result.push(`${F_GREEN}  + ${escapeLine(newLine)}${RESET}`);
    } else if (oldLine !== undefined && newLine === undefined) {
      result.push(`${F_RED}  - ${escapeLine(oldLine)}${RESET}`);
    } else if (oldLine !== undefined) {
      result.push(`${DIM}    ${escapeLine(oldLine!)}${RESET}`);
    }
  }

  return result.join('\r\n') + '\r\n';
}

/**
 * 工具结果渲染
 */
export function renderToolResult(content: string, isError: boolean, toolName?: string): string {
  if (isError) {
    return `${F_RED}${BOLD}  ✖ ${escapeLine(content)}${RESET}\r\n`;
  }

  // 根据工具名选择渲染方式
  if (toolName === 'Read' || toolName === 'Glob') {
    // 文件内容 — 带行号
    return renderFileContent(content);
  }

  if (toolName === 'Edit' || toolName === 'Write') {
    // 编辑结果 — 简洁确认
    return `${F_GREEN}  ✓ ${escapeLine(content.slice(0, 200))}${RESET}\r\n`;
  }

  if (toolName === 'Bash') {
    // Bash 输出 — 原样显示
    return content.split('\n').map(line =>
      `${DIM}${F_BRIGHT_BLACK}  │${RESET} ${escapeLine(line)}`
    ).join('\r\n') + '\r\n';
  }

  // 默认 — 内容预览
  const truncated = content.length > 300 ? content.slice(0, 300) + '...' : content;
  return truncated.split('\n').map(line =>
    `${DIM}${F_BRIGHT_BLACK}  │${RESET} ${escapeLine(line)}`
  ).join('\r\n') + '\r\n';
}

/**
 * 权限提示渲染
 * 格式: Allow ToolName for path? [y/n/a/e]
 */
export function renderPermissionPrompt(
  toolName: string,
  input: Record<string, unknown>,
  options: string[],
): string {
  const path = input.file_path || input.path || input.command || '';
  const pathStr = path ? ` for ${F_CYAN}${path}${RESET}` : '';
  const optionsStr = options.join('/');
  return `\r\n${BOLD}${F_YELLOW}Allow ${toolName}${pathStr}? [${optionsStr}]${RESET} `;
}

/**
 * 文本块渲染（Claude 回复）
 * 首行缩进 2 空格，段落间空行
 */
export function renderTextBlock(content: string): string {
  if (!content) return '';
  // 流式文本直接透传到终端，不做额外格式化
  // 内容本身已包含模型输出的格式（换行、缩进等），只需转义并转换换行符
  return escapeLine(content).replace(/\n/g, '\r\n');
}

/**
 * 用户输入回显
 * 格式:   > content（蓝色）
 */
export function renderUserInput(content: string): string {
  return `${F_BLUE}  > ${escapeLine(content)}${RESET}\r\n`;
}

/**
 * 错误信息渲染
 * 格式: ✖ message（红色加粗）
 */
export function renderError(message: string): string {
  return `${F_RED}${BOLD}✖ ${escapeLine(message)}${RESET}\r\n`;
}

/**
 * 底部状态栏渲染
 * 格式: ── ModelName · N tokens · $X.XXX ──
 */
export function renderStatusBar(model: string, tokens: number, cost: number): string {
  const modelName = getModelDisplayName(model);
  const tokenStr = tokens.toLocaleString();
  const costStr = cost < 0.001 ? '$0.000' : `$${cost.toFixed(3)}`;
  const content = `${modelName} · ${tokenStr} tokens · ${costStr}`;
  const separator = '──';
  return `${DIM}${F_BRIGHT_BLACK}${separator} ${content} ${separator}${RESET}\r\n`;
}

/**
 * 聊天式提示符
 * 格式: > （绿色）
 */
export function renderPrompt(): string {
  return `${BOLD}${F_GREEN}> ${RESET}`;
}

/**
 * 分隔线
 */
export function renderSeparator(label: string): string {
  return `${DIM}${F_BRIGHT_BLACK}── ${label} ──${RESET}\r\n`;
}

/**
 * 事件分发渲染 — 根据事件类型选择对应渲染器
 */
export function renderEvent(event: TerminalEvent, _lastToolName?: string): string {
  switch (event.type) {
    case 'text':
      return renderTextBlock(event.content);
    case 'tool_use':
      return renderToolUse(event.name, event.input);
    case 'tool_result':
      return renderToolResult(event.content, event.isError, _lastToolName);
    case 'permission':
      return renderPermissionPrompt(event.toolName, event.input, event.options);
    case 'status':
      // 状态事件不在终端内联渲染，由专用状态栏处理
      return '';
    case 'error':
      return renderError(event.message);
    case 'user_input':
      return renderUserInput(event.content);
    default:
      return '';
  }
}

/**
 * 转义可能干扰 ANSI 的字符
 */
function escapeLine(text: string): string {
  return text
    .replace(/\x1b/g, '')   // 移除嵌入的 ESC
    .replace(/\r/g, '');     // 移除嵌入的 CR
}
