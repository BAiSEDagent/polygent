import { useEffect, useRef } from 'react';
import { useDashboardStore } from '../store/dashboard';
import io from 'socket.io-client';

export function useWebSocket() {
  const socketRef = useRef<any>(null);
  const { setConnected, updateAgent } = useDashboardStore();
  
  useEffect(() => {
    // Connect to VPS WebSocket
    const socket = io('http://72.61.138.205:3000', {
      transports: ['websocket'],
      reconnection: true,
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      setConnected(true);
      console.log('Connected to Polygent VPS');
    });
    
    socket.on('disconnect', () => {
      setConnected(false);
    });
    
    // Listen for agent updates
    socket.on('agent:update', (data) => {
      updateAgent(data.id, data);
    });
    
    // Listen for new trades
    socket.on('trade:new', (trade) => {
      console.log('New trade:', trade);
    });
    
    return () => {
      socket.disconnect();
    };
  }, [setConnected, updateAgent]);
  
  return socketRef.current;
}