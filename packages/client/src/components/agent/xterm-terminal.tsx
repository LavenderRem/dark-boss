/**
 * xterm.js 交互式终端组件
 * 支持终端内输入、丰富 ANSI 渲染、工具调用边框、闪烁光标
 */
import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import {
  TERMINAL_THEME, TERMINAL_FONT, ANSI_BOLD, ANSI_DIM, ANSI_RESET,
  colorize, formatPrompt, formatToolCall, formatToolResult, formatError, formatSeparator,
} from './terminal-theme';
import { TerminalSearchBar } from './terminal-search-bar';
import type { TerminalLine } from '../../stores/agent-terminal-store';

interface XtermTerminalProps {
  lines: TerminalLine[];
  height?: number | string;
  agentName: string;
  onSubmit?: (message: string) => void;
}

export interface XtermTerminalHandle {
  writePrompt: () => void;
  writeSeparator: (label: string) => void;
}

export const XtermTerminal = forwardRef<XtermTerminalHandle, XtermTerminalProps>(
  function XtermTerminal({ lines, height = '100%', agentName, onSubmit }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const searchAddonRef = useRef<SearchAddon | null>(null);
    const renderedCountRef = useRef(0);
    const isAtBottomRef = useRef(true);
    const inputBufferRef = useRef('');
    const [showSearch, setShowSearch] = useState(false);

    const writePromptToTerminal = useCallback(() => {
      const terminal = terminalRef.current;
      if (!terminal) return;
      terminal.writeln('');
      terminal.write(formatPrompt(agentName));
    }, [agentName]);

    const writeSeparatorToTerminal = useCallback((label: string) => {
      const terminal = terminalRef.current;
      if (!terminal) return;
      terminal.writeln(formatSeparator(label));
    }, []);

    useImperativeHandle(ref, () => ({
      writePrompt: writePromptToTerminal,
      writeSeparator: writeSeparatorToTerminal,
    }), [writePromptToTerminal, writeSeparatorToTerminal]);

    /** 格式化单行终端输出 */
    const formatLine = useCallback((line: TerminalLine): string => {
      switch (line.channel) {
        case 'tool':
          return formatToolCall(line.toolName || 'unknown', line.toolInput);
        case 'tool_result':
          return formatToolResult(line.text);
        case 'stderr':
          return formatError(line.text);
        case 'stdin':
          return `${ANSI_BOLD}${colorize(line.text, 'stdin')}${ANSI_DIM}`;
        default:
          return colorize(line.text, 'stdout');
      }
    }, []);

    /** 初始化 xterm Terminal 实例 */
    useEffect(() => {
      if (!containerRef.current) return;

      const terminal = new Terminal({
        theme: TERMINAL_THEME,
        fontSize: TERMINAL_FONT.size,
        fontFamily: TERMINAL_FONT.family,
        lineHeight: TERMINAL_FONT.lineHeight,
        cursorBlink: true,
        cursorStyle: 'block',
        disableStdin: false,
        scrollback: 5000,
        convertEol: true,
        allowTransparency: true,
        allowProposedApi: true,
        drawBoldTextInBrightColors: true,
        fontWeight: 'normal',
        fontWeightBold: 'bold',
      });

      const fitAddon = new FitAddon();
      const searchAddon = new SearchAddon();
      const webLinksAddon = new WebLinksAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(searchAddon);
      terminal.loadAddon(webLinksAddon);

      terminal.open(containerRef.current);

      requestAnimationFrame(() => {
        try { fitAddon.fit(); } catch { /* ignore */ }
      });

      // 写欢迎信息 + 提示符
      terminal.writeln(`${ANSI_DIM}── ${agentName} 终端 ──${ANSI_RESET}`);
      terminal.write(formatPrompt(agentName));

      // 跟踪滚动位置
      terminal.onScroll(() => {
        const buffer = terminal.buffer.active;
        const maxScrollY = buffer.length - terminal.rows;
        isAtBottomRef.current = buffer.viewportY >= maxScrollY - 1;
      });

      // 键盘事件拦截 —— 全权控制输入
      terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        if (event.type !== 'keydown') return true;

        // Ctrl+F → 搜索
        if (event.ctrlKey && event.key === 'f') {
          setShowSearch(true);
          return false;
        }

        // 其他 Ctrl 组合键放行给浏览器
        if (event.ctrlKey || event.altKey || event.metaKey) return true;

        return false; // 阻止 xterm 自动处理普通按键
      });

      // 处理终端输入
      if (onSubmit) {
        terminal.onData((data: string) => {
          for (const ch of data) {
            if (ch === '\r') {
              // Enter → 提交
              const message = inputBufferRef.current;
              const len = inputBufferRef.current.length;
              // 擦除当前行输入（保留提示符）
              if (len > 0) {
                terminal.write(`\x1b[${len}D\x1b[K`);
              }
              inputBufferRef.current = '';
              if (message.trim()) {
                // 提交后不写新提示符，等 agent 回复后由状态转换写入
                onSubmit(message);
              } else {
                terminal.write(formatPrompt(agentName));
              }
            } else if (ch === '\x7f') {
              // Backspace
              if (inputBufferRef.current.length > 0) {
                inputBufferRef.current = inputBufferRef.current.slice(0, -1);
                terminal.write('\b \b');
              }
            } else if (ch === '\x03') {
              // Ctrl+C
              terminal.writeln('^C');
              inputBufferRef.current = '';
              terminal.write(formatPrompt(agentName));
            } else if (ch === '\x15') {
              // Ctrl+U → 清空当前输入
              const len = inputBufferRef.current.length;
              if (len > 0) {
                terminal.write(`\x1b[${len}D\x1b[K`);
              }
              inputBufferRef.current = '';
            } else if (ch >= ' ') {
              // 可打印字符 → 回显
              inputBufferRef.current += ch;
              terminal.write(ch);
            }
          }
        });
      }

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;

      return () => {
        renderedCountRef.current = 0;
        isAtBottomRef.current = true;
        inputBufferRef.current = '';
        terminal.dispose();
        terminalRef.current = null;
        fitAddonRef.current = null;
        searchAddonRef.current = null;
      };
    }, [agentName, onSubmit, formatLine]);

    /** 响应容器尺寸变化 */
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const resizeObserver = new ResizeObserver(() => {
        try { fitAddonRef.current?.fit(); } catch { /* ignore */ }
      });
      resizeObserver.observe(container);

      const handleResize = () => {
        try { fitAddonRef.current?.fit(); } catch { /* ignore */ }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', handleResize);
      };
    }, []);

    /** 写入终端行 */
    useEffect(() => {
      const terminal = terminalRef.current;
      if (!terminal) return;

      // 清屏检测
      if (lines.length < renderedCountRef.current) {
        terminal.clear();
        terminal.writeln(`${ANSI_DIM}── ${agentName} 终端 ──${ANSI_RESET}`);
        for (const line of lines) {
          terminal.writeln(formatLine(line));
        }
        terminal.write(formatPrompt(agentName));
        renderedCountRef.current = lines.length;
        return;
      }

      // 增量写入新行
      for (let i = renderedCountRef.current; i < lines.length; i++) {
        terminal.writeln(formatLine(lines[i]));
      }
      renderedCountRef.current = lines.length;

      if (isAtBottomRef.current) {
        terminal.scrollToBottom();
      }
    }, [lines, agentName, formatLine]);

    const handleCloseSearch = useCallback(() => {
      setShowSearch(false);
      searchAddonRef.current?.clearDecorations();
    }, []);

    return (
      <div style={{ position: 'relative', width: '100%', height }}>
        {showSearch && (
          <TerminalSearchBar
            searchAddon={searchAddonRef.current}
            onClose={handleCloseSearch}
          />
        )}
        <div
          ref={containerRef}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  },
);
