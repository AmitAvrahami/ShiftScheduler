import axios from 'axios';

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
    register: (data: any) =>
        api.post('/auth/register', data),
    getMe: () =>
        api.get('/auth/me'),
};

export default api;
