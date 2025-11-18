/**
 * WebSocket Service
 * 
 * Manages WebSocket connections for real-time server logs.
 * Supports subscription pattern for multiple consumers.
 */

// Construct WebSocket URL - add /api/ws path if not already present
function getWebSocketUrl(): string {
  const isProduction = import.meta.env.VITE_PRODUCTION === 'true';
  const baseUrl = import.meta.env.VITE_WS_URL || (isProduction ? 'wss://backend.bovisgl.xyz' : 'ws://localhost:3001');
  // Remove trailing slash if present
  const cleanUrl = baseUrl.replace(/\/$/, '');
  // Add /api/ws path
  return cleanUrl.includes('/api/ws') ? cleanUrl : `${cleanUrl}/api/ws`;
}

const WS_URL = getWebSocketUrl();

type EventHandler = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;

  /**
   * Connect to WebSocket server
   */
  connect(): WebSocketService {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this;
    }

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { event: eventName, ...payload } = data;
          
          const handlers = this.handlers.get(eventName);
          if (handlers) {
            handlers.forEach(handler => handler(payload));
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
    }

    return this;
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`[WebSocket] Reconnecting (attempt ${this.reconnectAttempts})...`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  /**
   * Subscribe to an event
   */
  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, handler: EventHandler) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * Subscribe to a channel (send subscribe message)
   */
  subscribe(channel: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'subscribe', channel }));
    }
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'unsubscribe', channel }));
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const websocketService = new WebSocketService();
