import { useState } from 'react';
import { Badge, Popover, List, Typography, Button, Empty, Spin } from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  UserAddOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  CommentOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client.js';
import type { Notification } from '@dark-boss/shared';
import { useWsMessage } from '../../../hooks/use-ws.js';

const { Text } = Typography;

// 通知类型配置
const NOTIFICATION_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  task_assigned: {
    icon: <UserAddOutlined style={{ color: '#00d992' }} />,
    label: '任务分配',
  },
  task_completed: {
    icon: <CheckCircleOutlined style={{ color: '#00d992' }} />,
    label: '任务完成',
  },
  task_overdue: {
    icon: <WarningOutlined style={{ color: '#fb565b' }} />,
    label: '任务逾期',
  },
  task_blocked: {
    icon: <WarningOutlined style={{ color: '#fb565b' }} />,
    label: '任务阻塞',
  },
  task_due_soon: {
    icon: <ClockCircleOutlined style={{ color: '#ffba00' }} />,
    label: '即将到期',
  },
  task_handoff: {
    icon: <UserAddOutlined style={{ color: '#4cb3d4' }} />,
    label: '任务交接',
  },
  agent_mentioned: {
    icon: <CommentOutlined style={{ color: '#4cb3d4' }} />,
    label: '新提及',
  },
  permission_request: {
    icon: <InfoCircleOutlined style={{ color: '#ffba00' }} />,
    label: '权限请求',
  },
  system: {
    icon: <InfoCircleOutlined style={{ color: '#8b949e' }} />,
    label: '系统通知',
  },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // 获取未读数量
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count').then(r => r.count),
    refetchInterval: 30000,
  });

  // 获取通知列表
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notification[]>('/notifications?limit=50'),
    enabled: open,
  });

  // 标记已读
  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch<void>(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  // 全部已读
  const markAllReadMutation = useMutation({
    mutationFn: () => api.post<void>('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  // 监听新通知
  useWsMessage((msg) => {
    if (msg.type === 'notification:new') {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    }
  });

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return new Date(timestamp).toLocaleDateString('zh-CN');
  };

  const content = (
    <div style={{ width: 380 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #3d3a39',
      }}>
        <Text style={{ color: '#f2f2f2', fontWeight: 500 }}>通知</Text>
        {notifications.length > 0 && (
          <Button
            type="text"
            size="small"
            icon={<CheckOutlined />}
            onClick={handleMarkAllRead}
            loading={markAllReadMutation.isPending}
            style={{ color: '#00d992' }}
          >
            全部已读
          </Button>
        )}
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : notifications.length === 0 ? (
          <Empty
            description="暂无通知"
            style={{ padding: 40 }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(item: Notification) => {
              const config = NOTIFICATION_CONFIG[item.type] || NOTIFICATION_CONFIG.system;
              return (
                <List.Item
                  key={item.id}
                  style={{
                    padding: '12px 16px',
                    background: item.read ? 'transparent' : '#0a0a0c',
                    borderBottom: '1px solid #1f1f1f',
                    cursor: 'pointer',
                  }}
                  onClick={() => !item.read && markReadMutation.mutate(item.id)}
                >
                  <List.Item.Meta
                    avatar={config.icon}
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: '#f2f2f2', fontSize: 13 }}>
                          {item.message}
                        </Text>
                        {!item.read && (
                          <Badge
                            status="processing"
                            style={{ marginLeft: 4 }}
                          />
                        )}
                      </div>
                    }
                    description={
                      <div>
                        {item.detail && (
                          <Text style={{ color: '#8b949e', fontSize: 12, display: 'block' }}>
                            {item.detail}
                          </Text>
                        )}
                        <Text style={{ color: '#595959', fontSize: 11 }}>
                          {formatTime(item.createdAt)}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      overlayStyle={{ padding: 0 }}
    >
      <Badge count={unreadCount} size="small" offset={[-4, 4]}>
        <BellOutlined
          style={{
            fontSize: 16,
            color: '#8b949e',
            cursor: 'pointer',
            padding: 4,
          }}
        />
      </Badge>
    </Popover>
  );
}
