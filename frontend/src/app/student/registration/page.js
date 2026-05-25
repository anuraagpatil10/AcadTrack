"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { clearSession, getStoredToken, getStoredUser } from '@/lib/auth';

export default function StudentRegistrationPage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [data, setData] = useState(null);
    const [selectedSemesterId, setSelectedSemesterId] = useState('');
    const [selectedSubjects, setSelectedSubjects] = useState([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = getStoredUser();
        const storedToken = getStoredToken();
        if (!storedUser || !storedToken) {
            clearSession();
            return router.push('/login');
        }

        const parsed = JSON.parse(storedUser);
        if (parsed.role !== 'student') {
            return router.push('/login');
        }

        setUser(parsed);
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/registration/current');
            setData(data);
            if (data.semesters.length) {
                const firstSemester = data.semesters[0];
                setSelectedSemesterId(String(firstSemester.id));
                setSelectedSubjects(firstSemester.registration?.selected_subject_ids || firstSemester.courses.filter((course) => course.course_type === 'compulsory').map((course) => course.id));
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load registration data');
        } finally {
            setLoading(false);
        }
    };

    const selectedSemester = useMemo(
        () => data?.semesters?.find((semester) => String(semester.id) === String(selectedSemesterId)) || null,
        [data, selectedSemesterId]
    );

    const courseMap = useMemo(
        () => new Map((selectedSemester?.courses || []).map((course) => [course.id, course])),
        [selectedSemester]
    );

    const totalSelectedCredits = selectedSubjects.reduce((sum, subjectId) => sum + Number(courseMap.get(subjectId)?.credits || 0), 0);

    const electiveGroups = useMemo(() => {
        const groups = new Map();
        (selectedSemester?.courses || [])
            .filter((course) => course.course_type === 'elective')
            .forEach((course) => {
                if (!groups.has(course.elective_group)) groups.set(course.elective_group, []);
                groups.get(course.elective_group).push(course);
            });
        return groups;
    }, [selectedSemester]);

    const handleSemesterChange = (semesterId) => {
        const semester = data.semesters.find((entry) => String(entry.id) === String(semesterId));
        setSelectedSemesterId(String(semesterId));
        setSelectedSubjects(semester?.registration?.selected_subject_ids || semester?.courses.filter((course) => course.course_type === 'compulsory').map((course) => course.id) || []);
    };

    const toggleElective = (group, subjectId) => {
        const groupCourseIds = (electiveGroups.get(group) || []).map((course) => course.id);
        setSelectedSubjects((prev) => [
            ...prev.filter((id) => !groupCourseIds.includes(id)),
            subjectId,
        ]);
    };

    const submitRegistration = async () => {
        if (!selectedSemester) return;
        setError('');
        setMessage('');
        try {
            await api.post('/registration/submit', {
                semester_id: selectedSemester.id,
                selected_subject_ids: selectedSubjects,
            });
            setMessage('Registration submitted successfully.');
            await loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to submit registration');
        }
    };

    if (loading || !user) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-100">Loading registration...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-100 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="bg-white rounded-2xl border shadow-sm p-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Semester Registration</h1>
                        <p className="text-slate-500 mt-1">Select compulsory and elective courses so your total credits match the semester requirement.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => router.push('/student/courses')} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-medium">My Courses</button>
                        <button onClick={() => { clearSession(); router.push('/login'); }} className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium">Log Out</button>
                    </div>
                </div>

                {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl">{message}</div>}
                {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl">{error}</div>}

                <div className="bg-white rounded-2xl border shadow-sm p-5">
                    <label className="block text-sm font-medium text-slate-600 mb-2">Available semester registration</label>
                    <select className="w-full max-w-xl border rounded-lg px-3 py-2" value={selectedSemesterId} onChange={(e) => handleSemesterChange(e.target.value)}>
                        {data?.semesters?.map((semester) => (
                            <option key={semester.id} value={semester.id}>
                                {semester.display_name || semester.name} - {semester.department} Semester {semester.normalized_semester_no || semester.semester_no}
                            </option>
                        ))}
                    </select>
                </div>

                {selectedSemester && (
                    <div className="grid grid-cols-1 xl:grid-cols-[1.9fr_1.1fr] gap-6">
                        <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">{selectedSemester.display_name || selectedSemester.name}</h2>
                                    <p className="text-slate-500">{selectedSemester.department} Semester {selectedSemester.normalized_semester_no || selectedSemester.semester_no}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${(selectedSemester.normalized_registration_open ?? selectedSemester.registration_open) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {(selectedSemester.normalized_registration_open ?? selectedSemester.registration_open) ? 'Registration Open' : 'Registration Closed'}
                                </span>
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-900 mb-3">Compulsory Courses</h3>
                                <div className="space-y-3">
                                    {selectedSemester.courses.filter((course) => course.course_type === 'compulsory').map((course) => (
                                        <label key={course.id} className="flex items-center justify-between border rounded-xl p-4 bg-slate-50">
                                            <div>
                                                <p className="font-semibold text-slate-900">{course.code} · {course.name}</p>
                                                <p className="text-sm text-slate-500">{course.professor_name || 'Professor pending'} · {course.credits} credits</p>
                                            </div>
                                            <input type="checkbox" checked readOnly className="w-5 h-5 accent-blue-600" />
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-900 mb-3">Elective Choices</h3>
                                <div className="space-y-5">
                                    {[...electiveGroups.entries()].map(([group, courses]) => (
                                        <div key={group} className="border rounded-2xl p-4">
                                            <p className="font-semibold text-slate-900 mb-3">{group}</p>
                                            <div className="space-y-3">
                                                {courses.map((course) => (
                                                    <label key={course.id} className="flex items-center justify-between border rounded-xl p-4">
                                                        <div>
                                                            <p className="font-semibold text-slate-900">{course.code} · {course.name}</p>
                                                            <p className="text-sm text-slate-500">{course.professor_name || 'Professor pending'} · {course.credits} credits</p>
                                                        </div>
                                                        <input
                                                            type="radio"
                                                            name={`elective-${group}`}
                                                            checked={selectedSubjects.includes(course.id)}
                                                            onChange={() => toggleElective(group, course.id)}
                                                            disabled={!(selectedSemester.normalized_registration_open ?? selectedSemester.registration_open)}
                                                            className="w-5 h-5 accent-blue-600"
                                                        />
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl border shadow-sm p-6">
                                <h3 className="text-xl font-bold text-slate-900 mb-4">Registration Summary</h3>
                                <div className="space-y-3 text-sm text-slate-600">
                                    <div className="flex justify-between"><span>Required credits</span><span className="font-semibold text-slate-900">{selectedSemester.total_credits}</span></div>
                                    <div className="flex justify-between"><span>Selected credits</span><span className={`font-semibold ${totalSelectedCredits === Number(selectedSemester.total_credits) ? 'text-emerald-700' : 'text-rose-700'}`}>{totalSelectedCredits}</span></div>
                                    <div className="flex justify-between"><span>Status</span><span className="font-semibold text-slate-900">{selectedSemester.registration ? 'Already registered' : 'Not submitted yet'}</span></div>
                                </div>
                                <button
                                    onClick={submitRegistration}
                                    disabled={!(selectedSemester.normalized_registration_open ?? selectedSemester.registration_open)}
                                    className="w-full mt-5 bg-blue-600 text-white rounded-lg px-4 py-2.5 font-medium disabled:opacity-50"
                                >
                                    Submit Registration
                                </button>
                            </div>

                            <div className="bg-white rounded-2xl border shadow-sm p-6">
                                <h3 className="text-xl font-bold text-slate-900 mb-4">Released Grade Sheets</h3>
                                <div className="space-y-4">
                                    {data.grade_sheets.length === 0 && (
                                        <p className="text-sm text-slate-500">No semester grade sheets have been released yet.</p>
                                    )}
                                    {data.grade_sheets.map((sheet) => (
                                        <div key={sheet.id} className="border rounded-2xl p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{sheet.semester_name}</p>
                                                    <p className="text-sm text-slate-500">{sheet.department} Semester {sheet.semester_no}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-slate-500">SPI</p>
                                                    <p className="text-2xl font-bold text-blue-700">{sheet.spi}</p>
                                                </div>
                                            </div>
                                            <div className="mt-4 overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-50">
                                                        <tr>
                                                            <th className="p-2 text-left">Course</th>
                                                            <th className="p-2 text-left">Credits</th>
                                                            <th className="p-2 text-left">Grade</th>
                                                            <th className="p-2 text-left">Points</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sheet.courses.map((course) => (
                                                            <tr key={course.id} className="border-t">
                                                                <td className="p-2">{course.code} · {course.subject_name}</td>
                                                                <td className="p-2">{course.credits}</td>
                                                                <td className="p-2">{course.grade_code}</td>
                                                                <td className="p-2">{course.course_grade_points}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
