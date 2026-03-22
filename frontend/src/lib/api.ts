import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PartialAssignment {
    employeeId: string;
    employeeName: string;
    dateKey: string;
    shiftType: 'morning' | 'afternoon' | 'night';
    gapDescription: string;
    action: 'cover_start' | 'cover_end';
    missingMinutes: number;
}

export interface CriticalViolation {
    dateKey: string;
    shiftType: 'morning' | 'afternoon' | 'night';
    filled: number;
    required: number;
    missing: number;
    /** Set when the slot is unfilled because all eligible employees hit the 6-shift cap */
    reason?: 'capacity_limit';
}

export interface SequenceWarning {
    employeeName: string;
    employeeId: string;
    fromShift: 'morning' | 'afternoon' | 'night';
    fromDate: string;
    toShift: 'morning' | 'afternoon' | 'night';
    toDate: string;
    /** Minimum rest between the two shifts, in hours */
    restHours: number;
}

export interface FairnessWarning {
    employeeName: string;
    employeeId: string;
    metric: 'nightShifts' | 'weekendShifts';
    employeeCount: number;
    averageCount: number;
    deviationPercent: number;
}

export interface ConstraintViolationReport {
    criticalViolations: CriticalViolation[];
    softWarnings: PartialAssignment[];
    /** Tight turnaround warnings (e.g. afternoon → next-day morning = 8h rest) */
    sequenceWarnings: SequenceWarning[];
    /** Employees with >30% more night or weekend shifts than average */
    fairnessWarnings: FairnessWarning[];
    totalViolations: number;
}

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
    /** Deletes a schedule (current/future weeks only) and notifies all employees. */
    deleteSchedule: (weekId: string) =>
        api.delete(`/schedules/${weekId}`),
};

export const usersAPI = {
    /** Fetches all active users — manager only. Used by schedule/constraint pages. */
    getAll: () => api.get('/users'),
    /** Fetches ALL users including inactive — manager only. For employee management page. */
    getAllForManagement: () => api.get('/users/all'),
    /** Creates a new employee — manager only. */
    create: (data: { name: string; email: string; password: string; role?: string; isFixedMorning?: boolean }) =>
        api.post('/users', data),
    /** Updates an employee's details — manager only. Password is optional (omit to keep unchanged). */
    update: (id: string, data: { name?: string; email?: string; password?: string; role?: string; isFixedMorning?: boolean; isActive?: boolean }) =>
        api.patch(`/users/${id}`, data),
    /** Soft-deletes an employee (sets isActive: false) — manager only. */
    deactivate: (id: string) => api.delete(`/users/${id}`),
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

export const adminAPI = {
    getStats: () =>
        api.get('/admin/stats'),
    getAllUsers: () =>
        api.get('/admin/users'),
    createUser: (data: {
        name: string;
        email: string;
        password: string;
        role: 'employee' | 'manager' | 'admin';
        isFixedMorning?: boolean;
        isActive?: boolean;
    }) => api.post('/admin/users', data),
    updateUser: (id: string, data: {
        name?: string;
        email?: string;
        password?: string;
        role?: 'employee' | 'manager' | 'admin';
        isFixedMorning?: boolean;
        isActive?: boolean;
    }) => api.patch(`/admin/users/${id}`, data),
    deleteUser: (id: string, hard = false) =>
        api.delete(`/admin/users/${id}${hard ? '?hard=true' : ''}`),
    getAllConstraints: (weekId?: string) =>
        api.get('/admin/constraints', { params: weekId ? { weekId } : {} }),
    overrideConstraint: (
        userId: string,
        weekId: string,
        constraints: Array<{
            date: string;
            shift: 'morning' | 'afternoon' | 'night';
            canWork: boolean;
            availableFrom?: string | null;
            availableTo?: string | null;
        }>
    ) => api.patch(`/admin/constraints/${userId}/${weekId}`, { constraints }),
    copyConstraintsFromPreviousWeek: (fromWeekId: string, toWeekId: string) =>
        api.post('/constraints/copy-week', { fromWeekId, toWeekId }),
    getAllSchedules: () =>
        api.get('/admin/schedules'),
    forceDeleteSchedule: (weekId: string) =>
        api.delete(`/admin/schedules/${weekId}`),
};

export default api;
