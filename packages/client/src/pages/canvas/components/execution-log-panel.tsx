import { useEffect, useCallback } from 'react';
import { Drawer, Timeline, Tag, Typography, Space, Empty, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  NodeIndexOutlined,
  ApartmentOutlined,
  SwapOutlined,
  TeamOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { useWorkflowStore, type ExecutionLogEntry } from '../../../stores/workflow-store.js';
import { api } from '../../../api/client.js';

const { Text } = Typography;

// 节点类型图标映射
const NODE_TYPE_META: Record<string, { icon: React.ReactNode; label: string }> = {
  input: { icon: <ExportOutlined />, label: '输入' },
  output: { icon: <NodeIndexOutlined />, label: '输出' },
  agent: { icon: <TeamOutlined />, label: 'Agent' },
  router: { icon: <SwapOutlined />, label: '路由' },
  aggregator: { icon: <ApartmentOutlined />, label: '聚合' },
};

// 状态配置
const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  running: { color: '#00d992', icon: <LoadingOutlined spin />, label: '运行中' },
  completed: { color: '#00d992', icon: <CheckCircleOutlined />, label: '已完成' },
  failed: { color: '#fb565b', icon: <CloseCircleOutlined />, label: '失败' },
  pending: { color: '#8b949e', icon: <ClockCircleOutlined />, label: '等待中' },
  skipped: { color: '#595959', icon: <ClockCircleOutlined />, label: '已跳过' },
};

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatCost(cost?: number): string {
  if (cost === undefined || cost === null) return '-';
  return `$${cost.toFixed(4)}`;
}

function getNodeLabel(log: ExecutionLogEntry, nodes: { id: string; data?: Record<string, unknown> }[]): string {
  // 先从 store 的 nodes 里找 label
  const node = nodes.find(n => n.id === log.nodeId);
  if (node?.data) {
    const d = node.data;
    if (d.agentName) return d.agentName as string;
    if (d.label) return d.label as string;
  }
  // 从日志本身的 nodeType 生成
  const meta = NODE_TYPE_META[log.nodeType];
  return meta?.label || log.nodeType;
}

// 单条日志展开详情
function LogDetail({ log }: { log: ExecutionLogEntry }) {
  const items: { key: string; label: string; content: React.ReactNode }[] = [];

  if (log.inputPreview) {
    items.push({
      key: 'input',
      label: '输入',
      content: <pre style={{ margin: 0, fontSize: 11, color: '#b8b3b0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{log.inputPreview}</pre>,
    });
  }
  if (log.outputPreview) {
    items.push({
      key: 'output',
      label: '输出',
      content: <pre style={{ margin: 0, fontSize: 11, color: '#f2f2f2', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{log.outputPreview}</pre>,
    });
  }
  if (log.error) {
    items.push({
      key: 'error',
      label: '错误',
      content: <pre style={{ margin: 0, fontSize: 11, color: '#fb565b', whiteSpace: 'pre-wrap' }}>{log.error}</pre>,
    });
  }
  if (items.length === 0) return null;

  return (
    <div style={{ marginTop: 4, paddingLeft: 4, borderLeft: '2px solid #3d3a39' }}>
      {items.map(item => (
        <div key={item.key} style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 11, color: '#8b949e' }}>{item.label}：</Text>
          <div style={{ background: '#0a0a0c', borderRadius: 4, padding: '4px 8px', marginTop: 2 }}>
            {item.content}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExecutionLogPanel() {
  const {
    showLogPanel, setShowLogPanel,
    executionLogs, setExecutionLogs, addExecutionLog, updateExecutionLog, clearExecutionLogs,
    setExecutionId,
    isRunning, workflowId,
    nodes,
  } = useWorkflowStore();

  // 打开面板时加载最近一次执行日志
  const loadLatestLogs = useCallback(async () => {
    if (!workflowId) return;
    try {
      const logs = await api.get<ExecutionLogEntry[]>(`/workflows/${workflowId}/executions/latest`);
      setExecutionLogs(logs);
      if (logs.length > 0) {
        setExecutionId(logs[0].executionId);
      }
    } catch {
      // 静默处理
    }
  }, [workflowId, setExecutionLogs, setExecutionId]);

  // 打开面板时加载
  useEffect(() => {
    if (showLogPanel && !isRunning && workflowId) {
      loadLatestLogs();
    }
  }, [showLogPanel, isRunning, workflowId, loadLatestLogs]);

  // 监听 WebSocket 事件实时更新日志
  useEffect(() => {
    const handler = (event: Event) => {
      const { type, payload } = (event as CustomEvent).detail;

      if (type === 'workflow:progress' && payload?.status === 'running') {
        // 新执行开始，清空日志
        clearExecutionLogs();
        if (payload.executionId) {
          setExecutionId(payload.executionId);
        }
      }

      if (type === 'workflow:node_start' && payload) {
        const store = useWorkflowStore.getState();
        const node = store.nodes.find(n => n.id === payload.nodeId);
        const nodeData = node?.data as Record<string, unknown> | undefined;
        addExecutionLog({
          id: `live-${payload.nodeId}`,
          workflowId: store.workflowId || '',
          executionId: store.executionId || payload.executionId || '',
          nodeId: payload.nodeId,
          nodeType: payload.nodeType,
          agentId: payload.agentId,
          status: 'running',
          startedAt: Date.now(),
          createdAt: Date.now(),
          nodeLabel: (nodeData?.agentName || nodeData?.label) as string | undefined,
        });
      }

      if (type === 'workflow:node_complete' && payload) {
        const store = useWorkflowStore.getState();
        const node = store.nodes.find(n => n.id === payload.nodeId);
        const nodeData = node?.data as Record<string, unknown> | undefined;
        updateExecutionLog(payload.nodeId, {
          status: 'completed',
          outputPreview: payload.result,
          durationMs: payload.durationMs,
          tokensUsed: payload.tokensUsed,
          cost: payload.cost,
          completedAt: Date.now(),
          nodeLabel: (nodeData?.agentName || nodeData?.label) as string | undefined,
        });
      }
    };

    window.addEventListener('ws:message', handler);
    return () => window.removeEventListener('ws:message', handler);
  }, [addExecutionLog, updateExecutionLog, clearExecutionLogs, setExecutionId]);

  // 计算汇总统计
  const completedCount = executionLogs.filter(l => l.status === 'completed').length;
  const failedCount = executionLogs.filter(l => l.status === 'failed').length;
  const totalTokens = executionLogs.reduce((sum, l) => sum + (l.tokensUsed || 0), 0);
  const totalCost = executionLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
  const totalDuration = executionLogs.reduce((sum, l) => sum + (l.durationMs || 0), 0);

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>执行日志</span>
          {isRunning && <Tag icon={<LoadingOutlined spin />} color="processing">执行中</Tag>}
          {!isRunning && executionLogs.length > 0 && (
            <Tag color="default">{completedCount} 完成 {failedCount > 0 && `/ ${failedCount} 失败`}</Tag>
          )}
        </div>
      }
      placement="bottom"
      height={420}
      open={showLogPanel}
      onClose={() => setShowLogPanel(false)}
      styles={{
        header: { background: '#0a0a0c', borderBottom: '1px solid #3d3a39', padding: '8px 16px' },
        body: { background: '#0a0a0c', padding: 12, overflow: 'auto' },
      }}
      extra={
        executionLogs.length > 0 && (
          <Space size={16} style={{ fontSize: 12 }}>
            <Tooltip title="总耗时">
              <Text style={{ color: '#8b949e' }}>⏱ {formatDuration(totalDuration)}</Text>
            </Tooltip>
            {totalTokens > 0 && (
              <Tooltip title="总 Token">
                <Text style={{ color: '#8b949e' }}>🔤 {totalTokens.toLocaleString()}</Text>
              </Tooltip>
            )}
            {totalCost > 0 && (
              <Tooltip title="总费用">
                <Text style={{ color: '#8b949e' }}>💰 {formatCost(totalCost)}</Text>
              </Tooltip>
            )}
          </Space>
        )
      }
    >
      {executionLogs.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<span style={{ color: '#595959' }}>暂无执行日志</span>}
        />
      ) : (
        <Timeline
          items={executionLogs.map((log) => {
            const statusCfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
            const typeMeta = NODE_TYPE_META[log.nodeType] || { icon: '📦', label: log.nodeType };
            const label = log.nodeLabel || getNodeLabel(log, nodes as { id: string; data?: Record<string, unknown> }[]);

            return {
              color: log.status === 'running' ? 'blue' : log.status === 'failed' ? 'red' : log.status === 'completed' ? 'green' : 'gray',
              children: (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{typeMeta.icon}</span>
                    <Text strong style={{ color: '#f2f2f2', fontSize: 13 }}>{label}</Text>
                    <Tag
                      icon={statusCfg.icon}
                      color={statusCfg.color === '#00d992' ? 'success' : statusCfg.color === '#00d992' ? 'processing' : statusCfg.color === '#fb565b' ? 'error' : 'default'}
                      style={{ fontSize: 11, margin: 0, lineHeight: '18px', padding: '0 4px' }}
                    >
                      {statusCfg.label}
                    </Tag>
                    {log.durationMs !== undefined && (
                      <Text style={{ fontSize: 11, color: '#8b949e' }}>{formatDuration(log.durationMs)}</Text>
                    )}
                    {log.tokensUsed !== undefined && log.tokensUsed > 0 && (
                      <Text style={{ fontSize: 11, color: '#8b949e' }}>{log.tokensUsed.toLocaleString()} tokens</Text>
                    )}
                    {log.cost !== undefined && log.cost > 0 && (
                      <Text style={{ fontSize: 11, color: '#ffba00' }}>{formatCost(log.cost)}</Text>
                    )}
                  </div>
                  <LogDetail log={log} />
                </div>
              ),
            };
          })}
        />
      )}
    </Drawer>
  );
}
