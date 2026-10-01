'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrioRoomSocket } from '../../services/socket';

function PlayContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId') || 'demo-room';
  const code = searchParams.get('code') || '123456';
  const playerId = searchParams.get('playerId') || 'p_demo';
  const nickname = searchParams.get('nickname') || 'لاعب جديد';
  const avatar = searchParams.get('avatar') || '/avatars/avatar-1.svg';

  const [snapshot, setSnapshot] = useState<any>(null);
  const [socket, setSocket] = useState<BrioRoomSocket | null>(null);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswerInput, setTextAnswerInput] = useState<string>('');
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'accepted' | 'rejected'>('idle');
  const [rejectionReason, setRejectionReason] = useState<string>('');

  useEffect(() => {
    if (!roomId) return;
    const roomSocket = new BrioRoomSocket(roomId, 'player', playerId);
    roomSocket.connect();
    setSocket(roomSocket);

    const unsubscribe = roomSocket.onSnapshot((data) => {
      setSnapshot(data);
    });

    return () => {
      unsubscribe();
      roomSocket.close();
    };
  }, [roomId, playerId]);

  const currentQuestion = snapshot?.question;
  const phase = snapshot?.phase || 'LOBBY';
  const roundId = snapshot?.roundId || '';
  const ownScore = snapshot?.ownScore ?? 0;

  const handleSubmit = async (optionId?: string) => {
    if (!socket || !roundId || submissionStatus === 'submitting' || submissionStatus === 'accepted') return;

    if (optionId) {
      setSelectedOption(optionId);
    }
    setSubmissionStatus('submitting');
    const submissionId = 'sub_' + Math.random().toString(36).substring(2, 9);

    try {
      await socket.submitAnswer(roundId, submissionId, {
        optionId,
        textAnswer: currentQuestion?.type === 'ShortAnswer' ? textAnswerInput : undefined
      });
      setSubmissionStatus('accepted');
    } catch (err: any) {
      setSubmissionStatus('rejected');
      setRejectionReason(err.message || 'الإجابة مرفوضة');
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={avatar} alt="Avatar" className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700" />
          <div>
            <h1 className="text-sm font-bold text-white">{nickname}</h1>
            <p className="text-xs text-slate-400">رمز الغرفة: {code}</p>
          </div>
        </div>
        <div className="text-left">
          <span className="block text-[10px] text-slate-400">النقاط الحالية</span>
          <span className="text-lg font-extrabold text-emerald-400 font-mono">{ownScore}</span>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        {phase === 'LOBBY' && (
          <div className="text-center py-8 space-y-2">
            <div className="text-3xl animate-bounce">⏳</div>
            <h2 className="text-base font-bold text-white">أنت الآن في غرفة الانتظار</h2>
            <p className="text-xs text-slate-400">سيبدأ المستضيف المسابقة قريبًا...</p>
          </div>
        )}

        {phase === 'COUNTDOWN' && (
          <div className="text-center py-8 space-y-2">
            <div className="text-4xl animate-spin text-indigo-400">3</div>
            <h2 className="text-lg font-bold text-white">استعد! المسابقة تبدأ الآن</h2>
          </div>
        )}

        {phase === 'QUESTION' && currentQuestion && (
          <>
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
              <span>السؤال (نوع: {currentQuestion.type})</span>
              <span className="font-mono text-amber-400 font-bold text-sm">مباشر</span>
            </div>

            <h2 className="text-base font-bold text-white text-center py-2">
              {currentQuestion.text}
            </h2>

            {currentQuestion.options && currentQuestion.options.length > 0 && (
              <div className="grid grid-cols-1 gap-3 pt-2">
                {currentQuestion.options.map((opt: any) => {
                  const isSelected = selectedOption === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSubmit(opt.id)}
                      disabled={submissionStatus === 'submitting' || submissionStatus === 'accepted'}
                      className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold transition-all text-center border cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-[1.02]'
                          : submissionStatus === 'accepted'
                          ? 'bg-slate-900/60 border-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-100 hover:border-slate-600'
                      }`}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'ShortAnswer' && (
              <div className="space-y-3 pt-2">
                <input
                  type="text"
                  value={textAnswerInput}
                  onChange={(e) => setTextAnswerInput(e.target.value)}
                  disabled={submissionStatus === 'submitting' || submissionStatus === 'accepted'}
                  placeholder="اكتب الإجابة القصيرة هنا..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleSubmit()}
                  disabled={!textAnswerInput.trim() || submissionStatus === 'submitting' || submissionStatus === 'accepted'}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold py-3 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  إرسال الإجابة 🚀
                </button>
              </div>
            )}

            {submissionStatus === 'submitting' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center text-xs text-amber-300 font-semibold animate-pulse">
                جاري إرسال الإجابة والحصول على إيصال التوثيق... ⏳
              </div>
            )}

            {submissionStatus === 'accepted' && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-xs text-emerald-300 font-semibold">
                تم توثيق إجابتك بحفظ دائم (Durable ACK)! ⚡
              </div>
            )}

            {submissionStatus === 'rejected' && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center text-xs text-rose-300 font-semibold">
                فشل توثيق الإجابة: {rejectionReason}
              </div>
            )}
          </>
        )}

        {phase === 'FINISHED' && (
          <div className="text-center py-8 space-y-2">
            <div className="text-4xl">🎉</div>
            <h2 className="text-lg font-bold text-white">انتهت اللعبة!</h2>
            <p className="text-xs text-slate-400">مجموع نقاطك النهائي: <strong className="text-emerald-400 font-mono">{ownScore}</strong></p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="text-center py-10 text-slate-400">جاري تحميل شاشة اللاعب...</div>}>
      <PlayContent />
    </Suspense>
  );
}
