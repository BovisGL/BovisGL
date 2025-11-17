# BovisGL Hub Plugin

A comprehensive Paper/Spigot plugin for BovisGL network hub servers. This plugin combines multiple hub-specific features into a single, modular plugin.

## Features

### ForceSpawn Module
- **Player Data Deletion**: Automatically deletes player data when they leave, forcing spawn on rejoin
- **Configurable Cleanup**: Choose what data to delete (player data, advancements, stats, backups)
- **Delayed Deletion**: Configurable delay to prevent race conditions with server saving
- **Force Teleport**: Additional teleportation to spawn on join
- **Debug Mode**: Comprehensive logging for troubleshooting



## Installation

1. **Prerequisites**:
   - Paper 1.21.6 or higher
   - Java 21 or higher
   

2. **Installation**:
   ```bash
   # Build the plugin
   cd <BovisGL-root>/plugins/hub
   mvn clean package
   
   # Copy to server
   cp target/bovisgl-hub-1.0.0.jar /path/to/your/server/plugins/
   ```

3. **Configuration**:
   - Edit `plugins/BovisGL-hub/config.yml` to configure features
   - Restart the server

## Configuration

### ForceSpawn Configuration
```yaml
forcespawn:
  enabled: true
  delete-player-data: true
  delete-player-advancements: false
  delete-player-stats: false
  delete-player-backups: true
  deletion-delay: 5
  debug: false
   join-message: "&6Welcome to BovisGL, %name%! &7You can explore the hub or go through the lava portal to head to Anarchy. Use &e/discord &7for an invite and visit &ehttps://bovisgl.xyz &7for updates and more. Please read the rules on the big welcome board before playing."
  force-teleport-on-join: true
```

<!-- Removed LuckPerms REST API configuration section -->

## Commands

- `/bovisgl-hub reload` - Reload plugin configuration
- `/forcespawn reload` - Reload ForceSpawn configuration
<!-- LuckPerms REST command removed -->

## Permissions

- `bovisgl.admin` - Full administrative access
- `bovisgl.forcespawn.admin` - ForceSpawn administration
<!-- Removed LuckPerms admin permission -->

## API Endpoints

<!-- LuckPerms REST API endpoints removed -->

## Migrated From

This plugin combines and modularizes the following original plugins:
- `ForceSpawnPaper/` - Player spawn management
<!-- LuckPerms permissions extension removed -->

## Development

Built with:
- Kotlin 1.9.22
- Paper API 1.21.6
<!-- LuckPerms API and Javalin (REST) removed -->
- Maven for dependency management

## Support

For issues and support, visit the BovisGL Discord or GitHub repository.
