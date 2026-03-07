import { useAuthStore } from '../store/authStore';

export function useAuth() {
    const { user, token, logout } = useAuthStore();

    return {
        user,
        token,
        isAuthenticated: !!token,
        isManager: user?.role === 'manager',
        logout,
    };
}
