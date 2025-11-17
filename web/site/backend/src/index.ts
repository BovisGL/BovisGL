// CRITICAL: Load environment variables FIRST before any other imports
// This must happen before importing any modules that check environment variables
import dotenv from 'dotenv';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Backend .env is in web/site/backend/, we are in web/site/backend/src/
dotenv.config({ path: path.join(__dirname, '..', '.env') });



// Import basic dependencies that don't depend on env vars
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import fetch from 'node-fetch';
import { doubleCsrf } from 'csrf-csrf';
import express, { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { createServer } from 'http';
import net from 'net';

import session from 'express-session';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import connectSqlite3 from 'connect-sqlite3';

// Set proper umask for file creation (ensures group write permissions)
process.umask(0o002);

// Core imports for server functionality


const LOGS_DIR = join(dirname(dirname(__dirname)), 'logs');

const JWT_SECRET: string | undefined = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is not set.');
  console.error('Please set a strong, random JWT_SECRET in your environment variables.');
  process.exit(1);
}

const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || '24h';

(async () => {
  await fs.mkdir(LOGS_DIR, { recursive: true });
})();

const app = express();

// Trust proxy configuration
app.set('trust proxy', 1);

// Session configuration with SQLite store (fixes MemoryStore warnings)
const SQLiteStore = connectSqlite3(session);


const store = new SQLiteStore({
  db: 'sessions.db',
  dir: './data',
  table: 'sessions'
}) as any;

store.on('connect', () => {
  
});

store.on('disconnect', () => {
  
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret',
  resave: false,
  saveUninitialized: false,
  store: store,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));



app.use(cookieParser());

// CORS configuration - Security Enhanced
const allowedOrigins = [
  'http://localhost:3000',    // Local development frontend
  'http://localhost:5173',    // Vite dev server
  'https://bovisgl.pages.dev', // Production frontend
  'https://fca1678d.bovisgl.pages.dev', // Preview deployments
  'https://bovisgl.xyz',      // Production domain
  'https://www.bovisgl.xyz',  // Production domain with www
  // CORS configuration for frontend domains
];

// Allow additional origins from environment (for flexibility)
if (process.env.ALLOWED_ORIGINS) {
  const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  allowedOrigins.push(...additionalOrigins);

}

// Debug logging for CORS


app.use(cors({
    origin: (origin, callback) => {
        // Allow requests without origin header (server-to-server, direct API calls)
        if (!origin) {
            return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'CSRF-Token', 'X-Admin-Token', 'x-admin-token']
}));

app.options('*', cors({
    origin: (origin, callback) => {
        // Allow OPTIONS requests without origin header (server-to-server, direct API calls)
        if (!origin) {
            return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'CSRF-Token', 'X-Admin-Token', 'x-admin-token']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Response compression
app.use(compression({ threshold: 1024 }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.disable('x-powered-by');


// Authentication provides protection for locked endpoints

// CSRF protection
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'your-strong-secret-key',
  getSessionIdentifier: (req) => req.sessionID || 'default-session',
  cookieName: process.env.NODE_ENV === 'production' ? '__Host-psifi.x-csrf-token' : 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
    path: '/'
  }
});

const csrfProtection = doubleCsrfProtection;

// Basic validation middleware
function validateInput(req: Request, res: Response, next: NextFunction) {
  const contentType = req.headers['content-type'];
  if (req.method === 'POST' && contentType && !contentType.includes('application/json')) {
    return res.status(400).json({ error: 'Content-Type must be application/json' });
  }
  next();
}

// Authentication middleware
const authenticateToken = async (req: any, res: Response, next: NextFunction) => {
  try {
    let token = null;
    
    // Try to get token from cookie first
    if (req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    }
    
    // If not in cookie, try Authorization header
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) {
      // SECURITY: Add tamper detection headers
      res.set({
        'X-Auth-Required': 'true',
        'X-Tamper-Protection': 'active',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private'
      });
      return res.status(401).json({ error: 'Access token required' });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
       issuer: 'bovisgl-backend',
       audience: 'bovisgl-admin-panel'
    }) as any;
    
    // SECURITY: Add anti-tampering headers for authenticated requests
    res.set({
      'X-Auth-Required': 'true',
      'X-Tamper-Protection': 'active',
      'X-Client-Validation': 'server-enforced',
      'X-Auth-Level': 'verified',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache'
    });
    
    req.user = {
      id: decoded.id,
      username: decoded.username,
      fullName: decoded.fullName,
      roles: decoded.roles || ['admin']
    };
    
    next();
  } catch (error: any) {
    // Clear invalid cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    // SECURITY: Add tamper detection headers for failed auth
    res.set({
      'X-Auth-Required': 'true',
      'X-Tamper-Protection': 'active',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private'
    });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'token_expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token', code: 'invalid_token' });
    } else {
      return res.status(403).json({ error: 'Token verification failed' });
    }
  }
};

// Route mounting will be done in startServer() after dynamic imports

// Error handling middleware (keep this here as it needs to be early)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  const PORT = process.env.PORT || 3001;
  

  
  // Dynamically import modules that depend on environment variables
  const [
    { publicRoutes: serverControlPublic, lockedRoutes: serverControlLocked },
    { publicRoutes: authPublic, lockedRoutes: authLocked },
    { lockedRoutes: consoleLocked },
    { lockedRoutes: jarsLocked },
    { lockedRoutes: dataLocked },
    passkeyRouter,
    systemRoutes,
  { rconManager },
  { ModPluginMonitor, modPluginRoutes, initializeModPluginAPI }
  ] = await Promise.all([
    import('./modules/server_control/routes/serverRoutes.js'),
    import('./modules/auth/routes/authRoutes.js'),
    import('./modules/console/routes/consoleRoutes.js'),
    import('./modules/jars/routes/jarRoutes.js'),
    import('./modules/data/routes/dataRoutes.js'),
    import('./modules/auth/routes/passkey.js'),
    import('./modules/system/routes/systemRoutes.js'),
  import('./modules/server_control/index.js'),
  import('./modules/server_control/index.js')
  ]);
  
  // Initialize the new mod/plugin monitoring system
  console.log('🔧 Initializing Mod/Plugin Monitoring System...');
  const modPluginMonitor = new ModPluginMonitor();
  initializeModPluginAPI(modPluginMonitor);
  console.log('✅ Mod/Plugin Monitoring System initialized successfully');

  // Create routers
  const publicApiRouter = express.Router();
  const lockedApiRouter = express.Router();

  // Apply middleware
  publicApiRouter.use(validateInput);
  lockedApiRouter.use(validateInput);
  lockedApiRouter.use(authenticateToken);

  // Mount public routes (no authentication required)
  // These are what the frontend calls with /api/public/...
  if (serverControlPublic) {
    publicApiRouter.use('/', serverControlPublic); // /api/public/servers/status, /api/public/servers/online-players
  }
  if (authPublic) {
    publicApiRouter.use('/', authPublic); // /api/public/csrf-token, /api/public/auth/login, /api/public/auth/logout
  }
  // Minecraft account linking public endpoints
  try {
    const mcLinkModule = await import('./modules/mc_link/routes/public/index.js');
    if (mcLinkModule.default) {
      publicApiRouter.use('/', mcLinkModule.default); // /api/public/mc-link/*
      console.log('✅ MC Link routes mounted');
    }
  } catch (e) {
    console.warn('⚠️ Failed to load MC link routes (optional feature):', e);
  }
  
  // (B.A.A public analysis routes removed)
  
  // Mount mod/plugin registration routes (public access for server registration)
  console.log('🔧 Mounting Mod/Plugin routes at /api/public');
  publicApiRouter.use('/', modPluginRoutes); // /api/public/servers/register, /api/public/servers/heartbeat, etc.
  console.log('✅ Mod/Plugin routes mounted successfully');

  // (B.A.A duplicate public route mount removed)
  
  if (passkeyRouter.default || passkeyRouter) {
    publicApiRouter.use('/passkey', passkeyRouter.default || passkeyRouter); // /api/public/passkey/login/options, /api/public/passkey/register/options
  }

  // Dynamic resource pack listing (Java & Bedrock) from frontend public directory
  publicApiRouter.get('/packs/info', async (req, res) => {
    try {
      const frontendPublicDir = path.resolve(process.cwd(), 'web/site/frontend/public');
      const files = await fs.readdir(frontendPublicDir);
      const frontendUrl = 'https://bovisgl.xyz';

      // Helper to compute SHA1 of a file
      const computeSha1 = async (filePath: string) => {
        const data = await fs.readFile(filePath);
        return crypto.createHash('sha1').update(data).digest('hex');
      };

      const javaPacks: any[] = [];
      const bedrockPacks: any[] = [];

      for (const file of files) {
        const lower = file.toLowerCase();
        const abs = path.join(frontendPublicDir, file);
        if (lower.endsWith('.zip')) {
          // Java pack
            try {
              const sha1 = await computeSha1(abs);
              javaPacks.push({
                filename: file,
                url: `${frontendUrl}/${encodeURIComponent(file)}`,
                sha1
              });
            } catch (e) {
              console.error('Failed hashing pack', file, e);
            }
        } else if (lower.endsWith('.mcpack')) {
          try {
            const sha1 = await computeSha1(abs);
            bedrockPacks.push({
              filename: file,
              url: `${frontendUrl}/${encodeURIComponent(file)}`,
              sha1
            });
          } catch (e) {
            console.error('Failed hashing bedrock pack', file, e);
          }
        }
      }

      res.json({
        generatedAt: new Date().toISOString(),
        java: javaPacks,
        bedrock: bedrockPacks
      });
    } catch (error) {
      console.error('Error generating packs info:', error);
      res.status(500).json({ error: 'Failed to list resource packs' });
    }
  });

  // Mount locked routes (authentication required)  
  // These are what the frontend calls with /api/locked/...
  // Proxy endpoints to communications service for admin players
  const COMMS_BASE = process.env.COMMS_BASE || process.env.BOVISGL_COMMS || 'http://localhost:3456';
  // Helper to resolve the admin token for communications service
  function resolveCommsAdminToken(req: Request): string | undefined {
    const headerToken = req.get('X-Admin-Token') || req.get('x-admin-token');
    const envToken = process.env.COMMS_ADMIN_TOKEN || process.env.ADMIN_TOKEN || undefined;
    // If the backend request is already authenticated (session/JWT verified), prefer the backend
    // configured communications admin token so we don't accidentally forward the user's JWT.
    if ((req as any).user && envToken) return envToken;
    return (headerToken && headerToken.trim().length > 0) ? headerToken : envToken;
  }

  // Protect with the same locked auth middleware as other admin endpoints
  lockedApiRouter.get('/admin/players', authLocked, async (req, res) => {
    try {
      const adminToken = resolveCommsAdminToken(req);
      const r = await fetch(`${COMMS_BASE}/api/locked/admin/players`, {
        headers: adminToken ? { 'X-Admin-Token': adminToken } as any : undefined
      });
      const ct = r.headers.get('content-type') || '';
      const text = await r.text();
      if (!r.ok) {
        if (ct.includes('application/json')) {
          return res.status(r.status).type('application/json').send(text);
        }
        return res.status(r.status).send(text);
      }
      if (ct.includes('application/json')) return res.type('application/json').send(text);
      return res.send(text);
    } catch (e: any) {
      console.error('Failed to proxy /admin/players to communications:', e);
      return res.status(502).json({ error: 'Upstream communications unavailable' });
    }
  });
  lockedApiRouter.get('/admin/players/:id', authLocked, async (req, res) => {
    try {
      const id = encodeURIComponent(req.params.id);
      const adminToken = resolveCommsAdminToken(req);
      const r = await fetch(`${COMMS_BASE}/api/locked/admin/players/${id}`, {
        headers: adminToken ? { 'X-Admin-Token': adminToken } as any : undefined
      });
      const ct = r.headers.get('content-type') || '';
      const text = await r.text();
      if (!r.ok) {
        if (ct.includes('application/json')) {
          return res.status(r.status).type('application/json').send(text);
        }
        return res.status(r.status).send(text);
      }
      if (ct.includes('application/json')) return res.type('application/json').send(text);
      return res.send(text);
    } catch (e: any) {
      console.error('Failed to proxy /admin/players/:id to communications:', e);
      return res.status(502).json({ error: 'Upstream communications unavailable' });
    }
  });

  lockedApiRouter.use('/', authLocked); // Apply auth to all locked routes

  // Get ban status for a player
  lockedApiRouter.get('/players/:uuid/ban', async (req, res) => {
    try {
      const uuid = encodeURIComponent(req.params.uuid);
      const adminToken = resolveCommsAdminToken(req);
      const r = await fetch(`${COMMS_BASE}/api/players/${uuid}/ban`, {
        headers: adminToken ? { 'X-Admin-Token': adminToken } as any : undefined
      });
      const ct = r.headers.get('content-type') || '';
      const text = await r.text();
      if (!r.ok) {
        if (ct.includes('application/json')) {
          return res.status(r.status).type('application/json').send(text);
        }
        return res.status(r.status).send(text);
      }
      if (ct.includes('application/json')) return res.type('application/json').send(text);
      return res.send(text);
    } catch (e: any) {
      console.error('Failed to proxy /players/:uuid/ban to communications:', e);
      return res.status(502).json({ error: 'Upstream communications unavailable' });
    }
  });

  // Ban a player
  lockedApiRouter.post('/players/ban', async (req, res) => {
    try {
      const { uuid, name, reason } = req.body;
      if (!uuid || !name) {
        return res.status(400).json({ error: 'uuid and name are required' });
      }
      const adminToken = resolveCommsAdminToken(req);
      const r = await fetch(`${COMMS_BASE}/api/players/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'X-Admin-Token': adminToken } : {})
        } as any,
        body: JSON.stringify({ uuid, name, reason })
      });
      const ct = r.headers.get('content-type') || '';
      const text = await r.text();
      if (!r.ok) {
        if (ct.includes('application/json')) {
          return res.status(r.status).type('application/json').send(text);
        }
        return res.status(r.status).send(text);
      }
      if (ct.includes('application/json')) return res.type('application/json').send(text);
      return res.send(text);
    } catch (e: any) {
      console.error('Failed to proxy /players/ban to communications:', e);
      return res.status(502).json({ error: 'Upstream communications unavailable' });
    }
  });

  // Unban a player
  lockedApiRouter.post('/players/unban', async (req, res) => {
    try {
      const { uuid } = req.body;
      if (!uuid) {
        return res.status(400).json({ error: 'uuid is required' });
      }
      const adminToken = resolveCommsAdminToken(req);
      const r = await fetch(`${COMMS_BASE}/api/players/unban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'X-Admin-Token': adminToken } : {})
        } as any,
        body: JSON.stringify({ uuid })
      });
      const ct = r.headers.get('content-type') || '';
      const text = await r.text();
      if (!r.ok) {
        if (ct.includes('application/json')) {
          return res.status(r.status).type('application/json').send(text);
        }
        return res.status(r.status).send(text);
      }
      if (ct.includes('application/json')) return res.type('application/json').send(text);
      return res.send(text);
    } catch (e: any) {
      console.error('Failed to proxy /players/unban to communications:', e);
      return res.status(502).json({ error: 'Upstream communications unavailable' });
    }
  });

  // Mount module-specific routers
  lockedApiRouter.use('/', serverControlLocked); // /api/locked/servers/:id/start, /api/locked/servers/:id/stop, etc.
  lockedApiRouter.use('/', consoleLocked); // /api/locked/servers/:id/logs, /api/locked/servers/:id/command, etc.
  lockedApiRouter.use('/', jarsLocked); // /api/locked/jar/view/:serverId, /api/locked/jar/delete/:serverId/:filename
  lockedApiRouter.use('/data', dataLocked); // /api/locked/data/players, /api/locked/data/servers, etc.
  lockedApiRouter.use('/system', systemRoutes.default || systemRoutes); // /api/locked/system/shutdown/complete, /api/locked/system/auth/force-signout, etc.
  
  // (B.A.A locked chat routes removed)

  // Mount the API routers with correct prefixes that frontend expects
  app.use('/api/public', publicApiRouter);
  app.use('/api/locked', lockedApiRouter);

  // Internal WebSocket broadcast endpoints (for communications service to notify connected clients)
  // These endpoints are internal only - not meant for frontend direct calls
  app.post('/api/internal/broadcast-player-update', async (req, res) => {
    try {
      const { wsManager } = await import('./modules/websocket/index.js');
      const playerUpdate = req.body;
      
      if (!playerUpdate || !playerUpdate.uuid) {
        return res.status(400).json({ error: 'Invalid player update - missing uuid' });
      }
      
      console.log(`📡 [Backend] Broadcasting player update: ${playerUpdate.name} (${playerUpdate.uuid}) - online: ${playerUpdate.online}`);
      wsManager.broadcastPlayerUpdate(playerUpdate);
      res.json({ success: true, broadcasted: true });
    } catch (error) {
      console.error('Error broadcasting player update:', error);
      res.status(500).json({ error: 'Failed to broadcast player update' });
    }
  });

  app.post('/api/internal/broadcast-player-batch', async (req, res) => {
    try {
      const { wsManager } = await import('./modules/websocket/index.js');
      const updates = req.body;
      
      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: 'Invalid request - expected array of updates' });
      }
      
      wsManager.broadcastPlayerBatch(updates);
      res.json({ success: true, broadcasted: true, count: updates.length });
    } catch (error) {
      console.error('Error broadcasting player batch:', error);
      res.status(500).json({ error: 'Failed to broadcast player batch' });
    }
  });

  app.post('/api/internal/broadcast-server-log', async (req, res) => {
    try {
      const { wsManager } = await import('./modules/websocket/index.js');
      const { serverId, logLine } = req.body;
      
      if (!serverId || !logLine) {
        return res.status(400).json({ error: 'Invalid request - missing serverId or logLine' });
      }
      
      wsManager.broadcastServerLog(serverId, logLine);
      res.json({ success: true, broadcasted: true });
    } catch (error) {
      console.error('Error broadcasting server log:', error);
      res.status(500).json({ error: 'Failed to broadcast server log' });
    }
  });

  app.post('/api/internal/broadcast-ban-update', async (req, res) => {
    try {
      const { wsManager } = await import('./modules/websocket/index.js');
      const { uuid, name, isBanned, reason, bannedBy, timestamp } = req.body;
      
      if (!uuid || typeof isBanned !== 'boolean') {
        return res.status(400).json({ error: 'Invalid request - missing uuid or isBanned' });
      }
      
      console.log(`📡 [Backend] Broadcasting ban update: ${name} (${uuid}) - banned: ${isBanned}`);
      wsManager.broadcastBanUpdate({
        uuid,
        name,
        isBanned,
        reason,
        bannedBy,
        timestamp: timestamp || Date.now()
      });
      res.json({ success: true, broadcasted: true });
    } catch (error) {
      console.error('Error broadcasting ban update:', error);
      res.status(500).json({ error: 'Failed to broadcast ban update' });
    }
  });

  // (Removed backend direct pack serving; packs now hosted only via public frontend domain)
  

  
  // Serve frontend app for admin routes (passkey registration/invite pages)
  app.get('/admin/passkey/create/*', (req, res) => {
    res.redirect('https://bovisgl.xyz' + req.path);
  });
  
  app.get('/admin/passkey/invite/*', (req, res) => {
    res.redirect('https://bovisgl.xyz' + req.path);
  });
  
  // Default route handler (MUST be after all API routes)
  app.get('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
  
  // Initialize Enhanced Crash Detection System
  console.log('🔍 Initializing Enhanced Crash Detection System...');
  const { initializeCrashDetection } = await import('./modules/system/index.js');
  initializeCrashDetection();
  console.log('✅ Enhanced Crash Detection System initialized');

  // Initialize backups (runs immediately and then every 12 hours)
  try {
    const { initializeBackupService, shutdownBackupService } = await import('./modules/system/services/backupService.js');
    initializeBackupService();
    // expose for graceful shutdown
    (global as any).__shutdownBackupService = shutdownBackupService;
  } catch (error) {
    console.error('❌ Failed to initialize backup service:', error);
  }
  
  // (B.A.A Discord service removed)
  
  // RCON is available for console commands and online OP management
  console.log('🔌 RCON connections available for console commands and online servers');
  console.log('📝 Paper plugin handles OP management by reading database every minute');
  
  // All player tracking is handled by Velocity plugin
  console.log('🎮 Player tracking handled by Velocity plugin');
  
  // Create HTTP server for WebSocket support
  const httpServer = createServer(app);
  
  // Enable SO_REUSEADDR to allow immediate port reuse after restart
  httpServer.on('connection', (socket: net.Socket) => {
    socket.setKeepAlive(true);
  });
  
  // Initialize WebSocket server
  const { wsManager } = await import('./modules/websocket/index.js');
  wsManager.initialize(httpServer);
  
  // Use proper listen options - bind to localhost to avoid IPv6 TIME_WAIT issues
  httpServer.listen({
    port: PORT,
    host: '127.0.0.1'
  }, async () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🔥 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Public API: /api/public/*`);
    console.log(`🔒 Locked API: /api/locked/*`);
    console.log(`🔗 WebSocket: /api/ws`);
    console.log('📝 Direct ops.json file operations enabled for offline servers');
  });
}

const gracefulShutdown = async (signal: string) => {
  console.log(`\n🔄 Received ${signal}, shutting down gracefully...`);
  
  // Close WebSocket connections
  console.log('🔌 Closing WebSocket connections...');
  try {
    const { wsManager } = await import('./modules/websocket/index.js');
    wsManager.shutdown();
    console.log('✅ WebSocket server shut down');
  } catch (error) {
    console.error('❌ Error shutting down WebSocket server:', error);
  }
  
  // Close RCON connections
  console.log('🔌 Closing RCON connections...');
  try {
    const { rconManager } = await import('./modules/server_control/index.js');
    await rconManager.disconnectAll();
    console.log('✅ RCON connections closed');
  } catch (error) {
    console.error('❌ Error closing RCON connections:', error);
  }
  

  
  // Shutdown Enhanced Crash Detection System
  console.log('🔍 Shutting down Enhanced Crash Detection System...');
  try {
    const { shutdownCrashDetection } = await import('./modules/system/index.js');
    shutdownCrashDetection();
    console.log('✅ Enhanced Crash Detection System shut down');
  } catch (error) {
    console.error('❌ Error shutting down crash detection:', error);
  }
  // Shutdown backup service if present
  try {
    const shutdownFn = (global as any).__shutdownBackupService;
    if (shutdownFn) await shutdownFn();
    console.log('✅ Backup service shut down');
  } catch (error) {
    console.error('❌ Error shutting down backup service:', error);
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});