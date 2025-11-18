
# BovisGL Network

> **Internal Project** - The BovisGL Minecraft Network infrastructure and web platform.

## What This Project Is

BovisGL is a web platform and Minecraft server network for hosting multiple game modes and servers (hub, anarchy, proxies, etc.). The repository contains all website code and services that manage server state, player coordination, and network orchestration.

**Not open source** — This is personal project infrastructure. Code is visible for reference, but contributions are not accepted.

## Repository Structure

### Documentation

- **`contributions/`** — Developer guides and workflow
  - `GIT_WORKFLOW.md` — Git branching model and PR process
  - `COMMIT_CONVENTION.md` — Conventional commit format

### Website Code (`web/site/`)

- **`web/site/frontend/`** — React web interface
  - [Frontend README](web/site/frontend/README.md) — Comprehensive documentation
  - Public landing page, admin panel, player manager
  - Real-time updates via WebSocket
  - WebAuthn/passkey authentication

- **`web/site/backend/`** — Express API server
  - [Backend README](web/site/backend/README.md) — Comprehensive documentation
  - Server management and control
  - Player database and ban system
  - Authentication and authorization
  - WebSocket server for real-time events
  - Discord bot integration

### Services

- **`communications/`** — Player coordination hub
  - [Communications README](communications/README.md) — Service documentation
  - Aggregates player data from all servers
  - Real-time player tracking and events
  - Server registration and health checks
  - Event broadcasting system

### Plugins & Mods

- **`plugins/`** — Server integrations
  - `anarchy/` — Fabric mod for anarchy server
  - `hub/` — Paper plugin for hub server
  - `proxy/` — Velocity proxy plugin
  - `parkour/` — Parkour server plugin

### Infrastructure

- **`scripts/`** — Build and deployment scripts
  - Service management
  - Database initialization
  - Backup and restore

- **`systemd-services/`** — systemd unit files
  - Service definitions for all components

## Architecture Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (web/site/frontend)            │
│                                                          │
│  • Landing page, Admin panel, Player manager            │
│  • React + TypeScript, real-time WebSocket updates      │
│  • WebAuthn authentication                              │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTPS/WebSocket
                   ▼
┌─────────────────────────────────────────────────────────┐
│                   Backend (web/site/backend)             │
│                                                          │
│  • Express API server, JWT auth, CSRF protection       │
│  • Server control (RCON), player management            │
│  • WebSocket server for real-time events               │
│  • Discord bot, LuckPerms integration                  │
└──────────┬────────────────────────────┬────────────────┘
           │                            │
           │ HTTP/WebSocket             │ HTTP
           ▼                            ▼
┌──────────────────────────┐   ┌───────────────────┐
│  Communications Service   │   │  PostgreSQL/      │
│  (communications/)        │   │  SQLite           │
│                          │   │                   │
│  • Player aggregation    │   │  • LuckPerms      │
│  • Event broadcasting    │   │  • Player data    │
│  • Server registry       │   │  • Sessions       │
│  • Online tracking       │   │  • Admin accounts │
└──────────┬───────────────┘   └───────────────────┘
           │
           │ HTTP/RCON
           ▼
┌─────────────────────────────────────────────────────────┐
│              Minecraft Servers                          │
│                                                         │
│  • Hub (Paper + Plugin)                                 │
│  • Anarchy (Fabric + Mod)                               │
│  • Proxy (Velocity Plugin)                              │
│  • Parkour, Test servers                                │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

#### Player Join Event

```
Server Plugin → Communications Service → Backend → Frontend → Admin Panel & Live Updates
```

1. Player connects to Minecraft server
2. Server plugin sends player data to Communications Service (`POST /players/join`)
3. Communications Service broadcasts to all connected clients
4. Backend receives update and stores in database
5. WebSocket event sent to frontend
6. Admin panel and player manager update in real-time

#### Server Control

```
Admin Panel → Backend API → Server Control Service → RCON → Minecraft Server
```

1. Admin clicks "Start Server" in web interface
2. POST request to backend with CSRF token and JWT auth
3. Server control service initiates process/sends RCON command
4. Minecraft server starts
5. Plugin sends player data back to Communications Service
6. Real-time status updates broadcast to admin panel

#### Ban Propagation

```
Admin → Backend → Communications → All Plugins → Enforced on all servers
```

1. Admin bans player in web interface
2. Ban stored in database
3. Communications Service notified of ban update
4. Broadcast event to all connected plugins
5. Plugins apply ban on their respective servers

## Quick Start

### Prerequisites

- Node.js v20+
- PostgreSQL (for LuckPerms)
- Minecraft servers with plugins

### Setup

```bash
# Backend
cd web/site/backend
npm install
cp .env.example .env
# Configure .env
npm run dev

# Communications Service
cd communications
npm install
npm run dev

# Frontend
cd web/site/frontend
npm install
npm run dev
```

Visit `http://localhost:3000` for the frontend.

## Documentation Links

- **[Frontend Documentation](web/site/frontend/README.md)** — UI, authentication, routing, services
- **[Backend Documentation](web/site/backend/README.md)** — API routes, server control, database, deployment
- **[Communications Documentation](communications/README.md)** — Player tracking, event broadcasting, data sync
- **[Git Workflow](contributions/GIT_WORKFLOW.md)** — Branching and PR process
- **[Commit Convention](contributions/COMMIT_CONVENTION.md)** — Commit message format

## Key Technologies

### Frontend
- React 18, TypeScript, Vite, React Router
- WebAuthn/FIDO2 authentication
- Real-time WebSocket updates

### Backend
- Express, TypeScript, Node.js
- PostgreSQL (LuckPerms), SQLite (sessions, players)
- RCON protocol for server control
- Discord.js bot integration
- Mediasoup WebRTC (voice chat)

### Communications
- Express, TypeScript, WebSocket
- SQLite for player data
- Event broadcasting system

### Plugins
- Fabric (Anarchy)
- Paper (Hub)
- Velocity (Proxy)

## Development

### Branching Model

- `main` — Stable, production-ready code
- `feature/*` — Feature branches
- `hotfix/*` — Critical fixes for production

See [Git Workflow](contributions/GIT_WORKFLOW.md) for details.

### Code Standards

- **Conventional Commits** — Follow format in [Commit Convention](contributions/COMMIT_CONVENTION.md)
- **TypeScript** — Type-safe code required
- **Linting** — ESLint with Prettier formatting
- **No external contributions** — This is internal infrastructure

## Deployment

Each component has systemd service files in `systemd-services/`:

```bash
sudo systemctl start bovisgl-backend
sudo systemctl start bovisgl-communications
sudo systemctl start bovisgl-frontend
```

See respective README files for deployment details.

## Team

Internal BovisGL development team.


