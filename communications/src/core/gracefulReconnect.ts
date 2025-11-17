import { serverRegistry } from './registry.js';
import axios from 'axios';

/**
 * GracefulReconnectHandler - On communications service startup, gracefully reconnect
 * to all registered servers and request they resend all online player data
 */

export async function initiateGracefulReconnect(): Promise<void> {
  console.log('[graceful-reconnect] Starting graceful reconnection to servers...');
  
  const servers = serverRegistry.list();
  if (servers.length === 0) {
    console.log('[graceful-reconnect] No servers registered yet');
    return;
  }

  for (const server of servers) {
    try {
      console.log(`[graceful-reconnect] Connecting to ${server.name} (${server.host}:${server.port})`);
      
      // Send graceful reconnect signal to server
      const reconnectUrl = `http://${server.host}:${server.port}/api/reconnect`;
      const response = await axios.post(reconnectUrl, { communications_restarted: true }, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status === 200) {
        console.log(`[graceful-reconnect] ✓ ${server.name} acknowledged reconnect signal`);
      } else {
        console.warn(`[graceful-reconnect] ⚠ ${server.name} returned ${response.status}`);
      }
    } catch (err) {
      console.warn(`[graceful-reconnect] Failed to connect to ${server.name}: ${(err as any).message}`);
      // Continue with other servers
    }
  }

  console.log('[graceful-reconnect] Graceful reconnection phase complete');
}

/**
 * Request all online player data from servers
 * Used to resync player state after communications service restart
 */
export async function requestOnlinePlayerSync(): Promise<void> {
  console.log('[player-sync] Requesting online player data from all servers...');
  
  const servers = serverRegistry.list();
  
  for (const server of servers) {
    try {
      console.log(`[player-sync] Requesting data from ${server.name}`);
      
      // Request all online players from server
      const syncUrl = `http://${server.host}:${server.port}/api/players/online/sync`;
      const response = await axios.post(syncUrl, { request_type: 'full_sync' }, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status === 200) {
        console.log(`[player-sync] ✓ ${server.name} sent online player data`);
      } else {
        console.warn(`[player-sync] ⚠ ${server.name} returned ${response.status}`);
      }
    } catch (err) {
      console.warn(`[player-sync] Failed to sync with ${server.name}: ${(err as any).message}`);
      // Continue with other servers
    }
  }

  console.log('[player-sync] Player sync request phase complete');
}
