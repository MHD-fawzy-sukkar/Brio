'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function PlayContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '123456';
  const nickname = searchParams.get('nickname') || 'لاعب جديد';
  const avatar = searchParams.get('avatar') || '/avatars/avatar-1.svg';

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const options = [
    { id: 'o1', text: 'الرياض' },
    { id: 'o2', text: 'جدة' },
    { id: 'o3', text: 'مكة المكرمة' },
    { id: 'o4', text: 'الدمام' }
  ];

  const handleSubmit = (optionId: string) => {
    if (submitted) return;
    setSelectedOption(optionId);
    setSubmitted(true);
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
          <span className="text-lg font-extrabold text-emerald-400 font-mono">1,000</span>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
          <span>السؤال 1</span>
          <span className="font-mono text-amber-400 font-bold text-sm">15 ثانية</span>
        </div>

        <h2 className="text-base font-bold text-white text-center py-2">
          ما هي عاصمة المملكة العربية السعودية؟
        </h2>

        <div className="grid grid-cols-1 gap-3 pt-2">
          {options.map((opt) => {
            const isSelected = selectedOption === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleSubmit(opt.id)}
                disabled={submitted}
                className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold transition-all text-center border cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-[1.02]'
                    : submitted
                    ? 'bg-slate-900/60 border-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-100 hover:border-slate-600'
                }`}
              >
                {opt.text}
              </button>
            );
          })}
        </div>

        {submitted && (
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center text-xs text-indigo-300 font-semibold animate-pulse">
            تم استلام إجابتك بنجاح! في انتظار انتهاء الوقت... ⏳
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
