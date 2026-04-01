"use client";

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { MapPin, Play, Square, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function AttendanceTracker({ subjectId }) {
    const [status, setStatus] = useState('idle'); // idle, active, completed
    const [sessionId, setSessionId] = useState(null);
    const [timer, setTimer] = useState(0);
    const [todayClasses, setTodayClasses] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch today's class schedule
    useEffect(() => {
        const fetchTodayClasses = async () => {
            try {
                const { data } = await api.get(`/schedule/${subjectId}/today`);
                setTodayClasses(data);
            } catch (err) {
                console.error('Failed to fetch today classes', err);
                setTodayClasses({ date: new Date().toISOString().split('T')[0], classes: [] });
            } finally {
                setLoading(false);
            }
        };
        fetchTodayClasses();
    }, [subjectId]);

    // Check if there's a currently active class (within the time window)
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const activeClass = todayClasses?.classes?.find(c => {
        return currentTime >= c.start_time?.slice(0, 5) && currentTime <= c.end_time?.slice(0, 5);
    });

    const upcomingClasses = todayClasses?.classes?.filter(c => {
        return currentTime < c.start_time?.slice(0, 5);
    }) || [];

    const pastClasses = todayClasses?.classes?.filter(c => {
        return currentTime > c.end_time?.slice(0, 5);
    }) || [];

    const startSession = async () => {
        if (!navigator.geolocation) return alert('Geolocation is not supported by your browser');

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const { data } = await api.post('/attendance/start', { subject_id: subjectId, latitude, longitude });
                setSessionId(data.session_id);
                setStatus('active');
            } catch (err) {
                alert('Failed to start session');
            }
        }, () => {
            alert('Please allow location access to mark attendance.');
        });
    };

    const stopSession = async () => {
        try {
            const { data } = await api.post('/attendance/complete', { session_id: sessionId });
            alert(`Session Completed! Marked as: ${data.message}`);
            setStatus('completed');
        } catch (err) {
            alert('Failed to complete session');
        }
    };

    useEffect(() => {
        let interval;
        let pinger;

        if (status === 'active') {
            interval = setInterval(() => setTimer((t) => t + 1), 1000);
            
            // Heartbeat every 30s
            pinger = setInterval(() => {
                navigator.geolocation.getCurrentPosition((position) => {
                    const { latitude, longitude } = position.coords;
                    api.post('/attendance/ping', { session_id: sessionId, latitude, longitude });
                });
            }, 30000);
        }

        return () => {
            clearInterval(interval);
            clearInterval(pinger);
        };
    }, [status, sessionId]);

    const formatTime = (s) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatTimeSlot = (time) => {
        if (!time) return '';
        const [h, m] = time.slice(0, 5).split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${h12}:${m} ${ampm}`;
    };

    if (loading) {
        return (
            <div className="p-6 bg-white rounded-xl shadow border">
                <div className="flex items-center gap-3 text-gray-400">
                    <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Checking today&apos;s schedule...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Today's Schedule Overview */}
            <div className="p-5 bg-white rounded-xl shadow border">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <Clock className="text-blue-500" size={20} />
                    Today&apos;s Classes
                </h3>

                {todayClasses?.classes?.length === 0 ? (
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-dashed">
                        <AlertCircle size={20} className="text-gray-400" />
                        <div>
                            <p className="text-sm font-medium text-gray-600">No classes scheduled for today</p>
                            <p className="text-xs text-gray-400">Attendance marking is not available when there are no classes.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {todayClasses?.classes?.map((c, i) => {
                            const isActive = currentTime >= c.start_time?.slice(0, 5) && currentTime <= c.end_time?.slice(0, 5);
                            const isPast = currentTime > c.end_time?.slice(0, 5);
                            return (
                                <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${
                                    isActive ? 'bg-emerald-50 border-emerald-200' :
                                    isPast ? 'bg-gray-50 border-gray-200 opacity-60' :
                                    'bg-blue-50 border-blue-200'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : isPast ? 'bg-gray-300' : 'bg-blue-400'}`}></div>
                                        <span className="text-sm font-medium">
                                            {formatTimeSlot(c.start_time)} — {formatTimeSlot(c.end_time)}
                                        </span>
                                        {c.status === 'extra' && <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-600 font-bold rounded">EXTRA</span>}
                                        {c.note && <span className="text-xs text-gray-400">({c.note})</span>}
                                    </div>
                                    <span className={`text-xs font-bold ${isActive ? 'text-emerald-600' : isPast ? 'text-gray-400' : 'text-blue-600'}`}>
                                        {isActive ? '● LIVE NOW' : isPast ? 'ENDED' : 'UPCOMING'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Mark Attendance Section */}
            <div className="p-5 bg-white rounded-xl shadow border">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <MapPin className="text-emerald-500" size={20} />
                    Mark Attendance
                </h3>

                {!activeClass && status === 'idle' ? (
                    <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertCircle size={20} className="text-amber-500" />
                        <div>
                            <p className="text-sm font-medium text-amber-700">Attendance marking not available right now</p>
                            <p className="text-xs text-amber-500">
                                {upcomingClasses.length > 0
                                    ? `Next class starts at ${formatTimeSlot(upcomingClasses[0].start_time)}`
                                    : todayClasses?.classes?.length === 0
                                      ? 'No classes today'
                                      : 'All classes have ended for today'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <div>
                            {activeClass && status === 'idle' && (
                                <p className="text-sm text-gray-600 mb-1">
                                    Class active: {formatTimeSlot(activeClass.start_time)} — {formatTimeSlot(activeClass.end_time)}
                                </p>
                            )}
                            {status === 'active' && <p className="text-2xl font-mono text-emerald-600">{formatTime(timer)}</p>}
                            {status === 'completed' && (
                                <div className="flex items-center gap-2 text-emerald-600">
                                    <CheckCircle2 size={20} />
                                    <span className="font-bold">Attendance marked!</span>
                                </div>
                            )}
                        </div>
                        <div>
                            {status === 'idle' && activeClass && (
                                <button onClick={startSession} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors">
                                    <Play size={18}/> Start Session
                                </button>
                            )}
                            {status === 'active' && (
                                <button onClick={stopSession} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors">
                                    <Square size={18}/> End Session
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
