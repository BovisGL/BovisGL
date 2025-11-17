import { Request, Response } from 'express';
import { WebSocket } from 'ws';
import { Rcon } from 'rcon-client';
import { Tail } from 'tail';
import fs from 'fs/promises';
import path from 'path';
import { rconManager } from '../../server_control/index.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend is at web/site/backend, we are in web/site/backend/src/modules/console/services
// BovisGL root is ../../../../../.. from here
const BOVISGL_ROOT = path.resolve(__dirname, '../../../../../..');

// Server configuration - should match serverServices.ts
const SERVER_CONFIG = {
  'proxy': {
    name: 'Proxy',
    workingDir: path.join(BOVISGL_ROOT, 'servers/proxy'),
    rconPort: 25575,
    logFile: path.join(BOVISGL_ROOT, 'servers/proxy/logs/latest.log')
  },
  'hub': {
    name: 'Hub',
    workingDir: path.join(BOVISGL_ROOT, 'servers/hub'),
    rconPort: 25581, // Fixed port conflict with proxy
    logFile: path.join(BOVISGL_ROOT, 'servers/hub/logs/latest.log')
  },
  'parkour': {
    name: 'Parkour',
    workingDir: path.join(BOVISGL_ROOT, 'servers/parkour'),
    rconPort: 25577,
    logFile: path.join(BOVISGL_ROOT, 'servers/parkour/logs/latest.log')
  },
  'anarchy': {
    name: 'Anarchy',
    workingDir: path.join(BOVISGL_ROOT, 'servers/anarchy'),
    rconPort: 25580,
    logFile: path.join(BOVISGL_ROOT, 'servers/anarchy/logs/latest.log')
  },
  'arena': {
    name: 'Arena',
    workingDir: path.join(BOVISGL_ROOT, 'servers/arena'),
    rconPort: 25578,
    logFile: path.join(BOVISGL_ROOT, 'servers/arena/logs/latest.log')
  },
  'civilization': {
    name: 'Civilization',
    workingDir: path.join(BOVISGL_ROOT, 'servers/civilization'),
    rconPort: 25579,
    logFile: path.join(BOVISGL_ROOT, 'servers/civilization/logs/latest.log')
  }
};

// Store active log tails for WebSocket streaming
const activeTails: Map<string, { tail: Tail, clients: Set<WebSocket> }> = new Map();

// Helper function to send RCON command - now uses shared rconManager
async function sendRconCommand(serverId: string, command: string): Promise<string | null> {
  try {
    return await rconManager.sendCommand(serverId, command);
  } catch (error) {
    console.error(`Failed to send RCON command to ${serverId}:`, error);
    return null;
  }
}

// Helper function to read log file
async function readLogFile(serverId: string, lines: number = 100): Promise<string[]> {
  const config = SERVER_CONFIG[serverId as keyof typeof SERVER_CONFIG];
  if (!config || !config.logFile) return [];
  
  try {
    const logContent = await fs.readFile(config.logFile, 'utf-8');
    const logLines = logContent.split('\n').filter(line => line.trim());
    return logLines.slice(-lines); // Get last N lines
  } catch (error) {
    console.error(`Failed to read log file for ${serverId}:`, error);
    return [];
  }
}

// Helper function to get log file size
async function getLogFileSize(serverId: string): Promise<number> {
  const config = SERVER_CONFIG[serverId as keyof typeof SERVER_CONFIG];
  if (!config || !config.logFile) return 0;
  
  try {
    const stats = await fs.stat(config.logFile);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

// Helper function to start log streaming
export function startLogStreaming(serverId: string, ws: WebSocket): void {
  const config = SERVER_CONFIG[serverId as keyof typeof SERVER_CONFIG];
  if (!config || !config.logFile) {
    ws.send(JSON.stringify({ error: 'Server not found or log file not configured' }));
    return;
  }
  
  let tailInfo = activeTails.get(serverId);
  
  if (!tailInfo) {
    // Create new tail instance
    try {
      const tail = new Tail(config.logFile);
      tailInfo = {
        tail: tail,
        clients: new Set()
      };
      
      tail.on('line', (line: string) => {
        const message = JSON.stringify({
          type: 'log',
          serverId: serverId,
          line: line,
          timestamp: new Date().toISOString()
        });
        
        // Send to all connected clients
        tailInfo!.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          } else {
            // Remove dead connections
            tailInfo!.clients.delete(client);
          }
        });
      });
      
      tail.on('error', (error) => {
        console.error(`Log tail error for ${serverId}:`, error);
        const errorMessage = JSON.stringify({
          type: 'error',
          serverId: serverId,
          error: error.message
        });
        
        tailInfo!.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(errorMessage);
          }
        });
      });
      
      activeTails.set(serverId, tailInfo);
    } catch (error) {
      console.error(`Failed to start log tailing for ${serverId}:`, error);
      ws.send(JSON.stringify({ error: 'Failed to start log streaming' }));
      return;
    }
  }
  
  // Add this WebSocket to the clients
  tailInfo.clients.add(ws);
  
  // Send initial confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    serverId: serverId,
    serverName: config.name,
    message: 'Log streaming started'
  }));
  
  // Handle WebSocket close
  ws.on('close', () => {
    tailInfo!.clients.delete(ws);
    
    // If no more clients, stop the tail
    if (tailInfo!.clients.size === 0) {
      tailInfo!.tail.unwatch();
      activeTails.delete(serverId);
    }
  });
}

// Helper function to stop log streaming
export function stopLogStreaming(serverId: string): void {
  const tailInfo = activeTails.get(serverId);
  if (tailInfo) {
    tailInfo.tail.unwatch();
    tailInfo.clients.clear();
    activeTails.delete(serverId);
  }
}

export const consoleService = {
  getServerLogs: async (req: Request, res: Response) => {
    try {
      const { id: serverId } = req.params;
      const lines = parseInt(req.query.lines as string) || 100;
      const search = req.query.search as string;
      
      const config = SERVER_CONFIG[serverId as keyof typeof SERVER_CONFIG];
      if (!config) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      let logLines = await readLogFile(serverId, lines);
      
      // Apply search filter if provided
      if (search) {
        logLines = logLines.filter(line => 
          line.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      const logSize = await getLogFileSize(serverId);
      
      res.json({
        serverId: serverId,
        serverName: config.name,
        lines: logLines,
        totalLines: logLines.length,
        logFileSize: logSize,
        timestamp: new Date().toISOString(),
        searchTerm: search || null
      });
    } catch (error) {
      console.error('Error fetching server logs:', error);
      res.status(500).json({ error: 'Failed to fetch server logs' });
    }
  },
  
  sendRconCommand: async (req: Request, res: Response) => {
    try {
      const { id: serverId } = req.params;
      const { command } = req.body;
      
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }
      
      const config = SERVER_CONFIG[serverId as keyof typeof SERVER_CONFIG];
      if (!config) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      const response = await sendRconCommand(serverId, command);
      if (response === null) {
        return res.status(500).json({ 
          error: 'Failed to send command via RCON',
          details: 'RCON connection failed or server not running'
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
    } catch (error) {
      console.error('Error sending RCON command:', error);
      res.status(500).json({ error: 'Failed to send command' });
    }
  },
  
  getLogStatistics: async (req: Request, res: Response) => {
    try {
      const statistics: Record<string, any> = {};
      
      for (const [serverId, config] of Object.entries(SERVER_CONFIG)) {
        const logSize = await getLogFileSize(serverId);
        const logLines = await readLogFile(serverId, 1000); // Sample last 1000 lines
        
        // Basic log analysis
        const errorCount = logLines.filter(line => 
          line.toLowerCase().includes('error') || 
          line.toLowerCase().includes('exception')
        ).length;
        
        const warnCount = logLines.filter(line => 
          line.toLowerCase().includes('warn')
        ).length;
        
        const playerJoins = logLines.filter(line => 
          line.includes('joined the game')
        ).length;
        
        const playerLeaves = logLines.filter(line => 
          line.includes('left the game')
        ).length;
        
        statistics[serverId] = {
          serverName: config.name,
          logFileSize: logSize,
          totalLines: logLines.length,
          errorCount: errorCount,
          warnCount: warnCount,
          playerJoins: playerJoins,
          playerLeaves: playerLeaves,
          lastActivity: logLines.length > 0 ? new Date().toISOString() : null
        };
      }
      
      res.json({
        statistics: statistics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching log statistics:', error);
      res.status(500).json({ error: 'Failed to fetch log statistics' });
    }
  },
  
  cleanupLogs: async (req: Request, res: Response) => {
    try {
      const { serverId, days } = req.body;
      const maxAge = parseInt(days) || 7; // Default to 7 days
      
      if (serverId && !SERVER_CONFIG[serverId as keyof typeof SERVER_CONFIG]) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      const serversToClean = serverId ? [serverId] : Object.keys(SERVER_CONFIG);
      const results: Record<string, any> = {};
      
      for (const id of serversToClean) {
        const config = SERVER_CONFIG[id as keyof typeof SERVER_CONFIG];
        if (!config) continue;
        
        const logsDir = path.join(config.workingDir, 'logs');
        
        try {
          const files = await fs.readdir(logsDir);
          let cleanedCount = 0;
          let cleanedSize = 0;
          
          for (const file of files) {
            if (file === 'latest.log') continue; // Skip current log
            
            const filePath = path.join(logsDir, file);
            const stats = await fs.stat(filePath);
            const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
            
            if (ageInDays > maxAge) {
              cleanedSize += stats.size;
              await fs.unlink(filePath);
              cleanedCount++;
            }
          }
          
          results[id] = {
            serverName: config.name,
            cleanedFiles: cleanedCount,
            cleanedSize: cleanedSize,
            maxAge: maxAge
          };
        } catch (error) {
          results[id] = {
            serverName: config.name,
            error: `Failed to clean logs: ${error}`
          };
        }
      }
      
      res.json({
        success: true,
        results: results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error cleaning up logs:', error);
      res.status(500).json({ error: 'Failed to cleanup logs' });
    }
  }
};