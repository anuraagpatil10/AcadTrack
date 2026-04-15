"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { CheckCircle2, XCircle, AlertTriangle, ArrowLeft, Trophy, Target, Clock } from 'lucide-react';

export default function QuizResult({ params }) {
    const { id } = params;
    const router = useRouter();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchResult = async () => {
            try {
                const { data: result } = await api.get(`/quiz/${id}/my-result`);
                setData(result);
            } catch (err) {
                console.error('Failed to load result', err);
            } finally {
                setLoading(false);
            }
        };
        fetchResult();
    }, [id]);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm font-medium">Loading result...</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 max-w-md text-center">
                    <h2 className="text-2xl font-bold text-white mb-3">No Result Found</h2>
                    <p className="text-slate-400 mb-6">You haven't submitted this quiz yet.</p>
                    <button onClick={() => router.back()} className="px-8 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const { quiz, submission, questions, total, violations } = data;
    const percentage = total > 0 ? Math.round((submission.score / total) * 100) : 0;
    const passed = percentage >= 40;
    const circumference = 2 * Math.PI * 56;
    const offset = circumference * (1 - percentage / 100);
    const correctCount = questions.filter(q => q.selected_option === q.correct_answer).length;
    const wrongCount = questions.filter(q => q.selected_option && q.selected_option !== q.correct_answer).length;
    const skippedCount = questions.filter(q => !q.selected_option).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                    <h1 className="text-lg font-bold text-white">Quiz Result</h1>
                    <div className="w-20"></div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
                {/* Score Card */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        {/* Score Circle */}
                        <div className="relative w-40 h-40 shrink-0">
                            <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 128 128">
                                <circle cx="64" cy="64" r="56" stroke="#334155" strokeWidth="8" fill="none" />
                                <circle
                                    cx="64" cy="64" r="56"
                                    stroke={passed ? '#10b981' : '#ef4444'}
                                    strokeWidth="8"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={offset}
                                    style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold text-white">{percentage}%</span>
                                <span className={`text-sm font-medium ${passed ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {passed ? 'PASSED' : 'FAILED'}
                                </span>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex-1 w-full">
                            <h2 className="text-2xl font-bold text-white mb-1">{quiz.title}</h2>
                            <p className="text-slate-400 text-sm mb-6 flex items-center gap-2">
                                <Clock size={14} />
                                Submitted {new Date(submission.submitted_at).toLocaleString()}
                            </p>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                                    <Trophy size={20} className="text-amber-400 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-white">{submission.score}/{total}</p>
                                    <p className="text-xs text-slate-400">Score</p>
                                </div>
                                <div className="bg-emerald-500/10 rounded-xl p-4 text-center border border-emerald-500/20">
                                    <CheckCircle2 size={20} className="text-emerald-400 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-emerald-400">{correctCount}</p>
                                    <p className="text-xs text-slate-400">Correct</p>
                                </div>
                                <div className="bg-red-500/10 rounded-xl p-4 text-center border border-red-500/20">
                                    <XCircle size={20} className="text-red-400 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-red-400">{wrongCount}</p>
                                    <p className="text-xs text-slate-400">Wrong</p>
                                </div>
                                <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                                    <Target size={20} className="text-slate-400 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-slate-300">{skippedCount}</p>
                                    <p className="text-xs text-slate-400">Skipped</p>
                                </div>
                            </div>

                            {violations > 0 && (
                                <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-red-400" />
                                    <p className="text-red-400 text-sm font-medium">{violations} violation(s) recorded during this quiz</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Question-by-Question Review */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-6">Question Review</h3>

                    <div className="space-y-4">
                        {questions.map((q, i) => {
                            const isCorrect = q.selected_option === q.correct_answer;
                            const isSkipped = !q.selected_option;

                            return (
                                <div key={q.id} className="bg-slate-700/30 rounded-xl p-5 border border-slate-700">
                                    <div className="flex items-start gap-3 mb-4">
                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                                            isSkipped ? 'bg-slate-600 text-slate-400' :
                                            isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                        }`}>
                                            {i + 1}
                                        </span>
                                        <h4 className="text-white font-medium leading-relaxed">{q.question}</h4>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-11">
                                        {['A', 'B', 'C', 'D'].map(opt => {
                                            const optionText = q[`option_${opt.toLowerCase()}`];
                                            const isThisCorrect = q.correct_answer === opt;
                                            const isThisSelected = q.selected_option === opt;

                                            let classes = 'bg-slate-700/50 border-slate-600 text-slate-300';
                                            if (isThisCorrect) {
                                                classes = 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400';
                                            } else if (isThisSelected && !isThisCorrect) {
                                                classes = 'bg-red-500/10 border-red-500/50 text-red-400';
                                            }

                                            return (
                                                <div
                                                    key={opt}
                                                    className={`px-4 py-3 rounded-lg border text-sm flex items-center gap-3 ${classes}`}
                                                >
                                                    <span className="font-bold w-6">{opt}.</span>
                                                    <span className="flex-1">{optionText}</span>
                                                    {isThisCorrect && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
                                                    {isThisSelected && !isThisCorrect && <XCircle size={16} className="text-red-400 shrink-0" />}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {isSkipped && (
                                        <p className="text-xs text-slate-500 mt-3 ml-11 font-medium">— Not answered</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
}
