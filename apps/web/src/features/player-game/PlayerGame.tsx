'use client';
import { Spinner } from '../../components/Loading';
import { AmbientBackground } from '../../components/AmbientBackground';
import { CompetitionIdentityProvider } from '../competition-identity/CompetitionIdentityProvider';
import { DEFAULT_COMPETITION_IDENTITY } from '../competition-identity/model';
import { CompetitionIdentityBadge } from '../competition-identity/CompetitionIdentityBadge';
import { CompetitionMascot } from '../competition-identity/CompetitionMascot';
import { Avatar } from '../../components/Avatar';
import { PlayerFinale } from './PlayerFinale';
import { usePlayerGame } from './use-player-game';
import { PlayerQuestion } from './PlayerQuestion';
export function PlayerGame() {
  const game = usePlayerGame();
  const {
    code,
    playerId,
    nickname,
    avatar,
    validJoin,
    snapshot,
    connection,
    leaving,
    countdown,
    mediaReadiness,
    phase,
    question,
    ownScore,
    players,
    leaveLobby,
  } = game;
  if (!validJoin) {
    return (
      <div className="card mx-auto max-w-md p-10 text-center text-sm font-bold text-slate-500">
        بيانات الدخول غير مكتملة؛ سنعيدك إلى الصفحة الرئيسية.
      </div>
    );
  }
  if (!snapshot)
    return (
      <div className="card mx-auto max-w-md space-y-4 p-8 text-center">
        <Spinner />
        <p role="status">
          {connection === 'disconnected'
            ? 'انقطع الاتصال. نحاول إعادة الاتصال بالغرفة…'
            : 'جاري تحميل الغرفة…'}
        </p>
        <a href="/join-game/" className="secondary-btn inline-block">
          العودة لإدخال الرمز
        </a>
      </div>
    );
  return (
    <CompetitionIdentityProvider identity={snapshot?.identity ?? DEFAULT_COMPETITION_IDENTITY}>
      <div className="mx-auto max-w-4xl space-y-4 pb-4 sm:space-y-5">
        <CompetitionIdentityBadge />
        <header className="card flex items-center justify-between gap-3 p-3.5 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={avatar} label={nickname} className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="min-w-0">
              <h1 className="truncate font-black text-slate-900">{nickname}</h1>
              {phase === 'LOBBY' ? (
                <p className="text-xs font-bold text-brand-600">رمز اللعبة {code}</p>
              ) : (
                <p className="text-xs font-bold text-slate-400">أنت داخل المسابقة الآن</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span
              className={`hidden rounded-full px-2.5 py-1 text-[11px] font-black min-[390px]:inline ${
                connection === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {connection === 'connected' ? 'متصل' : 'نعيد الاتصال…'}
            </span>
            <div className="text-left">
              <span className="block text-[10px] font-bold text-slate-400">نقاطك</span>
              <b className="text-lg text-brand-700 sm:text-xl">{ownScore}</b>
            </div>
          </div>
        </header>

        {phase === 'LOBBY' && (
          <section className="card relative min-h-[calc(100svh-13rem)] overflow-hidden p-5 text-center sm:min-h-[520px] sm:p-6">
            <AmbientBackground />
            <div className="relative z-10 mx-auto max-w-xl pt-4">
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                ✓ تم انضمامك
              </span>
              <div className="mascot-hero mascot-hero--lobby mx-auto mt-5">
                <CompetitionMascot label="شخصية المسابقة تنتظر بداية اللعبة" className="w-full" />
              </div>
              <h2 className="mt-4 text-2xl font-black text-slate-900 sm:text-3xl">
                مكانك جاهز في غرفة الانتظار
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                ستبدأ اللعبة تلقائياً عندما يضغط المضيف زر البدء.
              </p>
              {mediaReadiness.total > 0 && (
                <p
                  role="status"
                  className={`mt-3 text-xs font-bold ${mediaReadiness.failed ? 'text-amber-700' : 'text-emerald-700'}`}
                >
                  {mediaReadiness.failed
                    ? 'تعذّر تجهيز بعض الصور. سنحاول مجدداً عند اقتراب السؤال.'
                    : mediaReadiness.ready === mediaReadiness.total
                      ? '✓ صور البداية جاهزة على جهازك'
                      : `نجهّز صور البداية على جهازك… ${mediaReadiness.ready} / ${mediaReadiness.total}`}
                </p>
              )}
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                {players.length} {players.length === 1 ? 'لاعب جاهز' : 'لاعبون جاهزون'}
              </div>
            </div>
            <div className="relative z-10 mx-auto mt-9 grid max-w-2xl grid-cols-3 gap-4 sm:grid-cols-5 sm:gap-5">
              {players.map((player: any, index: number) => (
                <div
                  key={player.id}
                  className="lobby-avatar flex min-w-0 flex-col items-center gap-2"
                  style={{ animationDelay: `${(index % 7) * -0.35}s` }}
                >
                  <div
                    className={`rounded-2xl border-2 bg-white p-2 shadow-md ${
                      player.id === playerId ? 'border-brand-500 shadow-brand-100' : 'border-brand-50'
                    }`}
                  >
                    <Avatar
                      src={player.avatarId}
                      playerIndex={index}
                      label={player.nickname}
                      className="h-14 w-14 rounded-xl sm:h-16 sm:w-16"
                    />
                  </div>
                  <span className="max-w-full truncate rounded-full bg-white px-2 py-1 text-[11px] font-black text-slate-700 shadow-sm">
                    {player.nickname}
                    {player.id === playerId ? ' · أنت' : ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="relative z-10 mt-9">
              <button
                onClick={leaveLobby}
                disabled={leaving}
                className="rounded-xl border border-rose-200 bg-white px-5 py-2.5 text-sm font-black text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
              >
                {leaving ? 'جاري مغادرة الغرفة…' : 'مغادرة غرفة الانتظار'}
              </button>
            </div>
          </section>
        )}

        {phase === 'COUNTDOWN' && (
          <section className="card grid min-h-[calc(100svh-13rem)] place-items-center p-5 text-center sm:min-h-[430px]">
            <div>
              <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border-4 border-brand-100 bg-brand-50 text-6xl font-black text-brand-700 shadow-xl shadow-brand-100">
                {countdown.seconds}
              </div>
              <h2 className="mt-7 text-3xl font-black">استعد… سنبدأ!</h2>
              <p className="mt-2 text-slate-500">ركّز، فكل ثانية تصنع فرقاً في نقاطك.</p>
            </div>
          </section>
        )}

        {phase === 'QUESTION' && question && <PlayerQuestion game={{ ...game, snapshot, question }} />}

        {(phase === 'STATS' || phase === 'LEADERBOARD') && (
          <section className="card relative p-6 text-center sm:p-8">
            <div className="text-5xl">{phase === 'STATS' ? '📊' : '🏅'}</div>
            <h2 className="mt-4 text-2xl font-black">
              {phase === 'STATS' ? 'اكتمل وقت الإجابة' : 'ترتيب الجولة حتى الآن'}
            </h2>
            <p className="mt-2 text-slate-500">
              رصيدك الحالي: <b className="text-brand-700">{ownScore.toLocaleString('ar')} نقطة</b>
            </p>
            {phase === 'LEADERBOARD' && (
              <div className="mx-auto mt-6 max-w-md space-y-2">
                {(snapshot?.topPlayers || []).map((player) => (
                  <div
                    key={`${player.rank}-${player.nickname}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm font-bold"
                  >
                    <Avatar src={player.avatarId} className="h-9 w-9 rounded-lg" />
                    <span className="flex-1 text-right">
                      #{player.rank} {player.nickname}
                    </span>
                    <span className="text-brand-700">{player.score.toLocaleString('ar')}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {phase === 'FINISHED' && <PlayerFinale rank={snapshot?.ownRank ?? null} score={ownScore} />}
      </div>
    </CompetitionIdentityProvider>
  );
}
