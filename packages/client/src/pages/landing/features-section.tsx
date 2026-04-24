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
