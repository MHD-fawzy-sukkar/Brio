'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrioRoomSocket } from '../../services/socket';
import { globalMediaPrefetchEngine } from '../../services/media-prefetch';
import { registerServiceWorker } from '../../services/sw-register';

function PlayContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId') || 'demo-room';
  const code = searchParams.get('code') || '123456';
  const playerId = searchParams.get('playerId') || 'p_demo';
  const nickname = searchParams.get('nickname') || 'لاعب جديد';
  const avatar = searchParams.get('avatar') || '/avatars/avatar-1.svg';

  const [snapshot, setSnapshot] = useState<any>(null);
  const [socket, setSocket] = useState<BrioRoomSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswerInput, setTextAnswerInput] = useState<string>('');
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'accepted' | 'rejected'>('idle');
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  useEffect(() => {
    // Register Service Worker and handle foreground resync
    registerServiceWorker(() => {
      if (socket) {
        socket.connect();
      }
    });
  }, [socket]);

  useEffect(() => {
    if (!roomId) return;
    const roomSocket = new BrioRoomSocket(roomId, 'player', playerId);
    roomSocket.connect();
    setSocket(roomSocket);
    setIsConnected(true);

    const unsubscribe = roomSocket.onSnapshot((data) => {
      setSnapshot(data);
      setIsConnected(true);

      // Trigger prefetch for current and upcoming images
      if (data?.question?.essentialImage) {
        const imageUrl = data.question.essentialImage;
        const isEssential = data.question.essentialImageEssential !== false;

        if (globalMediaPrefetchEngine.isLoaded(imageUrl)) {
          setImageLoaded(true);
        } else {
          setImageLoaded(false);
          globalMediaPrefetchEngine.queueImages([{
            url: imageUrl,
            questionId: data.question.id,
            isEssential,
            priority: 1
          }]);
        }
      } else {
        setImageLoaded(true);
      }
    });

    return () => {
      unsubscribe();
      roomSocket.close();
    };
  }, [roomId, playerId]);

  // Listen to prefetch engine changes
  useEffect(() => {
    const unsub = globalMediaPrefetchEngine.subscribe((states) => {
      if (snapshot?.question?.essentialImage) {
        const state = states.get(snapshot.question.essentialImage);
        if (state?.status === 'loaded') {
          setImageLoaded(true);
        } else if (state?.status === 'error') {
          setImageError(true);
        }
      }
    });
    return unsub;
  }, [snapshot]);

  const currentQuestion = snapshot?.question;
  const phase = snapshot?.phase || 'LOBBY';
  const roundId = snapshot?.roundId || '';
  const ownScore = snapshot?.ownScore ?? 0;

  const isEssentialImage = currentQuestion?.essentialImage && currentQuestion?.essentialImageEssential !== false;
  // CRITICAL REQUIREMENT: Disable answer buttons ONLY if an ESSENTIAL image is still loading
  const isAnswerBlockedByImage = isEssentialImage && !imageLoaded && !imageError;

  const handleSubmit = async (optionId?: string) => {
    if (!socket || !roundId || isAnswerBlockedByImage || submissionStatus === 'submitting' || submissionStatus === 'accepted') return;

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
      {/* Top Header Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={avatar} alt="Avatar" className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700" />
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              {nickname}
              {!isConnected && (
                <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                  جاري إعادة الاتصال... 🔴
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">رمز الغرفة: {code}</p>
          </div>
        </div>
        <div className="text-left">
          <span className="block text-[10px] text-slate-400">النقاط الحالية</span>
          <span className="text-lg font-extrabold text-emerald-400 font-mono">{ownScore}</span>
        </div>
      </div>

      {/* Main Game Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        {phase === 'LOBBY' && (
          <div className="text-center py-8 space-y-2">
            <div className="text-3xl motion-reduce:animate-none animate-bounce">⏳</div>
            <h2 className="text-base font-bold text-white">أنت الآن في غرفة الانتظار</h2>
            <p className="text-xs text-slate-400">سيبدأ المستضيف المسابقة قريبًا...</p>
          </div>
        )}

        {phase === 'COUNTDOWN' && (
          <div className="text-center py-8 space-y-2">
            <div className="text-4xl font-extrabold text-indigo-400 font-mono">3</div>
            <h2 className="text-lg font-bold text-white">استعد! المسابقة تبدأ الآن</h2>
          </div>
        )}

        {phase === 'QUESTION' && currentQuestion && (
          <>
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
              <span>السؤال (نوع: {currentQuestion.type})</span>
              <span className="font-mono text-amber-400 font-bold text-sm">مباشر</span>
            </div>

            {/* Essential / Decorative Image Rendering */}
            {currentQuestion.essentialImage && (
              <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 my-2 min-h-[160px] flex items-center justify-center">
                {!imageLoaded && !imageError && (
                  <div className="text-center p-4 space-y-2">
                    <div className="text-xs text-amber-300 font-semibold animate-pulse">
                      جاري تحميل صورة السؤال الأساسية... 🖼️
                    </div>
                    {isEssentialImage && (
                      <span className="inline-block text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full">
                        image-delayed: الإجابات معطلة مؤقتًا لحين اكتمال التحميل
                      </span>
                    )}
                  </div>
                )}
                <img
                  src={currentQuestion.essentialImage}
                  alt="Question Media"
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  className={`w-full max-h-56 object-contain rounded-xl transition-opacity duration-300 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0 absolute'
                  }`}
                />
              </div>
            )}

            <h2 className="text-base font-bold text-white text-center py-2">
              {currentQuestion.text}
            </h2>

            {/* Multiple Choice / True False / Poll options */}
            {currentQuestion.options && currentQuestion.options.length > 0 && (
              <div className="grid grid-cols-1 gap-3 pt-2">
                {currentQuestion.options.map((opt: any) => {
                  const isSelected = selectedOption === opt.id;
                  const isDisabled = isAnswerBlockedByImage || submissionStatus === 'submitting' || submissionStatus === 'accepted';
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSubmit(opt.id)}
                      disabled={isDisabled}
                      className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold transition-all text-center border ${
                        isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                      } ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-[1.02]'
                          : submissionStatus === 'accepted'
                          ? 'bg-slate-900/60 border-slate-800 text-slate-500'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-100 hover:border-slate-600'
                      }`}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Short Answer Input */}
            {currentQuestion.type === 'ShortAnswer' && (
              <div className="space-y-3 pt-2">
                <input
                  type="text"
                  value={textAnswerInput}
                  onChange={(e) => setTextAnswerInput(e.target.value)}
                  disabled={isAnswerBlockedByImage || submissionStatus === 'submitting' || submissionStatus === 'accepted'}
                  placeholder="اكتب الإجابة القصيرة هنا..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <button
                  onClick={() => handleSubmit()}
                  disabled={isAnswerBlockedByImage || !textAnswerInput.trim() || submissionStatus === 'submitting' || submissionStatus === 'accepted'}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold py-3 rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  إرسال الإجابة 🚀
                </button>
              </div>
            )}

            {/* State indicators */}
            {submissionStatus === 'submitting' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center text-xs text-amber-300 font-semibold animate-pulse">
                جاري إرسال الإجابة والحصول على إيصال التوثيق... ⏳
              </div>
            )}

            {submissionStatus === 'accepted' && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-xs text-emerald-300 font-semibold">
                accepted: تم توثيق إجابتك بحفظ دائم (Durable ACK)! ⚡
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
