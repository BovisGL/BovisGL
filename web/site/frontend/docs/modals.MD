# Modals Documentation

## Overview
BovisGL uses multiple modal patterns for server management, admin functions, and detailed views. All modals use React portals, fixed positioning, and responsive behavior.

## Modal Architecture

### Common Pattern
1. **Backdrop**: Full-screen semi-transparent overlay (`position: fixed`)
2. **Modal Box**: Centered content container with rounded corners
3. **Portal Rendering**: Rendered via `ReactDOM.createPortal(modal, document.body)`
4. **Body Lock**: `body.modal-open` class prevents page scroll
5. **ESC Key Support**: Close on ESC key press
6. **Click Outside**: Close when clicking backdrop

---

## 1. ServerDetails Modal

### Purpose
Comprehensive server management interface with:
- Real-time console logs (3-second polling)
- Command execution with RCON
- Start/Stop server controls
- Player count display
- Crash analysis
- Plugin/Mod management (coming soon)

### Location
- **File**: `/frontend (old)/src/components/ServerDetails.tsx`
- **Lines**: 1-807
- **Trigger**: Click on ServerCard

### Portal Rendering
```javascript
{showDetails && ReactDOM.createPortal(
  <ServerDetails 
    server={serverData}
    onClose={() => setShowDetails(false)}
  />,
  document.body
)}
```

### Component Structure
```javascript
const ServerDetails = React.memo(({ server, onClose }: ServerDetailsProps) => {
  // State management
  const [logs, setLogs] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [serverState, setServerState] = useState<ServerRuntimeState>({ 
    currentStatus: server.status, 
    name: server.name 
  });
  const [activeTab, setActiveTab] = useState<'console' | 'plugins' | 'mods'>('console');
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  
  // ... implementation
});
```

---

### Modal Layout

#### Backdrop
```javascript
<div 
  className="server-details-backdrop"
  onClick={(e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }}
>
  {/* Modal content */}
</div>
```

**Styling**:
```css
.server-details-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: clamp(0.5rem, 2vw, 1.5rem);
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: auto;
}
```

#### Modal Content Box
```javascript
<div 
  className="server-details-modal-content" 
  style={{ borderTop: `4px solid ${server.color || '#007bff'}` }}
>
  {/* Header, tabs, body */}
</div>
```

**Styling**:
```css
.server-details-modal-content {
  background-color: #333;
  color: white;
  border-radius: clamp(8px, 2vw, 16px);
  width: min(100%, calc(100vw - 2 * clamp(0.5rem, 2vw, 1.5rem)));
  max-width: 1200px;
  height: calc(100vh - 2 * clamp(0.5rem, 2vw, 1.5rem));
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  overflow-y: auto;
  margin: auto;
  flex-shrink: 0;
  pointer-events: auto;
  contain: layout style paint;
  position: relative;
  box-sizing: border-box;
}
```

---

### Header Section

```javascript
<div className="modal-header">
  <h2 style={{
    margin: 0,
    color: server.color || '#007bff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }}>
    {server.name} Console
    <span style={{
      padding: '4px 8px',
      borderRadius: '4px',
      background: serverState.currentStatus === 'online' ? '#4CAF50' : '#ff9800',
      color: 'white'
    }}>
      {(serverState.currentStatus || 'UNKNOWN').toUpperCase()}
      {serverState.playerCount !== undefined && serverState.playerCount !== null && 
        ` (${serverState.playerCount} players)`}
    </span>
  </h2>
  
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    {/* Start/Stop buttons */}
    {pendingAction ? (
      <button disabled style={{ 
        background: '#666', 
        border: 'none', 
        color: '#ccc', 
        padding: '8px 16px', 
        borderRadius: '4px',
        cursor: 'not-allowed',
        fontSize: '14px',
        fontWeight: 'bold'
      }}>
        {pendingAction.type === 'starting' ? '⏳ Starting...' : '⏳ Stopping...'}
      </button>
    ) : serverState.currentStatus === 'offline' ? (
      <button 
        onClick={handleStartServer}
        disabled={isLoading}
        style={{ 
          background: isLoading ? '#666' : '#4CAF50', 
          border: 'none', 
          color: 'white', 
          padding: '8px 16px', 
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 'bold'
        }}
      >
        ▶ Start
      </button>
    ) : serverState.currentStatus === 'online' ? (
      <button 
        onClick={handleStopServer}
        disabled={isLoading}
        style={{ 
          background: isLoading ? '#666' : '#f44336', 
          border: 'none', 
          color: 'white', 
          padding: '8px 16px', 
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 'bold'
        }}
      >
        ⏹ Stop
      </button>
    ) : (
      <button disabled style={{ 
        background: '#666', 
        border: 'none', 
        color: '#ccc', 
        padding: '8px 16px', 
        borderRadius: '4px',
        cursor: 'not-allowed',
        fontSize: '14px',
        fontWeight: 'bold'
      }}>
        {serverState.currentStatus === 'starting' ? '⏳ Starting...' : 
         serverState.currentStatus === 'stopping' ? '⏳ Stopping...' : '⏳ Loading...'}
      </button>
    )}
    
    {/* Close button */}
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      aria-label="Close"
      className="close-button"
      style={{
        background: 'transparent',
        border: 'none',
        color: 'white',
        fontSize: '24px',
        cursor: 'pointer',
        padding: '5px 10px',
        borderRadius: '4px'
      }}
    >
      ✕
    </button>
  </div>
</div>
```

**Header Styling**:
```css
.modal-header {
  background-color: #444;
  padding: clamp(1rem, 2vw, 1.5rem);
  border-bottom: 1px solid #555;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: clamp(0.75rem, 2vw, 1.5rem);
  flex-shrink: 0;
  contain: layout;
}
```

---

### Issue Detection Panel

```javascript
{(server.potentialIssue || (detailedIssues && detailedIssues.length > 0)) && (
  <div style={{ 
    background: '#5d3131', 
    color: '#ffc107', 
    padding: '15px', 
    borderRadius: '8px', 
    marginBottom: '15px',
    border: '1px solid #ff6b6b'
  }}>
    <h4 style={{ 
      color: '#ff6b6b', 
      marginBottom: '10px', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px' 
    }}>
      🚨 Server Issues Detected
      <button 
        onClick={handleMarkAsFixed}
        style={{
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          padding: '4px 8px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          marginLeft: 'auto'
        }}
      >
        Mark as Fixed
      </button>
    </h4>
    
    {server.potentialIssue && (
      <div style={{ 
        marginBottom: '10px', 
        padding: '8px', 
        background: 'rgba(0,0,0,0.3)', 
        borderRadius: '4px' 
      }}>
        <strong>General Issue:</strong> {server.potentialIssue}
      </div>
    )}
    
    {detailedIssues && detailedIssues.length > 0 && (
      <div>
        <strong style={{ color: '#ffcc80' }}>Detailed Analysis:</strong>
        {detailedIssues.map((issue, index) => (
          <div key={index} style={{ 
            marginTop: '8px', 
            padding: '8px', 
            background: 'rgba(0,0,0,0.2)', 
            borderRadius: '4px',
            borderLeft: '3px solid #ff6b6b'
          }}>
            <div style={{ fontWeight: 'bold', color: '#ffcc80' }}>
              {issue.type === 'missingDependency' ? '📦 Missing Dependency' :
               issue.type === 'javaVersionMismatch' ? '☕ Java Version Issue' :
               issue.type === 'generalIncompatibility' ? '⚠️ Compatibility Issue' :
               issue.type === 'loadFailure' ? '💥 Load Failure' : '❌ General Error'}
            </div>
            <div style={{ marginTop: '4px', color: '#fff' }}>{issue.message}</div>
            {issue.problematicComponent && (
              <div style={{ marginTop: '4px', color: '#ccc', fontSize: '0.9em' }}>
                Component: {issue.problematicComponent}
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

**Issue Types**:
- `missingDependency`: Missing required plugin/mod
- `javaVersionMismatch`: Wrong Java version
- `generalIncompatibility`: Plugin/mod conflict
- `loadFailure`: Failed to load plugin/mod
- `genericError`: Unknown error

---

### Tab Navigation

```javascript
<div className="tabs" style={{ 
  display: 'flex', 
  borderBottom: '2px solid #444', 
  marginBottom: '15px', 
  flexShrink: 0 
}}>
  <button
    className={activeTab === 'console' ? 'tab-active' : 'tab-inactive'}
    style={{
      flex: 1, 
      padding: '12px 15px', 
      background: activeTab === 'console' ? '#383838' : 'transparent', 
      border: 'none', 
      color: activeTab === 'console' ? '#fff' : '#aaa', 
      cursor: 'pointer', 
      fontWeight: activeTab === 'console' ? 'bold' : 'normal',
      borderBottom: activeTab === 'console' ? `3px solid ${server.color || '#007bff'}` : 'none',
      marginRight: '5px',
      transition: 'background 0.2s, color 0.2s'
    }}
    onClick={() => setActiveTab('console')}
  >
    Console
  </button>
  
  <button
    className={activeTab === jarManagementLabel.toLowerCase() ? 'tab-active' : 'tab-inactive'}
    style={{
      flex: 1, 
      padding: '12px 15px', 
      background: activeTab === jarManagementLabel.toLowerCase() ? '#383838' : 'transparent', 
      border: 'none', 
      color: activeTab === jarManagementLabel.toLowerCase() ? '#fff' : '#aaa', 
      cursor: 'pointer', 
      fontWeight: activeTab === jarManagementLabel.toLowerCase() ? 'bold' : 'normal',
      borderBottom: activeTab === jarManagementLabel.toLowerCase() ? `3px solid ${server.color || '#007bff'}` : 'none',
      transition: 'background 0.2s, color 0.2s'
    }}
    onClick={() => setActiveTab(currentServerId === 'anarchy' ? 'mods' : 'plugins')}
  >
    {jarManagementLabel}
  </button>
</div>
```

**Tab Labels**:
- **Anarchy server**: "Mods" (Fabric server)
- **Other servers**: "Plugins" (Paper/Velocity servers)

---

### Console Tab

#### Command Input Section
```javascript
{currentServerId !== 'proxy' && currentServerId !== 'test-velocity' && (
  <div className="command-section" style={{ marginBottom: '15px', pointerEvents: 'auto' }}>
    <div className="command-instructions" style={{ 
      fontSize: '0.8em', 
      color: '#aaa', 
      marginBottom: '8px' 
    }}>
      <p style={{ margin: '2px 0' }}>• Press Enter to send command</p>
      <p style={{ margin: '2px 0' }}>• Press Shift+Enter for new line</p>
      <p style={{ margin: '2px 0' }}>• Use arrow keys to navigate through command history</p>
    </div>
    
    <form 
      onSubmit={(e) => { e.preventDefault(); handleCommandSubmit(); }} 
      style={{ display: 'flex', gap: '10px' }}
    >
      <textarea
        value={command}
        onChange={handleTextAreaChange}
        onKeyDown={handleKeyDown}
        placeholder="Enter command..."
        className="command-input"
        rows={2}
        style={{
          flexGrow: 1, 
          padding: '10px', 
          borderRadius: '4px', 
          border: '1px solid #555', 
          background: '#1e1e1e', 
          color: '#e0e0e0', 
          resize: 'none', 
          fontSize: '0.95em',
          pointerEvents: 'auto',
          userSelect: 'text',
          WebkitUserSelect: 'text',
          cursor: 'text',
          position: 'relative',
          zIndex: 10
        }}
      />
      
      <div className="command-buttons" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '5px' 
      }}>
        <button 
          type="button" 
          onClick={() => setCommand(prev => prev + '\n')} 
          className="button return-button" 
          style={{ 
            padding: '8px 12px', 
            background: '#555', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px'
          }}
        >
          Newline
        </button>
        <button 
          type="submit" 
          className="button send-button" 
          style={{ 
            padding: '8px 12px', 
            background: '#4CAF50', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px'
          }}
        >
          Send
        </button>
      </div>
    </form>
  </div>
)}
```

**Command History Navigation**:
```javascript
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleCommandSubmit();
  } else if (e.key === 'ArrowUp' && !e.shiftKey) {
    e.preventDefault();
    if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCommand(commandHistory[newIndex]);
    }
  } else if (e.key === 'ArrowDown' && !e.shiftKey) {
    e.preventDefault();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCommand(commandHistory[newIndex]);
    } else if (historyIndex === 0) {
      setHistoryIndex(-1);
      setCommand('');
    }
  }
};
```

#### Server Logs Section
```javascript
<div className="server-logs" style={{ 
  flexGrow: 1, 
  display: 'flex', 
  flexDirection: 'column', 
  overflow: 'hidden' 
}}>
  <div className="logs-header" style={{ 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: '10px' 
  }}>
    <h4 style={{ margin: 0, color: '#ddd' }}>Server Logs</h4>
    <button 
      onClick={copyLogs} 
      className="button copy-button" 
      style={{ 
        padding: '8px 12px', 
        background: '#f0ad4e', 
        color: 'black', 
        border: 'none', 
        borderRadius: '4px'
      }}
    >
      Copy All Logs
    </button>
  </div>
  
  <div className="logs-output" style={{
    whiteSpace: 'pre-wrap', 
    fontFamily: 'monospace', 
    flexGrow: 1, 
    overflowY: 'auto', 
    background: '#1a1a1a', 
    padding: '10px', 
    borderRadius: '4px', 
    color: '#c5c5c5', 
    fontSize: '0.85em', 
    border: '1px solid #444'
  }}>
    {logs || 'No live logs to display. Server might be offline, starting, or logs are empty.'}
  </div>
</div>
```

**Log Polling**:
```javascript
useEffect(() => {
  if (!currentServerId) return;

  const fetchLogs = async () => {
    try {
      const response = await api.get(`/api/locked/servers/${currentServerId}/logs`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.logs) {
          const logText = Array.isArray(data.logs) ? data.logs.join('\n') : data.logs;
          setLogs(logText);
        }
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };
  
  // Initial fetch
  fetchLogs();
  
  // Poll every 3 seconds
  const logInterval = setInterval(fetchLogs, 3000);
  
  return () => clearInterval(logInterval);
}, [currentServerId]);
```

---

### Plugins/Mods Tab (Coming Soon)

```javascript
<div style={{ 
  height: '100%', 
  display: 'flex', 
  flexDirection: 'column', 
  justifyContent: 'center', 
  alignItems: 'center', 
  textAlign: 'center', 
  padding: '40px' 
}}>
  <div style={{
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '20px',
    padding: '40px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)'
  }}>
    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>
      🚧
    </div>
    <h2 style={{
      color: '#fff',
      marginBottom: '15px',
      fontSize: '1.8rem',
      fontWeight: 'bold'
    }}>
      {jarManagementLabel} Management
    </h2>
    <p style={{
      color: 'rgba(255,255,255,0.9)',
      fontSize: '1.1rem',
      lineHeight: '1.6',
      marginBottom: '20px'
    }}>
      This feature is currently being rebuilt with enhanced functionality including:
    </p>
    <ul style={{
      color: 'rgba(255,255,255,0.8)',
      textAlign: 'left',
      fontSize: '1rem',
      lineHeight: '1.8',
      marginBottom: '25px',
      listStyle: 'none',
      paddingLeft: '0'
    }}>
      <li>🔍 Advanced {itemTypeLabel.toLowerCase()}/plugin compatibility checking</li>
      <li>📦 Automatic dependency resolution</li>
      <li>🔄 Modrinth integration for updates</li>
      <li>⚡ Bulk upload and management</li>
      <li>🛡️ Enhanced security validation</li>
    </ul>
    <div style={{
      background: 'rgba(255,255,255,0.1)',
      borderRadius: '10px',
      padding: '15px',
      marginTop: '20px'
    }}>
      <p style={{
        color: '#fff',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        margin: '0'
      }}>
        🎯 Coming Soon!
      </p>
      <p style={{
        color: 'rgba(255,255,255,0.8)',
        fontSize: '0.9rem',
        margin: '5px 0 0 0'
      }}>
        Stay tuned for the enhanced {itemTypeLabel.toLowerCase()} management system
      </p>
    </div>
  </div>
</div>
```

---

## 2. AdminLogsModal

### Purpose
Display real-time server logs via WebSocket

### Implementation (in App.tsx)
```javascript
const AdminLogsModal = ({ onClose }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Connect to WebSocket
    const ws = websocketService.connect();
    
    // Subscribe to server-logs channel
    ws.on('server-logs', (data: { logs: string[] }) => {
      setLogs(data.logs.slice(-500)); // Keep last 500 entries
    });
    
    websocketService.subscribe('server-logs');
    
    // Cleanup on unmount
    return () => {
      websocketService.unsubscribe('server-logs');
      websocketService.disconnect();
    };
  }, []);
  
  // Auto-scroll to bottom on new logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Admin Logs</h2>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ 
          maxHeight: '70vh', 
          overflowY: 'auto', 
          background: '#1a1a1a',
          padding: '15px',
          fontFamily: 'monospace',
          fontSize: '0.9em'
        }}>
          {logs.map((log, index) => (
            <div key={index} style={{ marginBottom: '5px', color: '#c5c5c5' }}>
              {log}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};
```

**Styling**:
- **Max Height**: 70vh (scrollable)
- **Background**: `#1a1a1a` (dark terminal-like)
- **Font**: Monospace, 0.9em
- **Auto-scroll**: Smooth scroll to bottom on new entries
- **Log Limit**: Last 500 entries

---

## 3. AddAdminModal

### Purpose
Create admin invite codes with customizable expiry

### Implementation (in App.tsx)
```javascript
const AddAdminModal = ({ onClose }) => {
  const [adminName, setAdminName] = useState('');
  const [inviteType, setInviteType] = useState<'existing' | 'new'>('new');
  const [expiresIn, setExpiresIn] = useState<number>(24 * 60 * 60 * 1000); // 24 hours default
  const [generatedInvite, setGeneratedInvite] = useState<{
    url: string;
    code: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchCsrf = async () => {
      const response = await api.get('/api/public/csrf-token');
      const data = await response.json();
      setCsrfToken(data.csrfToken);
    };
    fetchCsrf();
  }, []);
  
  const handleCreateInvite = async () => {
    if (!adminName.trim()) {
      setError('Please enter an admin name');
      return;
    }
    
    if (!csrfToken) {
      setError('CSRF token not available');
      return;
    }
    
    try {
      const response = await api.post('/api/locked/admin/invite', {
        name: adminName.trim(),
        type: inviteType,
        expiresIn
      }, {
        headers: { 'X-CSRF-Token': csrfToken }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGeneratedInvite({
          url: data.inviteUrl,
          code: data.inviteToken
        });
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create invite');
      }
    } catch (err) {
      setError('Network error creating invite');
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-box" 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          maxWidth: '600px', 
          borderTop: '4px solid #4CAF50' 
        }}
      >
        <div className="modal-header">
          <h2>Add Admin</h2>
          <button onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body" style={{ padding: '20px' }}>
          {!generatedInvite ? (
            <>
              {/* Input Form */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Admin Name
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Enter admin username"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #555',
                    background: '#1a1a1a',
                    color: 'white',
                    fontSize: '1rem'
                  }}
                />
              </div>
              
              {/* Invite Type Radio */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Invite Type
                </label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      value="new"
                      checked={inviteType === 'new'}
                      onChange={() => setInviteType('new')}
                    />
                    New Admin
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      value="existing"
                      checked={inviteType === 'existing'}
                      onChange={() => setInviteType('existing')}
                    />
                    Existing Admin (New Device)
                  </label>
                </div>
              </div>
              
              {/* Expiry Dropdown */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Invite Expires In
                </label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #555',
                    background: '#1a1a1a',
                    color: 'white',
                    fontSize: '1rem'
                  }}
                >
                  <option value={60 * 60 * 1000}>1 Hour</option>
                  <option value={24 * 60 * 60 * 1000}>24 Hours</option>
                  <option value={7 * 24 * 60 * 60 * 1000}>7 Days</option>
                  <option value={0}>Never</option>
                </select>
              </div>
              
              {error && (
                <div style={{
                  background: '#5d3131',
                  color: '#ffc107',
                  padding: '10px',
                  borderRadius: '4px',
                  marginBottom: '15px'
                }}>
                  {error}
                </div>
              )}
              
              <button
                onClick={handleCreateInvite}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'linear-gradient(180deg, #5bd37b, #37a34a)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Generate Invite
              </button>
            </>
          ) : (
            <>
              {/* Generated Invite Display */}
              <div style={{ 
                background: '#2a2a2a', 
                padding: '20px', 
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <h3 style={{ marginTop: 0, color: '#4CAF50' }}>
                  ✅ Invite Created!
                </h3>
                
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    Invite URL
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      value={generatedInvite.url}
                      readOnly
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '4px',
                        border: '1px solid #555',
                        background: '#1a1a1a',
                        color: 'white',
                        fontSize: '0.9rem'
                      }}
                    />
                    <button
                      onClick={() => copyToClipboard(generatedInvite.url)}
                      style={{
                        padding: '10px 20px',
                        background: '#f0ad4e',
                        color: 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    Invite Code
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      value={generatedInvite.code}
                      readOnly
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '4px',
                        border: '1px solid #555',
                        background: '#1a1a1a',
                        color: 'white',
                        fontSize: '0.9rem',
                        letterSpacing: '2px'
                      }}
                    />
                    <button
                      onClick={() => copyToClipboard(generatedInvite.code)}
                      style={{
                        padding: '10px 20px',
                        background: '#f0ad4e',
                        color: 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
              
              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#555',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
```

---

## 4. Logout Confirmation Modal

### Purpose
Confirm logout action before clearing auth data

### Implementation (in App.tsx)
```javascript
{showLogoutConfirm && (
  <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
    <div 
      className="modal-box" 
      onClick={(e) => e.stopPropagation()}
      style={{ maxWidth: '400px' }}
    >
      <div className="modal-header">
        <h2>Confirm Logout</h2>
      </div>
      
      <div className="modal-body" style={{ padding: '20px', textAlign: 'center' }}>
        <p style={{ marginBottom: '20px', fontSize: '1.1rem' }}>
          Are you sure you want to sign out?
        </p>
        
        <div style={{ display: 'flex', gap: '15px' }}>
          <button
            onClick={() => setShowLogoutConfirm(false)}
            style={{
              flex: 1,
              padding: '12px',
              background: '#555',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={handleLogout}
            style={{
              flex: 1,
              padding: '12px',
              background: 'linear-gradient(180deg, #ff7b7b, #ff4444)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

---

## Common Modal Styling

### CSS Classes (from App.css)

```css
/* Modal Overlay */
.server-details-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: clamp(0.5rem, 2vw, 1.5rem);
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: auto;
}

/* Modal Content Box */
.server-details-modal-content {
  background-color: #333;
  color: white;
  border-radius: clamp(8px, 2vw, 16px);
  width: min(100%, calc(100vw - 2 * clamp(0.5rem, 2vw, 1.5rem)));
  max-width: 1200px;
  height: calc(100vh - 2 * clamp(0.5rem, 2vw, 1.5rem));
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  overflow-y: auto;
  margin: auto;
  flex-shrink: 0;
  pointer-events: auto;
  contain: layout style paint;
  position: relative;
  box-sizing: border-box;
}

/* Modal Header */
.modal-header {
  background-color: #444;
  padding: clamp(1rem, 2vw, 1.5rem);
  border-bottom: 1px solid #555;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: clamp(0.75rem, 2vw, 1.5rem);
  flex-shrink: 0;
  contain: layout;
}

/* Modal Body */
.modal-body {
  padding: clamp(1rem, 2vw, 1.5rem);
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  -webkit-overflow-scrolling: touch;
  scrollbar-gutter: stable;
  contain: content;
}

/* Close Button */
.close-button {
  background: none;
  border: none;
  color: white;
  font-size: clamp(20px, 3vw, 32px);
  cursor: pointer;
  padding: clamp(0.4rem, 1vw, 0.8rem);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  flex-shrink: 0;
  min-width: clamp(30px, 5vw, 50px);
  min-height: clamp(30px, 5vw, 50px);
}

.close-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

/* Global Modal Lock */
body.modal-open {
  overflow: hidden;
}
```

---

## Responsive Behavior

### Breakpoints
- **Mobile**: < 640px (smaller padding, full-width modals)
- **Tablet**: 640px - 1023px (medium padding)
- **Desktop**: 1024px+ (max padding, max-width constraints)

### Mobile Optimizations
- **Touch Scrolling**: `-webkit-overflow-scrolling: touch`
- **Keyboard Handling**: Adjust viewport when virtual keyboard appears
- **Portrait Lock**: Force portrait orientation on phones (< 1024px)

---

## Accessibility

### Keyboard Support
- **ESC Key**: Close modal
- **Tab Navigation**: Cycle through interactive elements
- **Enter/Space**: Activate buttons

### ARIA Attributes
```javascript
<button
  aria-label="Close"
  role="button"
  onClick={onClose}
>
  ✕
</button>
```

### Focus Management
```javascript
useEffect(() => {
  const handleEscKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };
  
  document.addEventListener('keydown', handleEscKey);
  
  return () => document.removeEventListener('keydown', handleEscKey);
}, [onClose]);
```

---

## Performance Optimizations

### React.memo
```javascript
export default React.memo(ServerDetails, (prevProps, nextProps) => {
  return prevProps.server.id === nextProps.server.id;
});
```

### Portal Rendering
- Renders outside parent DOM tree
- Avoids z-index conflicts
- Improves performance by reducing re-renders

### CSS Containment
```css
.server-details-modal-content {
  contain: layout style paint;
}
```

**Benefits**:
- Prevents layout recalculations outside modal
- Improves scroll performance
- Reduces paint operations

---

## Future Enhancements

### Planned Features
1. **Modal Transitions**: Smooth fade-in/fade-out animations
2. **Stacking Support**: Multiple modals with proper z-index management
3. **Draggable Modals**: Click-and-drag to reposition
4. **Resizable Modals**: Drag corners to resize
5. **Modal History**: Navigate back through modal stack

### UX Improvements
1. **Loading Skeletons**: Show placeholder content while loading
2. **Success Animations**: Checkmark or confetti on successful actions
3. **Error Recovery**: Retry buttons on network errors
4. **Keyboard Shortcuts**: Ctrl+C to copy logs, etc.
