import { AppstoreOutlined, UnorderedListOutlined, UserOutlined } from '@ant-design/icons';

export type ViewMode = 'kanban' | 'list' | 'agent';

interface ViewSwitcherProps {
  current: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewSwitcher({ current, onChange }: ViewSwitcherProps) {
  const buttonStyle = (isActive: boolean) => ({
    background: isActive ? '#00d992' : 'transparent',
    color: isActive ? '#050507' : '#b8b3b0',
    border: '1px solid #3d3a39',
    borderRadius: 6,
    padding: '6px 12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  });

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button
        style={buttonStyle(current === 'kanban')}
        onClick={() => onChange('kanban')}
      >
        <AppstoreOutlined />
        <span>看板</span>
      </button>
      <button
        style={buttonStyle(current === 'list')}
        onClick={() => onChange('list')}
      >
        <UnorderedListOutlined />
        <span>列表</span>
      </button>
      <button
        style={buttonStyle(current === 'agent')}
        onClick={() => onChange('agent')}
      >
        <UserOutlined />
        <span>Agent</span>
      </button>
    </div>
  );
}
