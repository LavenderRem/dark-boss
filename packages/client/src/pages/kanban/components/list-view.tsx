import { Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { Task, Agent } from '@dark-boss/shared';
import { AGENT_ROLES } from '@dark-boss/shared';

interface ListViewProps {
  tasks: Task[];
  agents: Agent[];
  onTaskClick: (task: Task, event?: React.MouseEvent) => void;
  selectedTaskIds: Set<string>;
}

export function ListView({ tasks, agents, onTaskClick, selectedTaskIds }: ListViewProps) {
  const getAgentName = (agentId: string | null) => {
    if (!agentId) return '-';
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return '-';
    const roleInfo = AGENT_ROLES[agent.role] || AGENT_ROLES.custom;
    return `${roleInfo.icon} ${agent.name}`;
  };

  const priorityConfig: Record<string, { color: string; label: string }> = {
    critical: { color: '#fb565b', label: '紧急' },
    high: { color: '#ffba00', label: '高' },
    medium: { color: '#4cb3d4', label: '中' },
    low: { color: '#8b949e', label: '低' },
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    backlog: { color: '#8b949e', label: '待规划' },
    todo: { color: '#00d992', label: '待办' },
    in_progress: { color: '#ffba00', label: '进行中' },
    review: { color: '#722ed1', label: '审核中' },
    done: { color: '#00d992', label: '已完成' },
  };

  const taskTypeConfig: Record<string, string> = {
    epic: 'EPIC',
    story: 'STORY',
    task: 'TASK',
    subtask: 'SUBTASK',
  };

  const columns: ColumnsType<Task> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      render: (text: string, record: Task) => (
        <div
          style={{
            cursor: 'pointer',
            padding: selectedTaskIds.has(record.id) ? '4px 8px' : undefined,
            border: selectedTaskIds.has(record.id) ? '1px solid #00d992' : undefined,
            borderRadius: selectedTaskIds.has(record.id) ? 4 : undefined,
          }}
          onClick={(e) => onTaskClick(record, e)}
        >
          <div style={{ color: '#f2f2f2', fontWeight: 500 }}>{text}</div>
          {record.description && (
            <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>
              {record.description.slice(0, 50)}
              {record.description.length > 50 ? '...' : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'taskType',
      key: 'taskType',
      width: 100,
      render: (type: string) => (
        <Tag style={{ fontSize: 11, border: 'none', background: '#3d3a39', color: '#b8b3b0' }}>
          {taskTypeConfig[type] || 'TASK'}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (priority: string) => {
        const config = priorityConfig[priority];
        return (
          <Tag style={{ fontSize: 11, border: 'none', background: config.color + '20', color: config.color }}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '负责人',
      dataIndex: 'assignedAgentId',
      key: 'assignedAgentId',
      width: 150,
      render: (agentId: string | null) => (
        <span style={{ fontSize: 13 }}>{getAgentName(agentId)}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const config = statusConfig[status];
        return (
          <Tag style={{ fontSize: 11, border: 'none', background: config.color + '20', color: config.color }}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '截止时间',
      dataIndex: 'dueAt',
      key: 'dueAt',
      width: 130,
      render: (dueAt: number | null) => {
        if (!dueAt) return <span style={{ color: '#8b949e' }}>-</span>;
        const isOverdue = dueAt < Date.now();
        return (
          <span style={{ color: isOverdue ? '#fb565b' : '#b8b3b0', fontSize: 13 }}>
            {dayjs(dueAt).format('YYYY-MM-DD')}
          </span>
        );
      },
    },
  ];

  return (
    <div style={{ background: '#101010', borderRadius: 8, padding: 16 }}>
      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        pagination={{ pageSize: 20, showSizeChanger: false }}
        style={{ background: 'transparent' }}
        rowClassName={() => 'custom-table-row'}
        onRow={(record) => ({
          onClick: (e) => onTaskClick(record, e),
          style: {
            cursor: 'pointer',
            borderBottom: '1px solid #3d3a39',
            background: selectedTaskIds.has(record.id) ? 'rgba(0, 217, 146, 0.05)' : 'transparent',
          },
        })}
      />
      <style>{`
        .custom-table-row:hover {
          background: #0a0a0c !important;
        }
        .custom-table-row td {
          background: transparent !important;
          border-bottom: 1px solid #3d3a39;
          color: #f2f2f2;
        }
        .ant-table-thead > tr > th {
          background: #101010 !important;
          color: #b8b3b0 !important;
          border-bottom: 1px solid #3d3a39;
          font-weight: 600;
        }
        .ant-pagination-item {
          background: #101010 !important;
          border-color: #3d3a39 !important;
        }
        .ant-pagination-item a {
          color: #b8b3b0 !important;
        }
        .ant-pagination-item-active {
          background: #00d992 !important;
          border-color: #00d992 !important;
        }
        .ant-pagination-item-active a {
          color: #050507 !important;
        }
        .ant-pagination-prev,
        .ant-pagination-next {
          background: #101010 !important;
          border-color: #3d3a39 !important;
        }
        .ant-pagination-prev button,
        .ant-pagination-next button {
          color: #b8b3b0 !important;
        }
      `}</style>
    </div>
  );
}
