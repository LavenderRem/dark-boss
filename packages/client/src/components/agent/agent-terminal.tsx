/**
 * Agent 终端组件
 * 使用 xterm.js 交互式终端，支持终端内直接输入
 */
import { useCallback, useRef, useEffect } from 'react';
import { Button, Space, Tag, Tooltip } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useWsMessage, useWsSend } from '../../hooks/use-ws.js';
import { useAgentTerminalStore } from '../../stores/agent-terminal-store.js';
import { XtermTerminal, type XtermTerminalHandle } from './xterm-terminal.js';
import type { AgentProcessOutputPayload, AgentProcessStatusPayload } from '@dark-boss/shared';

const EMPTY_LINES: Array<{ text: string; channel: string; time: number; toolName?: string; toolInput?: string }> = [];

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
        toolName: payload.toolName,
        toolInput: payload.toolInput,
      });
    }

    if (msg.type === 'agent:process_status') {
      const payload = msg.payload as AgentProcessStatusPayload;
      setProcessStatus(payload.agentId, payload.status);
    }
  }, [appendLine, setProcessStatus]));

  // Agent 从 running → idle 时写新提示符
  useEffect(() => {
    if (prevStatusRef.current === 'running' && processStatus === 'idle') {
      xtermRef.current?.writeSeparator('完成');
      xtermRef.current?.writePrompt();
    }
    // stopped/error 状态也恢复提示符，防止卡住
    if ((processStatus === 'stopped' || processStatus === 'error') && prevStatusRef.current !== processStatus) {
      xtermRef.current?.writePrompt();
    }
    prevStatusRef.current = processStatus;
  }, [processStatus]);

  const handleTerminalSubmit = useCallback((message: string) => {
    wsSend('agent:send_message', { agentId, message });
    // 如果 agent 未启动，500ms 后恢复提示符
    setTimeout(() => {
      const currentStatus = useAgentTerminalStore.getState().terminals[agentId]?.processStatus;
      if (currentStatus === 'stopped' || !currentStatus) {
        xtermRef.current?.writePrompt();
      }
    }, 500);
  }, [wsSend, agentId]);

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
        height: 38,
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
          <span style={{ color: '#595959', fontSize: 11 }}>
            Ctrl+F 搜索 · Esc 取消输入
          </span>
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

      {/* xterm.js 交互式终端 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <XtermTerminal
          ref={xtermRef}
          lines={lines}
          height="100%"
          agentName={agentName}
          onSubmit={handleTerminalSubmit}
        />
      </div>
    </div>
  );
}
