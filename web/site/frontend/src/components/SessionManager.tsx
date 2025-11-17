import React from 'react';
import { useSessionManagement } from '../hooks/useSessionManagement';

/**
 * SessionManager Component
 * Wraps the app to manage session state (token expiry, idle timeout)
 * Monitors activity and disconnects websockets on expiry
 */
export const SessionManager: React.FC = () => {
  const handleDisconnect = () => {
    // Close any open WebSocket connections
    if (typeof window !== 'undefined' && (window as any).__websockets) {
      Object.values((window as any).__websockets as any).forEach((ws: any) => {
        try {
          if (ws && ws.close) {
            ws.close();
          }
        } catch (err) {
          console.error('Failed to close websocket:', err);
        }
      });
    }
    
    // Also close any fetch/XHR requests by triggering storage event
    // This helps signal other components to disconnect
    try {
      localStorage.setItem('__session_disconnect', Date.now().toString());
      localStorage.removeItem('__session_disconnect');
    } catch (err) {
      console.error('Failed to signal disconnect:', err);
    }
  };

  // Use session management hook
  useSessionManagement(handleDisconnect);

  // This component doesn't render anything
  return null;
};
