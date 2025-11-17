import { Rcon } from 'rcon-client';
import fs from 'fs/promises';
import path from 'path';
import { SERVER_CONFIG, ServerId } from '../serverConfig.js';
import { detectAndPreserveCrash } from '../../system/services/crashDetection.js';

// Store active RCON connections
const activeConnections: Map<string, Rcon> = new Map();

// Track last known server status for auto-reconnection
const lastServerStatus: Map<string, boolean> = new Map();

// Track recent crash detections to prevent duplicate crash analysis
const recentCrashDetections: Map<string, number> = new Map();
const CRASH_DETECTION_COOLDOWN = 30000; // 30 seconds cooldown between crash detections

// RCON connection pool to reuse connections
class RconManager {
  private connections: Map<string, Rcon> = new Map();
  private connectionPromises: Map<string, Promise<Rcon>> = new Map();

  // Safely disconnect an RCON connection without throwing errors
  private safeDisconnect(connection: Rcon, serverId: string): void {
    try {
      // Don't even attempt to call end() - just let the connection die naturally
      // The RCON library handles cleanup internally and calling end() causes crashes
      console.log(`Marking RCON connection for ${serverId} as disconnected (not calling end() to prevent crashes)`);
      
      // Just mark it as disconnected in our tracking without calling the library's end() method
      return;
    } catch (e: any) {
      // This catch block should never be reached now, but keeping it for safety
      console.log(`Unexpected error in safeDisconnect for ${serverId}:`, e?.message || 'Unknown error');
    }
  }

  // Safely send RCON command without crashing the backend
  private async safeSend(connection: Rcon, command: string, serverId: string): Promise<string | null> {
    try {
      // Check if connection is destroyed before attempting to send
      if (connection.socket?.destroyed) {
        console.log(`🚫 [${serverId}] RCON connection is destroyed, skipping command: ${command}`);
        this.connections.delete(serverId);
        return null;
      }

      // Attempt to send command with timeout protection
      const result = await Promise.race([
        connection.send(command),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('RCON command timeout')), 5000)
        )
      ]);

      return result;
    } catch (error: any) {
      console.log(`🚨 [${serverId}] Safe RCON send failed for command "${command}": ${error?.message || 'Unknown error'}`);
      
      // Remove the connection from tracking immediately - never try to close it
      this.connections.delete(serverId);
      
      // Don't rethrow the error - return null to indicate failure
      return null;
    }
  }

  // Trigger crash analysis when RCON detects a server crash
  private async triggerCrashAnalysisFromRcon(serverId: ServerId, errorType: string): Promise<void> {
    try {
      // Check if we've already detected a crash for this server recently
      const lastCrashTime = recentCrashDetections.get(serverId) || 0;
      const timeSinceLastCrash = Date.now() - lastCrashTime;
      
      if (timeSinceLastCrash < CRASH_DETECTION_COOLDOWN) {
        console.log(`� RCON crash detection for ${serverId} skipped - recent crash already detected ${Math.round(timeSinceLastCrash/1000)}s ago`);
        return;
      }
      
      // Mark this crash detection attempt
      recentCrashDetections.set(serverId, Date.now());
      
      console.log(`�🚨 RCON detected server crash for ${serverId}: ${errorType}, triggering crash analysis...`);
      
      // Use the crash detection system to analyze the crash
      const crashResult = await detectAndPreserveCrash(serverId, 'crashed', null);
      
      if (crashResult.isCrashed) {
        console.log(`✅ Server ${serverId} flagged as crashed by RCON manager: ${crashResult.reason}`);
      } else {
        console.log(`📝 RCON error for ${serverId} doesn't indicate server crash: ${errorType}`);
        // Remove the crash detection marker since it wasn't actually a crash
        recentCrashDetections.delete(serverId);
      }
    } catch (error) {
      console.error(`❌ Error triggering crash analysis from RCON for ${serverId}:`, error);
      // Remove the crash detection marker on error
      recentCrashDetections.delete(serverId);
    }
  }

  // Clean up old crash detection entries to prevent memory leaks
  private cleanupOldCrashDetections(): void {
    const currentTime = Date.now();
    for (const [serverId, crashTime] of recentCrashDetections.entries()) {
      if (currentTime - crashTime > CRASH_DETECTION_COOLDOWN * 2) { // Clean up entries older than 60 seconds
        recentCrashDetections.delete(serverId);
      }
    }
  }

  // Get or create RCON connection
  private async getConnection(serverId: ServerId): Promise<Rcon | null> {
    // Clean up old crash detection entries periodically
    this.cleanupOldCrashDetections();
    
    const config = SERVER_CONFIG[serverId];
    if (!config || !config.rconPort) {
      console.error(`No RCON configuration for server: ${serverId}`);
      return null;
    }

    // Check if we already have a connection
    const existingConnection = this.connections.get(serverId);
    if (existingConnection && !existingConnection.socket?.destroyed) {
      try {
        // Test the connection safely
        const testResult = await this.safeSend(existingConnection, 'list', serverId);
        if (testResult !== null) {
          return existingConnection;
        }
      } catch (error) {
        // Connection is dead, remove it
        console.log(`RCON connection for ${serverId} is dead, removing...`);
        this.connections.delete(serverId);
        
        // Check if this indicates a server crash (sudden connection loss)
        if (error instanceof Error && 
            (error.message.includes('Timeout') || 
             error.message.includes('ECONNREFUSED') ||
             error.message.includes('Connection') ||
             error.message.includes('socket hang up'))) {
          
          // For timeout errors, don't call safeDisconnect as the library handles cleanup
          if (!error.message.includes('Timeout')) {
            this.safeDisconnect(existingConnection, serverId);
          } else {
            console.log(`Timeout during connection test - letting RCON library handle cleanup for ${serverId}`);
          }
          
          // This could indicate the server crashed - trigger crash analysis
          this.triggerCrashAnalysisFromRcon(serverId, `RCON connection test failed: ${error.message}`);
        } else {
          // For other errors, try to disconnect
          this.safeDisconnect(existingConnection, serverId);
        }
      }
    }

    // Check if we're already creating a connection
    const existingPromise = this.connectionPromises.get(serverId);
    if (existingPromise) {
      try {
        return await existingPromise;
      } catch (error) {
        this.connectionPromises.delete(serverId);
        // Continue to create new connection
      }
    }

    // Create new connection
    const connectionPromise = this.createNewConnection(serverId);
    this.connectionPromises.set(serverId, connectionPromise);

    try {
      const connection = await connectionPromise;
      this.connectionPromises.delete(serverId);
      return connection;
    } catch (error) {
      this.connectionPromises.delete(serverId);
      console.error(`Failed to create RCON connection for ${serverId}:`, error);
      return null;
    }
  }

  private async createNewConnection(serverId: ServerId): Promise<Rcon> {
    const config = SERVER_CONFIG[serverId];
    
    // Ensure RCON credentials are available
    if (!config.rconPort || !config.rconPassword) {
      throw new Error(`Server ${serverId} does not have complete RCON configuration`);
    }
    
    let rcon: Rcon;
    try {
      rcon = new Rcon({
        host: 'localhost',
        port: config.rconPort,
        password: config.rconPassword, // Use password from server config
        timeout: 10000 // 10 second timeout
      });

      await rcon.connect();
    } catch (error: any) {
      console.error(`Failed to create/connect RCON for ${serverId}:`, error?.message || 'Unknown error');
      throw new Error(`RCON connection failed: ${error?.message || 'Unknown error'}`);
    }
    
    // Store the connection
    this.connections.set(serverId, rcon);
    
    // Handle connection events with better error handling
    rcon.on('error', (error) => {
      console.error(`RCON connection error for ${serverId}:`, error?.message || 'Unknown error');
      this.connections.delete(serverId);
      
      // Check if this error indicates a server crash
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('timeout') || 
            errorMsg.includes('connection') || 
            errorMsg.includes('refused') ||
            errorMsg.includes('socket') ||
            errorMsg.includes('end called twice')) {
          // This could indicate the server crashed - trigger crash analysis
          this.triggerCrashAnalysisFromRcon(serverId, `RCON error: ${error.message}`);
        }
      }
    });

    rcon.on('end', () => {
      console.log(`RCON connection ended for ${serverId}`);
      this.connections.delete(serverId);
      
      // Note: Don't trigger crash analysis on 'end' event alone as it could be a clean disconnect
      // We rely on error events and command timeouts to detect crashes
    });

    console.log(`RCON connection established for ${serverId}`);
    return rcon;
  }

  /**
   * Determines if a command should be routed to the proxy server instead of the target server
   * Commands like ban, pardon, and other network-wide moderation commands should go to proxy
   */
  private shouldRouteToProxy(command: string): boolean {
    const lowerCommand = command.toLowerCase().trim();
    
    // Commands that should be routed to proxy (network-wide moderation)
    const proxyCommands = [
      'ban',
      'pardon',
      'ban-ip',
      'pardon-ip',
      'banip',
      'unban',
      'tempban',
      'kick',
      'glist', // Velocity global player list
      'gfind', // Velocity find player across network
      'server', // Velocity server management
      'alert', // Network-wide alerts
      'find', // Find player on network
      'send' // Send player to different server
    ];
    
    // Check if command starts with any proxy command
    for (const proxyCmd of proxyCommands) {
      if (lowerCommand.startsWith(proxyCmd + ' ') || lowerCommand === proxyCmd) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Public method to check if a command would be routed to proxy (for logging/debugging)
   */
  public wouldRouteToProxy(command: string): boolean {
    return this.shouldRouteToProxy(command);
  }

  /**
   * Automatically establish RCON connection when server comes online
   * This is called by the server status checking functions
   */
  async onServerStatusChange(serverId: ServerId, isOnline: boolean): Promise<void> {
    const wasOnline = lastServerStatus.get(serverId) || false;
    lastServerStatus.set(serverId, isOnline);

    // Server just came online - establish RCON connection and process tasks
    if (isOnline && !wasOnline) {
      console.log(`Server ${serverId} came online, establishing RCON connection...`);
      
      // Clear any previous crash detection markers since server is now online
      recentCrashDetections.delete(serverId);
      
      // Wait a bit for server to fully initialize RCON
      setTimeout(async () => {
        try {
          const connection = await this.getConnection(serverId);
          if (connection) {
            console.log(`RCON auto-connection successful for ${serverId}`);
            // Test the connection safely
            await this.safeSend(connection, 'list', serverId);
          } else {
            console.log(`RCON auto-connection failed for ${serverId}, will retry on next status check`);
          }
        } catch (error: any) {
          // Never let RCON connection errors crash the backend
          console.log(`RCON auto-connection error for ${serverId}:`, error?.message || 'Unknown error');
          // Clean up any broken connections
          this.connections.delete(serverId);
        }
      }, 5000); // Wait 5 seconds for RCON to become available
    }
    
    // Server went offline - clean up connection
    else if (!isOnline && wasOnline) {
      console.log(`Server ${serverId} went offline, cleaning up RCON connection...`);
      const connection = this.connections.get(serverId);
      if (connection) {
        this.connections.delete(serverId);
        // Don't call safeDisconnect when server goes offline - 
        // the connection is likely already dead and the library will handle cleanup
        console.log(`RCON connection removed from tracking for offline server ${serverId}`);
      }
    }
  }

  /**
   * Handle server crash by cleaning up RCON connections safely
   * This is called when crash detection identifies a server crash
   */
  async onServerCrash(serverId: ServerId): Promise<void> {
    console.log(`🧹 [RCON] Cleaning up connections for crashed server: ${serverId}`);
    
    try {
      // Remove the connection from tracking - don't call disconnect methods
      // as the server has crashed and connections are likely already dead
      const hadConnection = this.connections.has(serverId);
      this.connections.delete(serverId);
      
      // Also clear any pending connection promises
      this.connectionPromises.delete(serverId);
      
      // Update status tracking
      lastServerStatus.set(serverId, false);
      
      if (hadConnection) {
        console.log(`✅ [RCON] Cleaned up connection tracking for crashed server: ${serverId}`);
      } else {
        console.log(`📝 [RCON] No active connection to clean up for: ${serverId}`);
      }
    } catch (error) {
      console.error(`❌ [RCON] Error during crash cleanup for ${serverId}:`, error);
    }
  }

  /**
   * Proactively establish RCON connections for all online servers
   * Call this during startup or periodically
   */
  async establishConnectionsForOnlineServers(): Promise<void> {
    console.log('Establishing RCON connections for all online servers...');
    
    for (const serverId of Object.keys(SERVER_CONFIG) as ServerId[]) {
      // Establish connections for all servers including proxy
      
      try {
        // Try to establish connection (will check if server is responsive)
        const connection = await this.getConnection(serverId);
        if (connection) {
          console.log(`RCON connection ready for ${serverId}`);
        }
      } catch (error) {
        // This is expected for offline servers
        console.log(`RCON connection not available for ${serverId} (server likely offline)`);
      }
    }
  }

  // Send RCON command to server with smart routing for ban/pardon commands
  async sendCommand(serverId: string, command: string): Promise<string | null> {
    if (!SERVER_CONFIG[serverId as ServerId]) {
      throw new Error(`Unknown server: ${serverId}`);
    }

    // Explicitly prevent attempts to send commands directly to proxy (no RCON support)
    if (serverId === 'proxy') {
      throw new Error('Proxy does not support direct RCON commands');
    }

    // Check if the requested server supports RCON
    const serverConfig = SERVER_CONFIG[serverId as ServerId];
    if (!serverConfig.rconPort || !serverConfig.rconPassword) {
      throw new Error(`Server ${serverId} does not support RCON`);
    }

    // Smart command routing: route ban/pardon commands to proxy instead of individual servers
    // But since proxy doesn't have RCON, route to hub server instead for network commands
    let targetServerId = serverId;
    if (this.shouldRouteToProxy(command)) {
      // Proxy doesn't support RCON, so route network commands to hub server instead
      targetServerId = 'hub';
      console.log(`🔄 Routing network command "${command}" from ${serverId} to hub server (proxy doesn't support RCON)`);
    }

    const connection = await this.getConnection(targetServerId as ServerId);
    if (!connection) {
      throw new Error(`Failed to connect to RCON for ${targetServerId}`);
    }

    try {
      const response = await this.safeSend(connection, command, targetServerId);
      
      if (response === null) {
        console.log(`RCON command failed for ${targetServerId}: ${command}`);
        throw new Error(`RCON command failed for ${targetServerId}`);
      }
      
      // Enhanced logging for RCON commands to ensure they appear in logs
      const logMessage = `[RCON] ${targetServerId}: "${command}" -> ${response ? response.substring(0, 100) : 'No response'}...`;
      console.log(logMessage);
      
      // Log successful routing
      if (targetServerId !== serverId) {
        console.log(`✅ Command "${command}" successfully routed to ${targetServerId} server`);
      }
      
      return response;
    } catch (error) {
      const errorMessage = `[RCON ERROR] ${targetServerId}: "${command}" -> ${error}`;
      console.error(errorMessage);
      
      // Remove the connection from our tracking immediately
      this.connections.delete(targetServerId);
      
      // Check if this error indicates a server crash and trigger analysis
      if (error instanceof Error && 
          (error.message.includes('Timeout') || 
           error.message.includes('End called twice') ||
           error.message.includes('Connection') ||
           error.message.includes('ECONNREFUSED') ||
           error.message.includes('socket hang up'))) {
        
        console.log(`🚨 RCON command failure may indicate server crash for ${targetServerId}`);
        
        // For timeout errors, DON'T call safeDisconnect as the library handles it internally
        if (!error.message.includes('Timeout')) {
          // Only try to disconnect for non-timeout errors
          this.safeDisconnect(connection, targetServerId);
        } else {
          console.log(`Timeout error - letting RCON library handle cleanup for ${targetServerId}`);
        }
        
        // Trigger crash analysis asynchronously so it doesn't delay the response
        this.triggerCrashAnalysisFromRcon(targetServerId as ServerId, `RCON command failed: ${error.message}`).catch(e => {
          console.error(`Error triggering crash analysis for ${targetServerId}:`, e);
        });
        
        // Return null for connection issues - this prevents the backend from crashing
        console.log(`Non-fatal RCON error for ${targetServerId}, continuing operation...`);
        return null;
      }
      
      throw error;
    }
  }

  // Get server logs with proxy-specific filtering
  async getLogs(serverId: string, maxLines: number = 1000): Promise<{ logs: string[], totalLines: number }> {
    const config = SERVER_CONFIG[serverId as ServerId];
    if (!config) {
      throw new Error(`Unknown server: ${serverId}`);
    }

    try {
      const logContent = await fs.readFile(config.logFile, 'utf-8');
      const allLines = logContent.split('\n').filter(line => line.trim());
      
      // Apply different filtering based on server type
      const filteredLines = allLines.filter(line => {
        if (serverId === 'proxy') {
          // For Velocity proxy, keep most logs including RCON commands
          // Only filter out connection spam
          if (line.includes('Thread RCON Client /127.0.0.1 started') ||
              line.includes('Thread RCON Client /127.0.0.1 shutting down')) {
            return false; // Filter out connection spam
          }
          // Keep everything else, especially RCON command logs
          return true;
        } else {
          // For Paper/Spigot servers, filter out RCON spam but keep actual commands
          return !line.includes('RCON Client /127.0.0.1') &&
                 !line.includes('Thread RCON Client /127.0.0.1 started') &&
                 !line.includes('Thread RCON Client /127.0.0.1 shutting down') &&
                 !line.includes('RCON Listener #1/INFO');
        }
      });
      
      // Get the last N lines
      const logs = filteredLines.slice(-maxLines);
      
      return {
        logs: logs,
        totalLines: filteredLines.length
      };
    } catch (error) {
      console.error(`Failed to read logs for ${serverId}:`, error);
      throw new Error(`Failed to read log file: ${error}`);
    }
  }

  // Disconnect all RCON connections
  async disconnectAll(): Promise<void> {
    console.log('Disconnecting all RCON connections...');
    
    // Just clear our tracking - let the RCON library handle the actual cleanup
    // This prevents "End called twice" errors during shutdown
    const connectionCount = this.connections.size;
    this.connections.clear();
    this.connectionPromises.clear();
    
    console.log(`All ${connectionCount} RCON connections removed from tracking (library will handle cleanup)`);
  }

  // Get connection status for all servers
  getConnectionStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    
    for (const serverId of Object.keys(SERVER_CONFIG)) {
      const connection = this.connections.get(serverId);
      status[serverId] = connection ? !connection.socket?.destroyed : false;
    }
    
    return status;
  }

  // Test connection to a specific server
  async testConnection(serverId: string): Promise<boolean> {
    try {
      const result = await this.sendCommand(serverId, 'list');
      return result !== null;
    } catch (error) {
      return false;
    }
  }

  // Get active connection count
  getActiveConnectionCount(): number {
    let activeCount = 0;
    for (const connection of this.connections.values()) {
      if (!connection.socket?.destroyed) {
        activeCount++;
      }
    }
    return activeCount;
  }

  // Check if a server has recent crash detection (useful for coordination with other systems)
  hasRecentCrashDetection(serverId: string): boolean {
    const lastCrashTime = recentCrashDetections.get(serverId) || 0;
    const timeSinceLastCrash = Date.now() - lastCrashTime;
    return timeSinceLastCrash < CRASH_DETECTION_COOLDOWN;
  }

  // Manually clear crash detection marker (useful when other systems handle the crash)
  clearCrashDetectionMarker(serverId: string): void {
    recentCrashDetections.delete(serverId);
    console.log(`🧹 Cleared crash detection marker for ${serverId}`);
  }
}

// Export singleton instance
export const rconManager = new RconManager();

// Export the class for testing
export { RconManager }; 