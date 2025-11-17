# WebSocket Integration Guide

## Overview

The backend now supports real-time updates via WebSocket. Clients can subscribe to channels and receive instant updates when server status or player data changes.

## Backend Usage

### Broadcasting Server Status Updates

```typescript
import { broadcastServerStatus, broadcastServerBatch } from './modules/websocket/broadcast.js';

// Single server update
broadcastServerStatus({
  serverId: 'anarchy',
  status: 'online',
  playerCount: 15,
  maxPlayers: 20,
  version: '1.20.4',
  timestamp: Date.now()
});

// Batch updates (multiple servers)
broadcastServerBatch([
  {
    serverId: 'anarchy',
    status: 'online',
    playerCount: 15,
    timestamp: Date.now()
  },
  {
    serverId: 'parkour',
    status: 'offline',
    timestamp: Date.now()
  }
]);
```

### Broadcasting Player Updates

```typescript
import { broadcastPlayerUpdate, broadcastPlayerBatch } from './modules/websocket/broadcast.js';

// Single player update
broadcastPlayerUpdate({
  uuid: 'player-uuid',
  name: 'PlayerName',
  online: true,
  currentServer: 'anarchy',
  currentClient: 'java.1.21.7',
  lastActiveTs: Date.now(),
  clients: ['java.1.21.7', 'java.1.21.9']
});

// Batch updates (multiple players)
broadcastPlayerBatch([
  {
    uuid: 'player-uuid-1',
    name: 'Player1',
    online: true,
    currentServer: 'anarchy',
    currentClient: 'java.1.21.7',
    lastActiveTs: Date.now(),
    clients: []
  },
  {
    uuid: 'player-uuid-2',
    name: 'Player2',
    online: false,
    currentServer: null,
    currentClient: null,
    lastActiveTs: Date.now(),
    clients: []
  }
]);
```

### Monitoring WebSocket Connections

```typescript
import { getConnectedClientsCount, getSubscribersCount } from './modules/websocket/broadcast.js';

// Get total connected clients
const clientCount = getConnectedClientsCount();
console.log(`Connected clients: ${clientCount}`);

// Get subscribers for specific channel
const serverSubscribers = getSubscribersCount('servers');
const playerSubscribers = getSubscribersCount('players');
console.log(`Server channel subscribers: ${serverSubscribers}`);
console.log(`Players channel subscribers: ${playerSubscribers}`);
```

## Integration Points

### Server Control Module
When starting/stopping servers or detecting status changes, broadcast updates:

```typescript
// In server_control module
import { broadcastServerStatus } from '../websocket/broadcast.js';

// After server start
broadcastServerStatus({
  serverId: id,
  status: 'online',
  timestamp: Date.now()
});
```

### Player Tracking
When receiving player join/leave events from Velocity plugin:

```typescript
// In player tracking/API routes
import { broadcastPlayerUpdate } from '../websocket/broadcast.js';

// When player joins
broadcastPlayerUpdate({
  uuid: playerUUID,
  name: playerName,
  online: true,
  currentServer: currentServer,
  currentClient: playerClient,
  lastActiveTs: Date.now(),
  clients: knownClients
});
```

## Frontend Client Usage

Clients automatically connect on mount and can subscribe to real-time updates:

```typescript
// Using the useServerStatus hook (Admin Panel, Home Page)
const { serverStatus, isConnected } = useServerStatus();

// Using direct WebSocket service (custom handlers)
websocketService.subscribe('servers');
websocketService.on('server-status', (message) => {
  const update = message.data;
  console.log(`Server ${update.serverId} is now ${update.status}`);
  console.log(`Players: ${update.playerCount}/${update.maxPlayers}`);
});
```

## Message Protocol

### Server Status Message
```json
{
  "type": "server-status",
  "data": {
    "serverId": "anarchy",
    "status": "online",
    "playerCount": 15,
    "maxPlayers": 20,
    "version": "1.20.4",
    "uptime": 3600,
    "timestamp": 1730000000000
  },
  "timestamp": 1730000000000
}
```

### Player Update Message
```json
{
  "type": "player-update",
  "data": {
    "uuid": "123e4567-e89b-12d3-a456-426614174000",
    "name": "PlayerName",
    "online": true,
    "currentServer": "anarchy",
    "currentClient": "java.1.21.7",
    "lastActiveTs": 1730000000000,
    "clients": ["java.1.21.7", "java.1.21.9"]
  },
  "timestamp": 1730000000000
}
```

### Subscription Messages
```json
{
  "type": "subscribe",
  "data": {
    "channel": "servers"
  }
}
```

## Channels

- `servers` - Subscribe to server status updates
- `players` - Subscribe to player updates

## Connection Flow

1. Client connects to `/api/ws`
2. Server sends ping every 30 seconds
3. Client responds with pong (connection alive)
4. Client subscribes to channels: `subscribe` message
5. Server broadcasts updates to subscribed clients
6. On disconnect, client auto-reconnects with exponential backoff
7. Fallback polling every 30 seconds if WebSocket unavailable

## Error Handling

- **Connection Failure**: Client automatically reconnects with exponential backoff (up to 10s delay)
- **Network Timeout**: Ping/pong mechanism detects dead connections after 30 seconds
- **Message Parse Error**: Logged but doesn't disconnect
- **Graceful Shutdown**: All WebSocket connections closed on server shutdown

## Performance

- **Ping Interval**: 30 seconds (configurable)
- **Message Queue**: Not limited (frames are sent immediately)
- **Connection Limit**: No built-in limit (depends on system resources)
- **Memory**: ~100KB per connected client
- **CPU**: Minimal impact, event-driven

## Debugging

Enable logging by checking console output:

```
✅ WebSocket server initialized on /api/ws
🔗 WebSocket client connected
📡 Client subscribed to: servers (2 total)
📡 Client subscribed to: players (2 total)
⚠️ Terminated unresponsive WebSocket client
🔌 WebSocket server shut down
```

## Migration Notes

- Existing HTTP polling endpoints remain functional
- WebSocket is push-based (more efficient than polling)
- No API changes required - WebSocket runs alongside REST API
- Graceful fallback to polling if WebSocket unavailable
