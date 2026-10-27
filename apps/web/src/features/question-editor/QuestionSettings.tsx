'use client';
import type { AuthoringQuestion, PointsMultiplier } from '@brio/contracts';

import { useTranslations } from '../../i18n/use-locale';
export function QuestionSettings({
  question,
  setQuestion,
}: {
  question: AuthoringQuestion;
  setQuestion: (question: AuthoringQuestion) => void;
}) {
  const { t } = useTranslations();
  return (
    <aside className="card h-fit space-y-5 p-6">
      <h2 className="font-black">{t('إعدادات اللعب')}</h2>
      <div>
        <label className="label">{t('وقت الإجابة')}</label>
        <select
          className="field"
          value={question.durationMs}
          onChange={(e) => setQuestion({ ...question, durationMs: Number(e.target.value) })}
        >
          {[10, 15, 20, 30, 45, 60, 90, 120].map((seconds) => (
            <option key={seconds} value={seconds * 1000}>
              {seconds} {t('ثانية')}
            </option>
          ))}
        </select>
      </div>
      {question.type !== 'Poll' && (
        <div>
          <label className="label">{t('قيمة السؤال')}</label>
          <select
            className="field"
            value={question.multiplier}
            onChange={(e) => setQuestion({ ...question, multiplier: e.target.value as PointsMultiplier })}
          >
            <option value="Standard">{t('قياسي — حتى 1000')}</option>
            <option value="Double">{t('مضاعف — حتى 2000')}</option>
            <option value="Zero">{t('بدون نقاط')}</option>
          </select>
        </div>
      )}
      <div className="rounded-2xl bg-brand-50 p-4 text-xs leading-6 text-brand-800">
        <b className="block text-sm">{t('نقاط أذكى')}</b>
        {t('الإجابة الصحيحة تحصل على 50% من القيمة على الأقل، وتزداد حتى 100% كلما كانت أسرع.')}
      </div>
    </aside>
  );
}
