import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';

const elk = new ELK({
  defaultLayoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.spacing.nodeNode': '60',
    'elk.layered.spacing.nodeNodeBetweenLayers': '100',
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  },
});

// 将 React Flow 节点/边转换为 ELK 格式
function toElkGraph(nodes: Node[], edges: Edge[]) {
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
    },
    children: nodes.map(n => ({
      id: n.id,
      width: n.measured?.width || 180,
      height: n.measured?.height || 80,
    })),
    edges: edges.map(e => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };
}

export function useAutoLayout() {
  const { getNodes, getEdges, setNodes } = useReactFlow();

  const layout = useCallback(async () => {
    const nodes = getNodes();
    const edges = getEdges();

    if (nodes.length === 0) return;

    const elkGraph = toElkGraph(nodes, edges);

    try {
      const layoutedGraph = await elk.layout(elkGraph);

      const layoutMap = new Map(
        layoutedGraph.children?.map(c => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }])
      );

      setNodes(nodes.map(node => {
        const pos = layoutMap.get(node.id);
        return pos ? { ...node, position: { x: pos.x, y: pos.y } } : node;
      }));
    } catch (err) {
      console.error('自动布局失败:', err);
    }
  }, [getNodes, getEdges, setNodes]);

  return layout;
}
