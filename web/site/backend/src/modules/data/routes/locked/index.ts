import { Router } from 'express';

import { playerOps, sessionOps, initPlayerDatabase } from '../../../player/index.js';
import { logAdminAction } from '../../../logging/index.js';
import { verifyToken } from '../../../auth/services/jwt.js';

import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Initialize player database
initPlayerDatabase().catch(console.error);

// All data routes require authentication

// Get all players with online/offline filtering (unified - no duplicates)
// Proxies to communications service which is the single source of truth
router.get('/players', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 1000;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string; // 'online', 'offline', or 'all'
    const verifyOnline = req.query.verifyOnline === 'true';
    const platform = req.query.platform as string;
    
    console.log(`📊 Player request: status=${status}, platform=${platform}, verifyOnline=${verifyOnline}, limit=${limit}, offset=${offset}`);
    
    // Call communications service (single source of truth for player data)
    // Use same base URL as admin players proxy
    const commsBase = process.env.COMMS_BASE || process.env.BOVISGL_COMMS || 'http://localhost:3456';
    
    // Get the communications admin token (backend talks to communications, not frontend JWT)
    const commsAdminToken = process.env.COMMS_ADMIN_TOKEN || process.env.ADMIN_TOKEN || 'dev-admin';
    
    const comUrl = new URL(`${commsBase}/api/locked/admin/players`);
    const comRes = await fetch(comUrl.toString(), {
      headers: { 'X-Admin-Token': commsAdminToken }
    });
    
    if (!comRes.ok) {
      console.error(`❌ Communications service error: ${comRes.status}`);
      return res.status(comRes.status).json({ error: 'Failed to fetch players from communications service' });
    }
    
    const rawPlayers = await comRes.json();
    let players = Array.isArray(rawPlayers) ? rawPlayers : (rawPlayers.players || []);
    let total = players.length;
    
    console.log(`✅ Got ${players.length} players from communications service (before filtering)`);
    console.log(`📋 Players: ${players.map((p: any) => `${p.name}(online=${p.online})`).join(', ')}`);

    
    // Apply status filtering
    switch (status) {
      case 'online':
        players = players.filter((p: any) => p.online === true);
        total = players.length;
        break;
      case 'offline':
        players = players.filter((p: any) => p.online !== true);
        total = players.length;
        break;
    }
    
    // Apply limit and offset
    if (offset > 0) {
      players = players.slice(offset);
    }
    if (limit > 0) {
      players = players.slice(0, limit);
    }
    
    // Transform communications data to match frontend expectations
    // Communications service stores online players in memory and offline players come from DB
    const formattedPlayers = players.map((player: any) => ({
      // Core player info from communications
      uuid: player.uuid,
      username: player.name,
      name: player.name,
      
      // Online status (from in-memory session store)
      online: player.online || false,
      is_online_bool: player.online || false,
      currentServer: player.currentServer || null,
      current_server: player.currentServer || null,
      currentClient: player.currentClient || null,
      
      // Account type (detected by UUID)
      accountType: player.accountType || null,
      account_type: player.accountType || null,
      
      // Session timing
      lastJoinTs: player.lastJoinTs || null,
      lastJoinClient: player.lastJoinClient || null,
      lastLeaveTs: player.lastLeaveTs || null,
      lastLeaveClient: player.lastLeaveClient || null,
      lastActiveTs: player.lastActiveTs || 0,
      lastSeenLabel: player.lastSeen || null,
      
      // Clients array
      clients: Array.isArray(player.clients) ? player.clients : [],
      
      // Ban status
      banned: player.banned || false,
      ban: player.ban || null,
      
      // Additional fields (may not be in communications data)
      first_join: player.lastJoinTs || player.lastActiveTs || Date.now(),
      last_seen: player.lastLeaveTs || player.lastActiveTs || Date.now(),
      playtime: 0, // Not tracked by communications service
      platform: 'JAVA', // Default, can be enhanced later
      platform_display: 'Java'
    }));
    
    // Count online players
    const onlineCount = formattedPlayers.filter((p: any) => p.online).length;
    const offlineCount = total - onlineCount;
    
    res.json({
      players: formattedPlayers,
      total,
      online_count: onlineCount,
      offline_count: offlineCount,
      limit,
      offset,
      status: status || 'all',
      platform: platform || 'all',
      verified_online: verifyOnline
    });
  } catch (error: any) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Get online players (real-time)
router.get('/players/online', async (req, res) => {
  try {
    const onlinePlayers = await playerOps.getOnlinePlayers();
    res.json(onlinePlayers);
  } catch (error: any) {
    console.error('Error fetching online players:', error);
    res.status(500).json({ error: 'Failed to fetch online players' });
  }
});

// Get offline players (for permissions page)
router.get('/players/offline', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const players = await playerOps.getOfflinePlayers(limit);
    
    const formattedPlayers = players.map(player => ({
      ...player,
      first_join_date: new Date(player.first_join).toISOString(),
      last_seen_date: new Date(player.last_seen).toISOString(),
      hours_played: Math.round((player.playtime / 1000 / 60 / 60) * 100) / 100,
      days_since_last_seen: Math.floor((Date.now() - player.last_seen) / (1000 * 60 * 60 * 24))
    }));
    
    res.json({
      offline_players: formattedPlayers,
      count: formattedPlayers.length,
      limit
    });
  } catch (error: any) {
    console.error('Error fetching offline players:', error);
    res.status(500).json({ error: 'Failed to fetch offline players' });
  }
});

// Search players (unified - no duplicates)
router.get('/players/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 100;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    // Use unified search to prevent duplicates
    const players = await playerOps.searchPlayersUnified(query, limit);
    
    const formattedPlayers = players.map(player => ({
      ...player,
      first_join_date: new Date(player.first_join).toISOString(),
      last_seen_date: new Date(player.last_seen).toISOString(),
      hours_played: Math.round((player.playtime / 1000 / 60 / 60) * 100) / 100,
      is_online_bool: player.is_online === 1,
      days_since_last_seen: Math.floor((Date.now() - player.last_seen) / (1000 * 60 * 60 * 24))
    }));
    
    res.json({
      players: formattedPlayers,
      query,
      count: players.length
    });
  } catch (error: any) {
    console.error('Error searching players:', error);
    res.status(500).json({ error: 'Failed to search players' });
  }
});

// Get specific player by UUID with detailed stats
router.get('/players/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const stats = await playerOps.getPlayerStats(uuid);
    
    if (!stats) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    res.json({
      player: stats,
      is_online: stats.is_online === 1,
      formatted_playtime: `${Math.floor(stats.hours_played)} hours`,
      days_since_first_join: Math.floor((Date.now() - stats.first_join) / (1000 * 60 * 60 * 24)),
      days_since_last_seen: Math.floor((Date.now() - stats.last_seen) / (1000 * 60 * 60 * 24))
    });
  } catch (error: any) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

// Get player sessions
router.get('/players/:uuid/sessions', async (req, res) => {
  try {
    const { uuid } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const sessions = await sessionOps.getPlayerSessions(uuid, limit);
    const activeSession = await sessionOps.getActiveSession(uuid);
    
    const formattedSessions = sessions.map(session => ({
      ...session,
      join_time_date: new Date(session.join_time).toISOString(),
      quit_time_date: session.quit_time ? new Date(session.quit_time).toISOString() : null,
      duration_minutes: session.session_duration ? Math.round(session.session_duration / 1000 / 60) : null,
      is_active: !session.quit_time
    }));
    
    res.json({
      sessions: formattedSessions,
      active_session: activeSession ? {
        ...activeSession,
        join_time_date: new Date(activeSession.join_time).toISOString(),
        current_duration: Date.now() - activeSession.join_time,
        current_duration_minutes: Math.round((Date.now() - activeSession.join_time) / 1000 / 60)
      } : null,
      total_sessions: sessions.length
    });
  } catch (error: any) {
    console.error('Error fetching player sessions:', error);
    res.status(500).json({ error: 'Failed to fetch player sessions' });
  }
});

// Get server population and active sessions
router.get('/servers/population', async (req, res) => {
  try {
    const population = await playerOps.getServerPopulation();
    const activeSessions = await playerOps.getActiveSessions();
    
    res.json({
      server_population: population,
      active_sessions: activeSessions.map(session => ({
        ...session,
        join_time_date: new Date(session.join_time).toISOString(),
        duration_minutes: Math.round(session.current_duration / 1000 / 60)
      })),
      total_online: population.reduce((sum, server) => sum + server.player_count, 0)
    });
  } catch (error: any) {
    console.error('Error fetching server population:', error);
    res.status(500).json({ error: 'Failed to fetch server population' });
  }
});

// Get recent sessions (last 24 hours by default)
router.get('/sessions/recent', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const sessions = await playerOps.getRecentSessions(hours);
    
    const formattedSessions = sessions.map(session => ({
      ...session,
      join_time_date: new Date(session.join_time).toISOString(),
      quit_time_date: session.quit_time ? new Date(session.quit_time).toISOString() : null,
      duration_minutes: session.session_duration ? Math.round(session.session_duration / 1000 / 60) : null,
      is_active: !session.quit_time
    }));
    
    res.json({
      recent_sessions: formattedSessions,
      hours_back: hours,
      count: sessions.length
    });
  } catch (error: any) {
    console.error('Error fetching recent sessions:', error);
    res.status(500).json({ error: 'Failed to fetch recent sessions' });
  }
});



// Delete player (admin only)
router.delete('/players/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    
    const player = await playerOps.findByUUID(uuid);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    await playerOps.deletePlayer(uuid);
    
    res.json({ 
      success: true, 
      message: `Player ${player.username} deleted` 
    });
  } catch (error: any) {
    console.error('Error deleting player:', error);
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

// Get player details (for permissions page) with enhanced cross-platform support
router.get('/players/:uuid/details', async (req, res) => {
  try {
    const { uuid } = req.params;
    const verifyOnline = req.query.verifyOnline === 'true';
    
    const player = await playerOps.findByUUID(uuid, verifyOnline);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
  // Permissions removed; default primary group logic simplified
  const primaryGroup = 'default';
    
    // Calculate formatted dates and times
    const lastSeenDate = new Date(player.last_seen);
    const firstJoinDate = new Date(player.first_join);
    const hoursPlayed = player.playtime / (1000 * 60 * 60);
    
    // Determine actual online status
    const actuallyOnline = verifyOnline ? player.isActuallyOnline : Boolean(player.is_online);
    const currentServer = verifyOnline ? player.currentServer : player.last_server;
    
    const playerDetails = {
      uuid: player.uuid,
      username: player.username,
      server: actuallyOnline ? (currentServer || 'Online') : 'Offline',
      primaryGroup: primaryGroup,
      parents: [],
  permissions: [],
      lastSeen: actuallyOnline ? 'Online now' : lastSeenDate.toLocaleString(),
      joinTime: actuallyOnline ? 'Online now' : 'N/A',
      playtime: `${hoursPlayed.toFixed(1)} hours`,
      firstJoin: firstJoinDate.toLocaleString(),
      isOnline: actuallyOnline,
      daysSinceLastSeen: actuallyOnline ? 0 : Math.floor((Date.now() - player.last_seen) / (1000 * 60 * 60 * 24)),
      
      // Enhanced cross-platform information
      platform: player.platform || 'Unknown',
      is_bedrock_player: player.is_floodgate_player === 1 || player.platform === 'BEDROCK',
      is_floodgate_player: player.is_floodgate_player === 1,
      client_version: player.client_version || 'Unknown',
      bedrock_uuid: player.bedrock_uuid,
      bedrock_username: player.is_floodgate_player === 1 && player.username.startsWith('.') ? 
        player.username.substring(1) : null,
      
      // Skin information
      skin_url: player.skin,
      has_custom_skin: !!player.skin_data,
      
      // Online verification info
      verified_online: verifyOnline,
      rcon_verified_server: player.currentServer
    };
    
    res.json(playerDetails);
  } catch (error: any) {
    console.error('Error fetching player details:', error);
    res.status(500).json({ error: 'Failed to fetch player details' });
  }
});

// Serve player skins by UUID
router.get('/players/:uuid/skin', async (req, res) => {
  try {
    const { uuid } = req.params;
    const skinPath = await playerOps.getPlayerSkinPath(uuid);
    
    if (!skinPath) {
      return res.status(404).json({ error: 'Skin not found' });
    }
    
    res.sendFile(skinPath);
  } catch (error: any) {
    console.error('Error serving player skin:', error);
    res.status(500).json({ error: 'Failed to serve skin' });
  }
});

// Serve player skins by username
router.get('/players/username/:username/skin', async (req, res) => {
  try {
    const { username } = req.params;
    
    // First, try to find the player by username to get their UUID
    const player = await playerOps.findByUsername(username);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const skinPath = await playerOps.getPlayerSkinPath(player.uuid);
    
    if (!skinPath) {
      return res.status(404).json({ error: 'Skin not found' });
    }
    
    res.sendFile(skinPath);
  } catch (error: any) {
    console.error('Error serving player skin by username:', error);
    res.status(500).json({ error: 'Failed to serve skin' });
  }
});
// Legacy permission endpoints removed.

// Get welcome message history
router.get('/players/:uuid/welcome-history', async (req, res) => {
  try {
    // Deprecated endpoint retained for backward compatibility; returns empty history.
    res.json({ history: [], deprecated: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch welcome history' });
  }
});

  // Permission endpoints removed; welcome history feature deprecated.

// Get player game version detection (Bedrock vs Java)
router.get('/players/:uuid/game-version', async (req, res) => {
  try {
    const { uuid } = req.params;
    
    const player = await playerOps.findByUUID(uuid);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const gameVersion = await detectPlayerGameVersion(player.username, uuid);
    
    res.json({
      uuid,
      username: player.username,
      gameVersion: gameVersion.type,
      confidence: gameVersion.confidence,
      details: gameVersion.details,
      uuids: gameVersion.uuids
    });
    
  } catch (error: any) {
    console.error('Error detecting game version:', error);
    res.status(500).json({ error: 'Failed to detect game version' });
  }
});

// Bulk game version detection for multiple players
router.post('/players/game-versions', async (req, res) => {
  try {
    console.log('🎮 Game version detection request received');
    console.log('📋 Request body:', req.body);
    
    const { uuids } = req.body;
    
    if (!Array.isArray(uuids) || uuids.length === 0) {
      console.log('❌ Invalid UUIDs array:', uuids);
      return res.status(400).json({ error: 'UUIDs array is required' });
    }
    
    console.log(`🔍 Processing game version detection for ${uuids.length} UUIDs:`, uuids);
    
    const results: Record<string, any> = {};
    
    // Process in parallel but limit concurrency to avoid API rate limits
    const batchSize = 5;
    for (let i = 0; i < uuids.length; i += batchSize) {
      const batch = uuids.slice(i, i + batchSize);
      const batchPromises = batch.map(async (uuid: string) => {
        try {
          const player = await playerOps.findByUUID(uuid);
          if (player) {
            const gameVersion = await detectPlayerGameVersion(player.username, uuid);
            return { uuid, result: gameVersion };
          }
          return { uuid, result: null };
        } catch (error) {
          console.error(`Error processing UUID ${uuid}:`, error);
          return { uuid, result: null };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ uuid, result }) => {
        if (result) {
          results[uuid] = result;
        }
      });
    }
    
    console.log(`✅ Game version detection complete. Results for ${Object.keys(results).length} players:`, results);
    res.json({ results });
    
  } catch (error: any) {
    console.error('❌ Error bulk detecting game versions:', error);
    res.status(500).json({ error: 'Failed to detect game versions' });
  }
});

// Helper function to detect player game version
async function detectPlayerGameVersion(username: string, uuid: string): Promise<{
  type: 'bedrock' | 'java' | 'unknown',
  confidence: 'high' | 'medium' | 'low',
  details: {
    hasGeyserPrefix: boolean,
    hasFloodgateUuid: boolean,
    mojangApiFound: boolean,
    bedrockApiFound: boolean,
    reasoning: string[]
  },
  uuids: {
    current: string,
    mojang?: string,
    bedrock?: string,
    geyser?: string
  }
}> {
  const reasoning: string[] = [];
  const uuids: any = { current: uuid };
  
  // Check for Geyser prefix (starts with ".")
  const hasGeyserPrefix = username.startsWith('.');
  if (hasGeyserPrefix) {
    reasoning.push('Username starts with "." (Geyser prefix)');
  }
  
  // Check for Floodgate UUID pattern (00000000-0000-0000-XXXX-XXXXXXXXXXXX)
  const hasFloodgateUuid = uuid.startsWith('00000000-0000-0000-');
  if (hasFloodgateUuid) {
    reasoning.push('UUID matches Floodgate pattern');
    uuids.geyser = uuid;
  }
  
  // Clean username for API calls (remove Geyser prefix)
  const cleanUsername = hasGeyserPrefix ? username.substring(1) : username;
  
  let mojangApiFound = false;
  let bedrockApiFound = false;
  
  try {
    // Check Mojang API
    const mojangResponse = await fetch(`https://api.mojang.com/users/profiles/minecraft/${cleanUsername}`);
    if (mojangResponse.ok) {
      const mojangData = await mojangResponse.json();
      if (mojangData?.id) {
        mojangApiFound = true;
        const formattedMojangUuid = formatUuid(mojangData.id);
        uuids.mojang = formattedMojangUuid;
        reasoning.push('Player found in Mojang API (Java Edition)');
      }
    }
  } catch (error) {
    console.log(`Mojang API check failed for ${cleanUsername}:`, error);
  }
  
  try {
    // Check for Bedrock indicators
    if (hasGeyserPrefix || hasFloodgateUuid) {
      // If it has Floodgate UUID pattern, it's definitely from Geyser/Floodgate (Bedrock)
      if (hasFloodgateUuid) {
        // Extract XUID from Floodgate UUID
        const xuidHex = uuid.substring(19); // Extract the XUID part (after "00000000-0000-0000-")
        const xuidClean = xuidHex.replace(/-/g, ''); // Remove dashes
        
        try {
          // Convert hex XUID to decimal
          const xuid = parseInt(xuidClean, 16);
          if (xuid && xuid > 0) {
            bedrockApiFound = true;
            uuids.bedrock = uuid;
            uuids.geyser = uuid;
            reasoning.push(`Valid XUID extracted from Floodgate UUID: ${xuid}`);
          } else {
            // Even if XUID parsing fails, Floodgate UUID pattern is strong evidence
            bedrockApiFound = true;
            uuids.bedrock = uuid;
            uuids.geyser = uuid;
            reasoning.push('Floodgate UUID pattern detected (Bedrock via Geyser)');
          }
        } catch (xuidError) {
          // Even if XUID parsing fails, Floodgate UUID pattern is strong evidence
          bedrockApiFound = true;
          uuids.bedrock = uuid;
          uuids.geyser = uuid;
          reasoning.push('Floodgate UUID pattern detected (Bedrock via Geyser)');
        }
      } else if (hasGeyserPrefix) {
        // Has Geyser prefix but not Floodgate UUID - still likely Bedrock
        bedrockApiFound = true;
        uuids.bedrock = uuid;
        reasoning.push('Geyser prefix detected (likely Bedrock player)');
      }
    }
  } catch (error) {
    console.log(`Bedrock detection failed for ${cleanUsername}:`, error);
  }
  
  // Determine game version based on evidence
  let type: 'bedrock' | 'java' | 'unknown' = 'unknown';
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  if (hasGeyserPrefix || hasFloodgateUuid) {
    if (bedrockApiFound || hasFloodgateUuid) {
      type = 'bedrock';
      confidence = 'high';
      reasoning.push('Strong Bedrock indicators present');
    } else if (mojangApiFound) {
      // Has Geyser prefix but found in Mojang API - could be Java player with dot in name
      type = 'java';
      confidence = 'medium';
      reasoning.push('Found in Mojang API despite Geyser prefix - likely Java player with "." in name');
    } else {
      type = 'bedrock';
      confidence = 'medium';
      reasoning.push('Has Bedrock indicators but could not confirm via APIs');
    }
  } else if (mojangApiFound && !hasFloodgateUuid) {
    type = 'java';
    confidence = 'high';
    reasoning.push('Found in Mojang API with standard UUID format');
  } else if (!mojangApiFound && !hasGeyserPrefix && !hasFloodgateUuid) {
    type = 'java';
    confidence = 'low';
    reasoning.push('No Bedrock indicators, assuming Java (default)');
  }
  
  return {
    type,
    confidence,
    details: {
      hasGeyserPrefix,
      hasFloodgateUuid,
      mojangApiFound,
      bedrockApiFound,
      reasoning
    },
    uuids
  };
}

// Helper function to format UUID with dashes
function formatUuid(uuid: string): string {
  if (uuid.includes('-')) return uuid;
  return `${uuid.substr(0, 8)}-${uuid.substr(8, 4)}-${uuid.substr(12, 4)}-${uuid.substr(16, 4)}-${uuid.substr(20, 12)}`;
}

// OP Toggle endpoint - RCON for online servers ONLY
router.post('/players/op-toggle', async (req, res) => {
  try {
    const { uuid, username, serverId, action } = req.body;
    
    console.log('🔄 OP Toggle Request (RCON only):');
    console.log(`  Player: ${username} (${uuid})`);
    console.log(`  Server: ${serverId}`);
    console.log(`  Action: ${action}`);
    
    if (!uuid || !username || !serverId || !action) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: uuid, username, serverId, action' });
    }
    
    if (!['add', 'remove'].includes(action)) {
      console.log(`❌ Invalid action: ${action}`);
      return res.status(400).json({ error: 'Action must be "add" or "remove"' });
    }
    
    const player = await playerOps.findByUUID(uuid);
    if (!player) {
      console.log(`❌ Player not found: ${uuid}`);
      return res.status(404).json({ error: 'Player not found' });
    }
    
    console.log(`✅ Player found: ${player.username}`);
    
    // Import required modules
    const { SERVER_CONFIG } = await import('../../../server_control/serverConfig.js');
    const { rconManager } = await import('../../../server_control/index.js');
    
    const results: Record<string, { 
      success: boolean, 
      method: string, 
      error?: string,
      rconResponse?: string
    }> = {};
    
    // Helper function to check if server is running
    const isServerRunning = async (serverIdToCheck: string): Promise<boolean> => {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        const serviceName = `bovisgl-${serverIdToCheck}`;
        const { stdout } = await execAsync(`systemctl is-active ${serviceName}`);
        return stdout.trim() === 'active';
      } catch {
        return false;
      }
    };
    
    // Helper function to try RCON command
    const tryRconCommand = async (serverIdToCheck: string, opAction: string): Promise<{ success: boolean, response?: string, error?: string }> => {
      try {
        const command = opAction === 'add' ? `op ${username}` : `deop ${username}`;
        console.log(`  🎯 Trying RCON: "${command}" on ${serverIdToCheck}`);
        
        const response = await rconManager.sendCommand(serverIdToCheck, command);
        
        if (response && !response.toLowerCase().includes('error') && !response.toLowerCase().includes('failed')) {
          console.log(`  ✅ RCON success on ${serverIdToCheck}: ${response}`);
          return { success: true, response };
        } else {
          console.log(`  ⚠️ RCON responded but may have failed on ${serverIdToCheck}: ${response}`);
          return { success: false, error: `RCON response: ${response}` };
        }
      } catch (error: any) {
        console.log(`  ❌ RCON failed on ${serverIdToCheck}: ${error.message}`);
        return { success: false, error: error.message };
      }
    };
    
    // Handle global OP toggle
    if (serverId === 'global') {
      const serverIds = Object.keys(SERVER_CONFIG).filter(id => id !== 'proxy');
      console.log(`🌐 Global OP toggle for ${serverIds.length} servers: ${serverIds.join(', ')}`);
      
      for (const currentServerId of serverIds) {
        console.log(`\n📋 Processing server: ${currentServerId}`);
        
        // Check if server is online
        const isOnline = await isServerRunning(currentServerId);
        console.log(`  📡 Server ${currentServerId} status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        
        if (isOnline) {
          // Try RCON
          const rconResult = await tryRconCommand(currentServerId, action);
          
          if (rconResult.success) {
            results[currentServerId] = { 
              success: true, 
              method: 'rcon',
              rconResponse: rconResult.response
            };
            console.log(`  ✅ ${currentServerId}: RCON success`);
          } else {
          results[currentServerId] = { 
              success: false, 
              method: 'rcon',
              error: rconResult.error
          };
            console.log(`  ❌ ${currentServerId}: RCON failed`);
          }
        } else {
          // Server offline - fail
          results[currentServerId] = { 
            success: false, 
            method: 'offline',
            error: 'Server offline - OP changes not supported for offline servers'
          };
          console.log(`  ❌ ${currentServerId}: Server offline, OP changes not supported`);
        }
      }
    } else {
      // Handle single server OP toggle
      console.log(`🎯 Single server OP toggle for: ${serverId}`);
      
      // Check if server is online
      const isOnline = await isServerRunning(serverId);
      console.log(`  📡 Server ${serverId} status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      
      if (isOnline) {
        // Try RCON
        const rconResult = await tryRconCommand(serverId, action);
        
        if (rconResult.success) {
          results[serverId] = { 
            success: true, 
            method: 'rcon',
            rconResponse: rconResult.response
          };
          console.log(`  ✅ ${serverId}: RCON success`);
        } else {
            results[serverId] = { 
            success: false, 
            method: 'rcon',
              error: rconResult.error
            };
          console.log(`  ❌ ${serverId}: RCON failed`);
        }
      } else {
        // Server offline - fail
          results[serverId] = { 
            success: false, 
          method: 'offline',
          error: 'Server offline - OP changes not supported for offline servers'
          };
        console.log(`  ❌ ${serverId}: Server offline, OP changes not supported`);
      }
    }
    
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;
    const rconCount = Object.values(results).filter(r => r.method === 'rcon' && r.success).length;
    const offlineCount = Object.values(results).filter(r => r.method === 'offline').length;
    
    console.log('\n📊 Final OP Toggle Summary:');
    console.log(`  Success: ${successCount}/${totalCount} servers`);
    console.log(`  RCON success: ${rconCount} servers`);
    console.log(`  Offline servers: ${offlineCount} servers`);
    console.log(`  Action: ${action.toUpperCase()} OP`);
    console.log(`  Player: ${username}`);
    console.log('  Results:');
    
    Object.entries(results).forEach(([serverIdResult, result]) => {
      const status = result.success ? '✅' : '❌';
      const method = result.method ? `[${result.method}]` : '';
      const info = result.rconResponse ? `RCON: ${result.rconResponse.substring(0, 50)}...` : '';
      const error = result.error ? `Error: ${result.error}` : '';
      console.log(`    ${status} ${serverIdResult} ${method} ${info} ${error}`);
    });
    
    // Determine response message
    let message = '';
    if (successCount === totalCount) {
      message = `OP ${action} completed successfully via RCON for all ${successCount} servers`;
    } else if (successCount > 0) {
      message = `OP ${action} completed for ${successCount}/${totalCount} servers via RCON. ${totalCount - successCount} servers were offline.`;
    } else {
      message = offlineCount > 0 ? 'All servers are offline - OP changes not supported for offline servers' : 'Failed to apply OP changes';
    }
    
    const response = {
      success: successCount > 0,
      results,
      summary: `${action} OP: ${successCount}/${totalCount} servers processed`,
      message,
      uuid,
      username,
      action,
      rconSuccess: rconCount,
      offlineServers: offlineCount
    };
    
    console.log('\n📤 Sending response:', response);
    
    res.json(response);
    
  } catch (error: any) {
    console.log('\n💥 FATAL ERROR in OP toggle:');
    console.log('  Error message:', error.message);
    console.log('  Stack trace:', error.stack);
    console.error('Error in OP toggle:', error);
    res.status(500).json({ error: 'Failed to toggle OP status' });
  }
});

// OP management uses RCON for online servers and ops.json for offline servers

// Ban status endpoint
router.get('/player/:uuid/ban-status', async (req, res) => {
  try {
    const uuid = req.params.uuid;
    
    if (!uuid) {
      return res.status(400).json({ error: 'Player UUID is required' });
    }
    
    // Import ban service
    const { default: banService } = await import('../../services/banService.js');
    
    const banStatus = await banService.getBanStatus(uuid);
    
    res.json(banStatus);
  } catch (error: any) {
    console.error('Error fetching ban status:', error);
    res.status(500).json({ error: 'Failed to fetch ban status' });
  }
});

// Get platform statistics
router.get('/players/platform-stats', async (req, res) => {
  try {
    const stats = await playerOps.getPlatformStats();
    
    // Get RCON-verified online counts if requested
    const verifyOnline = req.query.verifyOnline === 'true';
    let actualOnlineStats = null;
    
    if (verifyOnline) {
      const actuallyOnline = await playerOps.getActuallyOnlinePlayers();
      const javaOnline = actuallyOnline.filter(p => p.platform === 'JAVA').length;
      const bedrockOnline = actuallyOnline.filter(p => 
        p.is_floodgate_player === 1 || p.platform === 'BEDROCK').length;
      
      actualOnlineStats = {
        total_verified_online: actuallyOnline.length,
        java_verified_online: javaOnline,
        bedrock_verified_online: bedrockOnline,
        unknown_verified_online: actuallyOnline.length - javaOnline - bedrockOnline
      };
    }
    
    res.json({
      database_stats: stats,
      rcon_verified_stats: actualOnlineStats,
      verified_online: verifyOnline,
      note: verifyOnline ? 
        'Online counts are RCON-verified and accurate' : 
        'Online counts are from database and may be stale'
    });
  } catch (error: any) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({ error: 'Failed to fetch platform statistics' });
  }
});

// Get Bedrock players specifically
router.get('/players/bedrock', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const verifyOnline = req.query.verifyOnline === 'true';
    
    const bedrockPlayers = await playerOps.getBedrockPlayers(limit);
    
    // Verify online status if requested
    if (verifyOnline) {
      await Promise.all(bedrockPlayers.map(async (player) => {
        const onlineStatus = await playerOps.findByUUID(player.uuid, true);
        if (onlineStatus) {
          player.isActuallyOnline = onlineStatus.isActuallyOnline;
          player.currentServer = onlineStatus.currentServer;
        }
      }));
    }
    
    const formattedPlayers = bedrockPlayers.map(player => ({
      uuid: player.uuid,
      username: player.username,
      bedrock_username: player.username.startsWith('.') ? player.username.substring(1) : player.username,
      floodgate_prefix: player.username.startsWith('.') ? '.' : null,
      platform: player.platform,
      is_floodgate_player: player.is_floodgate_player === 1,
      bedrock_uuid: player.bedrock_uuid,
      client_version: player.client_version || 'Unknown',
      skin_url: player.skin,
      has_custom_skin: !!player.skin_data,
      is_online: verifyOnline ? player.isActuallyOnline : Boolean(player.is_online),
      current_server: verifyOnline ? player.currentServer : player.last_server,
      last_seen: new Date(player.last_seen).toISOString(),
      first_join: new Date(player.first_join).toISOString(),
      hours_played: Math.round((player.playtime / 1000 / 60 / 60) * 100) / 100
    }));
    
    res.json({
      bedrock_players: formattedPlayers,
      total_count: formattedPlayers.length,
      verified_online: verifyOnline,
      online_count: formattedPlayers.filter(p => p.is_online).length,
      floodgate_count: formattedPlayers.filter(p => p.is_floodgate_player).length
    });
  } catch (error: any) {
    console.error('Error fetching Bedrock players:', error);
    res.status(500).json({ error: 'Failed to fetch Bedrock players' });
  }
});

// Get RCON-verified currently online players across all servers
router.get('/players/online/verified', async (req, res) => {
  try {
    console.log('🔍 Fetching RCON-verified online players...');
    
    const onlinePlayers = await playerOps.getActuallyOnlinePlayers();
    
    // Group by server
    const byServer: Record<string, any[]> = {};
    
    onlinePlayers.forEach(player => {
      const server = player.currentServer || 'unknown';
      if (!byServer[server]) {
        byServer[server] = [];
      }
      
      byServer[server].push({
        uuid: player.uuid,
        username: player.username,
        platform: player.platform,
        is_bedrock: player.is_floodgate_player === 1 || player.platform === 'BEDROCK',
        is_floodgate: player.is_floodgate_player === 1,
        bedrock_username: player.username.startsWith('.') ? player.username.substring(1) : null,
        client_version: player.client_version,
        skin_url: player.skin,
        server: server
      });
    });
    
    // Calculate totals
    const totalOnline = onlinePlayers.length;
    const javaOnline = onlinePlayers.filter(p => p.platform === 'JAVA').length;
    const bedrockOnline = onlinePlayers.filter(p => 
      p.is_floodgate_player === 1 || p.platform === 'BEDROCK').length;
    
    res.json({
      players_by_server: byServer,
      totals: {
        total_online: totalOnline,
        java_online: javaOnline,
        bedrock_online: bedrockOnline,
        unknown_online: totalOnline - javaOnline - bedrockOnline
      },
      verification_method: 'RCON UUID-based',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching verified online players:', error);
    res.status(500).json({ error: 'Failed to fetch verified online players' });
  }
});

// Enhanced search with platform filtering
router.get('/players/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const platform = req.query.platform as string;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    
    let players = await playerOps.searchPlayersUnified(query, limit * 2); // Get more to filter
    
    // Filter by platform if specified
    if (platform && platform !== 'all') {
      players = players.filter(player => {
        if (platform === 'BEDROCK') {
          return player.is_floodgate_player === 1 || player.platform === 'BEDROCK';
        }
        return player.platform === platform;
      });
    }
    
    // Limit after filtering
    players = players.slice(0, limit);
    
    const formattedPlayers = players.map(player => ({
      uuid: player.uuid,
      username: player.username,
      display_name: player.username.startsWith('.') ? player.username.substring(1) : player.username,
      platform: player.platform,
      is_bedrock: player.is_floodgate_player === 1 || player.platform === 'BEDROCK',
      is_online: Boolean(player.is_online),
      last_seen: new Date(player.last_seen).toISOString(),
      skin_url: player.skin,
      match_type: query.toLowerCase() === player.username.toLowerCase() ? 'exact' : 'partial'
    }));
    
    res.json({
      search_query: query,
      platform_filter: platform || 'all',
      results: formattedPlayers,
      result_count: formattedPlayers.length
    });
  } catch (error: any) {
    console.error('Error searching players:', error);
    res.status(500).json({ error: 'Failed to search players' });
  }
});

export default router; 