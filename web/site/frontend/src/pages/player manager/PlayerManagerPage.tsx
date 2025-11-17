/**
 * PlayerManagerPage Component
 * 
 * Real-time player management interface with:
 * - Responsive sidebar with player list and search
 * - Main panel with player details and ban/unban controls
 * - WebSocket integration for live updates
 * - Mobile drawer overlay on small screens
 * - Resizable sidebar on desktop
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerSidebar, PlayerInfo } from './components';
import { api } from '../../services/apiService';
import { websocketService } from '../../services/websocketService';
import './PlayerManagerPage.css';

interface BanInfo {
  uuid: string;
  name: string;
  reason?: string;
  banned_by?: string;
  banned_at?: number;
}

interface PlayerUpdate {
  uuid: string;
  name: string;
  online: boolean;
  currentServer?: string | null;
  currentClient?: string | null;
  clients?: string[];
  lastJoinTs?: number | null;
  lastJoinClient?: string | null;
  lastLeaveTs?: number | null;
  lastLeaveClient?: string | null;
  lastSeen?: string | null;
  lastActiveTs: number;
  accountType?: string | null;
}

interface PlayerSummary {
  uuid: string;
  name: string;
  clients: string[];
  online: boolean;
  currentServer: string | null;
  currentClient: string | null;
  lastJoinTs: number | null;
  lastJoinClient: string | null;
  lastLeaveTs: number | null;
  lastLeaveClient: string | null;
  lastSeenLabel: string | null;
  lastActiveTs: number;
  accountType: string | null;
  banned?: boolean;
  banInfo?: BanInfo;
}

const toPlayerSummary = (data: PlayerUpdate): PlayerSummary => ({
  uuid: data.uuid,
  name: data.name,
  online: data.online,
  currentServer: data.currentServer ?? null,
  currentClient: data.currentClient ?? null,
  clients: data.clients ?? [],
  lastJoinTs: data.lastJoinTs ?? null,
  lastJoinClient: data.lastJoinClient ?? null,
  lastLeaveTs: data.lastLeaveTs ?? null,
  lastLeaveClient: data.lastLeaveClient ?? null,
  lastSeenLabel: data.lastSeen ?? null,
  lastActiveTs: data.lastActiveTs,
  accountType: data.accountType ?? null,
});

const sortPlayers = (arr: PlayerSummary[]) => {
  arr.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return b.lastActiveTs - a.lastActiveTs;
  });
  return arr;
};

export const PlayerManagerPage = () => {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [filtered, setFiltered] = useState<PlayerSummary[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024;
  });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth <= 1023;
  });
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);
  const navigate = useNavigate();

  // Track window resize to update mobile state
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load initial player data
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/locked/data/players?verifyOnline=true');

      if (!res.ok) throw new Error('Failed to fetch players');

      const data = await res.json();
      setPlayers(sortPlayers(data.players || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    load();
  }, []);

  // WebSocket setup
  useEffect(() => {
    let mounted = true;
    const unsubscribers: (() => void)[] = [];

    const setupWebSocket = async () => {
      try {
        websocketService.on('player-update', (msg: any) => {
          const data: PlayerUpdate = msg.data;
          if (mounted) {
            setPlayers((prev) => {
              const map = new Map(prev.map((p) => [p.uuid, p]));
              const updated = toPlayerSummary(data);
              map.set(data.uuid, updated);
              return sortPlayers(Array.from(map.values()));
            });
          }
        });

        websocketService.on('players-batch', (msg: any) => {
          const batch: PlayerUpdate[] = msg.data;
          if (mounted) {
            setPlayers((prev) => {
              const map = new Map(prev.map((p) => [p.uuid, p]));
              batch.forEach((data) => {
                const updated = toPlayerSummary(data);
                map.set(data.uuid, updated);
              });
              return sortPlayers(Array.from(map.values()));
            });
          }
        });

        websocketService.on('ban-update', (msg: any) => {
          const { uuid, name, isBanned, reason, bannedBy } = msg.data;
          if (mounted) {
            setPlayers((prev) =>
              prev.map((p) =>
                p.uuid === uuid
                  ? {
                      ...p,
                      banned: isBanned,
                      banInfo: isBanned ? { uuid, name, reason, banned_by: bannedBy } : undefined,
                    }
                  : p
              )
            );
          }
        });

        await websocketService.connect();
        if (mounted) {
          websocketService.subscribe('players');
          websocketService.subscribe('bans');
        }
      } catch (err) {
        console.error('Failed to setup WebSocket:', err);
      }
    };

    setupWebSocket();

    return () => {
      mounted = false;
      unsubscribers.forEach((unsub) => unsub?.());
    };
  }, []);

  // Filter players
  useEffect(() => {
    const lower = filter.toLowerCase().trim();
    const result = lower
      ? players.filter(
          (p) => p.name.toLowerCase().includes(lower) || p.uuid.toLowerCase().includes(lower)
        )
      : players;
    setFiltered(result);
  }, [players, filter]);

  const activePlayer = useMemo(() => {
    return players.find((p) => p.uuid === active) ?? null;
  }, [players, active]);

  // Fetch ban info for active player
  useEffect(() => {
    if (!activePlayer) return;

    const fetchBanInfo = async () => {
      try {
        const res = await api.get(`/api/locked/players/${activePlayer.uuid}/ban`);
        if (res.ok) {
          const data = await res.json();
          setPlayers((prev) =>
            prev.map((p) =>
              p.uuid === activePlayer.uuid
                ? { ...p, banned: data.banned, banInfo: data.ban }
                : p
            )
          );
        }
      } catch (err) {
        console.error('Failed to fetch ban info:', err);
      }
    };

    fetchBanInfo();
  }, [activePlayer?.uuid]);

  // Resize handlers
  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => {
      setSidebarWidth(Math.max(340, Math.min(640, e.clientX)));
    };
    const handleUp = () => setIsResizing(false);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing]);

  const handlePlayerSelect = (uuid: string) => {
    setActive(uuid);
    if (isMobile) setSidebarOpen(false);
  };

  const handleBanStatusChange = (uuid: string, banned: boolean) => {
    setPlayers((prev) =>
      prev.map((p) => (p.uuid === uuid ? { ...p, banned } : p))
    );
    const player = players.find((p) => p.uuid === uuid);
    if (player && uuid === active) {
      setActive(null);
      setActive(uuid);
    }
  };

  const handleBackToAdmin = () => {
    navigate('/admin');
  };

  return (
    <div className="pm-page">
      {/* Mobile toggle button */}
      {isMobile && (
        <button
          className="pm-toggle-button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle player list"
        >
          ☰ Players
        </button>
      )}

      {/* Mobile overlay backdrop */}
      {isMobile && sidebarOpen && (
        <div className="pm-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <PlayerSidebar
        filtered={filtered}
        active={active}
        loading={loading}
        error={error}
        filter={filter}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        sidebarWidth={sidebarWidth}
        isResizing={isResizing}
        onFilterChange={setFilter}
        onPlayerSelect={handlePlayerSelect}
        onCloseSidebar={() => setSidebarOpen(false)}
        onRetry={load}
        onBackToAdmin={handleBackToAdmin}
      />

      {/* Resize handle (desktop only) */}
      {!isMobile && (
        <div
          className="pm-resize-handle"
          onMouseDown={() => setIsResizing(true)}
          title="Drag to resize"
        />
      )}

      {/* Main content */}
      <main className="pm-main">
        <PlayerInfo
          activePlayer={activePlayer}
          onBanStatusChange={handleBanStatusChange}
        />
      </main>
    </div>
  );
};

export default PlayerManagerPage;
