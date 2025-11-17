# Admin System Documentation - Summary

This directory contains comprehensive documentation for the BovisGL admin panel system. All documentation was generated from analysis of the legacy frontend codebase (`/frontend (old)/src/`).

## Documentation Files

### 1. [admin_panel.MD](./admin_panel.MD)
**Comprehensive Admin Panel Architecture**

Documents the main admin interface including:
- **Sidebar Component**: Resizable sidebar (340-640px), 8 navigation buttons with color-coded gradients, mobile responsive overlay
- **Server Management**: 6 servers (civilization, anarchy, parkour, arena, hub, proxy) with unique colors
- **Server Grid**: Responsive 1-3 column grid with ServerCard components
- **Modals**: AdminLogsModal (WebSocket live logs), AddAdminModal (invite creation), Logout confirmation
- **Protected Routes**: JWT verification wrapper with loading states
- **Test Servers Panel**: Separate panel for 3 test servers
- **Styling**: Complete CSS classes, gradients, responsive breakpoints

**Key Technologies**: React hooks, WebSocket, React Router, JWT auth, CSRF protection

---

### 2. [server_cards.MD](./server_cards.MD)
**ServerCard Component Deep Dive**

Documents the reusable server management card including:
- **Component Structure**: React.memo optimized functional component
- **Interfaces**: ServerInfoFromProps, ServerRuntimeState
- **State Management**: CSRF tokens, polling (5s intervals), pending actions
- **useServerActions Hook**: Shared state for start/stop actions, subscription-based updates
- **UI Elements**: Top accent stripe (colored), status badges, player count, action buttons
- **Disabled Servers**: Set-based check for arena/civilization
- **Portal-based Modal**: Click-to-open ServerDetails via ReactDOM.createPortal
- **Styling**: Gradient buttons, hover effects, responsive sizing with clamp()

**Key APIs**: `/api/public/servers/status` (5s polling), `/api/locked/servers/{id}/start|stop` (CSRF required)

---

### 3. [auth_system.MD](./auth_system.MD)
**Passkey Authentication System**

Documents the WebAuthn-based passwordless authentication including:
- **Technology Stack**: @simplewebauthn/browser v13.1.0, WebAuthn API, JWT tokens
- **Login Flow**: PasskeyAuth component with auto-detection of available admins
- **Registration Flows**: 
  - Direct passkey registration (URL param `?invite={token}`)
  - Invite-based registration (`/admin/register/:token`)
  - Legacy registration route (`/register/:token`)
- **WebAuthn Validation**: Preflight validation helper to catch base64url errors
- **JWT Management**: localStorage storage, auth headers, 15-minute refresh (planned)
- **CSRF Protection**: Token fetch, header usage, backend validation
- **Protected Routes**: Auth verification wrapper with loading states
- **Logout Flow**: CSRF-protected logout, clear all auth data

**Key APIs**: `/api/public/passkey/login/options|verify`, `/api/public/passkey/invite-registration-options|verify`

---

### 4. [modals.MD](./modals.MD)
**Modal Component Patterns**

Documents all modal implementations including:
- **ServerDetails Modal**: 
  - Real-time console logs (3s polling)
  - Command execution with RCON (arrow key history navigation)
  - Start/Stop controls with pending state management
  - Crash analysis with issue detection (5 issue types)
  - Tab navigation (Console, Plugins/Mods)
  - Coming Soon screen for plugin/mod management
- **AdminLogsModal**: WebSocket-powered live logs (last 500 entries, auto-scroll)
- **AddAdminModal**: Invite creation with expiry options (1h, 24h, 7d, never), copy-to-clipboard
- **Logout Confirmation**: Two-button confirm/cancel dialog
- **Common Patterns**: Portal rendering, backdrop click-to-close, ESC key support, body scroll lock

**Key Styling**: `rgba(0, 0, 0, 0.85)` backdrop, `#333` modal box, clamp() responsive sizing

---

## Color Palette

### Server Colors
- **Civilization**: `#006400` (Dark Green)
- **Anarchy**: `#8B0000` (Dark Red)
- **Parkour**: `#800080` (Purple)
- **Arena**: `#FFD700` (Gold)
- **Hub**: `#00008B` (Dark Blue)
- **Proxy**: `#FFA500` (Orange)

### UI Colors
- **Success Green**: `#4CAF50`
- **Error Red**: `#f44336`
- **Warning Orange**: `#ff9800`, `#f0ad4e`
- **Info Blue**: `#4f8cff`, `#3b6eea`
- **Accent Cyan**: `#00f5e0`, `#dffefa`
- **Background Dark**: `#1a1a1a`, `#2a2a2a`, `#333`
- **Gradient Backgrounds**: 
  - Admin Panel: `linear-gradient(180deg, #22313a 0%, #1f2a31 100%)`
  - Sidebar: `linear-gradient(180deg, #171f23 0%, #111417 100%)`

### Button Gradients
- **Blue**: `linear-gradient(180deg, #6aa8ff, #3b6eea)`
- **Green**: `linear-gradient(180deg, #5bd37b, #37a34a)`
- **Purple**: `linear-gradient(180deg, #b366ff, #8a2be2)`
- **Orange**: `linear-gradient(180deg, #ffb86b, #ff8a00)`
- **Red**: `linear-gradient(180deg, #ff7b7b, #ff4444)`

---

## Responsive Breakpoints

- **Mobile**: < 640px (1 column grid, overlay sidebar, full-width modals)
- **Tablet**: 640px - 1023px (2 column grid, overlay sidebar)
- **Desktop**: 1024px - 1535px (3 column grid, side-by-side layout, resizable sidebar)
- **Large Desktop**: >= 1536px (3 column grid, wider sidebar up to 640px)

### Mobile Optimizations
- `clamp()` for responsive sizing (fonts, padding, margins)
- 44px minimum touch target size
- `-webkit-overflow-scrolling: touch` for smooth scrolling
- Transform-based animations for sidebar overlay
- Portrait lock on phones (< 1024px)

---

## API Endpoints Summary

### Public Endpoints (No Auth)
- **GET** `/api/public/passkey/available-admins` - List admins with passkeys
- **POST** `/api/public/passkey/login/options` - Get authentication options
- **POST** `/api/public/passkey/login/verify` - Verify authentication
- **GET** `/api/public/passkey/invite-registration-options` - Get registration options
- **POST** `/api/public/passkey/invite-registration-verify` - Verify registration
- **GET** `/api/public/csrf-token` - Get CSRF token
- **GET** `/api/public/servers/status` - Server status (5s polling)

### Protected Endpoints (JWT Required)
- **GET** `/api/locked/admin/verify` - Verify JWT token
- **POST** `/api/locked/admin/logout` - Logout (CSRF required)
- **POST** `/api/locked/admin/invite` - Create invite (CSRF required)
- **POST** `/api/locked/servers/{id}/start` - Start server (CSRF required)
- **POST** `/api/locked/servers/{id}/stop` - Stop server (CSRF required)
- **GET** `/api/locked/servers/{id}/logs` - Server logs (3s polling in modal)
- **POST** `/api/locked/servers/{id}/command` - Send command (CSRF required)
- **POST** `/api/locked/servers/{id}/mark-fixed` - Clear error state (CSRF required)

### WebSocket Channels
- **Channel**: `'server-logs'`
- **Subscribe**: `websocketService.subscribe('server-logs')`
- **Event**: `ws.on('server-logs', (data) => { ... })`

---

## Component Hierarchy

```
App.tsx
├── ProtectedRoute (JWT verification wrapper)
│   └── AdminPanel
│       ├── AdminSidebar
│       │   ├── User Display
│       │   ├── Navigation Buttons (8)
│       │   └── Resize Handle (desktop only)
│       ├── Main Panel
│       │   ├── Admin Title
│       │   └── Server Grid
│       │       └── ServerCard (6 instances)
│       │           ├── Accent Stripe
│       │           ├── Title + Status Badge
│       │           ├── Player Count
│       │           ├── Action Buttons (Start/Stop)
│       │           └── ServerDetails Modal (portal)
│       │               ├── Header (title, status, controls, close button)
│       │               ├── Issue Detection Panel
│       │               ├── Tab Navigation (Console, Plugins/Mods)
│       │               └── Tab Content
│       │                   ├── Command Input (with history)
│       │                   └── Server Logs (3s polling)
│       └── Modals
│           ├── AdminLogsModal (WebSocket)
│           ├── AddAdminModal (invite creation)
│           └── LogoutConfirmModal
└── Routes
    ├── /login → PasskeyAuth
    ├── /admin/register/:token → PasskeyInviteRegister
    └── /register/:token → PasskeyRegistration
```

---

## State Management Patterns

### Component-level State (useState)
- Used for UI state, form inputs, modal visibility
- Example: `const [showDetails, setShowDetails] = useState(false);`

### Custom Hooks
- **useServerActions**: Shared start/stop logic with subscription pattern
- **useServerStatus**: Polling for server status (5s intervals)

### Context (planned, not yet implemented)
- **ServerStateContext**: Global server state sharing
- **AuthContext**: User authentication state

### Service Layer
- **serverActionService**: Manages pending actions across components
- **websocketService**: WebSocket connection pooling and subscriptions
- **apiService**: Fetch wrapper with auth headers and CSRF support

---

## Performance Optimizations

1. **React.memo**: ServerCard components memoized with custom comparison
2. **Lazy Loading**: ServerCard loaded with React.lazy and Suspense
3. **Debounced Polling**: 5-second intervals for status, 3-second for logs
4. **Portal Rendering**: Modals rendered outside parent DOM tree
5. **CSS Containment**: `contain: layout style paint` prevents reflows
6. **Shared State**: serverActionService avoids duplicate API calls
7. **Interval Cleanup**: All intervals cleared on unmount

---

## Security Features

### Authentication
- **Passkey (WebAuthn)**: Phishing-resistant, no passwords, biometric auth
- **JWT Tokens**: Signed tokens with 24-hour expiry (recommended)
- **Token Refresh**: 15-minute interval (placeholder, needs implementation)

### Authorization
- **Protected Routes**: JWT verification on admin routes
- **CSRF Protection**: All mutations require CSRF token
- **Origin Validation**: Backend checks request origin

### Data Security
- **Secure Storage**: JWT in localStorage + HttpOnly cookies (defense in depth)
- **Public Key Crypto**: Passkey private key never leaves device
- **Logout Cleanup**: Clears localStorage + cookies on sign out

---

## Known Issues & Solutions

### Issue 1: "atob" Error in Passkey Registration
**Symptom**: `Failed to execute 'atob' on 'Window'`

**Solution**: Preflight validation catches malformed base64url fields before SimpleWebAuthn library

### Issue 2: Modal Scroll Performance
**Symptom**: Laggy scrolling in modals with many logs

**Solution**: CSS containment (`contain: layout style paint`), fixed height, overflow-y: auto

### Issue 3: Sidebar Resize on Mobile
**Symptom**: Sidebar drag handle visible on touch devices

**Solution**: Media query hides resize handle on < 1024px, uses toggle button instead

---

## Future Enhancements

### High Priority
1. **Token Refresh Implementation**: Replace placeholder with actual API call
2. **Plugin/Mod Management**: Upload, enable/disable, compatibility checking
3. **Player Management**: Kick, ban, whitelist, permissions
4. **Backup System**: Scheduled backups, restore points

### Medium Priority
5. **Resource Monitoring**: CPU, RAM, disk usage charts
6. **Notification System**: Toast notifications for server events
7. **Multi-device Passkeys**: Sync passkeys across user's devices
8. **Session Management**: View/revoke active sessions

### Low Priority (UX)
9. **Dark/Light Theme Toggle**: User preference for color scheme
10. **Customizable Sidebar**: Reorder buttons, hide/show sections
11. **Dashboard Widgets**: Configurable widgets for quick stats
12. **Audit Logging**: Track all admin actions

---

## File Structure

```
frontend/docs/
├── README.MD                 (this file)
├── admin_panel.MD            (admin panel architecture)
├── server_cards.MD           (ServerCard component)
├── auth_system.MD            (passkey authentication)
└── modals.MD                 (modal patterns)

frontend (old)/src/
├── App.tsx                   (main app, routing, AdminPanel component)
├── App.css                   (all styling, 5836 lines)
├── components/
│   ├── ServerCard.tsx        (server management card, 600 lines)
│   ├── ServerDetails.tsx     (detailed server modal, 807 lines)
│   ├── PasskeyAuth.tsx       (login component, 400 lines)
│   ├── PasskeyRegistration.tsx (registration route, 400 lines)
│   └── PasskeyInviteRegister.tsx (invite-based registration, 400 lines)
├── hooks/
│   ├── useServerActions.ts   (shared server action hook, 60 lines)
│   └── useServerStatus.ts    (status polling hook)
├── services/
│   ├── apiService.ts         (fetch wrapper with auth)
│   ├── serverActionService.ts (shared action state)
│   └── websocketService.ts   (WebSocket wrapper)
└── styles/
    └── PasskeyAuth.css       (auth component styling, 300 lines)
```

---

## Development Workflow

### Testing Authentication
1. Navigate to `/login`
2. Click "Sign In with Passkey"
3. Select passkey from browser prompt (Face ID, Touch ID, Windows Hello, etc.)
4. Redirect to `/admin` on success

### Creating Admin Invites
1. In Admin Panel, click "➕ Add Admin" (green button)
2. Enter admin name, select type (new/existing), choose expiry
3. Click "Generate Invite"
4. Copy invite URL or code
5. Send to new admin
6. New admin navigates to URL and registers passkey

### Managing Servers
1. Click on server card to open ServerDetails modal
2. Use Start/Stop buttons in header
3. Send commands via textarea (Enter to send, Shift+Enter for newline)
4. Navigate command history with arrow keys
5. View live logs (auto-scrolls, copy all logs button)
6. Mark issues as fixed with "Mark as Fixed" button

---

## Browser Support

### Minimum Requirements
- **Chrome/Edge**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Opera**: 76+

### Feature Detection
```javascript
if (!window.PublicKeyCredential) {
  setError('WebAuthn is not supported in this browser');
}
```

---

## Contributing Guidelines

When modifying admin system components:

1. **Maintain Responsive Design**: Use `clamp()` for all sizing
2. **Preserve Color Scheme**: Follow existing color palette
3. **Keep CSRF Protection**: All mutations must include CSRF token
4. **Update Documentation**: Keep docs in sync with code changes
5. **Test on Mobile**: Verify responsive behavior on small screens
6. **Check Accessibility**: Ensure keyboard navigation and ARIA labels
7. **Optimize Performance**: Use React.memo, cleanup intervals, avoid re-renders

---

## Questions?

For questions about this documentation, refer to the source files:
- **Admin Panel**: `/frontend (old)/src/App.tsx` (lines 400-800)
- **Server Cards**: `/frontend (old)/src/components/ServerCard.tsx`
- **Auth System**: `/frontend (old)/src/components/PasskeyAuth.tsx`
- **Modals**: `/frontend (old)/src/components/ServerDetails.tsx`

All documentation generated from codebase analysis on 2025-01-XX.
