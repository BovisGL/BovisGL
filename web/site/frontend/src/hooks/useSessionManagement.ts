import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL_MS = 1000; // Check every second

interface SessionState {
  isSessionExpired: boolean;
  isTokenExpired: boolean;
  isIdleTimeout: boolean;
  lastActivityTime: number;
}

/**
 * Hook to manage session state (token expiry, idle timeout)
 * Monitors activity and disconnects websockets on expiry
 */
export function useSessionManagement(onDisconnect?: () => void) {
  const navigate = useNavigate();
  const stateRef = useRef<SessionState>({
    isSessionExpired: false,
    isTokenExpired: false,
    isIdleTimeout: false,
    lastActivityTime: Date.now()
  });
  const checkIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Update last activity time
  const recordActivity = useCallback(() => {
    if (!stateRef.current.isSessionExpired && !stateRef.current.isIdleTimeout) {
      stateRef.current.lastActivityTime = Date.now();
    }
  }, []);

  // Check token expiry
  const checkTokenExpiry = useCallback(async () => {
    try {
      const response = await fetch('/api/locked/auth/verify', {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok && response.status === 401) {
        stateRef.current.isTokenExpired = true;
        stateRef.current.isSessionExpired = true;
        
        // Disconnect websockets
        onDisconnect?.();
        
        // Clear storage
        localStorage.removeItem('userInfo');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token');
        
        // Redirect to login
        navigate('/login', { replace: true });
      }
    } catch (err) {
      console.error('Token expiry check failed:', err);
    }
  }, [navigate, onDisconnect]);

  // Check idle timeout
  const checkIdleTimeout = useCallback(() => {
    const now = Date.now();
    const timeSinceLastActivity = now - stateRef.current.lastActivityTime;

    if (timeSinceLastActivity >= IDLE_TIMEOUT_MS && !stateRef.current.isIdleTimeout) {
      stateRef.current.isIdleTimeout = true;
      stateRef.current.isSessionExpired = true;
      
      // Disconnect websockets
      onDisconnect?.();
      
      // Navigate to idle screen
      navigate('/session-expired', { replace: true, state: { reason: 'idle' } });
    }
  }, [navigate, onDisconnect]);

  // Set up activity listeners
  useEffect(() => {
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
      window.addEventListener(event, recordActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, recordActivity);
      });
    };
  }, [recordActivity]);

  // Set up periodic checks
  useEffect(() => {
    checkIntervalRef.current = setInterval(() => {
      checkTokenExpiry();
      checkIdleTimeout();
    }, CHECK_INTERVAL_MS);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkTokenExpiry, checkIdleTimeout]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, []);

  return {
    isSessionExpired: stateRef.current.isSessionExpired,
    isTokenExpired: stateRef.current.isTokenExpired,
    isIdleTimeout: stateRef.current.isIdleTimeout,
    remainingTime: Math.max(0, IDLE_TIMEOUT_MS - (Date.now() - stateRef.current.lastActivityTime))
  };
}
