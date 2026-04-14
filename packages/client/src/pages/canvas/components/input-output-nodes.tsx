import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { LoadingOutlined, CheckCircleOutlined } from '@ant-design/icons';

// 通用节点执行状态样式
function getNodeStatusStyle(isExecuting?: boolean, isCompleted?: boolean) {
  if (isExecuting) return { extraShadow: '0 0 12px currentColor33', icon: <LoadingOutlined spin style={{ fontSize: 14 } } /> };
  if (isCompleted) return { extraShadow: 'none', icon: <CheckCircleOutlined style={{ fontSize: 14 }} /> };
  return { extraShadow: 'none', icon: null };
}

// 输入节点
export interface InputNodeData {
  label: string;
  prompt?: string;
  isExecuting?: boolean;
  isCompleted?: boolean;
  result?: string | null;
}

export const InputNode = memo(function InputNode({ data, selected }: NodeProps & { data: InputNodeData }) {
  const status = getNodeStatusStyle(data.isExecuting, data.isCompleted);
  return (
    <div style={{
      padding: '10px 16px',
      borderRadius: 8,
      background: data.isExecuting ? '#1a2a14' : data.isCompleted ? '#0f1f0d' : '#1a2714',
      border: `2px solid ${data.isExecuting ? '#73d13d' : data.isCompleted ? '#52c41a' : selected ? '#52c41a' : '#389e0d'}`,
      minWidth: 120,
      boxShadow: data.isExecuting ? '0 0 16px #52c41a44' : 'none',
      transition: 'border-color 0.3s, box-shadow 0.3s',
    }}>
      <Handle type="source" position={Position.Bottom} style={{ background: '#52c41a', width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{ fontWeight: 600, color: '#95de64', fontSize: 13 }}>
          📥 {data.label}
        </span>
        {status.icon && <span style={{ color: data.isCompleted ? '#52c41a' : '#73d13d' }}>{status.icon}</span>}
      </div>
      {data.prompt && (
        <div style={{ fontSize: 11, color: '#73d13d', marginTop: 4, opacity: 0.8 }}>
          {data.prompt.slice(0, 60)}{data.prompt.length > 60 ? '...' : ''}
        </div>
      )}
    </div>
  );
});

// 输出节点
export interface OutputNodeData {
  label: string;
  isExecuting?: boolean;
  isCompleted?: boolean;
  result?: string | null;
}

export const OutputNode = memo(function OutputNode({ data, selected }: NodeProps & { data: OutputNodeData }) {
  const status = getNodeStatusStyle(data.isExecuting, data.isCompleted);
  return (
    <div style={{
      padding: '10px 16px',
      borderRadius: 8,
      background: data.isExecuting ? '#2a121a' : data.isCompleted ? '#1f0f12' : '#2a1215',
      border: `2px solid ${data.isExecuting ? '#ff7875' : data.isCompleted ? '#52c41a' : selected ? '#ff4d4f' : '#cf1322'}`,
      minWidth: 120,
      boxShadow: data.isExecuting ? '0 0 16px #ff4d4f44' : 'none',
      transition: 'border-color 0.3s, box-shadow 0.3s',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#ff4d4f', width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{ fontWeight: 600, color: '#ff7875', fontSize: 13 }}>
          📤 {data.label}
        </span>
        {status.icon && <span style={{ color: data.isCompleted ? '#52c41a' : '#ff7875' }}>{status.icon}</span>}
      </div>
      {data.isCompleted && data.result && (
        <div style={{
          fontSize: 11,
          color: '#52c41a',
          marginTop: 4,
          padding: '4px 6px',
          background: '#0f1f0d',
          borderRadius: 4,
          maxHeight: 40,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
        }}>
          ✓ 已输出
        </div>
      )}
    </div>
  );
});

// Router 节点（并行分发）
export interface RouterNodeData {
  label: string;
  isExecuting?: boolean;
  isCompleted?: boolean;
  result?: string | null;
}

export const RouterNode = memo(function RouterNode({ data, selected }: NodeProps & { data: RouterNodeData }) {
  const status = getNodeStatusStyle(data.isExecuting, data.isCompleted);
  return (
    <div style={{
      padding: '10px 16px',
      borderRadius: 8,
      background: data.isExecuting ? '#141a2a' : data.isCompleted ? '#0d0f1f' : '#141a27',
      border: `2px solid ${data.isExecuting ? '#4096ff' : data.isCompleted ? '#52c41a' : selected ? '#1890ff' : '#0958d9'}`,
      minWidth: 120,
      boxShadow: data.isExecuting ? '0 0 16px #1890ff44' : 'none',
      transition: 'border-color 0.3s, box-shadow 0.3s',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#1890ff', width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{ fontWeight: 600, color: '#69b1ff', fontSize: 13 }}>
          🔀 {data.label}
        </span>
        {status.icon && <span style={{ color: data.isCompleted ? '#52c41a' : '#69b1ff' }}>{status.icon}</span>}
      </div>
      <Handle type="source" position={Position.Bottom} id="a" style={{ background: '#1890ff', width: 8, height: 8, left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ background: '#1890ff', width: 8, height: 8, left: '70%' }} />
    </div>
  );
});

// Aggregator 节点（合并输出）
export interface AggregatorNodeData {
  label: string;
  isExecuting?: boolean;
  isCompleted?: boolean;
  result?: string | null;
}

export const AggregatorNode = memo(function AggregatorNode({ data, selected }: NodeProps & { data: AggregatorNodeData }) {
  const status = getNodeStatusStyle(data.isExecuting, data.isCompleted);
  return (
    <div style={{
      padding: '10px 16px',
      borderRadius: 8,
      background: data.isExecuting ? '#1f1427' : data.isCompleted ? '#140d1f' : '#1f1a27',
      border: `2px solid ${data.isExecuting ? '#b37feb' : data.isCompleted ? '#52c41a' : selected ? '#8b5cf6' : '#6d28d9'}`,
      minWidth: 120,
      boxShadow: data.isExecuting ? '0 0 16px #8b5cf644' : 'none',
      transition: 'border-color 0.3s, box-shadow 0.3s',
    }}>
      <Handle type="target" position={Position.Top} id="a" style={{ background: '#8b5cf6', width: 8, height: 8, left: '30%' }} />
      <Handle type="target" position={Position.Top} id="b" style={{ background: '#8b5cf6', width: 8, height: 8, left: '70%' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{ fontWeight: 600, color: '#b37feb', fontSize: 13 }}>
          🔗 {data.label}
        </span>
        {status.icon && <span style={{ color: data.isCompleted ? '#52c41a' : '#b37feb' }}>{status.icon}</span>}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#8b5cf6', width: 8, height: 8 }} />
    </div>
  );
});
