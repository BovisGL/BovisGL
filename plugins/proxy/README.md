# BovisGL Proxy Plugin

A comprehensive Velocity proxy plugin for the BovisGL network. This plugin handles network-wide features including ban management, player tracking, and cross-server communication.

## Features

### Ban System Module
- **Network-Wide Bans**: Bans apply across all servers connected to the proxy
- **UUID-Based Storage**: Prevents ban evasion through name changes
- **Database Persistence**: SQLite or PostgreSQL backend with connection pooling
- **Flexible Durations**: Support for hours, days, weeks, and permanent bans
- **Ban History**: Complete audit trail of all ban actions
- **Website Integration**: JSON export for web-based ban displays
- **Real-Time Checking**: Instant ban verification on connection

### Player Tracking Module
- **Cross-Server Monitoring**: Track player movement between servers
- **Playtime Statistics**: Detailed playtime tracking and analytics
- **Backend Integration**: REST API communication with BovisGL web dashboard
- **WebSocket Events**: Real-time updates for live monitoring
- **Activity History**: Comprehensive player activity logging
- **Welcome Messages**: Customizable first-join and returning player messages

### Cross-Platform Features
- **Server Management**: Monitor and manage connected servers
- **Network Commands**: Cross-server communication and utilities
- **Maintenance Mode**: Network-wide maintenance with bypass permissions

## Installation

1. **Prerequisites**:
   - Velocity 3.3.0 or higher
   - Java 21 or higher
   - Database server (SQLite included, PostgreSQL optional)

2. **Installation**:
   ```bash
   # Build the plugin
   cd <BovisGL-root>/plugins/proxy
   mvn clean package
   
   # Copy to proxy
   cp target/bovisgl-proxy-1.0.0.jar /path/to/your/velocity/plugins/
   ```

3. **Configuration**:
   - Edit `plugins/bovisgl-proxy/config.yml` to configure features
   - Restart the proxy

## Configuration

### Ban System Configuration
```yaml
bans:
  database:
    type: "sqlite"  # or "postgresql"
    sqlite:
      file: "bans.db"
  website-export:
    enabled: true
    file: "bans.json"
    interval: 5  # minutes
```

### Player Tracking Configuration
```yaml
tracking:
  database:
    type: "sqlite"  # or "postgresql"
    sqlite:
      file: "tracking.db"
  backend-sync:
    enabled: false
    url: "http://localhost:3000"
    interval: 15  # minutes
```

### Welcome Messages Configuration
```yaml
welcome:
  enabled: true
  first-join:
    enabled: true
    message: "&6Welcome to BovisGL Network!"
  returning:
    enabled: true
    message: "&6Welcome back to BovisGL, &f{player}&6!"
```

## Commands

### Ban Commands
- `/ban <player> [duration] [reason]` - Ban a player
- `/pardon <player>` - Unban a player (alias: `/unban`)
- `/banlist [page]` - List active bans (alias: `/bans`)
- `/baninfo <player>` - Get ban information for a player
- `/banhistory <player>` - View ban history for a player
- `/banreload` - Reload ban configuration
- `/banhelp` - Show ban command help

### Player Tracking Commands
- `/bovisgl [subcommand]` - Main plugin command (alias: `/bgl`)
- `/playerinfo <player>` - Get detailed player information (aliases: `/pinfo`, `/player`)
- `/online` - List online players across all servers (aliases: `/list`, `/who`)
- `/status` - Show server status information (alias: `/serverstatus`)
- `/welcome [player]` - Send welcome message (alias: `/wel`)

## Permissions

### Ban System Permissions
- `bovisgl.ban` - Permission to ban players
- `bovisgl.ban.permanent` - Permission to issue permanent bans
- `bovisgl.ban.exempt` - Exemption from being banned
- `bovisgl.pardon` - Permission to unban players
- `bovisgl.banlist` - Permission to view ban list
- `bovisgl.baninfo` - Permission to view ban info
- `bovisgl.banhistory` - Permission to view ban history
- `bovisgl.ban.admin` - Full ban system administration

### Player Tracking Permissions
- `bovisgl.playerinfo` - Permission to view player information
- `bovisgl.online` - Permission to view online players
- `bovisgl.status` - Permission to view server status
- `bovisgl.welcome` - Permission to send welcome messages
- `bovisgl.admin` - Full plugin administration

## Database Schema

### Ban System Tables
- `bans` - Active and historical ban records
- `ban_history` - Detailed ban action history

### Player Tracking Tables
- `players` - Player profile information
- `player_sessions` - Login/logout session tracking
- `player_servers` - Server connection history
- `playtime` - Playtime statistics per server

## API Integration

### Website Export
The plugin can export ban data to JSON for website integration:
```json
{
  "bans": [
    {
      "uuid": "player-uuid",
      "username": "PlayerName",
      "reason": "Ban reason",
      "bannedBy": "Staff member",
      "bannedAt": "2024-01-01T00:00:00Z",
      "expiresAt": "2024-01-08T00:00:00Z",
      "active": true
    }
  ],
  "updated": "2024-01-01T00:00:00Z"
}
```

### Backend Sync
Player data can be synchronized with a backend API for web dashboard integration.

## Migrated From

This plugin combines and modularizes the following original plugins:
- `bans/` - Velocity ban system
- `player tracker/` - Player activity tracking

## Development

Built with:
- Kotlin 1.9.22
- Velocity API 3.3.0
- HikariCP for database connection pooling
- Jackson for JSON processing
- OkHttp for HTTP client
- WebSocket client for real-time updates
- Maven for dependency management

## Database Support

- **SQLite**: Default, no additional setup required
- **PostgreSQL**: Requires separate database server setup

## Support

For issues and support, visit the BovisGL Discord or GitHub repository.

## License

This plugin is part of the BovisGL network infrastructure.
