import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, LayoutGrid, Play } from 'lucide-react';
import './workflow-section.css';

const STEPS = [
  {
    icon: UserPlus,
    title: '雇佣 Agent',
    description: '从模板市场选择角色，配置技能和权限，组建你的 AI 团队',
  },
  {
    icon: LayoutGrid,
    title: '编排工作流',
    description: '在画布上拖拽连接 Agent 节点，定义任务流和执行顺序',
  },
  {
    icon: Play,
    title: '执行监控',
    description: '一键启动工作流，实时终端跟踪每个 Agent 的执行状态',
  },
];

export function WorkflowSection() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

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
              <div className={`workflow-step-icon ${activeStep === index ? 'active' : ''}`}>
                <step.icon size={28} strokeWidth={1.5} />
                <span className={`workflow-step-number ${activeStep === index ? 'active' : ''}`}>
                  {index + 1}
                </span>
              </div>
              <h3 className={`workflow-step-title ${activeStep === index ? 'active' : ''}`}>
                {step.title}
              </h3>
              <p className={`workflow-step-desc ${activeStep === index ? 'active' : ''}`}>
                {step.description}
              </p>
            </div>
            {index < STEPS.length - 1 && (
              <div className="workflow-connector">
                <div
                  className={`workflow-connector-line ${
                    activeStep >= index ? 'gradient' : 'plain'
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
        <button className="workflow-cta-button" onClick={() => navigate('/app')}>
          立即开始 →
        </button>
      </div>
    </section>
  );
}
