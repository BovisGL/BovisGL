import { Router, Request, Response } from 'express';
import { ModPluginMonitor } from '../services/modPluginMonitor';

const router = Router();
let monitor: ModPluginMonitor;

// Initialize monitor
export function initializeModPluginAPI(monitorInstance: ModPluginMonitor) {
  monitor = monitorInstance;
}

// API endpoint for mod/plugin server registration
router.post('/api/servers/register', (req: Request, res: Response) => {
  try {
    const registrationData = req.body;
    
    // Validate required fields
    const required = ['serverName', 'serverType', 'host', 'port', 'maxPlayers', 'currentPlayers', 'status', 'version'];
    const missing = required.filter(field => !(field in registrationData));
    
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }

    const success = monitor.registerServer(registrationData);
    
    if (success) {
      res.json({
        success: true,
        message: `Server ${registrationData.serverName} registered successfully`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Failed to register server ${registrationData.serverName} (disabled or not found)`
      });
    }
  } catch (error) {
    console.error('Error in server registration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// API endpoint for heartbeat updates
router.post('/api/servers/heartbeat', (req: Request, res: Response) => {
  try {
    const { serverName, currentPlayers } = req.body;
    
    if (!serverName || currentPlayers === undefined) {
      return res.status(400).json({
        success: false,
        error: 'serverName and currentPlayers are required'
      });
    }

    const success = monitor.updateHeartbeat(serverName, currentPlayers);
    
    if (success) {
      res.json({
        success: true,
        message: `Heartbeat updated for ${serverName}`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Failed to update heartbeat for ${serverName} (disabled or not found)`
      });
    }
  } catch (error) {
    console.error('Error in heartbeat update:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// API endpoint for server unregistration
router.post('/api/servers/unregister', (req: Request, res: Response) => {
  try {
    const { serverName } = req.body;
    
    if (!serverName) {
      return res.status(400).json({
        success: false,
        error: 'serverName is required'
      });
    }

    const success = monitor.unregisterServer(serverName);
    
    if (success) {
      res.json({
        success: true,
        message: `Server ${serverName} unregistered successfully`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Failed to unregister server ${serverName}`
      });
    }
  } catch (error) {
    console.error('Error in server unregistration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get server status
router.get('/api/servers/:serverName/status', (req: Request, res: Response) => {
  try {
    const { serverName } = req.params;
    const status = monitor.getServerStatus(serverName);
    
    if (status) {
      res.json({
        success: true,
        server: status
      });
    } else {
      res.status(404).json({
        success: false,
        error: `Server ${serverName} not found`
      });
    }
  } catch (error) {
    console.error('Error getting server status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all server statuses
router.get('/api/servers/status', (req: Request, res: Response) => {
  try {
    const servers = monitor.getAllServerStatuses();
    res.json({
      success: true,
      servers: servers
    });
  } catch (error) {
    console.error('Error getting all server statuses:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get online servers
router.get('/api/servers/online', (req: Request, res: Response) => {
  try {
    const onlineServers = monitor.getOnlineServers();
    res.json({
      success: true,
      onlineServers: onlineServers
    });
  } catch (error) {
    console.error('Error getting online servers:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export { router as modPluginRoutes };
