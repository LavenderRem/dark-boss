import { useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
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

// 注入脉冲动画 CSS（仅注入一次）
if (typeof document !== 'undefined' && !document.getElementById('workflow-pulse-style')) {
  const style = document.createElement('style');
  style.id = 'workflow-pulse-style';
  style.textContent = `
    @keyframes agent-pulse {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 0.1; transform: scale(1.03); }
    }
  `;
  document.head.appendChild(style);
}

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
  onViewResult: () => void;
  onToggleLogPanel: () => void;
  isRunning: boolean;
}

export function FlowCanvas({ onBackToList, onSave, onRun, onViewResult, onToggleLogPanel, isRunning }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance<Node> | null>(null);

  const { nodes, edges, onConnect, addNode, workflowName, isDirty, executingNodeId, activeEdgeIds, nodeResults } = useWorkflowStore();
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

  const onInit = useCallback((instance: unknown) => {
    reactFlowInstance.current = instance as ReactFlowInstance<Node>;
  }, []);

  // 监听工作流执行状态的 WebSocket 事件
  useEffect(() => {
    const handler = (event: Event) => {
      const { type, payload } = (event as CustomEvent).detail;
      const store = useWorkflowStore.getState();

      if (type === 'workflow:node_start') {
        store.setExecutingNode(payload.nodeId);
      }

      if (type === 'workflow:node_complete') {
        // 记录节点结果
        if (payload.nodeId && payload.result) {
          store.setNodeResult(payload.nodeId, payload.result);
        }
        // 激活该节点的出边
        const completedEdges = store.edges
          .filter(e => e.source === payload.nodeId)
          .map(e => e.id);
        const newActive = new Set(store.activeEdgeIds);
        completedEdges.forEach(id => newActive.add(id));
        store.setActiveEdges(newActive);
        store.setExecutingNode(null);
      }

      if (type === 'workflow:progress' && payload.status) {
        if (payload.status === 'running') {
          store.setActiveEdges(new Set());
          store.setExecutingNode(null);
        }
        if (payload.status === 'completed' || payload.status === 'failed') {
          store.setExecutingNode(null);
          // 执行结束时更新工作流状态
          const { workflowId } = useWorkflowStore.getState();
          if (workflowId) {
            setTimeout(async () => {
              try {
                const wf = await fetch(`/api/v1/workflows/${workflowId}`).then(r => r.json());
                if (wf.status === 'completed' && wf.variables) {
                  const results = typeof wf.variables === 'string' ? JSON.parse(wf.variables) : wf.variables;
                  const outputKeys = Object.keys(results);
                  if (outputKeys.length > 0) {
                    const outputs = outputKeys.map(k => results[k]).join('\n\n');
                    (window as unknown as Record<string, unknown>).__workflowResult = outputs;
                  }
                }
              } catch { /* ignore */ }
            }, 500);
          }
        }
      }
    };

    window.addEventListener('ws:message', handler);
    return () => window.removeEventListener('ws:message', handler);
  }, []);

  // 注入节点执行状态到 node data（让节点组件感知到 isExecuting/isCompleted）
  const enrichedNodes = useMemo(() => {
    return nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        isExecuting: executingNodeId === n.id,
        isCompleted: nodeResults.has(n.id),
        result: nodeResults.get(n.id) || null,
      },
    }));
  }, [nodes, executingNodeId, nodeResults]);

  // 注入边的激活状态
  const enrichedEdges = useMemo(() => {
    return edges.map(e => ({
      ...e,
      data: {
        ...e.data,
        isActive: activeEdgeIds.has(e.id),
      },
    }));
  }, [edges, activeEdgeIds]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <FlowToolbar
        onSave={onSave}
        onRun={onRun}
        onPause={() => {/* TODO: 暂停执行 */}}
        onAutoLayout={autoLayout}
        onAddWorkflow={onBackToList}
        onViewResult={onViewResult}
        onToggleLogPanel={onToggleLogPanel}
        isRunning={isRunning}
        isDirty={isDirty}
        workflowName={workflowName}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 侧边栏 */}
        <NodeSidebar />

        {/* 画布 */}
        <div ref={reactFlowWrapper} style={{ flex: 1 }}>
          <ReactFlow
            nodes={enrichedNodes as unknown as Node[]}
            edges={enrichedEdges as unknown as Edge[]}
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
