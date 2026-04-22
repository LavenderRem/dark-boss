import { memo, useEffect, useMemo, useRef } from 'react';
import { message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useWorkflowStore } from '../../../stores/workflow-store.js';

interface NodeContextMenuProps {
  nodeId: string;
  top: number;
  left: number;
  onClose: () => void;
}

const MENU_WIDTH = 140;
const MENU_HEIGHT = 40;

export const NodeContextMenu = memo(function NodeContextMenu({ nodeId, top, left, onClose }: NodeContextMenuProps) {
  const removeNode = useWorkflowStore(s => s.removeNode);
  const isRunning = useWorkflowStore(s => s.isRunning);
  const menuRef = useRef<HTMLDivElement>(null);

  const adjustedPos = useMemo(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      top: top + MENU_HEIGHT > vh ? Math.max(0, vh - MENU_HEIGHT - 8) : top,
      left: left + MENU_WIDTH > vw ? Math.max(0, vw - MENU_WIDTH - 8) : left,
    };
  }, [top, left]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleDelete = () => {
    if (isRunning) return;
    removeNode(nodeId);
    message.success('节点已删除');
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: adjustedPos.top,
        left: adjustedPos.left,
        background: '#101010',
        border: '1px solid #3d3a39',
        borderRadius: 6,
        padding: '4px 0',
        minWidth: MENU_WIDTH,
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }}
    >
      <div
        onClick={handleDelete}
        style={{
          padding: '8px 12px',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          color: isRunning ? '#595959' : '#ff7875',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!isRunning) {
            e.currentTarget.style.background = '#2a1215';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <DeleteOutlined />
        删除节点
      </div>
    </div>
  );
});
