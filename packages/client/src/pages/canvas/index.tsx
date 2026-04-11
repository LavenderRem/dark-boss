import { ReactFlowProvider } from '@xyflow/react';
import { FlowCanvas } from './components/flow-canvas.js';

export function CanvasPage() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ReactFlowProvider>
        <FlowCanvas />
      </ReactFlowProvider>
    </div>
  );
}
