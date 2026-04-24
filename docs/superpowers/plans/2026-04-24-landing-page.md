# Landing Page 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Dark Boss 添加独立营销展示 Landing Page，采用沉浸式全屏暗黑风格。

**Architecture:** Landing Page 挂载在 `/`，独立于主应用布局。原有路由全部加 `/app` 前缀。三个纵向板块（Hero → 功能展示 → 工作流程图）各自独立组件，由 LandingPage 主组件组合。

**Tech Stack:** React 19, React Router 7, Lucide React (新增), CSS 变量 (已有 design-tokens.css)

**Design Spec:** `docs/superpowers/specs/2026-04-24-landing-page-design.md`

---

## File Structure

| 操作 | 文件路径 | 职责 |
|------|---------|------|
| Create | `packages/client/src/pages/landing/hero-section.tsx` | Hero 区：全屏背景、标题、CTA、粒子动效 |
| Create | `packages/client/src/pages/landing/features-section.tsx` | 功能展示区：2×2 卡片网格 |
| Create | `packages/client/src/pages/landing/workflow-section.tsx` | 工作流程图区：三步横向流程 |
| Create | `packages/client/src/pages/landing/index.tsx` | Landing Page 主组件：组合三个板块 |
| Modify | `packages/client/src/App.tsx` | 路由重构：`/` → Landing, `/app/*` → 主应用 |
| Modify | `packages/client/src/components/layout/app-layout.tsx` | 菜单路径加 `/app` 前缀 |
| Modify | `packages/client/src/styles/globals.css` | 移除 body overflow:hidden，改为 AppLayout 级控制 |

---

### Task 1: 安装 lucide-react 依赖

**Files:**
- Modify: `packages/client/package.json`

- [ ] **Step 1: 安装依赖**

Run:
```bash
cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/client add lucide-react
```

Expected: `package.json` 中新增 `lucide-react` 依赖

- [ ] **Step 2: 验证安装**

Run:
```bash
cd d:/AI/Projects/dark-boss/packages/client && pnpm typecheck
```

Expected: 类型检查通过，无新增错误

- [ ] **Step 3: 提交**

```bash
git add packages/client/package.json packages/client/pnpm-lock.yaml
git commit -m "chore: add lucide-react dependency for landing page icons"
```

---

### Task 2: 更新路由和菜单路径

**Files:**
- Modify: `packages/client/src/App.tsx`
- Modify: `packages/client/src/components/layout/app-layout.tsx`
- Modify: `packages/client/src/styles/globals.css`

- [ ] **Step 1: 更新 App.tsx 路由结构**

将所有现有路由加上 `/app` 前缀，`/` 指向 Landing Page（暂时用占位组件，Task 6 替换）。

替换 `packages/client/src/App.tsx` 全部内容为：

```tsx
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
```

- [ ] **Step 2: 更新 app-layout.tsx 菜单路径**

在 `packages/client/src/components/layout/app-layout.tsx` 中，将 `menuItems` 的所有 `key` 加上 `/app` 前缀：

```tsx
const menuItems = [
  { key: '/app', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/app/agents', icon: <TeamOutlined />, label: '员工管理' },
  { key: '/app/canvas', icon: <ApartmentOutlined />, label: '工作流画布' },
  { key: '/app/org-chart', icon: <CodeOutlined />, label: '组织架构' },
  { key: '/app/kanban', icon: <ProjectOutlined />, label: '协作看板' },
  { key: '/app/chat', icon: <MessageOutlined />, label: '团队群聊' },
  { key: '/app/market', icon: <ShopOutlined />, label: '招聘市场' },
  { key: '/app/performance', icon: <BarChartOutlined />, label: '绩效考核' },
  { key: '/app/model-settings', icon: <SettingOutlined />, label: '模型设置' },
];
```

同时在 `<Layout>` 根元素上添加 `overflow: hidden` 样式（因为 globals.css 要移除 body 的 overflow:hidden）：

将 `<Layout style={{ height: '100vh' }}>` 改为：
```tsx
<Layout style={{ height: '100vh', overflow: 'hidden' }}>
```

- [ ] **Step 3: 更新 globals.css 移除 body overflow:hidden**

在 `packages/client/src/styles/globals.css` 中，将：

```css
body {
  font-family: var(--font-body);
  background-color: var(--color-bg-abyss);
  color: var(--color-text-primary);
  overflow: hidden;
}
```

改为：

```css
body {
  font-family: var(--font-body);
  background-color: var(--color-bg-abyss);
  color: var(--color-text-primary);
}
```

保留其他所有样式不变。

- [ ] **Step 4: 创建 Landing Page 占位组件**

创建 `packages/client/src/pages/landing/index.tsx`：

```tsx
export function LandingPage() {
  return (
    <div style={{ background: '#050507', minHeight: '100vh', color: '#f2f2f2' }}>
      <h1>Landing Page</h1>
    </div>
  );
}
```

- [ ] **Step 5: 验证构建**

Run:
```bash
cd d:/AI/Projects/dark-boss/packages/client && pnpm typecheck
```

Expected: 类型检查通过

- [ ] **Step 6: 启动开发服务器验证路由**

Run:
```bash
cd d:/AI/Projects/dark-boss && pnpm dev
```

验证：
- http://localhost:5173/ → 显示 "Landing Page" 占位文字（无侧边栏）
- http://localhost:5173/app → 显示 Dashboard（有侧边栏）
- http://localhost:5173/app/agents → 显示 Agent 管理页（有侧边栏）
- 侧边栏菜单点击后路径正确（`/app/` 前缀）

- [ ] **Step 7: 提交**

```bash
git add packages/client/src/App.tsx packages/client/src/components/layout/app-layout.tsx packages/client/src/styles/globals.css packages/client/src/pages/landing/index.tsx
git commit -m "refactor: restructure routes for landing page, move app routes under /app prefix"
```

---

### Task 3: 创建 Hero Section

**Files:**
- Create: `packages/client/src/pages/landing/hero-section.tsx`

- [ ] **Step 1: 创建 Hero Section 组件**

创建 `packages/client/src/pages/landing/hero-section.tsx`：

```tsx
import { useNavigate } from 'react-router-dom';
import './hero-section.css';

const PARTICLES = [
  { top: '15%', left: '20%', size: 2, glow: 6 },
  { top: '25%', left: '70%', size: 3, glow: 8 },
  { top: '40%', left: '40%', size: 2, glow: 4 },
  { top: '55%', left: '80%', size: 2, glow: 6 },
  { top: '65%', left: '15%', size: 3, glow: 8 },
  { top: '80%', left: '55%', size: 2, glow: 4 },
  { top: '35%', left: '90%', size: 2, glow: 6 },
  { top: '70%', left: '35%', size: 2, glow: 6 },
];

const STATS = [
  { value: '7+', label: '预置角色模板' },
  { value: '∞', label: '工作流组合' },
  { value: '实时', label: '终端监控' },
];

export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="hero">
      {/* 粒子背景 */}
      <div className="hero-particles">
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className="hero-particle"
            style={{
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              boxShadow: `0 0 ${p.glow}px #00d992`,
            }}
          />
        ))}
        <div className="hero-grid-line" style={{ top: '30%' }} />
        <div className="hero-grid-line" style={{ top: '60%' }} />
      </div>

      {/* 内容 */}
      <div className="hero-content">
        {/* Badge */}
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          <span className="hero-badge-text">DARK BOSS — Multi-Agent Platform</span>
        </div>

        {/* 标题 */}
        <h1 className="hero-title">
          你是老板
          <br />
          <span className="hero-title-accent">
            AI Agent 是你的员工
            <svg className="hero-title-underline" viewBox="0 0 300 8" preserveAspectRatio="none">
              <path d="M0 6 Q150 0 300 6" stroke="#00d992" strokeWidth="2" fill="none" opacity="0.4" />
            </svg>
          </span>
        </h1>

        {/* 副标题 */}
        <p className="hero-subtitle">
          图形化编排多个 Claude Code Agent，
          <br />
          让 AI 团队像真实员工一样高效协作
        </p>

        {/* CTA 按钮 */}
        <div className="hero-cta-group">
          <button className="hero-cta-primary" onClick={() => navigate('/app')}>
            进入应用 →
          </button>
          <a
            className="hero-cta-secondary"
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </a>
        </div>

        {/* 数据统计行 */}
        <div className="hero-stats">
          {STATS.map((stat) => (
            <div key={stat.label} className="hero-stat">
              <div className="hero-stat-value">{stat.value}</div>
              <div className="hero-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 滚动指示器 */}
      <div className="hero-scroll-indicator">
        <span>SCROLL</span>
        <div className="hero-scroll-line" />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 创建 Hero Section 样式**

创建 `packages/client/src/pages/landing/hero-section.css`：

```css
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #050507 0%, #040a08 40%, #050507 100%);
  overflow: hidden;
}

/* 粒子 */
.hero-particles {
  position: absolute;
  inset: 0;
  opacity: 0.15;
  pointer-events: none;
}

.hero-particle {
  position: absolute;
  background: #00d992;
  border-radius: 50%;
}

.hero-grid-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(61, 58, 57, 0.13), transparent);
}

/* 内容 */
.hero-content {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 0 24px;
}

/* Badge */
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border: 1px solid #3d3a39;
  border-radius: 9999px;
  background: #101010;
  margin-bottom: 28px;
}

.hero-badge-dot {
  width: 6px;
  height: 6px;
  background: #00d992;
  border-radius: 50%;
  box-shadow: 0 0 8px #00d992;
}

.hero-badge-text {
  color: #b8b3b0;
  font-size: 12px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

/* 标题 */
.hero-title {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 52px;
  font-weight: 700;
  color: #f2f2f2;
  line-height: 1.15;
  letter-spacing: -1px;
  margin: 0 0 16px;
}

.hero-title-accent {
  position: relative;
  color: #00d992;
}

.hero-title-underline {
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 100%;
  height: 8px;
}

/* 副标题 */
.hero-subtitle {
  color: #b8b3b0;
  font-size: 18px;
  line-height: 1.6;
  max-width: 520px;
  margin: 0 auto 36px;
}

/* CTA */
.hero-cta-group {
  display: flex;
  gap: 14px;
  justify-content: center;
  margin-bottom: 48px;
}

.hero-cta-primary {
  background: #00d992;
  color: #050507;
  padding: 14px 36px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: background 0.2s;
}

.hero-cta-primary:hover {
  background: #00ffaa;
}

.hero-cta-secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 36px;
  border: 1px solid #3d3a39;
  border-radius: 6px;
  color: #f2f2f2;
  font-size: 15px;
  text-decoration: none;
  transition: border-color 0.2s;
}

.hero-cta-secondary:hover {
  border-color: #8b949e;
}

/* 统计 */
.hero-stats {
  display: flex;
  gap: 40px;
  justify-content: center;
}

.hero-stat-value {
  color: #00d992;
  font-size: 24px;
  font-weight: 700;
}

.hero-stat-label {
  color: #8b949e;
  font-size: 12px;
  margin-top: 2px;
}

/* 滚动指示器 */
.hero-scroll-indicator {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #8b949e;
  font-size: 11px;
  letter-spacing: 1px;
}

.hero-scroll-line {
  width: 1px;
  height: 20px;
  background: linear-gradient(to bottom, #3d3a39, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .hero-particles {
    display: none;
  }
}
```

- [ ] **Step 3: 验证类型检查**

Run:
```bash
cd d:/AI/Projects/dark-boss/packages/client && pnpm typecheck
```

Expected: 通过

- [ ] **Step 4: 提交**

```bash
git add packages/client/src/pages/landing/hero-section.tsx packages/client/src/pages/landing/hero-section.css
git commit -m "feat(landing): add hero section with particles and CTA"
```

---

### Task 4: 创建 Features Section

**Files:**
- Create: `packages/client/src/pages/landing/features-section.tsx`

- [ ] **Step 1: 创建 Features Section 组件**

创建 `packages/client/src/pages/landing/features-section.tsx`：

```tsx
import { Users, GitBranch, Terminal, LayoutGrid } from 'lucide-react';
import './features-section.css';

const FEATURES = [
  {
    icon: Users,
    title: 'Agent 管理',
    description: '7 种预置角色模板，一键雇佣前端、后端、架构师等专业 Agent，像管理团队一样管理 AI',
  },
  {
    icon: GitBranch,
    title: '工作流画布',
    description: '可视化拖拽编排 Agent 协作流程，定义任务依赖和执行顺序，复杂的 AI 协作一目了然',
  },
  {
    icon: Terminal,
    title: '实时终端',
    description: '每位 Agent 配备独立终端，实时查看执行过程、代码输出和日志，完全透明可控',
  },
  {
    icon: LayoutGrid,
    title: '看板协作',
    description: '任务看板追踪工作进度，工作流执行状态实时同步，团队协作井然有序',
  },
] as const;

export function FeaturesSection() {
  return (
    <section className="features">
      <div className="features-header">
        <span className="section-label">CORE FEATURES</span>
        <h2 className="section-title">核心能力</h2>
        <p className="section-subtitle">从招聘到执行，一站式管理你的 AI 团队</p>
      </div>

      <div className="features-grid">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="feature-card">
            <div className="feature-icon">
              <feature.icon size={20} strokeWidth={1.5} />
            </div>
            <h3 className="feature-card-title">{feature.title}</h3>
            <p className="feature-card-desc">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 创建 Features Section 样式**

创建 `packages/client/src/pages/landing/features-section.css`：

```css
.features {
  padding: 60px 40px;
  background: #050507;
}

.features-header {
  text-align: center;
  margin-bottom: 48px;
}

.section-label {
  display: block;
  color: #00d992;
  font-size: 12px;
  letter-spacing: 2px;
  margin-bottom: 10px;
}

.section-title {
  color: #f2f2f2;
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 12px;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

.section-subtitle {
  color: #8b949e;
  font-size: 15px;
  max-width: 440px;
  margin: 0 auto;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  max-width: 700px;
  margin: 0 auto;
}

.feature-card {
  background: #101010;
  border: 1px solid #3d3a39;
  border-radius: 8px;
  padding: 24px;
  transition: border-color 0.2s;
}

.feature-card:hover {
  border-color: #00d992;
}

.feature-icon {
  width: 40px;
  height: 40px;
  background: #0a0a0c;
  border: 1px solid #3d3a39;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  color: #00d992;
}

.feature-card-title {
  color: #f2f2f2;
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 6px;
}

.feature-card-desc {
  color: #8b949e;
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}
```

- [ ] **Step 3: 验证类型检查**

Run:
```bash
cd d:/AI/Projects/dark-boss/packages/client && pnpm typecheck
```

Expected: 通过

- [ ] **Step 4: 提交**

```bash
git add packages/client/src/pages/landing/features-section.tsx packages/client/src/pages/landing/features-section.css
git commit -m "feat(landing): add features section with lucide icons"
```

---

### Task 5: 创建 Workflow Section

**Files:**
- Create: `packages/client/src/pages/landing/workflow-section.tsx`

- [ ] **Step 1: 创建 Workflow Section 组件**

创建 `packages/client/src/pages/landing/workflow-section.tsx`：

```tsx
import { useNavigate } from 'react-router-dom';
import { UserPlus, LayoutGrid, Play } from 'lucide-react';
import './workflow-section.css';

const STEPS = [
  {
    icon: UserPlus,
    title: '雇佣 Agent',
    description: '从模板市场选择角色，配置技能和权限，组建你的 AI 团队',
    active: true,
  },
  {
    icon: LayoutGrid,
    title: '编排工作流',
    description: '在画布上拖拽连接 Agent 节点，定义任务流和执行顺序',
    active: false,
  },
  {
    icon: Play,
    title: '执行监控',
    description: '一键启动工作流，实时终端跟踪每个 Agent 的执行状态',
    active: false,
  },
] as const;

export function WorkflowSection() {
  const navigate = useNavigate();

  return (
    <section className="workflow">
      <div className="workflow-header">
        <span className="section-label">HOW IT WORKS</span>
        <h2 className="section-title">三步启动 AI 团队</h2>
        <p className="section-subtitle">简单直觉，从雇佣到交付只需三步</p>
      </div>

      <div className="workflow-steps">
        {STEPS.map((step, index) => (
          <div key={step.title} className="workflow-step-wrapper">
            <div className="workflow-step">
              <div className={`workflow-step-icon ${step.active ? 'active' : ''}`}>
                <step.icon size={28} strokeWidth={1.5} />
                <span className={`workflow-step-number ${step.active ? 'active' : ''}`}>
                  {index + 1}
                </span>
              </div>
              <h3 className="workflow-step-title">{step.title}</h3>
              <p className="workflow-step-desc">{step.description}</p>
            </div>
            {index < STEPS.length - 1 && (
              <div className="workflow-connector">
                <div
                  className={`workflow-connector-line ${
                    index === 0 ? 'gradient' : 'plain'
                  }`}
                >
                  <div className="workflow-connector-arrow" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="workflow-cta">
        <button className="hero-cta-primary" onClick={() => navigate('/app')}>
          立即开始 →
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 创建 Workflow Section 样式**

创建 `packages/client/src/pages/landing/workflow-section.css`：

```css
.workflow {
  padding: 60px 40px;
  background: #050507;
}

.workflow-header {
  text-align: center;
  margin-bottom: 48px;
}

.workflow-steps {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  max-width: 800px;
  margin: 0 auto;
}

.workflow-step-wrapper {
  display: flex;
  align-items: flex-start;
  flex: 0 0 auto;
}

.workflow-step {
  flex: 1;
  text-align: center;
  min-width: 180px;
}

.workflow-step-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  background: #101010;
  border: 2px solid #3d3a39;
  border-radius: 12px;
  color: #f2f2f2;
  margin-bottom: 20px;
}

.workflow-step-icon.active {
  border-color: #00d992;
  color: #00d992;
}

.workflow-step-number {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  background: #3d3a39;
  color: #f2f2f2;
}

.workflow-step-number.active {
  background: #00d992;
  color: #050507;
}

.workflow-step-title {
  color: #f2f2f2;
  font-size: 17px;
  font-weight: 600;
  margin: 0 0 8px;
}

.workflow-step-desc {
  color: #8b949e;
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  max-width: 200px;
  margin-left: auto;
  margin-right: auto;
}

/* 连接线 */
.workflow-connector {
  display: flex;
  align-items: center;
  padding-top: 36px;
  width: 60px;
  flex-shrink: 0;
}

.workflow-connector-line {
  flex: 1;
  height: 2px;
  background: #3d3a39;
  position: relative;
}

.workflow-connector-line.gradient {
  background: linear-gradient(90deg, #00d992, #3d3a39);
}

.workflow-connector-arrow {
  position: absolute;
  right: -3px;
  top: -3px;
  width: 8px;
  height: 8px;
  border-right: 2px solid #3d3a39;
  border-bottom: 2px solid #3d3a39;
  transform: rotate(-45deg);
}

.workflow-connector-line.gradient .workflow-connector-arrow {
  border-right-color: #3d3a39;
  border-bottom-color: #3d3a39;
}

/* 底部 CTA */
.workflow-cta {
  text-align: center;
  margin-top: 48px;
  padding-top: 32px;
  border-top: 1px solid rgba(61, 58, 57, 0.13);
}

.workflow-cta .hero-cta-primary {
  background: #00d992;
  color: #050507;
  padding: 14px 40px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}

.workflow-cta .hero-cta-primary:hover {
  background: #00ffaa;
}
```

- [ ] **Step 3: 验证类型检查**

Run:
```bash
cd d:/AI/Projects/dark-boss/packages/client && pnpm typecheck
```

Expected: 通过

- [ ] **Step 4: 提交**

```bash
git add packages/client/src/pages/landing/workflow-section.tsx packages/client/src/pages/landing/workflow-section.css
git commit -m "feat(landing): add workflow section with three-step flow"
```

---

### Task 6: 组装 Landing Page 并替换占位组件

**Files:**
- Modify: `packages/client/src/pages/landing/index.tsx`

- [ ] **Step 1: 替换占位组件为完整 Landing Page**

替换 `packages/client/src/pages/landing/index.tsx` 全部内容为：

```tsx
import { HeroSection } from './hero-section.js';
import { FeaturesSection } from './features-section.js';
import { WorkflowSection } from './workflow-section.js';

export function LandingPage() {
  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      <WorkflowSection />
    </main>
  );
}
```

- [ ] **Step 2: 验证构建**

Run:
```bash
cd d:/AI/Projects/dark-boss/packages/client && pnpm typecheck
```

Expected: 通过

- [ ] **Step 3: 启动开发服务器验证视觉效果**

Run:
```bash
cd d:/AI/Projects/dark-boss && pnpm dev
```

验证 http://localhost:5173/ 显示：
- Hero 区：全屏高度、绿色粒子、大标题、CTA 按钮、统计行、滚动提示
- 功能展示区：2×2 卡片网格，Lucide 图标，hover 边框变绿
- 工作流程图区：三步横向流程，连接线箭头，底部 CTA
- 页面可正常纵向滚动

- [ ] **Step 4: 提交**

```bash
git add packages/client/src/pages/landing/index.tsx
git commit -m "feat(landing): assemble landing page from hero, features, and workflow sections"
```

---

### Task 7: 最终验证

- [ ] **Step 1: 全量构建**

Run:
```bash
cd d:/AI/Projects/dark-boss && pnpm build
```

Expected: 构建成功，无错误

- [ ] **Step 2: 后端类型检查**

Run:
```bash
cd d:/AI/Projects/dark-boss && pnpm --filter @dark-boss/server typecheck
```

Expected: 通过（后端无改动）

- [ ] **Step 3: 全流程手动验证**

Run:
```bash
cd d:/AI/Projects/dark-boss && pnpm dev
```

验证清单：
- [ ] http://localhost:5173/ → Landing Page（无侧边栏，可滚动）
- [ ] 点击 "进入应用 →" → 跳转到 `/app`，显示 Dashboard（有侧边栏）
- [ ] 侧边栏菜单点击 → 路径正确（`/app/` 前缀）
- [ ] 功能卡片 hover → 边框变绿
- [ ] Landing Page 底部 "立即开始" → 跳转到 `/app`
- [ ] 工作流第一步图标绿色边框，后续灰色
