# BovisGL Backend

> **Internal Documentation** - This backend is for personal use only. While the code is visible, this is not open source and contributions are not accepted.

## Overview

The BovisGL Backend is a TypeScript/Node.js Express server that powers the BovisGL Minecraft Network infrastructure. It provides:

- **Server Management**: Control Minecraft servers (start, stop, restart, kill) via RCON and process management
- **Authentication System**: WebAuthn/FIDO2 passkey authentication with JWT token management
- **Player Data Management**: Real-time player tracking, ban system, and account linking
- **Database Integration**: PostgreSQL for LuckPerms, SQLite for sessions and local data
- **WebSocket Server**: Real-time bidirectional communication for live updates
- **Voice Chat (SFU)**: WebRTC Selective Forwarding Unit for in-game voice communication
- **Discord Integration**: Bot for server notifications and admin commands
- **Security**: CSRF protection, rate limiting, secure sessions, input validation
- **File Management**: JAR uploads, datapack management, mod/plugin monitoring
- **Logging & Monitoring**: Comprehensive admin action logging and crash detection

This backend serves as the central hub coordinating all BovisGL network operations.

## Tech Stack

### Core Framework
- **Node.js** (v20+) - JavaScript runtime environment
- **Express 4.18** - Web application framework
- **TypeScript 5.4** - Type-safe JavaScript

### Authentication & Security
- **@simplewebauthn/server 8.3** - WebAuthn/FIDO2 passkey authentication
- **jsonwebtoken 9.0** - JWT token generation and verification
- **bcrypt 5.1** - Password hashing (legacy support)
- **csrf-csrf 4.0** - Double-submit CSRF token protection
- **express-rate-limit 7.5** - API rate limiting
- **express-session 1.18** - Session management

### Database
- **PostgreSQL** (via pg 8.16) - LuckPerms permissions data
- **SQLite3** (better-sqlite3 12.2) - Session storage, local data
- **connect-sqlite3 0.9** - SQLite session store

### Server Communication
- **rcon-client 4.2** - RCON protocol for Minecraft server control
- **ws 8.18** - WebSocket server for real-time updates
- **node-fetch 3.3** - HTTP client for API calls

### Real-time Communication
- **mediasoup 3.19** - WebRTC SFU for voice chat

### Discord Integration
- **discord.js 14.21** - Discord bot for notifications and commands

### File & Data Processing
- **multer 1.4** - Multipart form data / file uploads
- **fs-extra 11.3** - Extended file system operations
- **clamscan 2.4** - Antivirus scanning for uploaded files
- **cheerio 1.0** - HTML parsing for web scraping
- **tail 2.2** - Real-time log file monitoring

### Utilities
- **moment-timezone 0.5** - Timezone-aware date/time handling
- **compression 1.8** - Response compression (gzip/deflate)
- **cookie-parser 1.4** - Cookie handling
- **cors 2.8** - Cross-Origin Resource Sharing
- **tree-kill 1.2** - Process tree termination
- **uuid 9.0** - UUID generation
- **prom-client 15.1** - Prometheus metrics (monitoring)

## Features

### Authentication & Authorization
- **Passkey Authentication**: WebAuthn/FIDO2 biometric/hardware key login
- **JWT Tokens**: Secure token-based session management
- **CSRF Protection**: Double-submit cookie pattern
- **Session Management**: SQLite-backed persistent sessions
- **Admin Invite System**: Token-based admin registration
- **Force Signout**: Remote session termination

### Server Management
- **Process Control**: Start, stop, restart, kill server processes
- **RCON Integration**: Send commands to running Minecraft servers
- **Server Status Monitoring**: Real-time online/offline tracking
- **Crash Detection**: Automatic crash log analysis and alerting
- **JAR Management**: Upload, delete, and version JAR files
- **Datapack Management**: Deploy and manage server datapacks
- **Mod/Plugin Monitoring**: Track installed mods and plugins

### Player Management
- **Real-time Player Tracking**: Live player join/leave/server-switch events
- **Ban System**: Ban and unban players with reason tracking
- **Account Linking**: Link Minecraft accounts to web profiles
- **Player Database**: SQLite storage for player data and sessions
- **Session History**: Track player activity across servers

### Database Integration
- **LuckPerms Integration**: Query permissions from PostgreSQL database
- **Permission Management**: View and modify player/group permissions
- **Group Management**: Create, delete, and configure permission groups
- **Ban Storage**: Persistent ban records with metadata

### Real-time Communication
- **WebSocket Server**: Bidirectional real-time updates
- **Event Broadcasting**: Server status, player activity, action completion
- **Voice Chat (SFU)**: WebRTC Selective Forwarding Unit for in-game voice
- **Live Logs**: Stream server console logs to web interface

### Discord Integration
- **Bot Commands**: Server control via Discord
- **Status Notifications**: Server start/stop/crash alerts
- **Admin Notifications**: Important event notifications
- **Player Activity**: Join/leave announcements

### File Management
- **Secure Uploads**: Multipart form data handling with validation
- **Antivirus Scanning**: ClamAV integration for uploaded files
- **File Size Limits**: Configurable upload size restrictions
- **Storage Organization**: Structured file storage by server

### Security Features
- **Rate Limiting**: Per-endpoint request throttling
- **Input Validation**: Schema validation for all inputs
- **Security Headers**: HSTS, XSS protection, frame denial
- **CORS Configuration**: Whitelist-based origin control
- **Secure Cookies**: HttpOnly, Secure, SameSite flags
- **SQL Injection Protection**: Parameterized queries only

### Logging & Monitoring
- **Admin Action Logging**: Comprehensive audit trail
- **Security Event Logging**: Failed auth attempts, suspicious activity
- **Prometheus Metrics**: Performance and health metrics
- **Structured Logging**: JSON-formatted log entries
- **Log Rotation**: Automatic log file management

### System Administration
- **Backup Service**: Automated world backup creation
- **System Shutdown**: Graceful shutdown with cleanup
- **Health Checks**: Endpoint status monitoring
- **Process Management**: PID tracking and cleanup

## Project Structure

```
backend/
├── data/                           # Runtime data storage
│   ├── sessions.db                 # SQLite session store
│   └── players.db                  # Player tracking database
│
├── logs/                           # Application logs
│   ├── admin-actions.log           # Admin action audit trail
│   └── security.log                # Security event logs
│
├── scripts/                        # Utility scripts
│   ├── setup-passkey-auth.ts       # Initialize passkey system
│   └── create-first-admin.ts       # Create initial admin account
│
├── src/
│   ├── index.ts                    # Main application entry point
│   │
│   ├── modules/                    # Feature modules
│   │   │
│   │   ├── auth/                   # Authentication module
│   │   │   ├── routes/
│   │   │   │   ├── public/         # Public auth endpoints
│   │   │   │   │   └── index.ts    # Passkey login/register
│   │   │   │   ├── locked/         # Protected auth endpoints
│   │   │   │   │   └── index.ts    # Token verification
│   │   │   │   ├── authRoutes.ts   # Main auth router
│   │   │   │   └── passkey.ts      # Passkey routes
│   │   │   ├── services/
│   │   │   │   ├── passkey.ts      # WebAuthn implementation
│   │   │   │   ├── jwt.ts          # JWT token management
│   │   │   │   ├── database.ts     # Admin database operations
│   │   │   │   └── authServices.ts # Auth business logic
│   │   │   ├── types/              # TypeScript type definitions
│   │   │   └── index.ts            # Module exports
│   │   │
│   │   ├── server_control/         # Server management module
│   │   │   ├── routes/
│   │   │   │   ├── public/         # Public server endpoints
│   │   │   │   ├── locked/         # Protected server endpoints
│   │   │   │   ├── serverRoutes.ts # Main server router
│   │   │   │   └── modPluginRoutes.ts # Mod/plugin API
│   │   │   ├── services/
│   │   │   │   ├── serverServices.ts    # Server control logic
│   │   │   │   ├── rconManager.ts       # RCON client manager
│   │   │   │   ├── datapackManager.ts   # Datapack operations
│   │   │   │   └── modPluginMonitor.ts  # Mod/plugin tracking
│   │   │   ├── serverConfig.ts     # Server configuration
│   │   │   └── index.ts
│   │   │
│   │   ├── player/                 # Player management module
│   │   │   ├── services/
│   │   │   │   └── playerDatabase.ts    # Player data operations
│   │   │   └── index.ts
│   │   │
│   │   ├── data/                   # Data management module
│   │   │   ├── routes/
│   │   │   │   ├── locked/         # Protected data endpoints
│   │   │   │   │   └── index.ts    # LuckPerms, bans, players
│   │   │   │   └── dataRoutes.ts
│   │   │   └── services/
│   │   │       ├── luckPermsService.ts  # PostgreSQL LuckPerms
│   │   │       └── banService.ts        # Ban management
│   │   │
│   │   ├── console/                # Server console module
│   │   │   ├── routes/
│   │   │   │   ├── locked/         # Protected console endpoints
│   │   │   │   └── consoleRoutes.ts
│   │   │   └── services/
│   │   │       └── consoleServices.ts   # Console command execution
│   │   │
│   │   ├── jars/                   # JAR file management module
│   │   │   ├── routes/
│   │   │   │   ├── locked/         # Protected JAR endpoints
│   │   │   │   └── jarRoutes.ts
│   │   │   └── services/           # Upload, delete, list JARs
│   │   │
│   │   ├── websocket/              # WebSocket module
│   │   │   ├── index.ts            # WebSocket server
│   │   │   └── broadcast.ts        # Event broadcasting
│   │   │
│   │   ├── voice/                  # Voice chat module
│   │   │   └── sfu.ts              # Mediasoup SFU implementation
│   │   │
│   │   ├── system/                 # System administration module
│   │   │   ├── routes/
│   │   │   │   └── systemRoutes.ts
│   │   │   ├── services/
│   │   │   │   ├── backupService.ts       # World backups
│   │   │   │   ├── systemShutdownService.ts
│   │   │   │   └── crashDetection.ts      # Crash log analysis
│   │   │   └── index.ts
│   │   │
│   │   ├── logging/                # Logging module
│   │   │   ├── services/
│   │   │   │   └── adminLogger.ts  # Admin action logging
│   │   │   └── index.ts
│   │   │
│   │   ├── security/               # Security module
│   │   │   ├── services/
│   │   │   │   ├── forceSignoutService.ts
│   │   │   │   └── securityLogger.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── mc_link/                # Account linking module
│   │   │   ├── routes/
│   │   │   │   └── public/
│   │   │   ├── services/
│   │   │   │   └── mcLinkService.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── playerBroadcaster.ts    # Player event broadcaster
│   │   ├── sfu.ts                  # SFU coordinator
│   │   └── events/                 # Event handlers
│   │
│   └── scripts/                    # Build-time scripts
│       └── build-ai-db.ts          # AI database builder
│
├── dist/                           # Compiled JavaScript output
├── node_modules/                   # Dependencies
├── .env                            # Environment variables (not in git)
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── DATABASE_PERMISSIONS.md         # Database setup guide
└── PERMISSION_PREVENTION.md        # Security guidelines
```

## Prerequisites

Before running the backend, ensure you have:

- **Node.js** v20 or higher
- **npm** or **yarn**
- **PostgreSQL** database (for LuckPerms)
- **SQLite3** (included with Node)
- **ClamAV** (optional, for file scanning)
- **Minecraft servers** with RCON enabled

### Quick Start

1. **Navigate to backend directory:**
   ```bash
   cd web/site/backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize databases:**
   ```bash
   # Databases are created automatically on first run
   # Ensure PostgreSQL is running for LuckPerms
   ```

5. **Create first admin:**
   ```bash
   npm run create-first-admin
   ```

6. **Start development server:**
   ```bash
   npm run dev
   ```

7. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

### Required Variables

```bash
# JWT Authentication
JWT_SECRET=<strong-random-secret-key>
TOKEN_EXPIRY=24h

# CSRF Protection
CSRF_SECRET=<strong-random-secret-key>

# Session Management
SESSION_SECRET=<strong-random-secret-key>

# RCON Configuration
RCON_PASSWORD=<minecraft-server-rcon-password>

# WebAuthn Configuration
RP_ID=backend.bovisgl.xyz              # Relying Party ID (your domain)
RP_ORIGIN=https://backend.bovisgl.xyz  # Full origin URL
RP_NAME=BovisGL                        # Display name for passkeys

# Environment
NODE_ENV=production                    # or 'development'
```

### Optional Variables

```bash
# Database Configuration
LUCKPERMS_API_URL=http://localhost:8080/v1
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=luckperms
POSTGRES_USER=luckperms
POSTGRES_PASSWORD=<password>

# Discord Bot
DISCORD_BOT_TOKEN=<your-bot-token>
DISCORD_GUILD_ID=<your-guild-id>
DISCORD_ENABLED=true

# Communications Service
COMMS_ADMIN_TOKEN=<admin-token-for-communications>

# CORS Origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Server Ports
PORT=3001                              # Backend server port
WS_PORT=3001                           # WebSocket port (usually same)

# File Upload
MAX_FILE_SIZE=100mb                    # Maximum upload size
ENABLE_ANTIVIRUS=true                  # Enable ClamAV scanning
```

### Security Best Practices

- **Generate strong random secrets** for JWT, CSRF, and session secrets:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```

- **Never commit `.env` file** to version control
- **Use HTTPS in production** for RP_ORIGIN
- **Rotate secrets regularly** in production environments
- **Restrict CORS origins** to known frontend domains only

## Database Architecture

### PostgreSQL (LuckPerms)
- **Purpose**: Permission and group management
- **Connection**: Via `pg` client to external LuckPerms database
- **Tables**: Managed by LuckPerms plugin
- **Operations**: Read/write permissions, groups, player metadata

### SQLite (Sessions)
- **File**: `data/sessions.db`
- **Purpose**: Express session storage
- **Library**: connect-sqlite3
- **Auto-created**: Yes, on first run

### SQLite (Players)
- **File**: `data/players.db`
- **Purpose**: Player tracking and session history
- **Schema**: 
  - `players` table: UUID, name, clients, online status, timestamps
  - `sessions` table: Join/leave events, server transitions
- **Auto-created**: Yes, on first run

### SQLite (Admins)
- **File**: `data/admins.db`
- **Purpose**: Admin accounts and passkey credentials
- **Schema**: Admin name, credentials, authenticators
- **Auto-created**: Yes, via setup script

## API Routes

### Public Routes (`/api/public/*`)
No authentication required:

- **Authentication**
  - `GET /api/public/csrf-token` - Get CSRF token
  - `GET /api/public/passkey/available-admins` - List admin accounts
  - `POST /api/public/passkey/login/options` - Get WebAuthn options
  - `POST /api/public/passkey/login/verify` - Verify authentication
  - `POST /api/public/passkey/invite-registration-*` - Passkey registration
  - `POST /api/public/auth/logout` - Logout

- **Server Status**
  - `GET /api/public/servers/status` - Get all server statuses
  - `GET /api/public/servers/:id/status` - Get specific server status

- **MC Account Linking**
  - `POST /api/public/mc-link/*` - Account linking endpoints

### Locked Routes (`/api/locked/*`)
Authentication required (JWT token):

- **Authentication**
  - `GET /api/locked/auth/verify` - Verify token validity
  - `POST /api/locked/auth/force-signout` - Force user logout

- **Server Control**
  - `POST /api/locked/servers/:id/start` - Start server
  - `POST /api/locked/servers/:id/stop` - Stop server
  - `POST /api/locked/servers/:id/restart` - Restart server
  - `POST /api/locked/servers/:id/kill` - Kill server process

- **Server Console**
  - `POST /api/locked/servers/:id/console` - Send console command
  - `GET /api/locked/servers/:id/logs` - Get server logs

- **Player Management**
  - `GET /api/locked/players` - List all players
  - `GET /api/locked/players/:uuid` - Get player details
  - `POST /api/locked/players/:uuid/ban` - Ban player
  - `POST /api/locked/players/:uuid/unban` - Unban player

- **LuckPerms Integration**
  - `GET /api/locked/luckperms/users/:uuid` - Get user permissions
  - `POST /api/locked/luckperms/users/:uuid/permissions` - Set permissions
  - `GET /api/locked/luckperms/groups` - List groups
  - `POST /api/locked/luckperms/groups` - Create group

- **JAR Management**
  - `POST /api/locked/jars/:server/upload` - Upload JAR file
  - `GET /api/locked/jars/:server` - List JAR files
  - `DELETE /api/locked/jars/:server/:filename` - Delete JAR

- **Data Management**
  - `GET /api/locked/data/bans` - Get all bans
  - `GET /api/locked/data/logs` - Get admin logs

### Internal Routes (`/api/internal/*`)
Used by Minecraft plugins/mods for communication:

- `POST /api/internal/broadcast-player-update` - Player event notification
- `POST /api/internal/broadcast-player-batch` - Batch player updates
- `POST /api/internal/broadcast-server-log` - Server log streaming
- `POST /api/internal/broadcast-ban-update` - Ban event notification

## Module System

The backend is organized into self-contained feature modules under `src/modules/`. Each module follows a consistent structure:

```
module_name/
├── routes/
│   ├── public/      # Unauthenticated endpoints
│   ├── locked/      # Authenticated endpoints
│   └── *Routes.ts   # Route definitions
├── services/        # Business logic
├── types/           # TypeScript types
└── index.ts         # Module exports
```

### Key Modules

- **auth**: Passkey authentication, JWT management
- **server_control**: Server lifecycle management, RCON
- **player**: Player database, session tracking
- **data**: LuckPerms, bans, player data queries
- **console**: Server console command execution
- **jars**: JAR file upload and management
- **websocket**: Real-time WebSocket server
- **voice**: Voice chat SFU implementation
- **system**: Backups, shutdown, crash detection
- **logging**: Admin action audit trail
- **security**: Force signout, security logging
- **mc_link**: Minecraft account linking

## Authentication & Security

### Passkey Authentication Flow

1. **Registration**:
   - Admin generates invite token via script
   - User accesses `/register/:token`
   - WebAuthn ceremony creates passkey
   - Credential stored in `admins.db`

2. **Login**:
   - Frontend requests login options
   - Browser prompts for passkey
   - Assertion verified with stored credential
   - JWT token issued (24h default expiry)

3. **Token Verification**:
   - JWT token included in `Authorization: Bearer <token>` header
   - Middleware verifies signature and expiry
   - Request proceeds to protected route

### Security Layers

1. **CSRF Protection**: Double-submit cookie pattern on state-changing requests
2. **Rate Limiting**: Per-endpoint throttling (default: 100 req/15min)
3. **CORS**: Whitelist-based origin validation
4. **Input Validation**: Schema validation on all inputs
5. **Secure Headers**: HSTS, XSS protection, frame denial
6. **Session Security**: HttpOnly, Secure, SameSite cookies
7. **SQL Injection**: Parameterized queries only

## Server Control

### Process Management

Servers are controlled via:
- **Child process spawning** for start operations
- **Process tree termination** for stop/kill
- **PID tracking** for status monitoring
- **Graceful shutdown** with timeouts

### RCON Integration

```typescript
// Send command to running server
await rconManager.sendCommand('server-id', 'say Hello World');

// Query server status
const status = await rconManager.getServerStatus('server-id');
```

**Features**:
- Connection pooling per server
- Automatic reconnection
- Command queueing
- Error handling and retries

### Server Status

Status states: `online`, `offline`, `starting`, `stopping`

Updated via:
- Process monitoring (PID checks)
- RCON connectivity checks
- Plugin heartbeat messages
- Log file analysis

## WebSocket System

### Server Implementation

- **Library**: ws (native WebSocket)
- **Port**: Same as HTTP server (3001)
- **Path**: `/api/ws`
- **Protocol**: JSON message format

### Event Types

```typescript
// Server status change
{ event: 'server:status', serverId: 'hub', status: 'online' }

// Player joined
{ event: 'player:join', uuid: '...', name: '...', server: 'hub' }

// Player left
{ event: 'player:leave', uuid: '...', name: '...', server: 'hub' }

// Player moved
{ event: 'player:move', uuid: '...', from: 'hub', to: 'anarchy' }

// Action complete
{ event: 'action:complete', serverId: 'hub', action: 'start' }

// Action failed
{ event: 'action:failed', serverId: 'hub', action: 'start', error: '...' }

// Ban update
{ event: 'ban:update', uuid: '...', banned: true }
```

### Broadcasting

```typescript
import { broadcastToAll } from './modules/websocket/broadcast.js';

// Broadcast to all connected clients
broadcastToAll('server:status', { serverId: 'hub', status: 'online' });
```

## Services

### Core Services

#### Server Control Service
```typescript
import { serverControlService } from './modules/server_control';

await serverControlService.startServer('hub');
await serverControlService.stopServer('anarchy');
const status = await serverControlService.getServerStatus('hub');
```

#### RCON Manager
```typescript
import { rconManager } from './modules/server_control';

await rconManager.connect('hub');
await rconManager.sendCommand('hub', 'list');
```

#### Player Database
```typescript
import { playerOps } from './modules/player';

const player = await playerOps.getPlayer(uuid);
await playerOps.updatePlayerStatus(uuid, { online: true });
```

#### LuckPerms Service
```typescript
import { luckPermsService } from './modules/data/services/luckPermsService';

const perms = await luckPermsService.getUserPermissions(uuid);
await luckPermsService.setPermission(uuid, 'permission.node', true);
```

#### Ban Service
```typescript
import { banService } from './modules/data/services/banService';

await banService.banPlayer(uuid, reason, bannedBy);
await banService.unbanPlayer(uuid);
const bans = await banService.getAllBans();
```

## Logging & Monitoring

### Admin Action Logging

All admin actions are logged to `logs/admin-actions.log`:

```typescript
import { logAdminAction } from './modules/logging';

await logAdminAction({
  admin: 'AdminName',
  action: 'SERVER_START',
  target: 'hub',
  details: 'Started server via web panel',
  ip: req.ip
});
```

### Log Format

```json
{
  "timestamp": "2025-11-17T10:30:00.000Z",
  "admin": "AdminName",
  "action": "SERVER_START",
  "target": "hub",
  "details": "Started server via web panel",
  "ip": "192.168.1.1",
  "success": true
}
```

### Security Logging

Security events logged to `logs/security.log`:
- Failed login attempts
- Invalid tokens
- Suspicious activity
- CSRF violations
- Rate limit violations

## Development

### Development Mode

```bash
npm run dev
```

Features:
- Hot reload with `tsx watch`
- Detailed error messages
- Source maps enabled
- Relaxed CORS (localhost)
- Non-secure cookies

### Building

```bash
npm run build
```

Compiles TypeScript to JavaScript in `dist/` directory.

### Linting & Formatting

```bash
npm run lint         # Check code style
npm run lint:fix     # Fix auto-fixable issues
npm run format       # Format with Prettier
```

### Scripts

```bash
npm run setup-passkey          # Initialize passkey system
npm run create-first-admin     # Create first admin account
npm run build:ai-db            # Build AI knowledge database
```

## Deployment

### Production Checklist

1. ✅ Set `NODE_ENV=production`
2. ✅ Configure strong secrets (JWT, CSRF, Session)
3. ✅ Enable HTTPS and set RP_ORIGIN correctly
4. ✅ Configure PostgreSQL connection
5. ✅ Restrict CORS origins
6. ✅ Set up reverse proxy (nginx/Apache)
7. ✅ Enable process manager (PM2/systemd)
8. ✅ Configure log rotation
9. ✅ Set up monitoring (Prometheus/Grafana)
10. ✅ Configure backup strategy

### systemd Service

```ini
[Unit]
Description=BovisGL Backend
After=network.target postgresql.service

[Service]
Type=simple
User=bovisgl
WorkingDirectory=/home/bovisgl/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name backend.bovisgl.xyz;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

**For internal use by BovisGL development team. Not open source.**


## Security Features
- **JWT Authentication**: Securely identifies users with tokens that expire
- **Password Hashing**: Stores passwords securely using bcrypt
- **CSRF Protection**: Prevents cross-site request forgery attacks
- **Rate Limiting**: Prevents brute force attacks by limiting login attempts
- **Input Validation**: Checks all input to prevent injection attacks
- **Security Headers**: Protects against common web vulnerabilities
- **Two-Factor Authentication**: Adds an extra layer of security for admin access

## How It Connects to Minecraft Servers
The backend uses the RCON protocol to send commands directly to Minecraft servers. This allows it to:
- Start and stop servers
- Monitor server status and player counts
- Execute game commands
- Get server logs

## Database Information
The backend uses SQLite databases to store:
- User accounts and permissions
- Server configurations
- Game logs and statistics
- Authentication data 