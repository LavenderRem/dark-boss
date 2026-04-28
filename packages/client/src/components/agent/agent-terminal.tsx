/**
 * Agent 终端容器组件
 * 连接 Store + WebSocket → XtermTerminal + 输入对话框
 */
import { useCallback, useRef, useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Button, Input, Space, Tooltip } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  ClearOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useWsMessage, useWsSend } from '../../hooks/use-ws.js';
import { useAgentTerminalStore } from '../../stores/agent-terminal-store.js';
import { XtermTerminal, type XtermTerminalHandle } from './xterm-terminal.js';
import type {
  TerminalEvent,
  AgentProcessStatusPayload,
  TerminalEventPayload,
} from '@dark-boss/shared';
import { getModelDisplayName } from '@dark-boss/shared';
import type { SearchAddon } from '@xterm/addon-search';

const EMPTY_EVENTS: TerminalEvent[] = [];
const DEFAULT_STATUS = { model: '', tokens: 0, inputTokens: 0, outputTokens: 0, cost: 0 };

interface AgentTerminalProps {
  agentId: string;
  agentName: string;
  showControls?: boolean;
  height?: number | string;
}

export function AgentTerminal({
  agentId,
  agentName,
  showControls = true,
  height = 400,
}: AgentTerminalProps) {
  const wsSend = useWsSend();
  const xtermRef = useRef<XtermTerminalHandle>(null);
  const prevStatusRef = useRef('stopped');
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputText, setInputText] = useState('');

  const events = useAgentTerminalStore(s => s.terminals[agentId]?.events ?? EMPTY_EVENTS);
  const processStatus = useAgentTerminalStore(s => s.terminals[agentId]?.processStatus ?? 'stopped');
  const terminalStatus = useAgentTerminalStore(s => s.terminals[agentId]?.status ?? DEFAULT_STATUS);
  const permissionPending = useAgentTerminalStore(s => s.terminals[agentId]?.permissionPending ?? null);
  const appendEvent = useAgentTerminalStore(s => s.appendEvent);
  const appendEvents = useAgentTerminalStore(s => s.appendEvents);
  const setProcessStatus = useAgentTerminalStore(s => s.setProcessStatus);
  const clearEvents = useAgentTerminalStore(s => s.clearEvents);

  const isRunning = processStatus === 'running' || processStatus === 'starting';
  const isDisabled = isRunning || processStatus === 'stopping' || processStatus === 'warming';

  // WebSocket 消息缓冲 — 合并高频 text 事件
  const eventBufferRef = useRef<TerminalEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBufferedEvents = useCallback(() => {
    flushTimerRef.current = null;
    const buffered = eventBufferRef.current;
    if (buffered.length === 0) return;
    eventBufferRef.current = [];
    appendEvents(agentId, buffered);
  }, [agentId, appendEvents]);

  const bufferEvent = useCallback((event: TerminalEvent) => {
    // 非 text 事件立即 flush 缓冲后直接发送
    if (event.type !== 'text') {
      if (eventBufferRef.current.length > 0) flushBufferedEvents();
      appendEvent(agentId, event);
      return;
    }
    // text 事件缓冲
    eventBufferRef.current.push(event);
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(flushBufferedEvents, 50);
    }
  }, [agentId, appendEvent, flushBufferedEvents]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (eventBufferRef.current.length > 0) {
        appendEvents(agentId, eventBufferRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 订阅 WebSocket 消息
  useWsMessage(useCallback((msg) => {
    if (msg.type === 'agent:terminal_event') {
      const payload = msg.payload as TerminalEventPayload;
      if (payload.agentId === agentId) {
        bufferEvent(payload.event);
      }
    }

    // agent:process_output 是旧协议 fallback，已在 agent:terminal_event 中完整处理
    // 不再从此处渲染文本，避免重复显示

    if (msg.type === 'agent:process_status') {
      const payload = msg.payload as AgentProcessStatusPayload;
      if (payload.agentId === agentId) {
        setProcessStatus(payload.agentId, payload.status);
      }
    }
  }, [agentId, appendEvent, setProcessStatus]));

  // Agent 状态转换时写分隔线
  useEffect(() => {
    if (prevStatusRef.current === 'running' && processStatus === 'idle') {
      xtermRef.current?.writeSeparator('完成');
    }
    prevStatusRef.current = processStatus;
  }, [processStatus]);

  // 权限请求时聚焦输入框
  useEffect(() => {
    if (permissionPending) {
      inputRef.current?.focus();
    }
  }, [permissionPending]);

  const handleTerminalSubmit = useCallback((message: string) => {
    wsSend('agent:send_message', { agentId, message });
  }, [wsSend, agentId]);

  const handlePermissionResponse = useCallback((response: string) => {
    wsSend('agent:permission_response', { agentId, response });
  }, [wsSend, agentId]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;

    if (permissionPending) {
      handlePermissionResponse(text);
    } else {
      handleTerminalSubmit(text);
    }
    setInputText('');
  }, [inputText, permissionPending, handlePermissionResponse, handleTerminalSubmit]);

  const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleSearchAddonReady = useCallback((addon: SearchAddon) => {
    searchAddonRef.current = addon;
  }, []);

  // 容器层 Ctrl+F 搜索
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        // 由 xterm-terminal 内部的 showSearch state 控制
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSpawn = () => wsSend('agent:spawn', { agentId });
  const handleStop = () => wsSend('agent:stop', { agentId });
  const handleRestart = () => wsSend('agent:restart', { agentId });
  const handleClear = () => clearEvents(agentId);

  const placeholder = permissionPending
    ? `Allow ${permissionPending.toolName}? 输入 ${permissionPending.options.join('/')} 后发送`
    : processStatus === 'warming'
      ? '预热中，请稍候...'
      : isDisabled
        ? 'Agent 执行中...'
        : '输入消息...';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height }}>
      {/* 工具栏 */}
      {showControls && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: '#050507',
          borderBottom: '1px solid #3d3a39',
          borderRadius: '6px 6px 0 0',
          height: 38,
          flexShrink: 0,
        }}>
          <Space size={8}>
            <span style={{ color: '#b8b3b0', fontSize: 13, fontWeight: 500 }}>
              {agentName}
            </span>
            <span style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: processStatus === 'running' ? '#00d992'
                : processStatus === 'idle' ? '#00d992'
                : processStatus === 'starting' ? '#ffba00'
                : processStatus === 'warming' ? '#ffba00'
                : processStatus === 'error' ? '#fb565b'
                : '#595959',
            }} />
            <span style={{ color: '#595959', fontSize: 11 }}>
              {processStatus === 'running' ? '执行中'
               : processStatus === 'idle' ? '就绪'
               : processStatus === 'starting' ? '启动中'
               : processStatus === 'warming' ? '预热中'
               : processStatus === 'stopping' ? '停止中'
               : processStatus === 'error' ? '出错' : '已停止'}
              {' · '}Ctrl+F 搜索
            </span>
          </Space>
          <Space size={4}>
            <Tooltip title="启动">
              <Button
                size="small"
                type="text"
                icon={<PlayCircleOutlined />}
                disabled={processStatus === 'running' || processStatus === 'idle' || processStatus === 'starting'}
                onClick={handleSpawn}
                style={{ color: '#00d992' }}
              />
            </Tooltip>
            <Tooltip title="停止">
              <Button
                size="small"
                type="text"
                icon={<PauseCircleOutlined />}
                disabled={processStatus === 'stopped'}
                onClick={handleStop}
                style={{ color: '#fb565b' }}
              />
            </Tooltip>
            <Tooltip title="重启">
              <Button
                size="small"
                type="text"
                icon={<ReloadOutlined />}
                disabled={processStatus === 'stopped'}
                onClick={handleRestart}
                style={{ color: '#ffba00' }}
              />
            </Tooltip>
            <Tooltip title="清屏">
              <Button
                size="small"
                type="text"
                icon={<ClearOutlined />}
                onClick={handleClear}
                style={{ color: '#8b949e' }}
              />
            </Tooltip>
          </Space>
        </div>
      )}

      {/* xterm.js 终端 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <XtermTerminal
          ref={xtermRef}
          events={events}
          height="100%"
          onSearchAddonReady={handleSearchAddonReady}
        />
      </div>

      {/* 输入对话框 */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        padding: '8px 12px',
        background: '#0a0a0c',
        borderTop: '1px solid #3d3a39',
        flexShrink: 0,
      }}>
        <Input.TextArea
          ref={inputRef as never}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled && !permissionPending}
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{
            background: '#050507',
            borderColor: permissionPending ? '#ffba00' : '#3d3a39',
            color: '#f2f2f2',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            resize: 'none',
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={!inputText.trim() || (isDisabled && !permissionPending)}
          style={{
            background: inputText.trim() ? '#00d992' : undefined,
            borderColor: '#00d992',
            color: inputText.trim() ? '#050507' : undefined,
            flexShrink: 0,
          }}
        />
      </div>

      {/* 底部状态栏 */}
      {terminalStatus.model && terminalStatus.tokens > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 12px',
          background: '#050507',
          borderTop: '1px solid #3d3a39',
          color: '#595959',
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          flexShrink: 0,
          gap: 6,
        }}>
          <span>──</span>
          <span style={{ color: '#8b949e' }}>{getModelDisplayName(terminalStatus.model)}</span>
          <span>·</span>
          <span>{terminalStatus.tokens.toLocaleString()} tokens</span>
          <span>·</span>
          <span>${terminalStatus.cost.toFixed(3)}</span>
          <span>──</span>
        </div>
      )}
    </div>
  );
}
