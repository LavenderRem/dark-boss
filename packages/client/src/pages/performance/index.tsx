import { useState } from 'react';
import {
  Row, Col, Card, Statistic, Typography, Table, Tag, Button, Modal,
  Skeleton, Segmented, Space, Empty,
} from 'antd';
import {
  CheckCircleOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  FileTextOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';
import { api } from '../../api/client.js';
import type {
  AgentPerformanceOverview,
  DashboardPerformanceStats,
  PerformanceReport,
} from '@dark-boss/shared';
import { AGENT_ROLES, AGENT_STATUS_COLORS, AGENT_STATUS_LABELS } from '@dark-boss/shared';

const { Title, Paragraph } = Typography;

export function PerformancePage() {
  const [trendDays, setTrendDays] = useState<number>(7);
  const [reportModal, setReportModal] = useState<{ open: boolean; agentId: string; agentName: string }>({
    open: false, agentId: '', agentName: '',
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['performance-dashboard'],
    queryFn: () => api.get<DashboardPerformanceStats>('/performance/dashboard'),
  });

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['performance-agents'],
    queryFn: () => api.get<AgentPerformanceOverview[]>('/performance/agents'),
  });

  const { data: trendSnapshots = [] } = useQuery({
    queryKey: ['performance-trend', trendDays],
    queryFn: () => api.get<{ periodStart: number; tasksCompleted: number; tokensUsed: number; totalCost: number; avgEfficiency: number }[]>(`/performance/trend?days=${trendDays}`),
  });

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['performance-report', reportModal.agentId],
    queryFn: () => api.get<PerformanceReport>(`/performance/agents/${reportModal.agentId}/report`),
    enabled: reportModal.open,
  });

  // 效率排行数据
  const rankingData = (agents || [])
    .filter(a => a.efficiencyScore !== null)
    .sort((a, b) => (b.efficiencyScore || 0) - (a.efficiencyScore || 0))
    .slice(0, 10)
    .map(a => ({
      name: a.agentName,
      score: a.efficiencyScore || 0,
    }));

  // 任务分布饼图
  const taskDistribution = [
    { name: '已完成', value: stats?.totalTasksCompleted || 0, color: '#00d992' },
    { name: '进行中', value: stats?.totalTasksInProgress || 0, color: '#00d992' },
    { name: '已取消', value: stats?.totalTasksFailed || 0, color: '#fb565b' },
  ].filter(d => d.value > 0);

  // 趋势数据：优先使用真实快照，回退到 Agent 聚合
  const trendData = trendSnapshots.length > 0
    ? trendSnapshots.map(s => ({
        date: new Date(s.periodStart).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
        tasks: s.tasksCompleted,
        tokens: Math.round(s.tokensUsed / 1000),
        cost: Math.round(s.totalCost * 100) / 100,
        efficiency: Math.round(s.avgEfficiency),
      }))
    : (agents || []).map(a => ({
        date: a.agentName,
        tasks: a.last7DaysTasksCompleted,
        tokens: Math.round(a.last7DaysTokensUsed / 1000),
        cost: Math.round(a.totalCost * 100) / 100,
        efficiency: a.efficiencyScore || 0,
      }));

  const columns = [
    {
      title: '员工',
      dataIndex: 'agentName',
      key: 'agentName',
      render: (name: string, record: AgentPerformanceOverview) => {
        const roleInfo = AGENT_ROLES[record.agentRole as keyof typeof AGENT_ROLES];
        return (
          <Space>
            <span style={{ fontSize: 18 }}>{roleInfo?.icon || '👤'}</span>
            <div>
              <div style={{ color: '#f2f2f2', fontWeight: 500 }}>{name}</div>
              <div style={{ fontSize: 12, color: '#8b949e' }}>
                {roleInfo?.label || record.agentRole}
                {record.departmentName && ` · ${record.departmentName}`}
              </div>
            </div>
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'agentStatus',
      key: 'agentStatus',
      width: 100,
      render: (status: string) => (
        <Tag color={AGENT_STATUS_COLORS[status]} style={{ margin: 0 }}>
          {AGENT_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: '已完成',
      dataIndex: 'tasksCompleted',
      key: 'tasksCompleted',
      width: 90,
      sorter: (a: AgentPerformanceOverview, b: AgentPerformanceOverview) =>
        a.tasksCompleted - b.tasksCompleted,
      render: (v: number) => <span style={{ color: '#00d992' }}>{v}</span>,
    },
    {
      title: '进行中',
      dataIndex: 'tasksInProgress',
      key: 'tasksInProgress',
      width: 80,
      render: (v: number) => <span style={{ color: '#00d992' }}>{v}</span>,
    },
    {
      title: 'Token',
      dataIndex: 'tokensUsed',
      key: 'tokensUsed',
      width: 100,
      sorter: (a: AgentPerformanceOverview, b: AgentPerformanceOverview) =>
        a.tokensUsed - b.tokensUsed,
      render: (v: number) => v > 0 ? `${(v / 1000).toFixed(1)}k` : '-',
    },
    {
      title: '费用',
      dataIndex: 'totalCost',
      key: 'totalCost',
      width: 90,
      render: (v: number) => v > 0 ? `$${v.toFixed(2)}` : '-',
    },
    {
      title: '效率分',
      dataIndex: 'efficiencyScore',
      key: 'efficiencyScore',
      width: 100,
      sorter: (a: AgentPerformanceOverview, b: AgentPerformanceOverview) =>
        (a.efficiencyScore || 0) - (b.efficiencyScore || 0),
      render: (score: number | null) => {
        if (score === null) return <span style={{ color: '#595959' }}>暂无</span>;
        const color = score >= 70 ? '#00d992' : score >= 40 ? '#ffba00' : '#fb565b';
        return <span style={{ color, fontWeight: 600 }}>{score}</span>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      render: (_: unknown, record: AgentPerformanceOverview) => (
        <Button
          type="link"
          size="small"
          icon={<FileTextOutlined />}
          onClick={() => setReportModal({
            open: true,
            agentId: record.agentId,
            agentName: record.agentName,
          })}
        >
          报告
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ color: '#f2f2f2', marginBottom: 16 }}>
        绩效考核
      </Title>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={{ background: '#101010' }}>
            {statsLoading ? <Skeleton active paragraph={false} /> : (
              <Statistic
                title="任务完成"
                value={stats?.totalTasksCompleted || 0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#00d992' }}
              />
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ background: '#101010' }}>
            {statsLoading ? <Skeleton active paragraph={false} /> : (
              <Statistic
                title="平均效率"
                value={stats?.avgEfficiencyScore || 0}
                prefix={<TrophyOutlined />}
                suffix="分"
                valueStyle={{ color: '#00d992' }}
              />
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ background: '#101010' }}>
            {statsLoading ? <Skeleton active paragraph={false} /> : (
              <Statistic
                title="Token 消耗"
                value={stats?.totalTokensUsed || 0}
                prefix={<ThunderboltOutlined />}
                valueStyle={{ color: '#ffba00' }}
              />
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ background: '#101010' }}>
            {statsLoading ? <Skeleton active paragraph={false} /> : (
              <Statistic
                title="总费用 (USD)"
                value={(stats?.totalCost || 0).toFixed(2)}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#fb565b' }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* 效率排行 */}
        <Col span={12}>
          <Card
            title={<span style={{ color: '#f2f2f2' }}>效率排行</span>}
            style={{ background: '#101010' }}
          >
            {rankingData.length === 0 ? (
              <Empty description="暂无效率数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={rankingData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#3d3a39" />
                  <XAxis type="number" domain={[0, 100]} stroke="#8b949e" />
                  <YAxis dataKey="name" type="category" width={80} stroke="#8b949e" tick={{ fill: '#b8b3b0', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: '#101010', border: '1px solid #3d3a39', borderRadius: 4 }}
                    labelStyle={{ color: '#f2f2f2' }}
                  />
                  <Bar dataKey="score" fill="#00d992" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {/* 任务分布 + 近期活动 */}
        <Col span={12}>
          <Card
            title={<span style={{ color: '#f2f2f2' }}>任务分布</span>}
            style={{ background: '#101010' }}
          >
            {taskDistribution.length === 0 ? (
              <Empty description="暂无任务数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={taskDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {taskDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#101010', border: '1px solid #3d3a39', borderRadius: 4 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      {/* 近期趋势 */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#f2f2f2' }}>{trendSnapshots.length > 0 ? '绩效趋势' : '近期产出'}</span>
            <Segmented
              size="small"
              options={[
                { label: '7 天', value: 7 },
                { label: '30 天', value: 30 },
              ]}
              value={trendDays}
              onChange={(v) => setTrendDays(v as number)}
            />
          </div>
        }
        style={{ background: '#101010', marginBottom: 24 }}
      >
        {trendData.length === 0 ? (
          <Empty description="暂无趋势数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : trendSnapshots.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3d3a39" />
              <XAxis dataKey="date" stroke="#8b949e" tick={{ fill: '#b8b3b0', fontSize: 12 }} />
              <YAxis stroke="#8b949e" />
              <Tooltip
                contentStyle={{ background: '#101010', border: '1px solid #3d3a39', borderRadius: 4 }}
                labelStyle={{ color: '#f2f2f2' }}
              />
              <Line type="monotone" dataKey="tasks" stroke="#00d992" name="完成任务" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="efficiency" stroke="#00d992" name="平均效率" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3d3a39" />
              <XAxis dataKey="date" stroke="#8b949e" tick={{ fill: '#b8b3b0', fontSize: 12 }} />
              <YAxis stroke="#8b949e" />
              <Tooltip
                contentStyle={{ background: '#101010', border: '1px solid #3d3a39', borderRadius: 4 }}
                labelStyle={{ color: '#f2f2f2' }}
              />
              <Bar dataKey="tasks" fill="#00d992" name="完成任务" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Agent 绩效表格 */}
      <Card
        title={<span style={{ color: '#f2f2f2' }}>员工绩效明细</span>}
        style={{ background: '#101010' }}
      >
        {agentsLoading ? (
          <Skeleton active />
        ) : (
          <Table
            dataSource={agents || []}
            columns={columns}
            rowKey="agentId"
            pagination={false}
            size="small"
            style={{ background: 'transparent' }}
          />
        )}
      </Card>

      {/* 绩效报告弹窗 */}
      <Modal
        title={`绩效报告 - ${reportModal.agentName}`}
        open={reportModal.open}
        onCancel={() => setReportModal({ open: false, agentId: '', agentName: '' })}
        footer={null}
        width={600}
      >
        {reportLoading ? (
          <Skeleton active />
        ) : report ? (
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 16 }}>
              <Title level={5} style={{ color: '#f2f2f2' }}>综合评分</Title>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: '50%',
                fontSize: 24,
                fontWeight: 700,
                background: (report.score >= 70 ? '#00d992' : report.score >= 40 ? '#ffba00' : '#fb565b') + '22',
                color: report.score >= 70 ? '#00d992' : report.score >= 40 ? '#ffba00' : '#fb565b',
              }}>
                {Math.round(report.score)}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Title level={5} style={{ color: '#f2f2f2' }}>工作总结</Title>
              <Paragraph style={{ color: '#b8b3b0' }}>{report.summary}</Paragraph>
            </div>

            <Row gutter={16}>
              <Col span={12}>
                <Title level={5} style={{ color: '#00d992' }}>优势</Title>
                {(typeof report.strengths === 'string' ? JSON.parse(report.strengths) : report.strengths || []).map(
                  (s: string, i: number) => (
                    <div key={i} style={{ color: '#b8b3b0', marginBottom: 4 }}>
                      <Tag color="green" style={{ marginRight: 6 }}>+</Tag>{s}
                    </div>
                  )
                )}
              </Col>
              <Col span={12}>
                <Title level={5} style={{ color: '#ffba00' }}>待改进</Title>
                {(typeof report.improvements === 'string' ? JSON.parse(report.improvements) : report.improvements || []).map(
                  (s: string, i: number) => (
                    <div key={i} style={{ color: '#b8b3b0', marginBottom: 4 }}>
                      <Tag color="orange" style={{ marginRight: 6 }}>!</Tag>{s}
                    </div>
                  )
                )}
              </Col>
            </Row>
          </div>
        ) : (
          <Empty description="暂无报告数据" />
        )}
      </Modal>
    </div>
  );
}
