import { useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
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
import { AGENT_ROLES } from '@dark-boss/shared';

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

interface FlowCanvasProps {
  onBackToList: () => void;
  onSave: () => void;
  onRun: () => void;
}

export function FlowCanvas({ onBackToList, onSave, onRun }: FlowCanvasProps) {
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

  // 边插入节点事件
  useMemo(() => {
    const handler = (e: Event) => {
      const { edgeId } = (e as CustomEvent).detail;
      const store = useWorkflowStore.getState();
      const edge = store.edges.find(ed => ed.id === edgeId);
      if (!edge) return;

      // 在边的中间插入一个新的 Agent 节点
      const sourceNode = store.nodes.find(n => n.id === edge.source);
      const targetNode = store.nodes.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return;

      const midX = (sourceNode.position.x + targetNode.position.x) / 2;
      const midY = (sourceNode.position.y + targetNode.position.y) / 2;

      const newNode: Node = {
        id: getId(),
        type: 'agent',
        position: { x: midX, y: midY },
        data: { label: '新节点' },
      };

      // 移除原边，添加两条新边
      const newEdges = store.edges
        .filter(ed => ed.id !== edgeId)
        .concat([
          { id: `e-${edge.source}-${newNode.id}`, source: edge.source, target: newNode.id, type: 'data' },
          { id: `e-${newNode.id}-${edge.target}`, source: newNode.id, target: edge.target, type: 'data' },
        ] as never[]);

      store.setNodes([...store.nodes, newNode]);
      store.setEdges(newEdges);
      store.markDirty();
    };
    window.addEventListener('edge-insert-node', handler);
    return () => window.removeEventListener('edge-insert-node', handler);
  }, []);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <FlowToolbar
        onSave={onSave}
        onRun={onRun}
        onPause={() => {/* TODO: 暂停执行 */}}
        onAutoLayout={autoLayout}
        onAddWorkflow={onBackToList}
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
              useWorkflowStore.getState().setNodes(applyNodeChanges(changes, nodes));
            }}
            onEdgesChange={(changes) => {
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
                  const role = AGENT_ROLES[data.agentRole as keyof typeof AGENT_ROLES];
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
