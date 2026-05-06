import { useState, useCallback, useEffect } from 'react';
import { Button, Card, Modal, Form, Input, Select, Typography, Skeleton, DatePicker, Tag, App } from 'antd';
import {
  PlusOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../../api/client.js';
import type { Task, TaskStatus, Agent } from '@dark-boss/shared';
import { AGENT_ROLES } from '@dark-boss/shared';
import { TaskDetailDrawer } from './components/task-detail-drawer.js';
import { ViewSwitcher, type ViewMode } from './components/view-switcher.js';
import { KanbanView } from './components/kanban-view.js';
import { ListView } from './components/list-view.js';
import { AgentView } from './components/agent-view.js';
import { WorkloadOverview } from './components/workload-overview.js';
import { useAgentWorkload } from './hooks/use-agent-workload.js';
import { useTaskFilters } from './hooks/use-task-filters.js';
import { useKanbanDnd } from './hooks/use-kanban-dnd.js';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts.js';
import { getSortedAgentsForAssign } from './utils/get-sorted-agents.js';
import { getAllTemplates, type TaskTemplate } from './utils/task-templates.js';
import { checkWipLimit } from './utils/wip-limits.js';
import { BatchActions } from './components/batch-actions.js';

const { Title } = Typography;

// 负责人选择器内部组件（访问表单值以计算智能排序）
function AssigneeSelect({ agents, workloads }: { agents: Agent[]; workloads: any[] }) {
  const form = Form.useFormInstance();
  const formValues = Form.useWatch('title', form) ? form.getFieldsValue() : {};

  const sortedAgents = getSortedAgentsForAssign(
    agents,
    workloads,
    formValues.title || '',
    formValues.description || null,
    formValues.tags || []
  );

  return (
    <Select
      allowClear
      placeholder="选择员工（可选）"
      showSearch
      optionFilterProp="children"
    >
      {sortedAgents.map(a => {
        const roleInfo = AGENT_ROLES[a.role] || AGENT_ROLES.custom;
        const workload = workloads.find((w: any) => w.agentId === a.id);
        const loadPercent = workload?.loadPercent || 0;
        const inProgressCount = workload?.inProgressCount || 0;
        return (
          <Select.Option key={a.id} value={a.id}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>
                {roleInfo.icon} {a.name} - {roleInfo.label}
              </span>
              <span style={{ fontSize: 11, color: loadPercent > 60 ? '#fb565b' : '#8b949e' }}>
                {inProgressCount} 进行中 ({loadPercent}%)
              </span>
            </div>
          </Select.Option>
        );
      })}
    </Select>
  );
}

export function KanbanPage() {
  const { modal, message } = App.useApp();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedAgentForOverview, setSelectedAgentForOverview] = useState<string | undefined>(undefined);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

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

  // 计算 Agent 工作量
  const workloads = useAgentWorkload(tasks, agents);

  // 使用筛选 Hook
  const {
    searchText,
    setSearchText,
    filterAgent,
    setFilterAgent,
    filterDept,
    setFilterDept,
    filterPriority,
    setFilterPriority,
    filteredTasks,
  } = useTaskFilters(tasks);

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

  // WIP 限制检查
  const checkWipLimitBeforeMove = useCallback(async (taskId: string, targetStatus: TaskStatus) => {
    const targetTasksCount = filteredTasks.filter(t => t.status === targetStatus && t.id !== taskId).length;
    const { exceeded, limit } = checkWipLimit(targetStatus, targetTasksCount);

    if (exceeded) {
      return new Promise<boolean>((resolve) => {
        modal.confirm({
          title: 'WIP 限制警告',
          icon: <ExclamationCircleOutlined />,
          content: `目标列 "${targetStatus}" 已达到 WIP 上限 (${limit} 个任务)。是否仍要移动？`,
          okText: '继续移动',
          cancelText: '取消',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
    }
    return true;
  }, [filteredTasks]);

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

  // 使用拖拽 Hook（需要在 moveMutation 定义后）
  const { activeTask, sensors, handleDragStart, handleDragEnd } = useKanbanDnd(
    filteredTasks,
    useCallback(
      async (params) => {
        const confirmed = await checkWipLimitBeforeMove(params.id, params.status);
        if (confirmed) {
          moveMutation.mutate(params);
        }
      },
      [moveMutation, checkWipLimitBeforeMove]
    )
  );

  // WebSocket 实时同步
  useEffect(() => {
    const handler = (event: Event) => {
      const { type, payload } = (event as CustomEvent).detail;
      if (type === 'task:updated') {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
      if (type === 'task:progress') {
        queryClient.setQueryData<Task[]>(['tasks'], (old) => {
          if (!old) return old;
          return old.map((t) =>
            t.id === payload.taskId
              ? { ...t, progress: payload.progress, activitySummary: payload.summary }
              : t
          );
        });
      }
      if (type === 'task:activity') {
        queryClient.setQueryData<Task[]>(['tasks'], (old) => {
          if (!old) return old;
          return old.map((t) => (t.id === payload.taskId ? { ...t, activitySummary: payload.detail } : t));
        });
      }
    };
    window.addEventListener('ws:message', handler);
    return () => window.removeEventListener('ws:message', handler);
  }, [queryClient]);

  const handleCreate = () => {
    form.validateFields().then((values) => {
      const taskType = values.taskType || (selectedTemplate?.defaultTaskType || 'task');
      const tags = values.tags || selectedTemplate?.defaultTags || [];

      createMutation.mutate({
        title: values.title,
        description: values.description,
        priority: values.priority || 'medium',
        status: defaultStatus,
        taskType,
        tags,
        assignedAgentId: values.assignedAgentId,
        departmentId: values.departmentId,
        workflowId: values.workflowId,
        estimatedMinutes: values.estimatedMinutes,
        dueAt: values.dueAt ? values.dueAt.valueOf() : undefined,
      });
    });
  };

  const handleSelectTemplate = (templateId: string) => {
    const template = getAllTemplates().find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      form.setFieldsValue({
        taskType: template.defaultTaskType,
        tags: template.defaultTags,
      });
      // 如果有默认角色，设置默认负责人
      if (template.defaultRole) {
        const defaultAgent = agents.find(a => a.role === template.defaultRole);
        if (defaultAgent) {
          form.setFieldsValue({ assignedAgentId: defaultAgent.id });
        }
      }
    }
  };

  const handleEdit = () => {
    if (!editingTask) return;
    editForm.validateFields().then((values) => {
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
    modal.confirm({
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
  const handleTaskClick = (task: Task, event?: React.MouseEvent) => {
    if (event?.ctrlKey || event?.metaKey) {
      // Ctrl+点击切换选中状态
      const newSelection = new Set(selectedTaskIds);
      if (newSelection.has(task.id)) {
        newSelection.delete(task.id);
      } else {
        newSelection.add(task.id);
      }
      setSelectedTaskIds(newSelection);
    } else {
      setDetailTask(task);
      setDetailOpen(true);
    }
  };

  // 批量操作
  const batchMutation = useMutation({
    mutationFn: (body: { taskIds: string[]; updates: Record<string, unknown> }) =>
      api.patch('/tasks/batch', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTaskIds(new Set());
      message.success('批量操作成功');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const handleBatchDelete = () => {
    if (selectedTaskIds.size === 0) return;

    modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除选中的 ${selectedTaskIds.size} 个任务吗？`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await Promise.all(Array.from(selectedTaskIds).map(id => api.delete(`/tasks/${id}`)));
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          setSelectedTaskIds(new Set());
          message.success('批量删除成功');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '批量删除失败';
          message.error(msg);
        }
      },
    });
  };

  // 快捷键处理
  useKeyboardShortcuts({
    onCreate: () => {
      setDefaultStatus('todo');
      setCreateModalOpen(true);
    },
    onEdit: () => {
      if (selectedTaskIds.size === 1) {
        const task = tasks.find(t => t.id === Array.from(selectedTaskIds)[0]);
        if (task) {
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
        }
      }
    },
    onDelete: () => {
      if (selectedTaskIds.size > 0) {
        handleBatchDelete();
      }
    },
    onViewChange: (viewIndex) => {
      const views: ViewMode[] = ['kanban', 'list', 'agent'];
      setViewMode(views[viewIndex]);
    },
    onEscape: () => {
      if (selectedTaskIds.size > 0) {
        setSelectedTaskIds(new Set());
      } else if (detailOpen) {
        setDetailOpen(false);
        setDetailTask(null);
      } else if (createModalOpen) {
        setCreateModalOpen(false);
        form.resetFields();
        setSelectedTemplate(null);
      } else if (editModalOpen) {
        setEditModalOpen(false);
        setEditingTask(null);
        editForm.resetFields();
      }
    },
    onSelectAll: () => {
      if (selectedTaskIds.size === filteredTasks.length) {
        setSelectedTaskIds(new Set());
      } else {
        setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
      }
    },
  });

  // 快速创建任务（点击列头的 + 按钮）
  const handleQuickCreate = (status: TaskStatus) => {
    setDefaultStatus(status);
    setCreateModalOpen(true);
  };

  // 点击 Agent 卡片 → 切换筛选
  const handleAgentCardClick = useCallback(
    (agentId: string) => {
      if (selectedAgentForOverview === agentId) {
        // 如果已选中，则取消筛选
        setSelectedAgentForOverview(undefined);
        setFilterAgent(undefined);
      } else {
        // 选中新 Agent
        setSelectedAgentForOverview(agentId);
        setFilterAgent(agentId);
      }
    },
    [selectedAgentForOverview, setFilterAgent]
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部：标题 + 视图切换 + 筛选栏 */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Title level={4} style={{ color: '#f2f2f2', margin: 0 }}>
              协作看板
            </Title>
            <ViewSwitcher current={viewMode} onChange={setViewMode} />
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setDefaultStatus('todo');
              setCreateModalOpen(true);
            }}
          >
            新建任务
          </Button>
        </div>
        {/* 筛选栏 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#595959' }} />}
            placeholder="搜索任务..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 200, background: '#101010', borderColor: '#3d3a39' }}
          />
          <Select
            allowClear
            placeholder="负责人"
            value={filterAgent}
            onChange={setFilterAgent}
            style={{ width: 140 }}
            options={agents.map((a) => {
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
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
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

      {/* 团队负载概览 */}
      {!agentsLoading && (
        <WorkloadOverview
          workloads={workloads}
          selectedAgentId={selectedAgentForOverview}
          onAgentClick={handleAgentCardClick}
        />
      )}

      {tasksLoading || agentsLoading ? (
        <div style={{ display: 'flex', gap: 12 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Card
              key={i}
              style={{ flex: 1, minWidth: 240, background: '#050507', borderRadius: 8 }}
            >
              <Skeleton active />
              <Skeleton active />
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* 根据视图模式渲染不同视图 */}
          {viewMode === 'kanban' && (
            <KanbanView
              tasks={filteredTasks}
              agents={agents}
              activeTask={activeTask}
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onTaskClick={handleTaskClick}
              onQuickCreate={handleQuickCreate}
              selectedTaskIds={selectedTaskIds}
            />
          )}

          {viewMode === 'list' && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <ListView
                tasks={filteredTasks}
                agents={agents}
                onTaskClick={handleTaskClick}
                selectedTaskIds={selectedTaskIds}
              />
            </div>
          )}

          {viewMode === 'agent' && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <AgentView
                tasks={filteredTasks}
                agents={agents}
                onTaskClick={handleTaskClick}
                selectedTaskIds={selectedTaskIds}
              />
            </div>
          )}
        </>
      )}

      {/* 批量操作栏 */}
      {selectedTaskIds.size > 0 && (
        <BatchActions
          selectedCount={selectedTaskIds.size}
          onClearSelection={() => setSelectedTaskIds(new Set())}
          onBatchStatusChange={(status) =>
            batchMutation.mutate({ taskIds: Array.from(selectedTaskIds), updates: { status } })
          }
          onBatchPriorityChange={(priority) =>
            batchMutation.mutate({ taskIds: Array.from(selectedTaskIds), updates: { priority } })
          }
          onBatchAssign={(agentId) =>
            batchMutation.mutate({ taskIds: Array.from(selectedTaskIds), updates: { assignedAgentId: agentId } })
          }
          onBatchDelete={handleBatchDelete}
        />
      )}

      {/* 任务详情 Drawer */}
      <TaskDetailDrawer
        task={detailTask}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailTask(null);
        }}
        agents={agents}
        allTasks={tasks}
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
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
          setSelectedTemplate(null);
        }}
        confirmLoading={createMutation.isPending}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" initialValues={{ priority: 'medium' }}>
          {/* 模板选择 */}
          <Form.Item label="选择模板（可选）">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {getAllTemplates().map(template => (
                <Tag
                  key={template.id}
                  icon={<span style={{ marginRight: 4 }}>{template.icon}</span>}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 12px',
                    fontSize: 13,
                    borderRadius: 4,
                    border: selectedTemplate?.id === template.id ? '1px solid #00d992' : '1px solid #3d3a39',
                    background: selectedTemplate?.id === template.id ? 'rgba(0, 217, 146, 0.1)' : 'transparent',
                  }}
                  onClick={() => handleSelectTemplate(template.id)}
                >
                  {template.name}
                </Tag>
              ))}
            </div>
            {selectedTemplate && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#8b949e' }}>
                {selectedTemplate.description} • 子任务: {selectedTemplate.subtasks.join(', ')}
              </div>
            )}
          </Form.Item>

          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入任务标题' }]}>
            <Input placeholder="任务标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="任务描述（可选）" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="taskType" label="任务类型" style={{ flex: 1 }}>
              <Select allowClear placeholder="选择任务类型（可选）">
                <Select.Option value="epic">EPIC</Select.Option>
                <Select.Option value="story">STORY</Select.Option>
                <Select.Option value="task">TASK</Select.Option>
                <Select.Option value="subtask">SUBTASK</Select.Option>
              </Select>
            </Form.Item>
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
                {workflows.map((w) => (
                  <Select.Option key={w.id} value={w.id}>
                    {w.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="assignedAgentId" label="指派给">
            <AssigneeSelect agents={agents} workloads={workloads} />
          </Form.Item>
          <Form.Item name="departmentId" label="所属部门">
            <Select allowClear placeholder="选择部门（可选）">
              {departments.map((d) => (
                <Select.Option key={d.id} value={d.id}>
                  {d.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select
              mode="tags"
              allowClear
              placeholder="添加标签（可选）"
              style={{ width: '100%' }}
              tokenSeparators={[',']}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑任务弹窗 */}
      <Modal
        title="编辑任务"
        open={editModalOpen}
        onOk={handleEdit}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingTask(null);
          editForm.resetFields();
        }}
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
              {agents.map((a) => {
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
