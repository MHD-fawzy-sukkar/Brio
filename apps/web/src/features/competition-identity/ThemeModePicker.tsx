'use client';

export type ThemeMode = 'default' | 'new' | 'saved';
const modes = [
  { id: 'default', title: 'بولت الافتراضي', description: 'هوية Brio وشخصية بولت الأصلية', icon: '⚡' },
  { id: 'new', title: 'هوية جديدة', description: 'شعارك وشخصيتك وصورك وألوانك', icon: '✦' },
  { id: 'saved', title: 'هوية محفوظة', description: 'اختر من هوياتك البصرية المحفوظة', icon: '▦' },
] as const;

export function ThemeModePicker({
  value,
  onChange,
}: {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="اختيار نوع الهوية">
      {modes.map((mode) => (
        <button
          type="button"
          key={mode.id}
          aria-pressed={value === mode.id}
          onClick={() => onChange(mode.id)}
          className={`theme-mode-card ${value === mode.id ? 'theme-mode-card--selected' : ''}`}
        >
          <span className="theme-mode-card__icon" aria-hidden="true">
            {mode.id === 'default' ? (
              <img src="/bolt-original.png" alt="" className="h-12 w-16 object-contain" />
            ) : (
              mode.icon
            )}
          </span>
          <span className="block text-sm font-black">{mode.title}</span>
          <span className="mt-1 block text-xs leading-6 text-slate-500">{mode.description}</span>
          <span className="theme-mode-card__check" aria-hidden="true">
            {value === mode.id ? '✓' : '+'}
          </span>
        </button>
      ))}
    </div>
  );
}
