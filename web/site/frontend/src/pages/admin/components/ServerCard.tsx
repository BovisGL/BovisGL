/**
 * ServerCard Component
 * 
 * Individual server card matching old frontend layout:
 * - Top accent stripe in server color
 * - Clickable card opens ServerDetails modal via portal
 * - Start/Stop buttons for offline/online servers
 * - React.memo optimized
 * - 5s polling for server status
 * 
 * Server Colors:
 * - Civilization: #006400
 * - Anarchy: #8B0000
 * - Parkour: #800080
 * - Arena: #FFD700
 * - Hub: #00008B
 * - Proxy: #FFA500
 * 
 * Disabled Servers: arena, civilization
 */

import { memo, useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ServerDetails } from './ServerDetails';
import { api } from '../../../services/apiService';
import './ServerCard.css';

export interface ServerInfo {
  id: string;
  name: string;
  color: string;
  status: 'online' | 'offline' | 'starting' | 'stopping';
  playerCount?: number;
  maxPlayers?: number;
  version?: string;
  uptime?: number;
}

interface ServerCardProps {
  server: ServerInfo;
  csrfToken: string;
  isDisabled?: boolean;
  onRefresh: () => void;
}

const ServerCardComponent = ({ server, csrfToken, isDisabled = false, onRefresh }: ServerCardProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const [serverState, setServerState] = useState<Partial<ServerInfo>>({
    playerCount: server.playerCount,
  });
  const pollIntervalRef = useRef<number>();

  // 5-second polling for server status
  useEffect(() => {
    const pollServerStatus = async () => {
      try {
        const response = await api.get('/api/public/servers/status');
        if (response.ok) {
          const data = await response.json();
          // Backend returns object with server names as keys, get our server from it
          const serverData = data[server.id];
          if (serverData) {
            setServerState({
              playerCount: serverData.playerCount || 0,
            });
          }
        }
      } catch (err) {
        console.error('Failed to poll server status:', err);
      }
    };

    pollIntervalRef.current = window.setInterval(pollServerStatus, 5000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [server.id]);

  const getStatusBadgeText = () => {
    if (isDisabled) return 'Disabled';
    if (server.status === 'starting') return 'Starting...';
    if (server.status === 'stopping') return 'Stopping...';
    return server.status === 'online' ? 'Online' : 'Offline';
  };

  const handleStart = async () => {
    try {
      const response = await api.post(`/api/locked/servers/${server.id}/start`, {}, {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to start server:', err);
    }
  };

  const handleStop = async () => {
    try {
      const response = await api.post(`/api/locked/servers/${server.id}/stop`, {}, {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to stop server:', err);
    }
  };

  const cardContent = (
    <div className="panel-card" onClick={() => !isDisabled && setShowDetails(true)}>
      <div className="top-accent" style={{ background: server.color }} />
      <div>
        <div className="title">{server.name}</div>
        <div className="muted">Status: <span className="status">{getStatusBadgeText()}</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="muted">Players: {serverState.playerCount ?? 0}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isDisabled && server.status === 'offline' && (
            <button
              className="action-btn panel-start"
              onClick={(e) => {
                e.stopPropagation();
                handleStart();
              }}
            >
              Start
            </button>
          )}
          {!isDisabled && server.status === 'online' && (
            <button
              className="action-btn panel-stop"
              onClick={(e) => {
                e.stopPropagation();
                handleStop();
              }}
            >
              Stop
            </button>
          )}
          {isDisabled && (
            <div style={{ color: '#f0ad4e', fontWeight: 600, padding: '6px 8px', borderRadius: 6, background: 'rgba(255, 255, 255, 0.02)' }}>Disabled</div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {cardContent}
      {showDetails && !isDisabled && ReactDOM.createPortal(
        <ServerDetails
          server={server}
          csrfToken={csrfToken}
          onClose={() => setShowDetails(false)}
        />,
        document.body
      )}
    </>
  );
};

export const ServerCard = memo(ServerCardComponent);
