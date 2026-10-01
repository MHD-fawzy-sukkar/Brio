'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function HostContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId') || 'room-demo';
  const quizId = searchParams.get('quizId') || 'demo-quiz';

  const [phase, setPhase] = useState<'LOBBY' | 'QUESTION' | 'STATS' | 'LEADERBOARD'>('LOBBY');
  const [pin] = useState('849201');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            شاشة المستضيف | Host Screen
          </span>
          <h1 className="text-xl font-bold text-white mt-2">معرف الغرفة: {roomId}</h1>
          <p className="text-xs text-slate-400">معرف الكويز المرتبط: {quizId}</p>
        </div>

        <div className="text-center bg-slate-900 border border-slate-700 px-6 py-3 rounded-2xl">
          <span className="block text-xs text-slate-400">رمز الانضمام (PIN)</span>
          <span className="text-3xl font-extrabold font-mono text-indigo-400 tracking-wider">{pin}</span>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-base font-semibold text-white">حالة اللعبة الحالية: <span className="text-indigo-400 font-mono">{phase}</span></h2>
          <div className="flex gap-2">
            {phase === 'LOBBY' && (
              <button
                onClick={() => setPhase('QUESTION')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                بدء المسابقة الآن 🚀
              </button>
            )}
            {phase === 'QUESTION' && (
              <button
                onClick={() => setPhase('STATS')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                إغلاق الإجابات وعرض الإحصائيات 📊
              </button>
            )}
            {phase === 'STATS' && (
              <button
                onClick={() => setPhase('LEADERBOARD')}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                عرض لوحة الصدارة 🏆
              </button>
            )}
          </div>
        </div>

        {phase === 'LOBBY' && (
          <div className="text-center py-10 space-y-4">
            <div className="text-4xl animate-bounce">📱</div>
            <h3 className="text-lg font-bold text-white">في انتظار انضمام اللاعبين...</h3>
            <p className="text-sm text-slate-400">وجه اللاعبين للانتقال لصفحة الانضمام وإدخال الرمز <strong className="text-indigo-400 font-mono">{pin}</strong></p>
            <div className="inline-block bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-xs text-slate-300">
              عدد المتصلين الحالي: <span className="font-bold text-emerald-400">3 لاعبين</span>
            </div>
          </div>
        )}

        {phase === 'QUESTION' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>السؤال 1 من 10</span>
              <span className="font-mono text-amber-400 font-bold text-base">20 ثانية متبقية</span>
            </div>
            <h3 className="text-xl font-bold text-white bg-slate-900 p-4 rounded-xl border border-slate-800">
              ما هي عاصمة المملكة العربية السعودية؟
            </h3>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HostPage() {
  return (
    <Suspense fallback={<div className="text-center py-10 text-slate-400">جاري تحميل شاشة المستضيف...</div>}>
      <HostContent />
    </Suspense>
  );
}
