"use client";

import { useState } from 'react';
import api from '@/lib/api';
import { getStoredToken, getStoredUser, setSession } from '@/lib/auth';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const { data } = await api.post('/auth/login', { email, password });
            console.log('[login] success_response', {
                role: data?.user?.role,
                role_id: data?.user?.role_id,
                hasToken: Boolean(data?.token),
            });

            if (!data?.token || !data?.user?.role) {
                throw new Error('Invalid login response from server');
            }

            setSession(data.token, data.user);

            const savedToken = getStoredToken();
            const savedUser = getStoredUser();

            if (!savedToken || !savedUser) {
                throw new Error('Session could not be stored in browser cookies');
            }

            const destination = data.user.role === 'student'
                ? '/student/courses'
                : data.user.role === 'admin'
                    ? '/admin/dashboard'
                    : '/professor/courses';

            console.log('[login] redirecting', { destination });
            window.location.assign(destination);
        } catch (err) {
            console.error('Login failed', {
                message: err.message,
                status: err.response?.status,
                data: err.response?.data,
            });
            setError(
                err.response?.data?.error ||
                err.response?.data?.message ||
                `${err.message || 'Login failed'}${err.response?.status ? ` (status ${err.response.status})` : ''}`
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">AcadTrack</h2>
                {error && <div className="bg-red-50 text-red-500 p-3 rounded mb-4 text-center">{error}</div>}
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full mt-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full mt-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Logging In...' : 'Log In'}
                    </button>
                </form>
                <div className="mt-6 text-center text-sm text-gray-600">
                    Don't have an account? <a href="/register" className="text-blue-600 hover:underline">Register</a>
                </div>
            </div>
        </div>
    );
}
