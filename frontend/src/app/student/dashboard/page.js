"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';
import { CheckSquare, FileText, ClipboardList, BookOpen, LogOut, ArrowLeft, Layers, TrendingUp, Calendar } from 'lucide-react';
import AttendanceTracker from '@/components/AttendanceTracker';
import api from '@/lib/api';

export default function StudentDashboard() {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('attendance');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [quizzes, setQuizzes] = useState([]);
    const [marks, setMarks] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [assignmentFile, setAssignmentFile] = useState(null);
    const [attendanceData, setAttendanceData] = useState(null);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
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

    const submitAssignment = async (e, assignmentId) => {
        e.preventDefault();
        if (!assignmentId) return;
        const formData = new FormData();
        formData.append('assignment_id', assignmentId);
        formData.append('file', assignmentFile);

        try {
            await api.post('/assignment/submit', formData);
            alert('Assignment submitted!');
        } catch (err) {
            alert('Submission failed');
        }
    };

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
                                if (t.id === 'marks') fetchData(user.role_id, 'marks');
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
                            <h3 className="text-xl font-bold mb-4">Available Quizzes</h3>
                            {quizzes.length === 0 ? <p className="text-gray-500">No quizzes available for this subject. Click "Load Quizzes" to refresh.</p> : (
                                <div className="grid gap-4">
                                    {quizzes.map(q => (
                                        <div key={q.id} className="p-4 border rounded-lg flex justify-between items-center">
                                            <div>
                                                <h4 className="font-bold">{q.title}</h4>
                                                <p className="text-sm text-gray-500">Duration: {q.duration} mins | Start: {new Date(q.start_time).toLocaleString()}</p>
                                            </div>
                                            <button onClick={() => router.push(`/student/quiz/${q.id}`)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
                                                Attempt Quiz
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'marks' && (
                        <div className="bg-white p-6 rounded-xl shadow border">
                            <h3 className="text-xl font-bold mb-4">Your Performance</h3>
                            {marks.length === 0 ? <p className="text-gray-500">No marks uploaded yet.</p> : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {marks.map((m, i) => (
                                        <div key={i} className="p-5 border border-l-4 border-l-emerald-500 rounded-lg shadow-sm">
                                            <h4 className="font-bold text-lg">{m.subject_name}</h4>
                                            <p className="text-sm text-gray-600 capitalize mb-3 border-b pb-2">{m.exam_type} Exam</p>
                                            <div className="flex justify-between items-end">
                                                <span className="text-3xl font-bold text-gray-800">{m.marks_obtained}</span>
                                                <span className="text-gray-500">/ {m.max_marks}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'assignments' && (
                        <div className="bg-white p-6 rounded-xl shadow border">
                            <h3 className="text-xl font-bold mb-4">Submit Assignment</h3>
                            <form onSubmit={(e) => submitAssignment(e, prompt('Enter Assignment ID'))} className="border p-6 rounded-lg bg-gray-50">
                                <label className="block text-sm font-medium mb-2">Upload File</label>
                                <input type="file" required onChange={(e) => setAssignmentFile(e.target.files[0])} className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"/>
                                <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 transition">Submit File</button>
                            </form>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
