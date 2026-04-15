/**
 * 上下文窗口使用量仪表盘
 * 环形进度条显示上下文使用百分比
 */
import { useQuery } from '@tanstack/react-query';
import { Tooltip, Space, Typography } from 'antd';
import { api } from '../../api/client.js';

interface ContextMeterProps {
  agentId: string;
  /** 尺寸 */
  size?: number;
  /** 是否显示文字标签 */
  showLabel?: boolean;
}

interface ContextInfo {
  agentId: string;
  model: string;
  maxTokens: number;
  usedTokens: number;
  usagePercent: number;
  status: 'green' | 'yellow' | 'red';
  totalTokensUsed: number;
}

export function ContextMeter({ agentId, size = 40, showLabel = true }: ContextMeterProps) {
  const { data } = useQuery({
    queryKey: ['agent-context', agentId],
    queryFn: () => api.get<ContextInfo>(`/agents/${agentId}/context`),
    refetchInterval: 10000,
    enabled: !!agentId,
  });

  const percent = data?.usagePercent ?? 0;
  const status = data?.status ?? 'green';

  // 环形进度条颜色
  const colors: Record<string, { stroke: string; bg: string; text: string }> = {
    green: { stroke: '#52c41a', bg: '#1a3a1a', text: '#52c41a' },
    yellow: { stroke: '#faad14', bg: '#3a3a1a', text: '#faad14' },
    red: { stroke: '#ff4d4f', bg: '#3a1a1a', text: '#ff4d4f' },
  };

  const color = colors[status];
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percent / 100) * circumference;

  const formatTokens = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  const tooltipContent = data ? [
    `模型: ${data.model}`,
    `上下文使用: ${formatTokens(data.usedTokens)} / ${formatTokens(data.maxTokens)}`,
    `使用率: ${data.usagePercent}%`,
    `总 Token: ${formatTokens(data.totalTokensUsed)}`,
  ].join('\n') : '加载中...';

  return (
    <Tooltip title={<pre style={{ margin: 0, fontFamily: 'inherit', fontSize: 12 }}>{tooltipContent}</pre>}>
      <Space size={6} align="center">
        <div style={{ position: 'relative', width: size, height: size }}>
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            {/* 背景圆 */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color.bg}
              strokeWidth={3}
            />
            {/* 进度圆 */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color.stroke}
              strokeWidth={3}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          {/* 百分比文字（HTML 层叠在 SVG 上方） */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size < 40 ? 9 : 11,
            color: color.text,
            fontWeight: 600,
            pointerEvents: 'none',
          }}>
            {Math.round(percent)}%
          </div>
        </div>
        {showLabel && (
          <Typography.Text style={{ color: color.text, fontSize: 11 }}>
            上下文
          </Typography.Text>
        )}
      </Space>
    </Tooltip>
  );
}
