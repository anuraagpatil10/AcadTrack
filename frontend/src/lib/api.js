import axios from 'axios';
import { clearSession, getStoredToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use((config) => {
    const token = getStoredToken();
    console.log('[api] request', {
        method: config.method,
        url: config.url,
        hasToken: Boolean(token),
        path: typeof window !== 'undefined' ? window.location.pathname : 'server',
    });
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.log('[api] response_error', {
            url: error?.config?.url,
            method: error?.config?.method,
            status: error?.response?.status,
            data: error?.response?.data,
            path: typeof window !== 'undefined' ? window.location.pathname : 'server',
        });
        if (error?.response?.status === 401) {
            clearSession();
        }

        return Promise.reject(error);
    }
);

export default api;
