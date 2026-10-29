'use client';

import { useTranslations } from '../../i18n/use-locale';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AmbientBackground } from '../../components/AmbientBackground';
import { Avatar } from '../../components/Avatar';
import { AvatarPicker } from '../../features/competition-identity/AvatarPicker';
import { CompetitionIdentityProvider } from '../../features/competition-identity/CompetitionIdentityProvider';
import { useRoomIdentity } from '../../features/competition-identity/use-room-identity';
import { CompetitionIdentityBadge } from '../../features/competition-identity/CompetitionIdentityBadge';
import { selectedAvatar } from '../../features/competition-identity/model';
import { PageSkeleton } from '../../components/Loading';
import { usePlayerResume } from '../../hooks/use-player-resume';
import { enterPlayerGame } from '../../services/player-session';
import { RequestGate } from '../../services/request-gate';

function JoinSetup() {
  const { t, translateMessage } = useTranslations();
  const params = useSearchParams();
  const directRoomId = params.get('roomId') || '';
  const directCode = params.get('code') || '';
  const pin = (params.get('pin') || '').replace(/\D/g, '').slice(0, 6);
  const [roomId, setRoomId] = useState(directRoomId);
  const [code, setCode] = useState(directCode || pin);
  const [resolving, setResolving] = useState(!directRoomId);
  const [nickname, setNickname] = useState('');
  const roomIdentity = useRoomIdentity(roomId);
  const identity = roomIdentity.identity;
  const [avatarId, setAvatar] = useState('');
  const avatar = selectedAvatar(identity, avatarId);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const requestGate = useRef(new RequestGate());
  const resume = usePlayerResume(roomId, code);

  useEffect(() => {
    if (directRoomId && /^\d{6}$/.test(directCode)) {
      setResolving(false);
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError(t('رابط الانضمام غير مكتمل. اطلب من المضيف رمزاً جديداً.'));
      setResolving(false);
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setResolving(true);
    setError(null);
    fetch(`/api/rooms/by-code/${encodeURIComponent(pin)}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
    })
      .then(async (response) => {
        const room = await response.json().catch(() => null);
        if (!response.ok || !room?.roomId)
          throw new Error(t('لم نجد لعبة نشطة بهذا الرمز. تحقق منه وحاول مجدداً.'));
        setRoomId(room.roomId);
        setCode(pin);
      })
      .catch((cause) => {
        if ((cause as Error)?.name !== 'AbortError')
          setError(
            (cause as Error)?.name === 'TimeoutError'
              ? t('استغرق الاتصال وقتاً أطول من المتوقع. حاول مجدداً.')
              : cause instanceof Error
                ? cause.message
                : t('تعذر تجهيز رابط الانضمام.'),
          );
      })
      .finally(() => setResolving(false));
    return () => {
      controller.abort();
      if (requestRef.current === controller) requestRef.current = null;
    };
  }, [directRoomId, directCode, pin]);

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roomId || !code) return;
    if (nickname.trim().length < 2) return setError(t('اكتب اسماً من حرفين على الأقل.'));
    if (!requestGate.current.start()) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setJoining(true);
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
        method: 'POST',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), avatarId: avatar }),
      });
      const player = await response.json().catch(() => null);
      if (response.status === 404) throw new Error(t('انتهت اللعبة أو لم تعد متاحة.'));
      if (!response.ok || !player?.playerId)
        throw new Error(player?.detail || t('تعذر الانضمام إلى اللعبة.'));
      enterPlayerGame(roomId, code, player);
    } catch (cause) {
      if ((cause as Error)?.name !== 'AbortError')
        setError(
          (cause as Error)?.name === 'TimeoutError'
            ? t('استغرق الاتصال وقتاً أطول من المتوقع. حاول مجدداً.')
            : cause instanceof Error
              ? cause.message
              : t('تعذر الانضمام.'),
        );
    } finally {
      requestGate.current.finish();
      if (requestRef.current === controller) {
        requestRef.current = null;
        setJoining(false);
      }
    }
  };

  if (resolving || roomIdentity.loading || (roomId && code && !resume.checked))
    return <PageSkeleton kind="join" />;
  if (!roomId || !code || roomIdentity.error || resume.error)
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <div className="text-5xl">🔎</div>
        <h1 className="mt-4 text-xl font-black">{t('تعذر فتح رابط اللعبة')}</h1>
        <p className="mt-2 text-sm font-bold leading-7 text-rose-600">
          {translateMessage((resume.error || roomIdentity.error || error) ?? '')}
        </p>
        {resume.error && (
          <button type="button" onClick={resume.retry} className="primary-btn mt-6">
            {t('إعادة المحاولة')}
          </button>
        )}
        <a href="/join-game/" className="secondary-btn mt-6 inline-block">
          {t('إدخال الرمز يدوياً')}
        </a>
      </div>
    );

  return (
    <CompetitionIdentityProvider identity={identity}>
      <div className="join-setup mx-auto max-w-5xl space-y-3 sm:space-y-5">
        <CompetitionIdentityBadge />
        <section className="card join-setup__card overflow-hidden">
          <aside className="game-surface join-setup__preview text-slate-900">
            <AmbientBackground />
            <div className="relative z-10 flex items-center gap-4 lg:flex-col lg:text-center">
              <div className="join-setup__avatar">
                <Avatar src={avatar} presentation="hero" label={t('شخصيتك المختارة')} className="w-full" />
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-xl border border-white bg-white/90 px-3 py-1.5">
                  <span className="text-xs font-bold text-slate-500">{t('رمز اللعبة')}</span>
                  <b className="text-lg tracking-[.12em] text-brand-800" dir="ltr">
                    {code}
                  </b>
                </div>
                <h1 className="mt-3 text-lg font-black leading-8 lg:text-3xl">{t('شخصيتك في التحدي')}</h1>
                <p className="mt-1 text-xs leading-6 text-slate-600 lg:mt-3 lg:text-sm">
                  {t('تتغيّر المعاينة عند اختيار صورتك.')}
                </p>
              </div>
            </div>
          </aside>
          <form onSubmit={join} className="join-setup__form space-y-4 sm:space-y-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">{t('جهّز اسمك وصورتك')}</h2>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                {t('الرمز جاهز. بقي اسمك والصورة التي سترافقك.')}
              </p>
            </div>
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700"
              >
                {translateMessage(error ?? '')}
              </div>
            )}
            <div>
              <label htmlFor="nickname" className="label">
                {t('الاسم المستعار')}
              </label>
              <input
                id="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                minLength={2}
                maxLength={24}
                autoComplete="nickname"
                enterKeyHint="go"
                className="field"
                placeholder={t('مثال: فوزي')}
              />
            </div>
            <AvatarPicker compact value={avatar} onChange={setAvatar} />
            <div className="join-setup__action">
              <button
                type="submit"
                disabled={joining || nickname.trim().length < 2}
                className="primary-btn w-full py-3.5"
              >
                {joining ? t('لحظة، نجهّز مكانك…') : t('انضم إلى اللعبة')}
              </button>
            </div>
            <a
              href="/join-game/"
              className="block text-center text-xs font-bold text-slate-500 hover:text-brand-600"
            >
              {t('استخدام رمز مختلف')}
            </a>
          </form>
        </section>
      </div>
    </CompetitionIdentityProvider>
  );
}

export default function JoinPage() {
  const { t } = useTranslations();
  return (
    <Suspense
      fallback={
        <div className="card mx-auto max-w-lg p-12 text-center text-slate-500">{t('جاري تجهيز الغرفة…')}</div>
      }
    >
      <JoinSetup />
    </Suspense>
  );
}
