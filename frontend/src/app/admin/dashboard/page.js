"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { clearSession, getStoredToken, getStoredUser } from '@/lib/auth';

const initialUserForm = {
    name: '',
    email: '',
    password: '',
    role: 'student',
    roll_no: '',
    department: '',
    semester: '',
};

const initialSemesterForm = {
    name: '',
    department: '',
    semester_no: '',
    total_credits: '',
};

const initialCourseForm = {
    semester_id: '',
    name: '',
    code: '',
    professor_id: '',
    credits: '',
    course_type: 'compulsory',
    elective_group: '',
};

export default function AdminDashboard() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [userForm, setUserForm] = useState(initialUserForm);
    const [semesterForm, setSemesterForm] = useState(initialSemesterForm);
    const [courseForm, setCourseForm] = useState(initialCourseForm);
    const [professors, setProfessors] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [selectedSemesterId, setSelectedSemesterId] = useState('');
    const [semesterDetail, setSemesterDetail] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const storedUser = getStoredUser();
        const storedToken = getStoredToken();
        if (!storedUser || !storedToken) {
            clearSession();
            return router.push('/login');
        }

        const parsed = JSON.parse(storedUser);
        if (parsed.role !== 'admin') {
            return router.push('/login');
        }

        setUser(parsed);
        loadBaseData();
    }, []);

    const loadBaseData = async () => {
        try {
            const [profRes, semRes] = await Promise.all([
                api.get('/admin/professors'),
                api.get('/admin/semesters'),
            ]);
            setProfessors(profRes.data);
            setSemesters(semRes.data);
            if (!selectedSemesterId && semRes.data.length) {
                const firstSemesterId = semRes.data[0].id;
                setSelectedSemesterId(String(firstSemesterId));
                await loadSemesterDetail(firstSemesterId);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load admin data');
        }
    };

    const loadSemesterDetail = async (semesterId) => {
        if (!semesterId) return;
        try {
            const { data } = await api.get(`/admin/semesters/${semesterId}`);
            setSemesterDetail(data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load semester detail');
        }
    };

    const submitUser = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            await api.post('/admin/users', userForm);
            setMessage('User created successfully.');
            setUserForm(initialUserForm);
            loadBaseData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create user');
        }
    };

    const submitSemester = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const { data } = await api.post('/admin/semesters', {
                ...semesterForm,
                semester_no: Number(semesterForm.semester_no),
                total_credits: Number(semesterForm.total_credits),
            });
            setMessage('Semester created successfully.');
            setSemesterForm(initialSemesterForm);
            setSelectedSemesterId(String(data.id));
            await loadBaseData();
            await loadSemesterDetail(data.id);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create semester');
        }
    };

    const submitCourse = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            await api.post('/admin/courses', {
                ...courseForm,
                semester_id: Number(courseForm.semester_id),
                professor_id: Number(courseForm.professor_id),
                credits: Number(courseForm.credits),
                elective_group: courseForm.course_type === 'elective' ? courseForm.elective_group : '',
            });
            setMessage('Semester course created successfully.');
            const semesterId = courseForm.semester_id;
            setCourseForm(initialCourseForm);
            await loadBaseData();
            if (semesterId) {
                setSelectedSemesterId(String(semesterId));
                await loadSemesterDetail(semesterId);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create semester course');
        }
    };

    const toggleRegistration = async (semesterId, nextState) => {
        setError('');
        setMessage('');
        try {
            await api.patch(`/admin/semesters/${semesterId}/registration`, { registration_open: nextState });
            setMessage(nextState ? 'Registration opened.' : 'Registration closed.');
            await loadBaseData();
            await loadSemesterDetail(semesterId);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update registration');
        }
    };

    const releaseGradeSheets = async (semesterId) => {
        setError('');
        setMessage('');
        try {
            await api.post(`/admin/semesters/${semesterId}/release-grade-sheets`);
            setMessage('Semester grade sheets released successfully.');
            await loadBaseData();
            await loadSemesterDetail(semesterId);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to release grade sheets');
        }
    };

    if (!user) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-100">Loading admin dashboard...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-100 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="bg-white rounded-2xl border shadow-sm p-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
                        <p className="text-slate-500 mt-1">Manage users, semester offerings, registration windows, and semester grade-sheet release.</p>
                    </div>
                    <button
                        onClick={() => { clearSession(); router.push('/login'); }}
                        className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium"
                    >
                        Log Out
                    </button>
                </div>

                {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl">{message}</div>}
                {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl">{error}</div>}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <form onSubmit={submitUser} className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
                        <h2 className="text-xl font-bold text-slate-900">Create User</h2>
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="Name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="Email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="Password" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
                        <select className="w-full border rounded-lg px-3 py-2" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                            <option value="student">Student</option>
                            <option value="professor">Professor</option>
                            <option value="admin">Admin</option>
                        </select>
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="Department" value={userForm.department} onChange={(e) => setUserForm({ ...userForm, department: e.target.value })} required />
                        {userForm.role === 'student' && (
                            <>
                                <input className="w-full border rounded-lg px-3 py-2" placeholder="Roll Number" value={userForm.roll_no} onChange={(e) => setUserForm({ ...userForm, roll_no: e.target.value })} required />
                                <input className="w-full border rounded-lg px-3 py-2" placeholder="Semester No" type="number" value={userForm.semester} onChange={(e) => setUserForm({ ...userForm, semester: e.target.value })} required />
                            </>
                        )}
                        <button className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 font-medium">Create User</button>
                    </form>

                    <form onSubmit={submitSemester} className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
                        <h2 className="text-xl font-bold text-slate-900">Create Semester</h2>
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="Semester name" value={semesterForm.name} onChange={(e) => setSemesterForm({ ...semesterForm, name: e.target.value })} required />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="Department" value={semesterForm.department} onChange={(e) => setSemesterForm({ ...semesterForm, department: e.target.value })} required />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="Semester No" type="number" value={semesterForm.semester_no} onChange={(e) => setSemesterForm({ ...semesterForm, semester_no: e.target.value })} required />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="Total Credits" type="number" value={semesterForm.total_credits} onChange={(e) => setSemesterForm({ ...semesterForm, total_credits: e.target.value })} required />
                        <button className="w-full bg-emerald-600 text-white rounded-lg px-4 py-2 font-medium">Create Semester</button>
                    </form>

                    <form onSubmit={submitCourse} className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
                        <h2 className="text-xl font-bold text-slate-900">Add Semester Course</h2>
                        <select className="w-full border rounded-lg px-3 py-2" value={courseForm.semester_id} onChange={(e) => setCourseForm({ ...courseForm, semester_id: e.target.value })} required>
                            <option value="">Select semester</option>
                            {semesters.map((semester) => (
                                <option key={semester.id} value={semester.id}>{semester.display_name || semester.name} ({semester.department} Sem {semester.normalized_semester_no || semester.semester_no})</option>
                            ))}
                        </select>
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="Course name" value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} required />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="Course code" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })} required />
                        <select className="w-full border rounded-lg px-3 py-2" value={courseForm.professor_id} onChange={(e) => setCourseForm({ ...courseForm, professor_id: e.target.value })} required>
                            <option value="">Assign professor</option>
                            {professors.map((prof) => (
                                <option key={prof.id} value={prof.id}>{prof.name} ({prof.department})</option>
                            ))}
                        </select>
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="Credits" type="number" value={courseForm.credits} onChange={(e) => setCourseForm({ ...courseForm, credits: e.target.value })} required />
                        <select className="w-full border rounded-lg px-3 py-2" value={courseForm.course_type} onChange={(e) => setCourseForm({ ...courseForm, course_type: e.target.value })}>
                            <option value="compulsory">Compulsory</option>
                            <option value="elective">Elective</option>
                        </select>
                        {courseForm.course_type === 'elective' && (
                            <input className="w-full border rounded-lg px-3 py-2" placeholder="Elective group (e.g. AI-ELECTIVE)" value={courseForm.elective_group} onChange={(e) => setCourseForm({ ...courseForm, elective_group: e.target.value })} required />
                        )}
                        <button className="w-full bg-violet-600 text-white rounded-lg px-4 py-2 font-medium">Add Course</button>
                    </form>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.9fr] gap-6">
                    <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900">Semesters</h2>
                            <button onClick={loadBaseData} className="text-sm text-blue-600 font-medium">Refresh</button>
                        </div>
                        <div className="space-y-3">
                            {semesters.map((semester) => (
                                <button
                                    key={semester.id}
                                    type="button"
                                    onClick={() => { setSelectedSemesterId(String(semester.id)); loadSemesterDetail(semester.id); }}
                                    className={`w-full text-left border rounded-xl p-4 ${String(semester.id) === String(selectedSemesterId) ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <p className="font-semibold text-slate-900">{semester.display_name || semester.name}</p>
                                            <p className="text-sm text-slate-500">{semester.department} Semester {semester.normalized_semester_no || semester.semester_no}</p>
                                        </div>
                                        <span className="text-xs font-bold text-slate-500">{semester.total_credits} credits</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-slate-500">
                                        <div>{semester.course_count} courses</div>
                                        <div>{semester.registered_student_count} registrations</div>
                                        <div>{semester.released_course_count} released</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">
                        {!semesterDetail ? (
                            <div className="text-slate-500">Select a semester to view details.</div>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">{semesterDetail.semester.display_name || semesterDetail.semester.name}</h2>
                                        <p className="text-slate-500">{semesterDetail.semester.department} Semester {semesterDetail.semester.normalized_semester_no || semesterDetail.semester.semester_no} · {semesterDetail.semester.total_credits} total credits</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => toggleRegistration(semesterDetail.semester.id, !(semesterDetail.semester.normalized_registration_open ?? semesterDetail.semester.registration_open))}
                                            className={`px-4 py-2 rounded-lg text-white font-medium ${(semesterDetail.semester.normalized_registration_open ?? semesterDetail.semester.registration_open) ? 'bg-amber-600' : 'bg-emerald-600'}`}
                                        >
                                            {(semesterDetail.semester.normalized_registration_open ?? semesterDetail.semester.registration_open) ? 'Close Registration' : 'Open Registration'}
                                        </button>
                                        <button
                                            onClick={() => releaseGradeSheets(semesterDetail.semester.id)}
                                            className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium"
                                        >
                                            Release Grade Sheets
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-bold text-slate-900 mb-3">Semester Courses</h3>
                                    <div className="overflow-x-auto border rounded-xl">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="p-3 text-left">Code</th>
                                                    <th className="p-3 text-left">Course</th>
                                                    <th className="p-3 text-left">Type</th>
                                                    <th className="p-3 text-left">Credits</th>
                                                    <th className="p-3 text-left">Professor</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {semesterDetail.courses.map((course) => (
                                                    <tr key={course.id} className="border-t">
                                                        <td className="p-3 font-mono">{course.code}</td>
                                                        <td className="p-3">{course.name}</td>
                                                        <td className="p-3 capitalize">{course.course_type}{course.elective_group ? ` (${course.elective_group})` : ''}</td>
                                                        <td className="p-3">{course.credits}</td>
                                                        <td className="p-3">{course.professor_name || 'Unassigned'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                    <div>
                                        <h3 className="font-bold text-slate-900 mb-3">Registrations</h3>
                                        <div className="overflow-x-auto border rounded-xl">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="p-3 text-left">Roll No</th>
                                                        <th className="p-3 text-left">Student</th>
                                                        <th className="p-3 text-left">Credits</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {semesterDetail.registrations.map((registration) => (
                                                        <tr key={registration.id} className="border-t">
                                                            <td className="p-3 font-mono">{registration.roll_no}</td>
                                                            <td className="p-3">{registration.student_name}</td>
                                                            <td className="p-3">{registration.total_credits}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-slate-900 mb-3">Released Grade Sheets</h3>
                                        <div className="overflow-x-auto border rounded-xl">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="p-3 text-left">Roll No</th>
                                                        <th className="p-3 text-left">Student</th>
                                                        <th className="p-3 text-left">SPI</th>
                                                        <th className="p-3 text-left">Points</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {semesterDetail.grade_sheets.map((sheet) => (
                                                        <tr key={sheet.id} className="border-t">
                                                            <td className="p-3 font-mono">{sheet.roll_no}</td>
                                                            <td className="p-3">{sheet.student_name}</td>
                                                            <td className="p-3 font-semibold text-blue-700">{sheet.spi}</td>
                                                            <td className="p-3">{sheet.total_grade_points}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
