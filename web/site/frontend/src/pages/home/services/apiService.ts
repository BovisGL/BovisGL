const isProduction = import.meta.env.VITE_PRODUCTION === 'true';
const API_BASE = import.meta.env.VITE_API_BASE_URL || (isProduction ? 'https://backend.bovisgl.xyz' : 'http://localhost:3001');

function withAuthHeaders(base?: Record<string, string>) {
  const headers: Record<string, string> = { ...(base || {}) };
  try {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {}
  return headers;
}

async function request(method: 'GET'|'POST'|'PUT'|'DELETE', endpoint: string, body?: any, customHeaders?: Record<string, string>) {
  const headers = withAuthHeaders(method === 'POST' || method === 'PUT' ? { 'Content-Type': 'application/json', ...customHeaders } : customHeaders);
  const url = `${API_BASE}${endpoint}`;
  try {
    const resp = await fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: (method === 'POST' || method === 'PUT') ? JSON.stringify(body ?? {}) : undefined,
    });
    return resp;
  } catch (e) {
    throw e;
  }
}

export const api = {
  get: (endpoint: string, customHeaders?: Record<string, string>) => request('GET', endpoint, undefined, customHeaders),
  post: (endpoint: string, data: any, customHeaders?: Record<string, string>) => request('POST', endpoint, data, customHeaders),
  put: (endpoint: string, data: any) => request('PUT', endpoint, data),
  delete: (endpoint: string) => request('DELETE', endpoint)
};

export default api;
