/**
 * useServerStatus Hook
 * 
 * Polls server status every 5 seconds.
 * Returns loading state and error handling.
 */

import { useState, useEffect } from 'react';
import { api } from '../services/apiService';

export interface ServerInfo {
  id: string;
  name: string;
  color: string;
  status: 'online' | 'offline' | 'starting' | 'stopping';
  playerCount?: number;
  maxPlayers?: number;
  version?: string;
  uptime?: number;
}

export interface UseServerStatusReturn {
  servers: ServerInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export const useServerStatus = (): UseServerStatusReturn => {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = async () => {
    try {
      const response = await api.get('/api/public/servers/status');
      
      if (!response.ok) {
        throw new Error('Failed to fetch servers');
      }
      
      const data = await response.json();
      
      // Transform backend response (object with server names as keys) to array format
      const serverArray: ServerInfo[] = Object.entries(data).map(([key, value]: [string, any]) => ({
        id: key,
        name: value.name || key,
        color: value.color || '#4f8cff',
        status: (value.currentStatus || 'offline') as 'online' | 'offline' | 'starting' | 'stopping',
        playerCount: value.playerCount || 0,
        maxPlayers: value.maxPlayers || 0,
        version: value.version,
        uptime: value.uptime,
      }));
      
      setServers(serverArray);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load servers');
      console.error('Failed to fetch servers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
    
    // Poll every 5 seconds
    const interval = setInterval(fetchServers, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    servers,
    loading,
    error,
    refresh: fetchServers
  };
};
