'use client';

import { useTranslations } from '../../i18n/use-locale';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { accentPalette, THEME_PALETTES } from './theme-palette';
import { ColorSpectrum } from './ColorSpectrum';

const presets = Object.entries(THEME_PALETTES);
const quickPresets = presets.slice(0, 5);

export function ThemeColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const { t, translateMessage } = useTranslations();
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [showSpectrum, setShowSpectrum] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<CSSProperties>({});
  const panelId = useId();
  const palette = accentPalette(value);
  const extra = !quickPresets.some(([key]) => key === value);
  const choose = (color: string) => {
    onChange(color);
    setHex(accentPalette(color).color);
    setInvalid(false);
  };
  const close = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  const placePanel = () => {
    if (!root.current) return;
    const rect = root.current.getBoundingClientRect();
    const width = Math.min(rect.width, 352, window.innerWidth - 24);
    const above = rect.top > window.innerHeight - rect.bottom;
    setPosition({
      width,
      left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      ...(above
        ? { bottom: Math.max(12, window.innerHeight - rect.top + 8), maxHeight: Math.max(120, rect.top - 20) }
        : {
            top: Math.max(12, rect.bottom + 8),
            maxHeight: Math.max(120, window.innerHeight - rect.bottom - 20),
          }),
    });
  };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', placePanel);
    window.addEventListener('scroll', placePanel, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', placePanel);
      window.removeEventListener('scroll', placePanel, true);
    };
  }, [open]);

  const swatch = ([key, preset]: (typeof presets)[number]) => (
    <button
      key={key}
      type="button"
      aria-label={translateMessage(preset.label)}
      title={translateMessage(preset.label)}
      aria-pressed={value === key}
      onClick={() => choose(key)}
      className="theme-color-swatch"
      style={{ color: preset.color }}
    >
      <span style={{ backgroundColor: preset.color }}>{value === key ? '✓' : ''}</span>
    </button>
  );
  const applyHex = () => {
    const color = hex.trim().replace(/^#?/, '#');
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      setInvalid(true);
      return;
    }
    choose(color.toLowerCase());
    close();
  };

  return (
    <div ref={root} className="theme-color-control">
      {quickPresets.map(swatch)}
      <button
        ref={trigger}
        type="button"
        className="theme-color-swatch theme-color-more"
        aria-label={t('ألوان إضافية ولون مخصّص')}
        title={t('ألوان إضافية ولون مخصّص')}
        aria-expanded={open}
        aria-controls={panelId}
        style={extra ? { color: palette.color } : undefined}
        onClick={() => {
          placePanel();
          setHex(palette.color);
          setInvalid(false);
          setShowSpectrum(false);
          setOpen((current) => !current);
        }}
      >
        <span style={extra ? { background: palette.color, color: palette.onAccent } : undefined}>
          {extra ? '✓' : '+'}
        </span>
      </button>
      <span className="theme-color-control__name">{translateMessage(palette.label)}</span>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={panelId}
            style={position}
            className="theme-color-panel"
            role="group"
            aria-label={t('لوحة ألوان الهوية')}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-700">{t('ألوان إضافية')}</p>
              <button
                type="button"
                onClick={close}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-50"
                aria-label={t('إغلاق لوحة الألوان')}
              >
                ×
              </button>
            </div>
            <div className="mt-2 grid grid-cols-6 justify-items-center gap-2">{presets.map(swatch)}</div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                className="theme-custom-color"
                aria-label={t('اختيار لون مخصّص')}
                aria-expanded={showSpectrum}
                aria-controls={`${panelId}-spectrum`}
                onClick={() => setShowSpectrum((current) => !current)}
              >
                <span
                  className="theme-custom-color__preview"
                  style={{ backgroundColor: palette.color }}
                  aria-hidden="true"
                >
                  <span>✎</span>
                </span>
                <span>
                  <span className="block text-xs font-black text-slate-700">{t('لون مخصّص')}</span>
                  <span className="mt-1 block text-[11px] text-slate-500">{t('اضغط لاختيار لونك')}</span>
                </span>
                <span className="mr-auto text-slate-400" aria-hidden="true">
                  ‹
                </span>
              </button>
              {showSpectrum && (
                <div id={`${panelId}-spectrum`}>
                  <ColorSpectrum color={palette.color} onChange={choose} />
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <input
                  aria-label={t('رمز اللون HEX')}
                  value={hex}
                  maxLength={7}
                  spellCheck={false}
                  dir="ltr"
                  placeholder="#2563eb"
                  aria-invalid={invalid}
                  onChange={(event) => {
                    setHex(event.target.value);
                    setInvalid(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      applyHex();
                    }
                  }}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-700"
                />
                <button type="button" onClick={applyHex} className="theme-color-apply">
                  <span aria-hidden="true">✓</span> {t('تطبيق')}
                </button>
              </div>
              {invalid && (
                <p role="alert" className="mt-2 text-xs text-rose-700">
                  {t('أدخل رمزاً من 6 خانات، مثل #2563eb.')}
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
