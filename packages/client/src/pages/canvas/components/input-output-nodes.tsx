import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

// 输入节点
export interface InputNodeData {
  label: string;
  prompt?: string;
}

export const InputNode = memo(function InputNode({ data, selected }: NodeProps & { data: InputNodeData }) {
  return (
    <div style={{
      padding: '10px 16px',
      borderRadius: 8,
      background: '#1a2714',
      border: `2px solid ${selected ? '#52c41a' : '#389e0d'}`,
      minWidth: 120,
    }}>
      <Handle type="source" position={Position.Bottom} style={{ background: '#52c41a', width: 8, height: 8 }} />
      <div style={{ fontWeight: 600, color: '#95de64', fontSize: 13, textAlign: 'center' }}>
        📥 {data.label}
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
}

export const OutputNode = memo(function OutputNode({ data, selected }: NodeProps & { data: OutputNodeData }) {
  return (
    <div style={{
      padding: '10px 16px',
      borderRadius: 8,
      background: '#2a1215',
      border: `2px solid ${selected ? '#ff4d4f' : '#cf1322'}`,
      minWidth: 120,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#ff4d4f', width: 8, height: 8 }} />
      <div style={{ fontWeight: 600, color: '#ff7875', fontSize: 13, textAlign: 'center' }}>
        📤 {data.label}
      </div>
    </div>
  );
});

// Router 节点（并行分发）
export interface RouterNodeData {
  label: string;
}

export const RouterNode = memo(function RouterNode({ data, selected }: NodeProps & { data: RouterNodeData }) {
  return (
    <div style={{
      padding: '10px 16px',
      borderRadius: 8,
      background: '#141a27',
      border: `2px solid ${selected ? '#1890ff' : '#0958d9'}`,
      minWidth: 120,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#1890ff', width: 8, height: 8 }} />
      <div style={{ fontWeight: 600, color: '#69b1ff', fontSize: 13, textAlign: 'center' }}>
        🔀 {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} id="a" style={{ background: '#1890ff', width: 8, height: 8, left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ background: '#1890ff', width: 8, height: 8, left: '70%' }} />
    </div>
  );
});

// Aggregator 节点（合并输出）
export interface AggregatorNodeData {
  label: string;
}

export const AggregatorNode = memo(function AggregatorNode({ data, selected }: NodeProps & { data: AggregatorNodeData }) {
  return (
    <div style={{
      padding: '10px 16px',
      borderRadius: 8,
      background: '#1f1a27',
      border: `2px solid ${selected ? '#8b5cf6' : '#6d28d9'}`,
      minWidth: 120,
    }}>
      <Handle type="target" position={Position.Top} id="a" style={{ background: '#8b5cf6', width: 8, height: 8, left: '30%' }} />
      <Handle type="target" position={Position.Top} id="b" style={{ background: '#8b5cf6', width: 8, height: 8, left: '70%' }} />
      <div style={{ fontWeight: 600, color: '#b37feb', fontSize: 13, textAlign: 'center' }}>
        🔗 {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#8b5cf6', width: 8, height: 8 }} />
    </div>
  );
});
