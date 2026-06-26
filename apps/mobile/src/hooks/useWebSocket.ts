import { useEffect, useRef, useCallback } from 'react';

type WSMessage = {
  type: string;
  payload?: unknown;
  session_id?: string;
  timestamp?: number;
};

interface UseWebSocketOptions {
  onMessage: (msg: WSMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
}

/**
 * useWebSocket — 封装 WebSocket 连接管理
 * 自动处理连接建立、消息解析、清理
 */
export function useWebSocket(url: string | null, options: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback((wsUrl: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      optionsRef.current.onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data as string);
        optionsRef.current.onMessage(msg);
      } catch {
        console.warn('[useWebSocket] Failed to parse message:', event.data);
      }
    };

    ws.onclose = () => {
      optionsRef.current.onClose?.();
    };

    ws.onerror = (event) => {
      optionsRef.current.onError?.(event as Event);
    };
  }, []);

  const send = useCallback((data: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      console.warn('[useWebSocket] Cannot send, WebSocket not open');
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  // 当 url 变化时自动连接
  useEffect(() => {
    if (url) {
      connect(url);
    }
    return () => {
      wsRef.current?.close();
    };
  }, [url, connect]);

  return { send, disconnect, connect };
}

