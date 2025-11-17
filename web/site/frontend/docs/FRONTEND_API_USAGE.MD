# Frontend API Endpoints - Implementation Summary

## All API Calls in New Frontend (/web/site/frontend/src/)

### Authentication & Authorization

#### PasskeyAuth.tsx
```typescript
GET  /api/public/passkey/available-admins      // Load available admin accounts
POST /api/public/passkey/login/options         // Get WebAuthn challenge (body: { name })
POST /api/public/passkey/login/verify          // Verify assertion (body: { assertion, name })
```

#### PasskeyRegister.tsx
```typescript
GET  /api/public/passkey/invite-registration-options?inviteToken={token}  // Validate invite & get options
POST /api/public/passkey/invite-registration-verify                       // Verify registration (body: { attestation, inviteToken })
```

#### ProtectedRoute.tsx
```typescript
GET  /api/locked/auth/verify                    // Verify JWT token (requires Bearer token)
```

---

### Server Management

#### useServerStatus.ts (Hook)
```typescript
GET  /api/locked/servers                        // Get all server info (polls every 5s)
```

#### serverActionService.ts
```typescript
POST /api/locked/servers/${serverId}/start     // Start server (requires CSRF token)
POST /api/locked/servers/${serverId}/stop      // Stop server (requires CSRF token)
```

#### ServerDetails.tsx
```typescript
GET  /api/locked/servers/${serverId}/logs      // Fetch recent logs
POST /api/locked/servers/${serverId}/command   // Execute command (body: { command }, requires CSRF)
```

#### HomePage.tsx
```typescript
GET  /api/public/servers/status                 // Public server status for homepage
```

---

### Admin Panel

#### AdminPanel.tsx
```typescript
GET  /api/locked/csrf-token                     // Get CSRF token for mutations
```

---

### Utility Functions (Common)

#### auth.ts
```typescript
GET  /api/locked/auth/verify                    // Verify JWT token
```

#### serverStatus.ts
```typescript
GET  /api/public/servers/status                 // Public server status
```

---

## WebSocket Connections

### websocketService.ts
```typescript
// Connection
wss://backend.bovisgl.xyz (or process.env.VITE_WS_URL)

// Messages Sent
{ action: 'subscribe', channel: 'server:${serverId}:logs' }
{ action: 'unsubscribe', channel: 'server:${serverId}:logs' }

// Events Received
{ event: 'serverLog', serverId: string, log: string }
```

---

## Authentication Headers

### All Protected Endpoints (`/api/locked/*`)
```typescript
headers: {
  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
  'Content-Type': 'application/json'
}
credentials: 'include'  // For cookie-based session backup
```

### CSRF-Protected Mutations
```typescript
headers: {
  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
  'X-CSRF-Token': csrfToken,
  'Content-Type': 'application/json'
}
```

---

## Endpoint Summary by Status

### ✅ Verified Correct (matches backend implementation)
- `/api/locked/auth/verify` - Auth verification
- `/api/public/servers/status` - Public server status
- `/api/locked/csrf-token` - CSRF token fetch
- `/api/locked/servers/{id}/start` - Start server
- `/api/locked/servers/{id}/stop` - Stop server

### ⚠️ Needs Backend Verification (from documentation)
- `/api/public/passkey/available-admins` - Passkey login
- `/api/public/passkey/login/options` - Get auth challenge
- `/api/public/passkey/login/verify` - Verify passkey
- `/api/public/passkey/invite-registration-options` - Get registration options
- `/api/public/passkey/invite-registration-verify` - Verify registration
- `/api/locked/servers` - Get all servers
- `/api/locked/servers/{id}/logs` - Get server logs
- `/api/locked/servers/{id}/command` - Execute server command

### 🔧 May Need Implementation
If these endpoints return 404, backend routes need to be added:
1. Passkey authentication endpoints (if not already implemented)
2. Server logs endpoint (if not already implemented)
3. Server command endpoint (if not already implemented)

---

## Environment Variables

### Required in .env
```bash
VITE_API_BASE_URL=https://backend.bovisgl.xyz
VITE_WS_URL=wss://backend.bovisgl.xyz
```

### Defaults (if not set)
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://backend.bovisgl.xyz';
const WS_URL = import.meta.env.VITE_WS_URL || 'wss://backend.bovisgl.xyz';
```
