import { useState, useMemo } from 'react';
import { Card, Tree, Button, Modal, Form, Input, Select, ColorPicker, Typography, Space, Dropdown, message, Tag, Skeleton } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ApartmentOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import type { Department, Agent } from '@dark-boss/shared';
import { AGENT_ROLES, AGENT_STATUS_COLORS } from '@dark-boss/shared';

const { Title, Text } = Typography;

// 将平铺部门列表转为树结构
function buildTree(departments: Department[], agents: Agent[]) {
  const agentCountMap: Record<string, number> = {};
  agents.forEach(a => {
    if (a.departmentId) {
      agentCountMap[a.departmentId] = (agentCountMap[a.departmentId] || 0) + 1;
    }
  });

  const map = new Map<string, TreeDataNode>();
  const roots: TreeDataNode[] = [];

  interface TreeDataNode {
    key: string;
    title: React.ReactNode;
    children: TreeDataNode[];
    dept: Department;
  }

  departments.forEach(dept => {
    map.set(dept.id, {
      key: dept.id,
      title: renderDeptTitle(dept, agentCountMap[dept.id] || 0),
      children: [],
      dept,
    });
  });

  departments.forEach(dept => {
    const node = map.get(dept.id)!;
    if (dept.parentId && map.has(dept.parentId)) {
      map.get(dept.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function renderDeptTitle(dept: Department, agentCount: number) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dept.color || '#00d992', display: 'inline-block' }} />
      <span style={{ color: '#f2f2f2' }}>{dept.name}</span>
      <Tag style={{ marginLeft: 4, fontSize: 11 }}>{agentCount} 人</Tag>
    </span>
  );
}

export function OrgChartPage() {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: departments = [], isLoading: deptLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<Department[]>('/departments'),
  });

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get<Agent[]>('/agents'),
  });

  const treeData = useMemo(() => buildTree(departments, agents), [departments, agents]);

  const headAgentMap = useMemo(() => {
    const map: Record<string, Agent> = {};
    departments.forEach(d => {
      if (d.headAgentId) {
        const agent = agents.find(a => a.id === d.headAgentId);
        if (agent) map[d.id] = agent;
      }
    });
    return map;
  // headAgentMap 在部门详情面板的负责人显示中保留以备后用
  }, [departments, agents]);
  void headAgentMap;

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/departments', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setCreateModalOpen(false);
      form.resetFields();
      message.success('部门创建成功');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/departments/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setEditModalOpen(false);
      setSelectedDept(null);
      editForm.resetFields();
      message.success('部门更新成功');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      message.success('部门删除成功');
    },
    onError: (err: Error) => message.error(err.message),
  });

  // 拖拽排序 mutation
  const reorderMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.post(`/departments/${id}/move`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      message.success('部门已移动');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const handleCreate = () => {
    form.validateFields().then(values => {
      createMutation.mutate({
        name: values.name,
        description: values.description,
        parentId: createParentId,
        color: typeof values.color === 'string' ? values.color : values.color?.toHexString?.() || '#00d992',
        headAgentId: values.headAgentId,
      });
    });
  };

  const handleEdit = () => {
    if (!selectedDept) return;
    editForm.validateFields().then(values => {
      updateMutation.mutate({
        id: selectedDept.id,
        body: {
          name: values.name,
          description: values.description,
          color: typeof values.color === 'string' ? values.color : values.color?.toHexString?.() || '#00d992',
          headAgentId: values.headAgentId,
        },
      });
    });
  };

  // 点击部门右侧操作按钮
  const handleRightClick = (dept: Department) => {
    return {
      items: [
        {
          key: 'add-child',
          icon: <PlusOutlined />,
          label: '添加子部门',
          onClick: () => {
            setCreateParentId(dept.id);
            setCreateModalOpen(true);
          },
        },
        {
          key: 'edit',
          icon: <EditOutlined />,
          label: '编辑',
          onClick: () => {
            setSelectedDept(dept);
            editForm.setFieldsValue({
              name: dept.name,
              description: dept.description,
              color: dept.color,
              headAgentId: dept.headAgentId,
            });
            setEditModalOpen(true);
          },
        },
        { type: 'divider' as const },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: '删除',
          danger: true,
          onClick: () => {
            Modal.confirm({
              title: '确认删除',
              content: `确定要删除部门「${dept.name}」吗？`,
              okText: '删除',
              cancelText: '取消',
              okButtonProps: { danger: true },
              onOk: () => deleteMutation.mutate(dept.id),
            });
          },
        },
      ],
    };
  };

  // 渲染每个节点（带操作按钮）
  const renderTreeNodes = (nodes: TreeDataNode[]): TreeDataNode[] => {
    return nodes.map(node => ({
      ...node,
      title: (
        <Dropdown menu={handleRightClick(node.dept)} trigger={['contextMenu']}>
          <span style={{ cursor: 'pointer' }}>
            {renderDeptTitle(node.dept, agents.filter(a => a.departmentId === node.dept.id).length)}
          </span>
        </Dropdown>
      ),
      children: node.children && node.children.length > 0 ? renderTreeNodes(node.children) : undefined,
    }));
  };

  interface TreeDataNode {
    key: string;
    title: React.ReactNode;
    children?: TreeDataNode[];
    dept: Department;
  }

  const displayTree = useMemo(() => renderTreeNodes(treeData), [treeData, agents]);

  // 当前选中部门的详情
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedDetail = departments.find(d => d.id === selectedKey);
  const deptAgents = agents.filter(a => a.departmentId === selectedKey);

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>
      {/* 左侧：部门树 */}
      <Card
        title={
          <Space>
            <ApartmentOutlined />
            <span style={{ color: '#f2f2f2' }}>组织架构</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              setCreateParentId(null);
              setCreateModalOpen(true);
            }}
          >
            新建部门
          </Button>
        }
        style={{ width: 380, background: '#101010', flexShrink: 0 }}
        styles={{ body: { padding: '8px 12px', overflow: 'auto', maxHeight: 'calc(100vh - 180px)' } }}
      >
        {deptLoading || agentsLoading ? (
          <div style={{ padding: 16 }}><Skeleton active /></div>
        ) : treeData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#595959' }}>
            暂无部门，点击上方按钮创建
          </div>
        ) : (
          <Tree
            treeData={displayTree}
            defaultExpandAll
            draggable
            onDrop={(info) => {
              const dragKey = info.dragNode.key as string;
              const dropKey = info.node.key as string;
              const dropPosition = info.dropPosition;
              const dropToGap = info.dropToGap;

              if (dragKey === dropKey) return;

              // 拖拽到某个节点的上方/下方 = 同级排序
              // 拖拽到某个节点内部 = 变为子节点
              if (dropToGap) {
                // 同级移动，保持父级不变，更新 sort_order
                const dragDept = departments.find(d => d.id === dragKey);
                const dropDept = departments.find(d => d.id === dropKey);
                if (!dragDept || !dropDept) return;
                reorderMutation.mutate({
                  id: dragKey,
                  body: {
                    parentId: dropDept.parentId || null,
                    sortOrder: dropPosition,
                  },
                });
              } else {
                // 拖入某个节点内，变为子部门
                reorderMutation.mutate({
                  id: dragKey,
                  body: {
                    parentId: dropKey,
                    sortOrder: 0,
                  },
                });
              }
            }}
            selectedKeys={selectedKey ? [selectedKey] : []}
            onSelect={(keys) => setSelectedKey(keys[0] as string || null)}
            style={{ background: 'transparent', color: '#f2f2f2' }}
          />
        )}
      </Card>

      {/* 右侧：部门详情 */}
      <Card
        style={{ flex: 1, background: '#101010' }}
        styles={{ body: { padding: selectedDetail ? 24 : 40 } }}
      >
        {selectedDetail ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Space>
                <span style={{ width: 16, height: 16, borderRadius: 4, background: selectedDetail.color, display: 'inline-block' }} />
                <Title level={4} style={{ color: '#f2f2f2', margin: 0 }}>{selectedDetail.name}</Title>
              </Space>
              <Space>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setSelectedDept(selectedDetail);
                    editForm.setFieldsValue({
                      name: selectedDetail.name,
                      description: selectedDetail.description,
                      color: selectedDetail.color,
                      headAgentId: selectedDetail.headAgentId,
                    });
                    setEditModalOpen(true);
                  }}
                >
                  编辑
                </Button>
              </Space>
            </div>

            {selectedDetail.description && (
              <Text style={{ color: '#8b949e', display: 'block', marginBottom: 16 }}>
                {selectedDetail.description}
              </Text>
            )}

            <Title level={5} style={{ color: '#b8b3b0', marginTop: 16 }}>
              部门成员 ({deptAgents.length})
            </Title>

            {deptAgents.length === 0 ? (
              <Text style={{ color: '#595959' }}>暂无成员</Text>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {deptAgents.map(agent => {
                  const roleInfo = AGENT_ROLES[agent.role] || AGENT_ROLES.custom;
                  return (
                    <Card key={agent.id} size="small" style={{ background: '#2a2a2a', borderTop: `2px solid ${AGENT_STATUS_COLORS[agent.status]}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 24 }}>{roleInfo.icon}</span>
                        <div>
                          <div style={{ color: '#f2f2f2', fontWeight: 500 }}>{agent.name}</div>
                          <div style={{ color: '#8b949e', fontSize: 12 }}>{roleInfo.label}</div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#595959' }}>
            <ApartmentOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <div>选择左侧部门查看详情</div>
          </div>
        )}
      </Card>

      {/* 创建部门弹窗 */}
      <Modal
        title="新建部门"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        confirmLoading={createMutation.isPending}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="部门名称" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input placeholder="输入部门名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="部门描述（可选）" />
          </Form.Item>
          <Form.Item name="color" label="颜色" initialValue="#00d992">
            <ColorPicker />
          </Form.Item>
          <Form.Item name="headAgentId" label="部门负责人">
            <Select allowClear placeholder="选择负责人（可选）">
              {agents.map(a => (
                <Select.Option key={a.id} value={a.id}>
                  <Space><UserOutlined />{a.name}</Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑部门弹窗 */}
      <Modal
        title="编辑部门"
        open={editModalOpen}
        onOk={handleEdit}
        onCancel={() => { setEditModalOpen(false); setSelectedDept(null); editForm.resetFields(); }}
        confirmLoading={updateMutation.isPending}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="部门名称" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input placeholder="输入部门名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="部门描述（可选）" />
          </Form.Item>
          <Form.Item name="color" label="颜色">
            <ColorPicker />
          </Form.Item>
          <Form.Item name="headAgentId" label="部门负责人">
            <Select allowClear placeholder="选择负责人（可选）">
              {agents.map(a => (
                <Select.Option key={a.id} value={a.id}>
                  <Space><UserOutlined />{a.name}</Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
