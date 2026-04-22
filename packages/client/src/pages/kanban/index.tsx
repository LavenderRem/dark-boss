import { useState, useCallback, useEffect } from 'react';
import { Card, Button, Modal, Form, Input, Select, Tag, Typography, Space, message, Skeleton, DatePicker } from 'antd';
import {
  PlusOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import dayjs from 'dayjs';
import { api } from '../../api/client.js';
import type { Task, TaskStatus, TaskPriority, Agent } from '@dark-boss/shared';
import { AGENT_ROLES } from '@dark-boss/shared';
import { TaskDetailDrawer } from './components/task-detail-drawer.js';

const { Title, Text } = Typography;

// 看板列配置
const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'backlog', label: '待规划', color: '#8b949e' },
  { status: 'todo', label: '待办', color: '#00d992' },
  { status: 'in_progress', label: '进行中', color: '#ffba00' },
  { status: 'review', label: '审核中', color: '#722ed1' },
  { status: 'done', label: '已完成', color: '#00d992' },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  critical: { label: '紧急', color: '#fb565b' },
  high: { label: '高', color: '#fa8c16' },
  medium: { label: '中', color: '#00d992' },
  low: { label: '低', color: '#8b949e' },
};

// 可拖拽的任务卡片
function TaskCard({ task, agents, onClick }: {
  task: Task;
  agents: Agent[];
  onClick: (task: Task) => void;
}) {
  const assignee = agents.find(a => a.id === task.assignedAgentId);
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const roleInfo = assignee ? (AGENT_ROLES[assignee.role] || AGENT_ROLES.custom) : null;
  const isOverdue = task.dueAt && task.status !== 'done' && task.status !== 'cancelled'
    && new Date(task.dueAt).getTime() < Date.now();

  return (
    <Card
      size="small"
      style={{
        background: '#2a2a2a',
        borderLeft: `3px solid ${priorityConfig.color}`,
        cursor: 'pointer',
      }}
      styles={{ body: { padding: '8px 12px' } }}
      onClick={() => onClick(task)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#f2f2f2', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
            {task.title}
          </div>
          <Space size={4}>
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
        </div>
      </div>
      {assignee && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 14 }}>{roleInfo?.icon}</span>
          <Text style={{ color: '#8b949e', fontSize: 11 }}>{assignee.name}</Text>
        </div>
      )}
    </Card>
  );
}

// 可排序的任务卡片（带 dnd-kit useSortable）
function SortableTaskCard({ task, agents, onClick }: {
  task: Task;
  agents: Agent[];
  onClick: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: 8,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} agents={agents} onClick={onClick} />
    </div>
  );
}

export function KanbanPage() {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');

  // 筛选状态
  const [searchText, setSearchText] = useState('');
  const [filterAgent, setFilterAgent] = useState<string | undefined>(undefined);
  const [filterDept, setFilterDept] = useState<string | undefined>(undefined);
  const [filterPriority, setFilterPriority] = useState<TaskPriority | undefined>(undefined);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get<Task[]>('/tasks'),
  });

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get<Agent[]>('/agents'),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/departments'),
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/workflows'),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/tasks', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setCreateModalOpen(false);
      form.resetFields();
      message.success('任务创建成功');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/tasks/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditModalOpen(false);
      setEditingTask(null);
      editForm.resetFields();
      message.success('任务更新成功');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status, columnOrder }: { id: string; status: TaskStatus; columnOrder: number }) =>
      api.patch(`/tasks/${id}/move`, { status, columnOrder }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setDetailOpen(false);
      setDetailTask(null);
      message.success('任务删除成功');
    },
    onError: (err: Error) => message.error(err.message),
  });

  // WebSocket 实时同步
  useEffect(() => {
    const handler = (event: Event) => {
      const { type } = (event as CustomEvent).detail;
      if (type === 'task:updated') {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    };
    window.addEventListener('ws:message', handler);
    return () => window.removeEventListener('ws:message', handler);
  }, [queryClient]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  }, [tasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    const targetColumn = COLUMNS.find(c => c.status === overId);
    if (targetColumn) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== targetColumn.status) {
        moveMutation.mutate({ id: taskId, status: targetColumn.status, columnOrder: Date.now() });
      }
      return;
    }

    const targetTask = tasks.find(t => t.id === overId);
    if (targetTask && taskId !== overId) {
      moveMutation.mutate({ id: taskId, status: targetTask.status, columnOrder: targetTask.columnOrder });
    }
  }, [tasks, moveMutation]);

  const handleCreate = () => {
    form.validateFields().then(values => {
      createMutation.mutate({
        title: values.title,
        description: values.description,
        priority: values.priority || 'medium',
        status: defaultStatus,
        assignedAgentId: values.assignedAgentId,
        departmentId: values.departmentId,
        workflowId: values.workflowId,
        estimatedMinutes: values.estimatedMinutes,
        dueAt: values.dueAt ? values.dueAt.valueOf() : undefined,
      });
    });
  };

  const handleEdit = () => {
    if (!editingTask) return;
    editForm.validateFields().then(values => {
      updateMutation.mutate({
        id: editingTask.id,
        body: {
          title: values.title,
          description: values.description,
          priority: values.priority,
          assignedAgentId: values.assignedAgentId,
          dueAt: values.dueAt ? values.dueAt.valueOf() : null,
        },
      });
    });
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这个任务吗？',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => deleteMutation.mutate(id),
    });
  };

  // 执行任务
  const handleExecute = async (taskId: string) => {
    setExecutingTaskId(taskId);
    try {
      await api.post(`/tasks/${taskId}/execute`, {});
      message.success('任务开始执行');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '执行失败';
      message.error(msg);
    } finally {
      setExecutingTaskId(null);
    }
  };

  // 点击任务卡片 → 打开详情
  const handleTaskClick = (task: Task) => {
    setDetailTask(task);
    setDetailOpen(true);
  };

  // 筛选后的任务列表
  const filteredTasks = tasks.filter(t => {
    if (searchText) {
      const lower = searchText.toLowerCase();
      if (!t.title.toLowerCase().includes(lower) && !(t.description || '').toLowerCase().includes(lower)) {
        return false;
      }
    }
    if (filterAgent && t.assignedAgentId !== filterAgent) return false;
    if (filterDept && t.departmentId !== filterDept) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const getTasksByStatus = (status: TaskStatus) => filteredTasks.filter(t => t.status === status);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部：标题 + 筛选栏 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Title level={4} style={{ color: '#f2f2f2', margin: 0 }}>协作看板</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setDefaultStatus('todo');
            setCreateModalOpen(true);
          }}>
            新建任务
          </Button>
        </div>
        {/* 筛选栏 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#595959' }} />}
            placeholder="搜索任务..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
            style={{ width: 200, background: '#101010', borderColor: '#3d3a39' }}
          />
          <Select
            allowClear
            placeholder="负责人"
            value={filterAgent}
            onChange={setFilterAgent}
            style={{ width: 140 }}
            options={agents.map(a => {
              const r = AGENT_ROLES[a.role] || AGENT_ROLES.custom;
              return { value: a.id, label: `${r.icon} ${a.name}` };
            })}
          />
          <Select
            allowClear
            placeholder="部门"
            value={filterDept}
            onChange={setFilterDept}
            style={{ width: 130 }}
            options={departments.map(d => ({ value: d.id, label: d.name }))}
          />
          <Select
            allowClear
            placeholder="优先级"
            value={filterPriority}
            onChange={setFilterPriority}
            style={{ width: 110 }}
            options={[
              { value: 'critical', label: '紧急' },
              { value: 'high', label: '高' },
              { value: 'medium', label: '中' },
              { value: 'low', label: '低' },
            ]}
          />
        </div>
      </div>

      {tasksLoading || agentsLoading ? (
        <div style={{ display: 'flex', gap: 12 }}>
          {COLUMNS.map(col => (
            <Card key={col.status} style={{ flex: 1, minWidth: 240, background: '#050507', borderRadius: 8 }}>
              <Skeleton active />
              <Skeleton active />
            </Card>
          ))}
        </div>
      ) : (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: 'flex', gap: 12, flex: 1, overflow: 'auto' }}>
          {COLUMNS.map(col => {
            const columnTasks = getTasksByStatus(col.status);
            return (
              <div
                key={col.status}
                style={{
                  flex: 1,
                  minWidth: 240,
                  background: '#050507',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* 列头 */}
                <div style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid #3d3a39',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <Space>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                    <Text style={{ color: '#f2f2f2', fontWeight: 600 }}>{col.label}</Text>
                    <Tag style={{ background: '#3d3a39', color: '#8b949e', border: 'none', fontSize: 11 }}>{columnTasks.length}</Tag>
                  </Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined />}
                    style={{ color: '#595959' }}
                    onClick={() => {
                      setDefaultStatus(col.status);
                      setCreateModalOpen(true);
                    }}
                  />
                </div>

                {/* 列内容 */}
                <SortableContext
                  id={col.status}
                  items={columnTasks.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div style={{ padding: 8, flex: 1, overflow: 'auto', minHeight: 100 }}>
                    {columnTasks.map(task => (
                      <SortableTaskCard
                        key={task.id}
                        task={task}
                        agents={agents}
                        onClick={handleTaskClick}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div style={{ opacity: 0.85, transform: 'rotate(2deg)' }}>
              <TaskCard task={activeTask} agents={agents} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {/* 任务详情 Drawer */}
      <TaskDetailDrawer
        task={detailTask}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailTask(null); }}
        agents={agents}
        departments={departments}
        workflows={workflows}
        onEdit={(task) => {
          setDetailOpen(false);
          setEditingTask(task);
          editForm.setFieldsValue({
            title: task.title,
            description: task.description,
            priority: task.priority,
            assignedAgentId: task.assignedAgentId,
            dueAt: task.dueAt ? dayjs(task.dueAt) : undefined,
          });
          setEditModalOpen(true);
        }}
        onDelete={handleDelete}
        onExecute={handleExecute}
        isExecuting={executingTaskId === detailTask?.id}
      />

      {/* 创建任务弹窗 */}
      <Modal
        title="新建任务"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        confirmLoading={createMutation.isPending}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" initialValues={{ priority: 'medium' }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入任务标题' }]}>
            <Input placeholder="任务标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="任务描述（可选）" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="priority" label="优先级" style={{ flex: 1 }}>
              <Select>
                <Select.Option value="critical">紧急</Select.Option>
                <Select.Option value="high">高</Select.Option>
                <Select.Option value="medium">中</Select.Option>
                <Select.Option value="low">低</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="estimatedMinutes" label="预估时间(分)" style={{ flex: 1 }}>
              <Input type="number" placeholder="60" />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="dueAt" label="截止日期" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} placeholder="选择截止日期" />
            </Form.Item>
            <Form.Item name="workflowId" label="关联工作流" style={{ flex: 1 }}>
              <Select allowClear placeholder="选择工作流（可选）">
                {workflows.map(w => (
                  <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="assignedAgentId" label="指派给">
            <Select allowClear placeholder="选择员工（可选）">
              {agents.map(a => {
                const roleInfo = AGENT_ROLES[a.role] || AGENT_ROLES.custom;
                return (
                  <Select.Option key={a.id} value={a.id}>
                    {roleInfo.icon} {a.name} - {roleInfo.label}
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>
          <Form.Item name="departmentId" label="所属部门">
            <Select allowClear placeholder="选择部门（可选）">
              {departments.map(d => (
                <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑任务弹窗 */}
      <Modal
        title="编辑任务"
        open={editModalOpen}
        onOk={handleEdit}
        onCancel={() => { setEditModalOpen(false); setEditingTask(null); editForm.resetFields(); }}
        confirmLoading={updateMutation.isPending}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入任务标题' }]}>
            <Input placeholder="任务标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="任务描述（可选）" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="priority" label="优先级" style={{ flex: 1 }}>
              <Select>
                <Select.Option value="critical">紧急</Select.Option>
                <Select.Option value="high">高</Select.Option>
                <Select.Option value="medium">中</Select.Option>
                <Select.Option value="low">低</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="dueAt" label="截止日期" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} placeholder="选择截止日期" />
            </Form.Item>
          </div>
          <Form.Item name="assignedAgentId" label="指派给">
            <Select allowClear placeholder="选择员工（可选）">
              {agents.map(a => {
                const roleInfo = AGENT_ROLES[a.role] || AGENT_ROLES.custom;
                return (
                  <Select.Option key={a.id} value={a.id}>
                    {roleInfo.icon} {a.name} - {roleInfo.label}
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
