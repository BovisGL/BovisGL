/**
 * Player Update Broadcaster
 * Intercepts player data changes and broadcasts them via WebSocket to connected clients
 */

import { wsManager, PlayerUpdate } from './websocket/index.js';

export interface PlayerDataChange {
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

/**
 * Broadcast a player update to all connected WebSocket clients
 */
export function broadcastPlayerUpdate(update: PlayerDataChange): void {
  wsManager.broadcastPlayerUpdate(update as PlayerUpdate);
}

/**
 * Broadcast multiple player updates
 */
export function broadcastPlayerBatch(updates: PlayerDataChange[]): void {
  wsManager.broadcastPlayerBatch(updates as PlayerUpdate[]);
}

/**
 * Broadcast a fetch request - tells all clients to refresh player data
 * This is used when data changes server-side
 */
export function broadcastPlayerDataRefresh(): void {
  wsManager.broadcast('players', {
    type: 'player-update',
    data: { _refresh: true },
    timestamp: Date.now()
  });
}
