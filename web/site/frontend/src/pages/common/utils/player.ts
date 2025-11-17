/**
 * Player and avatar related utility functions
 * Used across player manager and related pages
 */

/**
 * Player summary interface for type safety
 */
export interface PlayerSummary {
  uuid: string;
  name: string;
  online: boolean;
  lastJoinTs?: number | null;
  lastLeaveTs?: number | null;
  lastJoinClient?: string | null;
  lastLeaveClient?: string | null;
  lastSeenLabel?: string | null;
}

/**
 * Get player avatar/head image URL
 * @param uuid - Player UUID
 * @param _name - Player name (reserved for future use)
 * @param size - Image size in pixels
 * @returns Avatar image URL
 */
export function getPlayerAvatarUrl(uuid: string, _name: string, size: number = 24): string {
  // Use Crafatar or similar service for player avatars
  return `https://crafatar.com/avatars/${uuid}?size=${size}&overlay`;
}

/**
 * Describe when a player was last seen
 * @param player - Player summary object
 * @returns Description of last seen time
 */
export function describeLastSeen(player: PlayerSummary): string {
  if (player.online) return 'Online now';
  
  const ts = player.lastLeaveTs ?? player.lastJoinTs;
  const client = player.lastLeaveTs ? player.lastLeaveClient : player.lastJoinClient;
  
  if (ts) {
    const formatted = formatDateTime(ts);
    if (formatted !== '—') {
      return client ? `${formatted} · ${client}` : formatted;
    }
  }
  
  return player.lastSeenLabel ?? '—';
}

/**
 * Format timestamp helper (re-exported for convenience)
 */
function formatDateTime(ts?: number | null): string {
  if (typeof ts !== 'number' || Number.isNaN(ts)) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get player name color based on online status
 * @param online - Whether player is online
 * @returns CSS color value
 */
export function getPlayerStatusColor(online: boolean): string {
  return online ? '#4CAF50' : '#888';
}

/**
 * Sanitize player name for display
 * @param name - Player name
 * @returns Sanitized name
 */
export function sanitizePlayerName(name: string): string {
  return name.trim().replace(/[<>]/g, '');
}
