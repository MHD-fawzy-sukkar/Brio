'use client';

import { ConfirmDialog } from '../../components/ConfirmDialog';

export function PublishThemeDialog({
  open,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      busy={busy}
      icon="🌐"
      title="هل تريد نشر الهوية للعامة؟"
      description="سيظهر اسم الهوية وشعارها وشخصيتها وصورها للجميع، ويستطيع أي شخص استخدام هويتك في مسابقاته. جعلها خاصة لاحقاً يوقف ظهورها في المكتبة، وتبقى المسابقات التي استخدمتها سابقاً كما هي."
      confirmLabel="نعم، أوافق على إتاحتها للجميع"
      busyLabel="جاري النشر…"
      cancelLabel="إبقاء الهوية خاصة"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
