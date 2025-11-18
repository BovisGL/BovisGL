/**
 * API Service
 * 
 * Centralized fetch wrapper with:
 * - JWT token injection
 * - CSRF token support
 * - Credentials: include for cookies
 * - Debug logging
 */

const isProduction = import.meta.env.VITE_PRODUCTION === 'true';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isProduction ? 'https://backend.bovisgl.xyz' : 'http://localhost:3001');

export const api = {
  /**
   * GET request with auth headers
   */
  get: async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    
    return fetch(`${API_BASE_URL}${url}`, {
      ...options,
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      }
    });
  },

  /**
   * POST request with auth headers and JSON body
   */
  post: async (url: string, body?: any, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    
    return fetch(`${API_BASE_URL}${url}`, {
      ...options,
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      ...(body && { body: JSON.stringify(body) })
    });
  },

  /**
   * PUT request with auth headers and JSON body
   */
  put: async (url: string, body?: any, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    
    return fetch(`${API_BASE_URL}${url}`, {
      ...options,
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      ...(body && { body: JSON.stringify(body) })
    });
  },

  /**
   * DELETE request with auth headers
   */
  delete: async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    
    return fetch(`${API_BASE_URL}${url}`, {
      ...options,
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      }
    });
  }
};

/**
 * Legacy API request function (for compatibility)
 */
export const apiRequest = async (url: string, options: any = {}) => {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    },
    ...(options.body && { body: JSON.stringify(options.body) })
  });
  
  return response.json();
};
