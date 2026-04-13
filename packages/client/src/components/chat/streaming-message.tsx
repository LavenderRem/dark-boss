/**
 * 流式消息组件
 * 处理正在流式输出的 Agent 回复，逐步渲染 Markdown
 */
import { useState, useEffect, useRef } from 'react';
import { Avatar, Typography } from 'antd';
import { RobotOutlined, LoadingOutlined } from '@ant-design/icons';
import { MarkdownRenderer } from './markdown-renderer';
import type { Agent } from '@dark-boss/shared';
import { AGENT_ROLES } from '@dark-boss/shared';

const { Text } = Typography;

interface StreamingMessageProps {
  agentId: string;
  agents: Agent[];
  onWsMessage: (fn: (msg: { type: string; payload: unknown }) => void) => () => void;
}

export function StreamingMessage({ agentId, agents, onWsMessage }: StreamingMessageProps) {
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const textRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agent = agents.find(a => a.id === agentId);
  const roleInfo = agent ? (AGENT_ROLES[agent.role] || AGENT_ROLES.custom) : null;

  useEffect(() => {
    const unsub = onWsMessage((msg) => {
      if (msg.type === 'agent:output') {
        const payload = msg.payload as { agentId?: string; text?: string };
        if (payload.agentId === agentId && payload.text) {
          textRef.current += payload.text;
          setStreamingText(textRef.current);
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }

      if (msg.type === 'agent:complete') {
        const payload = msg.payload as { agentId?: string };
        if (payload.agentId === agentId) {
          setIsStreaming(false);
        }
      }

      if (msg.type === 'agent:error') {
        const payload = msg.payload as { agentId?: string };
        if (payload.agentId === agentId) {
          setIsStreaming(false);
        }
      }
    });

    return unsub;
  }, [agentId, onWsMessage]);

  // 无内容时不显示
  if (!streamingText && isStreaming) {
    return (
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <Avatar
          size={36}
          style={{ background: roleInfo?.color || '#52c41a', flexShrink: 0 }}
          icon={<RobotOutlined />}
        >
          {agent?.name?.[0]}
        </Avatar>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={{ color: '#bfbfbf', fontSize: 13, fontWeight: 500 }}>
              {agent?.name || 'Agent'}
            </Text>
            <Text style={{ color: '#8c8c8c', fontSize: 11 }}>
              <LoadingOutlined style={{ marginRight: 4 }} />
              正在思考...
            </Text>
          </div>
          <div style={{
            background: '#2a2a2a',
            borderRadius: 8,
            padding: '8px 14px',
            color: '#8c8c8c',
            fontSize: 14,
          }}>
            <LoadingOutlined /> 正在生成回复...
          </div>
        </div>
      </div>
    );
  }

  if (!streamingText) return null;

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
      <Avatar
        size={36}
        style={{ background: roleInfo?.color || '#52c41a', flexShrink: 0 }}
        icon={<RobotOutlined />}
      >
        {agent?.name?.[0]}
      </Avatar>
      <div style={{ maxWidth: '70%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Text style={{ color: '#bfbfbf', fontSize: 13, fontWeight: 500 }}>
            {agent?.name || 'Agent'}
          </Text>
          <Text style={{ color: '#8c8c8c', fontSize: 11 }}>
            {isStreaming ? (
              <><LoadingOutlined style={{ marginRight: 4 }} />正在回复...</>
            ) : (
              '回复完成'
            )}
          </Text>
        </div>
        <div style={{
          background: '#2a2a2a',
          borderRadius: 8,
          padding: '8px 14px',
          color: '#e8e8e8',
          fontSize: 14,
          lineHeight: 1.6,
          wordBreak: 'break-word',
        }}>
          <MarkdownRenderer content={streamingText} />
          {isStreaming && (
            <span style={{
              display: 'inline-block',
              width: 2,
              height: 16,
              background: '#4096ff',
              marginLeft: 2,
              verticalAlign: 'middle',
              animation: 'blink 1s step-end infinite',
            }} />
          )}
        </div>
      </div>
      <div ref={messagesEndRef} />
      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
