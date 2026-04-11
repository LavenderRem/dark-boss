import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge, Tooltip } from 'antd';
import { AGENT_ROLES, AGENT_STATUS_COLORS, AGENT_STATUS_LABELS } from '@dark-boss/shared';
import type { WorkflowNode } from '@dark-boss/shared';

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
}

type AgentNodeProps = NodeProps & { data: AgentNodeData };

export const AgentNode = memo(function AgentNode({ data, selected }: AgentNodeProps) {
  const roleInfo = AGENT_ROLES[(data.agentRole as keyof typeof AGENT_ROLES)] || AGENT_ROLES.custom;
  const statusColor = AGENT_STATUS_COLORS[data.agentStatus || 'offline'];
  const executing = data.isExecuting;

  return (
    <Tooltip
      title={
        <div>
          <div>{data.agentName || data.label}</div>
          {data.prompt && <div style={{ fontSize: 11, opacity: 0.7 }}>{data.prompt.slice(0, 80)}...</div>}
        </div>
      }
      placement="top"
    >
      <div style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: executing ? '#1a1a2e' : '#1f1f1f',
        border: `2px solid ${selected ? '#1890ff' : executing ? statusColor : '#434343'}`,
        minWidth: 160,
        position: 'relative',
        boxShadow: executing ? `0 0 12px ${statusColor}44` : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}>
        <Handle type="target" position={Position.Top} style={{ background: '#1890ff', width: 8, height: 8 }} />

        {/* 头部：角色图标 + 名称 */}
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
          <Badge
            color={statusColor}
            text={<span style={{ fontSize: 11, color: statusColor }}>{AGENT_STATUS_LABELS[data.agentStatus || 'offline']}</span>}
          />
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

        <Handle type="source" position={Position.Bottom} style={{ background: '#1890ff', width: 8, height: 8 }} />
      </div>
    </Tooltip>
  );
});
