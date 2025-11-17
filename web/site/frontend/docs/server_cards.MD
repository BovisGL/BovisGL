# Server Cards Documentation

## Overview
The ServerCard component is a highly optimized, reusable React component for displaying and managing individual Minecraft server instances. It features real-time status polling, start/stop actions, player count display, and portal-based detail modals.

## Component Architecture

### Location
- **File**: `/frontend (old)/src/components/ServerCard.tsx`
- **Lines**: 1-600
- **Type**: Functional component with React.memo optimization

### Optimization
```javascript
export default React.memo(ServerCard, (prevProps, nextProps) => {
  return prevProps.server.id === nextProps.server.id &&
         prevProps.server.status === nextProps.server.status;
});
```

**Purpose**: Prevents unnecessary re-renders when props haven't changed

---

## Interfaces

### ServerInfoFromProps
```typescript
interface ServerInfoFromProps {
  id: string;                 // Unique server identifier (e.g., 'anarchy')
  name: string;               // Display name (e.g., 'Anarchy')
  color: string;              // Hex color for accent stripe (e.g., '#8B0000')
  status: 'online' | 'offline' | 'starting' | 'stopping' | 'disabled';
}
```

### ServerRuntimeState
```typescript
interface ServerRuntimeState {
  currentStatus: 'online' | 'offline' | 'starting' | 'stopping' | 'disabled';
  playerCount?: number | null;        // Current online players
  maxPlayers?: number | null;         // Server capacity
  lastSeen?: string | null;           // ISO timestamp of last status update
  version?: string | null;            // Minecraft version (e.g., '1.20.1')
  uptime?: number | null;             // Uptime in seconds
  crashReason?: string | null;        // Last crash error message
  name?: string;                      // Server name (for display)
}
```

---

## Component Props

```typescript
interface ServerCardProps {
  server: ServerInfoFromProps;
  onClose?: () => void;  // Optional callback for modal close
}
```

**Usage Example**:
```javascript
<ServerCard 
  server={{ 
    id: 'anarchy', 
    name: 'Anarchy', 
    color: '#8B0000', 
    status: 'online' 
  }} 
/>
```

---

## State Management

### Internal State
```javascript
const [csrfToken, setCsrfToken] = useState<string | null>(null);
const [serverState, setServerState] = useState<ServerRuntimeState>({
  currentStatus: server.status,
  playerCount: null,
  name: server.name
});
const [showDetails, setShowDetails] = useState(false);
```

### Custom Hook (useServerActions)
```javascript
const { 
  pendingAction,      // { type: 'starting' | 'stopping', startedAt: number } | null
  isLoading,          // Boolean: true during API calls
  error,              // String: error message or empty string
  setError,           // Function: manual error setter
  startServer,        // Function: async start action
  stopServer,         // Function: async stop action
  isActionable        // Boolean: can perform actions (not pending, correct status)
} = useServerActions(server.id, serverState.currentStatus);
```

---

## Lifecycle & Effects

### 1. CSRF Token Fetch (On Mount)
```javascript
useEffect(() => {
  const fetchCsrfToken = async () => {
    try {
      const response = await api.get('/api/public/csrf-token');
      if (response.ok) {
        const data = await response.json();
        setCsrfToken(data.csrfToken);
      }
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
    }
  };
  
  fetchCsrfToken();
}, []);
```

**Purpose**: Fetch CSRF token once for mutation actions

### 2. Status Polling (Every 5 Seconds)
```javascript
useEffect(() => {
  const fetchServerStatus = async () => {
    try {
      const response = await api.get('/api/public/servers/status');
      if (response.ok) {
        const data: Record<string, ServerRuntimeState> = await response.json();
        if (data && data[server.id]) {
          setServerState(data[server.id]);
        } else {
          // Server not in response, assume offline
          setServerState(prev => ({ 
            ...prev, 
            currentStatus: 'offline', 
            playerCount: null 
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching server status:', error);
    }
  };
  
  // Initial fetch
  fetchServerStatus();
  
  // Poll every 5 seconds
  const interval = setInterval(fetchServerStatus, 5000);
  
  return () => clearInterval(interval);
}, [server.id]);
```

**Purpose**: Keep server status and player count up-to-date

---

## Disabled Servers

### Configuration
```javascript
const DISABLED_SERVERS = new Set(['arena', 'civilization']);

const isDisabled = DISABLED_SERVERS.has(server.id);
```

**Effect**: Disabled servers show a "Disabled" badge and cannot be started/stopped

---

## Render Structure

### 1. Top Accent Stripe
```javascript
<div 
  className="server-banner" 
  style={{ backgroundColor: server.color }}
/>
```

**Styling**:
- **Height**: `clamp(6px, 1vw, 10px)`
- **Color**: Dynamic based on `server.color`
- **Purpose**: Visual server identification

### 2. Title + Status Badge
```javascript
<div className="server-stats">
  <h3 className="server-name">{server.name}</h3>
  <div 
    className={`server-status status-${serverState.currentStatus}`}
    style={{
      background: serverState.currentStatus === 'online' ? '#4CAF50' : '#ff9800',
      color: 'white'
    }}
  >
    {serverState.currentStatus.toUpperCase()}
    {serverState.playerCount !== undefined && serverState.playerCount !== null && 
      ` (${serverState.playerCount} players)`}
  </div>
</div>
```

**Status Badge Colors**:
- **Online**: `#4CAF50` (green)
- **Offline**: `#ff9800` (orange)
- **Starting**: `#FF9800` (orange, pulsing animation)
- **Stopping**: `#FF5722` (red-orange, pulsing)
- **Disabled**: `#666` (gray)

### 3. Player Count Display
```javascript
{serverState.playerCount !== undefined && serverState.playerCount !== null && (
  <div className="player-count">
    👥 {serverState.playerCount}/{serverState.maxPlayers || '?'} Players
  </div>
)}
```

**Styling**:
- **Background**: `#333`
- **Color**: White
- **Padding**: `clamp(0.4rem, 1vw, 0.6rem)` vertical, `clamp(0.5rem, 1vw, 0.8rem)` horizontal
- **Border-radius**: 4px
- **Font-size**: `clamp(0.8rem, 1.5vw, 1rem)`

### 4. Action Buttons (Conditional)
```javascript
{!isDisabled && (
  <div className="server-buttons">
    {pendingAction ? (
      <button disabled className="panel-pending">
        {pendingAction.type === 'starting' ? '⏳ Starting...' : '⏳ Stopping...'}
      </button>
    ) : serverState.currentStatus === 'offline' ? (
      <button 
        onClick={handleStartServer} 
        disabled={isLoading}
        className="panel-start"
      >
        ▶ Start
      </button>
    ) : serverState.currentStatus === 'online' ? (
      <button 
        onClick={handleStopServer} 
        disabled={isLoading}
        className="panel-stop"
      >
        ⏹ Stop
      </button>
    ) : (
      <button disabled className="panel-pending">
        {serverState.currentStatus === 'starting' ? '⏳ Starting...' : '⏳ Stopping...'}
      </button>
    )}
  </div>
)}
```

**Button States**:
- **Start Button**: Shown when status is `'offline'`
- **Stop Button**: Shown when status is `'online'`
- **Pending Button**: Shown when status is `'starting'` or `'stopping'`, or when `pendingAction` is active
- **Disabled State**: Gray, cursor: not-allowed, no hover effects

**Button Styling**:
- **Start**: `linear-gradient(180deg, #6be26b, #29a329)`, color: `#002200`
- **Stop**: `linear-gradient(180deg, #ff7b7b, #d32f2f)`, color: `#330000`
- **Pending**: `background: grey`, color: white, cursor: not-allowed

### 5. Disabled Badge
```javascript
{isDisabled && (
  <div className="server-buttons">
    <button disabled className="panel-pending">
      🚫 Disabled
    </button>
  </div>
)}
```

---

## Click-to-Open Details

### Card Click Handler
```javascript
const handleCardClick = (e: React.MouseEvent) => {
  // Prevent opening modal if clicking on action buttons
  if ((e.target as HTMLElement).closest('button')) {
    return;
  }
  
  setShowDetails(true);
};

// Usage on card element
<div className="server-card" onClick={handleCardClick}>
  {/* ... card content ... */}
</div>
```

### Portal-based Modal
```javascript
{showDetails && ReactDOM.createPortal(
  <ServerDetails 
    server={{
      id: server.id,
      name: server.name,
      color: server.color,
      status: serverState.currentStatus,
      logs: '...',
      playerCount: serverState.playerCount,
      potentialIssue: serverState.crashReason,
      detailedIssues: null  // Would be populated from API if available
    }}
    onClose={() => setShowDetails(false)}
  />,
  document.body
)}
```

**Why Portals?**
- Renders modal outside parent DOM hierarchy
- Avoids z-index stacking issues
- Allows full-screen overlay without CSS constraints

---

## Action Handlers

### Start Server
```javascript
const handleStartServer = async () => {
  if (!csrfToken) {
    console.error('CSRF token not available');
    return;
  }
  
  await startServer(csrfToken);  // From useServerActions hook
};
```

**API Call** (inside useServerActions):
```javascript
const response = await api.post(`/api/locked/servers/${serverId}/start`, {}, {
  headers: { 'X-CSRF-Token': csrfToken }
});
```

### Stop Server
```javascript
const handleStopServer = async () => {
  if (!csrfToken) {
    console.error('CSRF token not available');
    return;
  }
  
  await stopServer(csrfToken);  // From useServerActions hook
};
```

**API Call** (inside useServerActions):
```javascript
const response = await api.post(`/api/locked/servers/${serverId}/stop`, {}, {
  headers: { 'X-CSRF-Token': csrfToken }
});
```

---

## useServerActions Hook

### Location
- **File**: `/frontend (old)/src/hooks/useServerActions.ts`
- **Lines**: 1-60

### Implementation
```typescript
import { useState, useEffect } from 'react';
import { serverActionService, PendingAction } from '../services/serverActionService';

export const useServerActions = (serverId: string, currentStatus: string) => {
  const [pendingAction, setPendingActionState] = useState<PendingAction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Subscribe to shared pending actions
  useEffect(() => {
    const unsubscribe = serverActionService.subscribe(serverId, (action) => {
      setPendingActionState(action);
    });

    return unsubscribe;
  }, [serverId]);

  // Check if status changed and clear pending action
  useEffect(() => {
    serverActionService.checkAndClearPendingAction(serverId, currentStatus);
  }, [serverId, currentStatus]);

  const startServer = async (csrfToken: string) => {
    if (!csrfToken) {
      setError('CSRF token not available. Please refresh.');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await serverActionService.startServer(serverId, currentStatus, csrfToken);
    
    if (!result.success) {
      setError(result.error || 'Failed to start server');
    }

    setIsLoading(false);
  };

  const stopServer = async (csrfToken: string) => {
    if (!csrfToken) {
      setError('CSRF token not available. Please refresh.');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await serverActionService.stopServer(serverId, currentStatus, csrfToken);
    
    if (!result.success) {
      setError(result.error || 'Failed to stop server');
    }

    setIsLoading(false);
  };

  const isActionable = !pendingAction && 
    (currentStatus === 'online' || currentStatus === 'offline');

  return {
    pendingAction,
    isLoading,
    error,
    setError,
    startServer,
    stopServer,
    isActionable
  };
};
```

### PendingAction Type
```typescript
interface PendingAction {
  type: 'starting' | 'stopping';
  startedAt: number;  // Timestamp
}
```

### serverActionService
**Purpose**: Shared state management for server actions across multiple ServerCard instances

**Features**:
- **Subscription System**: Cards subscribe to action updates for their server
- **Pending State Tracking**: Tracks which servers have pending actions
- **Auto-clearing**: Clears pending state when status changes
- **Debouncing**: Prevents duplicate actions within short time window

---

## Styling

### CSS Classes (from App.css)

#### Card Container
```css
.server-card {
  background-color: #2a2a2a;
  border-radius: clamp(8px, 2vw, 16px);
  overflow: hidden;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  min-height: clamp(200px, 50vw, 280px);
  display: flex;
  flex-direction: column;
  width: 100%;
}

.server-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.25);
}
```

#### Accent Stripe
```css
.server-banner {
  height: clamp(6px, 1vw, 10px);
  flex-shrink: 0;
}
```

#### Card Content
```css
.server-content {
  padding: clamp(1rem, 3vw, 1.5rem);
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
```

#### Title
```css
.server-title {
  margin: 0 0 clamp(0.75rem, 2vw, 1.25rem) 0;
  font-size: clamp(1.125rem, 3vw, 1.5rem);
  line-height: 1.2;
  font-weight: 600;
  word-break: break-word;
}
```

#### Status Indicator (Dot)
```css
.status-indicator {
  display: inline-block;
  width: clamp(10px, 1vw, 14px);
  height: clamp(10px, 1vw, 14px);
  border-radius: 50%;
  margin-right: clamp(0.5rem, 1vw, 0.75rem);
  border: none !important;
  padding: 0 !important;
}

.status-indicator.status-online {
  background-color: #44ff44 !important;
}

.status-indicator.status-offline {
  background-color: #ff4444 !important;
}

.status-indicator.status-starting {
  background-color: #FF9800 !important;
  animation: pulse 1.5s infinite;
}

.status-indicator.status-stopping {
  background-color: #FF5722 !important;
  animation: pulse 1.5s infinite;
}
```

#### Button Container
```css
.server-buttons {
  display: flex;
  gap: clamp(0.5rem, 1vw, 0.75rem);
  margin-top: clamp(0.5rem, 1vw, 1rem);
  flex-wrap: wrap;
}
```

#### Action Buttons
```css
.panel-start {
  background: linear-gradient(180deg, #6be26b, #29a329);
  color: #002200;
  border: none;
  padding: clamp(0.5rem, 1vw, 0.75rem) clamp(1rem, 1.5vw, 1.5rem);
  border-radius: 6px;
  font-weight: 700;
  font-size: clamp(0.8rem, 1.5vw, 1rem);
}

.panel-start:disabled { 
  opacity: 0.6;
  cursor: not-allowed;
}

.panel-stop {
  background: linear-gradient(180deg, #ff7b7b, #d32f2f);
  color: #330000;
  border: none;
  padding: clamp(0.5rem, 1vw, 0.75rem) clamp(1rem, 1.5vw, 1.5rem);
  border-radius: 6px;
  font-weight: 700;
  font-size: clamp(0.8rem, 1.5vw, 1rem);
}

.panel-stop:disabled { 
  opacity: 0.6;
  cursor: not-allowed;
}
```

---

## Responsive Behavior

### Breakpoints
- **Mobile**: < 640px (full width, larger text)
- **Tablet**: 640px - 1023px (2 columns in grid)
- **Desktop**: 1024px+ (3 columns in grid)

### Touch Optimizations
- **Tap Target**: 44px minimum for buttons
- **No Hover on Touch**: Hover effects disabled on touch devices
- **Ripple Effect**: Consider adding Material Design ripple on touch

---

## Performance Considerations

### Optimization Techniques
1. **React.memo**: Prevents re-renders when props unchanged
2. **Custom Comparison**: Only re-renders if `id` or `status` changes
3. **Polling Cleanup**: Interval cleared on unmount
4. **Debounced Actions**: serverActionService prevents duplicate actions
5. **Portal Rendering**: Modal rendered outside card DOM tree

### Memory Management
- **Effect Cleanup**: All intervals and subscriptions cleaned up
- **Event Listener Removal**: Click handlers removed on unmount
- **State Reset**: Local state reset when server ID changes

---

## Error Handling

### Error States
```javascript
const [error, setError] = useState('');

// Auto-clear error after 10 seconds
useEffect(() => {
  if (error) {
    const timer = setTimeout(() => setError(''), 10000);
    return () => clearTimeout(timer);
  }
}, [error]);
```

### Error Display
```javascript
{error && (
  <div className="error-message">
    {error}
  </div>
)}
```

**Styling**:
- **Background**: `#5d3131` (dark red)
- **Color**: `#ffc107` (amber warning)
- **Padding**: `clamp(0.75rem, 1.5vw, 1rem)`
- **Border-radius**: 4px

---

## API Integration

### Endpoints Used
- **GET** `/api/public/csrf-token` - Fetch CSRF token (once on mount)
- **GET** `/api/public/servers/status` - Poll server status (every 5s)
- **POST** `/api/locked/servers/{id}/start` - Start server (CSRF required)
- **POST** `/api/locked/servers/{id}/stop` - Stop server (CSRF required)

### Request Headers
```javascript
// CSRF-protected requests
headers: {
  'X-CSRF-Token': csrfToken,
  'Content-Type': 'application/json'
}

// Auth-protected requests (handled by apiService)
headers: {
  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
}
```

---

## Usage Examples

### Basic Usage
```javascript
import ServerCard from './components/ServerCard';

function AdminPanel() {
  const servers = [
    { id: 'anarchy', name: 'Anarchy', color: '#8B0000', status: 'online' },
    { id: 'hub', name: 'Hub', color: '#00008B', status: 'offline' }
  ];
  
  return (
    <div className="card-grid">
      {servers.map(server => (
        <ServerCard key={server.id} server={server} />
      ))}
    </div>
  );
}
```

### With Custom Close Handler
```javascript
<ServerCard 
  server={serverData}
  onClose={() => {
    console.log('Modal closed');
    // Refresh server list or perform cleanup
  }}
/>
```

---

## Future Enhancements

### Planned Features
1. **Plugin/Mod Count**: Display number of plugins/mods installed
2. **Performance Metrics**: CPU/RAM usage bars
3. **Quick Actions Menu**: Right-click context menu with restart, backup, etc.
4. **Player List Preview**: Hover to see online players
5. **Server Icon**: Upload custom server icon/favicon

### UI Improvements
1. **Skeleton Loading**: Show placeholder while loading status
2. **Animations**: Smooth transitions for status changes
3. **Drag & Drop**: Reorder server cards in admin panel
4. **Bulk Actions**: Select multiple servers for batch operations
