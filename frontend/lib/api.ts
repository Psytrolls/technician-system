const API_BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `שגיאה ${res.status}`);
  }
  return data;
}

// Auth
export const api = {
  auth: {
    login: (username: string, password: string) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    me: () => request('/auth/me'),
    changePassword: (currentPassword: string, newPassword: string) =>
      request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  },

  users: {
    list: () => request('/users'),
    get: (id: number) => request(`/users/${id}`),
    create: (data: object) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: object) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/users/${id}`, { method: 'DELETE' }),
  },

  tasks: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request(`/tasks${qs}`);
    },
    get: (id: number) => request(`/tasks/${id}`),
    create: (data: object) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: object) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/tasks/${id}`, { method: 'DELETE' }),
    history: (id: number) => request(`/tasks/${id}/history`),
  },

  timelogs: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request(`/timelogs${qs}`);
    },
    active: () => request('/timelogs/active'),
    start: (data: object) => request('/timelogs', { method: 'POST', body: JSON.stringify(data) }),
    stop: (id: number, data?: object) =>
      request(`/timelogs/${id}/stop`, { method: 'PUT', body: JSON.stringify(data || {}) }),
    update: (id: number, data: object) =>
      request(`/timelogs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/timelogs/${id}`, { method: 'DELETE' }),
  },

  reports: {
    summary: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request(`/reports/summary${qs}`);
    },
    export: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request(`/reports/export${qs}`);
    },
  },

  equipment: {
    list: (activeOnly = true) =>
      request(`/equipment${activeOnly ? '' : '?active=all'}`),
    create: (data: object) =>
      request('/equipment', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: object) =>
      request(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request(`/equipment/${id}`, { method: 'DELETE' }),
    stats: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request(`/equipment/stats${qs}`);
    },
  },

  operators: {
    list: (activeOnly = true) =>
      request(`/operators${activeOnly ? '' : '?active=all'}`),
    create: (data: object) =>
      request('/operators', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: object) =>
      request(`/operators/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request(`/operators/${id}`, { method: 'DELETE' }),
  },

  notifications: {
    list: () => request('/notifications'),
    readAll: () => request('/notifications/read-all', { method: 'POST' }),
    read: (id: number) => request(`/notifications/${id}/read`, { method: 'POST' }),
  },
};
