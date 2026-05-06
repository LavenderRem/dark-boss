import { AGENT_ROLES } from '@dark-boss/shared';
import type { AgentWorkload } from '../hooks/use-agent-workload';

interface WorkloadOverviewProps {
  workloads: AgentWorkload[];
  selectedAgentId?: string;
  onAgentClick: (agentId: string) => void;
}

export function WorkloadOverview({ workloads, selectedAgentId, onAgentClick }: WorkloadOverviewProps) {
  const getLevelStyle = (level: AgentWorkload['level'], isSelected: boolean) => {
    const baseStyle = {
      cursor: 'pointer',
      transition: 'all 0.2s',
    };

    if (level === 'offline') {
      return {
        ...baseStyle,
        border: '1px solid #3d3a39',
        background: '#1a1a1a',
        opacity: 0.5,
      };
    }

    if (level === 'idle') {
      return {
        ...baseStyle,
        border: isSelected ? '2px solid #00d992' : '1px solid #00d992',
        background: '#1a3a2a',
      };
    }

    if (level === 'busy') {
      return {
        ...baseStyle,
        border: isSelected ? '2px solid #fb565b' : '1px solid #fb565b',
        background: '#2a1a1a',
      };
    }

    // moderate
    return {
      ...baseStyle,
      border: isSelected ? '2px solid #3d3a39' : '1px solid #3d3a39',
      background: '#1a1a1a',
    };
  };

  const getLevelLabel = (level: AgentWorkload['level']) => {
    const labels = {
      idle: '空闲',
      moderate: '适中',
      busy: '繁忙',
      offline: '离线',
    };
    return labels[level];
  };

  const getLevelColor = (level: AgentWorkload['level']) => {
    const colors = {
      idle: '#00d992',
      moderate: '#ffba00',
      busy: '#fb565b',
      offline: '#8b949e',
    };
    return colors[level];
  };

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      overflowX: 'auto',
      paddingBottom: 8,
      marginBottom: 12,
    }}>
      {workloads.map(workload => {
        const roleInfo = AGENT_ROLES[workload.agent.role] || AGENT_ROLES.custom;
        const isSelected = workload.agentId === selectedAgentId;
        const levelStyle = getLevelStyle(workload.level, isSelected);

        return (
          <div
            key={workload.agentId}
            onClick={() => onAgentClick(workload.agentId)}
            style={{
              ...levelStyle,
              borderRadius: 8,
              padding: '10px 14px',
              minWidth: 160,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (workload.level !== 'offline') {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* 头部：图标 + 名称 + 状态 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>{roleInfo.icon}</span>
                <span style={{
                  color: '#f2f2f2',
                  fontSize: 13,
                  fontWeight: 500,
                }}>
                  {workload.agent.name}
                </span>
              </div>
              <span style={{
                fontSize: 11,
                color: getLevelColor(workload.level),
                background: 'rgba(255,255,255,0.05)',
                padding: '2px 6px',
                borderRadius: 4,
              }}>
                {getLevelLabel(workload.level)}
              </span>
            </div>

            {/* 中部：任务统计 */}
            <div style={{
              display: 'flex',
              gap: 12,
              fontSize: 12,
              color: '#b8b3b0',
              marginBottom: 8,
            }}>
              <span>
                <span style={{ color: '#f2f2f2', fontWeight: 600 }}>{workload.inProgressCount}</span> 进行中
              </span>
              <span>
                <span style={{ color: '#f2f2f2', fontWeight: 600 }}>{workload.todoCount}</span> 待办
              </span>
            </div>

            {/* 底部：负载进度条 */}
            <div style={{
              width: '100%',
              height: 4,
              background: '#0a0a0c',
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${workload.loadPercent}%`,
                height: '100%',
                background: workload.level === 'busy'
                  ? '#fb565b'
                  : workload.level === 'idle'
                    ? '#00d992'
                    : '#ffba00',
                borderRadius: 2,
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
