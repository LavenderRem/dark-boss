import { Outlet } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  ApartmentOutlined,
  ProjectOutlined,
  MessageOutlined,
  ShopOutlined,
  BarChartOutlined,
  CodeOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import type { Agent } from '@dark-boss/shared';
import { ContextMeter } from '../agent/context-meter.js';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/agents', icon: <TeamOutlined />, label: '员工管理' },
  { key: '/canvas', icon: <ApartmentOutlined />, label: '工作流画布' },
  { key: '/org-chart', icon: <CodeOutlined />, label: '组织架构' },
  { key: '/kanban', icon: <ProjectOutlined />, label: '协作看板' },
  { key: '/chat', icon: <MessageOutlined />, label: '团队群聊' },
  { key: '/market', icon: <ShopOutlined />, label: '招聘市场' },
  { key: '/performance', icon: <BarChartOutlined />, label: '绩效考核' },
  { key: '/model-settings', icon: <SettingOutlined />, label: '模型设置' },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get<Agent[]>('/agents'),
    refetchInterval: 30000,
  });

  const onlineCount = agents.filter(a => a.status !== 'offline').length;
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokensUsed || 0), 0);
  const workingAgent = agents.find(a => a.status === 'working');

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        width={200}
        collapsible
        breakpoint="lg"
        style={{ background: '#050507', borderRight: '1px solid #3d3a39' }}
      >
        <div style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#00d992',
          fontSize: 16,
          fontWeight: 700,
          fontFamily: 'var(--font-heading)',
          letterSpacing: -0.5,
          borderBottom: '1px solid #3d3a39',
          animation: 'greenPulse 3s ease-in-out infinite',
        }}>
          暗黑老板
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          height: 48,
          padding: '0 24px',
          background: '#101010',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #3d3a39',
        }}>
          <span style={{ color: '#8b949e', fontSize: 13 }}>
            AI Agent 编排平台
          </span>
          <div style={{ display: 'flex', gap: 16, color: '#8b949e', fontSize: 13, alignItems: 'center' }}>
            <span>员工: {agents.length}</span>
            <span>在线: {onlineCount}</span>
            <span>Token: {totalTokens > 0 ? `${(totalTokens / 1000).toFixed(1)}k` : '0'}</span>
            {workingAgent && (
              <ContextMeter agentId={workingAgent.id} size={28} showLabel={false} />
            )}
          </div>
        </Header>
        <Content style={{
          overflow: 'auto',
          padding: 16,
          background: '#050507',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
