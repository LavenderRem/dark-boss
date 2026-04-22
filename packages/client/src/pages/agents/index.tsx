import { useState } from 'react';
import {
  Row, Col, Card, Typography, Button, Modal, Form, Input, Select, Tag,
  Space, Popconfirm, message, Descriptions, Skeleton, Empty, Tooltip, Tabs, Table,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import type { Agent } from '@dark-boss/shared';
import { AGENT_ROLES, AGENT_STATUS_COLORS, AGENT_STATUS_LABELS } from '@dark-boss/shared';
import { AgentTerminal } from '../../components/agent/agent-terminal.js';
import { FileExplorer } from '../../components/agent/file-explorer.js';
import { ContextMeter } from '../../components/agent/context-meter.js';

const { Title, Text } = Typography;

export function AgentsPage() {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [activeTab, setActiveTab] = useState('info');
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get<Agent[]>('/agents'),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/departments'),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/agents', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setCreateModalOpen(false);
      createForm.resetFields();
      message.success('员工创建成功');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/agents/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setEditModalOpen(false);
      setSelectedAgent(null);
      editForm.resetFields();
      message.success('员工信息已更新');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      message.success('员工已删除');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const handleEdit = (agent: Agent) => {
    setSelectedAgent(agent);
    editForm.setFieldsValue({
      name: agent.name,
      role: agent.role,
      departmentId: agent.departmentId,
      customInstructions: agent.customInstructions,
    });
    setEditModalOpen(true);
  };

  const handleDetail = (agent: Agent) => {
    setSelectedAgent(agent);
    setDetailModalOpen(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ color: '#f2f2f2', margin: 0 }}>员工管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          添加员工
        </Button>
      </div>

      {isLoading ? (
        <Row gutter={[16, 16]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Col key={i} xs={24} sm={12} md={8} lg={6}>
              <Card style={{ background: '#101010' }}><Skeleton active /></Card>
            </Col>
          ))}
        </Row>
      ) : agents.length === 0 ? (
        <Empty
          description={<span style={{ color: '#595959' }}>还没有员工，去<a href="/market" style={{ color: '#00d992' }}>招聘市场</a>招募吧</span>}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {agents.map(agent => {
            const roleInfo = AGENT_ROLES[agent.role] || AGENT_ROLES.custom;
            const statusColor = AGENT_STATUS_COLORS[agent.status];
            const dept = departments.find(d => d.id === agent.departmentId);

            return (
              <Col key={agent.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  style={{
                    background: '#101010',
                    borderTop: `3px solid ${roleInfo.color}`,
                  }}
                  actions={[
                    <Tooltip title="详情" key="detail">
                      <InfoCircleOutlined onClick={() => handleDetail(agent)} />
                    </Tooltip>,
                    <Tooltip title="编辑" key="edit">
                      <EditOutlined onClick={() => handleEdit(agent)} />
                    </Tooltip>,
                    <Popconfirm
                      key="delete"
                      title="确定删除该员工？"
                      description={agent.status === 'working' ? '该员工正在工作中' : undefined}
                      onConfirm={() => deleteMutation.mutate(agent.id)}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <DeleteOutlined style={{ color: '#fb565b' }} />
                    </Popconfirm>,
                  ]}
                >
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 36, marginBottom: 4 }}>{roleInfo.icon}</div>
                    <div style={{ fontWeight: 600, color: '#f2f2f2', fontSize: 15, marginBottom: 2 }}>
                      {agent.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>
                      {roleInfo.label} · {agent.model}
                    </div>
                    <Tag color={statusColor} style={{ margin: 0 }}>
                      {AGENT_STATUS_LABELS[agent.status]}
                    </Tag>
                  </div>

                  <div style={{ borderTop: '1px solid #3d3a39', paddingTop: 8, marginTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8b949e' }}>
                      <span>部门</span>
                      <span style={{ color: '#b8b3b0' }}>{dept?.name || '未分配'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8b949e', marginTop: 4 }}>
                      <span>Token</span>
                      <span style={{ color: '#b8b3b0' }}>{(agent.tokensUsed ?? 0) > 0 ? `${((agent.tokensUsed ?? 0) / 1000).toFixed(1)}k` : '0'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8b949e', marginTop: 4 }}>
                      <span>费用</span>
                      <span style={{ color: '#b8b3b0' }}>${(agent.totalCost ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* 创建员工弹窗 */}
      <Modal
        title="添加员工"
        open={createModalOpen}
        onOk={() => createForm.validateFields().then(values => {
          createMutation.mutate({
            name: values.name,
            role: values.role,
            cwd: values.cwd || '/workspace',
            model: values.model || 'sonnet',
            departmentId: values.departmentId || undefined,
          });
        })}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        confirmLoading={createMutation.isPending}
        okText="创建"
        cancelText="取消"
      >
        <Form form={createForm} layout="vertical" initialValues={{ model: 'sonnet', role: 'fullstack' }}>
          <Form.Item name="name" label="员工名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：小明" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="role" label="角色" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(AGENT_ROLES).map(([key, val]) => (
                    <Select.Option key={key} value={key}>
                      {val.icon} {val.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="model" label="模型">
                <Select>
                  <Select.Option value="sonnet">Sonnet (均衡)</Select.Option>
                  <Select.Option value="opus">Opus (最强)</Select.Option>
                  <Select.Option value="haiku">Haiku (快速)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="cwd" label="工作目录">
            <Input placeholder="例如: /workspace/my-project" />
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

      {/* 编辑员工弹窗 */}
      <Modal
        title={`编辑 - ${selectedAgent?.name}`}
        open={editModalOpen}
        onOk={() => editForm.validateFields().then(values => {
          if (!selectedAgent) return;
          updateMutation.mutate({
            id: selectedAgent.id,
            body: {
              name: values.name,
              role: values.role,
              departmentId: values.departmentId || null,
              customInstructions: values.customInstructions || null,
            },
          });
        })}
        onCancel={() => { setEditModalOpen(false); setSelectedAgent(null); editForm.resetFields(); }}
        confirmLoading={updateMutation.isPending}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select>
              {Object.entries(AGENT_ROLES).map(([key, val]) => (
                <Select.Option key={key} value={key}>
                  {val.icon} {val.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="departmentId" label="所属部门">
            <Select allowClear placeholder="选择部门">
              {departments.map(d => (
                <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="customInstructions" label="自定义指令">
            <Input.TextArea rows={3} placeholder="该员工特有的工作指令" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 员工详情弹窗 */}
      <Modal
        title={selectedAgent ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {`${AGENT_ROLES[selectedAgent.role]?.icon || ''} ${selectedAgent.name}`}
            <ContextMeter agentId={selectedAgent.id} size={28} />
          </span>
        ) : '员工详情'}
        open={detailModalOpen}
        onCancel={() => { setDetailModalOpen(false); setSelectedAgent(null); setActiveTab('info'); }}
        footer={null}
        width={activeTab === 'terminal' ? 960 : 600}
      >
        {selectedAgent && (
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
            {
              key: 'info',
              label: '基本信息',
              children: (
                <Descriptions column={2} size="small" labelStyle={{ color: '#8b949e' }} contentStyle={{ color: '#f2f2f2' }}>
                  <Descriptions.Item label="状态">
                    <Tag color={AGENT_STATUS_COLORS[selectedAgent.status]}>
                      {AGENT_STATUS_LABELS[selectedAgent.status]}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="角色">
                    {(AGENT_ROLES[selectedAgent.role] || AGENT_ROLES.custom).label}
                  </Descriptions.Item>
                  <Descriptions.Item label="模型">{selectedAgent.model}</Descriptions.Item>
                  <Descriptions.Item label="权限模式">{selectedAgent.permissionMode}</Descriptions.Item>
                  <Descriptions.Item label="工作目录" span={2}>
                    <Text copyable style={{ color: '#b8b3b0', fontSize: 12 }}>{selectedAgent.cwd}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="部门">
                    {departments.find(d => d.id === selectedAgent.departmentId)?.name || '未分配'}
                  </Descriptions.Item>
                  <Descriptions.Item label="模板 ID">{selectedAgent.templateId || '自定义创建'}</Descriptions.Item>
                  <Descriptions.Item label="Token 消耗">{(selectedAgent.tokensUsed ?? 0).toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="总费用">${(selectedAgent.totalCost ?? 0).toFixed(2)}</Descriptions.Item>
                  {selectedAgent.allowedTools && selectedAgent.allowedTools.length > 0 && (
                    <Descriptions.Item label="可用工具" span={2}>
                      <Space size={4} wrap>
                        {selectedAgent.allowedTools.map(t => (
                          <Tag key={t} style={{ fontSize: 11, background: 'rgba(61, 58, 57, 0.3)', borderColor: '#3d3a39' }}>{t}</Tag>
                        ))}
                      </Space>
                    </Descriptions.Item>
                  )}
                  {selectedAgent.customInstructions && (
                    <Descriptions.Item label="自定义指令" span={2}>
                      <Text style={{ color: '#b8b3b0', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                        {selectedAgent.customInstructions}
                      </Text>
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label="创建时间">
                    {new Date(selectedAgent.createdAt).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                  <Descriptions.Item label="最后活动">
                    {selectedAgent.lastActivityAt
                      ? new Date(selectedAgent.lastActivityAt).toLocaleString('zh-CN')
                      : '无'}
                  </Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'logs',
              label: '执行日志',
              children: <AgentEventsPanel key={selectedAgent.id} agentId={selectedAgent.id} />,
            },
            {
              key: 'terminal',
              label: '终端',
              children: (
                <AgentTerminal
                  agentId={selectedAgent.id}
                  agentName={selectedAgent.name}
                  height={400}
                />
              ),
            },
            {
              key: 'files',
              label: '文件',
              children: (
                <FileExplorer
                  key={selectedAgent.id}
                  workingDir={selectedAgent.cwd}
                  agentId={selectedAgent.id}
                  height={450}
                />
              ),
            },
          ]} />
        )}
      </Modal>
    </div>
  );
}

// Agent 事件日志面板
function AgentEventsPanel({ agentId }: { agentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-events', agentId],
    queryFn: () => api.get<{ events: AgentEvent[]; total: number }>(`/agents/${agentId}/events?limit=50`),
  });

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (ts: number) => (
        <span style={{ color: '#8b949e', fontSize: 12 }}>
          {new Date(ts).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      title: '事件',
      dataIndex: 'eventType',
      key: 'eventType',
      width: 120,
      render: (type: string) => {
        const colorMap: Record<string, string> = {
          tool_start: '#00d992',
          tool_result: '#00d992',
          output: '#b8b3b0',
          error: '#fb565b',
          status: '#ffba00',
          complete: '#00d992',
        };
        return <Tag color={colorMap[type] || '#8b949e'}>{type}</Tag>;
      },
    },
    {
      title: '工具',
      dataIndex: 'toolName',
      key: 'toolName',
      width: 100,
      render: (v: string | null) => v || '-',
    },
    {
      title: '内容',
      dataIndex: 'textContent',
      key: 'textContent',
      ellipsis: true,
      render: (v: string | null) => (
        <span style={{ color: '#b8b3b0', fontSize: 12 }}>{v || '-'}</span>
      ),
    },
  ];

  if (isLoading) return <Skeleton active />;

  const events = data?.events || [];
  if (events.length === 0) {
    return <Empty description="暂无执行日志" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Table
      dataSource={events}
      columns={columns}
      rowKey="id"
      size="small"
      pagination={{ pageSize: 10, size: 'small' }}
      style={{ background: 'transparent' }}
    />
  );
}

interface AgentEvent {
  id: number;
  agentId: string;
  eventType: string;
  toolName: string | null;
  textContent: string | null;
  createdAt: number;
}
