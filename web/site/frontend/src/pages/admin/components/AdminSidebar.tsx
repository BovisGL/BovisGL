/**
 * AdminSidebar Component
 * 
 * Resizable sidebar (340-640px desktop, full-screen overlay mobile).
 * Navigation buttons matching old frontend:
 * - Home, Manage Players, Add Admin, Test Servers, Admin Logs, Sign Out
 * Mobile: overlay with slide-in animation.
 * Test mode: Shows "Main Server" button instead of "Test Servers" to return.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminSidebar.css';

interface AdminSidebarProps {
  onLogout: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  isTestMode?: boolean;
  onToggleTestMode?: () => void;
}

export const AdminSidebar = ({ onLogout, mobileOpen, onMobileClose, isTestMode = false, onToggleTestMode }: AdminSidebarProps) => {
  const [width, setWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);
  const navigate = useNavigate();

  const MIN_WIDTH = 340;
  const MAX_WIDTH = 640;

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH);
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const buttons = [
    { label: '🏠 Home', action: () => { navigate('/'); onMobileClose(); }, color: 'blue' },
    { label: '🧑‍💻 Manage Players', action: () => { navigate('/playermanger'); onMobileClose(); }, color: 'green' },
    { label: '👤 Add Admin', action: () => { /* TODO: show modal */ onMobileClose(); }, color: 'purple' },
    { 
      label: isTestMode ? '🚪 Main Server' : '🧪 Test Servers', 
      action: () => { onToggleTestMode?.(); onMobileClose(); }, 
      color: isTestMode ? 'red' : 'teal' 
    },
    { label: '📋 Admin Logs', action: () => { /* TODO: show modal */ onMobileClose(); }, color: 'orange' },
    { label: '🚪 Sign Out', action: () => { onLogout(); onMobileClose(); }, color: 'red' }
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={onMobileClose} />
      )}

      <aside
        className={`admin-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
        style={{ '--sidebar-width': `${width}px` } as any}
      >
        <div className="sidebar-header">
          <h3 style={{ margin: 0 }}>Admin</h3>
          <button className="mobile-close" onClick={onMobileClose}>
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {buttons.map((button) => (
            <button
              key={button.label}
              className={`sidebar-button ${button.color}`}
              onClick={button.action}
            >
              {button.label}
            </button>
          ))}
        </nav>

        <div
          className="resize-handle"
          onMouseDown={startResize}
        />
      </aside>
    </>
  );
};
