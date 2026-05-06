import { Button, Space, Popconfirm } from 'antd';
import { DeleteOutlined, EditOutlined, UserSwitchOutlined, FlagOutlined } from '@ant-design/icons';

interface BatchActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBatchStatusChange: (status: string) => void;
  onBatchPriorityChange: (priority: string) => void;
  onBatchAssign: (agentId: string | null) => void;
  onBatchDelete: () => void;
}

export function BatchActions({
  selectedCount,
  onClearSelection,
  onBatchStatusChange,
  onBatchPriorityChange,
  onBatchAssign,
  onBatchDelete,
}: BatchActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#101010',
        border: '1px solid #00d992',
        borderRadius: 8,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
      }}
    >
      <span style={{ color: '#f2f2f2', fontWeight: 600 }}>
        已选择 {selectedCount} 个任务
      </span>
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => onBatchStatusChange('todo')}>
          移至待办
        </Button>
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => onBatchStatusChange('in_progress')}
        >
          开始执行
        </Button>
        <Button size="small" icon={<FlagOutlined />} onClick={() => onBatchPriorityChange('high')}>
          设为高优先级
        </Button>
        <Button size="small" icon={<UserSwitchOutlined />} onClick={() => onBatchAssign(null)}>
          取消指派
        </Button>
        <Popconfirm
          title="确认删除"
          description="确定要删除选中的任务吗？"
          onConfirm={onBatchDelete}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
        <Button size="small" type="text" onClick={onClearSelection}>
          取消选择
        </Button>
      </Space>
    </div>
  );
}
