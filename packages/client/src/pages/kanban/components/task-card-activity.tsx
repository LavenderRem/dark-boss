import type { Task } from '@dark-boss/shared';

interface TaskCardActivityProps {
  task: Task;
}

const ACTIVITY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: '#00d992', bg: '#1a3a2a', label: '● 活跃' },
  thinking: { color: '#4cb3d4', bg: '#1a2a3a', label: '💭 思考中' },
  waiting_permission: { color: '#ffba00', bg: '#2a2a1a', label: '⏸ 等待权限' },
  error: { color: '#fb565b', bg: '#2a1a1a', label: '⚠ 出错' },
};

export function TaskCardActivity({ task }: TaskCardActivityProps) {
  if (task.status !== 'in_progress' || !task.activitySummary) return null;

  const getActivityType = (): string => {
    const s = task.activitySummary || '';
    if (s.includes('等待权限') || s.includes('permission')) return 'waiting_permission';
    if (s.includes('思考') || s.includes('thinking')) return 'thinking';
    if (s.includes('错误') || s.includes('error')) return 'error';
    return 'active';
  };

  const activityType = getActivityType();
  const style = ACTIVITY_STYLES[activityType];

  return (
    <div style={{
      background: style.bg,
      borderRadius: 4,
      padding: '4px 8px',
      marginBottom: 6,
      fontSize: 11,
    }}>
      <div style={{ color: style.color }}>{style.label}</div>
      <div style={{ color: '#595959', fontSize: 10, marginTop: 2 }}>
        {task.activitySummary}
      </div>
    </div>
  );
}
