'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ResultsContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId') || 'demo-room';

  const podium = [
    { rank: 1, nickname: 'أحمد المتفوق', score: 9500, avatar: '/avatars/avatar-1.svg', color: 'border-amber-400 bg-amber-500/10' },
    { rank: 2, nickname: 'سارة الذكية', score: 8200, avatar: '/avatars/avatar-2.svg', color: 'border-slate-300 bg-slate-400/10' },
    { rank: 3, nickname: 'خالد البطل', score: 7100, avatar: '/avatars/avatar-3.svg', color: 'border-amber-700 bg-amber-700/10' }
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto text-center">
      <div className="space-y-2">
        <div className="text-4xl">🏆</div>
        <h1 className="text-2xl font-extrabold text-white">النتائج النهائية والمنصة</h1>
        <p className="text-xs text-slate-400">معرف الغرفة: {roomId}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 items-end pt-6 min-h-[220px]">
        {/* Rank 2 */}
        <div className={`p-4 rounded-2xl border ${podium[1].color} flex flex-col items-center gap-2 space-y-1`}>
          <span className="text-2xl">🥈</span>
          <img src={podium[1].avatar} alt={podium[1].nickname} className="w-12 h-12 rounded-xl" />
          <span className="text-xs font-bold text-white">{podium[1].nickname}</span>
          <span className="text-xs font-mono text-slate-300">{podium[1].score} نقطة</span>
        </div>

        {/* Rank 1 */}
        <div className={`p-5 rounded-2xl border-2 ${podium[0].color} flex flex-col items-center gap-2 space-y-1 transform -translate-y-4 shadow-xl`}>
          <span className="text-3xl">👑</span>
          <img src={podium[0].avatar} alt={podium[0].nickname} className="w-14 h-14 rounded-xl border-2 border-amber-400" />
          <span className="text-sm font-extrabold text-white">{podium[0].nickname}</span>
          <span className="text-sm font-mono font-bold text-amber-400">{podium[0].score} نقطة</span>
        </div>

        {/* Rank 3 */}
        <div className={`p-4 rounded-2xl border ${podium[2].color} flex flex-col items-center gap-2 space-y-1`}>
          <span className="text-2xl">🥉</span>
          <img src={podium[2].avatar} alt={podium[2].nickname} className="w-12 h-12 rounded-xl" />
          <span className="text-xs font-bold text-white">{podium[2].nickname}</span>
          <span className="text-xs font-mono text-slate-300">{podium[2].score} نقطة</span>
        </div>
      </div>

      <div className="pt-6">
        <a
          href="/"
          className="inline-block bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs py-2.5 px-6 rounded-xl transition-colors"
        >
          العودة للصفحة الرئيسية 🏠
        </a>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="text-center py-10 text-slate-400">جاري تحميل منصة النتائج...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
