import Link from 'next/link';
import { ButtonContent } from '../Loading';
import { canStartLobby, playerCountLabel, type LobbyPlayer } from './lobby-model';

type GameControlsProps = {
  quizTitle?: string;
  quizId?: string;
  connected: boolean;
  players: LobbyPlayer[];
  onStart?: () => void;
  onEnd: () => void;
  ending: boolean;
  finished?: boolean;
};

export function GameControls({ quizTitle, quizId, connected, players, onStart, onEnd, ending, finished = false }: GameControlsProps) {
  const backHref = quizId ? `/builder/?quizId=${encodeURIComponent(quizId)}` : '/dashboard/';

  return (
    <section aria-label="التحكم باللعبة" className="game-controls">
      <div className="flex items-center gap-3.5">
        <Link
          href={backHref}
          aria-label="العودة"
          title="العودة"
          className="group relative grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-2xl border border-brand-200/80 bg-white/95 text-brand-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-600 hover:bg-brand-600 hover:text-white hover:shadow-lg hover:shadow-brand-600/20"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="back-arrow-glide h-5 w-5"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>

        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 shrink-0 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,.12)]' : 'bg-amber-400'}`} />
          <div>
            <p className="text-xs font-black text-brand-600">ساحة المسابقة · لوحة المضيف</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">{quizTitle || 'ساحة المسابقة'}</h1>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {finished ? 'اكتملت المسابقة وإعلان النتائج النهائية' : connected ? playerCountLabel(players.length) : 'نعيد الاتصال بالغرفة…'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!finished ? (
          <>
            {onStart && (
              <button
                type="button"
                onClick={onStart}
                disabled={ending || !canStartLobby(connected, players)}
                className="primary-btn flex-1 px-7 py-3.5 sm:flex-none"
              >
                بدء المسابقة الآن
              </button>
            )}
            <button
              type="button"
              onClick={onEnd}
              disabled={ending}
              className="secondary-btn flex-1 border-rose-200 py-3.5 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              <ButtonContent busy={ending} busyText="جاري الإنهاء…">
                إنهاء اللعبة
              </ButtonContent>
            </button>
          </>
        ) : (
          <Link
            href="/dashboard/"
            className="primary-btn inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-black"
          >
            <span>مسابقاتي</span>
          </Link>
        )}
      </div>
    </section>
  );
}
