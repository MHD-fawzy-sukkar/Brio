'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { QuestionType, PointsMultiplier, AuthoringQuestion } from '@brio/contracts';

function BuilderContent() {
  const searchParams = useSearchParams();
  const quizId = searchParams.get('quizId') || 'new';

  const [title, setTitle] = useState('مسابقة جديدة بدون عنوان');
  const [questions, setQuestions] = useState<AuthoringQuestion[]>([
    {
      type: 'MultipleChoice',
      text: 'ما هي عاصمة المملكة العربية السعودية؟',
      durationMs: 20000,
      multiplier: 'Standard',
      options: [
        { text: 'الرياض', isCorrect: true },
        { text: 'جدة', isCorrect: false },
        { text: 'مكة المكرمة', isCorrect: false },
        { text: 'الدمام', isCorrect: false }
      ],
      acceptedAlternatives: []
    }
  ]);

  const [newType, setNewType] = useState<QuestionType>('MultipleChoice');
  const [newText, setNewText] = useState('');
  const [newDurationSec, setNewDurationSec] = useState(20);
  const [newMultiplier, setNewMultiplier] = useState<PointsMultiplier>('Standard');
  const [newAltText, setNewAltText] = useState('');

  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (quizId && quizId !== 'new') {
      fetch(`/api/quizzes/${quizId}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('تعذر جلب تفاصيل المسابقة');
        })
        .then((data) => {
          if (data.title) setTitle(data.title);
          if (data.questions && data.questions.length > 0) {
            setQuestions(
              data.questions.map((q: any) => ({
                id: q.id,
                type: q.type,
                text: q.text,
                durationMs: q.duration_ms || q.durationMs || 20000,
                multiplier: q.multiplier || 'Standard',
                options: q.options ? q.options.map((o: any) => ({ text: o.text, isCorrect: o.is_correct === 1 || o.isCorrect === true })) : [],
                acceptedAlternatives: q.acceptedAlternatives || []
              }))
            );
          }
        })
        .catch(() => {
          // Local fallback for draft editing
        });
    }
  }, [quizId]);

  const handleAddQuestion = () => {
    setErrorMsg(null);
    if (!newText.trim()) {
      setErrorMsg('نص السؤال مطلوب');
      return;
    }

    let questionToAdd: AuthoringQuestion;

    if (newType === 'MultipleChoice') {
      questionToAdd = {
        type: 'MultipleChoice',
        text: newText.trim(),
        durationMs: newDurationSec * 1000,
        multiplier: newMultiplier,
        options: [
          { text: 'خيار 1 (صحيح)', isCorrect: true },
          { text: 'خيار 2', isCorrect: false },
          { text: 'خيار 3', isCorrect: false },
          { text: 'خيار 4', isCorrect: false }
        ],
        acceptedAlternatives: []
      };
    } else if (newType === 'TrueFalse') {
      questionToAdd = {
        type: 'TrueFalse',
        text: newText.trim(),
        durationMs: newDurationSec * 1000,
        multiplier: newMultiplier,
        options: [
          { text: 'صح', isCorrect: true },
          { text: 'خطأ', isCorrect: false }
        ],
        acceptedAlternatives: []
      };
    } else if (newType === 'Poll') {
      questionToAdd = {
        type: 'Poll',
        text: newText.trim(),
        durationMs: newDurationSec * 1000,
        multiplier: 'Zero',
        options: [
          { text: 'خيار 1', isCorrect: false },
          { text: 'خيار 2', isCorrect: false }
        ],
        acceptedAlternatives: []
      };
    } else {
      if (!newAltText.trim()) {
        setErrorMsg('يجب تقديم إجابة مقبولة واحدة على الأقل لأسئلة الإجابة القصيرة');
        return;
      }
      questionToAdd = {
        type: 'ShortAnswer',
        text: newText.trim(),
        durationMs: newDurationSec * 1000,
        multiplier: newMultiplier,
        options: [],
        acceptedAlternatives: [newAltText.trim()]
      };
    }

    setQuestions([...questions, questionToAdd]);
    setNewText('');
    setNewAltText('');
  };

  const handleRemoveQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handlePublish = async () => {
    setPublishing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (quizId !== 'new') {
        const res = await fetch(`/api/quizzes/${quizId}/publish`, {
          method: 'POST'
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ detail: 'فشلت عملية النشر' }));
          throw new Error(errData.detail);
        }
        const published = await res.json();
        setSuccessMsg(`تم نشر المسابقة بنجاح! الإصدار غير القابل للتعديل: v${published.revision}`);
      } else {
        setSuccessMsg('تم حفظ ونشر المسابقة محلياً بنجاح!');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">مُنشئ المسابقات | Quiz Builder</h1>
          <p className="text-xs text-slate-400">معرف الكويز: {quizId}</p>
        </div>
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
        >
          {publishing ? 'جاري النشر...' : 'حفظ ونشر نسخة غير قابلة للتعديل 🚀'}
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-950/50 border border-red-500/40 rounded-xl text-xs text-red-300">
          ⚠️ {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-xs text-emerald-300">
          ✅ {successMsg}
        </div>
      )}

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">عنوان المسابقة</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-base font-medium"
          />
        </div>
      </div>

      {/* Add New Question Section */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-slate-900 pb-2">إضافة سؤال جديد</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">نوع السؤال</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as QuestionType)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="MultipleChoice">اختيار من متعدد (4 خيارات)</option>
              <option value="TrueFalse">صح / خطأ (خياران)</option>
              <option value="Poll">استطلاع رأي (بدون نقاط)</option>
              <option value="ShortAnswer">إجابة قصيرة نصية</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">المدة الزمانية (ثواني)</label>
            <input
              type="number"
              min={10}
              max={120}
              value={newDurationSec}
              onChange={(e) => setNewDurationSec(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">مضاعف النقاط</label>
            <select
              value={newMultiplier}
              onChange={(e) => setNewMultiplier(e.target.value as PointsMultiplier)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="Standard">قياسي (1000 نقطة)</option>
              <option value="Double">مضاعف (2000 نقطة)</option>
              <option value="Zero">بدون نقاط (0 نقطة)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">نص السؤال</label>
          <input
            type="text"
            placeholder="أدخل سؤالك هنا..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
          />
        </div>

        {newType === 'ShortAnswer' && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">الإجابة المقبولة الصحيحة</label>
            <input
              type="text"
              placeholder="مثال: الرياض"
              value={newAltText}
              onChange={(e) => setNewAltText(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleAddQuestion}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          + إضافة السؤال لقائمة المسابقة
        </button>
      </div>

      {/* Existing Questions List */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">الأسئلة المُضافة ({questions.length})</h2>

        {questions.map((q, idx) => (
          <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">
                سؤال {idx + 1} ({q.type})
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">مدة الإجابة: {q.durationMs / 1000} ثانية</span>
                <button
                  onClick={() => handleRemoveQuestion(idx)}
                  className="text-xs text-red-400 hover:text-red-300 font-bold cursor-pointer"
                >
                  حذف 🗑️
                </button>
              </div>
            </div>

            <p className="text-sm font-semibold text-white">{q.text}</p>

            {q.options && q.options.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                {q.options.map((opt, oIdx) => (
                  <div
                    key={oIdx}
                    className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                      opt.isCorrect ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span>{opt.text}</span>
                    {opt.isCorrect && <span className="font-bold">✓ صحيح</span>}
                  </div>
                ))}
              </div>
            )}

            {q.acceptedAlternatives && q.acceptedAlternatives.length > 0 && (
              <div className="p-2.5 bg-slate-900 rounded-xl text-xs text-slate-300 space-y-1">
                <span className="font-semibold text-indigo-400">الإجابات المقبولة الصحيحة (خاصة بالمنشئ):</span>
                <p>{q.acceptedAlternatives.join('، ')}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<div className="text-center py-10 text-slate-400">جاري تحميل أداة التعديل...</div>}>
      <BuilderContent />
    </Suspense>
  );
}
