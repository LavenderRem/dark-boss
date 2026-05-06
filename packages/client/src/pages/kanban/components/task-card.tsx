import { Card, Tag, Typography, Space } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import type { Task, TaskPriority, TaskType, Agent } from '@dark-boss/shared';
import { AGENT_ROLES } from '@dark-boss/shared';
import { TaskCardActivity } from './task-card-activity.js';

const { Text } = Typography;

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  critical: { label: '紧急', color: '#fb565b' },
  high: { label: '高', color: '#fa8c16' },
  medium: { label: '中', color: '#00d992' },
  low: { label: '低', color: '#8b949e' },
};

const TASK_TYPE_CONFIG: Record<TaskType, { label: string; color: string }> = {
  epic: { label: 'EPIC', color: '#fa8c16' },
  story: { label: 'STORY', color: '#722ed1' },
  task: { label: 'TASK', color: '#00d992' },
  subtask: { label: 'SUB', color: '#8b949e' },
};

const TAG_COLORS: Record<string, string> = {
  auth: '#4cb3d4',
  frontend: '#68a063',
  backend: '#8b5cf6',
  bug: '#fb565b',
  API: '#722ed1',
  performance: '#ffba00',
  urgent: '#f97316',
  docs: '#8b949e',
};

interface TaskCardProps {
  task: Task;
  agents: Agent[];
  onClick: (task: Task) => void;
}

export function TaskCard({ task, agents, onClick }: TaskCardProps) {
  const assignee = agents.find(a => a.id === task.assignedAgentId);
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const roleInfo = assignee ? (AGENT_ROLES[assignee.role] || AGENT_ROLES.custom) : null;
  const isOverdue = task.dueAt && task.status !== 'done' && task.status !== 'cancelled'
    && new Date(task.dueAt).getTime() < Date.now();
  const blockedBy = Array.isArray(task.blockedBy) ? task.blockedBy : typeof task.blockedBy === 'string' && task.blockedBy ? JSON.parse(task.blockedBy) : [];
  const isBlocked = blockedBy.length > 0;
  const borderColor = isBlocked ? '#fb565b' : priorityConfig.color;

  return (
    <Card
      size="small"
      style={{
        background: '#2a2a2a',
        borderLeft: `3px solid ${borderColor}`,
        cursor: 'pointer',
      }}
      styles={{ body: { padding: '8px 12px' } }}
      onClick={() => onClick(task)}
    >
      {/* 活动状态指示器 */}
      <TaskCardActivity task={task} />

      {/* 任务类型标签（非 task 类型时显示） */}
      {task.taskType !== 'task' && (
        <div style={{ marginBottom: 4 }}>
          <Tag
            color={TASK_TYPE_CONFIG[task.taskType].color}
            style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
          >
            {TASK_TYPE_CONFIG[task.taskType].label}
          </Tag>
        </div>
      )}

      {/* 任务标题 */}
      <div style={{ color: '#f2f2f2', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
        {task.title}
      </div>

      {/* 优先级 + 预估时间 + 逾期标记 */}
      <Space size={4} style={{ marginBottom: 4 }}>
        <Tag color={priorityConfig.color} style={{ fontSize: 11, lineHeight: '18px', padding: '0 4px' }}>
          {priorityConfig.label}
        </Tag>
        {task.estimatedMinutes && (
          <Text style={{ color: '#595959', fontSize: 11 }}>
            <ClockCircleOutlined /> {task.estimatedMinutes}分钟
          </Text>
        )}
        {isOverdue && (
          <Tag color="error" style={{ fontSize: 10, lineHeight: '16px', padding: '0 3px', margin: 0 }}>
            逾期
          </Tag>
        )}
      </Space>

      {/* 进度条（进行中且有进度时显示） */}
      {task.progress > 0 && task.status === 'in_progress' && (
        <div style={{ marginTop: 4 }}>
          <div style={{
            background: '#1a1a1a',
            borderRadius: 2,
            height: 4,
            overflow: 'hidden',
          }}>
            <div style={{
              background: '#00d992',
              height: '100%',
              width: `${Math.min(task.progress, 100)}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* 标签行（最多显示 3 个） */}
      {(() => {
        const tags = Array.isArray(task.tags) ? task.tags : typeof task.tags === 'string' ? JSON.parse(task.tags) : [];
        return tags.length > 0 && (
        <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {tags.slice(0, 3).map((tag: string) => (
            <Tag
              key={tag}
              style={{
                fontSize: 10,
                lineHeight: '14px',
                padding: '0 4px',
                margin: 0,
                background: TAG_COLORS[tag] || '#3d3a39',
                border: 'none',
                color: '#f2f2f2',
              }}
            >
              {tag}
            </Tag>
          ))}
          {tags.length > 3 && (
            <Tag style={{ fontSize: 10, lineHeight: '14px', padding: '0 4px', margin: 0 }}>
              +{tags.length - 3}
            </Tag>
          )}
        </div>
        );
      })()}

      {/* 底部：负责人图标 + 名称 + 活动中指示 */}
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {assignee && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14 }}>{roleInfo?.icon}</span>
            <Text style={{ color: '#8b949e', fontSize: 11 }}>{assignee.name}</Text>
          </div>
        )}
        {task.status === 'in_progress' && !task.activitySummary && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#00d992',
              animation: 'pulse 2s ease-in-out infinite',
            }} />
          </div>
        )}
      </div>

      {/* 脉冲动画 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </Card>
  );
}
