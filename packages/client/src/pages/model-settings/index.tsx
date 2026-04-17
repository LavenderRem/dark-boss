import { useState } from 'react';
import { Card, Row, Col, Button, Input, Tag, Table, Modal, Form, Select, Space, message, Badge } from 'antd';
import { PlusOutlined, EyeInvisibleOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import type { ModelProvider, ModelTierMapping, ProviderProtocol } from '@dark-boss/shared';

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250514', 'glm-4', 'glm-4-flash', 'glm-4-plus'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'deepseek-chat', 'deepseek-coder', 'gpt-3.5-turbo'],
};

const TIER_INFO = {
  haiku: { label: 'Haiku', color: 'green', description: '快速/低成本' },
  sonnet: { label: 'Sonnet', color: 'blue', description: '平衡' },
  opus: { label: 'Opus', color: 'purple', description: '高性能' },
};

const PROTOCOL_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI 兼容',
};

export function ModelSettingsPage() {
  const queryClient = useQueryClient();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  const { data: providers = [] } = useQuery<ModelProvider[]>({
    queryKey: ['providers'],
    queryFn: () => api.get<ModelProvider[]>('/providers'),
  });

  const { data: tiers = [], isLoading: tiersLoading } = useQuery<ModelTierMapping[]>({
    queryKey: ['model-tiers'],
    queryFn: () => api.get<ModelTierMapping[]>('/model-tiers'),
  });

  const addProviderMutation = useMutation({
    mutationFn: (data: { name: string; protocol: ProviderProtocol; baseUrl: string; apiKey?: string }) =>
      api.post<ModelProvider>('/providers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      message.success('提供商添加成功');
      setAddModalOpen(false);
      addForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '添加失败');
    },
  });

  const updateProviderMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<ModelProvider> & { id: string }) =>
      api.patch<ModelProvider>(`/providers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      message.success('更新成功');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '更新失败');
    },
  });

  const deleteProviderMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/providers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      message.success('提供商已删除');
    },
    onError: (error: any) => {
      if (error.response?.status === 409) {
        message.error('无法删除：该提供商正被档位映射使用');
      } else {
        message.error(error.response?.data?.message || '删除失败');
      }
    },
  });

  const testProviderMutation = useMutation({
    mutationFn: (id: string) => api.post<{ success: boolean; message?: string }>(`/providers/${id}/test`, {}),
    onSuccess: (data) => {
      if (data.success) {
        message.success('测试成功：连接正常');
      } else {
        message.error(data.message || '测试失败：连接异常');
      }
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '测试失败');
    },
  });

  const updateTierMutation = useMutation({
    mutationFn: ({ tier, ...data }: { tier: string; providerId: string | null; modelName: string | null }) =>
      api.patch(`/model-tiers/${tier}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-tiers'] });
      message.success('档位映射已更新，正在运行的 Agent 需要重启后生效');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '更新失败');
    },
  });

  const handleAddProvider = () => {
    addForm.validateFields().then((values) => {
      addProviderMutation.mutate(values);
    });
  };

  const handleDeleteProvider = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此提供商吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => deleteProviderMutation.mutate(id),
    });
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const maskApiKey = (key: string | undefined) => {
    if (!key) return '';
    return key.slice(0, 3) + key.slice(3).replace(/./g, '*');
  };

  const getStatusBadge = (provider: ModelProvider) => {
    if (!provider.isActive) {
      return <Badge status="default" text="已禁用" />;
    }
    if (provider.apiKey) {
      return <Badge status="success" text="已就绪" />;
    }
    return <Badge status="warning" text="未配置 Key" />;
  };

  const activeProviders = providers.filter((p) => p.isActive && p.apiKey);

  const tierColumns = [
    {
      title: '档位',
      dataIndex: 'tier',
      key: 'tier',
      render: (tier: string) => {
        const info = TIER_INFO[tier as keyof typeof TIER_INFO];
        return (
          <Tag color={info?.color || 'default'} style={{ fontSize: 14, padding: '4px 12px' }}>
            {info?.label || tier}
          </Tag>
        );
      },
    },
    {
      title: '说明',
      dataIndex: 'tier',
      key: 'description',
      render: (tier: string) => TIER_INFO[tier as keyof typeof TIER_INFO]?.description || '',
    },
    {
      title: '提供商',
      dataIndex: 'providerId',
      key: 'providerId',
      render: (providerId: string | null, record: ModelTierMapping) => (
        <Select
          style={{ width: '100%' }}
          placeholder="选择提供商"
          value={providerId}
          onChange={(value) => updateTierMutation.mutate({
            tier: record.tier,
            providerId: value ?? null,
            modelName: record.modelName,
          })}
          options={activeProviders.map((p) => ({ label: p.name, value: p.id }))}
          allowClear
        />
      ),
    },
    {
      title: '模型',
      dataIndex: 'modelName',
      key: 'modelName',
      render: (modelName: string | null, record: ModelTierMapping) => {
        const provider = providers.find((p) => p.id === record.providerId);
        const suggestions = provider ? MODEL_SUGGESTIONS[provider.protocol] || [] : [];

        return (
          <Select
            style={{ width: '100%' }}
            placeholder="选择或输入模型"
            value={modelName}
            onChange={(value) => updateTierMutation.mutate({
              tier: record.tier,
              providerId: record.providerId,
              modelName: value,
            })}
            mode="tags"
            maxTagCount={1}
            options={suggestions.map((m) => ({ label: m, value: m }))}
            showSearch
            allowClear
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: '#fff' }}>模型设置</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
          添加提供商
        </Button>
      </div>

      {/* 提供商列表 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {providers.map((provider) => (
          <Col key={provider.id} xs={24} lg={12}>
            <Card
              size="small"
              title={
                <Space>
                  <span>{provider.name}</span>
                  <Tag color={provider.protocol === 'anthropic' ? 'purple' : 'blue'}>
                    {PROTOCOL_LABELS[provider.protocol]}
                  </Tag>
                  {getStatusBadge(provider)}
                </Space>
              }
              extra={
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteProvider(provider.id)}
                />
              }
            >
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <div>
                  <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>Base URL</div>
                  <Input
                    size="small"
                    defaultValue={provider.baseUrl}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && value !== provider.baseUrl) {
                        updateProviderMutation.mutate({ id: provider.id, baseUrl: value });
                      }
                    }}
                  />
                </div>
                <div>
                  <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>API Key</div>
                  <Input
                    size="small"
                    type={visibleKeys[provider.id] ? 'text' : 'password'}
                    defaultValue={provider.apiKey ? maskApiKey(provider.apiKey) : ''}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && !value.startsWith('***') && value !== maskApiKey(provider.apiKey)) {
                        updateProviderMutation.mutate({ id: provider.id, apiKey: value });
                      }
                    }}
                    suffix={
                      <Button
                        type="text"
                        size="small"
                        icon={visibleKeys[provider.id] ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                        onClick={() => toggleKeyVisibility(provider.id)}
                      />
                    }
                  />
                </div>
                <Button
                  size="small"
                  onClick={() => testProviderMutation.mutate(provider.id)}
                  loading={testProviderMutation.isPending}
                  disabled={!provider.apiKey}
                >
                  测试连接
                </Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 档位映射 */}
      <Card size="small" title="档位映射">
        <Table
          columns={tierColumns}
          dataSource={tiers}
          rowKey="tierId"
          loading={tiersLoading}
          pagination={false}
          size="small"
        />
      </Card>

      {/* 添加提供商模态框 */}
      <Modal
        title="添加提供商"
        open={addModalOpen}
        onOk={handleAddProvider}
        onCancel={() => {
          setAddModalOpen(false);
          addForm.resetFields();
        }}
        okText="添加"
        cancelText="取消"
        confirmLoading={addProviderMutation.isPending}
      >
        <Form form={addForm} layout="vertical" autoComplete="off">
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入提供商名称' }]}
          >
            <Input placeholder="例如: OpenAI、Anthropic" />
          </Form.Item>
          <Form.Item
            label="协议"
            name="protocol"
            rules={[{ required: true, message: '请选择协议' }]}
          >
            <Select
              placeholder="选择协议"
              options={[
                { label: 'OpenAI 兼容', value: 'openai' },
                { label: 'Anthropic', value: 'anthropic' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Base URL"
            name="baseUrl"
            rules={[{ required: true, message: '请输入 Base URL' }]}
          >
            <Input placeholder="例如: https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item label="API Key" name="apiKey">
            <Input.Password placeholder="可选，稍后可配置" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
