'use client';

import { useState } from 'react';

const AVATARS = [
  '/avatars/avatar-1.svg',
  '/avatars/avatar-2.svg',
  '/avatars/avatar-3.svg',
  '/avatars/avatar-4.svg',
  '/avatars/avatar-5.svg',
  '/avatars/avatar-6.svg',
];

export default function HomePage() {
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !nickname) return;
    window.location.href = `/play/?code=${encodeURIComponent(code)}&nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(selectedAvatar)}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] max-w-md mx-auto">
      <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-white">انضم للمسابقة الحية</h1>
          <p className="text-sm text-slate-400">أدخل رمز الغرفة واسم المستعار للبدء مباشرة</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">رمز الغرفة (PIN)</label>
            <input
              type="text"
              maxLength={6}
              placeholder="مثال: 123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">الاسم المستعار</label>
            <input
              type="text"
              maxLength={24}
              placeholder="أدخل اسمك الشائع"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">اختر الصورة الرمزية (الأفاتار)</label>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map((avatar, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`relative p-1 rounded-xl border-2 transition-all ${
                    selectedAvatar === avatar ? 'border-indigo-500 bg-indigo-500/10 scale-105' : 'border-transparent hover:border-slate-700'
                  }`}
                >
                  <img src={avatar} alt={`Avatar ${idx + 1}`} className="w-full h-auto rounded-lg" />
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-colors text-base cursor-pointer"
          >
            دخول المسابقة 🚀
          </button>
        </form>

        <div className="border-t border-slate-800 pt-4 text-center">
          <p className="text-xs text-slate-400">
            أنت منشئ مسابقات؟{' '}
            <a href="/login/" className="text-indigo-400 hover:underline font-semibold">
              سجل دخولك من هنا
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
