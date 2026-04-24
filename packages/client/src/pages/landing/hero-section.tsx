import { useNavigate } from 'react-router-dom';
import './hero-section.css';

const PARTICLES = [
  { top: '12%', left: '15%', size: 4, glow: 12, duration: '7s', delay: '0s' },
  { top: '22%', left: '68%', size: 5, glow: 16, duration: '9s', delay: '1s' },
  { top: '35%', left: '82%', size: 3, glow: 10, duration: '8s', delay: '0.5s' },
  { top: '28%', left: '42%', size: 4, glow: 14, duration: '10s', delay: '2s' },
  { top: '48%', left: '10%', size: 5, glow: 18, duration: '7.5s', delay: '1.5s' },
  { top: '52%', left: '75%', size: 3, glow: 12, duration: '8.5s', delay: '0.8s' },
  { top: '62%', left: '30%', size: 4, glow: 14, duration: '9.5s', delay: '3s' },
  { top: '72%', left: '88%', size: 3, glow: 10, duration: '7s', delay: '2.5s' },
  { top: '78%', left: '50%', size: 5, glow: 20, duration: '8s', delay: '1.2s' },
  { top: '85%', left: '20%', size: 4, glow: 12, duration: '10.5s', delay: '0.3s' },
  { top: '18%', left: '55%', size: 3, glow: 10, duration: '9s', delay: '3.5s' },
  { top: '42%', left: '92%', size: 4, glow: 14, duration: '8s', delay: '1.8s' },
  { top: '8%', left: '38%', size: 6, glow: 22, duration: '11s', delay: '0.7s' },
  { top: '58%', left: '58%', size: 6, glow: 24, duration: '10s', delay: '2.2s' },
  { top: '68%', left: '5%', size: 5, glow: 16, duration: '9s', delay: '4s' },
  { top: '38%', left: '25%', size: 4, glow: 12, duration: '8.5s', delay: '1.3s' },
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
              '--float-duration': p.duration,
              '--float-delay': p.delay,
            } as React.CSSProperties}
          />
        ))}
        <div className="hero-grid-line" style={{ top: '30%' }} />
        <div className="hero-grid-line" style={{ top: '60%' }} />
      </div>

      <div className="hero-content">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          <span className="hero-badge-text">DARK BOSS — Multi-Agent Platform</span>
        </div>

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

        <p className="hero-subtitle">
          图形化编排多个 Claude Code Agent，
          <br />
          让 AI 团队像真实员工一样高效协作
        </p>

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

        <div className="hero-stats">
          {STATS.map((stat) => (
            <div key={stat.label} className="hero-stat">
              <div className="hero-stat-value">{stat.value}</div>
              <div className="hero-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="hero-scroll-indicator">
        <span>SCROLL</span>
        <div className="hero-scroll-line" />
      </div>
    </section>
  );
}
