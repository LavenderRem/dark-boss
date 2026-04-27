/**
 * xterm.js 纯显示终端组件
 * 仅渲染终端事件，不接受键盘输入
 */
import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import type { TerminalEvent } from '@dark-boss/shared';
import {
  TERMINAL_THEME, TERMINAL_FONT,
  renderEvent, renderSeparator,
} from './terminal-theme';
import { TerminalSearchBar } from './terminal-search-bar';

interface XtermTerminalProps {
  events: TerminalEvent[];
  height?: number | string;
  /** 供容器层 Ctrl+F 搜索使用 */
  onSearchAddonReady?: (addon: SearchAddon) => void;
}

export interface XtermTerminalHandle {
  writeSeparator: (label: string) => void;
}

export const XtermTerminal = forwardRef<XtermTerminalHandle, XtermTerminalProps>(
  function XtermTerminal({
    events,
    height = '100%',
    onSearchAddonReady,
  }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const searchAddonRef = useRef<SearchAddon | null>(null);
    const renderedCountRef = useRef(0);
    const isAtBottomRef = useRef(true);
    const lastToolNameRef = useRef<string | undefined>(undefined);
    const [showSearch, setShowSearch] = useState(false);

    const writeSeparatorToTerminal = useCallback((label: string) => {
      const terminal = terminalRef.current;
      if (!terminal) return;
      terminal.write(renderSeparator(label));
    }, []);

    useImperativeHandle(ref, () => ({
      writeSeparator: writeSeparatorToTerminal,
    }), [writeSeparatorToTerminal]);

    /** 初始化 xterm Terminal 实例 */
    useEffect(() => {
      if (!containerRef.current) return;

      const terminal = new Terminal({
        theme: TERMINAL_THEME,
        fontSize: TERMINAL_FONT.size,
        fontFamily: TERMINAL_FONT.family,
        lineHeight: TERMINAL_FONT.lineHeight,
        cursorBlink: false,
        cursorStyle: 'block',
        disableStdin: true,
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

      // 跟踪滚动位置
      terminal.onScroll(() => {
        const buffer = terminal.buffer.active;
        const maxScrollY = buffer.length - terminal.rows;
        isAtBottomRef.current = buffer.viewportY >= maxScrollY - 1;
      });

      // 通知容器层 searchAddon 已就绪
      onSearchAddonReady?.(searchAddon);

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;

      return () => {
        renderedCountRef.current = 0;
        isAtBottomRef.current = true;
        terminal.dispose();
        terminalRef.current = null;
        fitAddonRef.current = null;
        searchAddonRef.current = null;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    /** 写入终端事件 */
    useEffect(() => {
      const terminal = terminalRef.current;
      if (!terminal) return;

      // 清屏检测
      if (events.length < renderedCountRef.current) {
        terminal.clear();
        for (const event of events) {
          if (event.type === 'tool_use') lastToolNameRef.current = event.name;
          const rendered = renderEvent(event, lastToolNameRef.current);
          if (rendered) terminal.write(rendered);
        }
        renderedCountRef.current = events.length;
        return;
      }

      // 增量写入新事件
      for (let i = renderedCountRef.current; i < events.length; i++) {
        const event = events[i];
        if (event.type === 'tool_use') lastToolNameRef.current = event.name;
        const rendered = renderEvent(event, lastToolNameRef.current);
        if (rendered) terminal.write(rendered);
      }
      renderedCountRef.current = events.length;

      if (isAtBottomRef.current) {
        terminal.scrollToBottom();
      }
    }, [events]);

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
