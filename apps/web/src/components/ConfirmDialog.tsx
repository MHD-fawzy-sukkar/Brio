'use client';

import { ButtonContent } from './Loading';

export function ConfirmDialog({open,title,description,busy,onCancel,onConfirm}:{open:boolean;title:string;description:string;busy:boolean;onCancel:()=>void;onConfirm:()=>void}){
  if(!open)return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-brand-200/60 p-4 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!busy)onCancel();}}><section role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="card w-full max-w-md p-7"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-2xl">🗑️</div><h2 id="confirm-title" className="mt-4 text-xl font-black text-slate-900">{title}</h2><p className="mt-2 text-sm leading-7 text-slate-500">{description}</p><div className="mt-7 flex gap-3"><button onClick={onConfirm} disabled={busy} className="flex-1 rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700"><ButtonContent busy={busy} busyText="جاري الحذف…">تأكيد الحذف</ButtonContent></button><button onClick={onCancel} disabled={busy} className="secondary-btn flex-1">تراجع</button></div></section></div>;
}
