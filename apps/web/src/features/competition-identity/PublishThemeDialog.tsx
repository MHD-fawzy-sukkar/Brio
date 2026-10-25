'use client';

import { ConfirmDialog } from '../../components/ConfirmDialog';

export function PublishThemeDialog({ open, busy = false, onCancel, onConfirm }: { open: boolean; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <ConfirmDialog open={open} busy={busy} icon="🌐" title="هل تريد نشر الثيم للعامة؟"
    description="سيظهر اسم الثيم وشعاره وشخصيته وصوره للجميع، ويستطيع أي شخص استخدام هويتك في مسابقاته. جعله خاصاً لاحقاً يوقف ظهوره في المكتبة، وتبقى المسابقات التي استخدمته سابقاً كما هي."
    confirmLabel="نعم، أوافق على إتاحته للجميع" busyLabel="جاري النشر…" cancelLabel="إبقاء الثيم خاصاً" onCancel={onCancel} onConfirm={onConfirm} />;
}
