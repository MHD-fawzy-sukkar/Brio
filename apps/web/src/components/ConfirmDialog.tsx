'use client';

import { useEffect, useId, useRef } from 'react';
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
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
      if (event.key !== 'Tab') return;
      const buttons = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
      );
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="card relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto border border-rose-100 bg-white p-7 text-center shadow-2xl sm:p-8"
      >
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-amber-50 text-3xl shadow-sm">
          {icon}
        </div>
        <h2 id={titleId} className="mt-5 text-2xl font-black text-slate-900">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2.5 text-sm font-semibold leading-7 text-slate-500">
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
