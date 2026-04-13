import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { WsMessage } from '@dark-boss/shared';
import { handleAgentMention, interruptAgentReply } from '../services/chat-agent-service.js';

// 已连接的客户端
const clients = new Set<WebSocket>();

// 创建 WebSocket 服务器
export function createWsServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] 客户端连接，当前连接数: ${clients.size}`);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsMessage;
        handleClientMessage(ws, msg);
      } catch {
        console.warn('[WS] 收到无效消息');
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] 客户端断开，当前连接数: ${clients.size}`);
    });
  });

  return wss;
}

// 处理客户端消息
function handleClientMessage(_ws: WebSocket, msg: WsMessage) {
  switch (msg.type) {
    case 'agent:subscribe':
    case 'agent:unsubscribe':
      // 订阅/取消订阅 Agent 输出
      console.log(`[WS] 收到 ${msg.type}，payload:`, JSON.stringify(msg.payload).slice(0, 100));
      break;
    case 'agent:message': {
      // 处理发送给 Agent 的消息（通过 WebSocket 触发回复）
      const payload = msg.payload as {
        channelId: string;
        content: string;
        mentionsAgentIds?: string[];
      };
      if (payload.mentionsAgentIds && payload.mentionsAgentIds.length > 0) {
        handleAgentMention(payload.channelId, payload.mentionsAgentIds, payload.content);
      }
      break;
    }
    case 'agent:interrupt': {
      // 中断 Agent 回复
      const payload = msg.payload as { agentId: string };
      if (payload.agentId) {
        interruptAgentReply(payload.agentId);
      }
      break;
    }
    case 'workflow:execute':
    case 'workflow:pause':
      // 后续接入工作流执行引擎时实现
      console.log(`[WS] 收到 ${msg.type}，payload:`, JSON.stringify(msg.payload).slice(0, 100));
      break;
    default:
      console.log(`[WS] 未知消息类型: ${msg.type}`);
  }
}

// 向所有客户端广播消息
export function broadcast<T extends string>(type: T, payload: unknown) {
  const message: WsMessage<T> = {
    type,
    payload,
    timestamp: Date.now(),
  };
  const data = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
