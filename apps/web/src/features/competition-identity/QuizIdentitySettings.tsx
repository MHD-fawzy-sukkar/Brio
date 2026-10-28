'use client';

import { useTranslations } from '../../i18n/use-locale';

import { useEffect, useRef, useState } from 'react';
import type { IdentityRecordDto, ThemeSummaryDto } from '@brio/contracts';
import { getQuizIdentity, assignIdentity } from './api';
import { ThemeLibraryPicker } from './ThemeLibraryPicker';
import { IdentityEditor } from './IdentityEditor';
import { IdentityPreview } from './IdentityPreview';

type PanelState = {
  mode: 'closed' | 'loading' | 'editor' | 'locked' | 'error';
  record?: IdentityRecordDto;
  error?: string;
};

export function QuizIdentitySettings({
  quizId,
  quizTitle,
  value,
  onSaved,
  onBusyChange,
  disabled = false,
  pendingName,
}: {
  quizId: string;
  quizTitle: string;
  value: string | null;
  onSaved: (id: string | null) => void;
  onBusyChange: (busy: boolean) => void;
  disabled?: boolean;
  pendingName?: string;
}) {
  const { t, translateMessage } = useTranslations();
  const [panel, setPanel] = useState<PanelState>({ mode: 'closed' });
  const [choosing, setChoosing] = useState(false);
  const [selected, setSelected] = useState<ThemeSummaryDto | null>(null);
  const [resetting, setResetting] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      onBusyChange(false);
    },
    [onBusyChange],
  );
  const close = () => {
    request.current?.abort();
    setPanel({ mode: 'closed' });
    setChoosing(false);
    setSelected(null);
    onBusyChange(false);
  };
  const edit = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPanel({ mode: 'loading' });
    onBusyChange(true);
    try {
      const { record } = await getQuizIdentity(quizId, controller.signal);
      if (!controller.signal.aborted) {
        setPanel({ mode: record?.designLocked ? 'locked' : 'editor', record: record ?? undefined });
        if (record?.designLocked) onBusyChange(false);
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setPanel({ mode: 'error', error: cause instanceof Error ? cause.message : t('تعذّر تحميل الهوية.') });
        onBusyChange(false);
      }
    }
  };
  return (
    <section
      className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm sm:p-6"
      aria-label={t('هوية المسابقة')}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-700"
            aria-hidden="true"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.3 1.3 1.3 0 0 1 1-2.2H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3Z" />
              <circle cx="7.5" cy="11" r=".75" />
              <circle cx="10" cy="7.5" r=".75" />
              <circle cx="14.5" cy="7.5" r=".75" />
              <circle cx="17" cy="11" r=".75" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="font-black">{t('هوية المسابقة')}</h2>
            <p className="mt-1 break-words text-sm leading-6 text-slate-500">
              {pendingName ??
                (value
                  ? t('هوية مخصصة لهذه المسابقة')
                  : t('تستخدم هذه المسابقة شخصية بولت وصورها الافتراضية.'))}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!choosing && panel.mode !== 'editor' && panel.mode !== 'loading' && (
            <button
              type="button"
              disabled={disabled || resetting}
              className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
              onClick={() => void edit()}
            >
              {value ? t('إدارة هوية المسابقة') : t('تخصيص الهوية')}
            </button>
          )}
          {!choosing && panel.mode !== 'editor' && panel.mode !== 'loading' && (
            <button
              type="button"
              disabled={disabled || resetting}
              className="secondary-btn"
              onClick={() => {
                setPanel({ mode: 'closed' });
                setChoosing(true);
                onBusyChange(true);
              }}
            >
              {t('اختيار من هوياتي')}
            </button>
          )}
        </div>
      </div>
      {choosing && (
        <div className="space-y-4">
          <ThemeLibraryPicker selected={selected} onSelect={setSelected} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="min-w-0 text-xs text-slate-500">
              {selected
                ? t('الهوية المحددة: {0}', { 0: selected.name })
                : t('اختر هوية من المكتبة لتطبيقها على المسابقة')}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!selected || resetting}
                className="primary-btn"
                onClick={async () => {
                  if (!selected || resetting) return;
                  setResetting(true);
                  try {
                    const result = await assignIdentity(quizId, selected.id);
                    onSaved(result.identityId);
                    close();
                  } catch (cause) {
                    setPanel({
                      mode: 'error',
                      error: cause instanceof Error ? cause.message : t('تعذّر تطبيق الهوية.'),
                    });
                  } finally {
                    setResetting(false);
                  }
                }}
              >
                {resetting ? t('جاري تطبيق الهوية…') : t('استخدام هذه الهوية')}
              </button>
              <button type="button" disabled={resetting} className="secondary-btn" onClick={close}>
                {t('إلغاء')}
              </button>
            </div>
          </div>
        </div>
      )}
      {panel.mode === 'loading' && (
        <p role="status" className="text-sm text-slate-500">
          {t('جاري تجهيز هوية المسابقة…')}
        </p>
      )}
      {panel.mode === 'error' && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {translateMessage(panel.error ?? '')}
        </p>
      )}
      {panel.mode === 'locked' && panel.record && (
        <>
          <p className="rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
            {t('هذه نسخة محفوظة من هوية سابقة. يمكنك الاحتفاظ بها لهذه المسابقة أو اختيار هوية من هوياتك.')}
          </p>
          <IdentityPreview identity={panel.record.identity} />
        </>
      )}
      {panel.mode === 'editor' && (
        <IdentityEditor
          quizId={quizId}
          defaultName={quizTitle}
          record={panel.record}
          onCancel={close}
          onSaved={(record) => {
            onSaved(record.id);
            close();
          }}
        />
      )}
      {value && !choosing && panel.mode !== 'editor' && panel.mode !== 'loading' && (
        <button
          type="button"
          disabled={disabled || resetting}
          className="block border-t border-slate-100 pt-3 text-start text-xs font-semibold text-slate-500 transition hover:text-brand-700 disabled:opacity-50"
          onClick={async () => {
            setResetting(true);
            onBusyChange(true);
            try {
              await assignIdentity(quizId, null);
              onSaved(null);
              setPanel({ mode: 'closed' });
            } catch (cause) {
              setPanel({
                mode: 'error',
                error: cause instanceof Error ? cause.message : t('تعذّر تغيير الهوية.'),
              });
            } finally {
              setResetting(false);
              onBusyChange(false);
            }
          }}
        >
          {resetting ? t('جاري الحفظ…') : t('استخدام هوية Brio الافتراضية')}
        </button>
      )}
    </section>
  );
}
