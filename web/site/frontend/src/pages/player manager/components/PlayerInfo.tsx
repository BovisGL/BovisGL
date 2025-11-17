import React, { useMemo, useState } from 'react';
import { api } from '../../../services/apiService';
import { getPlayerAvatarUrlSync, resolvePlayerAvatar } from '../../../services/skinService';

interface BanInfo {
  uuid: string;
  name: string;
  reason?: string;
  banned_by?: string;
  banned_at?: number;
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

interface PlayerInfoProps {
  activePlayer: PlayerSummary | null;
  onBanStatusChange?: (uuid: string, banned: boolean) => void;
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

export const PlayerInfo: React.FC<PlayerInfoProps> = ({ activePlayer, onBanStatusChange }) => {
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const [banConfirmInput, setBanConfirmInput] = useState('');
  const [banReason, setBanReason] = useState('');
  const [isBanning, setIsBanning] = useState(false);
  const [banError, setBanError] = useState<string | null>(null);
  const [showUnbanConfirm, setShowUnbanConfirm] = useState(false);
  const [unbanConfirmInput, setUnbanConfirmInput] = useState('');

  const onlineBadge = useMemo(() => {
    if (!activePlayer) return null;
    const segments: string[] = [];
    if (activePlayer.online) {
      segments.push('Online');
      if (activePlayer.currentServer) segments.push(activePlayer.currentServer);
      if (activePlayer.currentClient) segments.push(`(${activePlayer.currentClient})`);
    }
    return (
      <span style={{
        fontSize: 'clamp(11px,1.5vw,13px)',
        fontWeight: 600,
        padding: '5px 12px',
        borderRadius: 999,
        textTransform: 'uppercase',
        letterSpacing: '.3px',
        background: activePlayer.online ? '#1b5e20' : '#1a1f24',
        color: activePlayer.online ? '#a5d6a7' : '#999',
        border: `1px solid ${activePlayer.online ? '#2e7d32' : '#2a3a45'}`
      }}>
        {activePlayer.online ? segments.join(' ') : 'Offline'}
      </span>
    );
  }, [activePlayer]);

  const lastSeenDisplay = useMemo(() => {
    if (!activePlayer) return null;
    return describeLastSeen(activePlayer);
  }, [activePlayer]);

  const handleBanClick = () => {
    setShowBanConfirm(true);
    setBanConfirmInput('');
    setBanReason('');
    setBanError(null);
  };

  const handleConfirmBan = async () => {
    if (!activePlayer) return;
    if (banConfirmInput !== activePlayer.name) {
      setBanError(`Please type the exact username "${activePlayer.name}" to confirm`);
      return;
    }
    if (!banReason.trim()) {
      setBanError('Please provide a ban reason');
      return;
    }

    setIsBanning(true);
    setBanError(null);
    try {
      const response = await api.post('/api/locked/players/ban', {
        uuid: activePlayer.uuid,
        name: activePlayer.name,
        reason: banReason,
        by: localStorage.getItem('admin_name') || 'Admin'
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to ban player');
      }

      setShowBanConfirm(false);
      setBanConfirmInput('');
      setBanReason('');
      onBanStatusChange?.(activePlayer.uuid, true);
    } catch (err) {
      setBanError(err instanceof Error ? err.message : 'Failed to ban player');
    } finally {
      setIsBanning(false);
    }
  };

  const handleUnban = async () => {
    if (!activePlayer) return;
    
    setIsBanning(true);
    setBanError(null);
    try {
      const response = await api.post('/api/locked/players/unban', {
        uuid: activePlayer.uuid
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to unban player');
      }

      setShowUnbanConfirm(false);
      setUnbanConfirmInput('');
      onBanStatusChange?.(activePlayer.uuid, false);
    } catch (err) {
      setBanError(err instanceof Error ? err.message : 'Failed to unban player');
    } finally {
      setIsBanning(false);
    }
  };

  const handleUnbanClick = () => {
    setShowUnbanConfirm(true);
    setUnbanConfirmInput('');
  };

  const handleConfirmUnban = async () => {
    if (!activePlayer) return;
    if (unbanConfirmInput !== activePlayer.name) {
      setBanError(`Please type the exact username "${activePlayer.name}" to confirm`);
      return;
    }

    await handleUnban();
  };

  if (!activePlayer) {
    return (
      <div style={{margin:'auto',textAlign:'center',opacity:0.28,letterSpacing:'1px',fontSize:'clamp(1rem,3vw,1.25rem)',fontWeight:600}}>
        Select a player from the list
      </div>
    );
  }

  return (
    <div style={{width:'100%',maxWidth:'none',position:'relative',padding:'clamp(16px,3vw,40px)'}}>
      {/* Diagonal BANNED stamp for banned players */}
      {activePlayer.banned && (
        <div style={{
          position:'absolute',
          top:'0',
          left:'0',
          right:'0',
          bottom:'0',
          zIndex:3,
          pointerEvents:'none',
          overflow:'hidden',
          borderRadius:'4px'
        }}>
          <div style={{
            position:'absolute',
            top:'-50%',
            left:'-50%',
            width:'200%',
            height:'200%',
            transform:'rotate(45deg)',
            display:'flex',
            alignItems:'center',
            justifyContent:'center'
          }}>
            <div style={{
              fontSize:'clamp(3.5rem,12vw,6rem)',
              fontWeight:900,
              color:'#ff3333',
              opacity:0.2,
              textTransform:'uppercase',
              letterSpacing:'4px',
              whiteSpace:'nowrap',
              textShadow:'2px 2px 4px rgba(255,51,51,0.4)'
            }}>
              BANNED
            </div>
          </div>
        </div>
      )}
      <h1 style={{
        margin:'0 0 clamp(8px,1.5vw,12px)',
        fontSize:'clamp(1.5rem,5vw,2rem)',
        color: activePlayer.banned ? '#ff6b6b' : '#4fc3f7',
        display:'flex',
        alignItems:'center',
        flexWrap:'wrap',
        gap:'clamp(8px,1.5vw,16px)',
        position:'relative',
        zIndex:2
      }}>
        {activePlayer.name}
        {onlineBadge}
      </h1>
      <div style={{display:'flex',alignItems:'center',gap:'clamp(12px,2vw,16px)',marginBottom:'clamp(16px,3vw,20px)',flexWrap:'wrap',position:'relative',zIndex:2}}>
        {activePlayer.accountType === 'java' && (
          <img
            src={avatarUrl(activePlayer.uuid, activePlayer.name, 64)}
            alt="avatar"
            width={64}
            height={64}
            style={{
              borderRadius:8,
              background:'#0a0f14',
              border: activePlayer.banned ? '2px solid #ff4444' : '1px solid #1a2a33',
              opacity: activePlayer.banned ? 0.6 : 1
            }}
            onLoad={() => console.log(`✅ Avatar loaded for ${activePlayer.name}`)}
            onError={(e)=>{ console.error(`❌ Avatar load failed for ${activePlayer.name}`, e); resolvePlayerAvatar(e.currentTarget as HTMLImageElement, activePlayer.uuid, activePlayer.name, 64); }}
          />
        )}
        <div style={{opacity:0.7,fontSize:'clamp(11px,1.5vw,12px)'}}>UUID: <span style={{fontFamily:'monospace',wordBreak:'break-all'}}>{activePlayer.uuid}</span></div>
      </div>
      <div style={{
        display:'grid',
        gridTemplateColumns:'clamp(120px,20vw,180px) 1fr',
        rowGap:'clamp(12px,2vw,14px)',
        columnGap:'clamp(24px,4vw,40px)',
        background: activePlayer.banned ? '#1a0a0a' : '#0d1519',
        padding:'clamp(16px,2.5vw,24px)',
        border: activePlayer.banned ? '2px solid #ff4444' : '1px solid #18232b',
        borderRadius:16,
        width:'100%',
        marginBottom:'clamp(16px,3vw,20px)',
        position:'relative',
        zIndex:2,
        opacity: activePlayer.banned ? 0.85 : 1
      }}>
        <div style={{fontSize:'clamp(11px,1.5vw,12px)',letterSpacing:'1px',color:'#607d8b'}}>UUID</div>
        <div style={{fontFamily:'monospace',fontSize:'clamp(12px,1.5vw,13px)',wordBreak:'break-all'}}>{activePlayer.uuid}</div>
        <div style={{fontSize:'clamp(11px,1.5vw,12px)',letterSpacing:'1px',color:'#607d8b'}}>NAME</div>
        <div style={{fontSize:'clamp(13px,1.5vw,14px)',color: activePlayer.banned ? '#ff6b6b' : '#fff'}}>{activePlayer.name}</div>
        <div style={{fontSize:'clamp(11px,1.5vw,12px)',letterSpacing:'1px',color:'#607d8b'}}>STATUS</div>
        <div style={{fontSize:'clamp(13px,1.5vw,14px)',color: activePlayer.banned ? '#ff6b6b' : '#a5d6a7',fontWeight:'bold'}}>
          {activePlayer.banned ? '🔒 BANNED' : '✓ Active'}
        </div>
        <div style={{fontSize:'clamp(11px,1.5vw,12px)',letterSpacing:'1px',color:'#607d8b'}}>ACCOUNT TYPE</div>
        <div style={{fontSize:'clamp(13px,1.5vw,14px)',color: activePlayer.accountType === 'bedrock' ? '#ff9800' : activePlayer.accountType === 'java' ? '#4fc3f7' : '#9e9e9e'}}>
          {activePlayer.accountType === 'bedrock' ? '📱 Bedrock' : activePlayer.accountType === 'java' ? '☕ Java' : activePlayer.accountType === null ? 'Unknown' : 'Error'}
        </div>
        <div style={{fontSize:'clamp(11px,1.5vw,12px)',letterSpacing:'1px',color:'#607d8b'}}>LAST SEEN</div>
        <div style={{fontSize:'clamp(13px,1.5vw,14px)'}}>{lastSeenDisplay ?? '—'}</div>
        {activePlayer.online && (
          <>
            <div style={{fontSize:'clamp(11px,1.5vw,12px)',letterSpacing:'1px',color:'#607d8b'}}>CURRENT SERVER</div>
            <div style={{fontSize:'clamp(13px,1.5vw,14px)'}}>{activePlayer.currentServer ?? '—'}</div>
            <div style={{fontSize:'clamp(11px,1.5vw,12px)',letterSpacing:'1px',color:'#607d8b'}}>CURRENT CLIENT</div>
            <div style={{fontSize:'clamp(13px,1.5vw,14px)'}}>{activePlayer.currentClient ?? '—'}</div>
          </>
        )}
        <div style={{fontSize:'clamp(11px,1.5vw,12px)',letterSpacing:'1px',color:'#607d8b'}}>KNOWN CLIENTS</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:'clamp(6px,1vw,8px)'}}>
          {activePlayer.clients && activePlayer.clients.length > 0 ? (
            activePlayer.clients.map((c, i) => (
              <span key={i} style={{fontSize:'clamp(11px,1.5vw,12px)',padding:'4px 8px',borderRadius:999,background:'#18232b',border:'1px solid #27343f',color:'#cfd8dc'}}>{c}</span>
            ))
          ) : (
            <span style={{opacity:0.6}}>None recorded</span>
          )}
        </div>
        {activePlayer.banInfo && (
          <>
            <div style={{fontSize:'clamp(11px,1.5vw,12px)',letterSpacing:'1px',color:'#607d8b'}}>BAN REASON</div>
            <div style={{fontSize:'clamp(13px,1.5vw,14px)',color:'#ff6b6b'}}>{activePlayer.banInfo.reason || 'No reason provided'}</div>
            <div style={{fontSize:'clamp(11px,1.5vw,12px)',letterSpacing:'1px',color:'#607d8b'}}>BANNED BY</div>
            <div style={{fontSize:'clamp(13px,1.5vw,14px)',color:'#ff6b6b'}}>{activePlayer.banInfo.banned_by || 'System'}</div>
          </>
        )}
      </div>

      {/* Ban Action Button */}
      <div style={{display:'flex',gap:'clamp(8px,1.5vw,12px)',marginBottom:'clamp(16px,3vw,20px)',position:'relative',zIndex:2}}>
        {!activePlayer.banned ? (
          <button
            onClick={handleBanClick}
            disabled={isBanning}
            style={{
              padding:'clamp(10px,1.5vw,12px) clamp(16px,2.5vw,20px)',
              borderRadius:8,
              border:'none',
              fontSize:'clamp(12px,1.5vw,14px)',
              fontWeight:600,
              cursor: isBanning ? 'not-allowed' : 'pointer',
              background:'#c62828',
              color:'#fff',
              opacity: isBanning ? 0.6 : 1,
              transition:'all 0.2s'
            }}
          >
            {isBanning ? 'Processing...' : '🔒 Ban Player'}
          </button>
        ) : (
          <button
            onClick={handleUnbanClick}
            disabled={isBanning}
            style={{
              padding:'clamp(10px,1.5vw,12px) clamp(16px,2.5vw,20px)',
              borderRadius:8,
              border:'1px solid #558b2f',
              fontSize:'clamp(12px,1.5vw,14px)',
              fontWeight:600,
              cursor: isBanning ? 'not-allowed' : 'pointer',
              background:'transparent',
              color:'#9ccc65',
              opacity: isBanning ? 0.6 : 1,
              transition:'all 0.2s'
            }}
          >
            {isBanning ? 'Processing...' : '✓ Unban Player'}
          </button>
        )}
      </div>

      {/* Ban Confirmation Dialog */}
      {showBanConfirm && (
        <div 
          style={{
            position:'fixed',
            inset:0,
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            background:'rgba(0,0,0,0.8)',
            zIndex:1000,
            padding:'clamp(16px,5vw,24px)'
          }}
          onClick={() => setShowBanConfirm(false)}
        >
          <div style={{
            background:'#0a1419',
            border:'1px solid #1f2b33',
            borderRadius:16,
            padding:'clamp(24px,4vw,32px)',
            maxWidth:'100%',
            width:'clamp(300px,90vw,500px)',
            boxShadow:'0 20px 60px rgba(0,0,0,0.8)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{margin:'0 0 clamp(12px,2vw,16px)',color:'#ff6b6b',fontSize:'clamp(18px,2.5vw,22px)'}}>
              Confirm Ban
            </h2>
            <p style={{margin:'0 0 clamp(16px,2vw,20px)',color:'#b0bec5',fontSize:'clamp(13px,1.5vw,14px)'}}>
              Are you sure you want to ban <strong>{activePlayer.name}</strong>?
            </p>
            
            <div style={{marginBottom:'clamp(12px,2vw,16px)'}}>
              <label style={{display:'block',fontSize:'clamp(12px,1.5vw,13px)',color:'#607d8b',marginBottom:'clamp(6px,1vw,8px)'}}>
                Ban Reason:
              </label>
              <input
                type="text"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g., Hacking, Spam, Toxicity"
                disabled={isBanning}
                style={{
                  width:'100%',
                  padding:'clamp(8px,1.5vw,10px)',
                  borderRadius:6,
                  border:'1px solid #1a2a33',
                  background:'#0d1519',
                  color:'#fff',
                  fontSize:'clamp(12px,1.5vw,13px)',
                  boxSizing:'border-box',
                  opacity: isBanning ? 0.6 : 1
                }}
              />
            </div>

            <div style={{marginBottom:'clamp(12px,2vw,16px)'}}>
              <label style={{display:'block',fontSize:'clamp(12px,1.5vw,13px)',color:'#607d8b',marginBottom:'clamp(6px,1vw,8px)'}}>
                Type username to confirm:
              </label>
              <input
                type="text"
                value={banConfirmInput}
                onChange={(e) => setBanConfirmInput(e.target.value)}
                placeholder={activePlayer.name}
                disabled={isBanning}
                style={{
                  width:'100%',
                  padding:'clamp(8px,1.5vw,10px)',
                  borderRadius:6,
                  border: banConfirmInput === activePlayer.name ? '1px solid #558b2f' : '1px solid #1a2a33',
                  background:'#0d1519',
                  color: banConfirmInput === activePlayer.name ? '#a5d6a7' : '#fff',
                  fontSize:'clamp(12px,1.5vw,13px)',
                  boxSizing:'border-box',
                  opacity: isBanning ? 0.6 : 1
                }}
              />
            </div>

            {banError && (
              <div style={{
                padding:'clamp(8px,1.5vw,12px)',
                background:'#5e1914',
                border:'1px solid #d32f2f',
                borderRadius:6,
                color:'#ff8a80',
                fontSize:'clamp(12px,1.5vw,13px)',
                marginBottom:'clamp(12px,2vw,16px)'
              }}>
                {banError}
              </div>
            )}

            <div style={{display:'flex',gap:'clamp(8px,1.5vw,12px)',justifyContent:'flex-end'}}>
              <button
                onClick={() => setShowBanConfirm(false)}
                disabled={isBanning}
                style={{
                  padding:'clamp(8px,1.5vw,10px) clamp(16px,2.5vw,20px)',
                  borderRadius:6,
                  border:'1px solid #1a2a33',
                  background:'transparent',
                  color:'#b0bec5',
                  fontSize:'clamp(12px,1.5vw,13px)',
                  fontWeight:600,
                  cursor: isBanning ? 'not-allowed' : 'pointer',
                  opacity: isBanning ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBan}
                disabled={isBanning || banConfirmInput !== activePlayer.name || !banReason.trim()}
                style={{
                  padding:'clamp(8px,1.5vw,10px) clamp(16px,2.5vw,20px)',
                  borderRadius:6,
                  border:'none',
                  background: (banConfirmInput === activePlayer.name && banReason.trim()) ? '#c62828' : '#333',
                  color:'#fff',
                  fontSize:'clamp(12px,1.5vw,13px)',
                  fontWeight:600,
                  cursor: (isBanning || banConfirmInput !== activePlayer.name || !banReason.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (isBanning || banConfirmInput !== activePlayer.name || !banReason.trim()) ? 0.6 : 1
                }}
              >
                {isBanning ? 'Banning...' : 'Confirm Ban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unban Confirmation Dialog */}
      {showUnbanConfirm && (
        <div 
          style={{
            position:'fixed',
            inset:0,
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            background:'rgba(0,0,0,0.8)',
            zIndex:1000,
            padding:'clamp(16px,5vw,24px)'
          }}
          onClick={() => setShowUnbanConfirm(false)}
        >
          <div style={{
            background:'#0a1419',
            border:'1px solid #1f2b33',
            borderRadius:16,
            padding:'clamp(24px,4vw,32px)',
            maxWidth:'100%',
            width:'clamp(300px,90vw,500px)',
            boxShadow:'0 20px 60px rgba(0,0,0,0.8)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{margin:'0 0 clamp(12px,2vw,16px)',color:'#9ccc65',fontSize:'clamp(18px,2.5vw,22px)'}}>
              Confirm Unban
            </h2>
            <p style={{margin:'0 0 clamp(12px,1.5vw,16px)',color:'#b0bec5',fontSize:'clamp(13px,1.5vw,14px)'}}>
              Are you sure you want to unban <strong style={{color:'#fff'}}>{activePlayer.name}</strong>?
            </p>
            
            {activePlayer.banInfo && (
              <div style={{
                background:'#1a0f0f',
                border:'1px solid #663333',
                borderRadius:6,
                padding:'clamp(12px,1.5vw,14px)',
                marginBottom:'clamp(16px,2vw,20px)',
                fontSize:'clamp(12px,1.5vw,13px)',
                color:'#ff9999'
              }}>
                <div style={{marginBottom:'8px'}}>
                  <strong>Ban Reason:</strong> {activePlayer.banInfo.reason || 'No reason provided'}
                </div>
                {activePlayer.banInfo.banned_by && (
                  <div style={{marginBottom:'8px'}}>
                    <strong>Banned By:</strong> {activePlayer.banInfo.banned_by}
                  </div>
                )}
                {activePlayer.banInfo.banned_at && (
                  <div>
                    <strong>Banned At:</strong> {formatDateTime(activePlayer.banInfo.banned_at)}
                  </div>
                )}
              </div>
            )}

            <div style={{marginBottom:'clamp(12px,2vw,16px)'}}>
              <label style={{display:'block',fontSize:'clamp(12px,1.5vw,13px)',color:'#607d8b',marginBottom:'clamp(6px,1vw,8px)'}}>
                Type username to confirm unban:
              </label>
              <input
                type="text"
                value={unbanConfirmInput}
                onChange={(e) => setUnbanConfirmInput(e.target.value)}
                placeholder={activePlayer.name}
                disabled={isBanning}
                style={{
                  width:'100%',
                  padding:'clamp(8px,1.5vw,10px)',
                  borderRadius:6,
                  border: unbanConfirmInput === activePlayer.name ? '1px solid #558b2f' : '1px solid #1a2a33',
                  background:'#0d1519',
                  color: unbanConfirmInput === activePlayer.name ? '#a5d6a7' : '#fff',
                  fontSize:'clamp(12px,1.5vw,13px)',
                  boxSizing:'border-box',
                  opacity: isBanning ? 0.6 : 1
                }}
              />
            </div>

            {banError && (
              <div style={{
                padding:'clamp(8px,1.5vw,12px)',
                background:'#5e1914',
                border:'1px solid #d32f2f',
                borderRadius:6,
                color:'#ff8a80',
                fontSize:'clamp(12px,1.5vw,13px)',
                marginBottom:'clamp(12px,2vw,16px)'
              }}>
                {banError}
              </div>
            )}

            <div style={{display:'flex',gap:'clamp(8px,1.5vw,12px)',justifyContent:'flex-end'}}>
              <button
                onClick={() => setShowUnbanConfirm(false)}
                disabled={isBanning}
                style={{
                  padding:'clamp(8px,1.5vw,10px) clamp(16px,2.5vw,20px)',
                  borderRadius:6,
                  border:'1px solid #1a2a33',
                  background:'transparent',
                  color:'#b0bec5',
                  fontSize:'clamp(12px,1.5vw,13px)',
                  fontWeight:600,
                  cursor: isBanning ? 'not-allowed' : 'pointer',
                  opacity: isBanning ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnban}
                disabled={isBanning || unbanConfirmInput !== activePlayer.name}
                style={{
                  padding:'clamp(8px,1.5vw,10px) clamp(16px,2.5vw,20px)',
                  borderRadius:6,
                  border:'none',
                  background: (unbanConfirmInput === activePlayer.name) ? '#558b2f' : '#333',
                  color:'#fff',
                  fontSize:'clamp(12px,1.5vw,13px)',
                  fontWeight:600,
                  cursor: (isBanning || unbanConfirmInput !== activePlayer.name) ? 'not-allowed' : 'pointer',
                  opacity: (isBanning || unbanConfirmInput !== activePlayer.name) ? 0.6 : 1
                }}
              >
                {isBanning ? 'Unbanning...' : 'Confirm Unban'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
