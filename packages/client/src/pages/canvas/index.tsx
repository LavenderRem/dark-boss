import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Modal, Input, Form, Card, Typography, Button, Space, message, Empty, Skeleton } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlowCanvas } from './components/flow-canvas.js';
import { useWorkflowStore } from '../../stores/workflow-store.js';
import { api } from '../../api/client.js';

const { Title, Text } = Typography;

interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updated_at: number;
}

export function CanvasPage() {
  const [showList, setShowList] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const { workflowId } = useWorkflowStore();

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.get<WorkflowSummary[]>('/workflows'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      api.post<{ id: string }>('/workflows', body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setCreateModalOpen(false);
      form.resetFields();
      // 加载新建的工作流
      loadWorkflow(data.id);
      message.success('工作流创建成功');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/workflows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      message.success('工作流已删除');
      // 如果删除的是当前工作流，回到列表
      const store = useWorkflowStore.getState();
      if (store.workflowId === null || workflows.find(w => w.id === store.workflowId) === undefined) {
        setShowList(true);
      }
    },
    onError: (err: Error) => message.error(err.message),
  });

  const loadWorkflow = async (id: string) => {
    try {
      const workflow = await api.get<{ id: string; name: string; status: string; nodes: unknown[]; edges: unknown[] }>(`/workflows/${id}`);
      useWorkflowStore.getState().setWorkflow(workflow as never);
      setShowList(false);
    } catch (err) {
      message.error('加载工作流失败');
    }
  };

  // 如果没有当前工作流，显示列表
  useEffect(() => {
    if (!workflowId && workflows.length > 0) {
      // 自动加载最近更新的工作流
      setShowList(true);
    } else if (!workflowId && workflows.length === 0 && !isLoading) {
      // 没有任何工作流，直接显示列表让用户创建
      setShowList(true);
    }
  }, [workflowId, workflows.length, isLoading]);

  // 工作流列表视图
  if (showList) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ color: '#e8e8e8', margin: 0 }}>工作流</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建工作流
          </Button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} style={{ width: 300, background: '#1f1f1f' }}><Skeleton active /></Card>
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <Empty description={<span style={{ color: '#595959' }}>暂无工作流，点击上方按钮创建</span>} />
        ) : (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {workflows.map(wf => (
              <Card
                key={wf.id}
                hoverable
                style={{ width: 300, background: '#1f1f1f', cursor: 'pointer' }}
                onClick={() => loadWorkflow(wf.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#e8e8e8', marginBottom: 4 }}>{wf.name}</div>
                    <Text style={{ color: '#8c8c8c', fontSize: 12 }}>
                      {wf.description || '无描述'}
                    </Text>
                  </div>
                  <Space size={4}>
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      danger
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(wf.id);
                      }}
                    />
                  </Space>
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#595959', fontSize: 11 }}>
                    {new Date(wf.updated_at).toLocaleString('zh-CN')}
                  </Text>
                  <Text style={{ fontSize: 11, color: wf.status === 'draft' ? '#8c8c8c' : '#52c41a' }}>
                    {wf.status === 'draft' ? '草稿' : wf.status === 'running' ? '运行中' : wf.status}
                  </Text>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* 新建工作流弹窗 */}
        <Modal
          title="新建工作流"
          open={createModalOpen}
          onOk={() => form.validateFields().then(values => {
            createMutation.mutate({ name: values.name, description: values.description });
          })}
          onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
          confirmLoading={createMutation.isPending}
          okText="创建"
          cancelText="取消"
        >
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入工作流名称' }]}>
              <Input placeholder="工作流名称" />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={2} placeholder="可选描述" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }

  // 画布视图
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ReactFlowProvider>
        <FlowCanvas
          onBackToList={() => setShowList(true)}
          onSave={async () => {
            const store = useWorkflowStore.getState();
            if (!store.workflowId) {
              message.warning('无法保存，工作流 ID 缺失');
              return;
            }
            try {
              await api.patch(`/workflows/${store.workflowId}`, {
                name: store.workflowName,
                nodes: store.nodes.map(n => ({
                  id: n.id,
                  type: n.type,
                  position: n.position,
                  data: n.data,
                })),
                edges: store.edges.map(e => ({
                  id: e.id,
                  source: e.source,
                  target: e.target,
                  sourceHandle: e.sourceHandle,
                  targetHandle: e.targetHandle,
                })),
              });
              store.markSaved();
              message.success('工作流已保存');
            } catch {
              message.error('保存失败');
            }
          }}
          onRun={async () => {
            const store = useWorkflowStore.getState();
            if (!store.workflowId) return;
            try {
              // 执行前自动保存
              await api.patch(`/workflows/${store.workflowId}`, {
                name: store.workflowName,
                nodes: store.nodes.map(n => ({
                  id: n.id,
                  type: n.type,
                  position: n.position,
                  data: n.data,
                })),
                edges: store.edges.map(e => ({
                  id: e.id,
                  source: e.source,
                  target: e.target,
                  sourceHandle: e.sourceHandle,
                  targetHandle: e.targetHandle,
                })),
              });
              store.markSaved();

              await api.post(`/workflows/${store.workflowId}/execute`);
              message.success('工作流开始执行');
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : '执行失败';
              message.error(msg);
            }
          }}
        />
      </ReactFlowProvider>
    </div>
  );
}
