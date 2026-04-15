/**
 * WebSocket 连接 Hook
 * 提供全局 WebSocket 单例连接，组件可订阅消息
 */
import { useEffect, useRef, useCallback } from 'react';

type WsListener = (msg: { type: string; payload: unknown }) => void;

// 全局单例
let ws: WebSocket | null = null;
let listeners: WsListener[] = [];

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.hostname}:3000/ws`);

  ws.onopen = () => {
    console.log('[WS] 已连接');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      for (const fn of listeners) {
        fn(msg);
      }
    } catch { /* 忽略解析错误 */ }
  };

  ws.onclose = () => {
    console.log('[WS] 连接关闭，3秒后重连');
    ws = null;
    setTimeout(connect, 3000);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function send(msg: { type: string; payload: unknown }) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    connect();
    // 等待连接后发送
    ws?.addEventListener('open', () => {
      ws?.send(JSON.stringify(msg));
    }, { once: true });
  }
}

/**
 * WebSocket 消息订阅 Hook
 */
export function useWsMessage(handler: WsListener) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrapped: WsListener = (msg) => handlerRef.current(msg);
    listeners.push(wrapped);
    connect();

    return () => {
      listeners = listeners.filter(l => l !== wrapped);
    };
  }, []);
}

/**
 * WebSocket 发送消息
 */
export function useWsSend() {
  return useCallback((type: string, payload: unknown) => {
    send({ type, payload });
  }, []);
}
