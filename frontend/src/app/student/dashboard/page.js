"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';
import { CheckSquare, FileText, ClipboardList, BookOpen, LogOut, ArrowLeft, Layers, TrendingUp, Calendar, Award, Target, Trophy, Hash, Upload, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import AttendanceTracker from '@/components/AttendanceTracker';
import api from '@/lib/api';

export default function StudentDashboard() {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('attendance');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [quizzes, setQuizzes] = useState([]);
    const [marks, setMarks] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [assignmentCode, setAssignmentCode] = useState('');
    const [assignmentLanguage, setAssignmentLanguage] = useState('javascript');
    const [attendanceData, setAttendanceData] = useState(null);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [marksReport, setMarksReport] = useState(null);
    const [marksReportLoading, setMarksReportLoading] = useState(false);
    const [studentAssignments, setStudentAssignments] = useState([]);
    const [assignmentsLoading, setAssignmentsLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState(null);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [submissionDetailLoading, setSubmissionDetailLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const u = Cookies.get('user');
        if (!u) return router.push('/login');
        const parsed = JSON.parse(u);
        if (parsed.role !== 'student') return router.push('/professor/courses');
        setUser(parsed);

        // Get subjectId from URL query param
        const subjectIdFromUrl = searchParams.get('subjectId');
        if (!subjectIdFromUrl) {
            return router.push('/student/courses');
        }

        // Get course details from cookie
        const courseData = Cookies.get('selectedCourse');
        if (courseData) {
            try {
                setSelectedCourse(JSON.parse(courseData));
            } catch {
                setSelectedCourse({ id: subjectIdFromUrl, name: 'Course', code: '' });
            }
        } else {
            setSelectedCourse({ id: subjectIdFromUrl, name: 'Course', code: '' });
        }

        fetchData(parsed.role_id, 'marks');
        // Auto-fetch attendance for the selected subject
        fetchAttendance(parsed.role_id, subjectIdFromUrl);
    }, []);

    const subjectId = searchParams.get('subjectId');

    const fetchData = async (id, tab) => {
        if (tab === 'marks') {
            try {
                const { data } = await api.get(`/marks/student/${id}`);
                setMarks(data);
            } catch (err) {
                console.error(err);
            }
        }
    };

    const fetchMarksReport = async () => {
        if (!subjectId) return;
        setMarksReportLoading(true);
        try {
            const { data } = await api.get(`/marks/student-report/${subjectId}`);
            setMarksReport(data);
        } catch (err) {
            console.error('Failed to fetch marks report', err);
        } finally {
            setMarksReportLoading(false);
        }
    };

    const getGradeColor = (grade) => {
        const colors = {
            'A+': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
            'A': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
            'B+': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
            'B': { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-300' },
            'C': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
            'D': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
            'F': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
        };
        return colors[grade] || colors['F'];
    };

    const fetchStudentAssignments = async () => {
        if (!subjectId) return;
        setAssignmentsLoading(true);
        try {
            const { data } = await api.get(`/assignment/student/${subjectId}`);
            setStudentAssignments(data);
        } catch (err) {
            console.error('Failed to fetch assignments', err);
        } finally {
            setAssignmentsLoading(false);
        }
    };

    const openMySubmission = async (submissionId) => {
        if (!submissionId) return;
        setSubmissionDetailLoading(true);
        try {
            const { data } = await api.get(`/assignment/submission/${submissionId}`);
            setSelectedSubmission(data);
        } catch (err) {
            alert(err?.response?.data?.error || 'Failed to load submission');
        } finally {
            setSubmissionDetailLoading(false);
        }
    };

    const handleSubmitAssignment = async (e, assignmentId) => {
        e.preventDefault();
        if (!assignmentId) return;
        if (!assignmentCode || assignmentCode.trim().length === 0) {
            setSubmitResult({ error: 'Please paste your code before submitting' });
            return;
        }
        setSubmitting(true);
        setSubmitResult(null);
        try {
            const { data } = await api.post('/assignment/submit-code', {
                assignment_id: assignmentId,
                code_text: assignmentCode,
                code_language: assignmentLanguage
            });
            setSubmitResult(data);
            setAssignmentCode('');
            fetchStudentAssignments();
        } catch (err) {
            const msg = err.response?.data?.error || 'Submission failed';
            setSubmitResult({ error: msg });
        } finally {
            setSubmitting(false);
        }
    };

    const fetchAttendance = async (studentId, sid) => {
        if (!studentId || !sid) return;
        setAttendanceLoading(true);
        try {
            const { data } = await api.get(`/attendance/student/${studentId}/subject/${sid}`);
            setAttendanceData(data);
        } catch (err) {
            console.error('Failed to fetch attendance', err);
        } finally {
            setAttendanceLoading(false);
        }
    };

    // Build heatmap data for last 6 months
    const buildHeatmapData = () => {
        if (!attendanceData) return [];
        const recordMap = {};
        attendanceData.records.forEach(r => {
            const dateStr = new Date(r.date).toISOString().split('T')[0];
            recordMap[dateStr] = r.status;
        });

        const today = new Date();
        const startDate = new Date(today);
        startDate.setMonth(startDate.getMonth() - 5);
        startDate.setDate(1);

        const days = [];
        const current = new Date(startDate);
        while (current <= today) {
            const dateStr = current.toISOString().split('T')[0];
            days.push({
                date: dateStr,
                dayOfWeek: current.getDay(),
                status: recordMap[dateStr] || null,
                month: current.getMonth(),
                year: current.getFullYear()
            });
            current.setDate(current.getDate() + 1);
        }
        return days;
    };

    const getHeatmapColor = (status) => {
        if (!status) return 'bg-gray-100';
        if (status === 'present') return 'bg-emerald-500';
        return 'bg-red-400';
    };

    const getPercentageColor = (pct) => {
        if (pct >= 75) return { stroke: '#10b981', text: 'text-emerald-600', bg: 'bg-emerald-50' };
        if (pct >= 50) return { stroke: '#f59e0b', text: 'text-amber-600', bg: 'bg-amber-50' };
        return { stroke: '#ef4444', text: 'text-red-600', bg: 'bg-red-50' };
    };

    const handleSubjectSearch = async () => {
        if (!subjectId) return;
        if (activeTab === 'quizzes') {
            try {
                const { data } = await api.get(`/quiz/subject/${subjectId}`);
                setQuizzes(data);
            } catch (err) {
                console.error(err);
            }
        }
    };

    // (legacy) submitAssignment removed: file uploads are disabled for assignments

    if (!user || !selectedCourse) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    const tabs = [
        { id: 'attendance', name: 'Attendance', icon: CheckSquare },
        { id: 'quizzes', name: 'Quizzes', icon: ClipboardList },
        { id: 'marks', name: 'Marks & Grading', icon: BookOpen },
        { id: 'assignments', name: 'Assignments', icon: FileText },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-lg flex flex-col">
                <div className="p-6 border-b">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <Layers size={16} className="text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-emerald-600">AcadTrack</h2>
                    </div>
                    {/* Current Course Badge */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-xs text-emerald-500 font-medium uppercase tracking-wider">Current Course</p>
                        <p className="text-sm font-bold text-emerald-800 mt-0.5 truncate">{selectedCourse.name}</p>
                        {selectedCourse.code && (
                            <p className="text-xs text-emerald-600 font-mono mt-0.5">{selectedCourse.code}</p>
                        )}
                        {selectedCourse.professor_name && (
                            <p className="text-xs text-emerald-500 mt-1">Prof. {selectedCourse.professor_name}</p>
                        )}
                    </div>
                    {/* Back to Courses */}
                    <button
                        onClick={() => router.push('/student/courses')}
                        className="mt-3 w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Courses</span>
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => {
                                setActiveTab(t.id);
                                if (t.id === 'marks') { fetchData(user.role_id, 'marks'); fetchMarksReport(); }
                                if (t.id === 'quizzes') handleSubjectSearch();
                                if (t.id === 'attendance') fetchAttendance(user.role_id, subjectId);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === t.id ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <t.icon size={20} /> {t.name}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t">
                    <button onClick={() => { Cookies.remove('token'); Cookies.remove('user'); Cookies.remove('selectedCourse'); router.push('/login'); }} className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">
                        <LogOut size={20} /> Log Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto h-screen">
                <header className="mb-8 flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Welcome back, {user.name}!</h1>
                        <p className="text-gray-500">
                            Viewing <span className="font-semibold text-emerald-600">{selectedCourse.name}</span>
                            {selectedCourse.code && <span className="text-gray-400 ml-1">({selectedCourse.code})</span>}
                        </p>
                    </div>
                    {activeTab === 'quizzes' && (
                        <button onClick={handleSubjectSearch} className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 font-medium transition-colors">
                            Load Quizzes
                        </button>
                    )}
                </header>

                <div className="space-y-6">
                    {/* Submission detail modal */}
                    {selectedSubmission && (
                        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
                            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border overflow-hidden">
                                <div className="p-4 border-b flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Your Submission</p>
                                        <h4 className="text-lg font-bold text-gray-800">
                                            {selectedSubmission.code_language || 'code'} • #{selectedSubmission.id}
                                        </h4>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {new Date(selectedSubmission.submitted_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedSubmission(null)}
                                        className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium flex items-center gap-2"
                                    >
                                        <AlertCircle size={16} /> Close
                                    </button>
                                </div>
                                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-1 space-y-3">
                                        <div className="p-3 rounded-xl border bg-gray-50">
                                            <p className="text-xs text-gray-500 font-medium">Similarity</p>
                                            <p className="text-2xl font-extrabold text-gray-900">
                                                {((selectedSubmission.similarity_score || 0) * 100).toFixed(1)}%
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Matched with: {selectedSubmission.matched_with || '-'}
                                            </p>
                                            {selectedSubmission.is_late && (
                                                <p className="text-xs font-bold text-orange-700 mt-2">Late submission</p>
                                            )}
                                        </div>
                                        {selectedSubmission.file_url && (
                                            <a
                                                href={selectedSubmission.file_url}
                                                target="_blank"
                                                className="block text-center px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-sm"
                                            >
                                                Download file
                                            </a>
                                        )}
                                    </div>
                                    <div className="md:col-span-2">
                                        <div className="border rounded-xl overflow-hidden">
                                            <div className="px-3 py-2 bg-gray-100 border-b flex items-center justify-between">
                                                <span className="text-xs font-bold text-gray-600">Submitted Code</span>
                                                <span className="text-xs text-gray-400 font-mono">ID: {selectedSubmission.id}</span>
                                            </div>
                                            <pre className="p-3 text-xs md:text-sm overflow-auto max-h-[60vh] bg-white font-mono whitespace-pre-wrap">
                                                {selectedSubmission.code_text || '(No pasted code stored for this submission)'}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'attendance' && (
                        <div className="space-y-6">
                            {/* Mark Attendance Section */}
                            {subjectId && <AttendanceTracker subjectId={subjectId} />}

                            {/* Attendance Stats & Heatmap */}
                            {attendanceLoading ? (
                                <div className="flex items-center justify-center py-12 bg-white rounded-xl border">
                                    <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : attendanceData ? (
                                <>
                                    {/* Stats Row */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        {/* Percentage Circle */}
                                        <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col items-center justify-center">
                                            <div className="relative w-28 h-28 mb-3">
                                                <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 120 120">
                                                    <circle cx="60" cy="60" r="52" stroke="#e5e7eb" strokeWidth="10" fill="none" />
                                                    <circle
                                                        cx="60" cy="60" r="52"
                                                        stroke={getPercentageColor(attendanceData.stats.percentage).stroke}
                                                        strokeWidth="10"
                                                        fill="none"
                                                        strokeLinecap="round"
                                                        strokeDasharray={`${2 * Math.PI * 52}`}
                                                        strokeDashoffset={`${2 * Math.PI * 52 * (1 - attendanceData.stats.percentage / 100)}`}
                                                        style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className={`text-2xl font-bold ${getPercentageColor(attendanceData.stats.percentage).text}`}>
                                                        {attendanceData.stats.percentage}%
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-sm font-medium text-gray-500">Attendance Rate</p>
                                            {attendanceData.stats.percentage < 75 && (
                                                <p className="text-xs text-red-500 mt-1 font-medium">⚠ Below 75% threshold</p>
                                            )}
                                        </div>

                                        {/* Total Classes */}
                                        <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
                                                <Calendar size={22} className="text-blue-600" />
                                            </div>
                                            <p className="text-3xl font-bold text-gray-800">{attendanceData.stats.total}</p>
                                            <p className="text-sm text-gray-500 mt-1">Total Classes</p>
                                        </div>

                                        {/* Present */}
                                        <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                                                <CheckSquare size={22} className="text-emerald-600" />
                                            </div>
                                            <p className="text-3xl font-bold text-emerald-600">{attendanceData.stats.present}</p>
                                            <p className="text-sm text-gray-500 mt-1">Present</p>
                                        </div>

                                        {/* Absent */}
                                        <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-3">
                                                <TrendingUp size={22} className="text-red-500" />
                                            </div>
                                            <p className="text-3xl font-bold text-red-500">{attendanceData.stats.absent}</p>
                                            <p className="text-sm text-gray-500 mt-1">Absent</p>
                                        </div>
                                    </div>

                                    {/* Heatmap */}
                                    <div className="bg-white rounded-xl shadow-sm border p-6">
                                        <h3 className="text-lg font-bold text-gray-800 mb-1">Attendance Heatmap</h3>
                                        <p className="text-sm text-gray-400 mb-4">Last 6 months of attendance activity</p>

                                        {/* Month Labels */}
                                        {(() => {
                                            const heatmapDays = buildHeatmapData();
                                            const months = [];
                                            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                            let lastMonth = -1;
                                            heatmapDays.forEach((d, i) => {
                                                if (d.month !== lastMonth) {
                                                    months.push({ name: monthNames[d.month], index: i });
                                                    lastMonth = d.month;
                                                }
                                            });

                                            // Group into weeks (columns)
                                            const weeks = [];
                                            let currentWeek = new Array(7).fill(null);
                                            heatmapDays.forEach((d, i) => {
                                                currentWeek[d.dayOfWeek] = d;
                                                if (d.dayOfWeek === 6 || i === heatmapDays.length - 1) {
                                                    weeks.push([...currentWeek]);
                                                    currentWeek = new Array(7).fill(null);
                                                }
                                            });

                                            return (
                                                <div className="overflow-x-auto">
                                                    {/* Month labels */}
                                                    <div className="flex gap-0 ml-8 mb-1">
                                                        {weeks.map((week, wi) => {
                                                            const firstDay = week.find(d => d !== null);
                                                            const showLabel = firstDay && months.find(m => {
                                                                const weekDays = week.filter(d => d !== null);
                                                                return weekDays.some(d => d.date && new Date(d.date).getDate() <= 7 && d.month === monthNames.indexOf(m.name));
                                                            });
                                                            return (
                                                                <div key={wi} className="w-[14px] text-center flex-shrink-0">
                                                                    {showLabel ? (
                                                                        <span className="text-[10px] text-gray-400">{showLabel.name}</span>
                                                                    ) : null}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    {/* Grid */}
                                                    <div className="flex gap-0">
                                                        {/* Day labels */}
                                                        <div className="flex flex-col gap-[2px] mr-1 justify-start">
                                                            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, i) => (
                                                                <div key={i} className="h-[14px] flex items-center">
                                                                    {i % 2 === 1 ? <span className="text-[10px] text-gray-400 w-6 text-right">{day}</span> : <span className="w-6"></span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {/* Weeks */}
                                                        {weeks.map((week, wi) => (
                                                            <div key={wi} className="flex flex-col gap-[2px]">
                                                                {week.map((day, di) => (
                                                                    <div
                                                                        key={di}
                                                                        className={`w-[14px] h-[14px] rounded-[3px] ${day ? getHeatmapColor(day.status) : 'bg-transparent'} transition-colors`}
                                                                        title={day ? `${day.date}: ${day.status || 'No class'}` : ''}
                                                                    />
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {/* Legend */}
                                                    <div className="flex items-center gap-3 mt-4 text-xs text-gray-500">
                                                        <span>Less</span>
                                                        <div className="w-3 h-3 rounded-sm bg-gray-100"></div>
                                                        <div className="w-3 h-3 rounded-sm bg-red-400"></div>
                                                        <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                                                        <span>More</span>
                                                        <span className="ml-4 flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-gray-100 border"></div> No class</span>
                                                        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-400"></div> Absent</span>
                                                        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-emerald-500"></div> Present</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Recent Records */}
                                    {attendanceData.records.length > 0 && (
                                        <div className="bg-white rounded-xl shadow-sm border p-6">
                                            <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Records</h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-50">
                                                            <th className="p-3 border text-sm">Date</th>
                                                            <th className="p-3 border text-sm">Day</th>
                                                            <th className="p-3 border text-sm">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[...attendanceData.records].reverse().slice(0, 20).map((r, i) => {
                                                            const d = new Date(r.date);
                                                            const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                                                            return (
                                                                <tr key={i} className="hover:bg-gray-50">
                                                                    <td className="p-3 border text-sm">{d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                                    <td className="p-3 border text-sm text-gray-500">{dayNames[d.getDay()]}</td>
                                                                    <td className="p-3 border">
                                                                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                                                                            r.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                                        }`}>
                                                                            {r.status.toUpperCase()}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-dashed">
                                    <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                                    <p>No attendance records found for this course yet.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'quizzes' && (
                        <div className="bg-white p-6 rounded-xl shadow border">
                            <h3 className="text-xl font-bold mb-6">Quizzes</h3>
                            {quizzes.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
                                    <p>No quizzes available for this subject. Click "Load Quizzes" to refresh.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {quizzes.map(q => {
                                        const now = new Date();
                                        const start = new Date(q.start_time);
                                        const end = new Date(q.end_time);
                                        const isUpcoming = now < start;
                                        const isLive = now >= start && now <= end;
                                        const isExpired = now > end;
                                        const isSubmitted = q.submitted;

                                        let statusBadge;
                                        if (isSubmitted) {
                                            statusBadge = <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">✓ Submitted</span>;
                                        } else if (isLive) {
                                            statusBadge = <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700 animate-pulse">● LIVE</span>;
                                        } else if (isUpcoming) {
                                            statusBadge = <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700">Upcoming</span>;
                                        } else {
                                            statusBadge = <span className="px-3 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-500">Expired</span>;
                                        }

                                        return (
                                            <div key={q.id} className={`p-5 border rounded-xl transition-all hover:shadow-md ${
                                                isLive && !isSubmitted ? 'border-emerald-200 bg-emerald-50/50' :
                                                isSubmitted ? 'border-gray-200 bg-gray-50/50' : ''
                                            }`}>
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <h4 className="font-bold text-lg text-gray-800">{q.title}</h4>
                                                            {statusBadge}
                                                        </div>
                                                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar size={14} /> {start.toLocaleDateString()}
                                                            </span>
                                                            <span>⏱ {q.duration} mins</span>
                                                            <span>{q.question_count || '?'} questions</span>
                                                            <span>{start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} — {end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                        </div>
                                                        {isSubmitted && q.my_score !== null && (
                                                            <div className="mt-3 flex items-center gap-2">
                                                                <span className="text-sm font-medium text-gray-600">Your Score:</span>
                                                                <span className="text-xl font-bold text-emerald-600">{q.my_score}</span>
                                                                <span className="text-sm text-gray-400">/ {q.question_count || '?'}</span>
                                                            </div>
                                                        )}
                                                        {isUpcoming && (
                                                            <p className="mt-2 text-xs text-blue-600 font-medium">
                                                                Starts {start.toLocaleString()}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-2 ml-4 shrink-0">
                                                        {isLive && !isSubmitted && (
                                                            <button
                                                                onClick={() => router.push(`/student/quiz/${q.id}`)}
                                                                className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 font-bold transition-colors shadow-sm text-sm"
                                                            >
                                                                Attempt Quiz →
                                                            </button>
                                                        )}
                                                        {isSubmitted && (
                                                            <button
                                                                onClick={() => router.push(`/student/quiz/${q.id}/result`)}
                                                                className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors text-sm"
                                                            >
                                                                View Result
                                                            </button>
                                                        )}
                                                        {isUpcoming && (
                                                            <span className="text-xs text-gray-400 text-right">Not yet available</span>
                                                        )}
                                                        {isExpired && !isSubmitted && (
                                                            <span className="text-xs text-red-400 text-right">Missed</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'marks' && (
                        <div className="space-y-6">
                            {/* Subject Report Card */}
                            {marksReportLoading ? (
                                <div className="flex items-center justify-center py-12 bg-white rounded-xl border">
                                    <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : marksReport && marksReport.exams.length > 0 ? (
                                <>
                                    {/* Exam Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {marksReport.exams.map((exam, i) => {
                                            const gc = getGradeColor(exam.grade);
                                            const pctWidth = Math.min(exam.percentage, 100);
                                            return (
                                                <div key={i} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div>
                                                            <h4 className="font-bold text-lg text-gray-800 capitalize">{exam.exam_type} Exam</h4>
                                                            <p className="text-sm text-gray-400">Max Marks: {exam.max_marks}</p>
                                                        </div>
                                                        <span className={`px-3 py-1.5 rounded-lg text-lg font-bold ${gc.bg} ${gc.text} border ${gc.border}`}>
                                                            {exam.grade}
                                                        </span>
                                                    </div>

                                                    {/* Score */}
                                                    <div className="flex items-end gap-2 mb-3">
                                                        <span className="text-4xl font-bold text-gray-800">{exam.marks_obtained}</span>
                                                        <span className="text-xl text-gray-400 mb-1">/ {exam.max_marks}</span>
                                                        <span className={`ml-auto text-lg font-bold ${exam.percentage >= 40 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                            {exam.percentage}%
                                                        </span>
                                                    </div>

                                                    {/* Progress bar */}
                                                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-700 ${
                                                                exam.percentage >= 80 ? 'bg-emerald-500' :
                                                                exam.percentage >= 60 ? 'bg-blue-500' :
                                                                exam.percentage >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                                            }`}
                                                            style={{ width: `${pctWidth}%` }}
                                                        />
                                                    </div>

                                                    {/* Class comparison */}
                                                    {exam.class_avg && (
                                                        <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                                                            <div className="text-center">
                                                                <p className="text-xs text-gray-400 mb-0.5">Class Avg</p>
                                                                <p className="text-sm font-bold text-gray-600">{exam.class_avg}</p>
                                                            </div>
                                                            <div className="text-center border-x">
                                                                <p className="text-xs text-gray-400 mb-0.5">Highest</p>
                                                                <p className="text-sm font-bold text-gray-600">{exam.class_max}</p>
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-xs text-gray-400 mb-0.5">Your Rank</p>
                                                                <p className="text-sm font-bold text-indigo-600">
                                                                    {exam.rank ? `#${exam.rank}` : '-'}
                                                                    {exam.total_students && <span className="text-gray-400 font-normal">/{exam.total_students}</span>}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Overall Performance Summary (from all subjects) */}
                                    {marks && marks.overall && (
                                        <div className="bg-white rounded-xl shadow-sm border p-6">
                                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                                <Award size={20} className="text-amber-500" /> Overall Academic Performance
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div className="flex flex-col items-center justify-center">
                                                    <div className="relative w-28 h-28 mb-2">
                                                        <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 120 120">
                                                            <circle cx="60" cy="60" r="52" stroke="#e5e7eb" strokeWidth="10" fill="none" />
                                                            <circle
                                                                cx="60" cy="60" r="52"
                                                                stroke={marks.overall.percentage >= 75 ? '#10b981' : marks.overall.percentage >= 40 ? '#f59e0b' : '#ef4444'}
                                                                strokeWidth="10" fill="none" strokeLinecap="round"
                                                                strokeDasharray={`${2*Math.PI*52}`}
                                                                strokeDashoffset={`${2*Math.PI*52*(1-marks.overall.percentage/100)}`}
                                                                style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                                                            />
                                                        </svg>
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                            <span className="text-2xl font-bold text-gray-800">{marks.overall.percentage}%</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-500">Overall %</p>
                                                </div>
                                                <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl p-4">
                                                    <div className={`text-3xl font-bold mb-1 ${getGradeColor(marks.overall.grade).text}`}>
                                                        {marks.overall.grade}
                                                    </div>
                                                    <p className="text-sm text-gray-500">Overall Grade</p>
                                                </div>
                                                <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl p-4">
                                                    <div className="text-3xl font-bold text-indigo-600 mb-1">{marks.overall.grade_point}</div>
                                                    <p className="text-sm text-gray-500">Grade Point</p>
                                                </div>
                                                <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl p-4">
                                                    <div className="text-3xl font-bold text-gray-700 mb-1">{marks.overall.total_exams}</div>
                                                    <p className="text-sm text-gray-500">Exams Taken</p>
                                                </div>
                                            </div>

                                            {/* Per-subject breakdown */}
                                            {marks.subjects && Object.keys(marks.subjects).length > 0 && (
                                                <div className="mt-6">
                                                    <h4 className="text-sm font-bold text-gray-500 mb-3">All Subject Scores</h4>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left border-collapse">
                                                            <thead>
                                                                <tr className="bg-gray-50">
                                                                    <th className="p-3 border text-sm">Subject</th>
                                                                    <th className="p-3 border text-sm">Exam</th>
                                                                    <th className="p-3 border text-sm text-center">Marks</th>
                                                                    <th className="p-3 border text-sm text-center">%</th>
                                                                    <th className="p-3 border text-sm text-center">Grade</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {Object.values(marks.subjects).map((subj) =>
                                                                    subj.exams.map((ex, j) => (
                                                                        <tr key={`${subj.subject_code}-${j}`} className="hover:bg-gray-50">
                                                                            <td className="p-3 border">
                                                                                <span className="font-medium">{subj.subject_name}</span>
                                                                                {subj.subject_code && <span className="text-xs text-gray-400 ml-2">{subj.subject_code}</span>}
                                                                            </td>
                                                                            <td className="p-3 border capitalize text-sm">{ex.exam_type}</td>
                                                                            <td className="p-3 border text-center font-bold">{ex.marks_obtained}/{ex.max_marks}</td>
                                                                            <td className="p-3 border text-center">
                                                                                <span className={`font-bold ${ex.percentage >= 40 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                                    {ex.percentage}%
                                                                                </span>
                                                                            </td>
                                                                            <td className="p-3 border text-center">
                                                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getGradeColor(ex.grade).bg} ${getGradeColor(ex.grade).text}`}>
                                                                                    {ex.grade}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-dashed">
                                    <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
                                    <p>No marks uploaded for this course yet.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'assignments' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <FileText size={22} className="text-indigo-600" /> Assignments
                                </h3>
                                <button onClick={fetchStudentAssignments} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium transition-colors text-sm flex items-center gap-2">
                                    <ClipboardList size={16} /> Refresh
                                </button>
                            </div>

                            {assignmentsLoading ? (
                                <div className="flex items-center justify-center py-12 bg-white rounded-xl border">
                                    <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : studentAssignments.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-dashed">
                                    <FileText size={40} className="mx-auto mb-3 opacity-30" />
                                    <p>No assignments posted for this course yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {studentAssignments.map((a) => {
                                        const deadline = new Date(a.deadline);
                                        const now = new Date();
                                        const isPastDeadline = now > deadline;
                                        const isSubmitted = !!a.submission_id;
                                        const hoursLeft = Math.max(0, Math.floor((deadline - now) / (1000 * 60 * 60)));
                                        const daysLeft = Math.floor(hoursLeft / 24);

                                        let statusBadge;
                                        if (isSubmitted && a.is_late) {
                                            statusBadge = <span className="px-3 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-700">✓ Late Submission</span>;
                                        } else if (isSubmitted) {
                                            statusBadge = <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">✓ Submitted</span>;
                                        } else if (isPastDeadline) {
                                            statusBadge = <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700">Deadline Passed</span>;
                                        } else if (hoursLeft < 24) {
                                            statusBadge = <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-700 animate-pulse">⚠ Due Soon</span>;
                                        } else {
                                            statusBadge = <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700">Open</span>;
                                        }

                                        return (
                                            <div key={a.id} className={`bg-white rounded-xl border p-6 hover:shadow-md transition-shadow ${
                                                isSubmitted ? 'border-l-4 border-l-emerald-500' :
                                                isPastDeadline ? 'border-l-4 border-l-red-400 opacity-80' :
                                                hoursLeft < 24 ? 'border-l-4 border-l-amber-500' : ''
                                            }`}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <h4 className="font-bold text-lg text-gray-800">{a.title}</h4>
                                                            {statusBadge}
                                                        </div>
                                                        {a.description && (
                                                            <p className="text-sm text-gray-500 mb-3 line-clamp-2">{a.description}</p>
                                                        )}
                                                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar size={14} /> Deadline: {deadline.toLocaleDateString()} {deadline.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                            </span>
                                                            {!isPastDeadline && !isSubmitted && (
                                                                <span className={`flex items-center gap-1 font-medium ${hoursLeft < 24 ? 'text-amber-600' : 'text-gray-500'}`}>
                                                                    <Clock size={14} />
                                                                    {daysLeft > 0 ? `${daysLeft}d ${hoursLeft % 24}h left` : `${hoursLeft}h left`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Submitted: show details */}
                                                {isSubmitted && (
                                                    <div className="mt-4 pt-4 border-t">
                                                        <div className="flex flex-wrap items-center gap-4">
                                                            <span className="text-sm text-gray-500">Submitted: {new Date(a.submitted_at).toLocaleString()}</span>
                                                            {a.similarity_score !== null && a.similarity_score > 0 && (
                                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                                    a.similarity_score >= 0.8 ? 'bg-red-100 text-red-700' :
                                                                    a.similarity_score >= 0.5 ? 'bg-amber-100 text-amber-700' :
                                                                    a.similarity_score >= 0.3 ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-emerald-100 text-emerald-700'
                                                                }`}>
                                                                    Similarity: {(a.similarity_score * 100).toFixed(1)}%
                                                                </span>
                                                            )}
                                                            {a.is_late && <span className="text-xs text-orange-600 font-bold">⏰ Late</span>}
                                                            <button
                                                                onClick={() => openMySubmission(a.submission_id)}
                                                                disabled={submissionDetailLoading}
                                                                className="ml-auto bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-lg hover:bg-indigo-100 font-bold text-sm"
                                                            >
                                                                View My Submission
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Not submitted: show upload form */}
                                                {!isSubmitted && (
                                                    <div className="mt-4 pt-4 border-t">
                                                        <form onSubmit={(e) => { setSelectedAssignmentId(a.id); handleSubmitAssignment(e, a.id); }} className="space-y-3">
                                                            <div className="flex flex-wrap items-end gap-3">
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-500 mb-1">Language</label>
                                                                    <select
                                                                        value={assignmentLanguage}
                                                                        onChange={(e) => setAssignmentLanguage(e.target.value)}
                                                                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                                                                    >
                                                                        {[
                                                                            { id: 'javascript', label: 'JavaScript' },
                                                                            { id: 'typescript', label: 'TypeScript' },
                                                                            { id: 'python', label: 'Python' },
                                                                            { id: 'java', label: 'Java' },
                                                                            { id: 'c', label: 'C' },
                                                                            { id: 'cpp', label: 'C++' },
                                                                            { id: 'sql', label: 'SQL' },
                                                                            { id: 'html', label: 'HTML' },
                                                                            { id: 'css', label: 'CSS' },
                                                                            { id: 'bash', label: 'Bash' },
                                                                        ].map(opt => (
                                                                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="flex-1 min-w-[220px] text-xs text-gray-400">
                                                                    Paste your code below. It will be saved to the database and checked for similarity.
                                                                </div>
                                                                <button
                                                                    type="submit"
                                                                    disabled={submitting || selectedAssignmentId !== a.id || !assignmentCode.trim()}
                                                                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 font-bold transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
                                                                >
                                                                    <Upload size={16} />
                                                                    {submitting && selectedAssignmentId === a.id ? 'Submitting...' : 'Submit Code'}
                                                                </button>
                                                            </div>

                                                            <textarea
                                                                value={selectedAssignmentId === a.id ? assignmentCode : ''}
                                                                onChange={(e) => { setSelectedAssignmentId(a.id); setAssignmentCode(e.target.value); }}
                                                                placeholder={`Paste your ${assignmentLanguage} code here...`}
                                                                rows={10}
                                                                className="w-full font-mono text-sm border border-gray-200 rounded-lg p-3 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                            />
                                                        </form>

                                                        {/* Submit result feedback */}
                                                        {submitResult && selectedAssignmentId === a.id && (
                                                            <div className={`mt-3 p-3 rounded-lg text-sm ${
                                                                submitResult.error
                                                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            }`}>
                                                                {submitResult.error ? (
                                                                    <p className="flex items-center gap-2"><AlertCircle size={16} /> {submitResult.error}</p>
                                                                ) : (
                                                                    <div>
                                                                        <p className="font-bold mb-1">✓ {submitResult.message}</p>
                                                                        {submitResult.is_late && <p className="text-orange-600">⏰ This was a late submission</p>}
                                                                        {submitResult.similarity_score > 0 && (
                                                                            <p className={submitResult.similarity_score >= 0.5 ? 'text-red-600 font-bold' : ''}>
                                                                                Plagiarism Score: {(submitResult.similarity_score * 100).toFixed(1)}% — {submitResult.similarity_label}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {isPastDeadline && (
                                                            <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                                                                <AlertCircle size={12} /> Deadline has passed. Submissions will be marked as late.
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
