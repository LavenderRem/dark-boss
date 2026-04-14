import { Button, Space, Tooltip, Tag } from 'antd';
import {
  SaveOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ApartmentOutlined,
  PlusOutlined,
  EyeOutlined,
  LoadingOutlined,
  FileSearchOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';

interface FlowToolbarProps {
  onSave: () => void;
  onRun: () => void;
  onPause: () => void;
  onAutoLayout: () => void;
  onAddWorkflow: () => void;
  onViewResult: () => void;
  onToggleLogPanel: () => void;
  isRunning?: boolean;
  isDirty?: boolean;
  workflowName?: string;
}

export function FlowToolbar({
  onSave,
  onRun,
  onPause,
  onAutoLayout,
  onAddWorkflow,
  onViewResult,
  onToggleLogPanel,
  isRunning,
  isDirty,
  workflowName,
}: FlowToolbarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      background: '#1a1a1a',
      borderBottom: '1px solid #303030',
    }}>
      {/* 左侧：返回按钮 + 工作流名称 + 运行状态 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <Tooltip title="返回列表">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onAddWorkflow} size="small" style={{ color: '#8c8c8c' }} />
        </Tooltip>
        <span style={{ color: '#e8e8e8', fontWeight: 600, fontSize: 14 }}>
          {workflowName || '未命名工作流'}
        </span>
        {isDirty && <span style={{ color: '#faad14', fontSize: 11 }}>(未保存)</span>}
        {isRunning && (
          <Tag icon={<LoadingOutlined spin />} color="processing" style={{ fontSize: 11, margin: 0 }}>
            执行中
          </Tag>
        )}
      </div>

      {/* 右侧：操作按钮 */}
      <Space size={4}>
        <Tooltip title="新建工作流">
          <Button type="text" icon={<PlusOutlined />} onClick={onAddWorkflow} size="small" style={{ color: '#8c8c8c' }} />
        </Tooltip>
        <Tooltip title="保存 (Ctrl+S)">
          <Button type="text" icon={<SaveOutlined />} onClick={onSave} size="small" />
        </Tooltip>
        <div style={{ width: 1, height: 20, background: '#303030', margin: '0 4px' }} />
        <Tooltip title="自动布局">
          <Button type="text" icon={<ApartmentOutlined />} onClick={onAutoLayout} size="small" />
        </Tooltip>
        <div style={{ width: 1, height: 20, background: '#303030', margin: '0 4px' }} />
        <Tooltip title="查看结果">
          <Button type="text" icon={<EyeOutlined />} onClick={onViewResult} size="small" />
        </Tooltip>
        <Tooltip title="执行日志">
          <Button type="text" icon={<FileSearchOutlined />} onClick={onToggleLogPanel} size="small" />
        </Tooltip>
        <div style={{ width: 1, height: 20, background: '#303030', margin: '0 4px' }} />
        {isRunning ? (
          <Tooltip title="暂停执行">
            <Button type="text" icon={<PauseCircleOutlined />} onClick={onPause} size="small" danger />
          </Tooltip>
        ) : (
          <Tooltip title="执行工作流">
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={onRun} size="small" />
          </Tooltip>
        )}
      </Space>
    </div>
  );
}
