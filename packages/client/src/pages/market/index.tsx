import { useState } from 'react';
import {
  Row, Col, Card, Typography, Tag, Button, Modal, Input, Select,
  Space, Skeleton, Empty, Tabs, Divider, message,
} from 'antd';
import {
  ShopOutlined,
  DownloadOutlined,
  UserAddOutlined,
  CodeOutlined,
  BulbOutlined,
  RocketOutlined,
  ExperimentOutlined,
  ToolOutlined,
  LayoutOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import type { Agent } from '@dark-boss/shared';

const { Title, Text, Paragraph } = Typography;

interface Template {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  icon: string;
  color: string;
  role: string;
  custom_instructions: string;
  allowed_tools: string;
  model: string;
  install_count: number;
  rating: number;
}

const CATEGORY_TABS = [
  { key: 'all', label: '全部' },
  { key: 'frontend', label: '前端', icon: <CodeOutlined /> },
  { key: 'backend', label: '后端', icon: <ToolOutlined /> },
  { key: 'fullstack', label: '全栈', icon: <BulbOutlined /> },
  { key: 'architecture', label: '架构', icon: <LayoutOutlined /> },
  { key: 'testing', label: '测试', icon: <ExperimentOutlined /> },
  { key: 'devops', label: '运维', icon: <RocketOutlined /> },
  { key: 'general', label: '产品/管理', icon: <ShopOutlined /> },
];

export function MarketPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [installModal, setInstallModal] = useState<Template | null>(null);
  const [installForm, setInstallForm] = useState({
    name: '',
    cwd: '',
    model: 'sonnet' as 'sonnet' | 'opus' | 'haiku',
    departmentId: '' as string,
  });
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates', selectedCategory],
    queryFn: () => {
      const params = selectedCategory !== 'all' ? `?category=${selectedCategory}` : '';
      return api.get<Template[]>(`/templates${params}`);
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/departments'),
  });

  const installMutation = useMutation({
    mutationFn: (params: { templateId: string; body: unknown }) =>
      api.post<Agent>(`/templates/${params.templateId}/install`, params.body),
    onSuccess: () => {
      message.success('招聘成功！新员工已加入团队');
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['performance-dashboard'] });
      setInstallModal(null);
    },
    onError: (err: Error) => {
      message.error(`招聘失败: ${err.message}`);
    },
  });

  const handleOpenInstall = (template: Template) => {
    setInstallForm({
      name: template.name,
      cwd: '/workspace',
      model: (template.model || 'sonnet') as 'sonnet' | 'opus' | 'haiku',
      departmentId: '',
    });
    setInstallModal(template);
  };

  const handleInstall = () => {
    if (!installForm.cwd.trim()) {
      message.warning('请填写工作目录');
      return;
    }
    if (!installModal) return;

    installMutation.mutate({
      templateId: installModal.id,
      body: {
        cwd: installForm.cwd,
        name: installForm.name || installModal.name,
        model: installForm.model,
        departmentId: installForm.departmentId || undefined,
      },
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ color: '#e8e8e8', margin: 0 }}>
          招聘市场
        </Title>
        <Text style={{ color: '#8c8c8c' }}>
          从模板库中招聘 AI Agent，为你的团队增添新成员
        </Text>
      </div>

      {/* 分类标签 */}
      <Tabs
        activeKey={selectedCategory}
        onChange={setSelectedCategory}
        items={CATEGORY_TABS.map(tab => ({
          key: tab.key,
          label: (
            <span>
              {tab.icon} {tab.label}
            </span>
          ),
        }))}
        style={{ marginBottom: 16 }}
      />

      {/* 模板卡片网格 */}
      {isLoading ? (
        <Row gutter={[16, 16]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Col key={i} xs={24} sm={12} md={8} lg={6}>
              <Card style={{ background: '#1f1f1f' }}>
                <Skeleton active />
              </Card>
            </Col>
          ))}
        </Row>
      ) : templates.length === 0 ? (
        <Empty description="该分类暂无模板" />
      ) : (
        <Row gutter={[16, 16]}>
          {templates.map(template => (
            <Col key={template.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                style={{
                  background: '#1f1f1f',
                  borderTop: `3px solid ${template.color}`,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 28 }}>{template.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: '#e8e8e8' }}>{template.name}</div>
                      <Tag color={template.color} style={{ fontSize: 11 }}>
                        {template.category}
                      </Tag>
                    </div>
                  </div>

                  <Paragraph
                    style={{ color: '#8c8c8c', fontSize: 13, marginBottom: 12 }}
                    ellipsis={{ rows: 2 }}
                  >
                    {template.description}
                  </Paragraph>

                  {/* 工具标签 */}
                  <div style={{ marginBottom: 12 }}>
                    {(() => {
                      try {
                        const tools: string[] = JSON.parse(template.allowed_tools || '[]');
                        return tools.slice(0, 4).map(tool => (
                          <Tag key={tool} style={{ fontSize: 11, marginBottom: 2, background: '#303030', borderColor: '#404040' }}>
                            {tool}
                          </Tag>
                        ));
                      } catch { return null; }
                    })()}
                    {(() => {
                      try {
                        const tools: string[] = JSON.parse(template.allowed_tools || '[]');
                        return tools.length > 4
                          ? <Tag style={{ fontSize: 11, background: '#303030', borderColor: '#404040' }}>+{tools.length - 4}</Tag>
                          : null;
                      } catch { return null; }
                    })()}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid #303030',
                  paddingTop: 12,
                }}>
                  <Space size={12}>
                    <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                      <DownloadOutlined /> {template.install_count}
                    </span>
                  </Space>
                  <Button
                    type="primary"
                    size="small"
                    icon={<UserAddOutlined />}
                    onClick={() => handleOpenInstall(template)}
                  >
                    招聘
                  </Button>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 招聘弹窗 */}
      <Modal
        title={
          installModal ? (
            <Space>
              <span style={{ fontSize: 20 }}>{installModal.icon}</span>
              <span>招聘 - {installModal.name}</span>
            </Space>
          ) : '招聘'
        }
        open={!!installModal}
        onCancel={() => setInstallModal(null)}
        onOk={handleInstall}
        okText="确认招聘"
        confirmLoading={installMutation.isPending}
        width={520}
      >
        {installModal && (
          <div>
            {/* 模板介绍 */}
            <Card size="small" style={{ background: '#141414', marginBottom: 16 }}>
              <Text style={{ color: '#bfbfbf' }}>{installModal.description}</Text>
              <Divider style={{ borderColor: '#303030', margin: '12px 0' }} />
              <Space wrap>
                <Text style={{ color: '#8c8c8c', fontSize: 12 }}>
                  默认模型: <Tag>{installModal.model || 'sonnet'}</Tag>
                </Text>
                <Text style={{ color: '#8c8c8c', fontSize: 12 }}>
                  默认工具: {(() => {
                    try {
                      return JSON.parse(installModal.allowed_tools || '[]').length + ' 个';
                    } catch { return '0 个'; }
                  })()}
                </Text>
              </Space>
            </Card>

            {/* 自定义表单 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <Text style={{ color: '#bfbfbf', display: 'block', marginBottom: 4 }}>员工名称</Text>
                <Input
                  value={installForm.name}
                  onChange={e => setInstallForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="输入员工名称"
                />
              </div>
              <div>
                <Text style={{ color: '#bfbfbf', display: 'block', marginBottom: 4 }}>
                  工作目录 <Text style={{ color: '#ff4d4f' }}>*</Text>
                </Text>
                <Input
                  value={installForm.cwd}
                  onChange={e => setInstallForm(f => ({ ...f, cwd: e.target.value }))}
                  placeholder="例如: /workspace/my-project"
                />
              </div>
              <Row gutter={16}>
                <Col span={12}>
                  <Text style={{ color: '#bfbfbf', display: 'block', marginBottom: 4 }}>模型选择</Text>
                  <Select
                    value={installForm.model}
                    onChange={v => setInstallForm(f => ({ ...f, model: v }))}
                    style={{ width: '100%' }}
                    options={[
                      { value: 'sonnet', label: 'Sonnet (均衡)' },
                      { value: 'opus', label: 'Opus (最强)' },
                      { value: 'haiku', label: 'Haiku (快速)' },
                    ]}
                  />
                </Col>
                <Col span={12}>
                  <Text style={{ color: '#bfbfbf', display: 'block', marginBottom: 4 }}>所属部门</Text>
                  <Select
                    value={installForm.departmentId || undefined}
                    onChange={v => setInstallForm(f => ({ ...f, departmentId: v }))}
                    style={{ width: '100%' }}
                    allowClear
                    placeholder="选择部门（可选）"
                    options={departments.map(d => ({ value: d.id, label: d.name }))}
                  />
                </Col>
              </Row>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
