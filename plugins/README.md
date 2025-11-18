# Plugins — overview

This directory contains server-side plugins and mods used by the BovisGL network. Each plugin runs on a specific server type (Fabric, Paper, Velocity) and integrates that server with the rest of the network via the communications service and backend.

Important: this file is a high-level summary only. For implementation details and configuration, check each plugin's subfolder. Some plugins include full README files (for example `proxy`), while others have code-level documentation in their `src/` tree.

## Current plugins

### anarchy (Fabric mod)
- Location: `plugins/anarchy`
- Platform: Fabric (Kotlin)
- Purpose: Integrates the anarchy Fabric server with the BovisGL network. Responsibilities include:
  - Registering the anarchy server with the network proxy/communications service so the network knows the server is online.
  - Sending periodic heartbeats with status and player counts to the communications service.
  - Disabling vanilla server ban commands (ban/pardon) so ban management is handled centrally by the proxy/plugin network.
  - Providing hooks for world/registry management and other anarchy-specific features (dimension loader, world registry, ban blockers).
- Notes: Configuration is typically provided via `config/bovisgl-anarchy.yml`. The mod retries registration until it succeeds and runs a heartbeat thread while online.

### hub (Paper plugin)
- Location: `plugins/hub`
- Platform: Paper (Kotlin)
- Purpose: Hub-specific Paper plugin that provides several features for the hub server, including:
  - ForceSpawn: modules to manage player spawn behavior (optionally cleaning player data on force-spawn).
  - Custom spawn logic: per-origin or server-specific spawn points and welcome messages.
  - Server origin tracking: records which server a player came from so cross-server flows can be supported.
  - Monitoring: small monitoring/telemetry integration that feeds the web backend for dashboards.
  - Vanilla ban command blocking, delegating ban management to the centralized network systems instead of local /ban commands.
- Notes: The hub plugin bundles multiple modules (ForceSpawn, CustomSpawn, tracking, monitoring). See code under `plugins/hub/src/main/kotlin/com/bovisgl/hub` for module entrypoints and configuration defaults.

### proxy (Velocity plugin)
- Location: `plugins/proxy`
- Platform: Velocity proxy (Kotlin / Java, Maven)
- Purpose: Acts as the central networking plugin. Key responsibilities:
  - Network-wide ban system: central ban storage and enforcement across all connected servers.
  - Player tracking: track player sessions, cross-server online status, playtime, and activity history.
  - Server registration & management: accepts server registrations and heartbeats from server plugins and exposes server state to the backend.
  - Realtime events & website integration: can export ban data and other information for use on the website and provide WebSocket/REST hooks for dashboards.
  - Cross-server commands and maintenance features (network-wide maintenance, welcome messaging, etc.).
- Notes: `plugins/proxy/README.md` contains more detailed installation, configuration, and command docs.

## Where to find more info
- Per-plugin code lives in each subfolder under `plugins/` — check `src/` for module sources and default configs.
- The `proxy` plugin includes a detailed README at `plugins/proxy/README.md` with installation, configuration, commands, permissions, and API examples.
- Hub and Anarchy plugins include code-level configuration and defaults in `src/` — I can add per-plugin README files that extract configuration keys and example snippets if you want.

## Maintenance notes
- The repository is moving large server runtime folders out of git; plugins should remain in-source as they are built into jars and deployed to server instances.
- If you want, I can:
  - Generate `plugins/anarchy/README.md` and `plugins/hub/README.md` with more detailed configuration snippets and default values extracted from the code.
  - Add a short `HOW_TO_BUILD_PLUGINS.md` describing the typical build steps (Gradle/Maven) and where to copy artifacts to the servers.

---
If you'd like the more detailed per-plugin READMEs generated now (configuration keys, example `config.yml` snippets, how to build and install), tell me which plugins to expand and I will add them.