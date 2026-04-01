"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { BookOpen, PlusCircle, ArrowRight, X, Layers, LogOut } from 'lucide-react';
import api from '@/lib/api';

export default function ProfessorCourses() {
    const [user, setUser] = useState(null);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ name: '', code: '' });
    const [error, setError] = useState('');
    const router = useRouter();

    // Color palette for course cards
    const cardColors = [
        { bg: 'from-blue-500 to-indigo-600', light: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
        { bg: 'from-emerald-500 to-teal-600', light: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
        { bg: 'from-purple-500 to-violet-600', light: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-200' },
        { bg: 'from-orange-500 to-amber-600', light: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200' },
        { bg: 'from-rose-500 to-pink-600', light: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200' },
        { bg: 'from-cyan-500 to-sky-600', light: 'bg-cyan-50', text: 'text-cyan-700', ring: 'ring-cyan-200' },
    ];

    useEffect(() => {
        const u = Cookies.get('user');
        if (!u) return router.push('/login');
        const parsed = JSON.parse(u);
        if (parsed.role !== 'professor') return router.push('/student/courses');
        setUser(parsed);
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            const { data } = await api.get('/course/my-courses');
            setCourses(data);
        } catch (err) {
            console.error('Failed to fetch courses', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        setCreating(true);
        try {
            await api.post('/course/create', form);
            setForm({ name: '', code: '' });
            setShowModal(false);
            fetchCourses();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create course');
        } finally {
            setCreating(false);
        }
    };

    const handleSelectCourse = (course) => {
        // Store selected course info for the dashboard
        Cookies.set('selectedCourse', JSON.stringify(course), { expires: 1 });
        router.push(`/professor/dashboard?subjectId=${course.id}`);
    };

    const handleLogout = () => {
        Cookies.remove('token');
        Cookies.remove('user');
        Cookies.remove('selectedCourse');
        router.push('/login');
    };

    if (!user || loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm">Loading your courses...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Layers size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">AcadTrack</h1>
                            <p className="text-xs text-slate-400">Professor Portal</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-300 hidden sm:block">Welcome, <span className="font-semibold text-white">{user.name}</span></span>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all duration-200"
                        >
                            <LogOut size={16} />
                            <span className="hidden sm:inline">Log Out</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-6 py-10">
                {/* Title Section */}
                <div className="mb-10">
                    <h2 className="text-3xl font-bold text-white mb-2">My Courses</h2>
                    <p className="text-slate-400">Select a course to manage, or create a new one.</p>
                </div>

                {/* Course Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* Create New Course Card */}
                    <button
                        onClick={() => setShowModal(true)}
                        className="group relative border-2 border-dashed border-slate-600 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:border-blue-500 hover:bg-slate-800/50 transition-all duration-300 min-h-[220px]"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 group-hover:bg-blue-500/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                            <PlusCircle size={32} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
                        </div>
                        <div className="text-center">
                            <p className="text-slate-300 font-semibold group-hover:text-blue-400 transition-colors">Create New Course</p>
                            <p className="text-slate-500 text-sm mt-1">Add a subject to your portfolio</p>
                        </div>
                    </button>

                    {/* Course Cards */}
                    {courses.map((course, index) => {
                        const color = cardColors[index % cardColors.length];
                        return (
                            <button
                                key={course.id}
                                onClick={() => handleSelectCourse(course)}
                                className={`group relative bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 text-left hover:ring-2 ${color.ring} hover:border-transparent transition-all duration-300 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-1 min-h-[220px] flex flex-col`}
                            >
                                {/* Gradient Top Bar */}
                                <div className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl bg-gradient-to-r ${color.bg}`}></div>

                                {/* Course Icon */}
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color.bg} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                    <BookOpen size={22} className="text-white" />
                                </div>

                                {/* Course Info */}
                                <div className="flex-1">
                                    <p className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${color.light} ${color.text} mb-3`}>
                                        {course.code}
                                    </p>
                                    <h3 className="text-lg font-bold text-white group-hover:text-slate-100 leading-tight">
                                        {course.name}
                                    </h3>
                                </div>

                                {/* Arrow */}
                                <div className="flex items-center justify-end mt-4 pt-4 border-t border-slate-700/50">
                                    <span className="text-sm text-slate-500 group-hover:text-slate-300 mr-2 transition-colors">Open Dashboard</span>
                                    <ArrowRight size={16} className="text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Empty State */}
                {courses.length === 0 && (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-6">
                            <BookOpen size={36} className="text-slate-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-300 mb-2">No courses yet</h3>
                        <p className="text-slate-500 max-w-md mx-auto">Get started by creating your first course. You can manage attendance, quizzes, and marks for each course.</p>
                    </div>
                )}
            </main>

            {/* Create Course Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>

                    {/* Modal */}
                    <div className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-0 animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-700">
                            <div>
                                <h3 className="text-xl font-bold text-white">Create New Course</h3>
                                <p className="text-sm text-slate-400 mt-1">Add a new subject to teach</p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleCreate} className="p-6 space-y-5">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Course Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Data Structures and Algorithms"
                                    className="w-full bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Course Code</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. CS201"
                                    className="w-full bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-3 rounded-xl text-slate-300 bg-slate-700 hover:bg-slate-600 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 px-4 py-3 rounded-xl text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 font-semibold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {creating ? 'Creating...' : 'Create Course'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
