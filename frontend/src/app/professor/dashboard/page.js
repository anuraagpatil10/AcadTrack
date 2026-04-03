"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';
import { CheckSquare, FileText, ClipboardList, BookOpen, LogOut, PlusCircle, Upload, Search, ArrowLeft, Layers, Users, UserPlus, UserMinus, Filter, X, Clock, Calendar, XCircle, CalendarPlus, Trash2, Play, Square } from 'lucide-react';
import api from '@/lib/api';

export default function ProfessorDashboard() {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('attendance');
    const [selectedCourse, setSelectedCourse] = useState(null);

    // Data states
    const [attendanceData, setAttendanceData] = useState([]);
    const [marksData, setMarksData] = useState(null);
    const [submissions, setSubmissions] = useState([]);

    // Schedule states
    const [schedules, setSchedules] = useState([]);
    const [classInstances, setClassInstances] = useState([]);
    const [scheduleForm, setScheduleForm] = useState({ day_of_week: 1, start_time: '09:00', end_time: '10:00' });
    const [extraForm, setExtraForm] = useState({ date: '', start_time: '09:00', end_time: '10:00', note: '' });
    const [cancelForm, setCancelForm] = useState(null); // { date, start_time, end_time }
    const [scheduleView, setScheduleView] = useState('schedule'); // 'schedule' | 'calendar' | 'attendance'

    // Student management states
    const [allStudents, setAllStudents] = useState([]);
    const [enrolledStudents, setEnrolledStudents] = useState([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
    const [studentFilters, setStudentFilters] = useState({ semester: '', department: '', search: '' });
    const [enrolling, setEnrolling] = useState(false);
    const [studentView, setStudentView] = useState('add'); // 'add' or 'enrolled'

    // Form states
    const [quizForm, setQuizForm] = useState({ title: '', duration: 30, start_time: '', end_time: '', questions: [] });
    const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '', deadline: '' });
    const [marksForm, setMarksForm] = useState({ exam_type: 'midsem', max_marks: 100, marksJson: '' });

    const [isTracking, setIsTracking] = useState(false);
    const [locationError, setLocationError] = useState('');
    const trackingIntervalRef = useRef(null);

    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const u = Cookies.get('user');
        if (!u) return router.push('/login');
        const parsed = JSON.parse(u);
        if (parsed.role !== 'professor') return router.push('/student/courses');
        setUser(parsed);

        // Get subjectId from URL query param
        const subjectIdFromUrl = searchParams.get('subjectId');
        if (!subjectIdFromUrl) {
            // No subject selected, redirect back to courses
            return router.push('/professor/courses');
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
    }, []);

    const subjectId = searchParams.get('subjectId');

    const fetchSubjectData = async () => {
        if (!subjectId) return alert('No subject selected');
        try {
            if (activeTab === 'attendance') {
                const { data } = await api.get(`/attendance/subject/${subjectId}`);
                setAttendanceData(data);
            } else if (activeTab === 'marks_view') {
                const { data } = await api.get(`/marks/subject/${subjectId}`);
                setMarksData(data);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to fetch data');
        }
    };

    const fetchSubmissions = async (assignmentId) => {
        try {
            const { data } = await api.get(`/assignment/${assignmentId}/submissions`);
            setSubmissions(data);
        } catch (err) {
            alert('Failed to fetch submissions');
        }
    };

    const handleCreateQuiz = async (e) => {
        e.preventDefault();
        try {
            await api.post('/quiz/create', { subject_id: subjectId, ...quizForm });
            alert('Quiz created!');
            setQuizForm({ title: '', duration: 30, start_time: '', end_time: '', questions: [] });
        } catch (err) {
            alert('Failed to create quiz');
        }
    };

    const handleCreateAssignment = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/assignment/create', { subject_id: subjectId, ...assignmentForm });
            alert(`Assignment created! ID: ${data.assignment_id}`);
            setAssignmentForm({ title: '', description: '', deadline: '' });
        } catch (err) {
            alert('Failed to create assignment');
        }
    };

    const handleUploadMarks = async (e) => {
        e.preventDefault();
        try {
            const parsedMarks = JSON.parse(marksForm.marksJson);
            await api.post('/marks/upload', {
                subject_id: subjectId,
                exam_type: marksForm.exam_type,
                max_marks: marksForm.max_marks,
                marks: parsedMarks
            });
            alert('Marks uploaded successfully!');
        } catch (err) {
            alert('Invalid JSON or Upload failed');
        }
    };

    const addQuestion = () => {
        setQuizForm({
            ...quizForm,
            questions: [...quizForm.questions, { question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A' }]
        });
    };

    const updateQuestion = (index, field, value) => {
        const newQs = [...quizForm.questions];
        newQs[index][field] = value;
        setQuizForm({ ...quizForm, questions: newQs });
    };

    const startTrackingSequence = () => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation not supported');
            return;
        }

        navigator.geolocation.getCurrentPosition(async (pos) => {
            setLocationError('');
            setIsTracking(true);
            const { latitude, longitude } = pos.coords;
            try {
                await api.post('/attendance/professor/start', { subject_id: selectedCourse.id, latitude, longitude });
                // Start pinging
                trackingIntervalRef.current = setInterval(() => {
                    navigator.geolocation.getCurrentPosition(async (p) => {
                        await api.post('/attendance/professor/ping', { subject_id: selectedCourse.id, latitude: p.coords.latitude, longitude: p.coords.longitude });
                    });
                }, 60000);
            } catch (err) {
                console.error('Failed to start tracking', err);
            }
        }, (err) => {
            if (err.code === err.PERMISSION_DENIED) {
                setLocationError('Attendance Tracking is Disabled: Please Grant Location Permissions in your browser settings to allow student attendance to be marked.');
                setIsTracking(false);
            }
        });
    };

    const stopTrackingSequence = async () => {
        if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
        setIsTracking(false);
        try {
            await api.post('/attendance/professor/complete', { subject_id: selectedCourse.id });
        } catch (err) {
            console.error('Failed to stop tracking', err);
        }
    };

    useEffect(() => {
        if (!selectedCourse?.id || activeTab !== 'attendance') return;
        
        // Eagerly populate schedules for automated tracking exactly ONCE when tab opens
        fetchSchedules();
        fetchClassInstances();
    }, [selectedCourse?.id, activeTab]);

    useEffect(() => {
        if (!selectedCourse?.id || activeTab !== 'attendance') return;
        
        const checkScheduleLoop = setInterval(() => {
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`;
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            let todayClass = classInstances.find(c => c.date === todayStr && c.status !== 'cancelled');
            if (!todayClass && schedules.length > 0) {
                const dayOfWeek = now.getDay();
                todayClass = schedules.find(s => s.day_of_week === dayOfWeek);
            }

            if (todayClass) {
                const [sh, sm] = todayClass.start_time.split(':').map(Number);
                const [eh, em] = todayClass.end_time.split(':').map(Number);
                const startMins = sh * 60 + sm;
                const endMins = eh * 60 + em;

                // Start tracking if 2 mins past start time and before end time
                if (!isTracking && currentMinutes >= startMins + 2 && currentMinutes < endMins) {
                    startTrackingSequence();
                } else if (isTracking && currentMinutes >= endMins) {
                    stopTrackingSequence();
                }
            }
        }, 15000); // Check every 15 seconds

        return () => clearInterval(checkScheduleLoop);
    }, [selectedCourse?.id, activeTab, classInstances, schedules, isTracking]);

    // --- Schedule management functions ---
    const fetchSchedules = async () => {
        try {
            const { data } = await api.get(`/schedule/${subjectId}`);
            setSchedules(data);
        } catch (err) { console.error(err); }
    };

    const fetchClassInstances = async () => {
        try {
            const today = new Date();
            const ld = (d) => `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
            const from = ld(today);
            const future = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
            const to = ld(future);
            const { data } = await api.get(`/schedule/${subjectId}/classes?from=${from}&to=${to}`);
            setClassInstances(data);
        } catch (err) { console.error(err); }
    };

    const handleAddSchedule = async () => {
        try {
            await api.post(`/schedule/${subjectId}`, scheduleForm);
            fetchSchedules();
        } catch (err) { alert('Failed to add schedule'); }
    };

    const handleDeleteSchedule = async (id) => {
        if (!confirm('Remove this recurring schedule?')) return;
        try {
            await api.delete(`/schedule/slot/${id}`);
            fetchSchedules();
        } catch (err) { alert('Failed to delete'); }
    };

    const handleCancelClass = async (cls) => {
        if (!confirm(`Cancel class on ${cls.date}?`)) return;
        try {
            await api.post(`/schedule/${subjectId}/cancel`, {
                date: cls.date,
                start_time: cls.start_time,
                end_time: cls.end_time,
                note: prompt('Reason for cancellation (optional):') || ''
            });
            fetchClassInstances();
        } catch (err) { alert('Failed to cancel class'); }
    };

    const handleScheduleExtra = async () => {
        if (!extraForm.date) return alert('Please select a date');
        try {
            await api.post(`/schedule/${subjectId}/extra`, extraForm);
            setExtraForm({ date: '', start_time: '09:00', end_time: '10:00', note: '' });
            fetchClassInstances();
            alert('Extra class scheduled!');
        } catch (err) { alert(err.response?.data?.error || 'Failed to schedule extra class'); }
    };

    const handleDeleteInstance = async (instanceId) => {
        try {
            await api.delete(`/schedule/instance/${instanceId}`);
            fetchClassInstances();
        } catch (err) { alert('Failed'); }
    };

    if (!user || !selectedCourse) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    // --- Student management functions ---
    const fetchAllStudents = async () => {
        try {
            const params = new URLSearchParams();
            if (studentFilters.semester) params.append('semester', studentFilters.semester);
            if (studentFilters.department) params.append('department', studentFilters.department);
            if (studentFilters.search) params.append('search', studentFilters.search);
            const { data } = await api.get(`/course/students?${params.toString()}`);
            setAllStudents(data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchEnrolledStudents = async () => {
        try {
            const { data } = await api.get(`/course/${subjectId}/enrolled`);
            setEnrolledStudents(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleEnrollSelected = async () => {
        if (selectedStudentIds.size === 0) return alert('No students selected');
        setEnrolling(true);
        try {
            await api.post(`/course/${subjectId}/enroll`, { studentIds: Array.from(selectedStudentIds) });
            setSelectedStudentIds(new Set());
            fetchEnrolledStudents();
            alert(`${selectedStudentIds.size} student(s) enrolled!`);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to enroll students');
        } finally {
            setEnrolling(false);
        }
    };

    const handleUnenroll = async (studentId) => {
        if (!confirm('Remove this student from the course?')) return;
        try {
            await api.delete(`/course/${subjectId}/unenroll`, { data: { studentId } });
            fetchEnrolledStudents();
        } catch (err) {
            alert('Failed to remove student');
        }
    };

    const toggleStudentSelection = (studentId) => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            if (next.has(studentId)) next.delete(studentId);
            else next.add(studentId);
            return next;
        });
    };

    const toggleSelectAllFiltered = () => {
        const enrolledIds = new Set(enrolledStudents.map(s => s.student_id));
        const filteredNotEnrolled = allStudents.filter(s => !enrolledIds.has(s.student_id));
        const allSelected = filteredNotEnrolled.every(s => selectedStudentIds.has(s.student_id));
        if (allSelected) {
            setSelectedStudentIds(new Set());
        } else {
            setSelectedStudentIds(new Set(filteredNotEnrolled.map(s => s.student_id)));
        }
    };

    // Unique semesters & departments for filter dropdowns
    const uniqueSemesters = [...new Set(allStudents.map(s => s.semester))].sort((a, b) => a - b);
    const uniqueDepartments = [...new Set(allStudents.map(s => s.department))].filter(Boolean).sort();
    const enrolledIds = new Set(enrolledStudents.map(s => s.student_id));

    const tabs = [
        { id: 'manage_students', name: 'Manage Students', icon: Users },
        { id: 'attendance', name: 'Attendance Report', icon: CheckSquare },
        { id: 'create_quiz', name: 'Create Quiz', icon: PlusCircle },
        { id: 'marks_upload', name: 'Upload Marks', icon: Upload },
        { id: 'marks_view', name: 'Marks Analytics', icon: BookOpen },
        { id: 'create_assignment', name: 'Assignments', icon: FileText },
        { id: 'submissions', name: 'Plagiarism Tracker', icon: Search }
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-lg flex flex-col">
                <div className="p-6 border-b">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <Layers size={16} className="text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-blue-600">AcadTrack</h2>
                    </div>
                    {/* Current Course Badge */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-500 font-medium uppercase tracking-wider">Current Course</p>
                        <p className="text-sm font-bold text-blue-800 mt-0.5 truncate">{selectedCourse.name}</p>
                        {selectedCourse.code && (
                            <p className="text-xs text-blue-600 font-mono mt-0.5">{selectedCourse.code}</p>
                        )}
                    </div>
                    {/* Back to Courses */}
                    <button
                        onClick={() => router.push('/professor/courses')}
                        className="mt-3 w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Courses</span>
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => {
                                setActiveTab(t.id);
                                setAttendanceData([]);
                                setMarksData(null);
                                if (t.id === 'manage_students') {
                                    fetchAllStudents();
                                    fetchEnrolledStudents();
                                }
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${activeTab === t.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <t.icon size={20} /> <span className="text-sm">{t.name}</span>
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
                <header className="flex flex-col mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Welcome, Prof. {user.name}!</h1>
                            <p className="text-gray-500 mt-1 flex items-center gap-3">
                                <span>Managing <span className="font-semibold text-blue-600">{selectedCourse.name}</span>
                                {selectedCourse.code && <span className="text-gray-400 ml-1">({selectedCourse.code})</span>}</span>
                                
                                {isTracking && (
                                    <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold animate-pulse border border-green-200">
                                        <div className="w-2 h-2 bg-green-500 rounded-full shadow"></div> LIVE LOCATION TRACKING ACTIVE
                                    </span>
                                )}
                            </p>
                        </div>
                        {['attendance', 'marks_view'].includes(activeTab) && (
                            <button onClick={fetchSubjectData} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm">
                                Fetch Data
                            </button>
                        )}
                    </div>
                    {locationError && (
                        <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-bold flex items-center gap-2">
                            <XCircle size={18} /> {locationError}
                        </div>
                    )}
                </header>

                <div className="bg-white p-6 rounded-xl shadow border">
                    {activeTab === 'attendance' && (
                        <div>
                            {/* Sub-navigation */}
                            <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                                <div className="flex items-center gap-3">
                                    {[{id:'schedule',label:'Class Schedule',icon:Clock},{id:'calendar',label:'Upcoming Classes',icon:Calendar},{id:'attendance',label:'Attendance Log',icon:CheckSquare}].map(v => (
                                        <button key={v.id} onClick={() => { setScheduleView(v.id); if (v.id === 'schedule') fetchSchedules(); if (v.id === 'calendar') fetchClassInstances(); if (v.id === 'attendance') fetchSubjectData(); }}
                                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${scheduleView === v.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                            <v.icon size={16} /> {v.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-3">
                                    {!isTracking ? (
                                        <button onClick={startTrackingSequence} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold transition-colors shadow">
                                            <Play size={18} /> Start Session
                                        </button>
                                    ) : (
                                        <button onClick={stopTrackingSequence} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition-colors shadow animate-pulse">
                                            <Square fill="currentColor" size={18} /> End Session
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Schedule Setup */}
                            {scheduleView === 'schedule' && (
                                <div className="space-y-6">
                                    <div className="border rounded-xl p-5">
                                        <h4 className="font-bold text-lg mb-4">Recurring Weekly Schedule</h4>
                                        <p className="text-sm text-gray-500 mb-4">Set up which days and times this class runs every week.</p>
                                        
                                        {/* Add Schedule Form */}
                                        <div className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Day</label>
                                                <select className="border p-2 rounded-lg text-sm" value={scheduleForm.day_of_week} onChange={e => setScheduleForm({...scheduleForm, day_of_week: parseInt(e.target.value)})}>
                                                    {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d,i) => <option key={i} value={i}>{d}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Start Time</label>
                                                <input type="time" className="border p-2 rounded-lg text-sm" value={scheduleForm.start_time} onChange={e => setScheduleForm({...scheduleForm, start_time: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">End Time</label>
                                                <input type="time" className="border p-2 rounded-lg text-sm" value={scheduleForm.end_time} onChange={e => setScheduleForm({...scheduleForm, end_time: e.target.value})} />
                                            </div>
                                            <button onClick={handleAddSchedule} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-1">
                                                <PlusCircle size={14} /> Add Slot
                                            </button>
                                        </div>

                                        {/* Existing Schedules */}
                                        {schedules.length === 0 ? (
                                            <p className="text-gray-400 text-center py-6">No recurring schedules set up yet.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {schedules.map(s => {
                                                    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                                                    const dayColors = ['text-red-600 bg-red-50','text-yellow-700 bg-yellow-50','text-pink-600 bg-pink-50','text-green-600 bg-green-50','text-purple-600 bg-purple-50','text-blue-600 bg-blue-50','text-orange-600 bg-orange-50'];
                                                    return (
                                                        <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:shadow-sm transition-shadow">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${dayColors[s.day_of_week]}`}>{dayNames[s.day_of_week].slice(0,3)}</span>
                                                                <div>
                                                                    <p className="font-medium text-sm">{dayNames[s.day_of_week]}</p>
                                                                    <p className="text-xs text-gray-500">{s.start_time?.slice(0,5)} — {s.end_time?.slice(0,5)}</p>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => handleDeleteSchedule(s.id)} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Schedule Extra Class */}
                                    <div className="border rounded-xl p-5">
                                        <h4 className="font-bold text-lg mb-3 flex items-center gap-2"><CalendarPlus size={20} className="text-emerald-600" /> Schedule Extra Class</h4>
                                        <div className="flex flex-wrap items-end gap-3 p-4 bg-emerald-50 rounded-lg">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                                                <input type="date" className="border p-2 rounded-lg text-sm" value={extraForm.date} onChange={e => setExtraForm({...extraForm, date: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Start Time</label>
                                                <input type="time" className="border p-2 rounded-lg text-sm" value={extraForm.start_time} onChange={e => setExtraForm({...extraForm, start_time: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">End Time</label>
                                                <input type="time" className="border p-2 rounded-lg text-sm" value={extraForm.end_time} onChange={e => setExtraForm({...extraForm, end_time: e.target.value})} />
                                            </div>
                                            <div className="flex-1 min-w-[150px]">
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Note (optional)</label>
                                                <input type="text" placeholder="e.g. Makeup class" className="w-full border p-2 rounded-lg text-sm" value={extraForm.note} onChange={e => setExtraForm({...extraForm, note: e.target.value})} />
                                            </div>
                                            <button onClick={handleScheduleExtra} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">Schedule</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Calendar View */}
                            {scheduleView === 'calendar' && (
                                <div>
                                    <h4 className="font-bold text-lg mb-4">Upcoming 30 Days</h4>
                                    {classInstances.length === 0 ? (
                                        <p className="text-gray-400 text-center py-8">No classes scheduled. Set up a recurring schedule first.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {classInstances.map((c, i) => {
                                                const d = new Date(c.date);
                                                const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                                                const todayStr = (() => { const t = new Date(); return `${t.getFullYear()}-${(t.getMonth()+1).toString().padStart(2,'0')}-${t.getDate().toString().padStart(2,'0')}`; })();
                                                const isToday = c.date === todayStr;
                                                const isPast = c.date < todayStr;
                                                return (
                                                    <div key={i} className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                                                        c.status === 'cancelled' ? 'bg-red-50 border-red-200 opacity-70' :
                                                        c.status === 'extra' ? 'bg-emerald-50 border-emerald-200' :
                                                        isToday ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-gray-50'
                                                    }`}>
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-center min-w-[50px]">
                                                                <p className="text-xs text-gray-500 uppercase">{dayNames[d.getDay()]}</p>
                                                                <p className="text-xl font-bold text-gray-800">{d.getDate()}</p>
                                                                <p className="text-xs text-gray-400">{d.toLocaleDateString('en-US', {month:'short'})}</p>
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-sm">{c.start_time?.slice(0,5)} — {c.end_time?.slice(0,5)}</p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                                                                        c.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                                                                        c.status === 'extra' ? 'bg-emerald-100 text-emerald-600' :
                                                                        'bg-blue-100 text-blue-600'
                                                                    }`}>{c.status.toUpperCase()}</span>
                                                                    {c.note && <span className="text-xs text-gray-400">— {c.note}</span>}
                                                                    {isToday && <span className="text-xs font-bold text-blue-600">TODAY</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {!isPast && (
                                                            <div className="flex gap-2">
                                                                {c.status === 'scheduled' && (
                                                                    <button onClick={() => handleCancelClass(c)} className="flex items-center gap-1 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                                                                        <XCircle size={14} /> Cancel
                                                                    </button>
                                                                )}
                                                                {c.status === 'cancelled' && c.instance_id && (
                                                                    <button onClick={() => handleDeleteInstance(c.instance_id)} className="flex items-center gap-1 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                                                                        Restore
                                                                    </button>
                                                                )}
                                                                {c.status === 'extra' && c.instance_id && (
                                                                    <button onClick={() => handleDeleteInstance(c.instance_id)} className="flex items-center gap-1 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                                                                        <Trash2 size={14} /> Remove
                                                                    </button>
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

                            {/* Attendance Log */}
                            {scheduleView === 'attendance' && (
                                <div>
                                    <h3 className="text-xl font-bold mb-4">Subject Attendance Log</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="p-3 border">Date</th>
                                                    <th className="p-3 border">Roll No</th>
                                                    <th className="p-3 border">Name</th>
                                                    <th className="p-3 border">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {attendanceData.map((a, i) => (
                                                    <tr key={i} className="hover:bg-gray-50">
                                                        <td className="p-3 border">{new Date(a.date).toLocaleDateString()}</td>
                                                        <td className="p-3 border">{a.roll_no}</td>
                                                        <td className="p-3 border">{a.student_name}</td>
                                                        <td className="p-3 border">
                                                            <span className={`px-2 py-1 text-xs font-bold rounded ${a.status==='present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                {a.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {attendanceData.length === 0 && (
                                            <p className="text-gray-400 text-center py-8">No attendance records. Click "Fetch Data" to load.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'create_quiz' && (
                        <form onSubmit={handleCreateQuiz} className="space-y-4">
                            <h3 className="text-xl font-bold mb-4">Create New Quiz</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder="Title" required className="border p-3 rounded" value={quizForm.title} onChange={e => setQuizForm({...quizForm, title: e.target.value})} />
                                <input type="number" placeholder="Duration (mins)" required className="border p-3 rounded" value={quizForm.duration} onChange={e => setQuizForm({...quizForm, duration: e.target.value})} />
                                <input type="datetime-local" required className="border p-3 rounded" value={quizForm.start_time} onChange={e => setQuizForm({...quizForm, start_time: e.target.value})} />
                                <input type="datetime-local" required className="border p-3 rounded" value={quizForm.end_time} onChange={e => setQuizForm({...quizForm, end_time: e.target.value})} />
                            </div>

                            <div className="border border-dashed p-4 rounded-lg bg-gray-50">
                                <h4 className="font-bold mb-2">Questions ({quizForm.questions.length})</h4>
                                {quizForm.questions.map((q, i) => (
                                    <div key={i} className="mb-4 p-4 border rounded bg-white relative">
                                        <input type="text" placeholder={`Question ${i+1}`} className="w-full border p-2 rounded mb-2" value={q.question} onChange={e => updateQuestion(i, 'question', e.target.value)} required />
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <input type="text" placeholder="Option A" className="border p-2 rounded" value={q.option_a} onChange={e => updateQuestion(i, 'option_a', e.target.value)} required />
                                            <input type="text" placeholder="Option B" className="border p-2 rounded" value={q.option_b} onChange={e => updateQuestion(i, 'option_b', e.target.value)} required />
                                            <input type="text" placeholder="Option C" className="border p-2 rounded" value={q.option_c} onChange={e => updateQuestion(i, 'option_c', e.target.value)} required />
                                            <input type="text" placeholder="Option D" className="border p-2 rounded" value={q.option_d} onChange={e => updateQuestion(i, 'option_d', e.target.value)} required />
                                        </div>
                                        <label className="text-sm font-bold">Correct Answer: </label>
                                        <select className="border p-2 rounded ml-2" value={q.correct_answer} onChange={e => updateQuestion(i, 'correct_answer', e.target.value)}>
                                            <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                                        </select>
                                    </div>
                                ))}
                                <button type="button" onClick={addQuestion} className="text-blue-600 font-bold hover:underline">+ Add Question</button>
                            </div>
                            <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-6 rounded hover:bg-blue-700">Save Quiz</button>
                        </form>
                    )}

                    {activeTab === 'marks_upload' && (
                        <form onSubmit={handleUploadMarks} className="space-y-4">
                            <h3 className="text-xl font-bold mb-4">Bulk Upload Marks</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <select className="border p-3 rounded" value={marksForm.exam_type} onChange={e => setMarksForm({...marksForm, exam_type: e.target.value})}>
                                    <option value="midsem">Midsem</option>
                                    <option value="endsem">Endsem</option>
                                </select>
                                <input type="number" placeholder="Max Marks" required className="border p-3 rounded" value={marksForm.max_marks} onChange={e => setMarksForm({...marksForm, max_marks: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Marks JSON array <br/><span className="text-gray-400 font-mono text-xs">Ex: [{`{"student_id": 1, "marks_obtained": 85}`}]</span></label>
                                <textarea rows="6" className="w-full border p-3 rounded font-mono text-sm" value={marksForm.marksJson} onChange={e => setMarksForm({...marksForm, marksJson: e.target.value})} required></textarea>
                            </div>
                            <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-6 rounded hover:bg-blue-700">Upload Data</button>
                        </form>
                    )}

                    {activeTab === 'marks_view' && marksData && (
                        <div>
                            <h3 className="text-xl font-bold mb-4">Analytics Overview</h3>
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                {Object.entries(marksData.analytics).map(([type, stats]) => (
                                    <div key={type} className="p-4 bg-gray-50 border rounded flex flex-col items-center">
                                        <span className="capitalize font-bold text-gray-700 mb-2">{type}</span>
                                        <div className="text-sm text-gray-600 space-y-1 text-center">
                                            <p>Avg: <b>{stats.avg.toFixed(2)}</b> / {stats.max_marks}</p>
                                            <p>Max: <b>{stats.max}</b> | Min: <b>{stats.min}</b></p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <h3 className="text-lg font-bold mb-2">Detailed Marks</h3>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="p-3 border">Roll No</th>
                                        <th className="p-3 border">Name</th>
                                        <th className="p-3 border">Exam Type</th>
                                        <th className="p-3 border">Marks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {marksData.marks.map((m, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="p-3 border">{m.roll_no}</td>
                                            <td className="p-3 border">{m.student_name}</td>
                                            <td className="p-3 border capitalize">{m.exam_type}</td>
                                            <td className="p-3 border font-bold">{m.marks_obtained}/{m.max_marks}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'create_assignment' && (
                        <form onSubmit={handleCreateAssignment} className="space-y-4">
                            <h3 className="text-xl font-bold mb-4">Create Assignment</h3>
                            <input type="text" placeholder="Title" required className="w-full border p-3 rounded" value={assignmentForm.title} onChange={e => setAssignmentForm({...assignmentForm, title: e.target.value})} />
                            <textarea placeholder="Description" rows="4" required className="w-full border p-3 rounded" value={assignmentForm.description} onChange={e => setAssignmentForm({...assignmentForm, description: e.target.value})}></textarea>
                            <input type="datetime-local" required className="w-full border p-3 rounded" value={assignmentForm.deadline} onChange={e => setAssignmentForm({...assignmentForm, deadline: e.target.value})} />
                            <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-6 rounded hover:bg-blue-700">Publish Assignment</button>
                        </form>
                    )}

                    {activeTab === 'submissions' && (
                        <div>
                            <h3 className="text-xl font-bold mb-4">Plagiarism Report</h3>
                            <div className="flex gap-2 mb-6">
                                <input type="number" id="assign_search" placeholder="Assignment ID" className="border p-2 rounded-lg outline-none" />
                                <button onClick={() => fetchSubmissions(document.getElementById('assign_search').value)} className="bg-indigo-600 text-white px-4 rounded-lg hover:bg-indigo-700">Search Submissions</button>
                            </div>

                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="p-3 border">Student Name</th>
                                        <th className="p-3 border">Submission Date</th>
                                        <th className="p-3 border">Sim. Score</th>
                                        <th className="p-3 border">Matched With ID</th>
                                        <th className="p-3 border">Status</th>
                                        <th className="p-3 border">File</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.map((s, i) => (
                                        <tr key={i} className={`hover:bg-gray-50 ${s.similarity_score > 0.8 ? 'bg-red-50' : ''}`}>
                                            <td className="p-3 border">{s.student_name}</td>
                                            <td className="p-3 border">{new Date(s.submitted_at).toLocaleString()}</td>
                                            <td className="p-3 border font-bold text-lg text-center">
                                                <span className={s.similarity_score > 0.8 ? 'text-red-600' : 'text-green-600'}>
                                                    {(s.similarity_score * 100).toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="p-3 border">{s.matched_with || '-'}</td>
                                            <td className="p-3 border">{s.is_late ? <span className="text-red-500 font-bold">LATE</span> : 'ON TIME'}</td>
                                            <td className="p-3 border"><a href={s.file_url} target="_blank" className="text-blue-600 underline text-sm">Download</a></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'manage_students' && (
                        <div>
                            {/* Toggle between Add Students & Enrolled Students */}
                            <div className="flex items-center gap-4 mb-6">
                                <button
                                    onClick={() => setStudentView('add')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                        studentView === 'add' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    <span className="flex items-center gap-2"><UserPlus size={16} /> Add Students</span>
                                </button>
                                <button
                                    onClick={() => { setStudentView('enrolled'); fetchEnrolledStudents(); }}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                        studentView === 'enrolled' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    <span className="flex items-center gap-2"><Users size={16} /> Enrolled ({enrolledStudents.length})</span>
                                </button>
                            </div>

                            {studentView === 'add' && (
                                <div>
                                    {/* Filters Row */}
                                    <div className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-gray-50 rounded-xl border">
                                        <div className="flex items-center gap-2 text-gray-500 mr-2">
                                            <Filter size={18} />
                                            <span className="text-sm font-semibold">Filters</span>
                                        </div>
                                        <div className="flex-1 min-w-[160px]">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
                                            <input
                                                type="text"
                                                placeholder="Name or Roll No..."
                                                className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                                                value={studentFilters.search}
                                                onChange={(e) => setStudentFilters({ ...studentFilters, search: e.target.value })}
                                            />
                                        </div>
                                        <div className="min-w-[120px]">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Semester</label>
                                            <select
                                                className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                                                value={studentFilters.semester}
                                                onChange={(e) => setStudentFilters({ ...studentFilters, semester: e.target.value })}
                                            >
                                                <option value="">All Semesters</option>
                                                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                            </select>
                                        </div>
                                        <div className="min-w-[140px]">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. CSE"
                                                className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                                                value={studentFilters.department}
                                                onChange={(e) => setStudentFilters({ ...studentFilters, department: e.target.value })}
                                            />
                                        </div>
                                        <button
                                            onClick={fetchAllStudents}
                                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                                        >
                                            Apply
                                        </button>
                                        {(studentFilters.semester || studentFilters.department || studentFilters.search) && (
                                            <button
                                                onClick={() => { setStudentFilters({ semester: '', department: '', search: '' }); setTimeout(fetchAllStudents, 100); }}
                                                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-200 transition-colors"
                                                title="Clear filters"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Action Bar */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded accent-blue-600"
                                                checked={allStudents.filter(s => !enrolledIds.has(s.student_id)).length > 0 && allStudents.filter(s => !enrolledIds.has(s.student_id)).every(s => selectedStudentIds.has(s.student_id))}
                                                onChange={toggleSelectAllFiltered}
                                            />
                                            <span className="text-sm text-gray-600">
                                                {selectedStudentIds.size > 0
                                                    ? `${selectedStudentIds.size} student(s) selected`
                                                    : `${allStudents.length} student(s) found`}
                                            </span>
                                        </div>
                                        {selectedStudentIds.size > 0 && (
                                            <button
                                                onClick={handleEnrollSelected}
                                                disabled={enrolling}
                                                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 font-medium transition-colors disabled:opacity-50"
                                            >
                                                <UserPlus size={16} />
                                                {enrolling ? 'Enrolling...' : `Enroll ${selectedStudentIds.size} Student(s)`}
                                            </button>
                                        )}
                                    </div>

                                    {/* Students Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="p-3 border w-10"></th>
                                                    <th className="p-3 border">Roll No</th>
                                                    <th className="p-3 border">Name</th>
                                                    <th className="p-3 border">Department</th>
                                                    <th className="p-3 border">Semester</th>
                                                    <th className="p-3 border">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {allStudents.map((s) => {
                                                    const isEnrolled = enrolledIds.has(s.student_id);
                                                    return (
                                                        <tr key={s.student_id} className={`hover:bg-gray-50 ${isEnrolled ? 'bg-green-50 opacity-60' : ''}`}>
                                                            <td className="p-3 border text-center">
                                                                {!isEnrolled && (
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-4 h-4 accent-blue-600"
                                                                        checked={selectedStudentIds.has(s.student_id)}
                                                                        onChange={() => toggleStudentSelection(s.student_id)}
                                                                    />
                                                                )}
                                                            </td>
                                                            <td className="p-3 border font-mono text-sm">{s.roll_no}</td>
                                                            <td className="p-3 border font-medium">{s.name}</td>
                                                            <td className="p-3 border">{s.department}</td>
                                                            <td className="p-3 border text-center">{s.semester}</td>
                                                            <td className="p-3 border">
                                                                {isEnrolled ? (
                                                                    <span className="px-2 py-1 text-xs font-bold rounded bg-green-100 text-green-700">ENROLLED</span>
                                                                ) : (
                                                                    <span className="px-2 py-1 text-xs font-bold rounded bg-gray-100 text-gray-500">NOT ENROLLED</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        {allStudents.length === 0 && (
                                            <div className="py-12 text-center text-gray-400">
                                                <Users size={40} className="mx-auto mb-3 opacity-30" />
                                                <p>No students found. Try adjusting your filters.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {studentView === 'enrolled' && (
                                <div>
                                    <h3 className="text-xl font-bold mb-4">Enrolled Students ({enrolledStudents.length})</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="p-3 border">Roll No</th>
                                                    <th className="p-3 border">Name</th>
                                                    <th className="p-3 border">Email</th>
                                                    <th className="p-3 border">Department</th>
                                                    <th className="p-3 border">Semester</th>
                                                    <th className="p-3 border">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {enrolledStudents.map((s) => (
                                                    <tr key={s.student_id} className="hover:bg-gray-50">
                                                        <td className="p-3 border font-mono text-sm">{s.roll_no}</td>
                                                        <td className="p-3 border font-medium">{s.name}</td>
                                                        <td className="p-3 border text-sm text-gray-500">{s.email}</td>
                                                        <td className="p-3 border">{s.department}</td>
                                                        <td className="p-3 border text-center">{s.semester}</td>
                                                        <td className="p-3 border">
                                                            <button
                                                                onClick={() => handleUnenroll(s.student_id)}
                                                                className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm font-medium hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                                            >
                                                                <UserMinus size={14} /> Remove
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {enrolledStudents.length === 0 && (
                                            <div className="py-12 text-center text-gray-400">
                                                <Users size={40} className="mx-auto mb-3 opacity-30" />
                                                <p>No students enrolled yet. Go to "Add Students" to enroll students.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
