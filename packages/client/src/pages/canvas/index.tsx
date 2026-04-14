import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Modal, Input, Form, Card, Typography, Button, Space, message, Empty, Skeleton, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, PlayCircleOutlined, FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlowCanvas } from './components/flow-canvas.js';
import { ExecutionLogPanel } from './components/execution-log-panel.js';
import { useWorkflowStore } from '../../stores/workflow-store.js';
import { api } from '../../api/client.js';
import { MarkdownRenderer } from '../../components/chat/markdown-renderer.js';

const { Title, Text } = Typography;

interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updatedAt: number;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  draft: { color: 'default', label: '草稿', icon: <FileTextOutlined /> },
  running: { color: 'processing', label: '运行中', icon: <LoadingOutlined spin /> },
  completed: { color: 'success', label: '已完成', icon: <CheckCircleOutlined /> },
  failed: { color: 'error', label: '失败', icon: <CloseCircleOutlined /> },
};

export function CanvasPage() {
  const [showList, setShowList] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [runInput, setRunInput] = useState('');
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const { workflowId, workflowResult, isRunning, setRunning, setWorkflowResult, toggleLogPanel } = useWorkflowStore();

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

  useEffect(() => {
    if (!workflowId && workflows.length > 0) {
      setShowList(true);
    } else if (!workflowId && workflows.length === 0 && !isLoading) {
      setShowList(true);
    }
  }, [workflowId, workflows.length, isLoading]);

  // 监听 WebSocket 工作流执行完成事件
  useEffect(() => {
    const handler = (event: Event) => {
      const { type, payload } = (event as CustomEvent).detail;
      if (type === 'workflow:progress' && payload) {
        if (payload.status === 'running') {
          setRunning(true);
          if (payload.executionId) {
            useWorkflowStore.getState().setExecutionId(payload.executionId);
          }
        }
        if (payload.status === 'completed') {
          setRunning(false);
          const currentId = useWorkflowStore.getState().workflowId;
          if (currentId) {
            setTimeout(async () => {
              try {
                const wf = await api.get<{ variables: Record<string, string> }>(`/workflows/${currentId}`);
                const vars = wf.variables;
                if (vars && typeof vars === 'object') {
                  const outputs = Object.values(vars);
                  if (outputs.length > 0) {
                    setWorkflowResult(outputs.join('\n\n'));
                    setResultModalOpen(true);
                  }
                }
              } catch { /* ignore */ }
            }, 500);
          }
        }
        if (payload.status === 'failed') {
          setRunning(false);
          message.error('工作流执行失败');
        }
      }
    };
    window.addEventListener('ws:message', handler);
    return () => window.removeEventListener('ws:message', handler);
  }, [setRunning, setWorkflowResult]);

  // 手动查看执行结果
  const handleViewResult = async (targetId?: string) => {
    const id = targetId || workflowId;
    if (!id) return;
    try {
      const wf = await api.get<{ variables: Record<string, string>; status: string }>(`/workflows/${id}`);
      if (wf.status === 'completed' && wf.variables) {
        const vars = typeof wf.variables === 'string' ? JSON.parse(wf.variables) : wf.variables;
        const outputs = Object.values(vars);
        if (outputs.length > 0) {
          setWorkflowResult(outputs.join('\n\n'));
        } else {
          setWorkflowResult('(无输出结果)');
        }
      } else if (wf.status === 'running') {
        setWorkflowResult('工作流正在执行中...');
      } else {
        setWorkflowResult('工作流尚未执行或无结果');
      }
      setResultModalOpen(true);
    } catch {
      message.error('获取结果失败');
    }
  };

  // 画布视图
  if (!showList) {
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
            onRun={() => {
              setRunInput('');
              setRunModalOpen(true);
            }}
            onViewResult={() => handleViewResult()}
            onToggleLogPanel={toggleLogPanel}
            isRunning={isRunning}
          />
        </ReactFlowProvider>

        {/* 执行工作流弹窗 */}
        <Modal
          title={
            <Space>
              <PlayCircleOutlined />
              <span>执行工作流</span>
            </Space>
          }
          open={runModalOpen}
          onOk={async () => {
            const store = useWorkflowStore.getState();
            if (!store.workflowId) return;
            try {
              setRunModalOpen(false);
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

              await api.post(`/workflows/${store.workflowId}/execute`, { input: runInput });
              message.success('工作流开始执行');
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : '执行失败';
              message.error(msg);
            }
          }}
          onCancel={() => setRunModalOpen(false)}
          okText="开始执行"
          cancelText="取消"
          width={520}
        >
          <div style={{ marginBottom: 12 }}>
            <Text style={{ color: '#8c8c8c' }}>
              输入内容将作为工作流的初始输入，传递给「输入节点」。
            </Text>
          </div>
          <Input.TextArea
            value={runInput}
            onChange={e => setRunInput(e.target.value)}
            placeholder="输入工作流的初始内容（可选）..."
            autoSize={{ minRows: 3, maxRows: 8 }}
            style={{ background: '#2a2a2a', color: '#e8e8e8', borderColor: '#303030' }}
          />
        </Modal>

        {/* 执行结果弹窗 */}
        <Modal
          title={
            <Space>
              <FileTextOutlined />
              <span>执行结果</span>
            </Space>
          }
          open={resultModalOpen}
          onCancel={() => setResultModalOpen(false)}
          footer={
            <Space>
              <Button onClick={() => setResultModalOpen(false)}>关闭</Button>
              <Button
                type="primary"
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(workflowResult || '');
                  message.success('已复制到剪贴板');
                }}
              >
                复制
              </Button>
            </Space>
          }
          width={720}
          styles={{ body: { maxHeight: '60vh', overflow: 'auto' } }}
        >
          <div style={{
            background: '#1a1a1a',
            borderRadius: 8,
            padding: '16px 20px',
            color: '#e8e8e8',
          }}>
            {workflowResult ? (
              <MarkdownRenderer content={workflowResult} />
            ) : (
              <Text style={{ color: '#595959' }}>无结果</Text>
            )}
          </div>
        </Modal>

        {/* 执行日志面板 */}
        <ExecutionLogPanel />
      </div>
    );
  }

  // 工作流列表视图
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
          {workflows.map(wf => {
            const st = STATUS_CONFIG[wf.status] || STATUS_CONFIG.draft;
            return (
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
                    {wf.status === 'completed' && (
                      <Button
                        type="text"
                        size="small"
                        icon={<EyeOutlined />}
                        style={{ color: '#52c41a' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewResult(wf.id);
                        }}
                      />
                    )}
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
                    {new Date(wf.updatedAt).toLocaleString('zh-CN')}
                  </Text>
                  <Tag color={st.color} icon={st.icon} style={{ fontSize: 11, margin: 0 }}>
                    {st.label}
                  </Tag>
                </div>
              </Card>
            );
          })}
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

      {/* 列表中也复用结果弹窗 */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            <span>执行结果</span>
          </Space>
        }
        open={resultModalOpen}
        onCancel={() => setResultModalOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setResultModalOpen(false)}>关闭</Button>
            <Button
              type="primary"
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(workflowResult || '');
                message.success('已复制到剪贴板');
              }}
            >
              复制
            </Button>
          </Space>
        }
        width={720}
        styles={{ body: { maxHeight: '60vh', overflow: 'auto' } }}
      >
        <div style={{
          background: '#1a1a1a',
          borderRadius: 8,
          padding: '16px 20px',
          color: '#e8e8e8',
        }}>
          {workflowResult ? (
            <MarkdownRenderer content={workflowResult} />
          ) : (
            <Text style={{ color: '#595959' }}>无结果</Text>
          )}
        </div>
      </Modal>
    </div>
  );
}
