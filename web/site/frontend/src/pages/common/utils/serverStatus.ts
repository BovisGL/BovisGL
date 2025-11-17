/**
 * Server status checking utilities
 * Used across home and admin pages
 */

/**
 * Server status interface
 */
export interface ServerStatus {
  hub: boolean;
  anarchy: boolean;
  proxy: boolean;
  [key: string]: boolean;
}

/**
 * Fetch server status from API
 * @param apiService - API service instance
 * @returns Promise<ServerStatus> - Server status object
 */
export async function fetchServerStatus(apiService: any): Promise<ServerStatus> {
  try {
    const response = await apiService.get('/api/public/servers/status');
    if (!response.ok) {
      console.error('Failed to fetch server status');
      return { hub: false, anarchy: false, proxy: false };
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching server status:', error);
    return { hub: false, anarchy: false, proxy: false };
  }
}

/**
 * Get status text for a server
 * @param online - Whether server is online
 * @returns Status text string
 */
export function getServerStatusText(online: boolean): string {
  return online ? 'Online' : 'Offline';
}

/**
 * Get status class for a server
 * @param online - Whether server is online
 * @returns CSS class name
 */
export function getServerStatusClass(online: boolean): string {
  return online ? 'status-online' : 'status-offline';
}
