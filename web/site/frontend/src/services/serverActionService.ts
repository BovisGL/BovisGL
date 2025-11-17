/**
 * Server Action Service
 * 
 * Shared state management for server actions across multiple ServerCard instances.
 * Uses subscription pattern to notify all cards when actions occur.
 */

import { api } from './apiService';

export interface PendingAction {
  type: 'starting' | 'stopping';
  startedAt: number;
}

type Subscriber = (action: PendingAction | null) => void;

class ServerActionService {
  private pendingActions: Map<string, PendingAction> = new Map();
  private subscribers: Map<string, Set<Subscriber>> = new Map();

  /**
   * Subscribe to pending action updates for a specific server
   */
  subscribe(serverId: string, callback: Subscriber): () => void {
    if (!this.subscribers.has(serverId)) {
      this.subscribers.set(serverId, new Set());
    }
    
    this.subscribers.get(serverId)!.add(callback);
    
    // Immediately notify with current state
    callback(this.pendingActions.get(serverId) || null);
    
    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(serverId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(serverId);
        }
      }
    };
  }

  /**
   * Notify all subscribers for a server
   */
  private notify(serverId: string) {
    const action = this.pendingActions.get(serverId) || null;
    const subs = this.subscribers.get(serverId);
    
    if (subs) {
      subs.forEach(callback => callback(action));
    }
  }

  /**
   * Set pending action for a server
   */
  private setPendingAction(serverId: string, action: PendingAction | null) {
    if (action) {
      this.pendingActions.set(serverId, action);
    } else {
      this.pendingActions.delete(serverId);
    }
    this.notify(serverId);
  }

  /**
   * Check if status changed and clear pending action
   */
  checkAndClearPendingAction(serverId: string, currentStatus: string) {
    const pending = this.pendingActions.get(serverId);
    
    if (!pending) return;
    
    // Clear pending action if server reached target status
    if (
      (pending.type === 'starting' && currentStatus === 'online') ||
      (pending.type === 'stopping' && currentStatus === 'offline')
    ) {
      this.setPendingAction(serverId, null);
    }
    
    // Clear if pending too long (timeout after 5 minutes)
    if (Date.now() - pending.startedAt > 5 * 60 * 1000) {
      this.setPendingAction(serverId, null);
    }
  }

  /**
   * Start a server
   */
  async startServer(
    serverId: string,
    currentStatus: string,
    csrfToken: string
  ): Promise<{ success: boolean; error?: string }> {
    // Prevent duplicate starts
    if (this.pendingActions.has(serverId)) {
      return { success: false, error: 'Action already in progress' };
    }
    
    if (currentStatus !== 'offline') {
      return { success: false, error: 'Server must be offline to start' };
    }
    
    try {
      // Set pending action
      this.setPendingAction(serverId, {
        type: 'starting',
        startedAt: Date.now()
      });
      
      // Call API
      const response = await api.post(`/api/locked/servers/${serverId}/start`, {}, {
        headers: { 'X-CSRF-Token': csrfToken }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        this.setPendingAction(serverId, null);
        return { success: false, error: errorData.error || 'Failed to start server' };
      }
      
      return { success: true };
    } catch (error: any) {
      this.setPendingAction(serverId, null);
      return { success: false, error: error.message || 'Network error' };
    }
  }

  /**
   * Stop a server
   */
  async stopServer(
    serverId: string,
    currentStatus: string,
    csrfToken: string
  ): Promise<{ success: boolean; error?: string }> {
    // Prevent duplicate stops
    if (this.pendingActions.has(serverId)) {
      return { success: false, error: 'Action already in progress' };
    }
    
    if (currentStatus !== 'online') {
      return { success: false, error: 'Server must be online to stop' };
    }
    
    try {
      // Set pending action
      this.setPendingAction(serverId, {
        type: 'stopping',
        startedAt: Date.now()
      });
      
      // Call API
      const response = await api.post(`/api/locked/servers/${serverId}/stop`, {}, {
        headers: { 'X-CSRF-Token': csrfToken }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        this.setPendingAction(serverId, null);
        return { success: false, error: errorData.error || 'Failed to stop server' };
      }
      
      return { success: true };
    } catch (error: any) {
      this.setPendingAction(serverId, null);
      return { success: false, error: error.message || 'Network error' };
    }
  }
}

export const serverActionService = new ServerActionService();
