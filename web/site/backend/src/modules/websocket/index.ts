/**
 * WebSocket Server for Real-Time Updates
 * Handles server status, player data, and game state updates
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Request } from 'express';

export interface ServerStatusUpdate {
  serverId: string;
  status: 'online' | 'offline' | 'starting' | 'stopping' | 'disabled';
  playerCount?: number;
  maxPlayers?: number;
  version?: string;
  uptime?: number;
  crashReason?: string;
  timestamp: number;
}

export interface PlayerUpdate {
  uuid: string;
  name: string;
  online: boolean;
  currentServer: string | null;
  currentClient: string | null;
  lastActiveTs: number;
  clients: string[];
  lastJoinTs?: number | null;
  lastJoinClient?: string | null;
  lastLeaveTs?: number | null;
  lastLeaveClient?: string | null;
  lastSeen?: string | null;
}

export interface ServerLogEntry {
  serverId: string;
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
}

export interface WebSocketMessage {
  type: 'server-status' | 'player-update' | 'players-batch' | 'server-batch' | 'server-log' | 'ban-update' | 'ping' | 'pong' | 'subscribe' | 'unsubscribe';
  data?: any;
  timestamp?: number;
}

interface ClientSubscriptions {
  channels: Set<string>;
  ws: WebSocket;
  isAlive: boolean;
}

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientSubscriptions> = new Map();
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize WebSocket server on HTTP server
   */
  public initialize(server: HTTPServer): void {
    this.wss = new WebSocketServer({ server, path: '/api/ws' });

    this.wss.on('connection', (ws: WebSocket, req: Request) => {
      console.log('🔗 WebSocket client connected');

      // Initialize client subscriptions
      this.clients.set(ws, {
        channels: new Set(),
        ws,
        isAlive: true
      });

      // Handle incoming messages
      ws.on('message', (data: Buffer | string) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      // Handle pong response (keep-alive check)
      ws.on('pong', () => {
        const client = this.clients.get(ws);
        if (client) {
          client.isAlive = true;
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
        this.clients.delete(ws);
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
      });

      // Send initial connection message
      this.send(ws, { type: 'ping', timestamp: Date.now() });
    });

    // Start ping interval to keep connections alive
    this.startPingInterval();

    console.log('✅ WebSocket server initialized on /api/ws');
  }

  /**
   * Broadcast a message to all clients subscribed to a channel
   */
  public broadcast(channel: string, message: WebSocketMessage): void {
    this.clients.forEach((client) => {
      if (client.channels.has(channel)) {
        this.send(client.ws, message);
      }
    });
  }

  /**
   * Send a message to a specific client
   */
  public send(ws: WebSocket, message: WebSocketMessage): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ ...message, timestamp: Date.now() }));
      }
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
    }
  }

  /**
   * Send server status update to subscribed clients
   */
  public broadcastServerStatus(update: ServerStatusUpdate): void {
    this.broadcast('servers', {
      type: 'server-status',
      data: update,
      timestamp: Date.now()
    });
  }

  /**
   * Send batch server status updates
   */
  public broadcastServerBatch(updates: ServerStatusUpdate[]): void {
    this.broadcast('servers', {
      type: 'server-batch',
      data: updates,
      timestamp: Date.now()
    });
  }

  /**
   * Send player update to subscribed clients
   */
  public broadcastPlayerUpdate(update: PlayerUpdate): void {
    const subscriberCount = this.getSubscribersCount('players');
    console.log(`📡 [WebSocket] Broadcasting player update to ${subscriberCount} subscribers: ${update.name} - online: ${update.online}`);
    this.broadcast('players', {
      type: 'player-update',
      data: update,
      timestamp: Date.now()
    });
  }

  /**
   * Send batch player updates
   */
  public broadcastPlayerBatch(updates: PlayerUpdate[]): void {
    this.broadcast('players', {
      type: 'players-batch',
      data: updates,
      timestamp: Date.now()
    });
  }

  /**
   * Send ban status update to subscribed clients
   */
  public broadcastBanUpdate(data: { uuid: string; name: string; isBanned: boolean; reason?: string; bannedBy?: string; timestamp: number }): void {
    const subscriberCount = this.getSubscribersCount('bans');
    console.log(`📡 [WebSocket] Broadcasting ban update to ${subscriberCount} subscribers: ${data.name} - banned: ${data.isBanned}`);
    this.broadcast('bans', {
      type: 'ban-update',
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Send server log entry to subscribed clients
   */
  public broadcastServerLog(serverId: string, logEntry: ServerLogEntry): void {
    this.broadcast(`server-logs:${serverId}`, {
      type: 'server-log',
      data: logEntry,
      timestamp: Date.now()
    });
  }

  /**
   * Get number of connected clients
   */
  public getConnectedClients(): number {
    return this.clients.size;
  }

  /**
   * Get clients subscribed to a specific channel
   */
  public getSubscribersCount(channel: string): number {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.channels.has(channel)) {
        count++;
      }
    });
    return count;
  }

  /**
   * Shutdown WebSocket server gracefully
   */
  public shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.clients.forEach((client) => {
      client.ws.close(1000, 'Server shutting down');
    });

    if (this.wss) {
      this.wss.close(() => {
        console.log('✅ WebSocket server shut down');
      });
    }
  }

  /**
   * Private: Handle incoming WebSocket messages
   */
  private handleMessage(ws: WebSocket, message: WebSocketMessage): void {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case 'ping':
        this.send(ws, { type: 'pong', timestamp: Date.now() });
        break;

      case 'pong':
        client.isAlive = true;
        break;

      case 'subscribe':
        const subscribeChannel = message.data?.channel;
        if (subscribeChannel && typeof subscribeChannel === 'string') {
          client.channels.add(subscribeChannel);
          console.log(`📡 Client subscribed to: ${subscribeChannel} (${this.getSubscribersCount(subscribeChannel)} total)`);
        }
        break;

      case 'unsubscribe':
        const unsubscribeChannel = message.data?.channel;
        if (unsubscribeChannel && typeof unsubscribeChannel === 'string') {
          client.channels.delete(unsubscribeChannel);
          console.log(`📡 Client unsubscribed from: ${unsubscribeChannel}`);
        }
        break;

      default:
        console.warn(`Unknown WebSocket message type: ${message.type}`);
    }
  }

  /**
   * Private: Start ping interval to detect dead connections
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client) => {
        if (!client.isAlive) {
          // Client didn't respond to last ping, terminate connection
          console.warn(`⚠️ Terminated unresponsive WebSocket client - no pong received`);
          client.ws.terminate();
          this.clients.delete(client.ws);
          return;
        }

        client.isAlive = false;
        console.log(`📍 Sending ping to client`);
        client.ws.ping(() => {
          // Pong received - mark as alive
          client.isAlive = true;
          console.log(`✅ Received pong from client`);
        });
      });
    }, 60000); // Ping every 60 seconds (increased from 30 to give more time)
  }
}

// Export singleton instance
export const wsManager = new WebSocketManager();
