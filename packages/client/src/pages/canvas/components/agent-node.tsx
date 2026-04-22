import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge, Popover, Tag, Tooltip } from 'antd';
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { AGENT_ROLES, AGENT_STATUS_COLORS, AGENT_STATUS_LABELS } from '@dark-boss/shared';
import type { Task, TaskStatus } from '@dark-boss/shared';
import { NodeDeleteToolbar } from './node-delete-toolbar.js';

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  backlog: { label: '待规划', color: 'default' },
  todo: { label: '待办', color: 'blue' },
  in_progress: { label: '进行中', color: 'gold' },
  review: { label: '审核中', color: 'purple' },
  done: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'red' },
};

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
  relatedTasks?: Task[];
}

type AgentNodeProps = NodeProps & { data: AgentNodeData };

export const AgentNode = memo(function AgentNode({ id, data, selected }: AgentNodeProps) {
  const [tasksOpen, setTasksOpen] = useState(false);
  const roleInfo = AGENT_ROLES[(data.agentRole as keyof typeof AGENT_ROLES)] || AGENT_ROLES.custom;
  const statusColor = AGENT_STATUS_COLORS[data.agentStatus || 'offline'];
  const executing = data.isExecuting;
  const completed = data.isCompleted;
  const relatedTasks = data.relatedTasks || [];

  // 根据关联任务状态确定节点边框颜色
  const latestTask = relatedTasks.length > 0 ? relatedTasks[relatedTasks.length - 1] : null;
  const taskBorderColor = latestTask?.status === 'done'
    ? '#00d992'
    : latestTask?.status === 'in_progress'
      ? '#00d992'
      : latestTask?.status === 'review'
        ? '#722ed1'
        : null;

  const borderColor = executing
    ? '#00d992'
    : completed
      ? '#00d992'
      : taskBorderColor
        ? taskBorderColor
        : selected ? '#00d992' : '#434343';
  const glowShadow = executing
    ? '0 0 16px #00d99266, 0 0 32px #00d99233'
    : completed
      ? '0 0 8px #00d99233'
      : 'none';

  // 任务数量徽标
  const taskBadge = relatedTasks.length > 0 ? (
    <Popover
      open={tasksOpen}
      onOpenChange={setTasksOpen}
      trigger="click"
      placement="right"
      title={<span style={{ fontSize: 13 }}>关联看板任务 ({relatedTasks.length})</span>}
      content={
        <div style={{ maxWidth: 280 }}>
          {relatedTasks.map(task => {
            const cfg = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.todo;
            return (
              <div key={task.id} style={{
                padding: '6px 0',
                borderBottom: '1px solid #3d3a39',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: '#d9d9d9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.title}
                </span>
                <Tag color={cfg.color} style={{ fontSize: 10, margin: 0, marginLeft: 8, lineHeight: '16px', padding: '0 4px' }}>
                  {cfg.label}
                </Tag>
              </div>
            );
          })}
        </div>
      }
    >
      <div
        onClick={(e) => { e.stopPropagation(); setTasksOpen(!tasksOpen); }}
        style={{
          position: 'absolute',
          top: -6,
          right: -6,
          background: '#00d992',
          borderRadius: '50%',
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10,
          fontSize: 10,
          color: '#fff',
          fontWeight: 600,
          boxShadow: '0 0 4px #00d99288',
        }}
      >
        {relatedTasks.length}
      </div>
    </Popover>
  ) : null;

  return (
    <>
    <NodeDeleteToolbar nodeId={id} />
    {taskBadge}
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
        background: executing ? '#111a33' : completed ? '#0f1f14' : '#101010',
        border: `2px solid ${borderColor}`,
        minWidth: 160,
        position: 'relative',
        boxShadow: glowShadow,
        transition: 'border-color 0.3s, box-shadow 0.3s, background 0.3s',
      }}>
        <Handle type="target" position={Position.Top} style={{ background: '#00d992', width: 8, height: 8 }} />

        {/* 头部：角色图标 + 名称 + 状态指示 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>{roleInfo.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 600,
              color: '#f2f2f2',
              fontSize: 13,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {data.agentName || data.label}
            </div>
            <div style={{ fontSize: 11, color: '#8b949e' }}>
              {roleInfo.label}
            </div>
          </div>
          {/* 执行状态指示器 */}
          {executing ? (
            <LoadingOutlined spin style={{ color: '#00d992', fontSize: 16 }} />
          ) : completed ? (
            <CheckCircleOutlined style={{ color: '#00d992', fontSize: 16 }} />
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
            background: '#3d3a39',
            color: '#b8b3b0',
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
            border: '2px solid #00d992',
            opacity: 0.4,
            animation: 'agent-pulse 1.5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}

        <Handle type="source" position={Position.Bottom} style={{ background: '#00d992', width: 8, height: 8 }} />
      </div>
    </Tooltip>
    </>
  );
});
