import { ButtonContent } from '../Loading';
import { canStartLobby, playerCountLabel, type LobbyPlayer } from './lobby-model';

type GameControlsProps = {
  connected: boolean;
  players: LobbyPlayer[];
  onStart?: () => void;
  onEnd: () => void;
  ending: boolean;
  finished?: boolean;
};

export function GameControls({ connected, players, onStart, onEnd, ending, finished = false }: GameControlsProps) {
  return <section aria-label="التحكم باللعبة" className="game-controls">
    <div className="flex items-center gap-3">
      <span className={`h-3 w-3 shrink-0 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,.12)]' : 'bg-amber-400'}`} />
      <div>
        <h2 className="font-black text-slate-900">التحكم باللعبة</h2>
        <p className="mt-1 text-xs font-bold text-slate-500">{finished ? 'اكتملت المسابقة' : connected ? playerCountLabel(players.length) : 'نعيد الاتصال بالغرفة…'}</p>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      {onStart && <button type="button" onClick={onStart} disabled={ending || !canStartLobby(connected, players)} className="primary-btn flex-1 px-7 py-3.5 sm:flex-none">بدء المسابقة الآن</button>}
      <button type="button" onClick={onEnd} disabled={ending || finished} className="secondary-btn flex-1 border-rose-200 text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">
        <ButtonContent busy={ending} busyText="جاري الإنهاء…">إنهاء اللعبة</ButtonContent>
      </button>
    </div>
  </section>;
}
