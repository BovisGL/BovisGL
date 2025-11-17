/**
 * useServerActions Hook
 * 
 * Manages server start/stop actions with shared state across all cards.
 * Uses serverActionService for cross-component synchronization.
 */

import { useState, useEffect, useCallback } from 'react';
import { serverActionService, PendingAction } from '../services/serverActionService';

export interface UseServerActionsReturn {
  pendingAction: PendingAction | null;
  startServer: () => Promise<{ success: boolean; error?: string }>;
  stopServer: () => Promise<{ success: boolean; error?: string }>;
}

export const useServerActions = (
  serverId: string,
  currentStatus: string,
  csrfToken: string
): UseServerActionsReturn => {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Subscribe to pending action updates
  useEffect(() => {
    const unsubscribe = serverActionService.subscribe(serverId, (action) => {
      setPendingAction(action);
    });

    return unsubscribe;
  }, [serverId]);

  // Check if pending action should be cleared based on status change
  useEffect(() => {
    serverActionService.checkAndClearPendingAction(serverId, currentStatus);
  }, [serverId, currentStatus]);

  const startServer = useCallback(async () => {
    return serverActionService.startServer(serverId, currentStatus, csrfToken);
  }, [serverId, currentStatus, csrfToken]);

  const stopServer = useCallback(async () => {
    return serverActionService.stopServer(serverId, currentStatus, csrfToken);
  }, [serverId, currentStatus, csrfToken]);

  return {
    pendingAction,
    startServer,
    stopServer
  };
};
