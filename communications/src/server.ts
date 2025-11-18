import express from 'express';
import cors from 'cors';
import { serverRegistry } from './core/registry.js';
import { playerStore } from './data/playerStore.js';
import { onlinePlayersStore, OnlinePlayerSession } from './data/onlinePlayersStore.js';
import { broadcastPlayerUpdate, broadcastBanStatusUpdate } from './core/broadcaster.js';
import { initiateGracefulReconnect, requestOnlinePlayerSync } from './core/gracefulReconnect.js';
import path from 'path';
import fs from 'fs';

const app = express();

// Check if running in production mode
const isProduction = process.env.PRODUCTION === 'true';

const rawOrigins = process.env.ADMIN_ALLOWED_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || (isProduction ? 'https://bovisgl.xyz,https://*.bovisgl.xyz' : 'http://localhost:3000,http://localhost:5173');
const allowedOrigins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

function originMatches(pattern: string, origin: string): boolean {
  if (pattern === '*') return true;
  if (pattern.includes('*')) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`);
    return regex.test(origin);
  }
  return pattern === origin;
}

const baseAllowedHeaders = ['Content-Type', 'X-Admin-Token', 'x-admin-token', 'Authorization', 'Accept'];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(pattern => originMatches(pattern, origin))) {
      return callback(null, true);
    }
    console.warn(`[cors] blocked origin ${origin}`);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  // Let the cors middleware reflect requested headers automatically by not hardcoding allowedHeaders
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

// Explicit preflight handler to reflect headers and origin for tricky proxies
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') return next();
  const origin = req.headers.origin as string | undefined;
  const requestedHeaders = (req.headers['access-control-request-headers'] as string | undefined) || '';
  const allowHeaders = [baseAllowedHeaders.join(', '), requestedHeaders].filter(Boolean).join(', ');
  if (!origin || allowedOrigins.some(p => originMatches(p, origin))) {
    if (origin) res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', allowHeaders);
    return res.sendStatus(204);
  }
  return res.sendStatus(403);
});

app.use(cors(corsOptions));
app.use((req, res, next) => {
  // Reflect requested headers if provided, else fall back to our base set
  const requested = req.headers['access-control-request-headers'];
  const allow = (typeof requested === 'string' && requested.length)
    ? requested
    : baseAllowedHeaders.join(', ');
  const origin = req.headers.origin as string | undefined;
  if (origin && allowedOrigins.some(p => originMatches(p, origin))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Headers', allow);
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  next();
});
app.use(express.json());

// Simple admin auth placeholder (replace with real auth later)
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Always allow CORS preflight
  if (req.method === 'OPTIONS') return next();
  const expected = process.env.ADMIN_TOKEN || 'dev-admin';
  const tokenHeader = req.get('x-admin-token');
  if (!tokenHeader || tokenHeader !== expected) return res.status(401).json({ error: 'unauthorized' });
  next();
}

function normalizeClientToken(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const token = raw.trim().toLowerCase();
  if (!token || !token.includes('.')) return null;
  if (!/^[a-z0-9.+-]+$/i.test(token)) return null;
  return token;
}

function normalizeServerName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  return value;
}

function computeLastActiveTs(joinTs: number | null, leaveTs: number | null, sessionTs: number | null) {
  const values = [joinTs, leaveTs, sessionTs].filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  if (values.length === 0) return 0;
  return Math.max(...values);
}

function formatClock(ts: number | null | undefined): string | null {
  if (typeof ts !== 'number' || Number.isNaN(ts)) return null;
  return new Date(ts).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(ts: number | null | undefined): string | null {
  if (typeof ts !== 'number' || Number.isNaN(ts)) return null;
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hours}:${mins}`;
}

function formatDateTimeWithClient(ts: number | null | undefined, client: string | null | undefined): string | null {
  const dt = formatDateTime(ts);
  const cleanClient = typeof client === 'string' && client.trim().length ? client.trim() : null;
  if (!dt && !cleanClient) return null;
  if (!dt) return cleanClient;
  return cleanClient ? `${dt} · ${cleanClient}` : dt;
}

function deriveLastSeen(
  player: Pick<AdminPlayerInfo, 'lastJoinTs' | 'lastJoinClient' | 'lastLeaveTs' | 'lastLeaveClient' | 'currentClient' | 'currentServer'>,
  session: ReturnType<typeof onlinePlayersStore.get> | null
): string | null {
  if (session) {
    return 'online now';
  }

  const ts = player.lastLeaveTs ?? player.lastJoinTs ?? null;
  const client = player.lastLeaveTs ? player.lastLeaveClient : player.lastJoinClient;
  return formatDateTimeWithClient(ts, client);
}

interface AdminPlayerInfo {
  uuid: string;
  name: string;
  lastJoinTs: number | null;
  lastJoinClient: string | null;
  lastServer: string | null;
  lastLeaveTs: number | null;
  lastLeaveClock: string | null;
  lastLeaveClient: string | null;
  clients: string[];
  online: boolean;
  currentClient: string | null;
  currentServer: string | null;
  lastActiveTs: number;
  lastSeen: string | null;
  accountType: string | null;
  banned?: boolean;
  ban?: any;
}

function buildAdminPlayersPayload(): AdminPlayerInfo[] {
  const storedPlayers = playerStore.list();
  const sessions = onlinePlayersStore.list();
  const sessionByUuid = new Map(sessions.map(s => [s.uuid, s]));

  const payload: AdminPlayerInfo[] = storedPlayers.map(player => {
    const session = sessionByUuid.get(player.uuid) || null;
    const lastActiveTs = computeLastActiveTs(player.lastJoinTs, player.lastLeaveTs, session?.lastUpdate ?? null);
    const ban = playerStore.isBanned(player.uuid);
    return {
      uuid: player.uuid,
      name: player.name,
      lastJoinTs: player.lastJoinTs,
      lastJoinClient: player.lastJoinClient,
      lastServer: session?.server ?? player.lastServer,
      lastLeaveTs: player.lastLeaveTs,
      lastLeaveClock: formatClock(player.lastLeaveTs),
      lastLeaveClient: player.lastLeaveClient,
      clients: player.clients,
      online: !!session,
      currentClient: session?.client ?? null,
      currentServer: session?.server ?? null,
      lastActiveTs,
      lastSeen: null,
      accountType: player.accountType ?? null,
      banned: !!ban,
      ban: ban || undefined
    };
  });

  for (const session of sessions) {
    if (payload.some(player => player.uuid === session.uuid)) continue;
    const lastActiveTs = computeLastActiveTs(null, null, session.lastUpdate);
    const ban = playerStore.isBanned(session.uuid);
    payload.push({
      uuid: session.uuid,
      name: session.name,
      lastJoinTs: null,
      lastJoinClient: session.client ?? null,
      lastServer: session.server ?? null,
      lastLeaveTs: null,
      lastLeaveClock: null,
      lastLeaveClient: null,
      clients: session.client ? [session.client] : [],
      online: true,
      currentClient: session.client ?? null,
      currentServer: session.server ?? null,
      lastActiveTs,
      lastSeen: 'online now',
      accountType: null,
      banned: !!ban,
      ban: ban || undefined
    });
  }

  for (const player of payload) {
    const session = sessionByUuid.get(player.uuid) || null;
    player.lastSeen = deriveLastSeen(player, session);
  }

  payload.sort((a, b) => {
    if (a.online && !b.online) return -1;
    if (!a.online && b.online) return 1;
    const diff = (b.lastActiveTs || 0) - (a.lastActiveTs || 0);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  return payload;
}

// Health
app.get('/health', (_req, res) => res.json({ ok: true, time: Date.now(), playersDb: 'ready' }));

// Graceful reconnect endpoint - called by servers after communications restart
// Servers use this to signal they're ready to resync
app.post('/api/reconnect', (req, res) => {
  console.log('[reconnect] Server reconnect signal received');
  res.json({ status: 'acknowledged', message: 'Communications service is online' });
});

// Player online sync endpoint - called by servers to resend all online player data
// Used to resync state after communications restart
app.post('/api/players/online/sync', (req, res) => {
  const { server, players = [] } = req.body || {};
  console.log(`[sync] Received online player sync from ${server}: ${players.length} players`);
  
  if (!Array.isArray(players)) {
    return res.status(400).json({ error: 'players must be an array' });
  }
  
  // Process each player as if they just joined
  for (const player of players) {
    try {
      if (player.uuid && player.name) {
        const session: OnlinePlayerSession = {
          uuid: player.uuid,
          name: player.name,
          client: player.currentClient || null,
          server: server || player.currentServer || null,
          joinedAt: player.joinedAt || Date.now(),
          lastUpdate: Date.now()
        };
        onlinePlayersStore.set(session);
        console.log(`[sync] Updated player ${player.name} (${player.uuid}) from sync`);
      }
    } catch (err) {
      console.warn(`[sync] Error processing player in sync:`, err);
    }
  }
  
  res.json({ status: 'synced', players_processed: players.length });
});

// Player join (from game servers)
// Body: { uuid, name | username, client?, server?, accountType?, skinData? }
app.post('/api/players/join', (req, res) => {
  const body = req.body || {};
  const uuid = typeof body.uuid === 'string' ? body.uuid.trim() : '';
  const nameInput = body.name || body.username || body.user;
  const name = typeof nameInput === 'string' ? nameInput.trim() : '';
  const clientToken = normalizeClientToken(body.client ?? (Array.isArray(body.clients) ? body.clients[0] : null));
  const serverName = normalizeServerName(body.server ?? body.currentServer ?? null);
  
  // Detect account type ONLY from UUID pattern, never from client
  // Bedrock UUIDs have pattern: 00000000-0000-0000-XXXX-XXXXXXXXXXXX
  let accountType: string | null = null;
  if (uuid.startsWith('00000000-0000-0000-')) {
    accountType = 'bedrock';
  } else {
    accountType = 'java';
  }
  
  if (!uuid || !name) return res.status(400).json({ error: 'uuid and name required' });
  try {
    const record = playerStore.recordJoin(uuid, name, clientToken, serverName, accountType);
    
    // Log account type for tracking
    if (accountType === 'bedrock') {
      console.log(`🎮 Bedrock player joined: ${name} (${uuid})`);
    } else if (accountType === 'java') {
      console.log(`☕ Java player joined: ${name} (${uuid})`);
    }
    const now = Date.now();
    onlinePlayersStore.set({
      uuid,
      name,
      client: clientToken,
      server: serverName,
      joinedAt: now,
      lastUpdate: now
    });
    
    // Save Bedrock skin if provided
    if (accountType === 'bedrock' && body.skinData) {
      const skinsDir = path.join(process.cwd(), 'data', 'skins');
      if (!fs.existsSync(skinsDir)) {
        fs.mkdirSync(skinsDir, { recursive: true });
      }
      const skinFile = path.join(skinsDir, `${uuid}.json`);
      try {
        fs.writeFileSync(skinFile, JSON.stringify(body.skinData, null, 2));
        console.log(`💾 Saved Bedrock skin for ${name} (${uuid})`);
      } catch (skinErr) {
        console.warn(`⚠️ Failed to save skin for ${name}:`, skinErr);
      }
    }
    
    // Broadcast player update via WebSocket to admin frontend
    broadcastPlayerUpdate({
      uuid,
      name,
      online: true,
      currentServer: serverName,
      currentClient: clientToken,
      lastActiveTs: now,
      lastJoinTs: now,
      lastJoinClient: clientToken,
      clients: clientToken ? [clientToken] : []
    }).catch(err => console.warn('Failed to broadcast join update:', err));
    
    const ban = playerStore.isBanned(uuid);
    res.json({ stored: !!record, banned: !!ban, ban, player: record, session: onlinePlayersStore.get(uuid) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Update player server / client
app.post('/api/players/switch', (req, res) => {
  const body = req.body || {};
  const uuid = typeof body.uuid === 'string' ? body.uuid.trim() : '';
  if (!uuid) return res.status(400).json({ error: 'uuid required' });

  const currentRecord = playerStore.get(uuid);
  const providedName = typeof body.name === 'string' ? body.name.trim() : '';
  const name = providedName || currentRecord?.name || uuid;
  const serverName = normalizeServerName(body.server ?? body.currentServer ?? null);
  const clientToken = normalizeClientToken(body.client ?? null);

  try {
    const record = playerStore.recordServer(uuid, name, serverName, clientToken);
    const existingSession = onlinePlayersStore.get(uuid);
    if (existingSession) {
      onlinePlayersStore.update(uuid, {
        name,
        server: serverName ?? existingSession.server,
        client: clientToken ?? existingSession.client
      });
    } else {
      const now = Date.now();
      onlinePlayersStore.set({
        uuid,
        name,
        client: clientToken,
        server: serverName,
        joinedAt: now,
        lastUpdate: now
      });
    }
    
    // Broadcast player update via WebSocket
    const now = Date.now();
    broadcastPlayerUpdate({
      uuid,
      name,
      online: true,
      currentServer: serverName,
      currentClient: clientToken,
      lastActiveTs: now,
      clients: clientToken ? [clientToken] : []
    }).catch(err => console.warn('Failed to broadcast switch update:', err));
    
    res.json({ updated: true, player: record, session: onlinePlayersStore.get(uuid) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Player leave
app.post('/api/players/leave', (req, res) => {
  const body = req.body || {};
  const uuid = typeof body.uuid === 'string' ? body.uuid.trim() : '';
  if (!uuid) return res.status(400).json({ error: 'uuid required' });

  const stored = playerStore.get(uuid);
  const providedName = typeof body.name === 'string' ? body.name.trim() : '';
  const name = providedName || stored?.name || uuid;
  const clientToken = normalizeClientToken(body.client ?? null);

  try {
    const record = playerStore.recordLeave(uuid, name, clientToken);
    onlinePlayersStore.remove(uuid);
    
    // Broadcast player update via WebSocket (mark as offline)
    const now = Date.now();
    broadcastPlayerUpdate({
      uuid,
      name,
      online: false,
      currentServer: null,
      currentClient: null,
      lastActiveTs: now,
      lastLeaveTs: now,
      lastLeaveClient: clientToken,
      clients: record?.clients || []
    }).catch(err => console.warn('Failed to broadcast leave update:', err));
    
    res.json({ updated: true, player: record });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Check ban by UUID
app.get('/api/players/:uuid/ban', (req, res) => {
  const uuid = String(req.params.uuid || '').trim();
  if (!uuid) return res.status(400).json({ error: 'uuid required' });
  const ban = playerStore.isBanned(uuid);
  
  // If banned, notify hub servers immediately to prepare ban screen
  if (ban) {
    const hubServers = serverRegistry.list().filter(s => s.name.toLowerCase() === 'hub' || s.type === 'hub');
    hubServers.forEach(server => {
      try {
        const notifyUrl = `http://${server.host}:${server.port}/api/notify-banned-player`;
        fetch(notifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uuid: uuid,
            name: ban.name,
            reason: ban.reason,
            banned_by: ban.bannedBy,
            banned_at: ban.bannedAt
          }),
          signal: AbortSignal.timeout(3000)
        }).catch(err => console.warn(`[ban-notify] Failed to notify ${server.name}: ${(err as any).message}`));
      } catch (err) {
        console.warn(`[ban-notify] Error notifying hub about banned player:`, err);
      }
    });
  }
  
  if (!ban) return res.json({ banned: false });
  res.json({ banned: true, ban });
});

// Ban player (UUID required to avoid name collisions)
app.post('/api/players/ban', (req, res) => {
  const { uuid, name, reason = null, by = null } = req.body || {};
  if (!uuid || !name) return res.status(400).json({ error: 'uuid and name required' });
  try {
    playerStore.ban(String(uuid), String(name), reason, by);
    console.log(`🔒 [BAN] Player banned: ${name} (${uuid}) - Reason: ${reason || 'No reason provided'}`);
    
    // Broadcast ban status update to web frontend
    broadcastBanStatusUpdate(String(uuid), String(name), true, reason, by).catch(err => 
      console.warn('Failed to broadcast ban update:', err)
    );
    
    // Kick the player from proxy if online
    const session = onlinePlayersStore.get(String(uuid));
    if (session) {
      // Get player's account type for logging
      const player = playerStore.get(String(uuid));
      const accountType = player?.accountType || 'java';
      
      // Build simple kick message that works for both Java and Bedrock
      // Avoid complex formatting that might break Bedrock connections
      const kickMessage = `You are banned\nReason: ${reason || 'No reason provided'}\nBanned by: ${by || 'System'}`;
      
      console.log(`⚠️ [BAN-KICK] Kicking ${accountType} player ${name} from proxy: ${kickMessage}`);
      
      // Call proxy to kick the player
      fetch('http://127.0.0.1:25578/api/kick-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uuid: String(uuid), 
          reason: kickMessage 
        }),
        signal: AbortSignal.timeout(3000)
      }).then(r => {
        if (r.ok) console.log(`✓ [BAN-KICK] Kick sent to proxy for ${name}`);
      }).catch(err => console.warn(`[ban-kick] Failed to kick player from proxy: ${(err as any).message}`));
    } else {
      console.log(`ℹ️ [BAN] Player ${name} is offline, will be kicked on next login`);
    }
    
    res.json({ banned: true, uuid: String(uuid), name: String(name), reason });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Unban player by UUID
app.post('/api/players/unban', (req, res) => {
  const { uuid } = req.body || {};
  if (!uuid) return res.status(400).json({ error: 'uuid required' });
  try {
    const ok = playerStore.unban(String(uuid));
    // Get player name for broadcast
    const player = playerStore.get(String(uuid));
    if (ok && player) {
      broadcastBanStatusUpdate(String(uuid), player.name, false).catch(err =>
        console.warn('Failed to broadcast unban update:', err)
      );
    }
    res.json({ unbanned: ok });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// List bans
app.get('/api/bans', (_req, res) => {
  try {
    res.json({ bans: playerStore.listBans() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: list players with session overlay
app.get('/api/locked/admin/players', requireAdmin, (_req, res) => {
  try {
    const players = buildAdminPlayersPayload();
    res.json({ players });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: specific player details
app.get('/api/locked/admin/players/:uuid', requireAdmin, (req, res) => {
  const uuid = String(req.params.uuid || '').trim();
  if (!uuid) return res.status(400).json({ error: 'uuid required' });
  try {
    const stored = playerStore.get(uuid);
    const session = onlinePlayersStore.get(uuid);
    if (!stored && !session) return res.status(404).json({ error: 'not_found' });

    const info: AdminPlayerInfo = {
      uuid,
      name: session?.name ?? stored?.name ?? uuid,
      lastJoinTs: stored?.lastJoinTs ?? null,
      lastJoinClient: stored?.lastJoinClient ?? null,
      lastServer: session?.server ?? stored?.lastServer ?? null,
      lastLeaveTs: stored?.lastLeaveTs ?? null,
      lastLeaveClock: formatClock(stored?.lastLeaveTs ?? null),
      lastLeaveClient: stored?.lastLeaveClient ?? null,
      clients: stored?.clients ?? (session?.client ? [session.client] : []),
      online: !!session,
      currentClient: session?.client ?? null,
      currentServer: session?.server ?? null,
      lastActiveTs: computeLastActiveTs(stored?.lastJoinTs ?? null, stored?.lastLeaveTs ?? null, session?.lastUpdate ?? null),
      lastSeen: null,
      accountType: stored?.accountType ?? null
    };

    info.lastSeen = deriveLastSeen(info, session ?? null);

    const ban = playerStore.isBanned(uuid);
    res.json({ player: info, ban });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: currently online players (in-memory snapshot)
app.get('/api/locked/admin/players/online', requireAdmin, (_req, res) => {
  try {
    res.json({ players: onlinePlayersStore.list() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// (Player manager static serving removed; handled purely by frontend SPA now)

// Admin: server controls (stub)
app.post('/api/locked/servers/:serverName/stop', requireAdmin, (req, res) => {
  const name = req.params.serverName;
  // Not implemented yet on this backend instance; respond gracefully so UI can handle it
  res.status(501).json({ error: 'not_implemented', message: `Stopping server '${name}' is not implemented on this backend.` });
});

// Register server
app.post('/api/servers/register', (req, res) => {
  console.log('[register] payload', req.body);
  const { serverName, serverType, host = 'localhost', port = 0, version, maxPlayers, currentPlayers, meta } = req.body || {};
  if (!serverName || !serverType) return res.status(400).json({ error: 'serverName and serverType required' });
  const registered = serverRegistry.register({ name: serverName, type: serverType, host, port, version, maxPlayers, currentPlayers, meta });
  res.json({ server: registered });
});

// Heartbeat
app.post('/api/servers/heartbeat', (req, res) => {
  console.log('[heartbeat] payload', req.body);
  const { serverName, playerCount, maxPlayers, version, status, meta } = req.body || {};
  if (!serverName) return res.status(400).json({ error: 'serverName required' });
  const updated = serverRegistry.heartbeat(serverName, { currentPlayers: playerCount, maxPlayers, version, status, meta });
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json({ server: updated });
});

// Unregister
app.post('/api/servers/unregister', (req, res) => {
  const { serverName } = req.body || {};
  if (!serverName) return res.status(400).json({ error: 'serverName required' });
  const ok = serverRegistry.unregister(serverName);
  res.json({ removed: ok });
});

// List servers
app.get('/api/servers', (_req, res) => {
  res.json({ servers: serverRegistry.list() });
});

// Public status endpoint for UI (no auth)
app.get('/api/public/servers/status', (_req, res) => {
  const list = serverRegistry.list().map(s => ({
    name: s.name,
    type: s.type,
    status: s.status,
    currentPlayers: s.currentPlayers ?? 0,
    maxPlayers: s.maxPlayers ?? 0,
    version: s.version ?? null,
    lastHeartbeat: s.lastHeartbeat
  }));
  res.json({ servers: list });
});

// Simple persistence snapshot
const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const SNAPSHOT = path.join(DATA_DIR, 'servers.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function saveSnapshot() {
  ensureDataDir();
  fs.writeFileSync(SNAPSHOT, JSON.stringify(serverRegistry.list(), null, 2));
}

setInterval(saveSnapshot, 15000);
process.on('SIGINT', () => { saveSnapshot(); process.exit(0); });

const PORT = process.env.COMMS_PORT ? Number(process.env.COMMS_PORT) : 3456;
app.listen(PORT, async () => {
  console.log(`[communications] listening on ${PORT}`);
  
  // Gracefully reconnect to servers and resync player data
  console.log('[communications] Initiating graceful reconnection sequence...');
  
  try {
    // Wait a moment for servers to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Signal all servers that communications is back online
    await initiateGracefulReconnect();
    
    // Request all servers send their online player data
    await requestOnlinePlayerSync();
    
    console.log('[communications] Graceful reconnection sequence complete');
  } catch (err) {
    console.error('[communications] Error during graceful reconnection:', err);
  }
});
