import { useEffect, useRef, useCallback, useState } from 'react';

export function useWebSocket(path = '/ws/feed') {
  const wsRef = useRef<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}${path}`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => { setConnected(false); setTimeout(connect, 3000); };
    ws.onmessage = (e) => { try { setLastMessage(JSON.parse(e.data)); } catch {} };
    wsRef.current = ws;
  }, [path]);

  useEffect(() => { connect(); return () => wsRef.current?.close(); }, [connect]);

  return { lastMessage, connected };
}
