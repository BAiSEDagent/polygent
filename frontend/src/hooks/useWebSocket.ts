import { useEffect, useRef, useState, useCallback } from 'react';

export interface WSEvent {
  type: string;
  data?: any;
}

export function useWebSocket(channels: string[] = ['trades', 'markets']) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<WSEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/feed`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'subscribe', channels }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        setEvents(prev => [msg, ...prev].slice(0, 200));
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [channels]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);

  return { connected, events };
}
