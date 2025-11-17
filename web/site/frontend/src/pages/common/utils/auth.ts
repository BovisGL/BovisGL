/**
 * Authentication and session management utilities
 * Used across home, admin, and protected pages
 */

/**
 * Check if user is authenticated
 * @returns Promise<boolean> indicating authentication status
 */
export async function checkAuthentication(apiService?: any): Promise<boolean> {
  try {
    if (!apiService) {
      console.error('API service not provided');
      return false;
    }
    const response = await apiService.get('/api/locked/auth/verify');
    return response.ok;
  } catch (error) {
    console.error('Authentication check failed:', error);
    return false;
  }
}

/**
 * Clear all authentication-related data from localStorage
 */
export function clearAuthData(): void {
  localStorage.removeItem('userInfo');
  localStorage.removeItem('sessionExpiryTime');
  localStorage.removeItem('sessionExpiryReadable');
  localStorage.removeItem('token');
  localStorage.removeItem('tokenExpiry');
  localStorage.removeItem('tokenExpiryReadable');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_expiry');
}

/**
 * Get stored auth token
 * @returns Auth token or null if not found
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || localStorage.getItem('token');
}

/**
 * Check if auth token is expired
 * @returns true if token is expired or not found
 */
export function isTokenExpired(): boolean {
  const expiry = localStorage.getItem('auth_expiry') || localStorage.getItem('tokenExpiry');
  if (!expiry) return true;
  
  const expiryTime = parseInt(expiry, 10);
  if (isNaN(expiryTime)) return true;
  
  return Date.now() > expiryTime;
}

/**
 * Get user info from localStorage
 * @returns User info object or null
 */
export function getUserInfo(): any | null {
  const userInfo = localStorage.getItem('userInfo');
  if (!userInfo) return null;
  
  try {
    return JSON.parse(userInfo);
  } catch (error) {
    console.error('Failed to parse user info:', error);
    return null;
  }
}

/**
 * Store user info in localStorage
 * @param userInfo - User information object
 */
export function setUserInfo(userInfo: any): void {
  localStorage.setItem('userInfo', JSON.stringify(userInfo));
}

/**
 * Handle authentication state change
 * Clears localStorage when transitioning from authenticated to unauthenticated
 * @param wasAuthenticated - Previous authentication state
 * @param isNowAuthenticated - Current authentication state
 */
export function handleAuthStateChange(wasAuthenticated: boolean, isNowAuthenticated: boolean): void {
  if (wasAuthenticated && !isNowAuthenticated) {
    clearAuthData();
  }
}
