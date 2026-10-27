'use client';

import { useTranslations } from '../i18n/use-locale';

import { useEffect, useState } from 'react';
import { isLanMode } from '../services/runtime-mode';
export function buildPinJoinPath(pin: string): string {
  return `/join/?pin=${encodeURIComponent(pin)}`;
}

export function JoinQrCode({ pin, className = '' }: { pin: string; className?: string }) {
  const { t } = useTranslations();
  const [image, setImage] = useState('');
  const [origins, setOrigins] = useState<string[]>([]);
  const [joinOrigin, setJoinOrigin] = useState('');
  useEffect(() => {
    if (!isLanMode) return;
    void fetch('/api/local/info')
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => {
        const urls = info?.joinOrigins || [];
        const saved = localStorage.getItem('brio-player-network');
        setOrigins(urls);
        setJoinOrigin(urls.includes(saved) ? saved : urls[0] || '');
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!/^\d{6}$/.test(pin)) return;
    let active = true;
    setImage('');
    if (isLanMode && !joinOrigin) return;
    const url = new URL(buildPinJoinPath(pin), joinOrigin || window.location.origin).toString();
    void import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(url, {
          width: 224,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#6d2335', light: '#ffffff' },
        }),
      )
      .then((data) => {
        if (active) setImage(data);
      });
    return () => {
      active = false;
    };
  }, [pin, joinOrigin]);
  return (
    <div className="flex min-w-0 flex-col items-center gap-3">
      <div
        className={`grid aspect-square place-items-center overflow-hidden rounded-2xl border-8 border-white bg-white shadow-sm ${className}`}
      >
        {image ? (
          <img src={image} alt={t('رمز QR للانضمام إلى اللعبة {0}', { 0: pin })} className="h-full w-full" />
        ) : (
          <div className="skeleton-shimmer h-full w-full" />
        )}
      </div>
      {isLanMode &&
        (origins.length ? (
          <div className="w-full max-w-sm text-center text-xs leading-6">
            <label className="font-bold">
              {t('رابط الانضمام على شبكتك')}
              <select
                aria-label={t('رابط الانضمام على شبكتك')}
                dir="ltr"
                className="field mt-2 text-xs"
                value={joinOrigin}
                onChange={(e) => {
                  setJoinOrigin(e.target.value);
                  localStorage.setItem('brio-player-network', e.target.value);
                }}
              >
                {origins.map((url) => (
                  <option key={url} value={url}>
                    {url}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-slate-500">
              {t(
                'امسح الرمز من هاتف متصل بالشبكة نفسها للتأكد من عمل الرابط. إذا لم تفتح الصفحة، اختر عنواناً آخر من القائمة.',
              )}
            </p>
          </div>
        ) : (
          <p role="alert" className="text-xs text-rose-600">
            {t('وصّل جهاز المقدّم بالشبكة، ثم أعد تشغيل اللعبة لإظهار رابط الانضمام.')}
          </p>
        ))}
    </div>
  );
}
