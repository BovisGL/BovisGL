import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, access, constants } from 'fs/promises';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path - use the Velocity plugin database (READ-ONLY)
const BACKEND_ROOT = join(__dirname, '../../../..');
const PLAYERS_DB_PATH = join(BACKEND_ROOT, 'data/players/players.db');
const SKINS_DIR = join(BACKEND_ROOT, 'data/players/skins');

let playersDb: Database | null = null;

/**
 * Player Database Service - READ-ONLY for Plugin Database
 * 
 * This service only READS from the Velocity plugin database.
 * The plugin writes all player data, we just read it.
 * 
 * Online Status: Verified via RCON using UUID (not username)
 * Skin Handling: Mojang API for offline, try server first for online
 * Bedrock Support: Full cross-platform support with Floodgate
 */

// Enhanced Player data interface - matches FULL Velocity plugin schema
export interface PlayerData {
  uuid: string;                    // Primary key - Minecraft UUID (Java or Floodgate UUID)
  username: string;                // Current username (updates automatically)
  first_join: number;              // Unix timestamp in milliseconds
  last_seen: number;               // Unix timestamp in milliseconds
  playtime: number;                // Total playtime in milliseconds
  ip_address?: string;             // Last known IP address
  is_online: number;               // Database field (0=offline, 1=online) - not always accurate
  last_server?: string;            // Last backend server they connected to
  
  // Cross-platform Bedrock support fields
  bedrock_uuid?: string;           // Bedrock XUID for cross-platform players
  platform: string;               // Player platform (JAVA/BEDROCK/UNKNOWN)
  client_version?: string;         // Client version information
  skin_data?: string;              // Player skin data/URL
  is_floodgate_player: number;     // Floodgate player flag (0=no, 1=yes)
  clients?: string[];              // JSON array from communications service (e.g., ["java:1.21.7","fabric:0.16.14"])  
  
  // Runtime fields (not in database)
  skin?: string;                   // Computed skin URL
  isActuallyOnline?: boolean;      // RCON-verified online status
  currentServer?: string;          // RCON-verified current server
  mod_loader?: string;             // Derived client mod loader (Fabric/Forge/NeoForge/Quilt/Vanilla/Bedrock/Vivecraft)
}

// Session data interface - matches Velocity plugin schema
export interface SessionData {
  id: number;
  player_uuid: string;
  server_name?: string;
  join_time: number;               // Unix timestamp in milliseconds
  quit_time?: number;              // Unix timestamp in milliseconds (NULL if still online)
  session_duration?: number;       // Duration in milliseconds
}

// Initialize player database - READ-ONLY connection
export async function initPlayerDatabase(): Promise<Database> {
  if (playersDb) return playersDb;
  
  // Ensure data directories exist
  const playersDir = dirname(PLAYERS_DB_PATH);
  await mkdir(playersDir, { recursive: true });
  await mkdir(SKINS_DIR, { recursive: true });
  
  // Create database connection (READ-ONLY)
  playersDb = await open({
    filename: PLAYERS_DB_PATH,
    driver: sqlite3.Database
  });

  // Only create tables if they don't exist (plugin should create them)
  await playersDb.exec(`
    -- Main players table (matches FULL Velocity plugin schema)
    CREATE TABLE IF NOT EXISTS players (
      uuid TEXT PRIMARY KEY,                    -- Player's Minecraft UUID (Java or Floodgate UUID)
      username TEXT NOT NULL,                   -- Current username (updates when player changes name)
      first_join INTEGER NOT NULL,              -- Unix timestamp of first join (milliseconds)
      last_seen INTEGER NOT NULL,               -- Unix timestamp of last seen (milliseconds)
      playtime INTEGER DEFAULT 0,               -- Total playtime in milliseconds
      ip_address TEXT,                          -- Last known IP address
      is_online INTEGER DEFAULT 0,              -- Online status (0=offline, 1=online) - plugin managed
      last_server TEXT,                         -- Last backend server they connected to
      
      -- Cross-platform Bedrock support
      bedrock_uuid TEXT,                        -- Bedrock XUID for cross-platform players
      platform TEXT DEFAULT 'JAVA',            -- Player platform (JAVA/BEDROCK/UNKNOWN)
      client_version TEXT,                      -- Client version information
      skin_data TEXT,                           -- Player skin data/URL
      is_floodgate_player INTEGER DEFAULT 0     -- Floodgate player flag (0=no, 1=yes)
    );

    -- Player sessions table (matches Velocity plugin schema)
    CREATE TABLE IF NOT EXISTS player_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,     -- Unique session ID
      player_uuid TEXT NOT NULL,                -- Links to players.uuid (foreign key)
      server_name TEXT NOT NULL,                -- Which backend server they joined
      join_time INTEGER NOT NULL,               -- Session start time (unix timestamp)
      quit_time INTEGER,                        -- Session end time (NULL if still active)
      session_duration INTEGER                  -- Duration in milliseconds
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_players_online ON players(is_online);
    CREATE INDEX IF NOT EXISTS idx_players_last_seen ON players(last_seen DESC);
    CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
    CREATE INDEX IF NOT EXISTS idx_players_platform ON players(platform);
    CREATE INDEX IF NOT EXISTS idx_players_floodgate ON players(is_floodgate_player);
    CREATE INDEX IF NOT EXISTS idx_sessions_player ON player_sessions(player_uuid);
    CREATE INDEX IF NOT EXISTS idx_sessions_time ON player_sessions(join_time);
  `);

  console.log('✅ Player database initialized with cross-platform support');
  return playersDb;
}

// Get database connection
export async function getPlayerDatabase(): Promise<Database> {
  if (!playersDb) {
    throw new Error('Player database not initialized');
  }
  return playersDb;
}

// Close database connection
export async function closePlayerDatabase(): Promise<void> {
  if (playersDb) {
    await playersDb.close();
    playersDb = null;
  }
}

/**
 * Best-effort detection of client mod loader/brand based on stored fields.
 * Priority:
 * - Bedrock/Floodgate → "Bedrock"
 * - client_version/brand contains explicit loader keywords
 * - Username hints for Vivecraft (common suffix/prefix)
 * - Default to "Vanilla" when Java and no loader hints
 */
function detectModLoaderFrom(playerLike: {
  platform?: string;
  is_floodgate_player?: number;
  client_version?: string;
  username?: string;
  clients?: string[];
}): string {
  // Prefer explicit clients array provided by communications service
  const clients = playerLike.clients || [];
  if (Array.isArray(clients) && clients.length > 0) {
    const lower = clients.map(c => String(c).toLowerCase());
    if (lower.some(c => c.startsWith('bedrock:'))) return 'Bedrock';
    if (lower.some(c => c.startsWith('neoforge:') || c.includes('neo-forge'))) return 'NeoForge';
    if (lower.some(c => c.startsWith('forge:'))) return 'Forge';
    if (lower.some(c => c.startsWith('fabric:'))) return 'Fabric';
    if (lower.some(c => c.startsWith('quilt:'))) return 'Quilt';
    if (lower.some(c => c.startsWith('vivecraft:'))) return 'Vivecraft';
    if (lower.some(c => c.startsWith('java:'))) return 'Vanilla';
  }

  const isBedrock = playerLike.is_floodgate_player === 1 || playerLike.platform === 'BEDROCK';
  if (isBedrock) return 'Bedrock';

  const brand = (playerLike.client_version || '').toLowerCase();
  if (brand.includes('neoforge') || brand.includes('neo-forge') || brand.includes('neo forge')) return 'NeoForge';
  if (brand.includes('forge')) return 'Forge';
  if (brand.includes('fabric')) return 'Fabric';
  if (brand.includes('quilt')) return 'Quilt';
  if (brand.includes('vivecraft')) return 'Vivecraft';
  if (brand.includes('vanilla')) return 'Vanilla';

  // Common Vivecraft username patterns (sometimes present when linked)
  const uname = (playerLike.username || '').toLowerCase();
  if (uname.endsWith('_vr') || uname.includes('vivecraft')) return 'Vivecraft';

  // Default for Java players when unknown
  return 'Vanilla';
}

/**
 * RCON-based online player verification using UUIDs
 * This provides accurate online status regardless of database state
 */
async function verifyPlayerOnlineStatusViaRCON(playerUuid: string): Promise<{
  isOnline: boolean;
  currentServer?: string;
  error?: string;
}> {
  try {
    // Import RCON manager dynamically to avoid circular dependencies
    const { rconManager } = await import('../../server_control/index.js');
    const { SERVER_CONFIG } = await import('../../server_control/serverConfig.js');
    const db = await getPlayerDatabase();
    // Fetch username to support fallback matching when server doesn't support 'list uuids'
    const row = await db.get('SELECT username FROM players WHERE uuid = ?', [playerUuid]);
    const username: string | undefined = row?.username;
    const usernameVariants: string[] = [];
    if (username) {
      usernameVariants.push(username);
      // Also consider username without common Floodgate prefixes
      usernameVariants.push(username.replace(/^([.*~])/g, ''));
    }
    
    // Check each server via RCON for the player UUID
    for (const [serverId, config] of Object.entries(SERVER_CONFIG)) {
      if (serverId === 'proxy') continue; // Skip proxy
      
      try {
        // Use 'list uuids' command to get UUIDs of online players
        const response = await rconManager.sendCommand(serverId as any, 'list uuids');
        if (response) {
          const normalizedUuid = playerUuid.toLowerCase();
          if (response.toLowerCase().includes(normalizedUuid)) {
            return { isOnline: true, currentServer: serverId };
          }
        }
        
        // Fallback: parse standard 'list' output (names only)
        if (usernameVariants.length > 0) {
          const listResp = await rconManager.sendCommand(serverId as any, 'list');
          if (listResp) {
            // Typical format: "There are X of a max of Y players online: name, name"
            const lines = listResp.split('\n');
            const playerLine = lines.find((l: string) => l.toLowerCase().includes('players online:'));
            if (playerLine) {
              const part = playerLine.split('players online:')[1] ?? '';
              const names = part.split(',').map(n => n.trim()).filter(Boolean);
              const found = names.some(n => usernameVariants.some(u => u && n.localeCompare(u, undefined, { sensitivity: 'accent' }) === 0));
              if (found) {
                return { isOnline: true, currentServer: serverId };
              }
            }
          }
        }
      } catch (error) {
        // Server might be offline, continue checking others
        continue;
      }
    }
    
    return { isOnline: false };
  } catch (error) {
    return { 
      isOnline: false, 
      error: `RCON verification failed: ${error}` 
    };
  }
}

/**
 * Smart skin URL resolution
 * For online players: try server first, fallback to Mojang
 * For offline players: use Mojang API
 */
async function resolveSkinUrl(player: PlayerData): Promise<string | undefined> {
  try {
    // For Bedrock players, check skin_data field first
    if (player.is_floodgate_player && player.skin_data) {
      return player.skin_data;
    }
    
    // For online players, try to get skin from server first
    if (player.isActuallyOnline && player.currentServer) {
      try {
        const { rconManager } = await import('../../server_control/index.js');
        
        // Try to get skin from server (if plugin supports it)
        const skinResponse = await rconManager.sendCommand(
          player.currentServer as any, 
          `skin get ${player.uuid}`
        );
        
        if (skinResponse && !skinResponse.includes('Unknown command') && !skinResponse.includes('not found')) {
          return skinResponse.trim();
        }
      } catch (error) {
        // Fallback to Mojang
      }
    }
    
    // Fallback to Mojang API for all players
    return await getMojangSkinUrl(player.uuid, player.username);
  } catch (error) {
    console.error(`Error resolving skin for ${player.username}:`, error);
    return undefined;
  }
}

/**
 * Get player skin from Mojang API
 */
async function getMojangSkinUrl(uuid: string, username: string): Promise<string | undefined> {
  try {
    // For Floodgate players (with . prefix), can't use Mojang
    if (username.startsWith('.')) {
      return `https://crafatar.com/avatars/${uuid}?size=64&default=MHF_Steve`;
    }
    
    // Clean UUID (remove dashes for Mojang API)
    const cleanUuid = uuid.replace(/-/g, '');
    
    // Get profile from Mojang
    const response = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${cleanUuid}`);
    
    if (!response.ok) {
      // Fallback to Crafatar
      return `https://crafatar.com/avatars/${uuid}?size=64&default=MHF_Steve`;
    }
    
    const profile = await response.json() as any;
    
    if (profile?.properties && Array.isArray(profile.properties) && profile.properties.length > 0) {
      const textureProperty = profile.properties.find((p: any) => p.name === 'textures');
      if (textureProperty) {
        const textureData = JSON.parse(Buffer.from(textureProperty.value, 'base64').toString());
        if (textureData.textures && textureData.textures.SKIN) {
          return textureData.textures.SKIN.url;
        }
      }
    }
    
    // Fallback to Crafatar
    return `https://crafatar.com/avatars/${uuid}?size=64&default=MHF_Steve`;
  } catch (error) {
    // Final fallback
    return `https://crafatar.com/avatars/${uuid}?size=64&default=MHF_Steve`;
  }
}

// Player operations - Enhanced with cross-platform support
export const playerOps = {
  // Find player by UUID with enhanced data
  async findByUUID(uuid: string, verifyOnline: boolean = false): Promise<PlayerData | null> {
    try {
      const db = await getPlayerDatabase();
      const result = await db.get(
        'SELECT * FROM players WHERE uuid = ?',
        [uuid]
      );
      
      if (result) {
        const player = this.parsePlayer(result);
        
        // Verify online status via RCON if requested
        if (verifyOnline) {
          const onlineStatus = await verifyPlayerOnlineStatusViaRCON(uuid);
          player.isActuallyOnline = onlineStatus.isOnline;
          player.currentServer = onlineStatus.currentServer;
        }
        
        // Resolve skin URL
        player.skin = await resolveSkinUrl(player);
        
        return player;
      }
      
      return null;
    } catch (error) {
      console.error('Error finding player by UUID:', error);
      return null;
    }
  },

  // Find player by username with enhanced data
  async findByUsername(username: string, verifyOnline: boolean = false): Promise<PlayerData | null> {
    try {
      const db = await getPlayerDatabase();
      const result = await db.get(
        'SELECT * FROM players WHERE username = ? COLLATE NOCASE',
        [username]
      );
      
      if (result) {
        const player = this.parsePlayer(result);
        
        // Verify online status via RCON if requested
        if (verifyOnline) {
          const onlineStatus = await verifyPlayerOnlineStatusViaRCON(player.uuid);
          player.isActuallyOnline = onlineStatus.isOnline;
          player.currentServer = onlineStatus.currentServer;
        }
        
        // Resolve skin URL
        player.skin = await resolveSkinUrl(player);
        
        return player;
      }
      
      return null;
    } catch (error) {
      console.error('Error finding player by username:', error);
      return null;
    }
  },

  // Parse database row to enhanced Player object
  parsePlayer(row: any): PlayerData {
    // Parse clients JSON if present
    let clientsArray: string[] | undefined = undefined;
    try {
      if (row.clients) {
        const parsed = JSON.parse(row.clients);
        if (Array.isArray(parsed)) clientsArray = parsed.filter(Boolean).map(String);
      }
    } catch {}

    const base: PlayerData = {
      uuid: row.uuid,
      username: row.username,
      first_join: row.first_join,
      last_seen: row.last_seen,
      playtime: row.playtime || 0,
      ip_address: row.ip_address,
      is_online: row.is_online || 0,
      last_server: row.last_server,
      
      // Cross-platform fields
      bedrock_uuid: row.bedrock_uuid,
      platform: row.platform || 'JAVA',
      client_version: row.client_version,
      skin_data: row.skin_data,
      is_floodgate_player: row.is_floodgate_player || 0,
      clients: clientsArray
    };

    base.mod_loader = detectModLoaderFrom(base);
    return base;
  },

  // Search players
  async searchPlayers(query: string, limit: number = 100): Promise<PlayerData[]> {
    const db = await getPlayerDatabase();
    const results = await db.all(`
      SELECT * FROM players 
      WHERE username LIKE ? 
      ORDER BY is_online DESC, last_seen DESC 
      LIMIT ?
    `, [`%${query}%`, limit]);
    
    const players = results.map((row: any) => this.parsePlayer(row));
    
    // Resolve skins for all players
    await Promise.all(players.map(async (player: any) => {
      player.skin = await resolveSkinUrl(player);
    }));
    
    return players;
  },

  // Get all players with RCON verification option
  async getAllPlayers(limit: number = 1000, offset: number = 0, verifyOnline: boolean = false): Promise<PlayerData[]> {
    const db = await getPlayerDatabase();
    const results = await db.all(`
      SELECT * FROM players 
      ORDER BY is_online DESC, last_seen DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    const players = results.map((row: any) => this.parsePlayer(row));
    
    // Verify online status for all players if requested
    if (verifyOnline) {
      await Promise.all(players.map(async (player: any) => {
        const onlineStatus = await verifyPlayerOnlineStatusViaRCON(player.uuid);
        player.isActuallyOnline = onlineStatus.isOnline;
        player.currentServer = onlineStatus.currentServer;
      }));
    }
    
    // Resolve skins for all players
    await Promise.all(players.map(async (player: any) => {
      player.skin = await resolveSkinUrl(player);
    }));
    
    return players;
  },

  // Get player count
  async getPlayerCount(): Promise<number> {
    const db = await getPlayerDatabase();
    const result = await db.get('SELECT COUNT(*) as count FROM players');
    return result?.count || 0;
  },

  // Get online player count (database field - not RCON verified)
  async getOnlinePlayerCount(): Promise<number> {
    const db = await getPlayerDatabase();
    const result = await db.get('SELECT COUNT(*) as count FROM players WHERE is_online = 1');
    return result?.count || 0;
  },

  // Get RCON-verified online players with current server info
  async getActuallyOnlinePlayers(): Promise<PlayerData[]> {
    const db = await getPlayerDatabase();
    const potentiallyOnline = await db.all(`
      SELECT * FROM players 
      WHERE is_online = 1 OR last_seen > ?
      ORDER BY username
    `, [Date.now() - (5 * 60 * 1000)]); // Check players online in DB or seen in last 5 minutes
    
    const players = potentiallyOnline.map((row: any) => this.parsePlayer(row));
    const actuallyOnline: PlayerData[] = [];
    
    // Verify each player via RCON
    await Promise.all(players.map(async (player: any) => {
      const onlineStatus = await verifyPlayerOnlineStatusViaRCON(player.uuid);
      if (onlineStatus.isOnline) {
        player.isActuallyOnline = true;
        player.currentServer = onlineStatus.currentServer;
        player.skin = await resolveSkinUrl(player);
        actuallyOnline.push(player);
      }
    }));
    
    return actuallyOnline.sort((a, b) => a.username.localeCompare(b.username));
  },

  // Get online players (database field only - fast but potentially inaccurate)
  async getOnlinePlayers(): Promise<PlayerData[]> {
    const db = await getPlayerDatabase();
    const results = await db.all(`
      SELECT * FROM players 
      WHERE is_online = 1
      ORDER BY username
    `);
    
    const players = results.map((row: any) => this.parsePlayer(row));
    
    // Resolve skins for all players
    await Promise.all(players.map(async (player: any) => {
      player.skin = await resolveSkinUrl(player);
    }));
    
    return players;
  },

  // Get players by platform (Java/Bedrock/Unknown)
  async getPlayersByPlatform(platform: 'JAVA' | 'BEDROCK' | 'UNKNOWN', limit: number = 100): Promise<PlayerData[]> {
    const db = await getPlayerDatabase();
    const results = await db.all(`
      SELECT * FROM players 
      WHERE platform = ?
      ORDER BY is_online DESC, last_seen DESC 
      LIMIT ?
    `, [platform, limit]);
    
    const players = results.map((row: any) => this.parsePlayer(row));
    
    // Resolve skins for all players
    await Promise.all(players.map(async (player: any) => {
      player.skin = await resolveSkinUrl(player);
    }));
    
    return players;
  },

  // Get Bedrock players specifically
  async getBedrockPlayers(limit: number = 100): Promise<PlayerData[]> {
    const db = await getPlayerDatabase();
    const results = await db.all(`
      SELECT * FROM players 
      WHERE is_floodgate_player = 1 OR platform = 'BEDROCK'
      ORDER BY is_online DESC, last_seen DESC 
      LIMIT ?
    `, [limit]);
    
    const players = results.map((row: any) => this.parsePlayer(row));
    
    // Resolve skins for all players (special handling for Bedrock)
    await Promise.all(players.map(async (player: any) => {
      player.skin = await resolveSkinUrl(player);
    }));
    
    return players;
  },

  // Get player stats with enhanced cross-platform data
  async getPlayerStats(uuid: string): Promise<any> {
    const db = await getPlayerDatabase();
    
    const player = await db.get('SELECT * FROM players WHERE uuid = ?', [uuid]);
    if (!player) return null;

    const sessions = await db.all(`
      SELECT * FROM player_sessions 
      WHERE player_uuid = ? 
      ORDER BY join_time DESC 
      LIMIT 10
    `, [uuid]);

    const totalSessions = await db.get(`
      SELECT COUNT(*) as count FROM player_sessions WHERE player_uuid = ?
    `, [uuid]);

    // Verify current online status
    const onlineStatus = await verifyPlayerOnlineStatusViaRCON(uuid);
    const parsedPlayer = this.parsePlayer(player);
    parsedPlayer.isActuallyOnline = onlineStatus.isOnline;
    parsedPlayer.currentServer = onlineStatus.currentServer;
    parsedPlayer.skin = await resolveSkinUrl(parsedPlayer);

    return {
      ...parsedPlayer,
      recent_sessions: sessions,
      total_sessions: totalSessions?.count || 0,
      hours_played: (player.playtime || 0) / (1000 * 60 * 60),
      // Enhanced cross-platform info
      is_bedrock: parsedPlayer.is_floodgate_player === 1 || parsedPlayer.platform === 'BEDROCK',
      platform_display: parsedPlayer.platform,
      client_version_display: parsedPlayer.client_version || 'Unknown',
      has_bedrock_uuid: !!parsedPlayer.bedrock_uuid,
      mod_loader: parsedPlayer.mod_loader || detectModLoaderFrom(parsedPlayer)
    };
  },

  // Get all players (unified - no duplicates) with enhanced data
  async getAllPlayersUnified(verifyOnline: boolean = false): Promise<PlayerData[]> {
    const db = await getPlayerDatabase();
    const results = await db.all(`
      SELECT * FROM players 
      ORDER BY is_online DESC, last_seen DESC
    `);
    
    const players = results.map((row: any) => this.parsePlayer(row));
    
    // Verify online status for all players if requested
    if (verifyOnline) {
      await Promise.all(players.map(async (player: any) => {
        const onlineStatus = await verifyPlayerOnlineStatusViaRCON(player.uuid);
        player.isActuallyOnline = onlineStatus.isOnline;
        player.currentServer = onlineStatus.currentServer;
      }));
    }
    
    // Resolve skins for all players
    await Promise.all(players.map(async (player: any) => {
      player.skin = await resolveSkinUrl(player);
    }));
    
    return players;
  },

  // Search players (unified - no duplicates) with enhanced data
  async searchPlayersUnified(query: string, limit: number = 100): Promise<PlayerData[]> {
    const db = await getPlayerDatabase();
    const results = await db.all(`
      SELECT * FROM players 
      WHERE username LIKE ? 
      ORDER BY is_online DESC, last_seen DESC 
      LIMIT ?
    `, [`%${query}%`, limit]);
    
    const players = results.map((row: any) => this.parsePlayer(row));
    
    // Resolve skins for all players
    await Promise.all(players.map(async (player: any) => {
      player.skin = await resolveSkinUrl(player);
    }));
    
    return players;
  },

  // Get offline players with enhanced data
  async getOfflinePlayers(limit: number = 100): Promise<PlayerData[]> {
    const db = await getPlayerDatabase();
    const results = await db.all(`
      SELECT * FROM players 
      WHERE is_online = 0 
      ORDER BY last_seen DESC 
      LIMIT ?
    `, [limit]);
    
    const players = results.map((row: any) => this.parsePlayer(row));
    
    // Resolve skins for all players (Mojang API since they're offline)
    await Promise.all(players.map(async (player: any) => {
      player.skin = await resolveSkinUrl(player);
    }));
    
    return players;
  },

  // Server population with RCON verification
  async getServerPopulation(useRconVerification: boolean = false): Promise<any[]> {
    if (useRconVerification) {
      // Use RCON to get accurate current populations
      try {
        const { rconManager } = await import('../../server_control/index.js');
        const { SERVER_CONFIG } = await import('../../server_control/serverConfig.js');
        
        const populations = [];
        
        for (const [serverId, config] of Object.entries(SERVER_CONFIG)) {
          if (serverId === 'proxy') continue;
          
          try {
            const response = await rconManager.sendCommand(serverId as any, 'list');
            if (response) {
              const playerCount = response.includes('players online') ? 
                parseInt(response.split(' ')[2]) || 0 : 0;
              
              populations.push({
                server_name: serverId,
                player_count: playerCount,
                server_display_name: config.name
              });
            }
          } catch (error) {
            populations.push({
              server_name: serverId,
              player_count: 0,
              server_display_name: config.name,
              status: 'offline'
            });
          }
        }
        
        return populations.sort((a, b) => b.player_count - a.player_count);
      } catch (error) {
        // Fallback to database method
      }
    }
    
    // Database method (potentially inaccurate)
    const db = await getPlayerDatabase();
    return await db.all(`
      SELECT 
        last_server as server_name,
        COUNT(*) as player_count
      FROM players 
      WHERE is_online = 1 AND last_server IS NOT NULL
      GROUP BY last_server
      ORDER BY player_count DESC
    `);
  },

  // Active sessions with enhanced data
  async getActiveSessions(): Promise<any[]> {
    const db = await getPlayerDatabase();
    return await db.all(`
      SELECT ps.*, p.username, p.platform, p.is_floodgate_player,
        (strftime('%s', 'now') * 1000 - ps.join_time) as current_duration
      FROM player_sessions ps
      JOIN players p ON ps.player_uuid = p.uuid
      WHERE ps.quit_time IS NULL
      ORDER BY ps.join_time DESC
    `);
  },

  // Recent sessions with enhanced data
  async getRecentSessions(hours: number = 24): Promise<any[]> {
    const db = await getPlayerDatabase();
    const since = Date.now() - (hours * 60 * 60 * 1000);
    
    return await db.all(`
      SELECT ps.*, p.username, p.platform, p.is_floodgate_player 
      FROM player_sessions ps
      JOIN players p ON ps.player_uuid = p.uuid
      WHERE ps.join_time > ?
      ORDER BY ps.join_time DESC
    `, [since]);
  },

  // Platform statistics
  async getPlatformStats(): Promise<{
    total: number;
    java: number;
    bedrock: number;
    unknown: number;
    online_java: number;
    online_bedrock: number;
  }> {
    const db = await getPlayerDatabase();
    
    const total = await db.get('SELECT COUNT(*) as count FROM players');
    const java = await db.get("SELECT COUNT(*) as count FROM players WHERE platform = 'JAVA'");
    const bedrock = await db.get("SELECT COUNT(*) as count FROM players WHERE platform = 'BEDROCK' OR is_floodgate_player = 1");
    const unknown = await db.get("SELECT COUNT(*) as count FROM players WHERE platform = 'UNKNOWN' OR platform IS NULL");
    const onlineJava = await db.get("SELECT COUNT(*) as count FROM players WHERE is_online = 1 AND platform = 'JAVA'");
    const onlineBedrock = await db.get("SELECT COUNT(*) as count FROM players WHERE is_online = 1 AND (platform = 'BEDROCK' OR is_floodgate_player = 1)");
    
    return {
      total: total?.count || 0,
      java: java?.count || 0,
      bedrock: bedrock?.count || 0,
      unknown: unknown?.count || 0,
      online_java: onlineJava?.count || 0,
      online_bedrock: onlineBedrock?.count || 0
    };
  },

  // Delete player stub (not supported in read-only mode)
  async deletePlayer(uuid: string): Promise<void> {
    throw new Error('Backend is read-only. Player deletion not supported.');
  },

  // Get player skin path stub (skins handled dynamically)
  async getPlayerSkinPath(uuid: string): Promise<string | null> {
    const player = await this.findByUUID(uuid);
    return player?.skin || null;
  }
};

// Session operations - READ-ONLY
export const sessionOps = {
  // Get player sessions
  async getPlayerSessions(uuid: string, limit: number = 50): Promise<SessionData[]> {
    const db = await getPlayerDatabase();
    return await db.all(`
      SELECT * FROM player_sessions 
      WHERE player_uuid = ?
      ORDER BY join_time DESC 
      LIMIT ?
    `, [uuid, limit]);
  },

  // Get active session for player
  async getActiveSession(uuid: string): Promise<SessionData | null> {
    const db = await getPlayerDatabase();
    const result = await db.get(`
      SELECT * FROM player_sessions 
      WHERE player_uuid = ? AND quit_time IS NULL
      ORDER BY join_time DESC 
      LIMIT 1
    `, [uuid]);
    return result || null;
  }
};

// OP Management - READ ops.json files only, no database syncing
// permissionOps removed as part of legacy permission manager deprecation.