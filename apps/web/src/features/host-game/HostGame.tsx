'use client';

import { useTranslations } from '../../i18n/use-locale';

import { globalMediaPrefetchEngine } from '../../services/media-prefetch';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { HostLobbySkeleton } from '../../components/host-lobby/HostLobbySkeleton';
import { Podium } from '../../components/Podium';
import { Avatar } from '../../components/Avatar';
import { GameControls } from '../../components/host-lobby/GameControls';
import { HostLobby } from '../../components/host-lobby/HostLobby';
import { CompetitionIdentityProvider } from '../competition-identity/CompetitionIdentityProvider';
import { DEFAULT_COMPETITION_IDENTITY } from '../competition-identity/model';
import { CompetitionIdentityBadge } from '../competition-identity/CompetitionIdentityBadge';
import { CompetitionMascot } from '../competition-identity/CompetitionMascot';
import { isLanMode } from '../../services/runtime-mode';
import { useHostGame } from './use-host-game';

const optionColors = [
  'bg-brand-500',
  'bg-cyan-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-blue-500',
  'bg-orange-500',
];
export function HostGame() {
  const { t, translateMessage, numberLocale } = useTranslations();
  const game = useHostGame();
  const {
    quizId,
    snapshot,
    socket,
    connection,
    error,
    ending,
    confirmEndOpen,
    setConfirmEndOpen,
    phase,
    players,
    question,
    countdown,
    start,
    requestEndRoom,
    confirmEndRoom,
    code,
    finalLeaderboard,
  } = game;
  if (!snapshot) return <HostLobbySkeleton />;
  return (
    <CompetitionIdentityProvider identity={snapshot?.identity ?? DEFAULT_COMPETITION_IDENTITY}>
      <div data-mascot-flight-root className="relative mx-auto max-w-6xl space-y-5">
        <CompetitionIdentityBadge />
        {phase === 'LOBBY' && <CompetitionMascot presentation="roaming" />}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700"
          >
            {translateMessage(error ?? '')}
          </div>
        )}

        {phase !== 'LOBBY' && (
          <GameControls
            quizTitle={snapshot.quizTitle}
            quizId={quizId}
            connected={connection === 'connected'}
            players={players}
            onEnd={requestEndRoom}
            ending={ending}
            finished={phase === 'FINISHED'}
          />
        )}
        {phase === 'LOBBY' && (
          <HostLobby
            quizTitle={snapshot.quizTitle}
            quizId={quizId}
            code={code}
            connected={connection === 'connected'}
            players={players}
            onStart={start}
            onEnd={requestEndRoom}
            ending={ending}
          />
        )}

        {phase === 'COUNTDOWN' && (
          <section className="card grid min-h-[480px] place-items-center text-center">
            <div>
              <div className="mx-auto grid h-36 w-36 place-items-center rounded-full border-4 border-brand-100 bg-brand-50 text-7xl font-black text-brand-700 shadow-xl shadow-brand-100">
                {countdown.seconds}
              </div>
              <h2 className="mt-7 text-4xl font-black">{t('استعدوا للانطلاق!')}</h2>
            </div>
          </section>
        )}

        {isLanMode && phase === 'RECOVERY_PAUSED' && (
          <section className="card space-y-4 p-6 text-center">
            <h2 className="text-2xl font-black">{t('توقفت الجولة بعد انقطاع تشغيل المقدّم')}</h2>
            <p className="text-slate-600">
              {t('اختر إعادة السؤال المتأثر أو تجاوزه. نقاطه السابقة تُلغى وفق قواعد الاستعادة.')}
            </p>
            <div className="flex justify-center gap-3">
              <button className="primary-btn" onClick={() => socket?.recoverQuiz('void_and_replay')}>
                {t('إعادة السؤال')}
              </button>
              <button className="secondary-btn" onClick={() => socket?.recoverQuiz('void_and_skip')}>
                {t('تجاوز السؤال')}
              </button>
            </div>
          </section>
        )}

        {phase === 'QUESTION' && question && (
          <section className="card overflow-hidden">
            <div className="h-2 bg-slate-100">
              <div
                className="h-full bg-gradient-to-l from-brand-500 to-cyan-400 transition-all"
                style={{ width: `${Math.min(100, (countdown.remainingMs / question.durationMs) * 100)}%` }}
              />
            </div>
            <div className="p-4 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700">
                  {t('السؤال')} {(snapshot.questionIndex ?? 0) + 1}
                </span>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-2 text-2xl font-black text-amber-700">
                  {countdown.seconds}
                </div>
              </div>
              {question.essentialImage && (
                <div className="mx-auto mt-6 grid max-h-72 min-h-40 place-items-center rounded-2xl bg-slate-50">
                  <img
                    src={globalMediaPrefetchEngine.resolveUrl(question.essentialImage)}
                    alt={t('صورة السؤال')}
                    fetchPriority="high"
                    decoding="sync"
                    className="max-h-72 w-full object-contain p-3"
                  />
                </div>
              )}
              <h2 className="mx-auto mt-7 max-w-4xl text-center text-2xl font-black leading-relaxed sm:text-4xl">
                {question.text}
              </h2>
              {(question.options?.length ?? 0) > 0 && (
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {(question.options ?? []).map((option, index: number) => (
                    <div
                      key={option.id}
                      className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 font-black"
                    >
                      <span
                        className={`grid h-10 w-10 place-items-center rounded-xl text-white ${optionColors[index % optionColors.length]}`}
                      >
                        {index + 1}
                      </span>
                      {option.text}
                    </div>
                  ))}
                </div>
              )}
              <div
                aria-live="polite"
                className="mx-auto mt-7 max-w-sm rounded-2xl border border-brand-100 bg-brand-50 p-4 text-center"
              >
                <b className="text-2xl text-brand-800">{snapshot.acceptedAnswersCount ?? 0}</b>
                <span className="mx-2 text-sm font-bold text-brand-500">{t('من')}</span>
                <b className="text-2xl text-brand-800">{snapshot.playerCount ?? players.length}</b>
                <span className="mt-1 block text-xs font-bold text-slate-500">
                  {t('إجابة وصلت حتى الآن')}
                </span>
              </div>
            </div>
          </section>
        )}

        {phase === 'STATS' && (
          <section className="card p-6 sm:p-9">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-brand-600">{t('انتهى الوقت')}</p>
                <h2 className="mt-1 text-3xl font-black">{t('توزيع الإجابات')}</h2>
              </div>
              <div className="rounded-2xl bg-brand-50 px-5 py-3 text-center">
                <b className="text-2xl text-brand-700">{countdown.seconds}</b>
                <span className="block text-[10px] font-bold text-slate-400">{t('للترتيب')}</span>
              </div>
            </div>
            <div className="mt-8 space-y-4">
              {(snapshot.answerStats || []).map((stat: any, index: number) => (
                <div key={`${stat.optionId}-${index}`}>
                  <div className="mb-2 flex justify-between text-sm font-bold">
                    <span>
                      {question?.type === 'ShortAnswer' && stat.optionId === null
                        ? t(stat.label)
                        : stat.label}
                      {stat.isCorrect === true ? ' ✓' : ''}
                    </span>
                    <span>
                      {stat.count} · {stat.percentage}%
                    </span>
                  </div>
                  <div className="h-10 overflow-hidden rounded-xl bg-slate-100">
                    <div
                      className={`flex h-full items-center px-3 text-xs font-black text-white transition-all ${
                        stat.isCorrect === true ? 'bg-emerald-500' : optionColors[index % optionColors.length]
                      }`}
                      style={{ width: `${Math.max(stat.percentage, stat.count ? 8 : 0)}%` }}
                    >
                      {stat.percentage > 12 ? `${stat.percentage}%` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {phase === 'LEADERBOARD' && (
          <section data-mascot-flight-root className="card relative p-6 sm:p-9">
            <CompetitionMascot presentation="roaming" scope="page" celebration />
            <div className="text-center">
              <div className="text-5xl">🏅</div>
              <h2 className="mt-3 text-3xl font-black">{t('الترتيب الحالي')}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {t('هذه النقاط تراكمية، وكل سؤال جديد قد يغيّر الترتيب.')}
              </p>
            </div>
            <div data-mascot-flight-boundary className="mx-auto mt-8 max-w-2xl space-y-3">
              {(snapshot.leaderboard || []).map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-3"
                >
                  <b className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-700 shadow-sm">
                    #{player.rank}
                  </b>
                  <Avatar src={player.avatarId} label={player.nickname} className="h-11 w-11 rounded-xl" />
                  <span className="flex-1 font-black">{player.nickname}</span>
                  <strong className="text-brand-700">{player.score.toLocaleString(numberLocale())}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        {phase === 'FINISHED' && (
          <div className="space-y-6">
            <Podium players={finalLeaderboard} />
            {finalLeaderboard.length > 0 && (
              <section className="card mx-auto max-w-3xl p-6 sm:p-8">
                <h3 className="text-center text-xl font-black text-slate-900">{t('جدول الترتيب النهائي')}</h3>
                <div className="mt-5 space-y-3">
                  {finalLeaderboard.map((player) => (
                    <div
                      key={player.id || player.nickname}
                      className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-3.5"
                    >
                      <b className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-700 shadow-sm">
                        #{player.rank}
                      </b>
                      <Avatar
                        src={player.avatarId}
                        label={player.nickname}
                        className="h-11 w-11 rounded-xl"
                      />
                      <span className="flex-1 font-black text-slate-900">{player.nickname}</span>
                      <strong className="text-brand-700">
                        {(player.score ?? 0).toLocaleString(numberLocale())} {t('نقطة')}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <ConfirmDialog
          open={confirmEndOpen}
          icon="🏁"
          title={t('هل أنت متأكد من إنهاء اللعبة؟')}
          description={t('سيتم إيقاف المسابقة الحالية وإظهار منصة الأبطال والنتائج النهائية مباشرةً.')}
          confirmLabel={t('نعم، إنهاء وعرض الأبطال')}
          busyLabel={t('جاري إنهاء اللعبة…')}
          cancelLabel={t('مواصلة المسابقة')}
          busy={ending}
          onCancel={() => setConfirmEndOpen(false)}
          onConfirm={confirmEndRoom}
        />
      </div>
    </CompetitionIdentityProvider>
  );
}
