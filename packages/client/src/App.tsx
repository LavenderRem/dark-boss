import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/app-layout.js';
import { DashboardPage } from './pages/dashboard/index.js';
import { AgentsPage } from './pages/agents/index.js';
import { CanvasPage } from './pages/canvas/index.js';
import { OrgChartPage } from './pages/org-chart/index.js';
import { KanbanPage } from './pages/kanban/index.js';
import { ChatPage } from './pages/chat/index.js';
import { MarketPage } from './pages/market/index.js';
import { PerformancePage } from './pages/performance/index.js';
import { ModelSettingsPage } from './pages/model-settings/index.js';
import { LandingPage } from './pages/landing/index.js';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<AppLayout />}>
        <Route path="/app" element={<DashboardPage />} />
        <Route path="/app/agents" element={<AgentsPage />} />
        <Route path="/app/canvas" element={<CanvasPage />} />
        <Route path="/app/org-chart" element={<OrgChartPage />} />
        <Route path="/app/kanban" element={<KanbanPage />} />
        <Route path="/app/chat" element={<ChatPage />} />
        <Route path="/app/market" element={<MarketPage />} />
        <Route path="/app/performance" element={<PerformancePage />} />
        <Route path="/app/model-settings" element={<ModelSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
