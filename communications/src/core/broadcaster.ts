/**
 * Broadcaster utility for sending updates to the web backend
 * which then broadcasts them via WebSocket to connected clients
 */

const WEB_BACKEND_URL = process.env.WEB_BACKEND || process.env.WEB_BASE || 'http://localhost:3001';

export interface PlayerUpdateData {
  uuid: string;
  name: string;
  online: boolean;
  currentServer: string | null;
  currentClient: string | null;
  lastActiveTs: number;
  clients?: string[];
  lastJoinTs?: number | null;
  lastJoinClient?: string | null;
  lastLeaveTs?: number | null;
  lastLeaveClient?: string | null;
  lastSeen?: string | null;
}

/**
 * Broadcast a player update to all WebSocket clients
 */
export async function broadcastPlayerUpdate(update: PlayerUpdateData): Promise<void> {
  try {
    const response = await fetch(`${WEB_BACKEND_URL}/api/internal/broadcast-player-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(update)
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Failed to broadcast player update: ${response.status}`);
    } else {
      console.log(`✅ Broadcasted player update for ${update.name}`);
    }
  } catch (error) {
    // Silently fail - broadcasting is best-effort and shouldn't break the main flow
    console.warn(`⚠️ Failed to broadcast player update:`, error);
  }
}

/**
 * Broadcast multiple player updates
 */
export async function broadcastPlayerBatch(updates: PlayerUpdateData[]): Promise<void> {
  try {
    const response = await fetch(`${WEB_BACKEND_URL}/api/internal/broadcast-player-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Failed to broadcast player batch: ${response.status}`);
    } else {
      console.log(`✅ Broadcasted ${updates.length} player updates`);
    }
  } catch (error) {
    console.warn(`⚠️ Failed to broadcast player batch:`, error);
  }
}

/**
 * Broadcast a server log line
 */
export async function broadcastServerLog(serverId: string, logLine: string): Promise<void> {
  try {
    const response = await fetch(`${WEB_BACKEND_URL}/api/internal/broadcast-server-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        serverId,
        logLine
      })
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Failed to broadcast server log: ${response.status}`);
    }
  } catch (error) {
    console.warn(`⚠️ Failed to broadcast server log:`, error);
  }
}

/**
 * Broadcast a ban status update
 */
export async function broadcastBanStatusUpdate(uuid: string, name: string, isBanned: boolean, reason?: string, bannedBy?: string): Promise<void> {
  try {
    const response = await fetch(`${WEB_BACKEND_URL}/api/internal/broadcast-ban-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uuid,
        name,
        isBanned,
        reason,
        bannedBy,
        timestamp: Date.now()
      })
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Failed to broadcast ban update: ${response.status}`);
    } else {
      console.log(`✅ Broadcasted ban update for ${name} (banned: ${isBanned})`);
    }
  } catch (error) {
    console.warn(`⚠️ Failed to broadcast ban update:`, error);
  }
}
