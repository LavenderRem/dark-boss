/**
 * Agent 终端组件
 * 显示 Agent 进程的实时输出，支持向 Agent 发送消息
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

// 输出通道颜色
const CHANNEL_COLORS: Record<string, string> = {
  stdout: '#e8e8e8',
  stderr: '#ff6b6b',
  stdin: '#69b7ff',
  tool: '#ffd43b',
  tool_result: '#8ce99a',
};

export function AgentTerminal({
  agentId,
  agentName,
  showControls = true,
  height = 400,
}: AgentTerminalProps) {
  const [inputValue, setInputValue] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  const wsSend = useWsSend();

  // 从全局 Store 获取当前 Agent 的终端状态
  // 注意：使用稳定引用 EMPTY_LINES，不能用 `?? []`（每次创建新数组导致无限渲染）
  const lines = useAgentTerminalStore(s => s.terminals[agentId]?.lines ?? EMPTY_LINES);
  const processStatus = useAgentTerminalStore(s => s.terminals[agentId]?.processStatus ?? 'stopped');
  const appendLine = useAgentTerminalStore(s => s.appendLine);
  const setProcessStatus = useAgentTerminalStore(s => s.setProcessStatus);
  const clearLines = useAgentTerminalStore(s => s.clearLines);

  // 订阅 WebSocket 消息 —— 接收所有 agent 的消息，写入对应 store
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

  // 自动滚动到底部
  useEffect(() => {
    if (isAtBottom && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines, isAtBottom]);

  // 检测是否在底部
  const handleScroll = () => {
    if (!terminalRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);
  };

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

      {/* 终端输出区域 */}
      <div
        ref={terminalRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 12px',
          background: '#0d1117',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          fontSize: 13,
          lineHeight: 1.6,
          minHeight: 200,
        }}
      >
        {lines.length === 0 ? (
          <div style={{ color: '#595959', fontStyle: 'italic' }}>
            等待 Agent 输出...点击「启动」按钮初始化会话，然后发送消息
          </div>
        ) : (
          lines.map((line, i) => (
            <div key={i} style={{ color: CHANNEL_COLORS[line.channel] || '#e8e8e8' }}>
              {line.text}
            </div>
          ))
        )}
      </div>

      {/* 输入框 */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '8px 12px',
        background: '#1a1a2e',
        borderTop: '1px solid #303030',
        borderRadius: '0 0 6px 6px',
      }}>
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onPressEnter={handleSend}
          placeholder={`向 ${agentName} 发送消息...`}
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
