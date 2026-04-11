import { useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { AgentNode } from './agent-node.js';
import { InputNode, OutputNode, RouterNode, AggregatorNode } from './input-output-nodes.js';
import { DataEdge } from './data-edge.js';
import { NodeSidebar } from './node-sidebar.js';
import { FlowToolbar } from './flow-toolbar.js';
import { useAutoLayout } from '../hooks/use-auto-layout.js';
import { useWorkflowStore } from '../../../stores/workflow-store.js';

const nodeTypes: NodeTypes = {
  agent: AgentNode,
  input: InputNode,
  output: OutputNode,
  router: RouterNode,
  aggregator: AggregatorNode,
};

const edgeTypes: EdgeTypes = {
  data: DataEdge,
};

let nodeId = 0;
const getId = () => `node_${nodeId++}`;

export function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const { nodes, edges, onConnect, addNode, workflowName, isDirty } = useWorkflowStore();
  const autoLayout = useAutoLayout();

  // 拖拽放置
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow-type');
    const dataStr = event.dataTransfer.getData('application/reactflow-data');
    if (!type || !reactFlowInstance.current) return;

    const data = dataStr ? JSON.parse(dataStr) : {};
    const position = reactFlowInstance.current.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode: Node = {
      id: getId(),
      type,
      position,
      data,
    };

    addNode(newNode);
    useWorkflowStore.getState().markDirty();
  }, [addNode]);

  // 键盘快捷键
  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      // TODO: 触发保存
    }
  }, []);

  // 边插入节点事件
  useMemo(() => {
    const handler = (e: Event) => {
      const { edgeId } = (e as CustomEvent).detail;
      console.log('在边', edgeId, '处插入节点（待实现）');
    };
    window.addEventListener('edge-insert-node', handler);
    return () => window.removeEventListener('edge-insert-node', handler);
  }, []);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  const setNodes = useWorkflowStore(s => s.setNodes);
  const setEdges = useWorkflowStore(s => s.setEdges);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <FlowToolbar
        onSave={() => {
          // TODO: 调用 API 保存
          useWorkflowStore.getState().markSaved();
        }}
        onRun={() => console.log('执行工作流（待实现）')}
        onPause={() => console.log('暂停工作流（待实现）')}
        onAutoLayout={autoLayout}
        onAddWorkflow={() => {
          useWorkflowStore.getState().reset();
          nodeId = 0;
        }}
        isRunning={false}
        isDirty={isDirty}
        workflowName={workflowName}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 侧边栏 */}
        <NodeSidebar />

        {/* 画布 */}
        <div ref={reactFlowWrapper} style={{ flex: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes) => {
              const { applyNodeChanges } = require('@xyflow/react');
              useWorkflowStore.getState().setNodes(applyNodeChanges(changes, nodes));
            }}
            onEdgesChange={(changes) => {
              const { applyEdgeChanges } = require('@xyflow/react');
              useWorkflowStore.getState().setEdges(applyEdgeChanges(changes, edges));
            }}
            onConnect={onConnect}
            onInit={onInit}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            defaultEdgeOptions={{ type: 'data' }}
            style={{ background: '#0d0d0d' }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1a1a2e" gap={20} />
            <Controls
              style={{ background: '#1f1f1f', borderRadius: 6, border: '1px solid #303030' }}
            />
            <MiniMap
              style={{ background: '#1a1a1a', border: '1px solid #303030' }}
              nodeColor={(n) => {
                const data = n.data as Record<string, string>;
                if (data?.agentRole) {
                  const { AGENT_ROLES } = require('@dark-boss/shared');
                  const role = AGENT_ROLES[data.agentRole];
                  return role?.color || '#434343';
                }
                return '#434343';
              }}
              maskColor="rgba(0,0,0,0.7)"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
