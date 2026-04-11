import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/app-layout.js';
import { DashboardPage } from './pages/dashboard/index.js';
import { CanvasPage } from './pages/canvas/index.js';
import { OrgChartPage } from './pages/org-chart/index.js';
import { KanbanPage } from './pages/kanban/index.js';
import { ChatPage } from './pages/chat/index.js';
import { MarketPage } from './pages/market/index.js';
import { PerformancePage } from './pages/performance/index.js';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/agents" element={<div style={{ padding: 24, color: '#999' }}>员工管理（开发中）</div>} />
        <Route path="/canvas" element={<CanvasPage />} />
        <Route path="/org-chart" element={<OrgChartPage />} />
        <Route path="/kanban" element={<KanbanPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
