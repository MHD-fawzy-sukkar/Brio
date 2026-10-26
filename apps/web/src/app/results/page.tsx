'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { HostSnapshotDto, PlayerSnapshotDto } from '@brio/contracts';
import { CompetitionIdentityProvider } from '../../features/competition-identity/CompetitionIdentityProvider';
import { DEFAULT_COMPETITION_IDENTITY } from '../../features/competition-identity/model';
import { CompetitionIdentityBadge } from '../../features/competition-identity/CompetitionIdentityBadge';
import { Podium } from '../../components/Podium';
import { PageSkeleton } from '../../components/Loading';
import { requestJson } from '../../services/http-json';

type ResultSnapshot = HostSnapshotDto | PlayerSnapshotDto;

function PlayerResults({ snapshot }: { snapshot: PlayerSnapshotDto }) {
  const topThree = snapshot.ownRank !== null && snapshot.ownRank <= 3;
  return (
    <div className="relative mx-auto max-w-xl rounded-[2rem] border border-brand-100 bg-gradient-to-br from-white via-brand-50 to-amber-50 p-8 text-center text-slate-900 shadow-2xl shadow-brand-100/60 sm:p-10">
      <div className="text-7xl">{topThree ? '🏆' : '✨'}</div>
      <h1 className="mt-5 text-4xl font-black text-brand-950">
        {snapshot.ownRank === 1 ? 'أنت بطل الجولة!' : 'أحسنت اللعب!'}
      </h1>
      <p className="mt-2 text-sm font-bold text-slate-500">هذه نتيجتك النهائية بعد جمع نقاط جميع الأسئلة.</p>
      <div className="mt-8 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
          <small className="font-bold text-slate-500">الترتيب</small>
          <b className="mt-1 block text-4xl text-brand-700">#{snapshot.ownRank ?? '—'}</b>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <small className="font-bold text-slate-500">النقاط</small>
          <b className="mt-1 block text-3xl text-amber-600">{snapshot.ownScore.toLocaleString('ar')}</b>
        </div>
      </div>
      <a href="/" className="primary-btn mt-8 inline-block">
        العودة إلى الصفحة الرئيسية
      </a>
    </div>
  );
}

function ResultsContent() {
  const params = useSearchParams();
  const roomId = params.get('roomId') || '';
  const playerId = params.get('playerId') || '';
  const [state, setState] = useState<{ key: string; snapshot?: ResultSnapshot; error?: string }>();
  const key = `${roomId}:${playerId}`;
  useEffect(() => {
    if (!roomId) return;
    const controller = new AbortController();
    const query = playerId ? `?playerId=${encodeURIComponent(playerId)}` : '';
    requestJson<ResultSnapshot>(`/api/rooms/${encodeURIComponent(roomId)}/snapshot${query}`, {
      signal: controller.signal,
    })
      .then((snapshot) => {
        if (!controller.signal.aborted) setState({ key, snapshot });
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setState({ key, error: cause instanceof Error ? cause.message : 'تعذر تحميل النتائج.' });
      });
    return () => controller.abort();
  }, [roomId, playerId, key]);
  const error = !roomId ? 'معرّف الغرفة مفقود.' : state?.key === key ? state.error : undefined;
  if (error)
    return (
      <div role="alert" className="card mx-auto max-w-lg p-10 text-center font-bold text-rose-600">
        {error}
      </div>
    );
  const snapshot = state?.key === key ? state.snapshot : undefined;
  if (!snapshot) return <PageSkeleton />;
  return (
    <CompetitionIdentityProvider identity={snapshot.identity ?? DEFAULT_COMPETITION_IDENTITY}>
      <div className="space-y-6">
        <CompetitionIdentityBadge />
        {snapshot.role === 'host' ? (
          <div className="mx-auto max-w-6xl space-y-6">
            <Podium players={snapshot.leaderboard} />
            <div className="text-center">
              <a className="primary-btn inline-block" href="/dashboard/">
                العودة للوحة التحكم
              </a>
            </div>
          </div>
        ) : (
          <PlayerResults snapshot={snapshot} />
        )}
      </div>
    </CompetitionIdentityProvider>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ResultsContent />
    </Suspense>
  );
}
