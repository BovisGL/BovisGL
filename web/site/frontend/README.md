# BovisGL Frontend

## Overview

The BovisGL Frontend is a modern React-based web application that serves as the primary user interface for the BovisGL Minecraft Network. It provides a comprehensive platform for server information, player management, and administrative controls.

This single-page application (SPA) offers:
- **Public Landing Page**: Information about the BovisGL Minecraft network, server status, countdown timers, how to join instructions, and community rules
- **Passkey Authentication**: Secure, passwordless login system using WebAuthn/FIDO2
- **Admin Panel**: Real-time server management dashboard with control capabilities for all network servers
- **Player Manager**: Live player tracking interface with search, filtering, and ban management
- **Real-time Updates**: WebSocket integration for live server status and player activity monitoring

## Tech Stack

### Core Technologies
- **React 18.2** - Component-based UI library
- **TypeScript 5.4** - Type-safe JavaScript superset
- **Vite 6.3** - Fast build tool and development server
- **React Router DOM 7.5** - Client-side routing and navigation

### Authentication & Security
- **@simplewebauthn/browser 13.1** - WebAuthn/FIDO2 passkey authentication
- **CSRF Protection** - Token-based cross-site request forgery prevention

### Build & Development Tools
- **ESLint** - Code linting and quality enforcement
- **TypeScript ESLint** - TypeScript-specific linting rules
- **Terser** - JavaScript minification for production builds

### Key Features
- **WebSocket Support** - Real-time bidirectional communication
- **Responsive Design** - Mobile-first approach with adaptive layouts
- **Code Splitting** - Optimized bundle chunking for faster loads
- **Proxy Configuration** - Development API proxying to backend


## Features

### Public Pages
- **Landing Page**: Server information, status indicators, and countdown timers
- **How to Join**: Instructions for connecting to the server from Java and Bedrock editions
- **Rules Panel**: Community guidelines and server rules
- **Trailer Section**: Embedded video content showcase
- **Contact Information**: Discord and social media links

### Authentication System
- **Passkey Login**: WebAuthn/FIDO2 passwordless authentication
- **Passkey Registration**: Token-based admin account registration
- **Session Management**: Automatic token validation and session expiry handling
- **Protected Routes**: Route guards for authenticated-only pages
- **CSRF Protection**: Secure token-based request validation

### Admin Panel
- **Server Grid Dashboard**: Visual cards for all network servers (Hub, Anarchy, Proxy, etc.)
- **Real-time Server Status**: Live monitoring of online/offline status via WebSocket
- **Server Controls**: Start, stop, restart, and kill server processes
- **Test Mode Toggle**: Switch between production and test server views
- **Action Queue**: Pending action tracking with visual feedback
- **Responsive Sidebar**: Collapsible navigation with mobile support
- **Logout Confirmation**: Modal-based logout flow

### Player Manager
- **Live Player List**: Real-time player tracking with online/offline status
- **Player Search**: Filter players by name or UUID
- **Player Details**: View player information including:
  - Account type (Java/Bedrock)
  - Current server and client
  - Join/leave timestamps
  - Avatar rendering from Minecraft skins
- **Ban Management**: Ban and unban players with reason tracking
- **Resizable Sidebar**: Draggable sidebar width adjustment
- **Mobile Drawer**: Overlay-based player list on small screens
- **WebSocket Updates**: Instant player status updates without polling

### Real-time Features
- **WebSocket Connection**: Persistent connection for live updates
- **Server Status Monitoring**: Automatic status changes broadcast
- **Player Activity Tracking**: Real-time join/leave/move events
- **Action Status Updates**: Live feedback on server operations
- **Auto-reconnection**: Automatic WebSocket reconnection on disconnect


## Project Structure

```
frontend/
├── public/                      # Static assets
│   ├── logo.png                # BovisGL logo
│   ├── manifest.json           # PWA manifest
│   ├── robots.txt              # SEO configuration
│   ├── sitemap.xml             # Site map for search engines
│   └── *.mp3                   # Audio files
│
├── src/
│   ├── main.tsx                # Application entry point
│   ├── App.tsx                 # Root component with routing
│   ├── index.css               # Global styles
│   │
│   ├── components/             # Shared components
│   │   └── SessionManager.tsx  # Session validation and expiry handling
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useServerStatus.ts  # Server status management
│   │   ├── useServerActions.ts # Server control actions
│   │   └── useSessionManagement.ts # Auth session handling
│   │
│   ├── services/               # API and external services
│   │   ├── apiService.ts       # HTTP API client with auth
│   │   ├── websocketService.ts # WebSocket connection manager
│   │   ├── serverActionService.ts # Server action queue
│   │   └── skinService.ts      # Minecraft skin/avatar fetching
│   │
│   ├── pages/                  # Page components
│   │   ├── home/               # Public landing page
│   │   │   ├── HomePage.tsx
│   │   │   ├── HomePage.css
│   │   │   ├── components/     # Home page sections
│   │   │   │   ├── AnarchyBanner.tsx
│   │   │   │   ├── CountdownTiles.tsx
│   │   │   │   ├── TrailerPanel.tsx
│   │   │   │   ├── HowToJoinCard.tsx
│   │   │   │   ├── ContactCard.tsx
│   │   │   │   └── RulesPanel.tsx
│   │   │   └── services/       # Home-specific services
│   │   │
│   │   ├── auth/               # Authentication pages
│   │   │   ├── PasskeyAuth.tsx # Login page
│   │   │   ├── PasskeyRegister.tsx # Registration page
│   │   │   ├── ProtectedRoute.tsx # Route guard component
│   │   │   └── SessionExpiredPage.tsx
│   │   │
│   │   ├── admin/              # Admin dashboard
│   │   │   ├── AdminPanel.tsx
│   │   │   ├── AdminPanel.css
│   │   │   └── components/
│   │   │       ├── AdminSidebar.tsx  # Navigation sidebar
│   │   │       ├── ServerCard.tsx    # Server status card
│   │   │       └── ServerDetails.tsx # Server detail view
│   │   │
│   │   ├── player manager/     # Player management interface
│   │   │   ├── PlayerManagerPage.tsx
│   │   │   ├── PlayerManagerPage.css
│   │   │   └── components/
│   │   │       ├── PlayerSidebar.tsx # Player list sidebar
│   │   │       └── PlayerInfo.tsx    # Player detail panel
│   │   │
│   │   └── common/             # Shared page resources
│   │       ├── styles/         # Common CSS modules
│   │       │   ├── index.css   # Style imports
│   │       │   ├── variables.css
│   │       │   ├── layout.css
│   │       │   ├── buttons.css
│   │       │   ├── cards.css
│   │       │   ├── forms.css
│   │       │   └── status.css
│   │       └── utils/          # Utility functions
│   │           ├── auth.ts
│   │           ├── dateTime.ts
│   │           ├── player.ts
│   │           ├── serverStatus.ts
│   │           ├── string.ts
│   │           └── responsive.ts
│   │
│   └── assets/                 # Build-time assets
│
├── dist/                       # Production build output
├── node_modules/               # Dependencies
├── .env                        # Environment variables (local)
├── .env.example                # Environment template
├── index.html                  # HTML template
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript configuration
├── tsconfig.node.json          # TypeScript config for Node
└── package.json                # Project metadata and dependencies
```


## Prerequisites

Before running the frontend, ensure you have:

- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js) or **yarn**
- A modern web browser with WebAuthn/FIDO2 support (Chrome, Firefox, Edge, Safari)
- Access to the BovisGL backend API (running locally or remotely)

### Quick Start

1. **Navigate to the frontend directory:**
   ```bash
   cd web/site/frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   ```bash
   # Backend API URL
   VITE_API_BASE_URL=https://backend.bovisgl.xyz
   
   # WebSocket URL
   VITE_WS_URL=wss://backend.bovisgl.xyz
   ```
   
   For local development:
   ```bash
   VITE_API_BASE_URL=http://localhost:3001
   VITE_WS_URL=ws://localhost:3001
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```
   
   Application runs at `http://localhost:3000`

5. **Build for production:**
   ```bash
   npm run build
   ```

## API Integration

The frontend communicates with the backend through two primary channels: HTTP REST API and WebSocket connections.

### API Service (`apiService.ts`)

Centralized HTTP client with automatic authentication and error handling:

**Features:**
- Automatic JWT token injection from localStorage
- CSRF token support for protected endpoints
- Credentials inclusion for cookie-based sessions
- RESTful methods: `GET`, `POST`, `PUT`, `DELETE`

**Usage Example:**
```typescript
import { api } from './services/apiService';

// GET request
const response = await api.get('/api/public/servers/status');
const data = await response.json();

// POST request with body
const response = await api.post('/api/public/passkey/login/verify', {
  assertion,
  name: 'admin'
});
```

### API Endpoints

#### Public Endpoints (No Auth Required)
- `GET /api/public/servers/status` - Get current status of all servers
- `GET /api/public/csrf-token` - Get CSRF token for authenticated requests
- `GET /api/public/passkey/available-admins` - Get list of admin accounts
- `POST /api/public/passkey/login/options` - Get WebAuthn login options
- `POST /api/public/passkey/login/verify` - Verify WebAuthn assertion
- `GET /api/public/passkey/invite-registration-options` - Get registration options
- `POST /api/public/passkey/invite-registration-verify` - Complete registration
- `POST /api/public/auth/logout` - Logout and invalidate session

#### Protected Endpoints (Auth Required)
Server actions automatically include the JWT token and CSRF token:
- Server control endpoints are accessed through the `serverActionService`
- Player management endpoints are accessed through API service with auth headers

### WebSocket Service (`websocketService.ts`)

Real-time bidirectional communication for live updates:

**Connection URL:** `ws(s)://backend.bovisgl.xyz/api/ws`

**Features:**
- Event subscription pattern for multiple consumers
- Automatic reconnection with exponential backoff
- JSON message parsing and routing
- Connection state management

**Usage Example:**
```typescript
import { websocketService } from './services/websocketService';

// Connect
websocketService.connect();

// Subscribe to events
const unsubscribe = websocketService.on('server:status', (data) => {
  console.log('Server status update:', data);
});

// Clean up
unsubscribe();
websocketService.disconnect();
```

**WebSocket Events:**
- `server:status` - Server status changes (online/offline/starting/stopping)
- `player:join` - Player joined a server
- `player:leave` - Player left a server
- `player:move` - Player switched servers
- `action:complete` - Server action completed
- `action:failed` - Server action failed

### Server Action Service (`serverActionService.ts`)

Manages server control operations with action queue and state synchronization:

**Features:**
- Shared state across components
- Pending action tracking
- Duplicate action prevention
- Automatic timeout handling (5 minutes)
- Subscription pattern for live updates

**Server Actions:**
- Start server
- Stop server
- Restart server
- Kill server process

### Environment Configuration

API and WebSocket URLs are configured via environment variables:

```bash
VITE_API_BASE_URL=https://backend.bovisgl.xyz
VITE_WS_URL=wss://backend.bovisgl.xyz
```

The Vite dev server proxies `/api` requests to the backend (configured in `vite.config.ts`).

## Authentication

The frontend uses **WebAuthn/FIDO2 passkey authentication** for passwordless, secure admin access.

### Authentication Flow

#### 1. **Registration** (`PasskeyRegister.tsx`)
   - Admin receives an invitation token via secure channel
   - Navigate to `/register/:token`
   - Frontend requests registration options from backend
   - Browser prompts for biometric/security key authentication
   - Passkey is created and stored on user's device
   - Credential is verified and admin account is activated

#### 2. **Login** (`PasskeyAuth.tsx`)
   - Navigate to `/login`
   - Frontend fetches available admin accounts
   - For each admin, attempt WebAuthn authentication
   - Browser prompts for biometric/security key
   - Assertion is verified with backend
   - On success, JWT token is stored in localStorage
   - User is redirected to `/admin` dashboard

#### 3. **Session Management** (`SessionManager.tsx`)
   - Monitors user activity (mouse, keyboard, scroll, touch events)
   - Checks token validity with backend every second
   - Tracks idle timeout (30 minutes of inactivity)
   - On session expiry:
     - Closes all WebSocket connections
     - Clears localStorage tokens
     - Redirects to login or session expired page

#### 4. **Protected Routes** (`ProtectedRoute.tsx`)
   - Wraps admin and player manager routes
   - Verifies JWT token with backend on mount
   - Shows loading spinner during verification
   - Redirects to `/login` if token is invalid or missing

### Token Storage

- **JWT Token**: Stored in `localStorage` under key `auth_token`
- **Auto-injection**: All API requests automatically include the token via `apiService`
- **Header Format**: `Authorization: Bearer <token>`

### CSRF Protection

- CSRF tokens are fetched from `/api/public/csrf-token`
- Included in headers as `X-CSRF-Token` for state-changing requests
- Required for server control operations (start, stop, restart)

### Session Timeout

- **Idle Timeout**: 30 minutes of inactivity
- **Activity Events**: Mouse, keyboard, scroll, touch
- **Expiry Behavior**: Redirect to `/session-expired` with reason

### Logout Flow

1. User clicks logout button
2. Confirmation modal appears
3. On confirm:
   - POST request to `/api/public/auth/logout` with CSRF token
   - Remove `auth_token` from localStorage
   - Redirect to `/login`

## Routing

The application uses **React Router DOM v7.5** for client-side navigation.

### Route Structure

```tsx
<Router>
  <SessionManager />  {/* Global session monitoring */}
  <Routes>
    {/* Public Routes - No authentication required */}
    <Route path="/" element={<HomePage />} />
    <Route path="/login" element={<PasskeyAuth />} />
    <Route path="/register/:token" element={<PasskeyRegister />} />
    <Route path="/session-expired" element={<SessionExpiredPage />} />
    
    {/* Protected Routes - Authentication required */}
    <Route element={<ProtectedRoute />}>
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/playermanger" element={<PlayerManagerPage />} />
    </Route>
  </Routes>
</Router>
```

### Route Definitions

| Path | Component | Auth | Description |
|------|-----------|------|-------------|
| `/` | `HomePage` | No | Public landing page with server info |
| `/login` | `PasskeyAuth` | No | Passkey authentication login |
| `/register/:token` | `PasskeyRegister` | No | Invitation-based registration |
| `/session-expired` | `SessionExpiredPage` | No | Session timeout notification |
| `/admin` | `AdminPanel` | Yes | Server management dashboard |
| `/playermanger` | `PlayerManagerPage` | Yes | Player tracking and ban management |

### Protected Route Pattern

The `<ProtectedRoute />` component wraps authenticated routes:

1. Checks for JWT token in localStorage
2. Verifies token validity with backend (`/api/locked/auth/verify`)
3. Shows loading spinner during verification
4. Redirects to `/login` if authentication fails
5. Renders `<Outlet />` (nested routes) on success

### Navigation

**Programmatic Navigation:**
```typescript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
navigate('/admin');
navigate('/login', { replace: true });
navigate('/session-expired', { state: { reason: 'idle' } });
```

**Link Components:**
```tsx
import { Link } from 'react-router-dom';

<Link to="/admin">Admin Panel</Link>
```

## Services

The frontend architecture uses specialized service modules for API communication, real-time updates, and external integrations.

### API Service (`apiService.ts`)

HTTP client wrapper with authentication and error handling.

**Features:**
- Automatic JWT token injection from localStorage
- CSRF token support for protected requests
- Credentials included for cookie-based sessions
- Base URL configuration via environment variables

**Methods:**
```typescript
api.get(url: string, options?: RequestInit): Promise<Response>
api.post(url: string, body?: any, options?: RequestInit): Promise<Response>
api.put(url: string, body?: any, options?: RequestInit): Promise<Response>
api.delete(url: string, options?: RequestInit): Promise<Response>
```

**Configuration:**
- Base URL: `VITE_API_BASE_URL` (defaults to `https://backend.bovisgl.xyz`)
- Automatic `Authorization: Bearer <token>` header
- `Content-Type: application/json` for all requests

---

### WebSocket Service (`websocketService.ts`)

Real-time bidirectional communication manager.

**Features:**
- Event subscription pattern (pub/sub)
- Automatic reconnection with exponential backoff
- Connection state management
- JSON message parsing and routing

**Connection:**
- URL: `VITE_WS_URL/api/ws` (defaults to `wss://backend.bovisgl.xyz/api/ws`)
- Max reconnect attempts: 5
- Reconnect delay: 2 seconds

**Methods:**
```typescript
connect(): WebSocketService
disconnect(): void
on(event: string, handler: Function): () => void  // Returns unsubscribe function
send(event: string, data: any): void
```

**Event Types:**
- `server:status` - Server online/offline changes
- `player:join` - Player joined server
- `player:leave` - Player left server
- `player:move` - Player switched servers
- `action:complete` - Server action finished
- `action:failed` - Server action error

---

### Server Action Service (`serverActionService.ts`)

Manages server control operations with shared state synchronization.

**Features:**
- Pending action tracking across components
- Duplicate action prevention
- Automatic timeout handling (5 minutes)
- Subscription pattern for live updates

**Methods:**
```typescript
subscribe(serverId: string, callback: Function): () => void
startServer(serverId: string, status: string, csrfToken: string): Promise<Result>
stopServer(serverId: string, status: string, csrfToken: string): Promise<Result>
checkAndClearPendingAction(serverId: string, status: string): void
```

**State Management:**
- Tracks pending actions per server
- Notifies all subscribers on state changes
- Clears actions when target status reached
- Times out stale actions after 5 minutes

---

### Skin Service (`skinService.ts`)

Fetches Minecraft player avatars from external providers.

**Features:**
- 24-hour caching for performance
- Multiple avatar provider fallbacks
- UUID format normalization
- Default Steve head fallback

**Methods:**
```typescript
getPlayerAvatarUrlSync(uuid: string, name: string, size?: number): string
getPlayerAvatarUrl(uuid: string, name: string, size?: number): Promise<string>
resolvePlayerAvatar(img: HTMLImageElement, uuid: string, name: string, size?: number): void
```

**Avatar Providers:**
1. **Crafatar** (primary) - `https://crafatar.com/avatars/{uuid}?size={s}&overlay`
2. **Default Steve Head** - Base64 embedded PNG fallback

**Cache:**
- Storage: In-memory Map
- Duration: 24 hours
- Key format: `{uuid}-{size}`

---

### Custom Hooks

#### `useServerStatus()`
Polls server status every 5 seconds.

**Returns:**
```typescript
{
  servers: ServerInfo[],
  loading: boolean,
  error: string | null,
  refresh: () => void
}
```

#### `useServerActions(serverId, currentStatus, csrfToken)`
Manages server control actions.

**Returns:**
```typescript
{
  pendingAction: PendingAction | null,
  startServer: () => Promise<Result>,
  stopServer: () => Promise<Result>
}
```

#### `useSessionManagement(onDisconnect?)`
Monitors session validity and idle timeout.

**Features:**
- Token expiry checking (1 second interval)
- Idle timeout detection (30 minutes)
- Activity event monitoring
- WebSocket disconnection on expiry


