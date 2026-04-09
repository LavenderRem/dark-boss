import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/app-layout.js';
import { DashboardPage } from './pages/dashboard/index.js';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/agents" element={<div style={{ padding: 24, color: '#999' }}>员工管理（开发中）</div>} />
        <Route path="/canvas" element={<div style={{ padding: 24, color: '#999' }}>工作流画布（开发中）</div>} />
        <Route path="/org-chart" element={<div style={{ padding: 24, color: '#999' }}>组织架构（开发中）</div>} />
        <Route path="/kanban" element={<div style={{ padding: 24, color: '#999' }}>协作看板（开发中）</div>} />
        <Route path="/chat" element={<div style={{ padding: 24, color: '#999' }}>团队群聊（开发中）</div>} />
        <Route path="/market" element={<div style={{ padding: 24, color: '#999' }}>招聘市场（开发中）</div>} />
        <Route path="/performance" element={<div style={{ padding: 24, color: '#999' }}>绩效考核（开发中）</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
