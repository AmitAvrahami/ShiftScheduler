import { create } from 'zustand';
import { authAPI } from '../lib/api';

interface User {
    _id: string;
    name: string;
    email: string;
    role: 'manager' | 'employee';
    isFixedMorning?: boolean;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (email: string, password: string) => Promise<void>;
    register: (data: any) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: localStorage.getItem('token'),
    isAuthenticated: false,
    isLoading: !!localStorage.getItem('token'),
    error: null,

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const response = await authAPI.login(email, password);
            const { user, token } = response.data;

            localStorage.setItem('token', token);
            set({ user, token, isAuthenticated: true, isLoading: false });
            console.log('✅ User logged in:', user.email);
        } catch (error: any) {
            set({
                error: error.response?.data?.message || 'שגיאה בהתחברות',
                isLoading: false
            });
            throw error;
        }
    },

    register: async (data) => {
        set({ isLoading: true, error: null });
        try {
            const response = await authAPI.register(data);
            const { user, token } = response.data;

            localStorage.setItem('token', token);
            set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || 'שגיאה ברישום',
                isLoading: false
            });
            throw error;
        }
    },

    logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false });
    },

    checkAuth: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            set({ isAuthenticated: false });
            return;
        }

        set({ isLoading: true });
        try {
            const response = await authAPI.getMe();
            set({
                user: response.data,
                isAuthenticated: true,
                isLoading: false
            });
        } catch (error) {
            localStorage.removeItem('token');
            set({
                user: null,
                token: null,
                isAuthenticated: false,
                isLoading: false
            });
        }
    },

    clearError: () => set({ error: null }),
}));
