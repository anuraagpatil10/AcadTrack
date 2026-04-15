"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';
import { CheckSquare, FileText, ClipboardList, BookOpen, LogOut, PlusCircle, Upload, Search, ArrowLeft, Layers, Users, UserPlus, UserMinus, Filter, X, Clock, Calendar, XCircle, CalendarPlus, Trash2, Play, Square, AlertTriangle, BarChart2, Eye, Shield, List, ChevronRight, Trophy, Award, Target, Hash, TrendingUp, TrendingDown } from 'lucide-react';
import api from '@/lib/api';

export default function ProfessorDashboard() {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('attendance');
    const [selectedCourse, setSelectedCourse] = useState(null);

    // Data states
    const [attendanceData, setAttendanceData] = useState([]);
    const [marksData, setMarksData] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [submissionDetailLoading, setSubmissionDetailLoading] = useState(false);
    const [assignmentsList, setAssignmentsList] = useState([]);
    const [assignmentsLoading, setAssignmentsLoading] = useState(false);
    const [assignmentView, setAssignmentView] = useState('list'); // 'list' | 'create' | 'detail'
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [plagiarismReport, setPlagiarismReport] = useState(null);
    const [plagiarismLoading, setPlagiarismLoading] = useState(false);

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

    // Quiz management states
    const [quizzes, setQuizzes] = useState([]);
    const [quizSubView, setQuizSubView] = useState('list');
    const [selectedQuiz, setSelectedQuiz] = useState(null);
    const [quizResults, setQuizResults] = useState(null);
    const [quizViolationLogs, setQuizViolationLogs] = useState([]);
    const [quizAnalytics, setQuizAnalytics] = useState(null);

    // Marks upload states
    const [marksStudentData, setMarksStudentData] = useState([]);
    const [marksUploading, setMarksUploading] = useState(false);
    const [marksSubView, setMarksSubView] = useState('upload'); // 'upload' | 'analytics'

    const [isTracking, setIsTracking] = useState(false);
    const [locationError, setLocationError] = useState('');
    const trackingIntervalRef = useRef(null);
    const trackingOriginRef = useRef('manual');
    const lectureSessionRef = useRef(null);

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
            if (!assignmentId) {
                alert('Please enter an Assignment ID');
                return;
            }
            const { data } = await api.get(`/assignment/${assignmentId}/submissions`);
            setSubmissions(data);
        } catch (err) {
            const msg =
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                err?.message ||
                'Failed to fetch submissions';
            alert(msg);
        }
    };

    const fetchAssignments = async () => {
        if (!subjectId) return;
        setAssignmentsLoading(true);
        try {
            const { data } = await api.get(`/assignment/subject/${subjectId}`);
            setAssignmentsList(Array.isArray(data) ? data : []);
        } catch (err) {
            alert(err?.response?.data?.error || 'Failed to fetch assignments');
        } finally {
            setAssignmentsLoading(false);
        }
    };

    const fetchPlagiarismReport = async (assignmentId) => {
        if (!assignmentId) return;
        setPlagiarismLoading(true);
        try {
            const { data } = await api.get(`/assignment/${assignmentId}/plagiarism`);
            setPlagiarismReport(data);
        } catch (err) {
            alert(err?.response?.data?.error || 'Failed to fetch plagiarism report');
        } finally {
            setPlagiarismLoading(false);
        }
    };

    const openAssignmentDashboard = async (assignment) => {
        setSelectedAssignment(assignment);
        setAssignmentView('detail');
        setPlagiarismReport(null);
        setSubmissions([]);
        await Promise.all([
            fetchSubmissions(assignment.id),
            fetchPlagiarismReport(assignment.id),
        ]);
    };

    const openSubmission = async (submissionId) => {
        setSubmissionDetailLoading(true);
        try {
            const { data } = await api.get(`/assignment/submission/${submissionId}`);
            setSelectedSubmission(data);
        } catch (err) {
            alert('Failed to load submission details');
        } finally {
            setSubmissionDetailLoading(false);
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
            setAssignmentView('list');
            fetchAssignments();
        } catch (err) {
            alert('Failed to create assignment');
        }
    };

    const handleUploadMarks = async (e) => {
        e.preventDefault();
        const marksToUpload = marksStudentData
            .filter(s => s.marks_obtained !== '' && s.marks_obtained !== undefined)
            .map(s => ({ student_id: s.student_id, marks_obtained: Number(s.marks_obtained) }));

        if (marksToUpload.length === 0) return alert('Please enter marks for at least one student');
        setMarksUploading(true);
        try {
            await api.post('/marks/upload', {
                subject_id: subjectId,
                exam_type: marksForm.exam_type,
                max_marks: Number(marksForm.max_marks),
                marks: marksToUpload
            });
            alert(`Marks uploaded for ${marksToUpload.length} student(s)!`);
            fetchSubjectData();
        } catch (err) {
            alert('Failed to upload marks');
        } finally {
            setMarksUploading(false);
        }
    };

    const fetchMarksStudents = async () => {
        if (!subjectId) return;
        try {
            const { data } = await api.get(`/course/${subjectId}/enrolled`);
            setMarksStudentData(data.map(s => ({ ...s, marks_obtained: '' })));
        } catch (err) {
            console.error(err);
        }
    };

    const updateStudentMark = (studentId, value) => {
        setMarksStudentData(prev => prev.map(s =>
            s.student_id === studentId ? { ...s, marks_obtained: value } : s
        ));
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

    const deleteQuestion = (index) => {
        const newQs = quizForm.questions.filter((_, i) => i !== index);
        setQuizForm({ ...quizForm, questions: newQs });
    };

    // Quiz management functions
    const fetchQuizzes = async () => {
        if (!subjectId) return;
        try {
            const { data } = await api.get(`/quiz/subject/${subjectId}`);
            setQuizzes(data);
        } catch (err) { console.error(err); }
    };

    const fetchQuizResults = async (quizId) => {
        try {
            const { data } = await api.get(`/quiz/${quizId}/results`);
            setQuizResults(data);
            setSelectedQuiz(data.quiz);
        } catch (err) { console.error(err); }
    };

    const fetchQuizViolations = async (quizId) => {
        try {
            const { data } = await api.get(`/quiz/${quizId}/violations`);
            setQuizViolationLogs(data);
        } catch (err) { console.error(err); }
    };

    const fetchQuizAnalytics = async (quizId) => {
        try {
            const { data } = await api.get(`/quiz/${quizId}/analytics`);
            setQuizAnalytics(data);
        } catch (err) { console.error(err); }
    };

    const startTrackingSequence = (origin = 'manual') => {
        trackingOriginRef.current = origin;
        if (!navigator.geolocation) {
            setLocationError('Geolocation not supported');
            return;
        }

        navigator.geolocation.getCurrentPosition(async (pos) => {
            setLocationError('');
            setIsTracking(true);
            const { latitude, longitude } = pos.coords;
            try {
                const { data } = await api.post('/attendance/professor/start', { subject_id: selectedCourse.id, latitude, longitude });
                lectureSessionRef.current = data.lecture_session_id;
                
                // Start pinging
                trackingIntervalRef.current = setInterval(() => {
                    navigator.geolocation.getCurrentPosition(async (p) => {
                        await api.post('/attendance/professor/ping', { lecture_session_id: lectureSessionRef.current, latitude: p.coords.latitude, longitude: p.coords.longitude });
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
            await api.post('/attendance/professor/complete', { lecture_session_id: lectureSessionRef.current });
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
        { id: 'quiz_manage', name: 'Quiz Management', icon: ClipboardList },
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
                                if (t.id === 'create_assignment') {
                                    setAssignmentView('list');
                                    setSelectedAssignment(null);
                                    setPlagiarismReport(null);
                                    setSubmissions([]);
                                    fetchAssignments();
                                }
                                if (t.id === 'manage_students') {
                                    fetchAllStudents();
                                    fetchEnrolledStudents();
                                }
                                if (t.id === 'quiz_manage') {
                                    fetchQuizzes();
                                    setQuizSubView('list');
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
                    {/* Submission detail modal (used across tabs) */}
                    {selectedSubmission && (
                        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
                            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border overflow-hidden">
                                <div className="p-4 border-b flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Submission</p>
                                        <h4 className="text-lg font-bold text-gray-800">
                                            {selectedSubmission.student_name} ({selectedSubmission.roll_no})
                                        </h4>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {new Date(selectedSubmission.submitted_at).toLocaleString()} • {selectedSubmission.code_language || 'code'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedSubmission(null)}
                                        className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium flex items-center gap-2"
                                    >
                                        <X size={16} /> Close
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

                    {activeTab === 'quiz_manage' && (
                        <div>
                            {/* Quiz Sub-navigation */}
                            <div className="flex items-center gap-3 mb-6 flex-wrap">
                                {[
                                    { id: 'list', label: 'All Quizzes', icon: List },
                                    { id: 'create', label: 'Create Quiz', icon: PlusCircle },
                                    ...(selectedQuiz ? [
                                        { id: 'results', label: 'Results', icon: Eye },
                                        { id: 'violations', label: 'Violations', icon: AlertTriangle },
                                        { id: 'analytics', label: 'Analytics', icon: BarChart2 },
                                    ] : [])
                                ].map(v => (
                                    <button key={v.id} onClick={() => {
                                        setQuizSubView(v.id);
                                        if (v.id === 'list') fetchQuizzes();
                                        if (v.id === 'results' && selectedQuiz) fetchQuizResults(selectedQuiz.id);
                                        if (v.id === 'violations' && selectedQuiz) fetchQuizViolations(selectedQuiz.id);
                                        if (v.id === 'analytics' && selectedQuiz) fetchQuizAnalytics(selectedQuiz.id);
                                    }}
                                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${quizSubView === v.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                        <v.icon size={16} /> {v.label}
                                    </button>
                                ))}
                                {selectedQuiz && (
                                    <span className="ml-auto text-sm text-gray-500 flex items-center gap-2">
                                        <Shield size={14} className="text-indigo-500" />
                                        Viewing: <span className="font-bold text-gray-700">{selectedQuiz.title}</span>
                                        <button onClick={() => { setSelectedQuiz(null); setQuizSubView('list'); }} className="text-gray-400 hover:text-red-500 ml-1"><X size={14} /></button>
                                    </span>
                                )}
                            </div>

                            {/* Quiz List */}
                            {quizSubView === 'list' && (
                                <div>
                                    <h3 className="text-xl font-bold mb-4">All Quizzes</h3>
                                    {quizzes.length === 0 ? (
                                        <div className="text-center py-12 text-gray-400">
                                            <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
                                            <p>No quizzes created yet.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {quizzes.map(q => {
                                                const now = new Date();
                                                const start = new Date(q.start_time);
                                                const end = new Date(q.end_time);
                                                const isLive = now >= start && now <= end;
                                                const isUpcoming = now < start;
                                                const isExpired = now > end;

                                                return (
                                                    <div key={q.id} className={`p-5 border rounded-xl flex items-center justify-between hover:shadow-md transition-all ${
                                                        isLive ? 'border-green-200 bg-green-50/50' : ''
                                                    }`}>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-1">
                                                                <h4 className="font-bold text-lg">{q.title}</h4>
                                                                {isLive && <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-700 animate-pulse">● LIVE</span>}
                                                                {isUpcoming && <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-700">Upcoming</span>}
                                                                {isExpired && <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-gray-100 text-gray-500">Ended</span>}
                                                            </div>
                                                            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                                                                <span>{q.question_count || 0} questions</span>
                                                                <span>⏱ {q.duration} mins</span>
                                                                <span>{q.submission_count || 0} submissions</span>
                                                                <span>{start.toLocaleString()} → {end.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedQuiz(q);
                                                                setQuizSubView('results');
                                                                fetchQuizResults(q.id);
                                                            }}
                                                            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium transition-colors"
                                                        >
                                                            <Eye size={16} /> View Details <ChevronRight size={14} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Create Quiz */}
                            {quizSubView === 'create' && (
                                <form onSubmit={async (e) => { await handleCreateQuiz(e); fetchQuizzes(); setQuizSubView('list'); }} className="space-y-4">
                                    <h3 className="text-xl font-bold mb-4">Create New Quiz</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Quiz Title</label>
                                            <input type="text" placeholder="e.g. Midterm Quiz 1" required className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none" value={quizForm.title} onChange={e => setQuizForm({...quizForm, title: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Duration (minutes)</label>
                                            <input type="number" placeholder="30" required className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none" value={quizForm.duration} onChange={e => setQuizForm({...quizForm, duration: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Start Time</label>
                                            <input type="datetime-local" required className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none" value={quizForm.start_time} onChange={e => setQuizForm({...quizForm, start_time: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">End Time</label>
                                            <input type="datetime-local" required className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none" value={quizForm.end_time} onChange={e => setQuizForm({...quizForm, end_time: e.target.value})} />
                                        </div>
                                    </div>

                                    <div className="border border-dashed p-5 rounded-xl bg-gray-50">
                                        <h4 className="font-bold mb-3 flex items-center gap-2"><ClipboardList size={18} /> Questions ({quizForm.questions.length})</h4>
                                        {quizForm.questions.map((q, i) => (
                                            <div key={i} className="mb-4 p-4 border rounded-lg bg-white relative group">
                                                <button type="button" onClick={() => deleteQuestion(i)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove question">
                                                    <Trash2 size={16} />
                                                </button>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">Q{i+1}</span>
                                                    <input type="text" placeholder={`Question ${i+1}`} className="flex-1 border p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" value={q.question} onChange={e => updateQuestion(i, 'question', e.target.value)} required />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 mb-3">
                                                    <input type="text" placeholder="Option A" className="border p-2 rounded-lg text-sm" value={q.option_a} onChange={e => updateQuestion(i, 'option_a', e.target.value)} required />
                                                    <input type="text" placeholder="Option B" className="border p-2 rounded-lg text-sm" value={q.option_b} onChange={e => updateQuestion(i, 'option_b', e.target.value)} required />
                                                    <input type="text" placeholder="Option C" className="border p-2 rounded-lg text-sm" value={q.option_c} onChange={e => updateQuestion(i, 'option_c', e.target.value)} required />
                                                    <input type="text" placeholder="Option D" className="border p-2 rounded-lg text-sm" value={q.option_d} onChange={e => updateQuestion(i, 'option_d', e.target.value)} required />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-sm font-bold text-gray-600">Correct:</label>
                                                    <div className="flex gap-1">
                                                        {['A','B','C','D'].map(opt => (
                                                            <button key={opt} type="button" onClick={() => updateQuestion(i, 'correct_answer', opt)}
                                                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                                                    q.correct_answer === opt ? 'bg-emerald-600 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                                }`}>
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <button type="button" onClick={addQuestion} className="flex items-center gap-2 text-blue-600 font-bold hover:underline text-sm">
                                            <PlusCircle size={16} /> Add Question
                                        </button>
                                    </div>
                                    <button type="submit" className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">Save Quiz</button>
                                </form>
                            )}

                            {/* Quiz Results */}
                            {quizSubView === 'results' && quizResults && (
                                <div>
                                    <h3 className="text-xl font-bold mb-4">Student Results — {quizResults.quiz?.title}</h3>
                                    {quizResults.results.length === 0 ? (
                                        <div className="text-center py-12 text-gray-400">
                                            <Eye size={40} className="mx-auto mb-3 opacity-30" />
                                            <p>No submissions yet for this quiz.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-100">
                                                        <th className="p-3 border text-sm">#</th>
                                                        <th className="p-3 border text-sm">Roll No</th>
                                                        <th className="p-3 border text-sm">Student Name</th>
                                                        <th className="p-3 border text-sm text-center">Score</th>
                                                        <th className="p-3 border text-sm text-center">Violations</th>
                                                        <th className="p-3 border text-sm">Submitted At</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {quizResults.results.map((r, i) => (
                                                        <tr key={r.submission_id} className={`hover:bg-gray-50 ${r.violation_count > 0 ? 'bg-red-50/50' : ''}`}>
                                                            <td className="p-3 border text-sm text-gray-400">{i + 1}</td>
                                                            <td className="p-3 border font-mono text-sm">{r.roll_no}</td>
                                                            <td className="p-3 border font-medium">{r.student_name}</td>
                                                            <td className="p-3 border text-center">
                                                                <span className={`text-lg font-bold ${
                                                                    (r.score / r.total_questions) >= 0.4 ? 'text-emerald-600' : 'text-red-600'
                                                                }`}>
                                                                    {r.score}
                                                                </span>
                                                                <span className="text-gray-400 text-sm">/{r.total_questions}</span>
                                                            </td>
                                                            <td className="p-3 border text-center">
                                                                {r.violation_count > 0 ? (
                                                                    <span className="px-2 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700 flex items-center gap-1 justify-center w-fit mx-auto">
                                                                        <AlertTriangle size={12} /> {r.violation_count}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-emerald-500 text-xs font-medium">Clean</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 border text-sm text-gray-500">{new Date(r.submitted_at).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Violation Logs */}
                            {quizSubView === 'violations' && (
                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <AlertTriangle size={22} className="text-red-500" /> Violation Logs — {selectedQuiz?.title}
                                    </h3>
                                    {quizViolationLogs.length === 0 ? (
                                        <div className="text-center py-12 text-gray-400">
                                            <Shield size={40} className="mx-auto mb-3 opacity-30" />
                                            <p>No violations recorded. All students behaved!</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-red-50">
                                                        <th className="p-3 border text-sm">Roll No</th>
                                                        <th className="p-3 border text-sm">Student Name</th>
                                                        <th className="p-3 border text-sm">Violation Type</th>
                                                        <th className="p-3 border text-sm">Timestamp</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {quizViolationLogs.map((v) => (
                                                        <tr key={v.id} className="hover:bg-red-50/50">
                                                            <td className="p-3 border font-mono text-sm">{v.roll_no}</td>
                                                            <td className="p-3 border font-medium">{v.student_name}</td>
                                                            <td className="p-3 border">
                                                                <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                                                                    v.type === 'Tab Switch' ? 'bg-amber-100 text-amber-700' :
                                                                    v.type === 'Exited Fullscreen' ? 'bg-red-100 text-red-700' :
                                                                    'bg-purple-100 text-purple-700'
                                                                }`}>
                                                                    {v.type}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 border text-sm text-gray-500">{new Date(v.timestamp).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Analytics */}
                            {quizSubView === 'analytics' && quizAnalytics && (
                                <div>
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <BarChart2 size={22} className="text-blue-600" /> Quiz Analytics — {selectedQuiz?.title}
                                    </h3>

                                    {/* Stats Cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
                                            <p className="text-3xl font-bold text-blue-700">{quizAnalytics.total_submissions}</p>
                                            <p className="text-xs text-blue-500 font-medium mt-1">Total Submissions</p>
                                        </div>
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
                                            <p className="text-3xl font-bold text-emerald-700">{quizAnalytics.avg_score}</p>
                                            <p className="text-xs text-emerald-500 font-medium mt-1">Average Score (/{quizAnalytics.total_questions})</p>
                                        </div>
                                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-center">
                                            <p className="text-3xl font-bold text-purple-700">{quizAnalytics.pass_count}/{quizAnalytics.total_submissions}</p>
                                            <p className="text-xs text-purple-500 font-medium mt-1">Pass Rate (≥{quizAnalytics.pass_threshold})</p>
                                        </div>
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                                            <p className="text-3xl font-bold text-red-700">{quizAnalytics.violations?.total_violations || 0}</p>
                                            <p className="text-xs text-red-500 font-medium mt-1">Total Violations ({quizAnalytics.violations?.students_with_violations || 0} students)</p>
                                        </div>
                                    </div>

                                    {/* Score Distribution */}
                                    {quizAnalytics.score_distribution.length > 0 && (
                                        <div className="bg-white border rounded-xl p-5 mb-6">
                                            <h4 className="font-bold mb-4">Score Distribution</h4>
                                            <div className="flex items-end gap-1 h-40">
                                                {Array.from({length: quizAnalytics.total_questions + 1}, (_, i) => {
                                                    const entry = quizAnalytics.score_distribution.find(d => d.score === i);
                                                    const count = entry ? parseInt(entry.count) : 0;
                                                    const maxCount = Math.max(...quizAnalytics.score_distribution.map(d => parseInt(d.count)), 1);
                                                    const height = count > 0 ? Math.max((count / maxCount) * 100, 8) : 4;
                                                    return (
                                                        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                                                            {count > 0 && <span className="text-xs font-bold text-gray-500">{count}</span>}
                                                            <div
                                                                className={`w-full rounded-t-md transition-all ${count > 0 ? (i >= quizAnalytics.pass_threshold ? 'bg-emerald-500' : 'bg-red-400') : 'bg-gray-200'}`}
                                                                style={{ height: `${height}%` }}
                                                                title={`Score ${i}: ${count} student(s)`}
                                                            />
                                                            <span className="text-xs text-gray-400">{i}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-2 text-center">Score →</p>
                                        </div>
                                    )}

                                    {/* Question-wise Accuracy */}
                                    {quizAnalytics.question_stats.length > 0 && (
                                        <div className="bg-white border rounded-xl p-5">
                                            <h4 className="font-bold mb-4">Question-wise Accuracy</h4>
                                            <div className="space-y-3">
                                                {quizAnalytics.question_stats.map((qs, i) => {
                                                    const accuracy = qs.total_attempts > 0 ? Math.round((qs.correct_count / qs.total_attempts) * 100) : 0;
                                                    return (
                                                        <div key={qs.id} className="flex items-center gap-4">
                                                            <span className="text-sm font-bold text-gray-400 w-8">Q{i + 1}</span>
                                                            <div className="flex-1">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-sm text-gray-600 truncate max-w-md">{qs.question}</span>
                                                                    <span className={`text-sm font-bold ${accuracy >= 60 ? 'text-emerald-600' : accuracy >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                                                                        {accuracy}%
                                                                    </span>
                                                                </div>
                                                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                                            accuracy >= 60 ? 'bg-emerald-500' : accuracy >= 30 ? 'bg-amber-500' : 'bg-red-500'
                                                                        }`}
                                                                        style={{ width: `${accuracy}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <span className="text-xs text-gray-400 w-16 text-right">{qs.correct_count}/{qs.total_attempts}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'marks_upload' && (
                        <div>
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Upload size={22} className="text-blue-600" /> Upload Marks</h3>

                            {/* Exam Config */}
                            <div className="bg-gray-50 border rounded-xl p-5 mb-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Exam Type</label>
                                        <select className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none" value={marksForm.exam_type} onChange={e => setMarksForm({...marksForm, exam_type: e.target.value})}>
                                            <option value="midsem">Midsem</option>
                                            <option value="endsem">Endsem</option>
                                            <option value="quiz">Quiz</option>
                                            <option value="assignment">Assignment</option>
                                            <option value="practical">Practical</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Max Marks</label>
                                        <input type="number" placeholder="100" required className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none" value={marksForm.max_marks} onChange={e => setMarksForm({...marksForm, max_marks: e.target.value})} />
                                    </div>
                                    <div className="flex items-end">
                                        <button type="button" onClick={fetchMarksStudents} className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                                            <Users size={18} /> Load Enrolled Students
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Student Marks Table */}
                            {marksStudentData.length > 0 && (
                                <form onSubmit={handleUploadMarks}>
                                    <div className="overflow-x-auto mb-4">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="p-3 border text-sm">#</th>
                                                    <th className="p-3 border text-sm">Roll No</th>
                                                    <th className="p-3 border text-sm">Student Name</th>
                                                    <th className="p-3 border text-sm">Department</th>
                                                    <th className="p-3 border text-sm w-40">Marks (/{marksForm.max_marks})</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {marksStudentData.map((s, i) => (
                                                    <tr key={s.student_id} className="hover:bg-gray-50">
                                                        <td className="p-3 border text-sm text-gray-400">{i + 1}</td>
                                                        <td className="p-3 border font-mono text-sm">{s.roll_no}</td>
                                                        <td className="p-3 border font-medium">{s.name}</td>
                                                        <td className="p-3 border text-sm text-gray-500">{s.department}</td>
                                                        <td className="p-3 border">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={marksForm.max_marks}
                                                                placeholder="--"
                                                                className="w-full border p-2 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-400 outline-none"
                                                                value={s.marks_obtained}
                                                                onChange={e => updateStudentMark(s.student_id, e.target.value)}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">
                                            {marksStudentData.filter(s => s.marks_obtained !== '' && s.marks_obtained !== undefined).length} of {marksStudentData.length} students have marks entered
                                        </span>
                                        <button type="submit" disabled={marksUploading}
                                            className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                                            <Upload size={18} />
                                            {marksUploading ? 'Uploading...' : 'Upload Marks'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {marksStudentData.length === 0 && (
                                <div className="text-center py-12 text-gray-400 border border-dashed rounded-xl">
                                    <Users size={40} className="mx-auto mb-3 opacity-30" />
                                    <p>Click "Load Enrolled Students" to start entering marks.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'marks_view' && (
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <BarChart2 size={22} className="text-purple-600" /> Class Performance Dashboard
                                </h3>
                                <button onClick={fetchSubjectData} className="bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700 font-medium transition-colors flex items-center gap-2 text-sm">
                                    <BarChart2 size={16} /> Refresh Data
                                </button>
                            </div>

                            {!marksData ? (
                                <div className="text-center py-12 text-gray-400 border border-dashed rounded-xl">
                                    <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
                                    <p>Click "Refresh Data" to load analytics.</p>
                                </div>
                            ) : Object.keys(marksData.analytics).length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
                                    <p>No marks data available. Upload marks first.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Per exam type analytics */}
                                    {Object.entries(marksData.analytics).map(([type, stats]) => (
                                        <div key={type} className="bg-white border rounded-xl p-6">
                                            <h4 className="text-lg font-bold mb-4 capitalize flex items-center gap-2">
                                                <Award size={20} className="text-amber-500" />
                                                {type} Exam Analytics
                                                <span className="ml-auto text-sm font-normal text-gray-400">Max Marks: {stats.max_marks}</span>
                                            </h4>

                                            {/* Stats Cards */}
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                                                    <p className="text-2xl font-bold text-blue-700">{stats.avg?.toFixed(1)}</p>
                                                    <p className="text-xs text-blue-500 font-medium">Average</p>
                                                </div>
                                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                                                    <p className="text-2xl font-bold text-emerald-700">{stats.max}</p>
                                                    <p className="text-xs text-emerald-500 font-medium">Highest</p>
                                                </div>
                                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                                                    <p className="text-2xl font-bold text-red-700">{stats.min}</p>
                                                    <p className="text-xs text-red-500 font-medium">Lowest</p>
                                                </div>
                                                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                                                    <p className="text-2xl font-bold text-purple-700">{stats.median}</p>
                                                    <p className="text-xs text-purple-500 font-medium">Median</p>
                                                </div>
                                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                                                    <p className="text-2xl font-bold text-gray-700">{stats.count}</p>
                                                    <p className="text-xs text-gray-500 font-medium">Students</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                                {/* Pass/Fail */}
                                                <div className="bg-gray-50 rounded-xl p-5">
                                                    <h5 className="font-bold text-sm text-gray-600 mb-3">Pass / Fail Distribution</h5>
                                                    <div className="flex items-center gap-4 mb-3">
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-sm text-emerald-600 font-medium">Pass (&ge;40%)</span>
                                                                <span className="text-sm font-bold text-emerald-700">{stats.pass_count} ({stats.pass_rate}%)</span>
                                                            </div>
                                                            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.pass_rate}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-sm text-red-600 font-medium">Fail (&lt;40%)</span>
                                                                <span className="text-sm font-bold text-red-700">{stats.fail_count} ({100 - stats.pass_rate}%)</span>
                                                            </div>
                                                            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${100 - stats.pass_rate}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Grade Distribution */}
                                                {stats.grade_distribution && (
                                                    <div className="bg-gray-50 rounded-xl p-5">
                                                        <h5 className="font-bold text-sm text-gray-600 mb-3">Grade Distribution</h5>
                                                        <div className="flex items-end gap-2 h-28">
                                                            {Object.entries(stats.grade_distribution).map(([grade, count]) => {
                                                                const maxCount = Math.max(...Object.values(stats.grade_distribution), 1);
                                                                const height = count > 0 ? Math.max((count / maxCount) * 100, 8) : 4;
                                                                const colors = {
                                                                    'A+': 'bg-emerald-500', 'A': 'bg-green-500',
                                                                    'B+': 'bg-blue-500', 'B': 'bg-sky-500',
                                                                    'C': 'bg-amber-500', 'D': 'bg-orange-500', 'F': 'bg-red-500'
                                                                };
                                                                return (
                                                                    <div key={grade} className="flex-1 flex flex-col items-center justify-end gap-1">
                                                                        {count > 0 && <span className="text-xs font-bold text-gray-500">{count}</span>}
                                                                        <div className={`w-full rounded-t-md ${colors[grade] || 'bg-gray-400'}`} style={{ height: `${height}%` }} title={`${grade}: ${count}`} />
                                                                        <span className="text-xs font-bold text-gray-500">{grade}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Top Performers */}
                                            {stats.top_performers && stats.top_performers.length > 0 && (
                                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
                                                    <h5 className="font-bold text-sm text-amber-700 mb-3 flex items-center gap-2">
                                                        <Trophy size={16} /> Top Performers
                                                    </h5>
                                                    <div className="flex flex-wrap gap-3">
                                                        {stats.top_performers.map((tp, i) => (
                                                            <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${
                                                                i === 0 ? 'bg-yellow-50 border-yellow-300' :
                                                                i === 1 ? 'bg-gray-50 border-gray-300' :
                                                                i === 2 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'
                                                            }`}>
                                                                <span className={`font-bold text-lg ${
                                                                    i === 0 ? 'text-yellow-600' : i === 1 ? 'text-gray-500' : i === 2 ? 'text-orange-600' : 'text-gray-400'
                                                                }`}>#{i + 1}</span>
                                                                <div>
                                                                    <p className="font-bold text-sm text-gray-800">{tp.student_name}</p>
                                                                    <p className="text-xs text-gray-400">{tp.roll_no} • {tp.marks_obtained}/{stats.max_marks} ({tp.percentage}%)</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Score Distribution Histogram */}
                                            {stats.score_distribution && stats.score_distribution.length > 0 && (
                                                <div className="bg-gray-50 rounded-xl p-5 mb-6">
                                                    <h5 className="font-bold text-sm text-gray-600 mb-3">Score Distribution</h5>
                                                    <div className="flex items-end gap-1 h-32">
                                                        {stats.score_distribution.map((bucket, i) => {
                                                            const maxCount = Math.max(...stats.score_distribution.map(b => b.count), 1);
                                                            const height = bucket.count > 0 ? Math.max((bucket.count / maxCount) * 100, 5) : 3;
                                                            return (
                                                                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                                                                    {bucket.count > 0 && <span className="text-xs font-bold text-gray-500">{bucket.count}</span>}
                                                                    <div className="w-full bg-indigo-500 rounded-t-md" style={{ height: `${height}%` }} title={`${bucket.range}: ${bucket.count} students`} />
                                                                    <span className="text-xs text-gray-400 -rotate-45 origin-top-left">{bucket.range}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Full Student Marks Table */}
                                    <div className="bg-white border rounded-xl p-6">
                                        <h4 className="text-lg font-bold mb-4">Detailed Student Marks</h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-100">
                                                        <th className="p-3 border text-sm">#</th>
                                                        <th className="p-3 border text-sm">Roll No</th>
                                                        <th className="p-3 border text-sm">Name</th>
                                                        <th className="p-3 border text-sm">Exam</th>
                                                        <th className="p-3 border text-sm text-center">Marks</th>
                                                        <th className="p-3 border text-sm text-center">%</th>
                                                        <th className="p-3 border text-sm text-center">Grade</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {marksData.marks.map((m, i) => {
                                                        const pct = m.max_marks > 0 ? Math.round((m.marks_obtained / m.max_marks) * 100) : 0;
                                                        let grade = 'F';
                                                        if (pct >= 90) grade = 'A+';
                                                        else if (pct >= 80) grade = 'A';
                                                        else if (pct >= 70) grade = 'B+';
                                                        else if (pct >= 60) grade = 'B';
                                                        else if (pct >= 50) grade = 'C';
                                                        else if (pct >= 40) grade = 'D';
                                                        const gc = {
                                                            'A+': 'bg-emerald-100 text-emerald-700', 'A': 'bg-green-100 text-green-700',
                                                            'B+': 'bg-blue-100 text-blue-700', 'B': 'bg-sky-100 text-sky-700',
                                                            'C': 'bg-amber-100 text-amber-700', 'D': 'bg-orange-100 text-orange-700',
                                                            'F': 'bg-red-100 text-red-700'
                                                        };
                                                        return (
                                                            <tr key={i} className={`hover:bg-gray-50 ${pct < 40 ? 'bg-red-50/40' : ''}`}>
                                                                <td className="p-3 border text-sm text-gray-400">{i + 1}</td>
                                                                <td className="p-3 border font-mono text-sm">{m.roll_no}</td>
                                                                <td className="p-3 border font-medium">{m.student_name}</td>
                                                                <td className="p-3 border capitalize text-sm">{m.exam_type}</td>
                                                                <td className="p-3 border text-center">
                                                                    <span className="font-bold">{m.marks_obtained}</span>
                                                                    <span className="text-gray-400 text-sm">/{m.max_marks}</span>
                                                                </td>
                                                                <td className="p-3 border text-center">
                                                                    <span className={`font-bold ${pct >= 40 ? 'text-emerald-600' : 'text-red-600'}`}>{pct}%</span>
                                                                </td>
                                                                <td className="p-3 border text-center">
                                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${gc[grade]}`}>{grade}</span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'create_assignment' && (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">Assignments</h3>
                                    <p className="text-sm text-gray-500">Create, review submissions, and monitor plagiarism — assignment wise.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { setAssignmentView('list'); setSelectedAssignment(null); fetchAssignments(); }}
                                        className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm"
                                    >
                                        Refresh
                                    </button>
                                    <button
                                        onClick={() => { setAssignmentView('create'); setSelectedAssignment(null); }}
                                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center gap-2"
                                    >
                                        <PlusCircle size={16} /> Create New
                                    </button>
                                </div>
                            </div>

                            {assignmentView === 'create' && (
                                <form onSubmit={handleCreateAssignment} className="space-y-4 border rounded-2xl p-5 bg-blue-50/40">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-lg text-gray-800">New Assignment</h4>
                                        <button
                                            type="button"
                                            onClick={() => setAssignmentView('list')}
                                            className="px-3 py-2 rounded-lg bg-white border hover:bg-gray-50 text-gray-700 text-sm font-medium"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Title"
                                        required
                                        className="w-full border p-3 rounded-xl"
                                        value={assignmentForm.title}
                                        onChange={e => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                                    />
                                    <textarea
                                        placeholder="Description"
                                        rows="4"
                                        required
                                        className="w-full border p-3 rounded-xl"
                                        value={assignmentForm.description}
                                        onChange={e => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Deadline</label>
                                            <input
                                                type="datetime-local"
                                                required
                                                className="w-full border p-3 rounded-xl"
                                                value={assignmentForm.deadline}
                                                onChange={e => setAssignmentForm({ ...assignmentForm, deadline: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <button type="submit" className="bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700">
                                        Publish Assignment
                                    </button>
                                </form>
                            )}

                            {assignmentView === 'list' && (
                                <div className="space-y-4">
                                    {assignmentsLoading ? (
                                        <div className="flex items-center justify-center py-12 bg-white rounded-xl border">
                                            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    ) : assignmentsList.length === 0 ? (
                                        <div className="p-10 text-center text-gray-400 bg-white rounded-xl border border-dashed">
                                            <FileText size={44} className="mx-auto mb-3 opacity-30" />
                                            <p>No assignments published for this course yet.</p>
                                            <p className="text-xs mt-2">Click <span className="font-bold text-gray-500">Create New</span> to publish the first one.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {assignmentsList.map((a) => {
                                                const deadline = a.deadline ? new Date(a.deadline) : null;
                                                const pct = a.enrolled_count > 0 ? Math.round((Number(a.submission_count || 0) / Number(a.enrolled_count)) * 100) : 0;
                                                return (
                                                    <div key={a.id} className="bg-white border rounded-2xl p-5 hover:shadow-md transition-shadow">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex-1">
                                                                <h4 className="text-lg font-bold text-gray-800">{a.title}</h4>
                                                                {a.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.description}</p>}
                                                                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                                                                    <span className="px-2.5 py-1 rounded-full bg-gray-100 border">
                                                                        ID: <span className="font-mono font-bold">{a.id}</span>
                                                                    </span>
                                                                    {deadline && (
                                                                        <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
                                                                            Deadline: {deadline.toLocaleString()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => openAssignmentDashboard(a)}
                                                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shrink-0"
                                                            >
                                                                Open →
                                                            </button>
                                                        </div>

                                                        <div className="mt-4 pt-4 border-t">
                                                            <div className="flex items-center justify-between text-sm">
                                                                <span className="text-gray-500">Submissions</span>
                                                                <span className="font-bold text-gray-800">{a.submission_count}/{a.enrolled_count}</span>
                                                            </div>
                                                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                                                                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${Math.min(100, pct)}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {assignmentView === 'detail' && selectedAssignment && (
                                <div className="space-y-4">
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div>
                                            <button
                                                onClick={() => { setAssignmentView('list'); setSelectedAssignment(null); setPlagiarismReport(null); setSubmissions([]); }}
                                                className="text-sm font-medium text-gray-500 hover:text-gray-800"
                                            >
                                                ← Back to all assignments
                                            </button>
                                            <h4 className="text-2xl font-bold text-gray-800 mt-2">{selectedAssignment.title}</h4>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Assignment ID: <span className="font-mono font-bold">{selectedAssignment.id}</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => { fetchSubmissions(selectedAssignment.id); fetchPlagiarismReport(selectedAssignment.id); }}
                                                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm"
                                            >
                                                Refresh Data
                                            </button>
                                        </div>
                                    </div>

                                    {(plagiarismLoading) ? (
                                        <div className="flex items-center justify-center py-10 bg-white rounded-xl border">
                                            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    ) : plagiarismReport?.stats ? (
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                            {[
                                                { label: 'Total', value: plagiarismReport.stats.total, cls: 'bg-white' },
                                                { label: 'Flagged (≥50%)', value: plagiarismReport.stats.flagged, cls: 'bg-amber-50 border-amber-200' },
                                                { label: 'High Risk (≥80%)', value: plagiarismReport.stats.high_risk, cls: 'bg-red-50 border-red-200' },
                                                { label: 'Late', value: plagiarismReport.stats.late, cls: 'bg-orange-50 border-orange-200' },
                                                { label: 'Avg Similarity', value: `${Math.round((plagiarismReport.stats.avg_similarity || 0) * 100)}%`, cls: 'bg-indigo-50 border-indigo-200' },
                                            ].map((c, i) => (
                                                <div key={i} className={`border rounded-2xl p-4 ${c.cls}`}>
                                                    <p className="text-xs text-gray-500 font-medium">{c.label}</p>
                                                    <p className="text-2xl font-extrabold text-gray-900 mt-1">{c.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}

                                    {plagiarismReport?.pairs?.length > 0 && (
                                        <div className="bg-white border rounded-2xl p-5">
                                            <h5 className="font-bold text-gray-800 mb-2">Top Similarity Pairs</h5>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-50">
                                                            <th className="p-3 border text-sm">Student 1</th>
                                                            <th className="p-3 border text-sm">Student 2</th>
                                                            <th className="p-3 border text-sm text-center">Similarity</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {plagiarismReport.pairs.slice(0, 10).map((p, i) => (
                                                            <tr key={i} className="hover:bg-gray-50">
                                                                <td className="p-3 border text-sm">
                                                                    <span className="font-medium">{p.student1.name}</span>
                                                                    <span className="text-gray-400 ml-2 font-mono">{p.student1.roll_no}</span>
                                                                </td>
                                                                <td className="p-3 border text-sm">
                                                                    <span className="font-medium">{p.student2.name}</span>
                                                                    <span className="text-gray-400 ml-2 font-mono">{p.student2.roll_no}</span>
                                                                </td>
                                                                <td className="p-3 border text-center font-bold">
                                                                    {Math.round(p.similarity * 100)}%
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white border rounded-2xl p-5">
                                        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                                            <h5 className="font-bold text-gray-800">Student-wise Submissions</h5>
                                            <span className="text-xs text-gray-400">Click “View” to open the full code + details</span>
                                        </div>

                                        {submissions.length === 0 ? (
                                            <div className="py-10 text-center text-gray-400">
                                                <Users size={40} className="mx-auto mb-2 opacity-30" />
                                                <p>No submissions yet.</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-50">
                                                            <th className="p-3 border text-sm">Roll</th>
                                                            <th className="p-3 border text-sm">Student</th>
                                                            <th className="p-3 border text-sm">Submitted</th>
                                                            <th className="p-3 border text-sm">Language</th>
                                                            <th className="p-3 border text-sm text-center">Similarity</th>
                                                            <th className="p-3 border text-sm">Matched With</th>
                                                            <th className="p-3 border text-sm">Status</th>
                                                            <th className="p-3 border text-sm">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(() => {
                                                            const matchedMap = new Map();
                                                            const all = plagiarismReport?.submissions || [];
                                                            all.forEach(s => matchedMap.set(s.student_id, s));

                                                            return submissions.map((s, i) => {
                                                                const sim = Number(s.similarity_score || 0);
                                                                const matched = s.matched_with ? matchedMap.get(s.matched_with) : null;
                                                                const simCls =
                                                                    sim >= 0.8 ? 'bg-red-100 text-red-700' :
                                                                    sim >= 0.5 ? 'bg-amber-100 text-amber-700' :
                                                                    sim >= 0.3 ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-emerald-100 text-emerald-700';

                                                                return (
                                                                    <tr key={i} className={`hover:bg-gray-50 ${sim >= 0.8 ? 'bg-red-50/40' : ''}`}>
                                                                        <td className="p-3 border font-mono text-sm">{s.roll_no}</td>
                                                                        <td className="p-3 border font-medium">{s.student_name}</td>
                                                                        <td className="p-3 border text-sm">{new Date(s.submitted_at).toLocaleString()}</td>
                                                                        <td className="p-3 border text-sm text-gray-600">{s.code_language || '-'}</td>
                                                                        <td className="p-3 border text-center">
                                                                            <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${simCls}`}>
                                                                                {(sim * 100).toFixed(1)}%
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-3 border text-sm">
                                                                            {matched ? (
                                                                                <span>
                                                                                    <span className="font-medium">{matched.student_name}</span>
                                                                                    <span className="text-gray-400 ml-2 font-mono">{matched.roll_no}</span>
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-gray-400">-</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-3 border text-sm">
                                                                            {s.is_late
                                                                                ? <span className="font-bold text-orange-700">Late</span>
                                                                                : <span className="text-gray-600">On time</span>}
                                                                        </td>
                                                                        <td className="p-3 border">
                                                                            <button
                                                                                onClick={() => openSubmission(s.id)}
                                                                                className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-bold"
                                                                                disabled={submissionDetailLoading}
                                                                            >
                                                                                View
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            });
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'submissions' && (
                        <div>
                            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                                <div>
                                    <h3 className="text-2xl font-extrabold text-gray-900">Plagiarism Tracker</h3>
                                    <p className="text-sm text-gray-500 mt-1">Search any assignment to get instant insights, risky pairs, and student-wise similarity.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        id="assign_search"
                                        placeholder="Assignment ID"
                                        className="border p-2.5 rounded-xl outline-none w-44 focus:ring-2 focus:ring-indigo-300"
                                    />
                                    <button
                                        onClick={async () => {
                                            const id = document.getElementById('assign_search')?.value;
                                            await Promise.all([fetchSubmissions(id), fetchPlagiarismReport(id)]);
                                        }}
                                        className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 font-bold"
                                    >
                                        Analyze
                                    </button>
                                </div>
                            </div>

                            {/* Highlights */}
                            {plagiarismLoading ? (
                                <div className="flex items-center justify-center py-10 bg-white rounded-2xl border">
                                    <div className="w-9 h-9 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : plagiarismReport?.stats ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                        {[
                                            { label: 'Total', value: plagiarismReport.stats.total, cls: 'bg-white' },
                                            { label: 'Flagged (≥50%)', value: plagiarismReport.stats.flagged, cls: 'bg-amber-50 border-amber-200' },
                                            { label: 'High Risk (≥80%)', value: plagiarismReport.stats.high_risk, cls: 'bg-red-50 border-red-200' },
                                            { label: 'Late', value: plagiarismReport.stats.late, cls: 'bg-orange-50 border-orange-200' },
                                            { label: 'Avg Similarity', value: `${Math.round((plagiarismReport.stats.avg_similarity || 0) * 100)}%`, cls: 'bg-indigo-50 border-indigo-200' },
                                        ].map((c, i) => (
                                            <div key={i} className={`border rounded-2xl p-4 ${c.cls}`}>
                                                <p className="text-xs text-gray-500 font-medium">{c.label}</p>
                                                <p className="text-2xl font-extrabold text-gray-900 mt-1">{c.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Risk distribution bar */}
                                    {(() => {
                                        const total = Number(plagiarismReport.stats.total || 0);
                                        const high = Number(plagiarismReport.stats.high_risk || 0);
                                        const flagged = Number(plagiarismReport.stats.flagged || 0);
                                        const moderate = Math.max(0, flagged - high);
                                        const unique = Math.max(0, total - flagged);
                                        const pct = (n) => (total > 0 ? (n / total) * 100 : 0);
                                        return (
                                            <div className="bg-white border rounded-2xl p-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="font-bold text-gray-800">Risk Distribution</h4>
                                                    <span className="text-xs text-gray-400">Based on similarity thresholds</span>
                                                </div>
                                                <div className="w-full h-3 rounded-full overflow-hidden bg-gray-100 flex">
                                                    <div className="h-full bg-emerald-500" style={{ width: `${pct(unique)}%` }} title={`Unique: ${unique}`} />
                                                    <div className="h-full bg-amber-500" style={{ width: `${pct(moderate)}%` }} title={`Moderate: ${moderate}`} />
                                                    <div className="h-full bg-red-500" style={{ width: `${pct(high)}%` }} title={`High Risk: ${high}`} />
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-3 text-xs">
                                                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Unique: {unique}</span>
                                                    <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Moderate: {moderate}</span>
                                                    <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">High Risk: {high}</span>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Top pairs */}
                                    {plagiarismReport.pairs?.length > 0 && (
                                        <div className="bg-white border rounded-2xl p-5">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="font-bold text-gray-800">Top Similarity Pairs</h4>
                                                <span className="text-xs text-gray-400">Most suspicious pairs first</span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-50">
                                                            <th className="p-3 border text-sm">Student 1</th>
                                                            <th className="p-3 border text-sm">Student 2</th>
                                                            <th className="p-3 border text-sm text-center">Similarity</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {plagiarismReport.pairs.slice(0, 12).map((p, i) => (
                                                            <tr key={i} className="hover:bg-gray-50">
                                                                <td className="p-3 border text-sm">
                                                                    <span className="font-medium">{p.student1.name}</span>
                                                                    <span className="text-gray-400 ml-2 font-mono">{p.student1.roll_no}</span>
                                                                </td>
                                                                <td className="p-3 border text-sm">
                                                                    <span className="font-medium">{p.student2.name}</span>
                                                                    <span className="text-gray-400 ml-2 font-mono">{p.student2.roll_no}</span>
                                                                </td>
                                                                <td className="p-3 border text-center">
                                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                                                                        p.similarity >= 0.8 ? 'bg-red-100 text-red-700' :
                                                                        p.similarity >= 0.5 ? 'bg-amber-100 text-amber-700' :
                                                                        'bg-emerald-100 text-emerald-700'
                                                                    }`}>
                                                                        {Math.round(p.similarity * 100)}%
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-10 text-center text-gray-400 bg-white rounded-2xl border border-dashed">
                                    <Search size={42} className="mx-auto mb-3 opacity-30" />
                                    <p className="font-medium">Enter an Assignment ID and click Analyze.</p>
                                    <p className="text-xs mt-2">You’ll get stats, suspicious pairs, and student-wise similarity.</p>
                                </div>
                            )}

                            {/* Student-wise table */}
                            <div className="mt-5 bg-white border rounded-2xl p-5">
                                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                                    <h4 className="font-bold text-gray-800">Student-wise Submissions</h4>
                                    <span className="text-xs text-gray-400">Click “View code” to open the full submission.</span>
                                </div>

                                {submissions.length === 0 ? (
                                    <div className="py-10 text-center text-gray-400">
                                        <Users size={38} className="mx-auto mb-2 opacity-30" />
                                        <p>No submissions loaded.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50">
                                                    <th className="p-3 border text-sm">Student</th>
                                                    <th className="p-3 border text-sm">Submitted</th>
                                                    <th className="p-3 border text-sm">Lang</th>
                                                    <th className="p-3 border text-sm text-center">Similarity</th>
                                                    <th className="p-3 border text-sm">Matched With</th>
                                                    <th className="p-3 border text-sm">Status</th>
                                                    <th className="p-3 border text-sm">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {submissions.map((s, i) => {
                                                    const sim = Number(s.similarity_score || 0);
                                                    const badge =
                                                        sim >= 0.8 ? 'bg-red-100 text-red-700' :
                                                        sim >= 0.5 ? 'bg-amber-100 text-amber-700' :
                                                        sim >= 0.3 ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-emerald-100 text-emerald-700';
                                                    return (
                                                        <tr key={i} className={`hover:bg-gray-50 ${sim >= 0.8 ? 'bg-red-50/40' : ''}`}>
                                                            <td className="p-3 border">
                                                                <span className="font-medium">{s.student_name}</span>
                                                                {s.roll_no && <span className="text-gray-400 ml-2 font-mono text-xs">{s.roll_no}</span>}
                                                            </td>
                                                            <td className="p-3 border text-sm">{new Date(s.submitted_at).toLocaleString()}</td>
                                                            <td className="p-3 border text-sm text-gray-600">{s.code_language || '-'}</td>
                                                            <td className="p-3 border text-center">
                                                                <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${badge}`}>
                                                                    {(sim * 100).toFixed(1)}%
                                                                </span>
                                                            </td>
                                                            <td className="p-3 border text-sm">{s.matched_with || '-'}</td>
                                                            <td className="p-3 border text-sm">
                                                                {s.is_late ? <span className="font-bold text-orange-700">Late</span> : <span className="text-gray-600">On time</span>}
                                                            </td>
                                                            <td className="p-3 border">
                                                                <button
                                                                    onClick={() => openSubmission(s.id)}
                                                                    className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-bold"
                                                                    disabled={submissionDetailLoading}
                                                                >
                                                                    View code
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
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
