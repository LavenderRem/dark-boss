import { memo } from 'react';
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
  EdgeLabelRenderer,
} from '@xyflow/react';

// 数据流边
export const DataEdge = memo(function DataEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const isActive = data?.isActive as boolean;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: isActive ? '#00d992' : selected ? '#4096ff' : '#434343',
          strokeWidth: isActive ? 2.5 : selected ? 2 : 1.5,
          strokeDasharray: isActive ? undefined : undefined,
          transition: 'stroke 0.3s, stroke-width 0.3s',
        }}
      />
      {/* 边上的 "+" 按钮 — 用于插入新节点 */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            cursor: 'pointer',
          }}
          className="nodrag nopan"
        >
          <button
            onClick={() => {
              // 通过自定义事件通知画布插入节点
              window.dispatchEvent(new CustomEvent('edge-insert-node', { detail: { edgeId: id } }));
            }}
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: '1px solid #434343',
              background: '#0a0a0c',
              color: '#8b949e',
              fontSize: 12,
              lineHeight: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: selected ? 1 : 0,
              transition: 'opacity 0.2s',
            }}
          >
            +
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
