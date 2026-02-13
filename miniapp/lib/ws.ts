import { config } from './config';

export type WSTradeEvent = {
  agentId: string;
  marketId: string;
  side: string;
  outcome: string;
  amount: number;
  price: number;
  timestamp: number;
};

type TradeCallback = (trade: WSTradeEvent) => void;

class CogentWebSocket {
  private ws: WebSocket | null = null;
  private listeners: Set<TradeCallback> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private running = false;

  connect(): void {
    if (this.running) return;
    this.running = true;
    this._connect();
  }

  disconnect(): void {
    this.running = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onTrade(cb: TradeCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private _connect(): void {
    if (!this.running) return;

    try {
      this.ws = new WebSocket(config.WS_URL);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        // Subscribe to trades and markets
        this.ws?.send(JSON.stringify({ type: 'subscribe', channels: ['markets'] }));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'trade_event' && msg.data) {
            const trade = msg.data as WSTradeEvent;
            for (const cb of this.listeners) {
              cb(trade);
            }
          }
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this._scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this._scheduleReconnect();
    }
  }

  private _scheduleReconnect(): void {
    if (!this.running || this.reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, delay);
  }
}

export const cogentWS = new CogentWebSocket();
