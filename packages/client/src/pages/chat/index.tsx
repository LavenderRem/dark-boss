import { useState, useRef, useEffect, useMemo } from 'react';
import { Card, Input, Button, Typography, Space, Avatar, Tag, Modal, Form, Select, message, Empty } from 'antd';
import {
  SendOutlined,
  PlusOutlined,
  MessageOutlined,
  TeamOutlined,
  UserOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import type { Agent } from '@dark-boss/shared';
import { AGENT_ROLES } from '@dark-boss/shared';
import { MarkdownRenderer } from '../../components/chat/markdown-renderer.js';
import { StreamingMessage } from '../../components/chat/streaming-message.js';

const { Title, Text } = Typography;

interface ChatChannel {
  id: string;
  name: string;
  type: 'team' | 'direct' | 'department';
  department_id: string | null;
  participant_agent_ids: string[] | null;
  created_at: number;
}

interface ChatMessage {
  id: string;
  channel_id: string;
  sender_type: 'user' | 'agent' | 'system';
  sender_agent_id: string | null;
  content: string;
  mentions_agent_ids: string[] | null;
  message_type: 'text' | 'system' | 'markdown';
  created_at: number;
}

const CHANNEL_TYPE_MAP: Record<string, { icon: React.ReactNode; color: string }> = {
  team: { icon: <TeamOutlined />, color: '#1890ff' },
  direct: { icon: <UserOutlined />, color: '#52c41a' },
  department: { icon: <MessageOutlined />, color: '#722ed1' },
};

// WebSocket 单例
let ws: WebSocket | null = null;
let wsListeners: Array<(msg: { type: string; payload: unknown }) => void> = [];

function connectWs() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.hostname}:3000/ws`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      wsListeners.forEach(fn => fn(msg));
    } catch { /* ignore */ }
  };

  ws.onclose = () => {
    // 3 秒后重连
    setTimeout(connectWs, 3000);
  };
}

function onWsMessage(fn: (msg: { type: string; payload: unknown }) => void) {
  wsListeners.push(fn);
  connectWs();
  return () => {
    wsListeners = wsListeners.filter(l => l !== fn);
  };
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// 处理 @提及 高亮
function renderContent(content: string, agents: Agent[]) {
  const parts: React.ReactNode[] = [];
  const regex = /@(\S+)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{content.slice(lastIndex, match.index)}</span>);
    }
    const agentName = match[1];
    const agent = agents.find(a => a.name === agentName);
    parts.push(
      <Tag key={key++} color={agent ? 'blue' : 'default'} style={{ fontSize: 13, margin: '0 2px' }}>
        @{agentName}
      </Tag>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(<span key={key++}>{content.slice(lastIndex)}</span>);
  }
  return parts;
}

export function ChatPage() {
  const queryClient = useQueryClient();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [streamingAgentId, setStreamingAgentId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: channels = [] } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get<ChatChannel[]>('/chat/channels'),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get<Agent[]>('/agents'),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedChannel],
    queryFn: () => api.get<ChatMessage[]>(`/chat/channels/${selectedChannel}/messages?limit=100`),
    enabled: !!selectedChannel,
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({ channelId, content, mentionsAgentIds }: { channelId: string; content: string; mentionsAgentIds?: string[] }) =>
      api.post(`/chat/channels/${channelId}/messages`, {
        content,
        senderType: 'user',
        mentionsAgentIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedChannel] });
      setMessageInput('');
    },
    onError: (err: Error) => message.error(err.message),
  });

  const createChannelMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/chat/channels', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setCreateModalOpen(false);
      form.resetFields();
      message.success('频道创建成功');
    },
    onError: (err: Error) => message.error(err.message),
  });

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket 实时接收新消息 + Agent 流式回复
  useEffect(() => {
    const unsub = onWsMessage((msg) => {
      if (msg.type === 'chat:message') {
        const payload = msg.payload as { channelId?: string; messageId?: string };
        if (payload.channelId === selectedChannel) {
          queryClient.invalidateQueries({ queryKey: ['messages', selectedChannel] });
        }
      }
      // Agent 开始流式回复
      if (msg.type === 'agent:output') {
        const payload = msg.payload as { agentId?: string; channelId?: string };
        if (payload.channelId === selectedChannel && payload.agentId) {
          setStreamingAgentId(payload.agentId);
        }
      }
      // Agent 回复完成
      if (msg.type === 'agent:complete') {
        const payload = msg.payload as { agentId?: string };
        if (payload.agentId === streamingAgentId) {
          // 延迟清除流式状态，等待最终消息通过 chat:message 到达
          setTimeout(() => setStreamingAgentId(null), 500);
        }
      }
      if (msg.type === 'agent:error') {
        setStreamingAgentId(null);
      }
    });
    return unsub;
  }, [selectedChannel, queryClient, streamingAgentId]);

  // 提取 @提及 的 agent ids
  const extractMentions = (text: string): string[] => {
    const regex = /@(\S+)/g;
    const mentions: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const agent = agents.find(a => a.name === match![1]);
      if (agent) mentions.push(agent.id);
    }
    return [...new Set(mentions)];
  };

  const handleSend = () => {
    if (!messageInput.trim() || !selectedChannel) return;
    const mentions = extractMentions(messageInput);
    sendMessageMutation.mutate({
      channelId: selectedChannel,
      content: messageInput.trim(),
      mentionsAgentIds: mentions.length > 0 ? mentions : undefined,
    });
  };

  const handleCreateChannel = () => {
    form.validateFields().then(values => {
      createChannelMutation.mutate({
        name: values.name,
        type: values.type || 'team',
        departmentId: values.departmentId,
        participantAgentIds: values.participantAgentIds,
      });
    });
  };

  const currentChannel = channels.find(c => c.id === selectedChannel);
  const channelParticipants = useMemo(() => {
    if (!currentChannel?.participant_agent_ids) return [];
    return agents.filter(a => currentChannel.participant_agent_ids!.includes(a.id));
  }, [currentChannel, agents]);

  return (
    <div style={{ display: 'flex', gap: 12, height: '100%' }}>
      {/* 左侧：频道列表 */}
      <Card
        title={
          <Space>
            <MessageOutlined />
            <span style={{ color: '#e8e8e8' }}>频道</span>
          </Space>
        }
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建
          </Button>
        }
        style={{ width: 280, background: '#1f1f1f', flexShrink: 0 }}
        styles={{ body: { padding: '4px 0', overflow: 'auto', maxHeight: 'calc(100vh - 180px)' } }}
      >
        {channels.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#595959' }}>
            暂无频道
          </div>
        ) : (
          channels.map(channel => {
            const typeInfo = CHANNEL_TYPE_MAP[channel.type] || CHANNEL_TYPE_MAP.team;
            const isActive = selectedChannel === channel.id;
            return (
              <div
                key={channel.id}
                onClick={() => setSelectedChannel(channel.id)}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  background: isActive ? '#1890ff22' : 'transparent',
                  borderRight: isActive ? '2px solid #1890ff' : '2px solid transparent',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: typeInfo.color }}>{typeInfo.icon}</span>
                  <Text style={{ color: isActive ? '#e8e8e8' : '#bfbfbf', fontWeight: isActive ? 600 : 400 }}>
                    {channel.name}
                  </Text>
                </div>
                {channel.participant_agent_ids && (
                  <div style={{ marginTop: 4, marginLeft: 24, fontSize: 11, color: '#595959' }}>
                    {channel.participant_agent_ids.length} 名成员
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>

      {/* 右侧：聊天区域 */}
      <Card
        style={{ flex: 1, background: '#1f1f1f', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' } }}
      >
        {selectedChannel ? (
          <>
            {/* 频道头部 */}
            <div style={{
              padding: '12px 20px',
              borderBottom: '1px solid #303030',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Space>
                <span style={{ color: CHANNEL_TYPE_MAP[currentChannel?.type || 'team'].color }}>
                  {CHANNEL_TYPE_MAP[currentChannel?.type || 'team'].icon}
                </span>
                <Title level={5} style={{ color: '#e8e8e8', margin: 0 }}>{currentChannel?.name}</Title>
              </Space>
              <Space>
                {channelParticipants.length > 0 && (
                  <Text style={{ color: '#8c8c8c', fontSize: 12 }}>
                    {channelParticipants.map(a => a.name).join(', ')}
                  </Text>
                )}
              </Space>
            </div>

            {/* 消息列表 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
              {messages.length === 0 ? (
                <Empty
                  description={<span style={{ color: '#595959' }}>暂无消息，发送第一条吧</span>}
                  style={{ marginTop: 60 }}
                />
              ) : (
                messages.map(msg => {
                  const senderAgent = msg.sender_agent_id
                    ? agents.find(a => a.id === msg.sender_agent_id)
                    : null;
                  const isUser = msg.sender_type === 'user';
                  const isSystem = msg.sender_type === 'system';

                  if (isSystem) {
                    return (
                      <div key={msg.id} style={{ textAlign: 'center', margin: '12px 0' }}>
                        <Text style={{ color: '#595959', fontSize: 12 }}>{msg.content}</Text>
                      </div>
                    );
                  }

                  const roleInfo = senderAgent ? (AGENT_ROLES[senderAgent.role] || AGENT_ROLES.custom) : null;

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        gap: 10,
                        marginBottom: 16,
                        flexDirection: isUser ? 'row-reverse' : 'row',
                      }}
                    >
                      <Avatar
                        size={36}
                        style={{
                          background: isUser ? '#1890ff' : (roleInfo?.color || '#52c41a'),
                          flexShrink: 0,
                        }}
                        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
                      >
                        {!isUser && senderAgent?.name?.[0]}
                      </Avatar>
                      <div style={{ maxWidth: '70%' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 4,
                          flexDirection: isUser ? 'row-reverse' : 'row',
                        }}>
                          <Text style={{ color: '#bfbfbf', fontSize: 13, fontWeight: 500 }}>
                            {isUser ? '你' : senderAgent?.name || '未知'}
                          </Text>
                          <Text style={{ color: '#595959', fontSize: 11 }}>{formatTime(msg.created_at)}</Text>
                        </div>
                        <div style={{
                          background: isUser ? '#1890ff22' : '#2a2a2a',
                          borderRadius: 8,
                          padding: '8px 14px',
                          color: '#e8e8e8',
                          fontSize: 14,
                          lineHeight: 1.6,
                          wordBreak: 'break-word',
                        }}>
                          {msg.message_type === 'markdown' || (msg.sender_type === 'agent' && msg.message_type !== 'system')
                            ? <MarkdownRenderer content={msg.content} />
                            : renderContent(msg.content, agents)
                          }
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {/* 流式回复中的 Agent 消息 */}
              {streamingAgentId && selectedChannel && (
                <StreamingMessage
                  agentId={streamingAgentId}
                  agents={agents}
                  onWsMessage={onWsMessage}
                />
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #303030',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end',
            }}>
              <Input.TextArea
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                onPressEnter={e => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="输入消息，@员工名 提及...（Shift+Enter 换行）"
                autoSize={{ minRows: 1, maxRows: 4 }}
                style={{ background: '#2a2a2a', color: '#e8e8e8', borderColor: '#303030' }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={sendMessageMutation.isPending}
              >
                发送
              </Button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty
              image={<MessageOutlined style={{ fontSize: 48, color: '#303030' }} />}
              description={<span style={{ color: '#595959' }}>选择一个频道开始聊天</span>}
            />
          </div>
        )}
      </Card>

      {/* 创建频道弹窗 */}
      <Modal
        title="新建频道"
        open={createModalOpen}
        onOk={handleCreateChannel}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        confirmLoading={createChannelMutation.isPending}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" initialValues={{ type: 'team' }}>
          <Form.Item name="name" label="频道名称" rules={[{ required: true, message: '请输入频道名称' }]}>
            <Input placeholder="频道名称" />
          </Form.Item>
          <Form.Item name="type" label="类型">
            <Select>
              <Select.Option value="team">团队频道</Select.Option>
              <Select.Option value="direct">私聊</Select.Option>
              <Select.Option value="department">部门频道</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="participantAgentIds" label="参与成员">
            <Select mode="multiple" placeholder="选择参与成员">
              {agents.map(a => {
                const roleInfo = AGENT_ROLES[a.role] || AGENT_ROLES.custom;
                return (
                  <Select.Option key={a.id} value={a.id}>
                    {roleInfo.icon} {a.name}
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
