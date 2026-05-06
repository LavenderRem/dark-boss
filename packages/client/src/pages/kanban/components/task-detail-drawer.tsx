import { useState } from 'react';
import { Drawer, Descriptions, Tag, Button, Space, Typography, Divider, Modal, Input, message } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  FieldTimeOutlined,
  ApartmentOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Task, TaskStatus, TaskPriority, Agent } from '@dark-boss/shared';
import { AGENT_ROLES } from '@dark-boss/shared';
import { MarkdownRenderer } from '../../../components/chat/markdown-renderer.js';
import { api } from '../../../api/client.js';

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
  critical: { label: '紧急', color: '#fb565b' },
  high: { label: '高', color: '#fa8c16' },
  medium: { label: '中', color: '#00d992' },
  low: { label: '低', color: '#8b949e' },
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
  allTasks: Task[];
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
  allTasks,
  departments,
  workflows,
  onEdit,
  onDelete,
  onExecute,
  isExecuting,
}: TaskDetailDrawerProps) {
  const navigate = useNavigate();
  const [runWorkflowModalOpen, setRunWorkflowModalOpen] = useState(false);
  const [runInput, setRunInput] = useState('');
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false);

  // 获取子任务
  const { data: childTasks = [] } = useQuery({
    queryKey: ['tasks', 'children', task?.id],
    queryFn: () => api.get<Task[]>(`/tasks/${task?.id}/children`),
    enabled: !!task?.id,
  });

  if (!task) return null;

  const assignee = agents.find(a => a.id === task.assignedAgentId);
  const department = departments.find(d => d.id === task.departmentId);
  const workflow = workflows.find(w => w.id === task.workflowId);
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.backlog;
  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const roleInfo = assignee ? (AGENT_ROLES[assignee.role] || AGENT_ROLES.custom) : null;

  const canExecute = task.assignedAgentId && (task.status === 'todo' || task.status === 'in_progress');

  const isOverdue = task.dueAt && task.status !== 'done' && task.status !== 'cancelled'
    && new Date(task.dueAt).getTime() < Date.now();

  const handleNavigateToWorkflow = () => {
    if (task.workflowId) {
      onClose();
      navigate(`/canvas?workflowId=${task.workflowId}`);
    }
  };

  const handleRunWorkflow = async () => {
    if (!task.workflowId) return;
    setIsRunningWorkflow(true);
    try {
      await api.post(`/workflows/${task.workflowId}/execute`, { input: runInput });
      message.success('工作流开始执行');
      setRunWorkflowModalOpen(false);
      setRunInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '执行失败';
      message.error(msg);
    } finally {
      setIsRunningWorkflow(false);
    }
  };

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
        header: { background: '#0a0a0c', borderBottom: '1px solid #3d3a39' },
        body: { background: '#050507', padding: 16 },
      }}
      extra={
        <Space>
          {task.workflowId && (
            <Button
              icon={<ApartmentOutlined />}
              size="small"
              onClick={handleNavigateToWorkflow}
            >
              查看工作流
            </Button>
          )}
          {task.workflowId && (
            <Button
              icon={<ThunderboltOutlined />}
              size="small"
              onClick={() => { setRunInput(''); setRunWorkflowModalOpen(true); }}
            >
              执行工作流
            </Button>
          )}
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
        labelStyle={{ color: '#8b949e', fontSize: 12 }}
        contentStyle={{ color: '#f2f2f2', fontSize: 13 }}
      >
        <Descriptions.Item label="优先级">
          <Tag color={priorityCfg.color} style={{ margin: 0 }}>{priorityCfg.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="指派人">
          {assignee ? (
            <Space size={4}>
              <span>{roleInfo?.icon}</span>
              <span>{assignee.name}</span>
              <Text style={{ color: '#8b949e', fontSize: 11 }}>({roleInfo?.label})</Text>
            </Space>
          ) : <Text style={{ color: '#595959' }}>未指派</Text>}
        </Descriptions.Item>
        {department && (
          <Descriptions.Item label="部门">{department.name}</Descriptions.Item>
        )}
        {workflow && (
          <Descriptions.Item label="关联工作流">
            <a
              onClick={handleNavigateToWorkflow}
              style={{ color: '#00d992', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {workflow.name}
            </a>
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* 描述 */}
      {task.description && (
        <div style={{ marginTop: 12 }}>
          <Text style={{ color: '#8b949e', fontSize: 12 }}>描述</Text>
          <div style={{
            background: '#0a0a0c',
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
      <Divider style={{ borderColor: '#3d3a39', margin: '16px 0' }} />
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <Space size={4}>
            <CalendarOutlined style={{ color: '#8b949e' }} />
            <Text style={{ color: '#8b949e', fontSize: 12 }}>创建</Text>
          </Space>
          <div style={{ color: '#b8b3b0', fontSize: 12, marginTop: 2 }}>{formatDate(task.createdAt)}</div>
        </div>
        {task.startedAt && (
          <div>
            <Space size={4}>
              <PlayCircleOutlined style={{ color: '#00d992' }} />
              <Text style={{ color: '#8b949e', fontSize: 12 }}>开始</Text>
            </Space>
            <div style={{ color: '#b8b3b0', fontSize: 12, marginTop: 2 }}>{formatDate(task.startedAt)}</div>
          </div>
        )}
        {task.completedAt && (
          <div>
            <Space size={4}>
              <CheckCircleOutlined style={{ color: '#00d992' }} />
              <Text style={{ color: '#8b949e', fontSize: 12 }}>完成</Text>
            </Space>
            <div style={{ color: '#b8b3b0', fontSize: 12, marginTop: 2 }}>{formatDate(task.completedAt)}</div>
          </div>
        )}
        {task.dueAt && (
          <div>
            <Space size={4}>
              <CalendarOutlined style={{ color: isOverdue ? '#fb565b' : '#8b949e' }} />
              <Text style={{ color: isOverdue ? '#fb565b' : '#8b949e', fontSize: 12 }}>
                截止 {isOverdue && '(已逾期)'}
              </Text>
            </Space>
            <div style={{ color: isOverdue ? '#fb565b' : '#b8b3b0', fontSize: 12, marginTop: 2 }}>
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
              <FieldTimeOutlined style={{ color: '#8b949e' }} />
              <Text style={{ color: '#8b949e', fontSize: 12 }}>预估: {formatDuration(task.estimatedMinutes)}</Text>
            </Space>
          )}
          {task.actualMinutes && (
            <Space size={4}>
              <CheckCircleOutlined style={{ color: '#00d992' }} />
              <Text style={{ color: '#00d992', fontSize: 12 }}>实际: {formatDuration(task.actualMinutes)}</Text>
            </Space>
          )}
        </div>
      )}

      {/* 被阻塞于 */}
      {(() => {
        const blockedBy = Array.isArray(task.blockedBy) ? task.blockedBy : typeof task.blockedBy === 'string' && task.blockedBy ? JSON.parse(task.blockedBy as string) : [];
        return blockedBy.length > 0 && (
        <>
          <Divider style={{ borderColor: '#3d3a39', margin: '16px 0' }} />
          <div>
            <Text style={{ color: '#8b949e', fontSize: 12, marginBottom: 8, display: 'block' }}>被阻塞于</Text>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {blockedBy.map((blockedTaskId: string) => {
                const blockedTask = allTasks.find(t => t.id === blockedTaskId);
                if (!blockedTask) return null;
                const blockedStatusCfg = STATUS_CONFIG[blockedTask.status] || STATUS_CONFIG.backlog;
                return (
                  <div
                    key={blockedTask.id}
                    style={{
                      background: '#0a0a0c',
                      borderRadius: 4,
                      padding: '6px 10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid #3d3a39',
                    }}
                  >
                    <Text style={{ color: '#f2f2f2', fontSize: 13 }}>{blockedTask.title}</Text>
                    <Tag color={blockedStatusCfg.color} style={{ fontSize: 11, margin: 0 }}>
                      {blockedStatusCfg.label}
                    </Tag>
                  </div>
                );
              })}
            </Space>
          </div>
        </>
        );
      })()}

      {/* 子任务清单 */}
      {childTasks.length > 0 && (
        <>
          <Divider style={{ borderColor: '#3d3a39', margin: '16px 0' }} />
          <div>
            <Text style={{ color: '#8b949e', fontSize: 12, marginBottom: 8, display: 'block' }}>子任务清单</Text>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {childTasks.map(childTask => {
                const isDone = childTask.status === 'done';
                const isInProgress = childTask.status === 'in_progress';
                const statusIcon = isDone ? '✓' : isInProgress ? '◐' : '○';
                const childStatusCfg = STATUS_CONFIG[childTask.status] || STATUS_CONFIG.backlog;
                return (
                  <div
                    key={childTask.id}
                    style={{
                      background: '#0a0a0c',
                      borderRadius: 4,
                      padding: '6px 10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid #3d3a39',
                    }}
                  >
                    <Text
                      style={{
                        color: isDone ? '#595959' : '#f2f2f2',
                        fontSize: 13,
                        textDecoration: isDone ? 'line-through' : 'none',
                      }}
                    >
                      {statusIcon} {childTask.title}
                    </Text>
                    <Tag color={childStatusCfg.color} style={{ fontSize: 11, margin: 0 }}>
                      {childStatusCfg.label}
                    </Tag>
                  </div>
                );
              })}
            </Space>
          </div>
        </>
      )}

      {/* 执行结果 */}
      {task.result && (
        <>
          <Divider style={{ borderColor: '#3d3a39', margin: '16px 0' }} />
          <div>
            <Text style={{ color: '#8b949e', fontSize: 12, marginBottom: 8, display: 'block' }}>执行结果</Text>
            <div style={{
              background: '#0a0a0c',
              borderRadius: 6,
              padding: '12px 16px',
              border: '1px solid #3d3a39',
            }}>
              <MarkdownRenderer content={task.result} />
            </div>
          </div>
        </>
      )}

      {/* 执行关联工作流弹窗 */}
      <Modal
        title="执行关联工作流"
        open={runWorkflowModalOpen}
        onOk={handleRunWorkflow}
        onCancel={() => { setRunWorkflowModalOpen(false); setRunInput(''); }}
        confirmLoading={isRunningWorkflow}
        okText="开始执行"
        cancelText="取消"
      >
        <div style={{ marginBottom: 12 }}>
          <Text style={{ color: '#8b949e' }}>
            输入内容将作为工作流的初始输入。
          </Text>
        </div>
        <Input.TextArea
          value={runInput}
          onChange={e => setRunInput(e.target.value)}
          placeholder="输入工作流的初始内容（可选）..."
          autoSize={{ minRows: 3, maxRows: 8 }}
          style={{ background: '#0a0a0c', color: '#f2f2f2', borderColor: '#3d3a39' }}
        />
      </Modal>
    </Drawer>
  );
}
