import { Request, Response } from 'express';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Rcon } from 'rcon-client';
import { Tail } from 'tail';
import { exec } from 'child_process';
import fetch from 'node-fetch';
import { rconManager } from './rconManager.js';
// Removed crash detection imports per request
import { 
  updateServerStatus
} from '../../system/index.js';
import { verifyToken } from '../../auth/services/jwt.js';
import { logAdminAction } from '../../logging/index.js';
import { SERVER_CONFIG, VALID_SERVER_IDS, isValidServerId, ServerId } from '../serverConfig.js';
import { datapackManager } from './datapackManager.js';

/**
 * Server Control Service
 * 
 * Manages Minecraft server operations including start/stop/restart functionality,
 * RCON command execution, log viewing, and crash detection.
 * Uses systemd for process management and centralized admin logging.
 */

// Store running server processes
const serverProcesses: Map<string, ChildProcess> = new Map();
const logTails: Map<string, Tail> = new Map();

// Cache for UUID lookups to avoid repeated Mojang API calls
const uuidCache: Map<string, string> = new Map();

// Simplified server status cache (no crash state tracking)
const serverStatusCache: Map<string, { status: string, lastCheck: number, playerCount: number }> = new Map();

/**
 * Helper function to check if JAR file exists
 */
async function checkJarExists(serverId: ServerId): Promise<boolean> {
  const config = SERVER_CONFIG[serverId];
  if (!config) return false;
  
  try {
    await fs.access(config.jarPath);
    return true;
  } catch {
    return false;
  }
}

// Minimal systemd status interface
interface SystemdStatus {
  activeState: string;
  subState: string;
}

/**
 * Get comprehensive systemd status for a server
 */
async function getSystemdStatus(serverId: ServerId): Promise<SystemdStatus> {
  const serviceName = `bovisgl-${serverId}`;
  return new Promise((resolve) => {
    exec(`systemctl show ${serviceName} --property=ActiveState,SubState`, (error, stdout) => {
      const status: SystemdStatus = { activeState: 'unknown', subState: 'unknown' };
      if (!error) {
        const lines = stdout.split('\n');
        for (const line of lines) {
          const [key, value] = line.split('=', 2);
            if (!value) continue;
            if (key === 'ActiveState') status.activeState = value;
            if (key === 'SubState') status.subState = value;
        }
      }
      resolve(status);
    });
  });
}

/**
 * Helper function to check if server process is running via systemd with enhanced crash detection
 */
async function isServerRunning(serverId: ServerId): Promise<boolean> {
  const systemdStatus = await getSystemdStatus(serverId);
  const isActive = systemdStatus.activeState === 'active';
  
  // Notify RCON manager about status change for auto-connection
  try {
    await rconManager.onServerStatusChange(serverId, isActive);
  } catch (error) {
    console.error(`Error notifying RCON manager for ${serverId}:`, error);
  }
  
  // Update simplified status cache (no crash detection)
  const previous = serverStatusCache.get(serverId);
  if (isActive) {
    updateServerStatus(serverId, 'online');
    serverStatusCache.set(serverId, { status: 'online', lastCheck: Date.now(), playerCount: (await getPlayerCount(serverId)) || 0 });
  } else if (systemdStatus.activeState === 'activating') {
    updateServerStatus(serverId, 'starting');
    serverStatusCache.set(serverId, { status: 'starting', lastCheck: Date.now(), playerCount: 0 });
  } else if (systemdStatus.activeState === 'deactivating') {
    updateServerStatus(serverId, 'stopping');
    serverStatusCache.set(serverId, { status: 'stopping', lastCheck: Date.now(), playerCount: 0 });
  } else {
    updateServerStatus(serverId, 'offline');
    serverStatusCache.set(serverId, { status: 'offline', lastCheck: Date.now(), playerCount: 0 });
  }
  
  return isActive;
}

/**
 * Simplified server status check using systemctl is-active - for basic status polling
 */
async function isServerActiveSimple(serverId: ServerId): Promise<'active' | 'inactive' | 'failed' | 'unknown'> {
  const serviceName = `bovisgl-${serverId}`;
  
  return new Promise((resolve) => {
    exec(`systemctl is-active ${serviceName}`, (error, stdout, stderr) => {
      const status = stdout.trim();
      
      console.log(`🔍 [${serverId}] systemctl is-active output: "${status}"`);
      
      // Map systemctl is-active outputs to our status types
      switch (status) {
        case 'active':
          resolve('active');
          break;
        case 'inactive':
          resolve('inactive');
          break;
        case 'failed':
          resolve('failed');
          break;
        default:
          console.log(`⚠️ [${serverId}] Unknown systemctl status: "${status}"`);
          resolve('unknown');
          break;
      }
    });
  });
}

// Removed detailed crash-handling function

/**
 * Helper function to get server PID via systemd
 */
async function getServerPid(serverId: ServerId): Promise<number | null> {
  const serviceName = `bovisgl-${serverId}`;
  
  return new Promise((resolve) => {
    exec(`systemctl show --property=MainPID ${serviceName}`, (error, stdout, stderr) => {
      if (error) {
        resolve(null);
        return;
      }
      
      const match = stdout.match(/MainPID=(\d+)/);
      if (match && match[1] !== '0') {
        resolve(parseInt(match[1]));
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Helper function to get player count via RCON - now uses rconManager
 */
async function getPlayerCount(serverId: ServerId): Promise<number | null> {
  // Check if server supports RCON before attempting connection
  const config = SERVER_CONFIG[serverId];
  if (!config || !config.rconPort || !config.rconPassword) {
    // Server doesn't support RCON (like proxy), return null without error
    return null;
  }

  try {
    const response = await rconManager.sendCommand(serverId, 'list');
    if (!response) return null;
    
    // Parse response like "There are 3 of a max of 20 players online:"
    const match = response.match(/There are (\d+) of a max of \d+ players online/);
    return match ? parseInt(match[1]) : null;
  } catch (error) {
    console.error(`Failed to get player count for ${serverId}:`, error);
    return null;
  }
}

/**
 * Helper function to get online players via RCON - now uses rconManager
 */
async function getOnlinePlayersList(serverId: ServerId): Promise<string[]> {
  try {
    const response = await rconManager.sendCommand(serverId, 'list');
    console.log(`🔍 [${serverId}] RCON 'list' response:`, response);
    
    if (!response) {
      console.log(`❌ [${serverId}] No response from RCON list command`);
      return [];
    }
    
    // Parse response to extract player names
    const lines = response.split('\n');
    console.log(`📝 [${serverId}] Response lines:`, lines);
    
    const playerLine = lines.find((line: string) => line.includes('players online:'));
    console.log(`👥 [${serverId}] Player line found:`, playerLine);
    
    if (!playerLine) {
      console.log(`❌ [${serverId}] No line with 'players online:' found`);
      return [];
    }
    
    const playersPart = playerLine.split('players online:')[1];
    console.log(`🎯 [${serverId}] Players part:`, playersPart);
    
    if (!playersPart || playersPart.trim() === '') {
      console.log(`✅ [${serverId}] No players online (empty players part)`);
      return [];
    }
    
    const players = playersPart.split(',').map((name: string) => name.trim()).filter((name: string) => name);
    console.log(`👤 [${serverId}] Parsed players:`, players);
    
    return players;
  } catch (error) {
    console.error(`❌ [${serverId}] Failed to get online players:`, error);
    return [];
  }
}

/**
 * Helper function to extract actual UUID for Bedrock players
 */
function extractBedrockUUID(username: string, floodgateUuid: string): string {
  // If username starts with "." (Geyser prefix), extract XUID from Floodgate UUID
  if (username.startsWith('.')) {
    try {
      // Floodgate UUID format: XXXXXXXX-0000-4000-8000-XXXXXXXXXXXX
      // We need to extract the XUID parts and convert to proper UUID
      
      // Extract the XUID from the Floodgate UUID
      const parts = floodgateUuid.split('-');
      if (parts.length === 5) {
        // For Floodgate UUIDs, the first part contains the XUID high bits
        // and the last part contains the XUID low bits
        const xuidHigh = parts[0]; // First 8 hex chars
        const xuidLow = parts[4];  // Last 12 hex chars
        
        // Create a proper UUID from the XUID
        // Format: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
        const properUuid = `${xuidHigh.substring(0,8)}-${xuidHigh.substring(8,12) || '0000'}-4000-8000-${xuidLow}`;
        console.log(`🔄 Converted Floodgate UUID ${floodgateUuid} to ${properUuid} for ${username}`);
        return properUuid;
      }
    } catch (error) {
      console.error(`Error extracting Bedrock UUID for ${username}:`, error);
    }
  }
  
  // Return original UUID if not Bedrock or extraction failed
  return floodgateUuid;
}

/**
 * Helper function to get detailed player information
 */
async function getDetailedPlayerInfo(serverId: ServerId, playerName: string): Promise<any> {
  try {
    // Get player UUID 
    let uuid = await getPlayerUUID(playerName);
    
    // For Bedrock players (Geyser prefix), extract proper UUID
    if (playerName.startsWith('.')) {
      const extractedUuid = extractBedrockUUID(playerName, uuid);
      console.log(`🎮 Bedrock player ${playerName}: Floodgate UUID ${uuid} -> Extracted UUID ${extractedUuid}`);
      uuid = extractedUuid;
    }
    
  // Permission system removed; default group retained
  const primaryGroup = 'default';
    
    return {
      username: playerName,
      uuid: uuid,
      server: serverId,
      primaryGroup: primaryGroup,
      joinTime: new Date().toISOString(), // Mock - you'd track actual join time
      skinUrl: `https://crafatar.com/avatars/${uuid}?size=128&overlay`,
      headUrl: `https://crafatar.com/avatars/${uuid}?size=64&overlay`,
    };
  } catch (error) {
    console.error(`Failed to get detailed info for ${playerName}:`, error);
    const fallbackUuid = generateMockUUID(playerName);
    return {
      username: playerName,
      uuid: fallbackUuid,
      server: serverId,
      primaryGroup: 'default',
      joinTime: new Date().toISOString(),
      skinUrl: `https://crafatar.com/avatars/${fallbackUuid}?size=128&overlay`,
      headUrl: `https://crafatar.com/avatars/${fallbackUuid}?size=64&overlay`,
    };
  }
}

/**
 * Helper function to get player UUID from Mojang API with caching
 */
async function getPlayerUUID(playerName: string): Promise<string> {
  const lowerName = playerName.toLowerCase();
  
  // Check cache first
  if (uuidCache.has(lowerName)) {
    return uuidCache.get(lowerName)!;
  }
  
  try {
    // First try to fetch from Mojang API
    const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${playerName}`);
    
    if (response.ok) {
      const data = await response.json() as any;
      if (data && data.id) {
        // Format UUID with dashes
        const uuid = data.id;
        const formattedUuid = `${uuid.substr(0, 8)}-${uuid.substr(8, 4)}-${uuid.substr(12, 4)}-${uuid.substr(16, 4)}-${uuid.substr(20, 12)}`;
        
        // Cache the result
        uuidCache.set(lowerName, formattedUuid);
        return formattedUuid;
      }
    }
    
    // Fallback to mock UUID if Mojang API fails
    console.warn(`Could not fetch real UUID for ${playerName}, using mock UUID`);
    const mockUuid = generateMockUUID(playerName);
    uuidCache.set(lowerName, mockUuid);
    return mockUuid;
  } catch (error) {
    console.warn(`Error fetching UUID for ${playerName}:`, error);
    const mockUuid = generateMockUUID(playerName);
    uuidCache.set(lowerName, mockUuid);
    return mockUuid;
  }
}

/**
 * Generate a mock UUID based on player name for demo purposes
 */
function generateMockUUID(playerName: string): string {
  // Create a deterministic UUID-like string based on username
  let hash = 0;
  for (let i = 0; i < playerName.length; i++) {
    const char = playerName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex.substr(0, 8)}-${hex.substr(8, 4) || '0000'}-4${hex.substr(12, 3) || '000'}-8${hex.substr(15, 3) || '000'}-${hex.padEnd(12, '0')}`;
}

/**
 * Helper function to send RCON command - now uses rconManager
 */
async function sendRconCommand(serverId: ServerId, command: string): Promise<string | null> {
  try {
    return await rconManager.sendCommand(serverId, command);
  } catch (error) {
    console.error(`Failed to send RCON command to ${serverId}:`, error);
    return null;
  }
}

/**
 * Helper function to start server via systemd
 */
async function startServerViaSystemd(serverId: ServerId): Promise<{ success: boolean; message: string; error?: string }> {
  const serviceName = `bovisgl-${serverId}`;
  
  return new Promise((resolve) => {
    exec(`sudo systemctl start ${serviceName}`, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          message: `Failed to start ${serviceName}`,
          error: stderr || error.message
        });
      } else {
        resolve({
          success: true,
          message: `${serviceName} started successfully`
        });
      }
    });
  });
}

/**
 * Helper function to stop server via systemd
 */
async function stopServerViaSystemd(serverId: ServerId): Promise<{ success: boolean; message: string; error?: string }> {
  const serviceName = `bovisgl-${serverId}`;
  
  return new Promise((resolve) => {
    exec(`sudo systemctl stop ${serviceName}`, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          message: `Failed to stop ${serviceName}`,
          error: stderr || error.message
        });
      } else {
        resolve({
          success: true,
          message: `${serviceName} stopped successfully`
        });
      }
    });
  });
}

export const serverControlService = {
  // Public routes - for home page
  getAllServersStatus: async (req: Request, res: Response) => {
    try {
      const servers: Record<string, any> = {};
      
      for (const [serverId, config] of Object.entries(SERVER_CONFIG)) {
        // Use simplified status check for basic polling
  let serverStatus = await isServerActiveSimple(serverId as ServerId);
  let isRunning = serverStatus === 'active';

        // Special enhanced detection for Velocity test proxy: if systemd inactive, probe TCP port
        if (serverId === 'test-velocity' && !isRunning) {
          try {
            const net = await import('node:net');
            const probeResult: boolean = await new Promise(resolve => {
              const socket = new net.Socket();
              socket.setTimeout(750);
              socket.once('error', () => { socket.destroy(); resolve(false); });
              socket.once('timeout', () => { socket.destroy(); resolve(false); });
              socket.connect(config.port, '127.0.0.1', () => {
                socket.end();
                resolve(true);
              });
            });
            if (probeResult) {
              isRunning = true;
              serverStatus = 'active';
            }
          } catch (e) {
            // Silent: fallback to systemd status
          }
          // If still not running, inspect latest.log for immediate crash signature
          if (!isRunning) {
            try {
              const fs = await import('node:fs');
              if (fs.existsSync(config.logFile)) {
                const recent = fs.readFileSync(config.logFile, 'utf8');
                if (/forwarding-secret-file does not exist/i.test(recent)) {
                  serverStatus = 'failed'; // treat as crashed for UI
                }
              }
            } catch {}
          }
        }
        const playerCount = isRunning ? await getPlayerCount(serverId as ServerId) : null;
        
        // Simplified status mapping (no separate crashed state)
        let currentStatus: 'online' | 'offline' = 'offline';
        if (serverStatus === 'active') {
          currentStatus = 'online';
        } else {
          // treat failed/inactive/unknown uniformly as offline
          currentStatus = 'offline';
        }
        
        const currentPlayerCount = playerCount || 0;
        
        // Check for status changes and handle crash detection
        const cached = serverStatusCache.get(serverId);
        const previousStatus = cached?.status || 'offline';
        
  // Crash detection removed
        
        // Update cache
        serverStatusCache.set(serverId, {
          status: currentStatus,
          lastCheck: Date.now(),
          playerCount: currentPlayerCount
        });
        
  // Crash info removed
        
        servers[serverId] = {
          name: config.name,
          currentStatus: currentStatus,
          playerCount: currentPlayerCount,
          port: config.port,
          color: config.color,
          // crash fields removed
          // Additional info for frontend debugging
          lastStatusCheck: Date.now(),
          systemdStatus: serverStatus
        };
      }

      res.json(servers);
    } catch (error) {
      console.error('Error fetching server status:', error);
      res.status(500).json({ error: 'Failed to fetch server status' });
    }
  },
  
  getOnlinePlayers: async (req: Request, res: Response) => {
    try {
      const playerData: Record<string, any> = {};
      
      for (const [serverId, config] of Object.entries(SERVER_CONFIG)) {
        const isRunning = await isServerRunning(serverId as ServerId);
        if (isRunning) {
          const playerNames = await getOnlinePlayersList(serverId as ServerId);
          
          // Get detailed info for each player
          const detailedPlayers = await Promise.all(
            playerNames.map(playerName => getDetailedPlayerInfo(serverId as ServerId, playerName))
          );
          
          playerData[serverId] = {
            players: detailedPlayers,
            totalPlayers: detailedPlayers.length
          };
        } else {
          playerData[serverId] = {
            players: [],
            totalPlayers: 0
          };
        }
      }

      res.json(playerData);
    } catch (error) {
      console.error('Error fetching online players:', error);
      res.status(500).json({ error: 'Failed to fetch online players' });
    }
  },



  getPlayerDetails: async (req: Request, res: Response) => {
    try {
      const { uuid } = req.params;
      
      if (!uuid) {
        return res.status(400).json({ error: 'Player UUID is required' });
      }

      // Find which server the player is on (if any)
      let playerServer: ServerId | null = null;
      let playerName: string | null = null;

      for (const serverId of VALID_SERVER_IDS) {
        const isRunning = await isServerRunning(serverId);
        if (isRunning) {
          const players = await getOnlinePlayersList(serverId);
          for (const name of players) {
            const playerUuid = await getPlayerUUID(name);
            if (playerUuid === uuid) {
              playerServer = serverId;
              playerName = name;
              break;
            }
          }
          if (playerServer) break;
        }
      }

      if (!playerServer || !playerName) {
        return res.status(404).json({ error: 'Player not found or not online' });
      }

      // Get detailed player information
      const playerInfo = await getDetailedPlayerInfo(playerServer, playerName);
      
      // Get additional information if available
      let permissions: string[] = [];
      let parents: string[] = [];
      let playtime = 'Unknown';
      let firstJoin = 'Unknown';

      // Permission / group introspection removed
      try {
        // Try to get playtime (if plugin available)
        const playtimeResponse = await rconManager.sendCommand(playerServer, `playtime ${playerName}`);
        if (playtimeResponse && !playtimeResponse.includes('Unknown command')) {
          playtime = playtimeResponse.trim();
        }
      } catch (err) {
        // Playtime plugin not available or command failed
      }

      const detailedInfo = {
        uuid: uuid,
        username: playerName,
        server: playerServer,
        primaryGroup: playerInfo.primaryGroup,
        parents: parents,
        permissions: permissions,
        lastSeen: 'Online now',
        joinTime: playerInfo.joinTime,
        playtime: playtime,
        firstJoin: firstJoin,
        skinUrl: `https://crafatar.com/skins/${uuid}`,
        headUrl: `https://crafatar.com/avatars/${uuid}?size=128`
      };

      res.json(detailedInfo);
    } catch (error) {
      console.error('Error fetching player details:', error);
      res.status(500).json({ error: 'Failed to fetch player details' });
    }
  },
  
  // Locked routes - for admin panel
  getServerStatus: async (req: Request, res: Response) => {
    try {
      const { id: serverIdParam } = req.params;
      const servers: Record<string, any> = {};
      
      // If serverId is provided, validate it first
      if (serverIdParam && !isValidServerId(serverIdParam)) {
        return res.status(404).json({ error: `Server '${serverIdParam}' not found. Valid servers: ${VALID_SERVER_IDS.join(', ')}` });
      }
      
      // If serverId is provided, get status for that specific server
      const serverIds = serverIdParam ? [serverIdParam as ServerId] : VALID_SERVER_IDS;
      
      for (const serverId of serverIds) {
        const config = SERVER_CONFIG[serverId];
        
        const jarExists = await checkJarExists(serverId);
        const systemdStatus = await getSystemdStatus(serverId);
        const isRunning = systemdStatus.activeState === 'active';
        const playerCount = isRunning ? await getPlayerCount(serverId) : null;
        
  // Simplified status determination (no crash state)
  let currentStatus: 'online' | 'offline' | 'starting' | 'stopping' = 'offline';
  let lastExitCode: number | null = null;
  if (systemdStatus.activeState === 'active') currentStatus = 'online';
  else if (systemdStatus.activeState === 'activating') currentStatus = 'starting';
  else if (systemdStatus.activeState === 'deactivating') currentStatus = 'stopping';
  else currentStatus = 'offline';
        
        servers[serverId] = {
          currentStatus: currentStatus,
          name: config.name,
          playerCount: playerCount || 0,
          lastExitCode: lastExitCode,
          crashLogs: [],
          jarExists: jarExists,
          jarPath: config.jarPath,
          port: config.port,
          rconPort: config.rconPort,
          ram: config.ram,
          crashDetectedAt: null,
          systemdState: `${systemdStatus.activeState}/${systemdStatus.subState}`,
        };
      }

      // If requesting a specific server, return just that server's data
      if (serverIdParam) {
        res.json(servers[serverIdParam]);
      } else {
        res.json(servers);
      }
    } catch (error) {
      console.error('Error fetching server status:', error);
      res.status(500).json({ error: 'Failed to fetch server status' });
    }
  },
  
  startServer: async (req: Request, res: Response) => {
    try {
      const { id: serverIdParam } = req.params;
      
      // Validate server ID
      if (!isValidServerId(serverIdParam)) {
        return res.status(404).json({ 
          error: `Server '${serverIdParam}' not found. Valid servers: ${VALID_SERVER_IDS.join(', ')}` 
        });
      }
      
      const serverId = serverIdParam as ServerId;
      const config = SERVER_CONFIG[serverId];
      
      // Check if already running
      const isRunning = await isServerRunning(serverId);
      if (isRunning) {
        return res.status(400).json({ error: `Server ${config.name} is already running` });
      }
      
      // Get client IP and user for logging
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const authToken = req.cookies.auth_token || '';
      const currentUser = verifyToken(authToken);
      
      // Handle datapack management for anarchy server
      if (serverId === 'anarchy') {
        try {
          console.log('🔄 Managing datapacks for anarchy server startup...');
          await datapackManager.manageAnarchyDatapacks();
          console.log('✅ Anarchy datapack management completed');
        } catch (datapackError) {
          console.error('❌ Datapack management failed:', datapackError);
          // Log datapack management failure but continue with server start
          if (currentUser) {
            await logAdminAction(
              currentUser.name,
              'SERVER_START',
              false,
              clientIp,
              `Failed to manage datapacks for ${config.name} server: ${datapackError}`
            );
          }
          // Don't return error - still attempt to start server
        }
      }
      
      // Start the server via systemd
      const result = await startServerViaSystemd(serverId);
      
      if (result.success) {
        // Log successful action
        if (currentUser) {
          const logMessage = serverId === 'anarchy' 
            ? `Started ${config.name} server with datapack management`
            : `Started ${config.name} server`;
          
          await logAdminAction(
            currentUser.name,
            'SERVER_START',
            true,
            clientIp,
            logMessage
          );
        }
        
        res.json({ 
          success: true, 
          message: result.message,
          serverId: serverId,
          serverName: config.name
        });
      } else {
        // Log failed action
        if (currentUser) {
          await logAdminAction(
            currentUser.name,
            'SERVER_START',
            false,
            clientIp,
            `Failed to start ${config.name} server: ${result.error}`
          );
        }
        
        res.status(500).json({ 
          error: result.message,
          details: result.error
        });
      }
    } catch (error: any) {
      const { id: serverIdParam } = req.params;
      console.error(`Error starting server ${serverIdParam}:`, error);
      
      // Log failed action
      try {
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        const currentUser = verifyToken(req.cookies.auth_token || '');
        if (currentUser) {
          await logAdminAction(
            currentUser.name,
            'SERVER_START',
            false,
            clientIp,
            `Server start error: ${error.message}`
          );
        }
      } catch (logError) {
        console.error('Failed to log server start error:', logError);
      }
      
      res.status(500).json({ error: `Failed to start server: ${error.message}` });
    }
  },
  
  stopServer: async (req: Request, res: Response) => {
    try {
      const { id: serverIdParam } = req.params;
      
      // Validate server ID
      if (!isValidServerId(serverIdParam)) {
        return res.status(404).json({ 
          error: `Server '${serverIdParam}' not found. Valid servers: ${VALID_SERVER_IDS.join(', ')}` 
        });
      }
      
      const serverId = serverIdParam as ServerId;
      const config = SERVER_CONFIG[serverId];
      
      // Check if running
      const isRunning = await isServerRunning(serverId);
      if (!isRunning) {
        return res.status(400).json({ error: `Server ${config.name} is not running` });
      }
      
      // Get client IP and user for logging
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const authToken = req.cookies.auth_token || '';
      const currentUser = verifyToken(authToken);
      
      // Stop the server via systemd
      const result = await stopServerViaSystemd(serverId);
      
      if (result.success) {
        // Log successful action
        if (currentUser) {
          await logAdminAction(
            currentUser.name,
            'SERVER_STOP',
            true,
            clientIp,
            `Stopped ${config.name} server`
          );
        }
        
        res.json({ 
          success: true, 
          message: result.message,
          serverId: serverId,
          serverName: config.name
        });
      } else {
        // Log failed action
        if (currentUser) {
          await logAdminAction(
            currentUser.name,
            'SERVER_STOP',
            false,
            clientIp,
            `Failed to stop ${config.name} server: ${result.error}`
          );
        }
        
        res.status(500).json({ 
          error: result.message,
          details: result.error
        });
      }
    } catch (error: any) {
      const { id: serverIdParam } = req.params;
      console.error(`Error stopping server ${serverIdParam}:`, error);
      
      // Log failed action
      try {
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        const currentUser = verifyToken(req.cookies.auth_token || '');
        if (currentUser) {
          await logAdminAction(
            currentUser.name,
            'SERVER_STOP',
            false,
            clientIp,
            `Server stop error: ${error.message}`
          );
        }
      } catch (logError) {
        console.error('Failed to log server stop error:', logError);
      }
      
      res.status(500).json({ error: `Failed to stop server: ${error.message}` });
    }
  },
  
  restartServer: async (req: Request, res: Response) => {
    try {
      const { id: serverIdParam } = req.params;
      
      // Validate server ID
      if (!isValidServerId(serverIdParam)) {
        return res.status(404).json({ 
          error: `Server '${serverIdParam}' not found. Valid servers: ${VALID_SERVER_IDS.join(', ')}` 
        });
      }
      
      const serverId = serverIdParam as ServerId;
      const config = SERVER_CONFIG[serverId];
      const serviceName = `bovisgl-${serverId}`;
      
      // Get client IP and user for logging
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const authToken = req.cookies.auth_token || '';
      const currentUser = verifyToken(authToken);
      
      // Restart via systemd
      const result = await new Promise<{ success: boolean; message: string; error?: string }>((resolve) => {
        exec(`sudo systemctl restart ${serviceName}`, (error, stdout, stderr) => {
          if (error) {
            resolve({
              success: false,
              message: `Failed to restart ${serviceName}`,
              error: stderr || error.message
            });
          } else {
            resolve({
              success: true,
              message: `${serviceName} restarted successfully`
            });
          }
        });
      });
      
      if (result.success) {
        // Log successful action
        if (currentUser) {
          await logAdminAction(
            currentUser.name,
            'SERVER_RESTART',
            true,
            clientIp,
            `Restarted ${config.name} server`
          );
        }
        
        res.json({ 
          success: true, 
          message: result.message,
          serverId: serverId,
          serverName: config.name
        });
      } else {
        // Log failed action
        if (currentUser) {
          await logAdminAction(
            currentUser.name,
            'SERVER_RESTART',
            false,
            clientIp,
            `Failed to restart ${config.name} server: ${result.error}`
          );
        }
        
        res.status(500).json({ 
          error: result.message,
          details: result.error
        });
      }
    } catch (error: any) {
      const { id: serverIdParam } = req.params;
      console.error(`Error restarting server ${serverIdParam}:`, error);
      
      // Log failed action
      try {
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        const currentUser = verifyToken(req.cookies.auth_token || '');
        if (currentUser) {
          await logAdminAction(
            currentUser.name,
            'SERVER_RESTART',
            false,
            clientIp,
            `Server restart error: ${error.message}`
          );
        }
      } catch (logError) {
        console.error('Failed to log server restart error:', logError);
      }
      
      res.status(500).json({ error: `Failed to restart server: ${error.message}` });
    }
  },
  
  killServer: async (req: Request, res: Response) => {
    try {
      const { id: serverIdParam } = req.params;
      
      // Validate server ID
      if (!isValidServerId(serverIdParam)) {
        return res.status(404).json({ 
          error: `Server '${serverIdParam}' not found. Valid servers: ${VALID_SERVER_IDS.join(', ')}` 
        });
      }
      
      const serverId = serverIdParam as ServerId;
      const config = SERVER_CONFIG[serverId];
      const serviceName = `bovisgl-${serverId}`;
      
      // Force kill via systemd
      const result = await new Promise<{ success: boolean; message: string; error?: string }>((resolve) => {
        exec(`sudo systemctl kill ${serviceName}`, (error, stdout, stderr) => {
          if (error) {
            resolve({
              success: false,
              message: `Failed to kill ${serviceName}`,
              error: stderr || error.message
            });
          } else {
            resolve({
              success: true,
              message: `${serviceName} force killed successfully`
            });
          }
        });
      });
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: result.message,
          serverId: serverId,
          serverName: config.name
        });
      } else {
        res.status(500).json({ 
          error: result.message,
          details: result.error
        });
      }
    } catch (error) {
      console.error('Error killing server:', error);
      res.status(500).json({ error: 'Failed to kill server' });
    }
  },
  
  forceStopServer: async (req: Request, res: Response) => {
    // Alias for killServer
    return serverControlService.killServer(req, res);
  },
  
  // RCON command endpoint
  sendCommand: async (req: Request, res: Response) => {
    try {
      const { id: serverIdParam } = req.params;
      const { command } = req.body;
      
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }
      
      // Validate server ID
      if (!isValidServerId(serverIdParam)) {
        return res.status(404).json({ 
          error: `Server '${serverIdParam}' not found. Valid servers: ${VALID_SERVER_IDS.join(', ')}` 
        });
      }
      
      const serverId = serverIdParam as ServerId;
      const config = SERVER_CONFIG[serverId];
      
      // Explicitly block proxy – it has no RCON support and should not accept commands
    if (serverId === 'proxy' || serverId === 'test-velocity') {
        return res.status(400).json({ 
      error: 'This server does not support RCON command execution',
          serverId: serverId,
          serverName: config.name
        });
      }
      
      // Only non-proxy servers support direct RCON commands
      
      const isRunning = await isServerRunning(serverId);
      if (!isRunning) {
        return res.status(400).json({ error: `Server ${config.name} is not running` });
      }
      
      try {
        const response = await sendRconCommand(serverId, command);
        if (response === null) {
          return res.status(500).json({ 
            error: 'Failed to send command via RCON',
            details: 'RCON connection failed or server not responding'
          });
        }
        
        res.json({
          success: true,
          serverId: serverId,
          serverName: config.name,
          command: command,
          response: response,
          timestamp: new Date().toISOString()
        });
      } catch (rconError) {
        console.error(`RCON command error for ${serverId}:`, rconError);
        res.status(500).json({ 
          error: 'Failed to send command via RCON',
          details: rconError instanceof Error ? rconError.message : 'Unknown RCON error',
          serverId: serverId,
          serverName: config.name
        });
      }
    } catch (error) {
      console.error('Error in sendCommand endpoint:', error);
      res.status(500).json({ error: 'Failed to send command' });
    }
  },
  
  // Log viewing endpoints
  getLogs: async (req: Request, res: Response) => {
    try {
      const { id: serverIdParam } = req.params;
      const lines = parseInt(req.query.lines as string) || 100;
      
      // Validate server ID
      if (!isValidServerId(serverIdParam)) {
        return res.status(404).json({ 
          error: `Server '${serverIdParam}' not found. Valid servers: ${VALID_SERVER_IDS.join(', ')}` 
        });
      }
      
      const serverId = serverIdParam as ServerId;
      const config = SERVER_CONFIG[serverId];
      
      try {
        // Use rconManager to get logs
        const result = await rconManager.getLogs(serverId, lines);
        
        res.json({
          success: true,
          serverId: serverId,
          serverName: config.name,
          logs: result.logs,
          totalLines: result.totalLines,
          timestamp: new Date().toISOString()
        });
      } catch (logError) {
        console.error(`Error fetching logs for ${serverId}:`, logError);
        res.status(500).json({ 
          error: 'Failed to fetch logs',
          details: logError instanceof Error ? logError.message : 'Unknown error',
          serverId: serverId,
          serverName: config.name
        });
      }
    } catch (error) {
      console.error('Error in getLogs endpoint:', error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  },
  
  // Crash report endpoints removed
  
  markFixed: async (req: Request, res: Response) => {
    try {
      const { id: serverIdParam } = req.params;
      
      // Validate server ID
      if (!isValidServerId(serverIdParam)) {
        return res.status(404).json({ 
          error: `Server '${serverIdParam}' not found. Valid servers: ${VALID_SERVER_IDS.join(', ')}` 
        });
      }
      
      const serverId = serverIdParam as ServerId;
      const config = SERVER_CONFIG[serverId];
      
      // This could be used to mark a server as "fixed" in a database
      // For now, just return success
      res.json({
        success: true,
        message: `${config.name} marked as fixed`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking server as fixed:', error);
      res.status(500).json({ error: 'Failed to mark server as fixed' });
    }
  },
  
  // Early warnings endpoints removed
  
  // Crash statistics endpoint removed
}; 