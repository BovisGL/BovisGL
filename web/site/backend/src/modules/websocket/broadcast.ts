/**
 * WebSocket Broadcasting Utilities
 * Simple functions for the rest of the backend to use for real-time updates
 */

import { wsManager, ServerStatusUpdate, PlayerUpdate } from './index.js';

/**
 * Broadcast a server status update to all connected clients
 */
export function broadcastServerStatus(update: ServerStatusUpdate): void {
  wsManager.broadcastServerStatus(update);
}

/**
 * Broadcast multiple server status updates
 */
export function broadcastServerBatch(updates: ServerStatusUpdate[]): void {
  wsManager.broadcastServerBatch(updates);
}

/**
 * Broadcast a player update to all connected clients
 */
export function broadcastPlayerUpdate(update: PlayerUpdate): void {
  wsManager.broadcastPlayerUpdate(update);
}

/**
 * Broadcast multiple player updates
 */
export function broadcastPlayerBatch(updates: PlayerUpdate[]): void {
  wsManager.broadcastPlayerBatch(updates);
}

/**
 * Get current connected client count
 */
export function getConnectedClientsCount(): number {
  return wsManager.getConnectedClients();
}

/**
 * Get subscribers count for a specific channel
 */
export function getSubscribersCount(channel: string): number {
  return wsManager.getSubscribersCount(channel);
}
