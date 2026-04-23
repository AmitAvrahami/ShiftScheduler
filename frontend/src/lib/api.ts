import type { AuthResponse, User } from '../types/auth';

const BASE = '/api/v1';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Request failed');
  return data as T;
}

export const authApi = {
  login(body: { email: string; password: string }): Promise<AuthResponse> {
    return request('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  },

  me(): Promise<{ success: boolean; user: User }> {
    return request('/auth/me');
  },
};

export const userApi = {
  createUser(body: {
    name: string;
    email: string;
    password: string;
    role?: string;
    isFixedMorningEmployee?: boolean;
  }): Promise<{ success: boolean; user: User }> {
    return request('/auth/register', { method: 'POST', body: JSON.stringify(body) });
  },

  getUsers(): Promise<{ success: boolean; users: User[] }> {
    return request('/users');
  },

  setStatus(id: string, isActive: boolean): Promise<{ success: boolean; user: User }> {
    return request(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
  },

  setFixedMorning(
    id: string,
    isFixedMorningEmployee: boolean
  ): Promise<{ success: boolean; user: User }> {
    return request(`/users/${id}/fixed-morning`, {
      method: 'PATCH',
      body: JSON.stringify({ isFixedMorningEmployee }),
    });
  },
};
