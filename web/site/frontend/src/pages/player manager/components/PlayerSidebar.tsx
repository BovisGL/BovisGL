import React from 'react';
import { getPlayerAvatarUrlSync, resolvePlayerAvatar } from '../../../services/skinService';

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
}

interface PlayerSidebarProps {
  filtered: PlayerSummary[];
  active: string | null;
  loading: boolean;
  error: string | null;
  filter: string;
  isMobile: boolean;
  sidebarOpen: boolean;
  sidebarWidth: number;
  isResizing: boolean;
  onFilterChange: (value: string) => void;
  onPlayerSelect: (uuid: string) => void;
  onCloseSidebar: () => void;
  onRetry: () => void;
  onBackToAdmin: () => void;
}

function formatDateTime(ts?: number | null): string {
  if (typeof ts !== 'number' || Number.isNaN(ts)) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function describeDateTimeWithClient(ts?: number | null, client?: string | null): string {
  const display = formatDateTime(ts);
  if (display === '—') return client ?? '—';
  return client ? `${display} · ${client}` : display;
}

function describeLastSeen(player: PlayerSummary): string {
  if (player.online) return 'Online now';
  const ts = player.lastLeaveTs ?? player.lastJoinTs;
  const client = player.lastLeaveTs ? player.lastLeaveClient : player.lastJoinClient;
  const computed = describeDateTimeWithClient(ts, client);
  if (computed !== '—') return computed;
  return player.lastSeenLabel ?? '—';
}

function avatarUrl(uuid: string, name: string, size = 24): string {
  return getPlayerAvatarUrlSync(uuid, name, size);
}

export const PlayerSidebar: React.FC<PlayerSidebarProps> = ({
  filtered,
  active,
  loading,
  error,
  filter,
  isMobile,
  sidebarOpen,
  sidebarWidth,
  isResizing,
  onFilterChange,
  onPlayerSelect,
  onCloseSidebar,
  onRetry,
  onBackToAdmin
}) => {
  const [bannedExpanded, setBannedExpanded] = React.useState(false);
  
  const nonParkourPlayers = filtered
    .filter(p => (p.currentServer ?? '').toLowerCase() !== 'parkour');
  
  const nonBannedPlayers = nonParkourPlayers.filter(p => !p.banned);
  const bannedPlayers = nonParkourPlayers.filter(p => p.banned);
  
  const displayedPlayers = nonBannedPlayers;
  const excludedCount = filtered.length - nonParkourPlayers.length;
  return (
    <aside 
      className="pm-sidebar" 
      style={{
        position: isMobile ? 'fixed' : 'relative',
        top: 0,
        left: 0,
        width: !isMobile ? `${sidebarWidth}px` : '100%',
        height: isMobile ? '100vh' : 'auto',
        transition: isResizing ? 'none' : 'transform 0.3s ease',
        transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        maxHeight: '100vh',
        zIndex: 1000,
        background: '#0a0f14',
        boxShadow: isMobile ? '0 0 20px rgba(0,0,0,0.8)' : 'none'
      }}
    >
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 clamp(12px,2vw,16px)', marginBottom: '12px'}}>
        <h3 style={{margin:0,color:'#4fc3f7'}}>PLAYERS</h3>
        <button
          onClick={onCloseSidebar}
          style={{
            display: isMobile ? 'block' : 'none',
            background: 'transparent',
            border: 'none',
            color: '#4fc3f7',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1
          }}
        >
          ✕
        </button>
      </div>
      
      <div style={{padding:'0 clamp(12px,2vw,16px)', marginBottom: 'clamp(8px,1vw,12px)'}}>
        <input
          value={filter}
          onChange={e => onFilterChange(e.target.value)}
          placeholder="Filter by name or UUID"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width:'100%',
            padding:'clamp(6px,1vw,8px)',
            background:'#13191f',
            border:'1px solid #1f2b33',
            borderRadius:6,
            color:'#eee',
            fontSize:'clamp(12px,1.5vw,13px)',
            boxSizing:'border-box',
            pointerEvents:'auto',
            userSelect:'text',
            WebkitUserSelect:'text',
            cursor:'text'
          }}
        />
      </div>

      <div style={{flex:1,overflowY:'auto',minWidth:0,paddingLeft:'clamp(12px,2vw,16px)',paddingRight:'clamp(12px,2vw,16px)',maxHeight:'calc(100vh - 120px)'}}>
        {loading && <div style={{padding:'clamp(8px,1.5vw,10px)',fontSize:'clamp(11px,1.5vw,12px)',opacity:0.6}}>Loading...</div>}
        {error && !loading && (
          <div style={{padding:'clamp(8px,1.5vw,10px)',fontSize:'clamp(11px,1.5vw,12px)',color:'#ef5350',lineHeight:1.4}}>
            Error: {error}
            <div style={{marginTop:12}}>
              <button onClick={onRetry} style={{padding:'6px 10px',background:'#4fc3f7',border:'none',borderRadius:4,color:'#000',cursor:'pointer',fontWeight:600,fontSize:'clamp(11px,1vw,12px)'}}>Retry</button>
            </div>
          </div>
        )}
        {!loading && !error && nonBannedPlayers.length > 0 && (
          <>
            {nonBannedPlayers.map(p => (
          <div key={p.uuid} onClick={() => onPlayerSelect(p.uuid)} style={{
            padding:'clamp(8px,1.5vw,10px)',
            cursor:'pointer',
            background: p.uuid===active ? '#1a2a33' : 'transparent',
            borderLeft: p.uuid===active ? '3px solid #4fc3f7' : (p.online ? '3px solid #4CAF50' : '3px solid transparent'),
            display:'flex',
            gap:'clamp(8px,1vw,10px)',
            alignItems:'flex-start',
            minWidth:0,
            borderRadius:4,
            transition:'all 0.2s ease',
            marginBottom:'4px',
            position:'relative',
            overflow:'hidden'
          }}>
            {p.accountType === 'java' && (
              <img
                src={avatarUrl(p.uuid, p.name, 24)}
                alt="avatar"
                width={24}
                height={24}
                referrerPolicy="no-referrer"
                style={{
                  borderRadius:4,
                  background:'#0a0f14',
                  border:'1px solid #1a2a33',
                  minWidth:24,
                  minHeight:24,
                  position:'relative',
                  zIndex:2
                }}
                onError={(e)=>{ resolvePlayerAvatar(e.currentTarget as HTMLImageElement, p.uuid, p.name, 24); }}
              />
            )}
            <div style={{display:'flex',flexDirection:'column',minWidth:0,flex:1,position:'relative',zIndex:2}}>
              <div style={{display:'flex',alignItems:'center',gap:'clamp(4px,0.5vw,6px)'}}>
                <div style={{
                  fontSize:'clamp(13px,1.5vw,14px)',
                  fontWeight: 500,
                  overflow:'hidden',
                  textOverflow:'ellipsis',
                  whiteSpace:'nowrap',
                  color:'#fff',
                  textDecoration: 'none'
                }}>{p.name}</div>
                {p.accountType && (
                  <div style={{
                    fontSize:'clamp(9px,0.8vw,10px)',
                    opacity:0.65,
                    background:'#152028',
                    border:'1px solid #1f2f38',
                    borderRadius:3,
                    padding:'2px 6px',
                    whiteSpace:'nowrap',
                    display:'inline-flex',
                    alignItems:'center',
                    gap:'3px'
                  }}>
                    {p.accountType === 'bedrock' ? '📱' : '🖥️'} {p.accountType}
                  </div>
                )}
              </div>
              <div style={{fontSize:'clamp(10px,1vw,11px)',opacity:0.55,letterSpacing:'0.5px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.uuid}</div>
              <div style={{fontSize:'clamp(10px,1vw,11px)',opacity:0.45,letterSpacing:'0.4px',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{describeLastSeen(p)}</div>
            </div>
          </div>
            ))}
          </>
        )}

        {!loading && !error && bannedPlayers.length > 0 && (
          <div style={{marginTop:'clamp(16px,2vw,20px)',marginBottom:'clamp(8px,1.5vw,10px)',borderTop:'1px solid #2a3a45',paddingTop:'clamp(12px,1.5vw,16px)'}}>
            <button
              onClick={() => setBannedExpanded(!bannedExpanded)}
              style={{
                width:'100%',
                padding:'clamp(8px,1.5vw,10px) clamp(12px,2vw,16px)',
                background:'#14191e',
                border:'1px solid #3a2a2a',
                borderRadius:'4px 4px 0 0',
                color:'#ff6b6b',
                fontSize:'clamp(11px,1.5vw,12px)',
                fontWeight:'600',
                cursor:'pointer',
                textAlign:'left',
                transition:'all 0.2s ease',
                display:'flex',
                justifyContent:'space-between',
                alignItems:'center'
              }}
            >
              <span>🔒 Banned Players ({bannedPlayers.length})</span>
              <span style={{fontSize:'clamp(10px,1vw,11px)'}}>{bannedExpanded ? '▼' : '▶'}</span>
            </button>
            
            {bannedExpanded && (
              <div style={{background:'#0f1419',borderLeft:'1px solid #3a2a2a',borderRight:'1px solid #3a2a2a',borderBottom:'1px solid #3a2a2a',borderRadius:'0 0 4px 4px'}}>
                {bannedPlayers.map(p => (
                  <div key={p.uuid} onClick={() => onPlayerSelect(p.uuid)} style={{
                    padding:'clamp(8px,1.5vw,10px)',
                    cursor:'pointer',
                    background: p.uuid===active ? '#1a2a33' : 'transparent',
                    borderLeft: p.uuid===active ? '3px solid #ff6b6b' : '3px solid transparent',
                    display:'flex',
                    gap:'clamp(8px,1vw,10px)',
                    alignItems:'flex-start',
                    minWidth:0,
                    borderRadius:0,
                    transition:'all 0.2s ease',
                    marginBottom:'0',
                    position:'relative',
                    overflow:'hidden'
                  }}>
                    {p.accountType === 'java' && (
                      <img src={avatarUrl(p.uuid, p.name, 24)} alt={p.name} style={{width:24,height:24,borderRadius:4,flexShrink:0}} onError={(e)=>{ resolvePlayerAvatar(e.currentTarget as HTMLImageElement, p.uuid, p.name, 24); }} />
                    )}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,color:'#ff6b6b',fontSize:'clamp(11px,1vw,12px)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                      <div style={{fontSize:'clamp(9px,0.9vw,10px)',color:'#999',marginTop:'2px'}}>Banned</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {!loading && !error && displayedPlayers.length===0 && bannedPlayers.length===0 && <div style={{padding:'clamp(8px,1.5vw,10px)',fontSize:'clamp(11px,1vw,12px)',opacity:0.5}}>No players</div>}
      </div>

      <div style={{borderTop:'1px solid #1a2a33',paddingTop:'clamp(8px,1.5vw,10px)',marginTop:'auto',paddingLeft:'clamp(12px,2vw,16px)',paddingRight:'clamp(12px,2vw,16px)',paddingBottom:'clamp(12px,1.5vw,16px)'}}>
        <div style={{padding:'clamp(8px,1.5vw,10px) 0',fontSize:'clamp(10px,1vw,11px)',opacity:0.5,textAlign:'center',marginBottom:'clamp(8px,1.5vw,10px)'}}>Total: {displayedPlayers.length}{bannedPlayers.length > 0 ? ` + ${bannedPlayers.length} banned` : ''}{excludedCount>0?` ( +${excludedCount} hidden )`:''}</div>
        <button
          onClick={onBackToAdmin}
          style={{
            width:'100%',
            padding:'clamp(6px,1.5vw,8px) clamp(12px,2vw,14px)',
            borderRadius:6,
            border:'1px solid #1f2f3a',
            background:'#13191f',
            color:'#cfe9ff',
            fontSize:'clamp(11px,1.5vw,12px)',
            fontWeight:600,
            letterSpacing:'0.5px',
            cursor:'pointer',
            transition:'all 0.2s ease'
          }}
        >
          ← Back to Admin
        </button>
      </div>
    </aside>
  );
};
