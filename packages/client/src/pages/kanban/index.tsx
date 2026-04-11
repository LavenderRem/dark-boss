import { useState, useCallback } from 'react';
import { Card, Button, Modal, Form, Input, Select, Tag, Typography, Space, message, Dropdown } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
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
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { api } from '../../api/client.js';
import type { Task, TaskStatus, TaskPriority, Agent } from '@dark-boss/shared';
import { AGENT_ROLES } from '@dark-boss/shared';

const { Title, Text } = Typography;

// 看板列配置
const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'backlog', label: '待规划', color: '#8c8c8c' },
  { status: 'todo', label: '待办', color: '#1890ff' },
  { status: 'in_progress', label: '进行中', color: '#faad14' },
  { status: 'review', label: '审核中', color: '#722ed1' },
  { status: 'done', label: '已完成', color: '#52c41a' },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  critical: { label: '紧急', color: '#ff4d4f' },
  high: { label: '高', color: '#fa8c16' },
  medium: { label: '中', color: '#1890ff' },
  low: { label: '低', color: '#8c8c8c' },
};

// 可拖拽的任务卡片
function TaskCard({ task, agents, onEdit, onDelete }: {
  task: Task;
  agents: Agent[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  const assignee = agents.find(a => a.id === task.assignedAgentId);
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const roleInfo = assignee ? (AGENT_ROLES[assignee.role] || AGENT_ROLES.custom) : null;

  return (
    <Card
      size="small"
      style={{
        background: '#2a2a2a',
        borderLeft: `3px solid ${priorityConfig.color}`,
        cursor: 'grab',
        marginBottom: 8,
      }}
      styles={{ body: { padding: '8px 12px' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#e8e8e8', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
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
          </Space>
        </div>
        <Dropdown
          menu={{
            items: [
              { key: 'edit', icon: <EditOutlined />, label: '编辑', onClick: () => onEdit(task) },
              { type: 'divider' as const },
              { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => onDelete(task.id) },
            ],
          }}
          trigger={['click']}
        >
          <Button type="text" size="small" style={{ color: '#595959' }}>
            ...
          </Button>
        </Dropdown>
      </div>
      {assignee && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 14 }}>{roleInfo?.icon}</span>
          <Text style={{ color: '#8c8c8c', fontSize: 11 }}>{assignee.name}</Text>
        </div>
      )}
    </Card>
  );
}

export function KanbanPage() {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get<Task[]>('/tasks'),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get<Agent[]>('/agents'),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/departments'),
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
      message.success('任务删除成功');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  }, [tasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    // over.id 可能是列的 status 或另一个 task 的 id
    const overId = over.id as string;

    // 检查是否拖到了列上
    const targetColumn = COLUMNS.find(c => c.status === overId);
    if (targetColumn) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== targetColumn.status) {
        moveMutation.mutate({ id: taskId, status: targetColumn.status, columnOrder: Date.now() });
      }
      return;
    }

    // 拖到另一个 task 上：获取目标 task 的 status
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
        estimatedMinutes: values.estimatedMinutes,
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

  const getTasksByStatus = (status: TaskStatus) => tasks.filter(t => t.status === status);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ color: '#e8e8e8', margin: 0 }}>协作看板</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setDefaultStatus('todo');
          setCreateModalOpen(true);
        }}>
          新建任务
        </Button>
      </div>

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
                  background: '#1a1a2e',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* 列头 */}
                <div style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid #303030',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <Space>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                    <Text style={{ color: '#e8e8e8', fontWeight: 600 }}>{col.label}</Text>
                    <Tag style={{ background: '#303030', color: '#8c8c8c', border: 'none', fontSize: 11 }}>{columnTasks.length}</Tag>
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
                      <div key={task.id} id={task.id} style={{ marginBottom: 4 }}>
                        <TaskCard
                          task={task}
                          agents={agents}
                          onEdit={(t) => {
                            setEditingTask(t);
                            editForm.setFieldsValue({
                              title: t.title,
                              description: t.description,
                              priority: t.priority,
                              assignedAgentId: t.assignedAgentId,
                            });
                            setEditModalOpen(true);
                          }}
                          onDelete={handleDelete}
                        />
                      </div>
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
              <TaskCard task={activeTask} agents={agents} onEdit={() => {}} onDelete={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
          <Form.Item name="priority" label="优先级">
            <Select>
              <Select.Option value="critical">紧急</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="low">低</Select.Option>
            </Select>
          </Form.Item>
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
