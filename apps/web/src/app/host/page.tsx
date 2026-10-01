'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrioRoomSocket } from '../../services/socket';

function HostContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId') || 'demo-room';
  const initialPin = searchParams.get('code') || '123456';

  const [snapshot, setSnapshot] = useState<any>(null);
  const [socket, setSocket] = useState<BrioRoomSocket | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const roomSocket = new BrioRoomSocket(roomId, 'host');
    roomSocket.connect();
    setSocket(roomSocket);

    const unsubscribe = roomSocket.onSnapshot((data) => {
      setSnapshot(data);
    });

    return () => {
      unsubscribe();
      roomSocket.close();
    };
  }, [roomId]);

  const phase = snapshot?.phase || 'LOBBY';
  const pin = snapshot?.code || initialPin;
  const playerCount = snapshot?.playerCount ?? 0;
  const currentQuestion = snapshot?.question;

  const handleStartGame = () => {
    if (socket) {
      socket.startQuiz();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            شاشة المستضيف | Host Screen
          </span>
          <h1 className="text-xl font-bold text-white mt-2">معرف الغرفة: {roomId}</h1>
        </div>

        <div className="text-center bg-slate-900 border border-slate-700 px-6 py-3 rounded-2xl">
          <span className="block text-xs text-slate-400">رمز الانضمام (PIN)</span>
          <span className="text-3xl font-extrabold font-mono text-indigo-400 tracking-wider">{pin}</span>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-base font-semibold text-white">
            حالة اللعبة الحالية: <span className="text-indigo-400 font-mono">{phase}</span>
          </h2>
          <div className="flex gap-2">
            {phase === 'LOBBY' && (
              <button
                onClick={handleStartGame}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                بدء المسابقة الآن 🚀
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
              عدد المتصلين الحالي: <span className="font-bold text-emerald-400">{playerCount} لاعبين</span>
            </div>
          </div>
        )}

        {(phase === 'COUNTDOWN' || phase === 'QUESTION') && currentQuestion && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>السؤال (نوع: {currentQuestion.type})</span>
              <span className="font-mono text-amber-400 font-bold text-base">
                {phase === 'COUNTDOWN' ? 'جاري الاستعداد...' : 'مباشر 🔴'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white bg-slate-900 p-4 rounded-xl border border-slate-800">
              {currentQuestion.text}
            </h3>
          </div>
        )}

        {phase === 'FINISHED' && (
          <div className="text-center py-10 space-y-4">
            <div className="text-5xl">🏆</div>
            <h3 className="text-2xl font-bold text-white">انتهت المسابقة!</h3>
            <p className="text-sm text-slate-400">شكرًا لجميع المشاركين!</p>
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
