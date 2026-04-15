"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Shield, AlertTriangle, Clock, ChevronLeft, ChevronRight, Eye, Send, Lock, CheckCircle2, XCircle, Maximize } from 'lucide-react';

export default function QuizTaker({ params }) {
    const { id } = params;
    const router = useRouter();
    const [quiz, setQuiz] = useState(null);
    const [answers, setAnswers] = useState({});
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [violations, setViolations] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showViolationOverlay, setShowViolationOverlay] = useState(false);
    const [violationType, setViolationType] = useState('');
    const [showReview, setShowReview] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [quizError, setQuizError] = useState(null);
    const submittedRef = useRef(false);
    const violationProcessingRef = useRef(false);

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const { data } = await api.get(`/quiz/${id}`);
                if (data.already_submitted) {
                    setQuizError('already_submitted');
                    setResult({ score: data.score });
                    setLoading(false);
                    return;
                }
                if (data.not_started) {
                    setQuizError('not_started');
                    setQuiz(data);
                    setLoading(false);
                    return;
                }
                if (data.expired) {
                    setQuizError('expired');
                    setLoading(false);
                    return;
                }
                setQuiz(data);
                setViolations(data.violations_count || 0);
                // Calculate time left
                const end = new Date(data.end_time).getTime();
                const now = new Date().getTime();
                const maxSeconds = data.duration * 60;
                const remaining = Math.max(0, Math.floor((end - now) / 1000));
                setTimeLeft(Math.min(maxSeconds, remaining));
                setLoading(false);
            } catch (err) {
                setQuizError('load_failed');
                setLoading(false);
            }
        };
        fetchQuiz();
    }, [id]);

    const submitQuiz = useCallback(async () => {
        if (submittedRef.current) return;
        submittedRef.current = true;
        setSubmitted(true);
        try {
            const { data } = await api.post('/quiz/submit', { quiz_id: id, answers });
            setResult(data);
            if (document.fullscreenElement) {
                await document.exitFullscreen().catch(() => {});
            }
        } catch (err) {
            // If already submitted, still show as submitted
            if (err.response?.data?.error === 'You have already submitted this quiz') {
                setResult({ score: 0, total: 0, message: 'Already submitted' });
            } else {
                submittedRef.current = false;
                setSubmitted(false);
                alert('Submission failed. Please try again.');
            }
        }
    }, [id, answers]);

    const recordViolation = useCallback(async (type) => {
        if (submittedRef.current || violationProcessingRef.current) return;
        violationProcessingRef.current = true;
        try {
            const { data } = await api.post('/quiz/violation', { quiz_id: id, type });
            setViolations(data.violations_count);
            setViolationType(type);
            setShowViolationOverlay(true);

            if (data.auto_submit) {
                setTimeout(() => {
                    setShowViolationOverlay(false);
                    submitQuiz();
                }, 2000);
            } else {
                setTimeout(() => setShowViolationOverlay(false), 3000);
            }
        } catch (err) {
            console.error(err);
        } finally {
            violationProcessingRef.current = false;
        }
    }, [id, submitQuiz]);

    // Timer
    useEffect(() => {
        if (!quiz || submitted) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    submitQuiz();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [quiz, submitted, submitQuiz]);

    // Anti-cheat: visibility + fullscreen
    useEffect(() => {
        if (!quiz || submitted) return;

        const handleVisibilityChange = () => {
            if (document.hidden && !submittedRef.current) {
                recordViolation('Tab Switch');
            }
        };

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setIsFullscreen(false);
                if (!submittedRef.current) {
                    recordViolation('Exited Fullscreen');
                }
            } else {
                setIsFullscreen(true);
            }
        };

        // Block right-click
        const handleContextMenu = (e) => { e.preventDefault(); };

        // Block copy/paste/cut
        const handleCopyCutPaste = (e) => { e.preventDefault(); };

        // Block keyboard shortcuts
        const handleKeyDown = (e) => {
            // Block Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+P, Ctrl+S, F12, Ctrl+Shift+I
            if (
                (e.ctrlKey && ['c', 'v', 'x', 'a', 'p', 's', 'u'].includes(e.key.toLowerCase())) ||
                (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') ||
                e.key === 'F12' ||
                e.key === 'PrintScreen'
            ) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        // Blur detection (Alt+Tab etc)
        const handleBlur = () => {
            if (!submittedRef.current && !document.hidden) {
                recordViolation('Window Blur');
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('copy', handleCopyCutPaste);
        document.addEventListener('cut', handleCopyCutPaste);
        document.addEventListener('paste', handleCopyCutPaste);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('copy', handleCopyCutPaste);
            document.removeEventListener('cut', handleCopyCutPaste);
            document.removeEventListener('paste', handleCopyCutPaste);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', handleBlur);
        };
    }, [quiz, submitted, recordViolation]);

    const enterFullscreen = async () => {
        try {
            await document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } catch (err) {
            alert('Please enable fullscreen to start the quiz');
        }
    };

    // --- RENDER: Loading ---
    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm font-medium">Loading quiz...</p>
                </div>
            </div>
        );
    }

    // --- RENDER: Error States ---
    if (quizError === 'already_submitted') {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 max-w-md text-center shadow-2xl">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 size={40} className="text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Already Submitted</h2>
                    <p className="text-slate-400 mb-2">You have already completed this quiz.</p>
                    {result?.score !== undefined && (
                        <p className="text-3xl font-bold text-emerald-400 mb-6">Score: {result.score}</p>
                    )}
                    <div className="flex gap-3">
                        <button onClick={() => router.back()} className="flex-1 px-6 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors">
                            Go Back
                        </button>
                        <button onClick={() => router.push(`/student/quiz/${id}/result`)} className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors">
                            View Result
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (quizError === 'not_started') {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 max-w-md text-center shadow-2xl">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <Clock size={40} className="text-amber-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Quiz Not Started Yet</h2>
                    <p className="text-slate-400 mb-2">This quiz will be available at:</p>
                    <p className="text-xl font-mono text-amber-400 mb-6">
                        {quiz && new Date(quiz.start_time).toLocaleString()}
                    </p>
                    <button onClick={() => router.back()} className="px-8 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (quizError === 'expired') {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 max-w-md text-center shadow-2xl">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                        <XCircle size={40} className="text-red-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Quiz Expired</h2>
                    <p className="text-slate-400 mb-6">The time window for this quiz has passed.</p>
                    <button onClick={() => router.back()} className="px-8 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (quizError === 'load_failed') {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 max-w-md text-center shadow-2xl">
                    <h2 className="text-2xl font-bold text-white mb-3">Failed to Load Quiz</h2>
                    <p className="text-slate-400 mb-6">Please check your connection and try again.</p>
                    <button onClick={() => router.back()} className="px-8 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // --- RENDER: Submitted Result ---
    if (submitted && result) {
        const percentage = result.total ? Math.round((result.score / result.total) * 100) : 0;
        const circumference = 2 * Math.PI * 56;
        const offset = circumference * (1 - percentage / 100);

        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 max-w-lg w-full text-center shadow-2xl">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 size={32} className="text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Quiz Submitted!</h2>
                    <p className="text-slate-400 mb-8">{quiz.title}</p>

                    {/* Animated score circle */}
                    <div className="relative w-36 h-36 mx-auto mb-6">
                        <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 128 128">
                            <circle cx="64" cy="64" r="56" stroke="#334155" strokeWidth="8" fill="none" />
                            <circle
                                cx="64" cy="64" r="56"
                                stroke={percentage >= 40 ? '#10b981' : '#ef4444'}
                                strokeWidth="8"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-white">{result.score}/{result.total}</span>
                            <span className={`text-sm font-medium ${percentage >= 40 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {percentage}%
                            </span>
                        </div>
                    </div>

                    {result.violations > 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-6">
                            <p className="text-red-400 text-sm font-medium flex items-center justify-center gap-2">
                                <AlertTriangle size={16} /> {result.violations} violation(s) recorded
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button onClick={() => router.back()} className="flex-1 px-6 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors">
                            Back to Dashboard
                        </button>
                        <button onClick={() => router.push(`/student/quiz/${id}/result`)} className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors">
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER: Fullscreen Gate ---
    if (!isFullscreen) {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 max-w-lg w-full text-center shadow-2xl">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                        <Shield size={40} className="text-red-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Secure Quiz Environment</h2>
                    <p className="text-slate-400 mb-6 leading-relaxed">
                        This quiz runs in a <span className="text-white font-semibold">strict proctored mode</span>. The following actions are monitored:
                    </p>

                    <div className="grid grid-cols-1 gap-3 mb-8 text-left">
                        {[
                            { icon: Eye, text: 'Tab switching will be detected', color: 'text-amber-400' },
                            { icon: Maximize, text: 'Fullscreen must remain active', color: 'text-blue-400' },
                            { icon: Lock, text: 'Copy/paste & right-click disabled', color: 'text-purple-400' },
                            { icon: AlertTriangle, text: '3 violations = Auto-submit', color: 'text-red-400' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 bg-slate-700/50 rounded-xl px-4 py-3">
                                <item.icon size={18} className={item.color} />
                                <span className="text-sm text-slate-300">{item.text}</span>
                            </div>
                        ))}
                    </div>

                    <div className="bg-slate-700/50 rounded-xl p-4 mb-6 text-left">
                        <p className="text-sm text-slate-300"><span className="font-bold text-white">{quiz.title}</span></p>
                        <p className="text-xs text-slate-400 mt-1">{quiz.questions.length} questions • {quiz.duration} minutes</p>
                        {violations > 0 && (
                            <p className="text-xs text-red-400 mt-1 font-medium">⚠ {violations} previous violation(s) detected</p>
                        )}
                    </div>

                    <button
                        onClick={enterFullscreen}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-3"
                    >
                        <Maximize size={22} />
                        Enter Fullscreen & Start Quiz
                    </button>
                </div>
            </div>
        );
    }

    // --- RENDER: Review Screen ---
    if (showReview) {
        const answeredCount = Object.keys(answers).length;
        return (
            <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col select-none" style={{ userSelect: 'none' }}>
                {/* Header */}
                <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Shield size={20} className="text-indigo-400" />
                        <h1 className="text-lg font-bold text-white">{quiz.title} — Review</h1>
                    </div>
                    <TimerDisplay timeLeft={timeLeft} />
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-3xl mx-auto">
                        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
                            <h3 className="text-xl font-bold text-white mb-2">Review Your Answers</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                You've answered <span className="text-indigo-400 font-bold">{answeredCount}</span> of <span className="text-white font-bold">{quiz.questions.length}</span> questions.
                                {answeredCount < quiz.questions.length && (
                                    <span className="text-amber-400"> ({quiz.questions.length - answeredCount} unanswered)</span>
                                )}
                            </p>

                            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 mb-6">
                                {quiz.questions.map((q, i) => (
                                    <button
                                        key={q.id}
                                        onClick={() => { setCurrentQuestion(i); setShowReview(false); }}
                                        className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                                            answers[q.id]
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                        } hover:scale-110`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>

                            {/* Summary of Answers */}
                            <div className="space-y-3">
                                {quiz.questions.map((q, i) => (
                                    <div key={q.id} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-mono text-slate-400 w-6">{i + 1}.</span>
                                            <span className="text-sm text-slate-300 truncate max-w-md">{q.question}</span>
                                        </div>
                                        <span className={`text-sm font-bold px-3 py-1 rounded-md ${
                                            answers[q.id]
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-red-500/10 text-red-400'
                                        }`}>
                                            {answers[q.id] ? `Option ${answers[q.id]}` : 'Skipped'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowReview(false)}
                                className="flex-1 py-4 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <ChevronLeft size={20} /> Back to Questions
                            </button>
                            <button
                                onClick={submitQuiz}
                                className="flex-1 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold text-lg hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                            >
                                <Send size={20} /> Submit Final Answers
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // --- RENDER: Quiz Taking ---
    const q = quiz.questions[currentQuestion];
    const answeredCount = Object.keys(answers).length;
    const progressPercent = Math.round((answeredCount / quiz.questions.length) * 100);

    return (
        <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col select-none" style={{ userSelect: 'none' }}>
            {/* Violation Overlay */}
            {showViolationOverlay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-red-900/90 border-2 border-red-500 rounded-2xl p-8 max-w-md text-center shadow-2xl animate-pulse">
                        <AlertTriangle size={56} className="text-red-400 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">⚠ Violation Detected!</h2>
                        <p className="text-red-200 mb-3 text-lg font-semibold">{violationType}</p>
                        <div className="flex items-center justify-center gap-2 mb-4">
                            {[1, 2, 3].map(i => (
                                <div
                                    key={i}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                        i <= violations
                                            ? 'bg-red-500 text-white'
                                            : 'bg-slate-600 text-slate-400'
                                    }`}
                                >
                                    {i}
                                </div>
                            ))}
                        </div>
                        <p className="text-red-300 text-sm">
                            {violations >= 3
                                ? 'Maximum violations reached. Auto-submitting...'
                                : `${3 - violations} violation(s) remaining before auto-submit`
                            }
                        </p>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 px-6 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Shield size={20} className="text-indigo-400" />
                        <h1 className="text-lg font-bold text-white hidden sm:block">{quiz.title}</h1>
                    </div>
                    {/* Violation indicator */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                        violations === 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                        violations <= 1 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                        'bg-red-500/10 text-red-400 border border-red-500/30 animate-pulse'
                    }`}>
                        <AlertTriangle size={14} />
                        {violations}/3
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Progress */}
                    <div className="hidden md:flex items-center gap-2">
                        <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <span className="text-xs text-slate-400">{answeredCount}/{quiz.questions.length}</span>
                    </div>
                    <TimerDisplay timeLeft={timeLeft} />
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Question Navigator Sidebar */}
                <aside className="w-16 sm:w-20 bg-slate-800/50 border-r border-slate-700 py-4 overflow-y-auto shrink-0 flex flex-col items-center gap-2">
                    {quiz.questions.map((question, i) => (
                        <button
                            key={question.id}
                            onClick={() => setCurrentQuestion(i)}
                            className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                                i === currentQuestion
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110'
                                    : answers[question.id]
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:scale-105'
                                        : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:bg-slate-700 hover:scale-105'
                            }`}
                            title={`Question ${i + 1}${answers[question.id] ? ' (Answered)' : ''}`}
                        >
                            {i + 1}
                        </button>
                    ))}
                </aside>

                {/* Question Area */}
                <main className="flex-1 overflow-y-auto px-6 py-8">
                    <div className="max-w-3xl mx-auto">
                        {/* Question number badge */}
                        <div className="flex items-center gap-3 mb-6">
                            <span className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 text-sm font-bold border border-indigo-500/30">
                                Question {currentQuestion + 1} of {quiz.questions.length}
                            </span>
                            {answers[q.id] && (
                                <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                                    <CheckCircle2 size={14} /> Answered
                                </span>
                            )}
                        </div>

                        {/* Question text */}
                        <h2 className="text-2xl font-bold text-white mb-8 leading-relaxed">
                            {q.question}
                        </h2>

                        {/* Options */}
                        <div className="space-y-3 mb-8">
                            {['A', 'B', 'C', 'D'].map(opt => {
                                const optionText = q[`option_${opt.toLowerCase()}`];
                                const isSelected = answers[q.id] === opt;
                                return (
                                    <button
                                        key={opt}
                                        onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                                        className={`w-full text-left p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 group ${
                                            isSelected
                                                ? 'bg-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/10'
                                                : 'bg-slate-800/50 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                                        }`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                                            isSelected
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600'
                                        }`}>
                                            {opt}
                                        </div>
                                        <span className={`text-base ${isSelected ? 'text-white font-medium' : 'text-slate-300'}`}>
                                            {optionText}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                                disabled={currentQuestion === 0}
                                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={18} /> Previous
                            </button>

                            {currentQuestion === quiz.questions.length - 1 ? (
                                <button
                                    onClick={() => setShowReview(true)}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg shadow-emerald-500/20"
                                >
                                    Review & Submit <Send size={18} />
                                </button>
                            ) : (
                                <button
                                    onClick={() => setCurrentQuestion(currentQuestion + 1)}
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                                >
                                    Next <ChevronRight size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

// Timer component with color transitions
function TimerDisplay({ timeLeft }) {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const isUrgent = timeLeft <= 60;
    const isWarning = timeLeft <= 300 && !isUrgent;

    return (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold transition-colors ${
            isUrgent
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                : isWarning
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-700/50 text-slate-300 border border-slate-600'
        }`}>
            <Clock size={18} className={isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-slate-400'} />
            {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
        </div>
    );
}
