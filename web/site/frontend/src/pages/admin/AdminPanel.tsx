/**
 * AdminPanel Component
 * 
 * Main admin dashboard with sidebar and server grid.
 * Manages CSRF token, server status, modals, and logout.
 * Matches old frontend structure with navigation, server cards, and modals.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from './components/AdminSidebar';
import { ServerCard } from './components/ServerCard';
import { useServerStatus } from '../../hooks/useServerStatus';
import { api } from '../../services/apiService';
import { websocketService } from '../../services/websocketService';
import './AdminPanel.css';

export const AdminPanel = () => {
  const [csrfToken, setCsrfToken] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const { servers, loading, error, refresh } = useServerStatus();
  const navigate = useNavigate();

  // Track mobile changes
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch CSRF token on mount
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await api.get('/api/public/csrf-token');
        
        if (response.ok) {
          const data = await response.json();
          setCsrfToken(data.token || data.csrfToken);
        }
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
      }
    };

    fetchCsrfToken();
  }, []);

  // Connect WebSocket on mount
  useEffect(() => {
    websocketService.connect();

    return () => {
      websocketService.disconnect();
    };
  }, []);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      await api.post('/api/public/auth/logout', {}, {
        headers: { 'X-CSRF-Token': csrfToken }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    localStorage.removeItem('auth_token');
    navigate('/login');
  };

  // Sort servers: active first, then disabled (arena, civilization, parkour)
  const disabledServers = new Set(['arena', 'civilization', 'parkour']);
  
  const sortedServers = [...servers].sort((a, b) => {
    const aDisabled = disabledServers.has(a.id) ? 1 : 0;
    const bDisabled = disabledServers.has(b.id) ? 1 : 0;
    if (aDisabled !== bDisabled) return aDisabled - bDisabled;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="admin-panel-container">
      {/* Mobile menu toggle button */}
      {isMobile && (
        <button
          className="admin-toggle-button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
      )}

      <AdminSidebar
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main className="admin-content">
        <h1 className="admin-title">BovisGL Admin Panel</h1>

        {loading && (
          <div className="loading-state">
            <div className="spinner-large"></div>
            <p>Loading servers...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p>{error}</p>
            <button onClick={refresh}>Retry</button>
          </div>
        )}

        {!loading && !error && (
          <div className="card-grid">
            {sortedServers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                csrfToken={csrfToken}
                isDisabled={disabledServers.has(server.id)}
                onRefresh={refresh}
              />
            ))}
          </div>
        )}
      </main>

      {/* Logout confirmation modal */}
      {showLogoutModal && (
        <div className="modal-backdrop" onClick={() => setShowLogoutModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Logout</h3>
            <p>Sign out of the admin session?</p>
            <div className="modal-actions">
              <button
                className="modal-button cancel"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                className="modal-button confirm"
                onClick={confirmLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
