

## What this project is
BovisGL is a web site and server network for hosting multiple Minecraft game-modes and servers (hub, anarchy, proxies, etc.). The repo contains the web site code and the services that manage server state, communications, and orchestration.

This repository is structured to separate code and responsibilities:

- `dev contributions/` — Developer docs and contribution guides.
  - `dev contributions/GIT_WORKFLOW.md` — Branching model and PR flow (feature -> main -> production).
  - `.internal-docs/COMMIT_CONVENTION.md` — Conventional commit format we use (types, examples, breaking-change rules).

- `web/site/` — The website code, split into two subprojects:
  - `web/site/frontend/` — The public web frontend (UI and client-side code). This implements the website's pages and client behavior.
  - `web/site/backend/` — The backend API for the website. The backend talks to local services and is reachable from the frontend via the Cloudflare Tunnel setup in production.

- `communications/` — The communications service. Responsibilities:
  - Store and serve server state (online players, bans, lightweight player metadata).
  - Provide HTTP/WebSocket endpoints used by the backend and the server plugins to sync player and server state.
  - This service is internal-facing (no direct public internet exposure); the backend mediates access for the frontend.

- `plugins/` — Server plugins/mods for the different server types. These allow each server to communicate with the communications service and the backend so that multiple servers can act as a coherent network. Example plugin types in this repo:
  - `anarchy/` — Fabric mod for the anarchy server
  - `hub/` — Paper plugin for the hub server
  - `proxy/` — Velocity proxy integration

- `scripts/` — Build and deployment helper scripts (for local/admin use). Many scripts expect to be run on the host machine that manages the servers (they copy systemd unit files, restart services, etc.).


## High-level flow (how things fit together)

1. Players connect to the Minecraft servers (hub, anarchy, proxy, ...).
2. Server plugins sync player/server state to the communications service.
3. The backend (`web/site/backend`) reads communications data and exposes admin APIs to the frontend.
4. The frontend (`web/site/frontend`) displays server status, admin interfaces, and public pages. Production access is routed through a Cloudflare Tunnel that connects the backend to the public frontend.


