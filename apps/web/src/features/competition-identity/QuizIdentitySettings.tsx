'use client';

import { useEffect, useRef, useState } from 'react';
import type { IdentityRecordDto } from '@brio/contracts';
import { getQuizIdentity, assignIdentity } from './api';
import { IdentityEditor } from './IdentityEditor';
import { IdentityPreview } from './IdentityPreview';

type PanelState = { mode: 'closed' | 'loading' | 'editor' | 'locked' | 'error'; record?: IdentityRecordDto; error?: string };

export function QuizIdentitySettings({ quizId, quizTitle, value, onSaved, onBusyChange, disabled = false }: {
  quizId: string; quizTitle: string; value: string | null;
  onSaved: (id: string | null) => void; onBusyChange: (busy: boolean) => void; disabled?: boolean;
}) {
  const [panel, setPanel] = useState<PanelState>({ mode: 'closed' });
  const [resetting, setResetting] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); onBusyChange(false); }, [onBusyChange]);
  const close = () => { request.current?.abort(); setPanel({ mode: 'closed' }); onBusyChange(false); };
  const edit = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPanel({ mode: 'loading' }); onBusyChange(true);
    try {
      const { record } = await getQuizIdentity(quizId, controller.signal);
      if (!controller.signal.aborted) { setPanel({ mode: record?.designLocked ? 'locked' : 'editor', record: record ?? undefined }); if (record?.designLocked) onBusyChange(false); }
    } catch (cause) {
      if (!controller.signal.aborted) { setPanel({ mode: 'error', error: cause instanceof Error ? cause.message : 'تعذّر تحميل الهوية.' }); onBusyChange(false); }
    }
  };
  return <section className="card space-y-4 p-5 sm:p-7" aria-label="هوية المسابقة">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-black">هوية المسابقة</h2><p className="mt-1 text-sm text-slate-500">{value ? 'هوية مخصصة لهذه المسابقة' : 'تستخدم هذه المسابقة شخصية بولت وصورها الافتراضية.'}</p></div>
      {panel.mode !== 'editor' && panel.mode !== 'loading' && <button type="button" disabled={disabled || resetting} className="secondary-btn" onClick={() => void edit()}>{value ? 'إدارة هوية المسابقة' : 'تخصيص الهوية'}</button>}
    </div>
    {panel.mode === 'loading' && <p role="status" className="text-sm text-slate-500">جاري تجهيز هوية المسابقة…</p>}
    {panel.mode === 'error' && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{panel.error}</p>}
    {panel.mode === 'locked' && panel.record && <><p className="rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">هذا الثيم العام للاستخدام فقط. لا يمكنك تعديل شخصيته أو شعاره أو إتاحته؛ يمكنك استخدامه كما هو أو العودة إلى بولت.</p><IdentityPreview identity={panel.record.identity} /></>}
    {panel.mode === 'editor' && <IdentityEditor quizId={quizId} defaultName={quizTitle} record={panel.record} onCancel={close} onSaved={record => { onSaved(record.id); close(); }} />}
    {value && panel.mode !== 'editor' && panel.mode !== 'loading' && <button type="button" disabled={disabled || resetting} className="text-sm font-bold text-slate-600" onClick={async () => {
      setResetting(true); onBusyChange(true);
      try { await assignIdentity(quizId, null); onSaved(null); setPanel({ mode: 'closed' }); }
      catch (cause) { setPanel({ mode: 'error', error: cause instanceof Error ? cause.message : 'تعذّر تغيير الهوية.' }); }
      finally { setResetting(false); onBusyChange(false); }
    }}>{resetting ? 'جاري الحفظ…' : 'استخدام هوية Brio الافتراضية'}</button>}
  </section>;
}
