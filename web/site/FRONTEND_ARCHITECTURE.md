# Frontend Architecture Documentation

## Overview

The BovisGL frontend is a **React + TypeScript** single-page application (SPA) built with **Vite** that provides a user interface for browsing servers, authentication, and administrative management of the Minecraft servers and player data.

**Tech Stack:**
- Framework: React 18.2 + React Router DOM 7.5
- Language: TypeScript 5.4
- Build Tool: Vite 6.3
- Auth: Passkey-based (WebAuthn with `@simplewebauthn/browser`)
- Real-time: WebSocket for live server logs

---

## Directory Structure

```
src/
├── main.tsx                 # React app entry point (renders <App /> into DOM)
├── App.tsx                  # Root component with React Router setup
├── index.css                # Global styles
│
├── assets/                  # Static assets (images, fonts, etc.)
│
├── components/              # Reusable React components (shared across pages)
│   └── SessionManager.tsx   # Manages session state, token expiry, idle timeout
│
├── hooks/                   # Custom React hooks (business logic)
│   ├── useServerStatus.ts   # Polls server status
│   ├── useSessionManagement.ts
│   ├── useServerActions.ts
│   └── ...other hooks
│
├── services/                # API/WebSocket communication layer
│   ├── apiService.ts        # Fetch wrapper with JWT/CSRF token injection
│   ├── websocketService.ts  # WebSocket connection manager
│   ├── skinService.ts       # Player skin fetching (Minecraft skins)
│   ├── serverActionService.ts
│   └── ...other services
│
└── pages/                   # Route pages (one per route)
    ├── home/                # Public homepage
    │   ├── HomePage.tsx     # Main home page component
    │   ├── HomePage.css
    │   ├── services/
    │   │   └── apiService.ts (local overrides if needed)
    │   └── components/      # Home page sub-components
    │       ├── AnarchyBanner.tsx
    │       ├── CountdownTiles.tsx
    │       ├── TrailerPanel.tsx
    │       ├── HowToJoinCard.tsx
    │       ├── ContactCard.tsx
    │       └── RulesPanel.tsx
    │
    ├── auth/                # Authentication pages
    │   ├── PasskeyAuth.tsx       # Login with Passkey (WebAuthn)
    │   ├── PasskeyRegister.tsx   # Register new Passkey
    │   ├── ProtectedRoute.tsx    # Route guard for admin/protected pages
    │   ├── SessionExpiredPage.tsx
    │   └── PasskeyAuth.css
    │
    ├── admin/               # Admin dashboard (protected)
    │   └── AdminPanel.tsx   # Admin controls
    │
    ├── player manager/      # Player management page (protected)
    │   └── PlayerManagerPage.tsx
    │
    ├── VC/                  # Voice Chat related pages (if any)
    │
    └── common/              # Shared utilities and styles
        ├── styles/
        │   └── index.css    # Common styles
        └── utils/
            └── auth.ts      # Auth utility functions

```

---

## Request Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Component                          │
│               (HomePage, AdminPanel, etc.)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  Custom Hooks  │
                    │ (e.g., use     │
                    │ ServerStatus)  │
                    └────────┬───────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
        ┌──────────────────┐      ┌──────────────────┐
        │  apiService      │      │ websocketService │
        │  (GET/POST/PUT)  │      │  (real-time)     │
        └────────┬─────────┘      └────────┬─────────┘
                 │                         │
                 └────────────┬────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Backend API      │
                    │  @ backend.       │
                    │  bovisgl.xyz      │
                    │  (+ WebSocket)    │
                    └───────────────────┘
```

---

## Core Components & Services

### 1. **App.tsx** (Root Component)
**Purpose:** Sets up React Router with all routes and wraps app with SessionManager.

**Routes:**
- **Public:**
  - `/` → HomePage
  - `/login` → PasskeyAuth (login)
  - `/register/:token` → PasskeyRegister (register with token)
  - `/session-expired` → SessionExpiredPage

- **Protected (requires ProtectedRoute wrapper):**
  - `/admin` → AdminPanel
  - `/playermanger` → PlayerManagerPage

**Calls:**
- Renders `<SessionManager />` (wraps all routes)
- Renders `<Router>` and `<Routes>`

---

### 2. **SessionManager.tsx** (Session State Manager)
**Purpose:** Monitors user session state and handles idle timeouts.

**Responsibilities:**
- Tracks JWT token expiry
- Detects idle timeout
- Closes WebSocket connections on session expiry
- Redirects to `/session-expired` when token expires

**Calls:**
- Uses `useSessionManagement()` hook
- Calls `localStorage.setItem()` to trigger disconnect signals
- Closes all active WebSocket connections

**Called by:**
- App.tsx (wraps all routes)

---

### 3. **apiService.ts** (HTTP Client)
**Purpose:** Centralized HTTP request handler with automatic JWT token injection.

**Methods:**
- `api.get(url, options)` → fetch with GET method
- `api.post(url, body, options)` → fetch with POST method
- `api.put(url, body, options)` → fetch with PUT method
- `api.delete(url, options)` → fetch with DELETE method

**Features:**
- Auto-injects `Authorization: Bearer {token}` header if JWT exists in `localStorage.auth_token`
- Sets `credentials: 'include'` for cookie support (CSRF protection)
- Base URL: `VITE_API_BASE_URL` env var (default: `https://backend.bovisgl.xyz`)

**Called by:**
- All page components (HomePage, AdminPanel, etc.)
- All hooks (useServerStatus, useServerActions, etc.)

---

### 4. **websocketService.ts** (Real-time Connection)
**Purpose:** Manages WebSocket connections for live server logs and events.

**Methods:**
- `connect()` → Opens WebSocket connection
- `subscribe(eventName, handler)` → Listen for specific events
- `unsubscribe(eventName, handler)` → Stop listening
- `send(event, data)` → Send message to server
- `close()` → Gracefully close connection

**Features:**
- Auto-reconnect on disconnect (max 5 attempts, 2-second delays)
- Event-based handler pattern (publish-subscribe)
- Base URL: `VITE_WS_URL` env var (default: `wss://backend.bovisgl.xyz`)
- Automatically appends `/api/ws` if not present

**Called by:**
- Pages/components that need real-time data (e.g., logs, status updates)
- SessionManager (closes on session expiry)

---

### 5. **HomePage.tsx** (Public Home Page)
**Purpose:** Displays landing page with server status, countdown, and information.

**State:**
- `isAuthenticated` → Is user logged in?
- `isMobile` → Responsive breakpoint (≤768px)
- `countdown` → Launch countdown (days/hours/minutes/seconds)
- `isLaunched` → Server launch status
- `serversOnline` → Online status for hub/anarchy/proxy servers

**Key Actions:**
- `checkAuth()` → Calls `api.get('/api/public/auth/check')` via `checkAuthentication()` util
- `checkServerStatus()` → Calls `api.get('/api/public/servers/status')`
- Sets up 30-second polling for auth state
- Sets up 5-second polling for server status

**Sub-Components Rendered:**
- `<AnarchyBanner />` → Anarchy server branding
- `<CountdownTiles />` → Launch countdown display
- `<TrailerPanel />` → Video trailer
- `<HowToJoinCard />` → Getting started instructions
- `<ContactCard />` → Contact information
- `<RulesPanel />` → Server rules

**Called by:**
- App.tsx (route `/`)

---

### 6. **PasskeyAuth.tsx** (Login Page)
**Purpose:** Authenticates user via WebAuthn Passkey.

**Flow:**
1. User enters username
2. Calls `api.post('/api/auth/passkey/login')` to get challenge
3. Uses `@simplewebauthn/browser` to get assertion
4. Sends assertion back to `/api/auth/passkey/verify`
5. Backend returns JWT token
6. Stores token in `localStorage.auth_token`
7. Redirects to previous page or admin panel

**Called by:**
- App.tsx (route `/login`)
- ProtectedRoute (redirects if not authenticated)

---

### 7. **PasskeyRegister.tsx** (Registration Page)
**Purpose:** Registers new Passkey for a user.

**Prerequisites:**
- User must have a valid registration token (`:token` URL param)
- Registration tokens are typically provided by an admin

**Flow:**
1. Extracts token from URL param
2. Calls `api.post('/api/auth/passkey/register')` with token to get options
3. Uses `@simplewebauthn/browser` to create credential
4. Sends attestation back to verify
5. Backend stores credential
6. User can now login with that Passkey

**Called by:**
- App.tsx (route `/register/:token`)

---

### 8. **ProtectedRoute.tsx** (Route Guard)
**Purpose:** Protects admin routes from unauthenticated access.

**Logic:**
1. Checks if user has valid JWT token in `localStorage.auth_token`
2. If no token → redirects to `/login`
3. If token present → renders child route (AdminPanel, PlayerManagerPage)
4. Stores "from" location so user redirects back after login

**Called by:**
- App.tsx (wraps `/admin` and `/playermanger` routes)

---

### 9. **useServerStatus.ts** (Custom Hook)
**Purpose:** Fetches and polls server status from backend.

**Returns:**
```typescript
{
  servers: ServerInfo[],    // Array of server statuses
  loading: boolean,         // Is data fetching?
  error: string | null,     // Error message if any
  refresh: () => void       // Manual refetch function
}
```

**Calls:**
- `api.get('/api/public/servers/status')` (public endpoint, no auth needed)
- Auto-refetches every 5 seconds

**Called by:**
- HomePage (displays server online/offline status)
- AdminPanel (shows server details)

---

### 10. **useSessionManagement.ts** (Custom Hook)
**Purpose:** Monitors session and handles expiry/idle timeout.

**Parameters:**
- `onDisconnect` → Callback when session expires

**Logic:**
1. Tracks JWT token expiry time
2. Detects user idle (no mouse/keyboard activity for timeout period)
3. Calls `onDisconnect()` callback when session should end
4. SessionManager then redirects to `/session-expired`

**Called by:**
- SessionManager.tsx

---

### 11. **useServerActions.ts** (Custom Hook)
**Purpose:** Provides functions to control servers (start, stop, restart, etc.).

**Methods/Functions:**
- `startServer(serverId)` → POST to `/api/admin/servers/{id}/start`
- `stopServer(serverId)` → POST to `/api/admin/servers/{id}/stop`
- `restartServer(serverId)` → POST to `/api/admin/servers/{id}/restart`
- `getServerLogs(serverId)` → Get logs from WebSocket or API

**Called by:**
- AdminPanel (control buttons)
- PlayerManagerPage (background management)

---

## Data Flow Examples

### Example 1: User Logs In
```
PasskeyAuth.tsx
  ↓
User clicks "Login"
  ↓
api.post('/api/auth/passkey/login', { username })
  ↓
Backend returns challenge
  ↓
WebAuthn assertion created
  ↓
api.post('/api/auth/passkey/verify', { assertion })
  ↓
Backend returns JWT
  ↓
localStorage.setItem('auth_token', jwt)
  ↓
Redirect to /admin or previous page
  ↓
SessionManager detects auth_token and starts session tracking
```

### Example 2: Admin Checks Server Status
```
AdminPanel.tsx (page)
  ↓
useServerStatus() hook (fetches data)
  ↓
api.get('/api/public/servers/status')
  ↓
apiService auto-injects JWT from localStorage
  ↓
Backend processes request
  ↓
Returns { hub: {...}, anarchy: {...}, proxy: {...} }
  ↓
Hook updates component state
  ↓
Component re-renders with status
```

### Example 3: Real-time Server Logs
```
AdminPanel.tsx requests logs
  ↓
websocketService.connect()
  ↓
Opens WebSocket to wss://backend.bovisgl.xyz/api/ws
  ↓
websocketService.subscribe('server_logs', (data) => {...})
  ↓
Backend sends logs via WebSocket
  ↓
Handler updates component state
  ↓
Component displays live logs
  ↓
On session expiry, SessionManager closes WebSocket
```

---

## Environment Variables

Create a `.env` file in `web/site/frontend/`:

```bash
# Backend API base URL
VITE_API_BASE_URL=https://backend.bovisgl.xyz

# WebSocket URL for real-time data
VITE_WS_URL=wss://backend.bovisgl.xyz
```

For development (`.env.local`):
```bash
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

---

## Build & Development

### Development Server
```bash
cd web/site/frontend
npm install
npm run dev
```
Runs on `http://localhost:5173` by default (Vite dev server).

### Build for Production
```bash
npm run build
```
Outputs optimized bundle to `dist/` folder.

### Linting
```bash
npm run lint
```
Checks TypeScript and ESLint rules.

---

## Component Hierarchy

```
App.tsx
├── SessionManager.tsx (invisible, manages session)
└── Router
    ├── HomePage (public)
    │   ├── AnarchyBanner
    │   ├── CountdownTiles
    │   ├── TrailerPanel
    │   ├── HowToJoinCard
    │   ├── ContactCard
    │   └── RulesPanel
    │
    ├── PasskeyAuth (public)
    │
    ├── PasskeyRegister (public)
    │
    ├── SessionExpiredPage (public)
    │
    ├── ProtectedRoute (guard)
    │   ├── AdminPanel (protected)
    │   │   └── (server management UI)
    │   │
    │   └── PlayerManagerPage (protected)
    │       └── (player management UI)
    │
    └── VC/ (Voice Chat pages if any)
```

---

## Authentication Flow

```
User visits /admin
  ↓
ProtectedRoute checks localStorage.auth_token
  ↓
If no token:
  └─→ Redirect to /login → PasskeyAuth
      └─→ User authenticates → JWT stored → Redirect back to /admin
  
If token exists:
  └─→ Render AdminPanel
      └─→ apiService auto-injects JWT in all requests
          └─→ Backend validates JWT and processes request
```

---

## Error Handling

### API Errors
- Services catch fetch errors and log to console
- Components should implement error UI for failed requests
- Example: `if (error) <div className="error">{error}</div>`

### WebSocket Errors
- websocketService auto-reconnects up to 5 times
- After 5 failed attempts, connection closes
- Components should handle offline state gracefully

### Session Expiry
- SessionManager detects token expiry
- Redirects user to `/session-expired` page
- User must login again at `/login`

---

## Key Concepts

### Hooks Pattern
React Hooks (like `useServerStatus`, `useSessionManagement`) encapsulate reusable logic:
- Data fetching
- State management
- Side effects (intervals, listeners)
- Dependencies and cleanup

### Service Layer
Services (`apiService`, `websocketService`) isolate:
- HTTP/WebSocket communication
- Token injection and header management
- Retry/reconnection logic
- Error handling

### Protected Routes
`ProtectedRoute` component acts as a middleware:
- Checks authentication before rendering
- Redirects to login if needed
- Preserves user's intended destination

### Session Management
SessionManager runs invisibly to:
- Track token expiry time
- Detect user idle state
- Clean up connections on expiry
- Redirect to session-expired page

---

## Common Tasks

### Add a New Page
1. Create folder: `src/pages/mypage/`
2. Create component: `src/pages/mypage/MyPage.tsx`
3. Add route in `App.tsx`:
   ```typescript
   <Route path="/mypage" element={<MyPage />} />
   ```
4. If protected, wrap in `<ProtectedRoute>` instead

### Fetch Data in a Page
1. Use `useEffect()` to call `api.get()` or `api.post()`
2. Store result in `useState()`
3. Render in JSX
4. Example:
   ```typescript
   useEffect(() => {
     api.get('/api/data').then(res => res.json()).then(setData);
   }, []);
   ```

### Connect to WebSocket in a Page
1. Call `websocketService.connect()`
2. Subscribe to events: `websocketService.subscribe('eventName', handler)`
3. Unsubscribe on unmount: `websocketService.unsubscribe('eventName', handler)`
4. Example:
   ```typescript
   useEffect(() => {
     websocketService.connect();
     websocketService.subscribe('logs', (data) => console.log(data));
     return () => websocketService.unsubscribe('logs', (data) => {});
   }, []);
   ```

### Debug Network Requests
1. Open DevTools → Network tab
2. Filter by XHR/Fetch
3. Check Authorization header (should have JWT)
4. Check response status and body

### Debug WebSocket
1. Open DevTools → Network tab
2. Filter by WS (WebSocket)
3. Click WebSocket connection
4. View Frames tab to see messages

---

## Summary

The frontend is a **React SPA** organized into:
- **Pages** (route-level components)
- **Components** (reusable UI pieces)
- **Hooks** (business logic & data fetching)
- **Services** (HTTP/WebSocket clients)

**Key Flow:**
1. User interacts with page component
2. Component uses hooks (e.g., `useServerStatus`) to fetch data
3. Hooks call services (e.g., `apiService`)
4. Services communicate with backend
5. Data returns to component via state
6. Component re-renders with new data

**Authentication:**
- Passkey-based via WebAuthn
- JWT stored in `localStorage`
- Auto-injected by `apiService` in all requests
- Session managed by `SessionManager` and `useSessionManagement`

This architecture keeps concerns separated, making the code modular, testable, and easy to extend.
