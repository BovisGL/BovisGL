# API Endpoints Reference

## Summary of All API Endpoints Used in BovisGL Frontend

### Public Endpoints (No Authentication Required)

#### Server Status
- `GET /api/public/servers/status` - Get status of all servers
- `GET /api/public/servers/online-players` - Get online players count

#### Authentication (Passkey/WebAuthn)
- `GET /api/public/passkey/available-admins` - List admins with registered passkeys
- `POST /api/public/passkey/login/options` - Get WebAuthn authentication options
- `POST /api/public/passkey/login/verify` - Verify WebAuthn authentication assertion
- `GET /api/public/passkey/invite-registration-options?inviteToken={token}` - Get registration options for invite
- `POST /api/public/passkey/invite-registration-verify` - Verify WebAuthn registration attestation

#### CSRF Protection
- `GET /api/public/csrf-token` - Get CSRF token for protected mutations

#### Legacy Auth (if still in use)
- `POST /api/public/auth/login` - Traditional login
- `POST /api/public/auth/logout` - Traditional logout

---

### Protected Endpoints (JWT Token Required)

#### Auth Verification
- `GET /api/locked/auth/verify` - Verify JWT token validity

#### Admin Management
- `GET /api/locked/admin/players` - Get all player data
- `GET /api/locked/admin/players/:uuid` - Get specific player data
- `GET /api/locked/admin/players/online` - Get currently online players
- `GET /api/locked/admin/logs` - Get admin action logs (WebSocket alternative available)
- `POST /api/locked/admin/create-invite` - Create admin invite token (CSRF required)

#### Server Management
- `GET /api/locked/servers` - Get all server information
- `GET /api/locked/servers/:id/logs` - Get server console logs
- `POST /api/locked/servers/:id/command` - Execute server command (CSRF required)
- `POST /api/locked/servers/:serverName/start` - Start server (CSRF required)
- `POST /api/locked/servers/:serverName/stop` - Stop server (CSRF required)

#### CSRF Token for Protected Routes
- `GET /api/locked/csrf-token` - Get CSRF token (requires JWT)

---

## Endpoint Categories by Source

### From Documentation (docs/auth_system.MD)
- All passkey endpoints documented correctly
- CSRF endpoints documented
- Some admin endpoints documented

### From Backend Implementation (communications/src/server.ts)
- `/api/locked/admin/players*` endpoints
- `/api/locked/servers/:serverName/stop` endpoint
- `/api/public/servers/status` endpoint

### From Old Frontend (frontend (old)/src/App.tsx)
- `/api/locked/auth/verify` - **ACTUAL ENDPOINT** (not `/api/locked/admin/verify`)
- `/api/locked/admin/logs`
- `/api/locked/admin/create-invite`
- `/api/public/csrf-token`
- `/api/public/auth/logout`

---

## Corrections Needed

### ❌ Incorrect Endpoints in New Frontend
1. `/api/locked/admin/verify` → Should be `/api/locked/auth/verify`
2. Registration validation endpoint needs verification

### ✅ Correct Endpoints Already Used
- `/api/public/servers/status` ✓
- `/api/public/passkey/available-admins` ✓
- `/api/public/passkey/login/options` ✓
- `/api/public/passkey/login/verify` ✓
- `/api/locked/servers/{id}/start` ✓
- `/api/locked/servers/{id}/stop` ✓
- `/api/locked/csrf-token` ✓

---

## WebSocket Events (wss://backend.bovisgl.xyz)

### Subscribe/Unsubscribe
- `{ action: 'subscribe', channel: 'server:${serverId}:logs' }`
- `{ action: 'unsubscribe', channel: 'server:${serverId}:logs' }`

### Events
- `serverLog` - Real-time server console logs
  ```json
  { "event": "serverLog", "serverId": "anarchy", "log": "[INFO] Player joined" }
  ```
