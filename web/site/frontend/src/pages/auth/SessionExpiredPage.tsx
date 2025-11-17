import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Session Expired Page
 * Shows when token expires or idle timeout occurs
 */
export const SessionExpiredPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const reason = (location.state as any)?.reason || 'session';

  const handleRefresh = () => {
    // Clear all session data
    localStorage.removeItem('userInfo');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token');
    localStorage.removeItem('sessionExpiryTime');
    localStorage.removeItem('sessionExpiryReadable');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('tokenExpiryReadable');
    
    // Redirect to login
    navigate('/login', { replace: true });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #0a0f14 0%, #1a252f 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: '#0f1419',
        border: '2px solid #4fc3f7',
        borderRadius: 16,
        padding: 'clamp(32px, 5vw, 48px)',
        maxWidth: '90vw',
        width: 'clamp(300px, 100%, 500px)',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(79, 195, 247, 0.2), 0 0 40px rgba(0,0,0,0.8)'
      }}>
        <div style={{
          fontSize: 'clamp(48px, 8vw, 64px)',
          marginBottom: 'clamp(16px, 3vw, 24px)',
          opacity: 0.8
        }}>
          ⏱️
        </div>

        <h1 style={{
          margin: '0 0 clamp(12px, 2vw, 16px)',
          fontSize: 'clamp(24px, 4vw, 32px)',
          color: '#4fc3f7',
          fontWeight: 600,
          letterSpacing: 1
        }}>
          {reason === 'idle' ? 'Session Idle' : 'Session Expired'}
        </h1>

        <p style={{
          margin: '0 0 clamp(24px, 4vw, 32px)',
          fontSize: 'clamp(14px, 2vw, 16px)',
          color: '#b0bec5',
          lineHeight: 1.6,
          opacity: 0.9
        }}>
          {reason === 'idle' 
            ? 'Your session has been inactive for 30 minutes. Please log in again to continue.'
            : 'Your authentication token has expired. Please log in again to continue.'
          }
        </p>

        <div style={{
          display: 'flex',
          gap: 'clamp(12px, 2vw, 16px)',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleRefresh}
            style={{
              padding: 'clamp(12px, 2vw, 16px) clamp(24px, 3vw, 32px)',
              fontSize: 'clamp(14px, 2vw, 16px)',
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              background: '#4fc3f7',
              color: '#000',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              letterSpacing: 0.5,
              boxShadow: '0 4px 16px rgba(79, 195, 247, 0.3)'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#80deea';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(79, 195, 247, 0.5)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#4fc3f7';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(79, 195, 247, 0.3)';
            }}
          >
            ↻ Refresh Page
          </button>
        </div>

        <div style={{
          marginTop: 'clamp(24px, 4vw, 32px)',
          paddingTop: 'clamp(16px, 3vw, 20px)',
          borderTop: '1px solid #1a2a33',
          fontSize: 'clamp(12px, 1.5vw, 13px)',
          color: '#607d8b',
          opacity: 0.7
        }}>
          All websocket connections have been disconnected.
        </div>
      </div>
    </div>
  );
};
