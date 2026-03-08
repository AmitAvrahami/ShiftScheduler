import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Payload shape for saving draft schedule edits */
export interface SaveShiftsPayload {
    shifts: {
        date: string;
        type: 'morning' | 'afternoon' | 'night';
        employees: string[];
    }[];
}

// ─── Axios Instance ───────────────────────────────────────────────────────────

const api = axios.create({
    baseURL: 'http://localhost:5001/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to all requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 errors (token expired)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const authAPI = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),
    register: (data: unknown) =>
        api.post('/auth/register', data),
    getMe: () =>
        api.get('/auth/me'),
};

export const scheduleAPI = {
    generate: (weekId: string) =>
        api.post('/schedules/generate', { weekId }),
    getSchedule: (weekId: string) =>
        api.get(`/schedules/${weekId}`),
    publish: (weekId: string) =>
        api.patch(`/schedules/${weekId}/publish`),
    getMySchedule: (weekId: string) =>
        api.get(`/schedules/${weekId}/my`),
    /** Persists drag-and-drop edits made by the manager. */
    saveShifts: (weekId: string, payload: SaveShiftsPayload) =>
        api.patch(`/schedules/${weekId}/shifts`, payload),
};

export const usersAPI = {
    /** Fetches all active users — manager only. */
    getAll: () => api.get('/users'),
};

export const constraintAPI = {
    /** Returns all employee constraints for a given week — manager only. */
    getWeekConstraints: (weekId: string) =>
        api.get(`/constraints/week/${weekId}`),
};

export const notificationAPI = {
    getAll: () =>
        api.get('/notifications'),
    markAsRead: (id: string) =>
        api.patch(`/notifications/${id}/read`),
};

export default api;
