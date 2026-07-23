"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function Register() {
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', role: 'student',
        roll_no: '', department: '', semester: ''
    });
    const [error, setError] = useState('');
    const router = useRouter();

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            await api.post('/auth/register', formData);
            router.push('/login');
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
            <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">Register for AcadTrack</h2>
                {error && <div className="bg-red-50 text-red-500 p-3 rounded mb-4 text-center">{error}</div>}
                
                <form onSubmit={handleRegister} className="space-y-4">
                    <input name="name" placeholder="Full Name" required className="w-full p-3 border rounded-lg outline-none" onChange={handleChange} />
                    <input name="email" type="email" placeholder="Email" required className="w-full p-3 border rounded-lg outline-none" onChange={handleChange} />
                    <input name="password" type="password" placeholder="Password" required className="w-full p-3 border rounded-lg outline-none" onChange={handleChange} />
                    
                    <select name="role" className="w-full p-3 border rounded-lg outline-none" onChange={handleChange}>
                        <option value="student">Student</option>
                        <option value="professor">Professor</option>
                        <option value="admin">Admin</option>
                    </select>

                    <input name="department" placeholder="Department (e.g., CS)" required className="w-full p-3 border rounded-lg outline-none" onChange={handleChange} />

                    {formData.role === 'student' && (
                        <>
                            <input name="roll_no" placeholder="Roll No" required className="w-full p-3 border rounded-lg outline-none" onChange={handleChange} />
                            <input name="semester" type="number" placeholder="Semester (e.g., 3)" required className="w-full p-3 border rounded-lg outline-none" onChange={handleChange} />
                        </>
                    )}

                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">
                        Register
                    </button>
                </form>
                <div className="mt-6 text-center text-sm text-gray-600">
                    Already have an account? <a href="/login" className="text-blue-600 hover:underline">Log In</a>
                </div>
            </div>
        </div>
    );
}
