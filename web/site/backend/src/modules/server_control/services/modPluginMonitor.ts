import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { Tail } from 'tail';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend is at web/site/backend, we are in web/site/backend/src/modules/server_control/services
// BovisGL root is ../../../../../.. from here
const BOVISGL_ROOT = path.resolve(__dirname, '../../../../../..');

interface ServerStatus {
  name: string;
  status: 'online' | 'offline' | 'starting' | 'stopping' | 'crashed' | 'disabled';
  playerCount: number;
  maxPlayers: number;
  lastSeen: Date;
  version?: string;
  uptime?: number;
  crashReason?: string;
}

interface ServerRegistration {
  serverName: string;
  serverType: string;
  host: string;
  port: number;
  maxPlayers: number;
  currentPlayers: number;
  status: string;
  version: string;
  timestamp: number;
}

export class ModPluginMonitor extends EventEmitter {
  private servers: Map<string, ServerStatus> = new Map();
  private logWatchers: Map<string, Tail> = new Map();
  private heartbeatTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly HEARTBEAT_TIMEOUT = 60000; // 1 minute
  private readonly LOG_PATHS = {
    hub: path.join(BOVISGL_ROOT, 'logs/hub.log'),
    anarchy: path.join(BOVISGL_ROOT, 'logs/anarchy.log'),
    civilization: path.join(BOVISGL_ROOT, 'logs/civilization.log'),
    arena: path.join(BOVISGL_ROOT, 'logs/arena.log'),
    parkour: path.join(BOVISGL_ROOT, 'logs/parkour.log'),
    proxy: path.join(BOVISGL_ROOT, 'logs/proxy.log')
  };

  constructor() {
    super();
    this.initializeServers();
    this.startLogMonitoring();
  }

  private initializeServers() {
    // Initialize server statuses
    const serverConfigs = [
      { name: 'hub', maxPlayers: 100 },
      { name: 'anarchy', maxPlayers: 50 },
      { name: 'proxy', maxPlayers: 200 },
      // Disabled servers
      { name: 'civilization', maxPlayers: 50, disabled: true },
      { name: 'arena', maxPlayers: 32, disabled: true },
      { name: 'parkour', maxPlayers: 32, disabled: true }
    ];

    serverConfigs.forEach(config => {
      this.servers.set(config.name, {
        name: config.name,
        status: config.disabled ? 'disabled' : 'offline',
        playerCount: 0,
        maxPlayers: config.maxPlayers,
        lastSeen: new Date()
      });
    });
  }

  private startLogMonitoring() {
    Object.entries(this.LOG_PATHS).forEach(([serverName, logPath]) => {
      this.watchServerLog(serverName, logPath);
    });
  }

  private watchServerLog(serverName: string, logPath: string) {
    try {
      // Check if log file exists
      if (!fs.existsSync(logPath)) {
        console.log(`Log file not found for ${serverName}: ${logPath}`);
        return;
      }

      const tail = new Tail(logPath, { follow: true, fsWatchOptions: { interval: 1000 } });
      
      tail.on('line', (line: string) => {
        this.processLogLine(serverName, line);
      });

      tail.on('error', (error: Error) => {
        console.error(`Error watching log for ${serverName}:`, error);
      });

      this.logWatchers.set(serverName, tail);
      console.log(`Started monitoring logs for ${serverName}`);

    } catch (error) {
      console.error(`Failed to start log monitoring for ${serverName}:`, error);
    }
  }

  private processLogLine(serverName: string, line: string) {
    const server = this.servers.get(serverName);
    if (!server || server.status === 'disabled') return;

    // Update last seen
    server.lastSeen = new Date();

    // Check for server startup
    if (line.includes('Done (') && line.includes('s)! For help, type "help"')) {
      this.updateServerStatus(serverName, 'online');
      this.extractServerInfo(serverName, line);
    }

    // Check for server shutdown
    if (line.includes('Stopping server') || line.includes('Server thread/INFO]: Stopping the server')) {
      this.updateServerStatus(serverName, 'stopping');
    }

    // Check for crashes
    if (line.includes('Encountered an unexpected exception') || 
        line.includes('Exception in server tick loop') ||
        line.includes('java.lang.OutOfMemoryError') ||
        line.includes('Connection reset') && line.includes('IOException')) {
      this.handleServerCrash(serverName, line);
    }

    // Check for player join/leave
    if (line.includes('joined the game') || line.includes('left the game')) {
      this.updatePlayerCount(serverName);
    }

    // Emit log event for real-time monitoring
    this.emit('logLine', { serverName, line, timestamp: new Date() });
  }

  private extractServerInfo(serverName: string, line: string) {
    // Extract startup time and version info
    const timeMatch = line.match(/Done \(([0-9.]+)s\)/);
    if (timeMatch) {
      const startupTime = parseFloat(timeMatch[1]);
      console.log(`${serverName} started in ${startupTime}s`);
    }
  }

  private updateServerStatus(serverName: string, status: ServerStatus['status']) {
    const server = this.servers.get(serverName);
    if (!server) return;

    const oldStatus = server.status;
    server.status = status;
    server.lastSeen = new Date();

    if (oldStatus !== status) {
      console.log(`${serverName} status changed: ${oldStatus} -> ${status}`);
      this.emit('statusChange', { serverName, oldStatus, newStatus: status, timestamp: new Date() });
    }

    // Reset heartbeat timeout
    this.resetHeartbeatTimeout(serverName);
  }

  private handleServerCrash(serverName: string, crashLine: string) {
    const server = this.servers.get(serverName);
    if (!server) return;

    server.status = 'crashed';
    server.crashReason = this.extractCrashReason(crashLine);
    
    console.error(`${serverName} crashed: ${server.crashReason}`);
    this.emit('serverCrash', { serverName, reason: server.crashReason, timestamp: new Date() });
  }

  private extractCrashReason(crashLine: string): string {
    if (crashLine.includes('OutOfMemoryError')) return 'Out of Memory';
    if (crashLine.includes('Connection reset')) return 'Connection Reset';
    if (crashLine.includes('Encountered an unexpected exception')) return 'Unexpected Exception';
    return 'Unknown Crash';
  }

  private updatePlayerCount(serverName: string) {
    // This would need to be enhanced to actually count players
    // For now, we'll rely on heartbeat data from mods/plugins
    const server = this.servers.get(serverName);
    if (server) {
      server.lastSeen = new Date();
    }
  }

  private resetHeartbeatTimeout(serverName: string) {
    const existingTimeout = this.heartbeatTimeouts.get(serverName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.handleHeartbeatTimeout(serverName);
    }, this.HEARTBEAT_TIMEOUT);

    this.heartbeatTimeouts.set(serverName, timeout);
  }

  private handleHeartbeatTimeout(serverName: string) {
    const server = this.servers.get(serverName);
    if (!server || server.status === 'disabled') return;

    if (server.status === 'online') {
      server.status = 'offline';
      console.log(`${serverName} heartbeat timeout - marking as offline`);
      this.emit('statusChange', { 
        serverName, 
        oldStatus: 'online', 
        newStatus: 'offline', 
        timestamp: new Date() 
      });
    }
  }

  // API for mod/plugin registration
  public registerServer(data: ServerRegistration): boolean {
    const server = this.servers.get(data.serverName);
    if (!server || server.status === 'disabled') {
      return false;
    }

    server.status = 'online';
    server.playerCount = data.currentPlayers;
    server.maxPlayers = data.maxPlayers;
    server.version = data.version;
    server.lastSeen = new Date();

    this.resetHeartbeatTimeout(data.serverName);
    
    console.log(`Registered ${data.serverName}: ${data.currentPlayers}/${data.maxPlayers} players`);
    this.emit('serverRegistered', data);
    
    return true;
  }

  public updateHeartbeat(serverName: string, currentPlayers: number): boolean {
    const server = this.servers.get(serverName);
    if (!server || server.status === 'disabled') {
      return false;
    }

    server.playerCount = currentPlayers;
    server.lastSeen = new Date();
    
    if (server.status !== 'online') {
      server.status = 'online';
      this.emit('statusChange', { 
        serverName, 
        oldStatus: 'offline', 
        newStatus: 'online', 
        timestamp: new Date() 
      });
    }

    this.resetHeartbeatTimeout(serverName);
    return true;
  }

  public unregisterServer(serverName: string): boolean {
    const server = this.servers.get(serverName);
    if (!server) return false;

    server.status = 'offline';
    server.playerCount = 0;
    server.lastSeen = new Date();

    const timeout = this.heartbeatTimeouts.get(serverName);
    if (timeout) {
      clearTimeout(timeout);
      this.heartbeatTimeouts.delete(serverName);
    }

    console.log(`Unregistered ${serverName}`);
    this.emit('serverUnregistered', { serverName, timestamp: new Date() });
    
    return true;
  }

  public getServerStatus(serverName: string): ServerStatus | null {
    return this.servers.get(serverName) || null;
  }

  public getAllServerStatuses(): ServerStatus[] {
    return Array.from(this.servers.values());
  }

  public isServerOnline(serverName: string): boolean {
    const server = this.servers.get(serverName);
    return server ? server.status === 'online' : false;
  }

  public getOnlineServers(): string[] {
    return Array.from(this.servers.entries())
      .filter(([_, server]) => server.status === 'online')
      .map(([name, _]) => name);
  }

  public cleanup() {
    // Stop all log watchers
    this.logWatchers.forEach((tail, serverName) => {
      tail.unwatch();
      console.log(`Stopped monitoring logs for ${serverName}`);
    });
    this.logWatchers.clear();

    // Clear all timeouts
    this.heartbeatTimeouts.forEach(timeout => clearTimeout(timeout));
    this.heartbeatTimeouts.clear();
  }
}
