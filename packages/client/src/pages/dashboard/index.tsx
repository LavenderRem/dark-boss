import { Row, Col, Card, Statistic, Typography } from 'antd';
import {
  TeamOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import type { Agent } from '@dark-boss/shared';
import { AGENT_ROLES, AGENT_STATUS_LABELS, AGENT_STATUS_COLORS } from '@dark-boss/shared';

const { Title } = Typography;

export function DashboardPage() {
  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get<Agent[]>('/agents'),
  });

  const onlineCount = agents.filter(a => a.status !== 'offline').length;
  const workingCount = agents.filter(a => a.status === 'working').length;
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokensUsed || 0), 0);
  const totalCost = agents.reduce((sum, a) => sum + (a.totalCost || 0), 0);

  return (
    <div>
      <Title level={4} style={{ color: '#f2f2f2', marginBottom: 16 }}>
        公司概览
      </Title>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={{ background: '#101010' }}>
            <Statistic
              title="员工总数"
              value={agents.length}
              prefix={<TeamOutlined />}
              suffix={`/ ${onlineCount} 在线`}
              valueStyle={{ color: '#00d992' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ background: '#101010' }}>
            <Statistic
              title="工作中"
              value={workingCount}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#00d992' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ background: '#101010' }}>
            <Statistic
              title="Token 消耗"
              value={totalTokens}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#ffba00' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ background: '#101010' }}>
            <Statistic
              title="总费用 (USD)"
              value={totalCost.toFixed(2)}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#fb565b' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 员工网格 */}
      <Title level={5} style={{ color: '#b8b3b0', marginBottom: 12 }}>员工状态</Title>
      {agents.length === 0 ? (
        <Card style={{ background: '#101010', textAlign: 'center', padding: 40 }}>
          <div style={{ color: '#595959', fontSize: 16 }}>
            还没有员工，去<a href="/market" style={{ color: '#00d992' }}>招聘市场</a>招募第一个吧
          </div>
        </Card>
      ) : (
        <Row gutter={[12, 12]}>
          {agents.map(agent => {
            const roleInfo = AGENT_ROLES[agent.role] || AGENT_ROLES.custom;
            return (
              <Col key={agent.id} xs={12} sm={8} md={6} lg={4}>
                <Card
                  hoverable
                  style={{
                    background: '#101010',
                    borderTop: `3px solid ${AGENT_STATUS_COLORS[agent.status]}`,
                  }}
                  size="small"
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 4 }}>{roleInfo.icon}</div>
                    <div style={{ fontWeight: 600, color: '#f2f2f2', marginBottom: 2 }}>{agent.name}</div>
                    <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>{roleInfo.label}</div>
                    <div style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      background: AGENT_STATUS_COLORS[agent.status] + '22',
                      color: AGENT_STATUS_COLORS[agent.status],
                    }}>
                      {AGENT_STATUS_LABELS[agent.status]}
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
