# Admin Panel Documentation

## Overview
The Admin Panel is a comprehensive server management interface built in React that provides real-time server control, monitoring, and administrative functions. It features a responsive sidebar, server card grid, and multiple modal dialogs for various administrative tasks.

## Architecture

### Location
- **Main Component**: `/frontend (old)/src/App.tsx` (lines ~400-800)
- **Component Type**: Functional component with hooks
- **Layout**: Sidebar + Main Panel (side-by-side on desktop, overlay on mobile)

### Key Features
1. **Real-time Server Management**: Start/stop/monitor 6 Minecraft servers
2. **Resizable Sidebar**: Draggable width control (340px - 640px on desktop)
3. **Mobile Responsive**: Full-screen overlay drawer with toggle button
4. **WebSocket Integration**: Live logs via websocketService
5. **Admin Functions**: User management, invite creation, logs viewing

---

## Server Definitions

The admin panel manages 6 servers with unique configurations:

```javascript
const servers = [
  { id: 'civilization', name: 'Civilization', color: '#006400' },  // Dark Green
  { id: 'anarchy', name: 'Anarchy', color: '#8B0000' },            // Dark Red
  { id: 'parkour', name: 'Parkour', color: '#800080' },            // Purple
  { id: 'arena', name: 'Arena', color: '#FFD700' },                // Gold
  { id: 'hub', name: 'Hub', color: '#00008B' },                    // Dark Blue
  { id: 'proxy', name: 'Proxy', color: '#FFA500' }                 // Orange
]
```

**Server State Management**:
- Each server tracked with: status (online/offline/starting/stopping), playerCount, lastSeen, uptime, crashReason
- Disabled servers: `arena`, `civilization` (Set-based check)
- Polling: 5-second interval via `/api/public/servers/status`

---

## Sidebar Component

### Desktop Layout
- **Position**: Fixed left side (static on desktop)
- **Width**: 340px (default), expandable to 640px via drag handle
- **Resize Handle**: 6px width on right edge, cursor: col-resize
- **Background**: `linear-gradient(180deg, #171f23 0%, #111417 100%)`
- **Border**: `2px solid rgba(0, 255, 200, 0.1)` on right
- **Shadow**: `2px 0 12px rgba(0, 0, 0, 0.4)`

### Mobile Layout (< 1024px)
- **Position**: Fixed full-screen overlay
- **Width**: 100vw (full viewport)
- **Transform**: `translateX(-100%)` when closed, `translateX(0)` when open
- **Transition**: `transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)`
- **Toggle Button**: Visible on mobile, hidden on desktop
- **Overlay**: Semi-transparent black backdrop (`rgba(0, 0, 0, 0.5)`)

### Sidebar Elements

#### User Display
```javascript
<div className="sidebar-user">
  Welcome, {displayName}
</div>
```
- **Styling**: White text, `rgba(255,255,255,0.03)` background, 8px border-radius
- **Purpose**: Shows logged-in admin's display name

#### Navigation Buttons (8 buttons)
```javascript
// Button configuration
[
  { label: '🏠 Home', color: 'blue', action: () => navigate('/') },
  { label: '👥 Manage Players', color: 'blue', action: () => navigate('/admin/players') },
  { label: '➕ Add Admin', color: 'green', action: () => setShowAddAdminModal(true) },
  { label: '🧪 Test Servers', color: 'purple', action: () => navigate('/admin/test') },
  { label: '📜 Admin Logs', color: 'orange', action: () => setShowLogsModal(true) },
  { label: '🔒 Sign Out', color: 'red', action: () => setShowLogoutConfirm(true) }
]
```

**Button Styling**:
- **Base Class**: `.sidebar-button`
- **Padding**: `clamp(0.6rem, 1.5vw, 0.75rem)` vertical, `clamp(0.75rem, 2vw, 1rem)` horizontal
- **Border-radius**: 8px
- **Font**: White, 700 weight, `clamp(0.8rem, 1.5vw, 1rem)`
- **Shadow**: `0 6px 14px rgba(0,0,0,0.35)`
- **Hover**: `translateY(-2px)`, enhanced shadow

**Color Gradients**:
- **Blue**: `linear-gradient(180deg, #6aa8ff, #3b6eea)`
- **Green**: `linear-gradient(180deg, #5bd37b, #37a34a)`
- **Purple**: `linear-gradient(180deg, #b366ff, #8a2be2)`
- **Orange**: `linear-gradient(180deg, #ffb86b, #ff8a00)`
- **Red**: `linear-gradient(180deg, #ff7b7b, #ff4444)`

#### Scrollbar Styling
- **Width**: 8px
- **Thumb**: `rgba(0, 255, 200, 0.2)`, 4px border-radius
- **Thumb Hover**: `rgba(0, 255, 200, 0.4)`
- **Track**: Transparent

---

## Main Panel Component

### Layout
- **Container**: `.main-panel`
- **Padding**: `clamp(1rem, 3vw, 2rem)`
- **Background**: `linear-gradient(180deg, #22313a 0%, #1f2a31 100%)`
- **Display**: Flex column, takes remaining space after sidebar

### Title
```javascript
<h1 className="admin-title">Admin Panel</h1>
```
- **Color**: `#dffefa` (cyan-tinted white)
- **Size**: `clamp(1.5rem, 4vw, 2.5rem)`
- **Alignment**: Center
- **Margin**: Top 0, bottom `clamp(0.5rem, 2vw, 1.5rem)`

### Server Card Grid
- **Class**: `.card-grid`
- **Grid**: 1 column (mobile) → 2 columns (tablet, 640px+) → 3 columns (desktop, 1024px+)
- **Gap**: `clamp(1rem, 2vw, 1.5rem)`
- **Content**: ServerCard components (lazy-loaded)

---

## Modals

### 1. Admin Logs Modal

**Purpose**: Real-time server logs via WebSocket

**Key Code** (lines ~90-170 in App.tsx):
```javascript
const AdminLogsModal = ({ onClose }) => {
  const [logs, setLogs] = useState([]);
  
  useEffect(() => {
    const ws = websocketService.connect();
    ws.on('server-logs', (data) => {
      setLogs(prev => [...data.logs.slice(-500)]);
    });
    
    websocketService.subscribe('server-logs');
    
    return () => {
      websocketService.unsubscribe('server-logs');
      websocketService.disconnect();
    };
  }, []);
  
  // ... render
}
```

**Features**:
- **WebSocket Channel**: `'server-logs'`
- **Log Limit**: Displays last 500 entries
- **Auto-scroll**: Scrolls to bottom on new logs
- **Styling**:
  - Background: `#333`, color: white
  - Border-radius: `clamp(8px, 2vw, 16px)`
  - Max-height: `calc(100vh - 2 * clamp(0.5rem, 2vw, 1.5rem))`
  - Padding: `clamp(1rem, 2vw, 1.5rem)`
- **Close Button**: X button (top-right), ESC key support

### 2. Add Admin Modal

**Purpose**: Create admin invite codes with expiry

**Key Features** (lines ~175-380 in App.tsx):
- **Input Field**: Admin name (text input)
- **Invite Type**: Radio buttons (existing admin / new admin)
- **Expiry Options**: 1 hour, 24 hours, 7 days, Never
- **Generated Output**:
  - Full invite URL: `https://bovisgl.xyz/admin/register/{inviteCode}`
  - Short invite code: 8-character alphanumeric
  - Copy-to-clipboard buttons for both

**Styling**:
- **Background**: `#333`
- **Width**: `min(100%, calc(100vw - 2 * clamp(0.5rem, 2vw, 1.5rem)))`
- **Max-width**: 600px
- **Border-top**: `4px solid #4CAF50` (green accent)
- **Input Fields**: `#1a1a1a` background, `#444` border, white text
- **Copy Buttons**: `#f0ad4e` (orange) background, black text

**API Flow**:
1. `POST /api/locked/admin/invite` with `{ name, expiresIn }`
2. Response: `{ success, inviteToken, inviteUrl }`
3. Display invite URL and code with copy buttons

### 3. Logout Confirmation Modal

**Purpose**: Confirm logout action, clear auth data

**Features**:
- **CSRF Protection**: Fetches CSRF token before logout
- **Confirmation Dialog**: "Are you sure you want to sign out?"
- **Actions**:
  - **Cancel**: Close modal, stay logged in
  - **Confirm**: Call logout API, clear localStorage, redirect to home

**Logout Flow**:
```javascript
const handleLogout = async () => {
  const csrfResponse = await api.get('/api/public/csrf-token');
  const { csrfToken } = await csrfResponse.json();
  
  await api.post('/api/locked/admin/logout', {}, {
    headers: { 'X-CSRF-Token': csrfToken }
  });
  
  localStorage.removeItem('auth_token');
  localStorage.removeItem('userInfo');
  document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  navigate('/');
};
```

**Styling**:
- **Backdrop**: `rgba(0, 0, 0, 0.85)`
- **Modal Box**: `#333` background, white text
- **Buttons**:
  - Cancel: `#555` gray
  - Confirm: `#ff4444` red

### 4. Token Refresher Component

**Purpose**: Periodic JWT token refresh

**Implementation** (placeholder):
```javascript
const TokenRefresher = () => {
  useEffect(() => {
    const interval = setInterval(async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // TODO: Implement token refresh API call
        console.log('Refreshing token...');
      }
    }, 15 * 60 * 1000); // 15 minutes
    
    return () => clearInterval(interval);
  }, []);
  
  return null;
};
```

---

## Protected Route

**Purpose**: Auth verification wrapper for admin routes

**Implementation**:
```javascript
const ProtectedRoute = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        navigate('/login');
        return;
      }
      
      try {
        const response = await api.get('/api/locked/admin/verify', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          navigate('/login');
        }
      } catch (error) {
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };
    
    verifyAuth();
  }, [navigate]);
  
  if (isLoading) return <LoadingScreen />;
  return isAuthenticated ? children : null;
};
```

**Features**:
- **Loading State**: Shows loading screen while verifying
- **Token Check**: Validates JWT token with `/api/locked/admin/verify`
- **Redirect**: Sends to `/login` if auth fails
- **Usage**: Wraps admin routes in React Router

---

## Test Servers Panel

**Purpose**: Separate panel for test server management

**Servers** (lines ~750-850 in App.tsx):
```javascript
const testServers = [
  { id: 'test-velocity', name: 'Test Velocity', color: '#00CED1' },
  { id: 'test-paper', name: 'Test Paper', color: '#FF6347' },
  { id: 'test-fabric', name: 'Test Fabric', color: '#9370DB' }
];
```

**Layout**:
- **Grid**: 3 columns (1 per server)
- **Card Style**: Same as main server cards
- **Location**: Separate route `/admin/test`

---

## State Management

### Server State
```typescript
interface ServerState {
  id: string;
  name: string;
  color: string;
  status: 'online' | 'offline' | 'starting' | 'stopping' | 'disabled';
  playerCount?: number;
  lastSeen?: string;
  uptime?: number;
  crashReason?: string | null;
}
```

### Sidebar State
```javascript
const [sidebarWidth, setSidebarWidth] = useState(340);
const [isResizing, setIsResizing] = useState(false);
const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile only
```

**Resize Logic**:
- **Min Width**: 340px
- **Max Width**: 640px (desktop), 100vw (mobile)
- **Handle**: 6px drag area on right edge
- **Events**: `mousedown`, `mousemove`, `mouseup` on document

### Modal State
```javascript
const [showLogsModal, setShowLogsModal] = useState(false);
const [showAddAdminModal, setShowAddAdminModal] = useState(false);
const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
```

---

## API Endpoints

### Admin Panel APIs
- **GET** `/api/locked/admin/verify` - Verify JWT token
- **POST** `/api/locked/admin/logout` - Logout (CSRF protected)
- **POST** `/api/locked/admin/invite` - Create invite code
- **GET** `/api/public/servers/status` - Server status (5s polling)
- **POST** `/api/locked/servers/{id}/start` - Start server (CSRF)
- **POST** `/api/locked/servers/{id}/stop` - Stop server (CSRF)
- **GET** `/api/public/csrf-token` - Get CSRF token

### WebSocket Channels
- **Channel**: `'server-logs'`
- **Event**: `ws.on('server-logs', (data) => { ... })`
- **Subscribe**: `websocketService.subscribe('server-logs')`
- **Unsubscribe**: `websocketService.unsubscribe('server-logs')`

---

## Styling Classes

### Key CSS Classes (from App.css)

**Layout**:
- `.admin-layout` - Main admin container (flex, gradient background)
- `.admin-sidebar` - Sidebar (fixed left, 340px default)
- `.main-panel` - Main content area (flex: 1)

**Sidebar**:
- `.sidebar-user` - User display box
- `.sidebar-button` - Navigation buttons
- `.sidebar-button.{color}` - Color variants (blue, green, purple, orange, red)

**Grid**:
- `.card-grid` - Server card grid (responsive columns)
- `.panel-card` - Individual server card

**Modals**:
- `.server-details-backdrop` - Modal overlay (fixed, full viewport)
- `.server-details-modal-content` - Modal box (centered, rounded)
- `.modal-header` - Modal top bar (colored border)
- `.close-button` - X button (top-right)

**Buttons**:
- `.panel-start` - Green gradient start button
- `.panel-stop` - Red gradient stop button
- `.shiny-start` - Enhanced start button with glow effect
- `.shiny-stop` - Enhanced stop button with glow effect

---

## Responsive Behavior

### Breakpoints
- **Mobile**: < 640px (1 column grid, full-width sidebar overlay)
- **Tablet**: 640px - 1023px (2 column grid, overlay sidebar)
- **Desktop**: 1024px - 1535px (3 column grid, side-by-side layout)
- **Large Desktop**: >= 1536px (3 column grid, wider sidebar up to 640px)

### Mobile Optimizations
- **Sidebar**: Full-screen overlay with toggle button
- **Grid**: Single column for server cards
- **Touch**: 44px minimum touch target size
- **Gestures**: Touch-friendly scroll, swipe-to-close sidebar
- **Fonts**: `clamp()` for responsive text sizing

### Desktop Enhancements
- **Sidebar Resize**: Draggable handle on right edge
- **Hover Effects**: Button lift (`translateY(-2px)`), enhanced shadows
- **Scrollbars**: Styled with custom cyan accents

---

## Dependencies

### React Hooks
- `useState` - Component state management
- `useEffect` - Side effects (polling, WebSocket, listeners)
- `useNavigate` - React Router navigation
- `React.memo` - ServerCard optimization

### External Libraries
- `react-router-dom` - Routing (v7.5.3)
- `@simplewebauthn/browser` - Passkey auth (v13.1.0)
- `websocketService` - Custom WebSocket wrapper

### Internal Services
- `apiService` - Fetch wrapper with auth headers
- `useServerActions` - Custom hook for server start/stop
- `ServerStateContext` - React context for server state sharing

---

## Performance Considerations

### Optimization Techniques
1. **React.memo**: ServerCard components memoized to prevent unnecessary re-renders
2. **Lazy Loading**: ServerCard loaded with `React.lazy` and `Suspense`
3. **Debounced Polling**: 5-second intervals for status checks (not on every render)
4. **Shared State**: ServerStateContext avoids prop drilling
5. **CSS Containment**: `contain: layout style paint` on modal to prevent reflows

### WebSocket Management
- **Connection Pooling**: Single WebSocket connection for all logs
- **Subscription Cleanup**: Unsubscribe on component unmount
- **Error Handling**: Reconnection logic in websocketService

---

## Security Features

### CSRF Protection
- **Token Required**: All POST/PUT/DELETE requests include `X-CSRF-Token` header
- **Token Fetch**: Separate API call before mutation actions
- **Token Validation**: Backend validates token on mutation routes

### JWT Authentication
- **Token Storage**: `localStorage.getItem('auth_token')`
- **Header Injection**: `Authorization: Bearer {token}` on locked routes
- **Token Refresh**: 15-minute interval (placeholder, needs implementation)
- **Logout Cleanup**: Clears localStorage + cookies on sign out

### Protected Routes
- **Verification**: JWT validated on admin route access
- **Loading State**: Shows loading screen during auth check
- **Redirect**: Sends to `/login` if auth fails
- **Guard**: ProtectedRoute wrapper prevents unauthorized access

---

## Error Handling

### Error Display
- **Error State**: Component-level error state with 10-second auto-clear
- **Error Styling**: Red/orange error boxes with icons
- **Error Types**: Network errors, auth errors, API errors, WebSocket errors

### Crash Detection
- **Issue Tracking**: Server crashes logged with `potentialIssue` and `detailedIssues`
- **Issue Display**: Modal shows crash analysis with type-specific icons
- **Mark as Fixed**: Button to clear error state

---

## Future Enhancements

### Planned Features (Coming Soon)
1. **Plugin/Mod Management**: Upload, enable/disable, compatibility checking
2. **Player Management**: Kick, ban, whitelist, permissions
3. **Backup System**: Scheduled backups, restore points
4. **Resource Monitoring**: CPU, RAM, disk usage charts
5. **Notification System**: Toast notifications for server events

### UI Improvements
1. **Dark/Light Theme Toggle**: User preference for color scheme
2. **Customizable Sidebar**: Reorder buttons, hide/show sections
3. **Dashboard Widgets**: Configurable widgets for quick stats
4. **Multi-language Support**: i18n for internationalization
