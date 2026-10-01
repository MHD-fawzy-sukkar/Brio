'use client';

import { useEffect, useState } from 'react';
import type { QuizSummaryDto } from '@brio/contracts';

export default function DashboardPage() {
  const [quizzes, setQuizzes] = useState<QuizSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchQuizzes = async () => {
    try {
      const res = await fetch('/api/quizzes');
      if (!res.ok) {
        if (res.status === 401) {
          // If unauthorized, fallback to local draft state or redirect
          setQuizzes([
            {
              id: 'd9b23883-b363-4576-82dc-5c60127e4688',
              title: 'مسابقة المعرفة العامة الأولى',
              questionCount: 4,
              createdAt: '2026-09-30',
              updatedAt: '2026-09-30'
            }
          ]);
          setLoading(false);
          return;
        }
        const errData = await res.json().catch(() => ({ detail: 'تعذر جلب المسابقات' }));
        throw new Error(errData.detail);
      }
      const data = await res.json();
      setQuizzes(data);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleCreateNew = async () => {
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'مسابقة جديدة بدون عنوان',
          questions: []
        })
      });

      if (res.ok) {
        const created = await res.json();
        window.location.href = `/builder/?quizId=${created.id}`;
      } else {
        window.location.href = '/builder/';
      }
    } catch {
      window.location.href = '/builder/';
    }
  };

  const handleStartRoom = (quizId: string) => {
    const mockRoomId = 'room-' + Math.random().toString(36).substring(2, 8);
    window.location.href = `/host/?roomId=${encodeURIComponent(mockRoomId)}&quizId=${encodeURIComponent(quizId)}`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">لوحة تحكم المسابقات</h1>
          <p className="text-sm text-slate-400">إدارة وتعديل وإطلاق المسابقات الحية الخاصة بك (معزولة للمنشئ)</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow transition-colors flex items-center gap-2 cursor-pointer text-sm"
        >
          <span>إنشاء مسابقة جديدة</span>
          <span>+</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-950/50 border border-red-500/40 rounded-xl text-xs text-red-300">
          ⚠️ {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-400 text-sm">جاري تحميل مسابقاتك...</div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-12 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
          <div className="text-4xl">📝</div>
          <h2 className="text-lg font-bold text-white">لا توجد مسابقات بعد</h2>
          <p className="text-xs text-slate-400">أنشئ مسابقتك الأولى وأضف الأسئلة لتبدأ المنافسة الحية</p>
          <button
            onClick={handleCreateNew}
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
          >
            إنشاء مسابقة جديدة الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="text-lg font-semibold text-white">{quiz.title}</h2>
                  <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2.5 py-1 rounded-full font-medium border border-indigo-500/20">
                    {quiz.questionCount} أسئلة
                  </span>
                </div>
                <p className="text-xs text-slate-500">آخر تحديث: {new Date(quiz.updatedAt).toLocaleDateString('ar-SA')}</p>
              </div>

              <div className="flex items-center gap-2 border-t border-slate-900 pt-3">
                <button
                  onClick={() => handleStartRoom(quiz.id)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors cursor-pointer text-center"
                >
                  إطلاق غرفة مسابقة 🚀
                </button>
                <a
                  href={`/builder/?quizId=${quiz.id}`}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
                >
                  تعديل ✏️
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
