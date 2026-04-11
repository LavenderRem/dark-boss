import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client.js';
import { AGENT_ROLES } from '@dark-boss/shared';
import type { Agent } from '@dark-boss/shared';

// 节点类型定义
const nodeTypes = [
  { type: 'input', label: '输入节点', icon: '📥', color: '#52c41a' },
  { type: 'output', label: '输出节点', icon: '📤', color: '#ff4d4f' },
  { type: 'router', label: '并行分发', icon: '🔀', color: '#1890ff' },
  { type: 'aggregator', label: '合并结果', icon: '🔗', color: '#8b5cf6' },
] as const;

export function NodeSidebar() {
  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get<Agent[]>('/agents'),
  });

  const onDragStart = (event: React.DragEvent, nodeType: string, nodeData: Record<string, unknown>) => {
    event.dataTransfer.setData('application/reactflow-type', nodeType);
    event.dataTransfer.setData('application/reactflow-data', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={{
      width: 220,
      background: '#1a1a1a',
      borderRight: '1px solid #303030',
      padding: 12,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* 基础节点 */}
      <div>
        <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>基础组件</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {nodeTypes.map(nt => (
            <div
              key={nt.type}
              draggable
              onDragStart={(e) => onDragStart(e, nt.type, { label: nt.label })}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                background: '#1f1f1f',
                border: '1px solid #303030',
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: '#bfbfbf',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = nt.color; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#303030'; }}
            >
              <span>{nt.icon}</span>
              <span>{nt.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Agent 节点 */}
      <div>
        <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>员工</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {agents.map(agent => {
            const roleInfo = AGENT_ROLES[agent.role] || AGENT_ROLES.custom;
            return (
              <div
                key={agent.id}
                draggable
                onDragStart={(e) => onDragStart(e, 'agent', {
                  label: agent.name,
                  agentId: agent.id,
                  agentName: agent.name,
                  agentRole: agent.role,
                  agentStatus: agent.status,
                  model: agent.model,
                })}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: '#1f1f1f',
                  border: '1px solid #303030',
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: '#bfbfbf',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = roleInfo.color; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#303030'; }}
              >
                <span>{roleInfo.icon}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agent.name}
                </span>
              </div>
            );
          })}
          {agents.length === 0 && (
            <div style={{ color: '#595959', fontSize: 12, textAlign: 'center', padding: 8 }}>
              暂无员工，先去招聘
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
