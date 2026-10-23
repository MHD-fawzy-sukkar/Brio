'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ButtonContent } from './Loading';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  busy: boolean;
  icon?: string;
  confirmLabel?: string;
  busyLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  busy,
  icon = '🗑️',
  confirmLabel = 'تأكيد الحذف',
  busyLabel = 'جاري الحذف…',
  cancelLabel = 'تراجع',
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const dialog = (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-slate-900/45 p-4 backdrop-blur-md transition-opacity"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="card relative w-full max-w-md overflow-hidden border border-rose-100 bg-white p-7 text-center shadow-2xl sm:p-8"
      >
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-amber-50 text-3xl shadow-sm">
          {icon}
        </div>
        <h2 id="confirm-title" className="mt-5 text-2xl font-black text-slate-900">
          {title}
        </h2>
        <p className="mt-2.5 text-sm font-semibold leading-7 text-slate-500">
          {description}
        </p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="secondary-btn flex-1 cursor-pointer py-3 text-sm font-black"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 cursor-pointer rounded-xl bg-rose-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700 disabled:opacity-60"
          >
            <ButtonContent busy={busy} busyText={busyLabel}>
              {confirmLabel}
            </ButtonContent>
          </button>
        </div>
      </section>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(dialog, document.body) : dialog;
}
