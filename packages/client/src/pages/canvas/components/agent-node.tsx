import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge, Tooltip } from 'antd';
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { AGENT_ROLES, AGENT_STATUS_COLORS, AGENT_STATUS_LABELS } from '@dark-boss/shared';

// Agent 节点数据
export interface AgentNodeData {
  label: string;
  agentId?: string;
  agentName?: string;
  agentRole?: string;
  agentStatus?: string;
  prompt?: string;
  model?: string;
  isExecuting?: boolean;
  isCompleted?: boolean;
  result?: string | null;
}

type AgentNodeProps = NodeProps & { data: AgentNodeData };

export const AgentNode = memo(function AgentNode({ data, selected }: AgentNodeProps) {
  const roleInfo = AGENT_ROLES[(data.agentRole as keyof typeof AGENT_ROLES)] || AGENT_ROLES.custom;
  const statusColor = AGENT_STATUS_COLORS[data.agentStatus || 'offline'];
  const executing = data.isExecuting;
  const completed = data.isCompleted;

  // 执行中：蓝色脉冲边框；已完成：绿色边框；默认：灰色
  const borderColor = executing
    ? '#1890ff'
    : completed
      ? '#52c41a'
      : selected ? '#1890ff' : '#434343';
  const glowShadow = executing
    ? '0 0 16px #1890ff66, 0 0 32px #1890ff33'
    : completed
      ? '0 0 8px #52c41a33'
      : 'none';

  return (
    <Tooltip
      title={
        <div>
          <div>{data.agentName || data.label}</div>
          {data.prompt && <div style={{ fontSize: 11, opacity: 0.7 }}>{data.prompt.slice(0, 80)}...</div>}
          {completed && data.result && (
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4, maxHeight: 80, overflow: 'hidden' }}>
              结果: {data.result.slice(0, 100)}...
            </div>
          )}
        </div>
      }
      placement="top"
    >
      <div style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: executing ? '#111a33' : completed ? '#0f1f14' : '#1f1f1f',
        border: `2px solid ${borderColor}`,
        minWidth: 160,
        position: 'relative',
        boxShadow: glowShadow,
        transition: 'border-color 0.3s, box-shadow 0.3s, background 0.3s',
      }}>
        <Handle type="target" position={Position.Top} style={{ background: '#1890ff', width: 8, height: 8 }} />

        {/* 头部：角色图标 + 名称 + 状态指示 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>{roleInfo.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 600,
              color: '#e8e8e8',
              fontSize: 13,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {data.agentName || data.label}
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
              {roleInfo.label}
            </div>
          </div>
          {/* 执行状态指示器 */}
          {executing ? (
            <LoadingOutlined spin style={{ color: '#1890ff', fontSize: 16 }} />
          ) : completed ? (
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
          ) : (
            <Badge
              color={statusColor}
              text={<span style={{ fontSize: 11, color: statusColor }}>{AGENT_STATUS_LABELS[data.agentStatus || 'offline']}</span>}
            />
          )}
        </div>

        {/* 模型标签 */}
        {data.model && (
          <div style={{
            display: 'inline-block',
            padding: '1px 6px',
            borderRadius: 4,
            fontSize: 10,
            background: '#303030',
            color: '#bfbfbf',
          }}>
            {data.model}
          </div>
        )}

        {/* 执行中脉冲动画 */}
        {executing && (
          <div style={{
            position: 'absolute',
            inset: -2,
            borderRadius: 10,
            border: '2px solid #1890ff',
            opacity: 0.4,
            animation: 'agent-pulse 1.5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}

        <Handle type="source" position={Position.Bottom} style={{ background: '#1890ff', width: 8, height: 8 }} />
      </div>
    </Tooltip>
  );
});
