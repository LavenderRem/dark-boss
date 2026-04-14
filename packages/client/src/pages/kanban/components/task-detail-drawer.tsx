import { Drawer, Descriptions, Tag, Button, Space, Typography, Divider } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';
import type { Task, TaskStatus, TaskPriority, Agent } from '@dark-boss/shared';
import { AGENT_ROLES } from '@dark-boss/shared';
import { MarkdownRenderer } from '../../../components/chat/markdown-renderer.js';

const { Text } = Typography;

// 状态配置
const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  backlog: { label: '待规划', color: 'default' },
  todo: { label: '待办', color: 'blue' },
  in_progress: { label: '进行中', color: 'gold' },
  review: { label: '审核中', color: 'purple' },
  done: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'red' },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  critical: { label: '紧急', color: '#ff4d4f' },
  high: { label: '高', color: '#fa8c16' },
  medium: { label: '中', color: '#1890ff' },
  low: { label: '低', color: '#8c8c8c' },
};

function formatDate(date: Date | string | number | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN');
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '-';
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
}

interface TaskDetailDrawerProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  agents: Agent[];
  departments: { id: string; name: string }[];
  workflows: { id: string; name: string }[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onExecute: (id: string) => void;
  isExecuting?: boolean;
}

export function TaskDetailDrawer({
  task,
  open,
  onClose,
  agents,
  departments,
  workflows,
  onEdit,
  onDelete,
  onExecute,
  isExecuting,
}: TaskDetailDrawerProps) {
  if (!task) return null;

  const assignee = agents.find(a => a.id === task.assignedAgentId);
  const department = departments.find(d => d.id === task.departmentId);
  const workflow = workflows.find(w => w.id === task.workflowId);
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.backlog;
  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const roleInfo = assignee ? (AGENT_ROLES[assignee.role] || AGENT_ROLES.custom) : null;

  // 是否可执行：有指派人且状态为 todo 或 in_progress
  const canExecute = task.assignedAgentId && (task.status === 'todo' || task.status === 'in_progress');

  // 是否逾期
  const isOverdue = task.dueAt && task.status !== 'done' && task.status !== 'cancelled'
    && new Date(task.dueAt).getTime() < Date.now();

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{task.title}</span>
          <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
          {isExecuting && <Tag color="processing">执行中...</Tag>}
        </div>
      }
      open={open}
      onClose={onClose}
      width={560}
      styles={{
        header: { background: '#1a1a1a', borderBottom: '1px solid #303030' },
        body: { background: '#141414', padding: 16 },
      }}
      extra={
        <Space>
          {canExecute && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={isExecuting}
              onClick={() => onExecute(task.id)}
              size="small"
            >
              执行任务
            </Button>
          )}
          <Button
            icon={<EditOutlined />}
            onClick={() => onEdit(task)}
            size="small"
          >
            编辑
          </Button>
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => onDelete(task.id)}
            size="small"
          />
        </Space>
      }
    >
      {/* 基本信息 */}
      <Descriptions
        column={2}
        size="small"
        labelStyle={{ color: '#8c8c8c', fontSize: 12 }}
        contentStyle={{ color: '#e8e8e8', fontSize: 13 }}
      >
        <Descriptions.Item label="优先级">
          <Tag color={priorityCfg.color} style={{ margin: 0 }}>{priorityCfg.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="指派人">
          {assignee ? (
            <Space size={4}>
              <span>{roleInfo?.icon}</span>
              <span>{assignee.name}</span>
              <Text style={{ color: '#8c8c8c', fontSize: 11 }}>({roleInfo?.label})</Text>
            </Space>
          ) : <Text style={{ color: '#595959' }}>未指派</Text>}
        </Descriptions.Item>
        {department && (
          <Descriptions.Item label="部门">{department.name}</Descriptions.Item>
        )}
        {workflow && (
          <Descriptions.Item label="关联工作流">{workflow.name}</Descriptions.Item>
        )}
      </Descriptions>

      {/* 描述 */}
      {task.description && (
        <div style={{ marginTop: 12 }}>
          <Text style={{ color: '#8c8c8c', fontSize: 12 }}>描述</Text>
          <div style={{
            background: '#1a1a1a',
            borderRadius: 6,
            padding: '8px 12px',
            marginTop: 4,
            color: '#d9d9d9',
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}>
            {task.description}
          </div>
        </div>
      )}

      {/* 时间信息 */}
      <Divider style={{ borderColor: '#303030', margin: '16px 0' }} />
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <Space size={4}>
            <CalendarOutlined style={{ color: '#8c8c8c' }} />
            <Text style={{ color: '#8c8c8c', fontSize: 12 }}>创建</Text>
          </Space>
          <div style={{ color: '#bfbfbf', fontSize: 12, marginTop: 2 }}>{formatDate(task.createdAt)}</div>
        </div>
        {task.startedAt && (
          <div>
            <Space size={4}>
              <PlayCircleOutlined style={{ color: '#1890ff' }} />
              <Text style={{ color: '#8c8c8c', fontSize: 12 }}>开始</Text>
            </Space>
            <div style={{ color: '#bfbfbf', fontSize: 12, marginTop: 2 }}>{formatDate(task.startedAt)}</div>
          </div>
        )}
        {task.completedAt && (
          <div>
            <Space size={4}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text style={{ color: '#8c8c8c', fontSize: 12 }}>完成</Text>
            </Space>
            <div style={{ color: '#bfbfbf', fontSize: 12, marginTop: 2 }}>{formatDate(task.completedAt)}</div>
          </div>
        )}
        {task.dueAt && (
          <div>
            <Space size={4}>
              <CalendarOutlined style={{ color: isOverdue ? '#ff4d4f' : '#8c8c8c' }} />
              <Text style={{ color: isOverdue ? '#ff4d4f' : '#8c8c8c', fontSize: 12 }}>
                截止 {isOverdue && '(已逾期)'}
              </Text>
            </Space>
            <div style={{ color: isOverdue ? '#ff4d4f' : '#bfbfbf', fontSize: 12, marginTop: 2 }}>
              {formatDate(task.dueAt)}
            </div>
          </div>
        )}
      </div>

      {/* 时间对比 */}
      {(task.estimatedMinutes || task.actualMinutes) && (
        <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
          {task.estimatedMinutes && (
            <Space size={4}>
              <FieldTimeOutlined style={{ color: '#8c8c8c' }} />
              <Text style={{ color: '#8c8c8c', fontSize: 12 }}>预估: {formatDuration(task.estimatedMinutes)}</Text>
            </Space>
          )}
          {task.actualMinutes && (
            <Space size={4}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text style={{ color: '#52c41a', fontSize: 12 }}>实际: {formatDuration(task.actualMinutes)}</Text>
            </Space>
          )}
        </div>
      )}

      {/* 执行结果 */}
      {task.result && (
        <>
          <Divider style={{ borderColor: '#303030', margin: '16px 0' }} />
          <div>
            <Text style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 8, display: 'block' }}>执行结果</Text>
            <div style={{
              background: '#1a1a1a',
              borderRadius: 6,
              padding: '12px 16px',
              border: '1px solid #303030',
            }}>
              <MarkdownRenderer content={task.result} />
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}
