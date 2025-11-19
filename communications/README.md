# BovisGL Communications Service

> **Internal Documentation** - Communications hub for coordinating Minecraft server data and player activity.

## Overview

The Communications Service is the central coordination hub for all BovisGL Minecraft servers. It aggregates real-time player data from all servers, manages server registrations, and broadcasts player activity events. This service acts as the middle layer between the Minecraft server plugins and the web backend.

**Key Responsibilities:**
- Aggregate player data from multiple Minecraft servers
- Broadcast player join/leave/move events
- Coordinate server registrations and health checks
- Manage online player sessions across all servers
- Forward player and ban status updates to backend
- Graceful server reconnection and data sync

## Tech Stack

- **Express 4.19** - Web framework for REST API
- **TypeScript 5.4** - Type-safe development
- **SQLite3** (better-sqlite3 9.4) - Local player data storage
- **WebSocket** (ws 8.18) - Real-time communication
- **Mediasoup 3.19** - WebRTC SFU for voice coordination
- **Axios 1.7** - HTTP client for backend communication
- **UUID 9.0** - Unique identifier generation
- **CORS 2.8** - Cross-origin request handling

## Features

### Server Registry
- **Server Registration**: Minecraft servers register themselves with connection details
- **Health Checks**: Periodic server heartbeat monitoring
- **Auto-Disconnection**: Detect offline servers and remove from registry
- **Server Metadata**: Track server name, port, max players, motd

### Player Tracking
- **Real-time Updates**: Live player join/leave/move tracking
- **Session Management**: Track player sessions across servers
- **Activity History**: Maintain player activity history
- **Cross-server Sync**: Coordinate player data across all servers
- **Online Status**: Accurate real-time online player list

### Data Broadcasting
- **Player Events**: Broadcast player join/leave/move events
- **Ban Updates**: Propagate ban status changes to all servers
- **Server Status**: Communicate server online/offline changes
- **Data Consistency**: Ensure data consistency across services

### Integration Points
- **Backend Communication**: Send updates to main backend
- **Graceful Reconnection**: Automatic reconnection with full data sync
- **Event Forwarding**: Forward events to listening services
- **Admin Sync**: Keep admin panel in sync with server state

## Project Structure

```
communications/
├── src/
│   ├── server.ts              # Main Express server
│   │
│   ├── core/                  # Core functionality
│   │   ├── registry.ts        # Server registry management
│   │   ├── broadcaster.ts     # Event broadcasting system
│   │   ├── gracefulReconnect.ts # Server reconnection logic
│   │   └── rcon.ts            # RCON protocol implementation
│   │
│   ├── data/                  # Data storage and management
│   │   ├── playerStore.ts     # Player data persistence
│   │   ├── onlinePlayersStore.ts # Real-time online players
│   │   └── servers.json       # Server configuration
│   │
│   └── routes/                # API endpoints (currently empty)
│
├── data/                      # Runtime data
│   └── players.db             # SQLite player database
│
├── run/                       # Runtime files
│   └── bovisgl-communications.pid
│
├── dist/                      # Compiled JavaScript output
├── node_modules/              # Dependencies
├── package.json               # Dependencies and scripts
└── tsconfig.json              # TypeScript configuration
```

## Prerequisites

- Node.js v20 or higher
- npm or yarn
- Backend service running (for event forwarding)
- Minecraft servers with plugin sending player updates

## Installation

```bash
cd communications
npm install
```

## Environment Variables

```bash
# Server Configuration
PORT=3002                                    # Service port
NODE_ENV=production                          # or 'development'

# CORS Configuration
CORS_ALLOWED_ORIGINS=https://bovisgl.xyz     # Comma-separated origins
ADMIN_ALLOWED_ORIGINS=https://admin.bovisgl.xyz

# Admin Authentication
ADMIN_TOKEN=<secure-admin-token>

# Backend Communication
BACKEND_URL=http://localhost:3001
BACKEND_ADMIN_TOKEN=<backend-admin-token>
```

## API Routes

### Server Registration

**POST `/servers/register`** - Register a Minecraft server
```json
{
  "id": "hub",
  "name": "Hub Server",
  "host": "localhost",
  "port": 25565,
  "maxPlayers": 100,
  "motd": "Welcome to BovisGL"
}
```

**POST `/servers/unregister`** - Unregister a server
```json
{ "id": "hub" }
```

**GET `/servers`** - List all registered servers

### Player Management

**POST `/players/join`** - Player joined server
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "PlayerName",
  "serverId": "hub",
  "client": "java"
}
```

**POST `/players/leave`** - Player left server
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "serverId": "hub"
}
```

**POST `/players/move`** - Player switched servers
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "fromServer": "hub",
  "toServer": "anarchy"
}
```

**GET `/players` or `/players/:uuid`** - Get player data

### Admin Endpoints (Requires ADMIN_TOKEN)

**POST `/admin/sync`** - Force full data sync with backend

**POST `/admin/reconnect`** - Initiate graceful server reconnection

**GET `/admin/status`** - Get service status and statistics

## Core Services

### Server Registry (`core/registry.ts`)

Manages server registration and health:

```typescript
import { serverRegistry } from './core/registry.js';

// Register server
serverRegistry.register({
  id: 'hub',
  name: 'Hub',
  host: 'localhost',
  port: 25565
});

// Get server
const server = serverRegistry.getServer('hub');

// List all
const servers = serverRegistry.getAllServers();

// Check if online
const isOnline = serverRegistry.isServerOnline('hub');
```

### Player Store (`data/playerStore.ts`)

Persistent player data storage:

```typescript
import { playerStore } from './data/playerStore.js';

// Store player data
await playerStore.recordPlayer(uuid, { name, joinTimestamp });

// Get player
const player = await playerStore.getPlayer(uuid);

// List all players
const allPlayers = await playerStore.getAllPlayers();
```

### Online Players Store (`data/onlinePlayersStore.ts`)

Real-time online player tracking:

```typescript
import { onlinePlayersStore } from './data/onlinePlayersStore.js';

// Add online player
onlinePlayersStore.addOnlinePlayer(uuid, serverId, client);

// Remove online player
onlinePlayersStore.removeOnlinePlayer(uuid);

// Get online players on server
const serverPlayers = onlinePlayersStore.getServerPlayers('hub');

// Get all online
const allOnline = onlinePlayersStore.getAllOnlinePlayers();
```

### Broadcaster (`core/broadcaster.ts`)

Event broadcasting to connected clients and backend:

```typescript
import { broadcastPlayerUpdate, broadcastBanStatusUpdate } from './core/broadcaster.js';

// Broadcast player event
broadcastPlayerUpdate({
  uuid: '...',
  name: '...',
  event: 'join',
  server: 'hub',
  client: 'java'
});

// Broadcast ban update
broadcastBanStatusUpdate({
  uuid: '...',
  banned: true,
  reason: 'Hacking'
});
```

### Graceful Reconnect (`core/gracefulReconnect.ts`)

Handle server disconnections and data sync:

```typescript
import { initiateGracefulReconnect } from './core/gracefulReconnect.js';

// When server reconnects
await initiateGracefulReconnect();
```

## Development

```bash
# Development mode (with hot reload)
npm run dev

# Build TypeScript
npm run build

# Production start
npm start
```

## Database Schema

### players.db (SQLite)

**players table:**
```sql
CREATE TABLE players (
  uuid TEXT PRIMARY KEY,
  name TEXT,
  lastSeen INTEGER,
  accountType TEXT,
  joinTimestamp INTEGER
);
```

**sessions table:**
```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  uuid TEXT,
  serverId TEXT,
  joinTime INTEGER,
  leaveTime INTEGER,
  duration INTEGER,
  client TEXT
);
```

## How It Works

### Player Join Flow

1. **Server Plugin** sends `/players/join` with player UUID, name, server ID
2. **Communications Service** receives and stores in player database
3. **OnlinePlayersStore** tracks player as online on that server
4. **Broadcaster** sends event to all connected WebSocket clients
5. **Backend Update** sent to main backend via `/api/internal/broadcast-player-update`
6. **Frontend Updates** receive WebSocket event and display live update

### Player Leave Flow

1. **Server Plugin** sends `/players/leave` with player UUID, server ID
2. **Communications Service** removes from online tracking
3. **OnlinePlayersStore** updates player status to offline
4. **Broadcaster** sends leave event
5. **Backend + Frontend** receive and update displays

### Server Reconnection Flow

1. **Server reconnects** after network issue
2. **Graceful Reconnect** triggers automatic data sync
3. **All players queried** from server plugin
4. **Full sync sent** to backend to reconcile data
5. **Online store rebuilt** from fresh server data
6. **All clients notified** of data refresh

## Deployment

### systemd Service

```ini
[Unit]
Description=BovisGL Communications Service
After=network.target

[Service]
Type=simple
User=bovisgl
# Replace <REPO_ROOT> with the full path to your project root (for example: /home/USER/Minecraft/dev/BovisGL)
WorkingDirectory=<REPO_ROOT>/communications
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Starting the Service

```bash
systemctl start bovisgl-communications
systemctl enable bovisgl-communications
systemctl status bovisgl-communications
```

---

**Internal documentation for BovisGL development team.**
