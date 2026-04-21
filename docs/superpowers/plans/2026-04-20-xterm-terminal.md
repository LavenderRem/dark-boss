# xterm.js 终端模拟实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有的 div 渲染终端替换为 xterm.js 真实终端模拟器，支持 ANSI 颜色、高性能渲染、搜索、自动滚动等完整终端功能。

**Architecture:** 创建独立的 `XtermTerminal` 组件封装 xterm.js Terminal 实例，通过 `useRef` 管理命令式 API。保留现有 Zustand Store 作为持久化层（跨标签页切换不丢数据），xterm 仅负责渲染。新增 `terminal-theme.ts` 统一主题配置，新增 `terminal-search-bar.tsx` 提供搜索 UI。

**Tech Stack:** `@xterm/xterm` v5、`@xterm/addon-fit`、`@xterm/addon-search`、`@xterm/addon-web-links`、React 19、Zustand 5

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/client/package.json` | MODIFY | 新增 xterm.js 依赖 |
| `packages/client/vite.config.ts` | MODIFY | 新增 xterm vendor chunk |
| `packages/client/src/components/agent/terminal-theme.ts` | CREATE | 终端主题和 ANSI 颜色常量 |
| `packages/client/src/components/agent/xterm-terminal.tsx` | CREATE | xterm.js 封装组件 |
| `packages/client/src/components/agent/terminal-search-bar.tsx` | CREATE | 终端内搜索栏 |
| `packages/client/src/components/agent/agent-terminal.tsx` | MODIFY | 使用 XtermTerminal 替换 div 渲染 |

---

### Task 1: 安装 xterm.js 依赖

**Files:**
- Modify: `packages/client/package.json`
- Modify: `packages/client/vite.config.ts`

- [ ] **Step 1: 安装 xterm.js 包**

Run:
```bash
cd d:/AI/Projects/dark-boss && pnpm add @xterm/xterm @xterm/addon-fit @xterm/addon-search @xterm/addon-web-links --filter @dark-boss/client
```

Expected: 成功安装，`packages/client/package.json` 的 `dependencies` 新增 4 个包

- [ ] **Step 2: 更新 Vite 配置，添加 xterm vendor chunk**

将 `packages/client/vite.config.ts` 的 `build.rollupOptions.output.manualChunks` 替换为：

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd': ['antd', '@ant-design/icons'],
          'vendor-flow': ['@xyflow/react'],
          'vendor-charts': ['recharts'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-search', '@xterm/addon-web-links'],
        },
      },
    },
  },
});
```

- [ ] **Step 3: 验证安装成功**

Run:
```bash
cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/client typecheck
```

Expected: 无报错（新包尚未使用，不影响类型检查）

- [ ] **Step 4: Commit**

```bash
git add packages/client/package.json packages/client/vite.config.ts pnpm-lock.yaml
git commit -m "chore: 添加 xterm.js 及插件依赖"
```

---

### Task 2: 创建终端主题配置

**Files:**
- Create: `packages/client/src/components/agent/terminal-theme.ts`

- [ ] **Step 1: 创建主题文件**

创建 `packages/client/src/components/agent/terminal-theme.ts`：

```typescript
/**
 * xterm.js 终端主题和颜色配置
 * 与应用整体暗黑风格保持一致
 */
import type { ITheme } from '@xterm/xterm';

/** 暗黑终端主题 */
export const TERMINAL_THEME: ITheme = {
  background: '#0d1117',
  foreground: '#e8e8e8',
  cursor: '#e8e8e8',
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

/**
 * 输出通道 -> ANSI 颜色转义码
 * 用于将 Agent 不同类型输出着色
 */
export const CHANNEL_ANSI: Record<string, string> = {
  stdout: '\x1b[37m',       // 白色（标准输出）
  stderr: '\x1b[31m',       // 红色（错误输出）
  stdin: '\x1b[34m',        // 蓝色（用户输入）
  tool: '\x1b[33m',         // 黄色（工具调用）
  tool_result: '\x1b[32m',  // 绿色（工具结果）
};

/** ANSI 重置码 */
export const ANSI_RESET = '\x1b[0m';

/**
 * 将通道文本包装为 ANSI 着色字符串
 */
export function colorize(text: string, channel: string): string {
  const ansi = CHANNEL_ANSI[channel] ?? CHANNEL_ANSI.stdout;
  return `${ansi}${text}${ANSI_RESET}`;
}
```

- [ ] **Step 2: 验证类型检查**

Run:
```bash
cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/client typecheck
```

Expected: 通过，无报错

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/agent/terminal-theme.ts
git commit -m "feat: 添加终端主题和 ANSI 颜色配置"
```

---

### Task 3: 创建终端搜索栏组件

**Files:**
- Create: `packages/client/src/components/agent/terminal-search-bar.tsx`

- [ ] **Step 1: 创建搜索栏组件**

创建 `packages/client/src/components/agent/terminal-search-bar.tsx`：

```tsx
/**
 * 终端搜索栏组件
 * 覆盖在 xterm 终端上方，提供文本搜索功能
 * Ctrl+F 触发，Escape 关闭
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Button, Space } from 'antd';
import { SearchOutlined, UpOutlined, DownOutlined, CloseOutlined } from '@ant-design/icons';
import type { SearchAddon } from '@xterm/addon-search';

interface TerminalSearchBarProps {
  searchAddon: SearchAddon | null;
  onClose: () => void;
}

interface SearchResults {
  resultIndex: number;
  resultCount: number;
}

export function TerminalSearchBar({ searchAddon, onClose }: TerminalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ resultIndex: -1, resultCount: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const prevQueryRef = useRef('');

  // 自动聚焦输入框
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // 监听搜索结果变化
  useEffect(() => {
    if (!searchAddon) return;
    const disposable = searchAddon.onDidChangeResults((e) => {
      setResults({ resultIndex: e.resultIndex, resultCount: e.resultCount });
    });
    return () => disposable.dispose();
  }, [searchAddon]);

  // 执行搜索
  const doSearch = useCallback((searchQuery: string) => {
    if (!searchAddon || !searchQuery) return;
    searchAddon.findNext(searchQuery, {
      regex: false,
      wholeWord: false,
      caseSensitive: false,
      decorations: {
        matchBackground: '#ffd43b44',
        matchBorder: '#ffd43b',
        activeMatchBackground: '#ffd43b',
        activeMatchBorder: '#ff922b',
      },
    });
  }, [searchAddon]);

  // 查询变化时自动搜索
  useEffect(() => {
    if (!searchAddon) return;
    if (!query) {
      searchAddon.clearDecorations();
      setResults({ resultIndex: -1, resultCount: 0 });
      return;
    }
    doSearch(query);
    prevQueryRef.current = query;
  }, [query, searchAddon, doSearch]);

  const handleFindNext = () => {
    if (!searchAddon || !query) return;
    searchAddon.findNext(query);
  };

  const handleFindPrevious = () => {
    if (!searchAddon || !query) return;
    searchAddon.findPrevious(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      e.shiftKey ? handleFindPrevious() : handleFindNext();
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
        background: '#1a1a2e',
        border: '1px solid #303030',
        borderRadius: 6,
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
      onKeyDown={handleKeyDown}
    >
      <Input
        ref={inputRef as never}
        size="small"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索终端..."
        style={{
          width: 180,
          background: '#0d1117',
          borderColor: '#303030',
          color: '#e8e8e8',
          fontSize: 12,
        }}
        prefix={<SearchOutlined style={{ color: '#595959' }} />}
      />
      <span style={{ color: '#8c8c8c', fontSize: 11, minWidth: 50, textAlign: 'center' }}>
        {results.resultCount > 0
          ? `${results.resultIndex + 1}/${results.resultCount}`
          : query ? '无匹配' : ''}
      </span>
      <Space size={2}>
        <Button
          size="small"
          type="text"
          icon={<UpOutlined />}
          onClick={handleFindPrevious}
          disabled={!query || results.resultCount === 0}
          style={{ color: '#bfbfbf' }}
        />
        <Button
          size="small"
          type="text"
          icon={<DownOutlined />}
          onClick={handleFindNext}
          disabled={!query || results.resultCount === 0}
          style={{ color: '#bfbfbf' }}
        />
        <Button
          size="small"
          type="text"
          icon={<CloseOutlined />}
          onClick={onClose}
          style={{ color: '#8c8c8c' }}
        />
      </Space>
    </div>
  );
}
```

- [ ] **Step 2: 验证类型检查**

Run:
```bash
cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/client typecheck
```

Expected: 通过

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/agent/terminal-search-bar.tsx
git commit -m "feat: 添加终端搜索栏组件"
```

---

### Task 4: 创建 XtermTerminal 组件

**Files:**
- Create: `packages/client/src/components/agent/xterm-terminal.tsx`

- [ ] **Step 1: 创建 xterm 封装组件**

创建 `packages/client/src/components/agent/xterm-terminal.tsx`：

```tsx
/**
 * xterm.js 终端渲染组件
 * 封装 Terminal 实例生命周期、自动适应、搜索、链接检测
 * 接收 lines 数组作为数据源，内部管理 xterm 写入和滚动
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { TERMINAL_THEME, TERMINAL_FONT, colorize } from './terminal-theme';
import { TerminalSearchBar } from './terminal-search-bar';
import type { TerminalLine } from '../../stores/agent-terminal-store';

interface XtermTerminalProps {
  /** 终端行数据（来自 Zustand Store） */
  lines: TerminalLine[];
  /** 容器高度 */
  height?: number | string;
}

export function XtermTerminal({ lines, height = '100%' }: XtermTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const renderedCountRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const [showSearch, setShowSearch] = useState(false);

  /** 初始化 xterm Terminal 实例 */
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      theme: TERMINAL_THEME,
      fontSize: TERMINAL_FONT.size,
      fontFamily: TERMINAL_FONT.family,
      lineHeight: TERMINAL_FONT.lineHeight,
      cursorBlink: false,
      disableStdin: true,
      scrollback: 5000,
      convertEol: true,
      allowTransparency: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(containerRef.current);

    // 延迟 fit 确保 DOM 完成布局
    requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch { /* 终端可能尚未就绪 */ }
    });

    // 跟踪滚动位置，判断是否在底部
    terminal.onScroll(() => {
      const buffer = terminal.buffer.active;
      const maxScrollY = buffer.length - terminal.rows;
      isAtBottomRef.current = buffer.viewportY >= maxScrollY - 1;
    });

    // Ctrl+F 打开搜索
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type === 'keydown' && event.ctrlKey && event.key === 'f') {
        setShowSearch(true);
        return false;
      }
      return true;
    });

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
  }, []);

  /** 响应容器和窗口尺寸变化 */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      try { fitAddonRef.current?.fit(); } catch { /* 终端可能已销毁 */ }
    });
    resizeObserver.observe(container);

    const handleWindowResize = () => {
      try { fitAddonRef.current?.fit(); } catch { /* 忽略 */ }
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  /** 写入终端行 —— 增量写入新行，检测清屏 */
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    // 行数变少说明被清空了，重置终端
    if (lines.length < renderedCountRef.current) {
      terminal.clear();
      for (const line of lines) {
        terminal.writeln(colorize(line.text, line.channel));
      }
      renderedCountRef.current = lines.length;
      return;
    }

    // 只写入新增行
    for (let i = renderedCountRef.current; i < lines.length; i++) {
      const line = lines[i];
      terminal.writeln(colorize(line.text, line.channel));
    }
    renderedCountRef.current = lines.length;

    // 自动滚动到底部（仅在用户已处于底部时）
    if (isAtBottomRef.current) {
      terminal.scrollToBottom();
    }
  }, [lines]);

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
}
```

- [ ] **Step 2: 验证类型检查**

Run:
```bash
cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/client typecheck
```

Expected: 通过

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/agent/xterm-terminal.tsx
git commit -m "feat: 添加 xterm.js 终端渲染组件"
```

---

### Task 5: 改造 AgentTerminal 集成 xterm

**Files:**
- Modify: `packages/client/src/components/agent/agent-terminal.tsx`

- [ ] **Step 1: 重写 AgentTerminal 组件**

将 `packages/client/src/components/agent/agent-terminal.tsx` 全部内容替换为：

```tsx
/**
 * Agent 终端组件
 * 使用 xterm.js 真实终端模拟器显示 Agent 实时输出
 * 状态保存在全局 Store 中，切换员工时不会丢失
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Button, Space, Tag, Tooltip } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  SendOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useWsMessage, useWsSend } from '../../hooks/use-ws.js';
import { useAgentTerminalStore } from '../../stores/agent-terminal-store.js';
import { XtermTerminal } from './xterm-terminal.js';
import type { AgentProcessOutputPayload, AgentProcessStatusPayload } from '@dark-boss/shared';

// 稳定引用，避免 Zustand selector 每次返回新对象导致无限渲染
const EMPTY_LINES: Array<{ text: string; channel: string; time: number }> = [];

interface AgentTerminalProps {
  agentId: string;
  agentName: string;
  /** 是否显示控制按钮（启动/停止/重启） */
  showControls?: boolean;
  /** 终端高度 */
  height?: number | string;
}

export function AgentTerminal({
  agentId,
  agentName,
  showControls = true,
  height = 400,
}: AgentTerminalProps) {
  const [inputValue, setInputValue] = useState('');
  const wsSend = useWsSend();

  // 从全局 Store 获取当前 Agent 的终端状态
  const lines = useAgentTerminalStore(s => s.terminals[agentId]?.lines ?? EMPTY_LINES);
  const processStatus = useAgentTerminalStore(s => s.terminals[agentId]?.processStatus ?? 'stopped');
  const appendLine = useAgentTerminalStore(s => s.appendLine);
  const setProcessStatus = useAgentTerminalStore(s => s.setProcessStatus);
  const clearLines = useAgentTerminalStore(s => s.clearLines);

  // 订阅 WebSocket 消息
  useWsMessage(useCallback((msg) => {
    if (msg.type === 'agent:process_output') {
      const payload = msg.payload as AgentProcessOutputPayload;
      appendLine(payload.agentId, {
        text: payload.text,
        channel: payload.channel || 'stdout',
        time: Date.now(),
      });
    }

    if (msg.type === 'agent:process_status') {
      const payload = msg.payload as AgentProcessStatusPayload;
      setProcessStatus(payload.agentId, payload.status);
    }
  }, [appendLine, setProcessStatus]));

  const handleSend = () => {
    if (!inputValue.trim()) return;
    wsSend('agent:send_message', { agentId, message: inputValue.trim() });
    setInputValue('');
  };

  const handleSpawn = () => wsSend('agent:spawn', { agentId });
  const handleStop = () => wsSend('agent:stop', { agentId });
  const handleRestart = () => wsSend('agent:restart', { agentId });
  const handleClear = () => clearLines(agentId);

  const statusColor = processStatus === 'running' ? '#52c41a'
    : processStatus === 'error' ? '#ff4d4f'
    : processStatus === 'idle' ? '#52c41a'
    : processStatus === 'starting' ? '#faad14'
    : processStatus === 'stopping' ? '#faad14'
    : '#8c8c8c';

  // 工具栏 + 终端 + 输入框的总高度布局
  const toolbarHeight = 38;
  const inputBarHeight = 48;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height }}>
      {/* 工具栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        background: '#1a1a2e',
        borderBottom: '1px solid #303030',
        borderRadius: '6px 6px 0 0',
        height: toolbarHeight,
        flexShrink: 0,
      }}>
        <Space size={8}>
          <span style={{ color: '#bfbfbf', fontSize: 13, fontWeight: 500 }}>
            {agentName}
          </span>
          <Tag color={statusColor} style={{ margin: 0, fontSize: 11 }}>
            {processStatus === 'running' ? '执行中' :
             processStatus === 'idle' ? '就绪' :
             processStatus === 'starting' ? '启动中' :
             processStatus === 'stopping' ? '停止中' :
             processStatus === 'error' ? '出错' : '已停止'}
          </Tag>
        </Space>
        {showControls && (
          <Space size={4}>
            <Tooltip title="启动">
              <Button
                size="small"
                type="text"
                icon={<PlayCircleOutlined />}
                disabled={processStatus === 'running' || processStatus === 'idle' || processStatus === 'starting'}
                onClick={handleSpawn}
                style={{ color: '#52c41a' }}
              />
            </Tooltip>
            <Tooltip title="停止">
              <Button
                size="small"
                type="text"
                icon={<PauseCircleOutlined />}
                disabled={processStatus === 'stopped'}
                onClick={handleStop}
                style={{ color: '#ff4d4f' }}
              />
            </Tooltip>
            <Tooltip title="重启">
              <Button
                size="small"
                type="text"
                icon={<ReloadOutlined />}
                disabled={processStatus === 'stopped'}
                onClick={handleRestart}
                style={{ color: '#faad14' }}
              />
            </Tooltip>
            <Tooltip title="清屏">
              <Button
                size="small"
                type="text"
                icon={<ClearOutlined />}
                onClick={handleClear}
                style={{ color: '#8c8c8c' }}
              />
            </Tooltip>
          </Space>
        )}
      </div>

      {/* xterm.js 终端渲染区 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <XtermTerminal
          lines={lines}
          height="100%"
        />
      </div>

      {/* 输入框 */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '8px 12px',
        background: '#1a1a2e',
        borderTop: '1px solid #303030',
        borderRadius: '0 0 6px 6px',
        height: inputBarHeight,
        flexShrink: 0,
        boxSizing: 'border-box',
      }}>
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onPressEnter={handleSend}
          placeholder={`向 ${agentName} 发送消息... (Ctrl+F 搜索终端)`}
          disabled={processStatus !== 'running' && processStatus !== 'idle'}
          style={{
            background: '#0d1117',
            borderColor: '#303030',
            color: '#e8e8e8',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            fontSize: 13,
          }}
        />
        <Button
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={!inputValue.trim() || (processStatus !== 'running' && processStatus !== 'idle')}
          type="primary"
        >
          发送
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证类型检查**

Run:
```bash
cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/client typecheck
```

Expected: 通过。如果有类型错误，检查 `@xterm/xterm` 的类型导出路径

- [ ] **Step 3: 构建验证**

Run:
```bash
cd d:/AI/Projects/dark-boss && pnpm build
```

Expected: 构建成功，xterm 相关包被正确打包到 `vendor-xterm` chunk

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/agent/agent-terminal.tsx
git commit -m "feat: 使用 xterm.js 替换 div 渲染终端"
```

---

### Task 6: 集成测试与手动验证

**Files:**
- 无新增/修改

- [ ] **Step 1: 启动开发服务器**

Run:
```bash
cd d:/AI/Projects/dark-boss && pnpm dev
```

Expected: 前端 http://localhost:5173 和后端 http://localhost:3000 均正常启动

- [ ] **Step 2: 浏览器打开前端页面**

在浏览器中访问 http://localhost:5173，进入员工管理页面

- [ ] **Step 3: 验证终端渲染**

检查项：
- [ ] 终端区域显示黑色背景 + 等宽字体（JetBrains Mono）
- [ ] 点击「启动」按钮后，终端输出显示为等宽字体而非普通 div
- [ ] 输出颜色区分：stdout(白)、stderr(红)、stdin(蓝)、tool(黄)、tool_result(绿)
- [ ] 高频输出时终端不卡顿（xterm Canvas 渲染性能优于 DOM）
- [ ] 终端内容可选择和复制（鼠标选择高亮）

- [ ] **Step 4: 验证搜索功能**

检查项：
- [ ] 点击终端获取焦点后，按 Ctrl+F 弹出搜索栏
- [ ] 输入关键词后自动高亮匹配项
- [ ] 搜索栏显示 "X/Y" 匹配计数
- [ ] 上/下箭头可切换匹配项
- [ ] Escape 或关闭按钮关闭搜索栏

- [ ] **Step 5: 验证自适应大小**

检查项：
- [ ] 调整浏览器窗口大小，终端自动适应
- [ ] 在不同屏幕尺寸下终端正常显示
- [ ] 侧边栏折叠/展开时终端自动 resize

- [ ] **Step 6: 验证自动滚动**

检查项：
- [ ] 滚动到底部时，新输出自动滚动到底部
- [ ] 向上滚动查看历史时，新输出不会强制滚动到底部
- [ ] 滚回底部后恢复自动滚动

- [ ] **Step 7: 验证链接检测**

检查项：
- [ ] 终端中出现的 URL 可点击
- [ ] 点击 URL 在新标签页打开

- [ ] **Step 8: 最终提交（如有修复）**

```bash
git add -A
git commit -m "fix: xterm 终端集成修复"
```

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| xterm.js CSS 未正确加载 | Medium | High | 检查 `@xterm/xterm/css/xterm.css` 导入路径是否被 Vite 正确处理 |
| React Strict Mode 双重初始化 | Medium | Medium | cleanup 中重置 renderedCountRef，确保重新初始化时回放所有行 |
| WebLinksAddon URL 检测误判 | Low | Low | 可通过正则配置调整 URL 检测规则 |
| 搜索栏定位被父容器 overflow 裁剪 | Medium | Medium | 确保 XtermTerminal 容器 `position: relative` 且无 `overflow: hidden` |
| xterm worker 在 Vite 中加载失败 | Low | High | 如遇 worker 问题，配置 Vite `worker` 选项或使用 CDN fallback |

## Notes

- 此计划聚焦于 xterm.js 终端替换，不涉及服务端改动
- 现有 Zustand Store 保持不变，xterm 仅作为渲染层
- Store 的 5000 行限制与 xterm 的 `scrollback: 5000` 一致
- `disableStdin: true` 阻止用户在终端中输入，消息通过底部输入框发送
- 搜索功能使用 SearchAddon，不依赖外部搜索库
