"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ArrowRight, Layers, LogOut, GraduationCap, ChevronDown, Filter, Camera } from 'lucide-react';
import api from '@/lib/api';
import { clearSession, getStoredToken, getStoredUser, setSelectedCourse } from '@/lib/auth';
import FaceRegistration from '@/components/FaceRegistration';

export default function StudentCourses() {
    const [user, setUser] = useState(null);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSemester, setSelectedSemester] = useState('all');
    const [showFaceRegistration, setShowFaceRegistration] = useState(false);
    const router = useRouter();

    const cardColors = [
        { bg: 'from-blue-500 to-indigo-600', light: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200', shadow: 'shadow-blue-500/10' },
        { bg: 'from-emerald-500 to-teal-600', light: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', shadow: 'shadow-emerald-500/10' },
        { bg: 'from-purple-500 to-violet-600', light: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-200', shadow: 'shadow-purple-500/10' },
        { bg: 'from-orange-500 to-amber-600', light: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200', shadow: 'shadow-orange-500/10' },
        { bg: 'from-rose-500 to-pink-600', light: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200', shadow: 'shadow-rose-500/10' },
        { bg: 'from-cyan-500 to-sky-600', light: 'bg-cyan-50', text: 'text-cyan-700', ring: 'ring-cyan-200', shadow: 'shadow-cyan-500/10' },
    ];

    useEffect(() => {
        const u = getStoredUser();
        const token = getStoredToken();
        console.log('[student/courses] guard', {
            hasUser: Boolean(u),
            hasToken: Boolean(token),
            path: typeof window !== 'undefined' ? window.location.pathname : 'server',
        });
        if (!u || !token) {
            clearSession();
            return router.push('/login');
        }
        const parsed = JSON.parse(u);
        console.log('[student/courses] parsed_user', parsed);
        if (parsed.role !== 'student') return router.push('/professor/courses');
        setUser(parsed);
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            const { data } = await api.get('/course/my-enrolled-courses');
            console.log('[student/courses] fetchCourses:success', data);
            setCourses(data);
        } catch (err) {
            console.error('Failed to fetch courses', err);
            if (err?.response?.status === 401) {
                return;
            }
        } finally {
            setLoading(false);
        }
    };

    // Extract unique semesters from courses
    const semesters = useMemo(() => {
        const semMap = new Map();
        courses.forEach((course) => {
            if (course.semester_id) {
                const key = String(course.semester_id);
                if (!semMap.has(key)) {
                    semMap.set(key, {
                        id: course.semester_id,
                        name: course.semester_name,
                        department: course.department,
                        semester_no: course.semester_no,
                    });
                }
            }
        });
        // Sort by semester_no
        return Array.from(semMap.values()).sort((a, b) => (a.semester_no || 0) - (b.semester_no || 0));
    }, [courses]);

    // Filter courses by selected semester
    const filteredCourses = useMemo(() => {
        if (selectedSemester === 'all') return courses;
        return courses.filter((course) => String(course.semester_id) === String(selectedSemester));
    }, [courses, selectedSemester]);

    const handleSelectCourse = (course) => {
        setSelectedCourse(course);
        router.push(`/student/dashboard?subjectId=${course.id}`);
    };

    const handleLogout = () => {
        clearSession();
        router.push('/login');
    };

    if (!user || loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
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
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Layers size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">AcadTrack</h1>
                            <p className="text-xs text-slate-400">Student Portal</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/student/registration')}
                            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm text-emerald-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all duration-200"
                        >
                            Semester Registration
                        </button>
                        <button
                            onClick={() => router.push('/student/gradesheets')}
                            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm text-blue-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all duration-200"
                        >
                            Grade Sheets
                        </button>
                        <button
                            onClick={() => setShowFaceRegistration(true)}
                            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm text-purple-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all duration-200"
                        >
                            <Camera size={16} />
                            Register Face
                        </button>
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
                <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2">My Courses</h2>
                        <p className="text-slate-400">Select a course to view attendance, quizzes, marks and more, or complete semester registration before classes begin.</p>
                    </div>

                    {/* Semester Filter */}
                    {semesters.length > 0 && (
                        <div className="flex items-center gap-2 shrink-0">
                            <Filter size={16} className="text-slate-400" />
                            <div className="relative">
                                <select
                                    id="semester-filter"
                                    value={selectedSemester}
                                    onChange={(e) => setSelectedSemester(e.target.value)}
                                    className="appearance-none bg-slate-800/80 border border-slate-600/50 text-white rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 cursor-pointer transition-all duration-200 hover:bg-slate-700/80 min-w-[200px]"
                                >
                                    <option value="all">All Semesters</option>
                                    {semesters.map((sem) => (
                                        <option key={sem.id} value={sem.id}>
                                            Semester {sem.semester_no} {sem.name ? `— ${sem.name}` : ''}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Course Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {filteredCourses.map((course, index) => {
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
                                    <div className="flex items-center gap-2 mb-3">
                                        <p className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${color.light} ${color.text}`}>
                                            {course.code}
                                        </p>
                                        {course.semester_no && selectedSemester === 'all' && (
                                            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-700/80 text-slate-300">
                                                Sem {course.semester_no}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-bold text-white group-hover:text-slate-100 leading-tight mb-2">
                                        {course.name}
                                    </h3>
                                    {course.professor_name && (
                                        <p className="text-sm text-slate-400 flex items-center gap-1.5">
                                            <GraduationCap size={14} />
                                            Prof. {course.professor_name}
                                        </p>
                                    )}
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
                {filteredCourses.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-6">
                            <BookOpen size={40} className="text-slate-600" />
                        </div>
                        {selectedSemester !== 'all' ? (
                            <>
                                <h3 className="text-xl font-semibold text-slate-300 mb-2">No courses for this semester</h3>
                                <p className="text-slate-500 max-w-md mx-auto mb-6">You don&apos;t have any enrolled courses for the selected semester. Try selecting a different semester or view all semesters.</p>
                                <button
                                    onClick={() => setSelectedSemester('all')}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm hover:bg-emerald-600/30 transition-all duration-200"
                                >
                                    Show All Semesters
                                </button>
                            </>
                        ) : (
                            <>
                                <h3 className="text-xl font-semibold text-slate-300 mb-2">No courses enrolled</h3>
                                <p className="text-slate-500 max-w-md mx-auto mb-6">You haven&apos;t been enrolled in any courses yet. Your professors will add you to courses.</p>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl text-slate-400 text-sm">
                                    <GraduationCap size={16} />
                                    Contact your professor to get enrolled
                                </div>
                            </>
                        )}
                    </div>
                )}
            </main>

            {/* Face Registration Modal */}
            {showFaceRegistration && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="relative w-full max-w-md">
                        <FaceRegistration onComplete={() => setShowFaceRegistration(false)} />
                        <button 
                            onClick={() => setShowFaceRegistration(false)} 
                            className="absolute -top-10 right-0 text-slate-400 hover:text-white transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
