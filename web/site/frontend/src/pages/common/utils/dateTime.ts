/**
 * Date and time formatting utilities
 * Used across player manager and admin pages
 */

/**
 * Format a timestamp to a localized date-time string
 * @param ts - Unix timestamp in milliseconds
 * @returns Formatted date-time string or '—' if invalid
 */
export function formatDateTime(ts?: number | null): string {
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
 * Format a timestamp with optional client information
 * @param ts - Unix timestamp in milliseconds
 * @param client - Optional client identifier (e.g., 'Vanilla', 'Fabric')
 * @returns Formatted string with timestamp and client or '—' if invalid
 */
export function describeDateTimeWithClient(ts?: number | null, client?: string | null): string {
  const display = formatDateTime(ts);
  if (display === '—') return client ?? '—';
  return client ? `${display} · ${client}` : display;
}

/**
 * Format a date without time
 * @param ts - Unix timestamp in milliseconds
 * @returns Formatted date string or '—' if invalid
 */
export function formatDate(ts?: number | null): string {
  if (typeof ts !== 'number' || Number.isNaN(ts)) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format time only
 * @param ts - Unix timestamp in milliseconds
 * @returns Formatted time string or '—' if invalid
 */
export function formatTime(ts?: number | null): string {
  if (typeof ts !== 'number' || Number.isNaN(ts)) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get relative time description (e.g., "2 hours ago")
 * @param ts - Unix timestamp in milliseconds
 * @returns Relative time string or '—' if invalid
 */
export function getRelativeTime(ts?: number | null): string {
  if (typeof ts !== 'number' || Number.isNaN(ts)) return '—';
  const now = Date.now();
  const diff = now - ts;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  
  return formatDate(ts);
}
