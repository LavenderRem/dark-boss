import { Card, Tag, Empty } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { Task, Agent } from '@dark-boss/shared';
import { AGENT_ROLES } from '@dark-boss/shared';
import { TaskCard } from './task-card';

interface AgentViewProps {
  tasks: Task[];
  agents: Agent[];
  onTaskClick: (task: Task, event?: React.MouseEvent) => void;
  selectedTaskIds: Set<string>;
}

export function AgentView({ tasks, agents, onTaskClick, selectedTaskIds }: AgentViewProps) {
  const getAgentStatus = (agentId: string) => {
    const agentTasks = tasks.filter(t => t.assignedAgentId === agentId);
    const inProgressCount = agentTasks.filter(t => t.status === 'in_progress').length;
    const completedCount = agentTasks.filter(t => t.status === 'done').length;
    const totalCount = agentTasks.length;

    return {
      inProgressCount,
      completedCount,
      totalCount,
      isWorking: inProgressCount > 0,
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {agents.map(agent => {
        const roleInfo = AGENT_ROLES[agent.role] || AGENT_ROLES.custom;
        const status = getAgentStatus(agent.id);
        const agentTasks = tasks.filter(t => t.assignedAgentId === agent.id);

        return (
          <Card
            key={agent.id}
            style={{
              background: '#101010',
              border: '1px solid #3d3a39',
              borderRadius: 8,
            }}
            bodyStyle={{ padding: 16 }}
          >
            {/* Agent 头部 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{roleInfo.icon}</span>
                <div>
                  <div style={{ color: '#f2f2f2', fontWeight: 600, fontSize: 15 }}>
                    {agent.name}
                  </div>
                  <div style={{ color: '#8b949e', fontSize: 12 }}>{roleInfo.label}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {status.isWorking ? (
                  <Tag
                    icon={<CheckCircleOutlined />}
                    style={{
                      background: '#00d99220',
                      color: '#00d992',
                      border: 'none',
                      fontSize: 11,
                    }}
                  >
                    工作中 ({status.inProgressCount})
                  </Tag>
                ) : (
                  <Tag
                    icon={<ClockCircleOutlined />}
                    style={{
                      background: '#3d3a39',
                      color: '#8b949e',
                      border: 'none',
                      fontSize: 11,
                    }}
                  >
                    空闲
                  </Tag>
                )}
                <Tag
                  style={{
                    background: '#3d3a39',
                    color: '#b8b3b0',
                    border: 'none',
                    fontSize: 11,
                  }}
                >
                  {status.completedCount}/{status.totalCount} 完成
                </Tag>
              </div>
            </div>

            {/* 任务列表 */}
            {agentTasks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {agentTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={(e) => onTaskClick(task, e)}
                    style={{
                      cursor: 'pointer',
                      border: selectedTaskIds.has(task.id) ? '1px solid #00d992' : undefined,
                      borderRadius: selectedTaskIds.has(task.id) ? 6 : undefined,
                    }}
                  >
                    <TaskCard task={task} agents={agents} onClick={onTaskClick} />
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span style={{ color: '#8b949e', fontSize: 13 }}>暂无任务</span>}
                style={{ padding: '20px 0' }}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
}
