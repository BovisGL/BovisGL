/**
 * Player Skin Service
 * 
 * Handles fetching player avatars from multiple sources with CORS support
 * Uses Mojang's official session server API which has proper CORS headers
 * Falls back to data URIs for default skins
 */

// Cache for skin URLs (24 hour TTL)
const skinCache = new Map<string, { skinUrl: string; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Default Steve head skin as base64 PNG
const DEFAULT_STEVE_HEAD = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABfklEQVR4nGNkYGBg+P//PwMDA8P//w8YGP4zMPz//5+BiYWBgZWVlYmBiYmJgY2NjQFKMTExMbCysjIwMDAwMDAwMvz//8/AwPDvHwPDvxkMjIyMDIyMDAwMDAwM//79Y2D4N4OR4d88BkZGBkZGRkZGRkaG////M/z79+/fv38M/2YwMDAwMDAwfP369Q8V/m/h34//DAwMUhwMvz58+Pfv378/f/78+cPw/+8/BiZGBsbfLAxMDA2M////5/n/7+9fhllz5vwHKWBkZGBkZGBkZGRkZPj7/+8/q9VMGf6/Z2BkZGBkZGRk+PcXiPj7+9/r71+Gv3+ZGf7+ZWD4xyghycDwdwYjw7+5DAwM/z4xMPxdyMAw5d+8//PmzGFg/MPAwPj3LwPDv/8Mhj9/GBgZGP79/cfAxviHgZGBkfEvwyygH6acwjB04cJ9vz+wMEw8fIDnP9S5r2Bgeegg71+I/8XMDExDGBgZGRkZGBkZ/jEwML5nZGDk5GRkZGRkZGBkZGTQV1fXUVFRYWBhYWFgY2NjYGVlBQD/oGHlQlZ0bwAAAABJRU5ErkJggg==';

/**
 * Format UUID to standard hyphenated format (8-4-4-4-12)
 */
function formatUuid(uuid: string): string {
  if (!uuid) return '';
  if (uuid.includes('-')) return uuid;
  if (uuid.length === 32) {
    return `${uuid.substring(0, 8)}-${uuid.substring(8, 12)}-${uuid.substring(12, 16)}-${uuid.substring(16, 20)}-${uuid.substring(20)}`;
  }
  return uuid;
}

/**
 * Get player avatar URL synchronously
 * Returns avatar URL using CORS-friendly Mojang API
 * Falls back to default Steve head if needed
 */
export function getPlayerAvatarUrlSync(uuid: string, _name: string, size: number = 24): string {
  const s = Math.max(8, Math.min(256, size | 0));
  const formattedUuid = formatUuid(uuid);
  const cacheKey = `${formattedUuid}-${s}`;
  
  // Check cache first
  const cached = skinCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.skinUrl;
  }
  
  // Frontend-first approach: return the most likely working public avatar URL
  // We'll attempt multiple providers in `resolvePlayerAvatar` if this fails.
  // Primary: Crafatar (UUID-based Java/BEDROCK compatible)
  const avatarUrl = `https://crafatar.com/avatars/${formattedUuid}?size=${s}&overlay`;
  
  skinCache.set(cacheKey, { skinUrl: avatarUrl, timestamp: Date.now() });
  return avatarUrl;
}

/**
 * Async version used when callers want to confirm the avatar URL is reachable.
 * Tries the Java/Crafatar avatar first using a HEAD request. If that fails,
 * returns a safe default avatar URL. This intentionally does NOT attempt any
 * Bedrock-specific lookups.
 */
export async function getPlayerAvatarUrl(uuid: string, _name: string, size: number = 24): Promise<string> {
  const s = Math.max(8, Math.min(256, size | 0));
  const formattedUuid = formatUuid(uuid);
  const cacheKey = `${formattedUuid}-${s}`;

  const cached = skinCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.skinUrl;
  }

  if (formattedUuid) {
    const candidate = `https://crafatar.com/avatars/${formattedUuid}?size=${s}&overlay`;
    try {
      const resp = await fetch(candidate, { method: 'HEAD' });
      if (resp.ok) {
        skinCache.set(cacheKey, { skinUrl: candidate, timestamp: Date.now() });
        return candidate;
      }
    } catch (e) {
      // Ignore network errors and fall through to default
    }
  }

  const fallback = `https://crafatar.com/avatars/00000000000000000000000000000000?size=${s}&overlay`;
  skinCache.set(cacheKey, { skinUrl: fallback, timestamp: Date.now() });
  return fallback;
}

/**
 * Resolve player avatar - fallback handler for when initial load fails
 * Shows default Steve head if avatar fails to load
 */
export function resolvePlayerAvatar(
  imgElement: HTMLImageElement,
  _uuid: string,
  _name: string,
  _size: number = 24
): void {
  // Attempt a chain of public avatar providers on image load failure.
  // This avoids needing a backend proxy; the browser will try each URL in turn
  // and fall back to an embedded default image if all external attempts fail.
  const uuid = _uuid || '';
  const name = _name || '';
  const s = Math.max(8, Math.min(256, _size | 0));

  const candidates: string[] = [];

  const formattedUuid = formatUuid(uuid);
  if (formattedUuid) {
    // Crafatar (UUID) - commonly used and supports overlays
    candidates.push(`https://crafatar.com/avatars/${formattedUuid}?size=${s}&overlay`);
    // Visage (alternative UUID-based provider)
    candidates.push(`https://visage.surgeplay.com/avatar/2d/${formattedUuid}/${s}`);
  }

  if (name) {
    // Minotar (username-based)
    candidates.push(`https://minotar.net/avatar/${encodeURIComponent(name)}/${s}`);
    // Visage by name
    candidates.push(`https://visage.surgeplay.com/avatar/2d/${encodeURIComponent(name)}/${s}`);
  }

  // Last resort: small generic Crafatar zero-UUID or embedded default
  candidates.push(`https://crafatar.com/avatars/00000000000000000000000000000000?size=${s}&overlay`);

  // Track current attempt index using dataset on the image element
  let idx = 0;

  // Helper to try the next candidate or fall back to embedded default
  const tryNext = () => {
    if (idx >= candidates.length) {
      imgElement.src = DEFAULT_STEVE_HEAD;
      imgElement.onerror = null;
      return;
    }

    const url = candidates[idx++];
    // Do NOT set crossOrigin here — the old frontend did not force it.
    // Forcing crossOrigin requires the remote server to send CORS headers
    // and causes the browser to block images when those headers are missing.
    // Leaving crossOrigin unset lets the browser render images even if the
    // provider doesn't include Access-Control-Allow-Origin. If you need to
    // read pixels from the image into a canvas later, we should proxy the
    // image through our backend so it can add the proper CORS header.
    imgElement.onerror = () => {
      // Try next provider on any error (404, network, etc.)
      // Small timeout to avoid tight loops
      setTimeout(tryNext, 0);
    };
    imgElement.src = url;
  };

  // Start trying candidates
  tryNext();
}
