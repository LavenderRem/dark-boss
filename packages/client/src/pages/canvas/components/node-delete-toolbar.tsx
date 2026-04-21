import { memo } from 'react';
import { NodeToolbar } from '@xyflow/react';
import { Button, Popconfirm, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useWorkflowStore } from '../../../stores/workflow-store.js';

interface NodeDeleteToolbarProps {
  nodeId: string;
}

export const NodeDeleteToolbar = memo(function NodeDeleteToolbar({ nodeId }: NodeDeleteToolbarProps) {
  const removeNode = useWorkflowStore(s => s.removeNode);
  const isRunning = useWorkflowStore(s => s.isRunning);

  const handleDelete = () => {
    removeNode(nodeId);
    message.success('节点已删除');
  };

  return (
    <NodeToolbar>
      <Popconfirm
        title="确认删除"
        description="删除节点将同时移除关联的连线"
        onConfirm={handleDelete}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          disabled={isRunning}
          style={{
            background: '#2a1215',
            border: '1px solid #cf132244',
            color: '#ff7875',
          }}
        >
          删除节点
        </Button>
      </Popconfirm>
    </NodeToolbar>
  );
});
