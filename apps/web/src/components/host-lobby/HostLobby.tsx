import { JoinInfoCard } from './JoinInfoCard';
import { PlayerList } from './PlayerList';
import { LobbyPlayer, canStartLobby, playerCountLabel } from './lobby-model';

type HostLobbyProps = {
  code: string;
  connected: boolean;
  players: LobbyPlayer[];
  onStart: () => void;
};

function LobbyActionBar({ connected, players, onStart }: Pick<HostLobbyProps, 'connected' | 'players' | 'onStart'>) {
  const enabled = canStartLobby(connected, players);
  return <div className="card flex flex-col gap-4 border-brand-100 bg-gradient-to-l from-white to-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
    <div className="flex items-center gap-3">
      <span className={`h-3 w-3 shrink-0 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,.12)]' : 'bg-amber-400'}`} />
      <div>
        <h3 className="font-black text-slate-900">{players.length ? 'الجميع جاهز؟' : 'شارك رمز اللعبة أولاً'}</h3>
        <p className="mt-0.5 text-xs font-bold text-slate-500">{connected ? playerCountLabel(players.length) : 'نعيد الاتصال بالغرفة…'}</p>
      </div>
    </div>
    <button type="button" onClick={onStart} disabled={!enabled} className="primary-btn w-full px-7 py-3.5 text-base sm:w-auto">بدء المسابقة الآن</button>
  </div>;
}

export function HostLobby({ code, connected, players, onStart }: HostLobbyProps) {
  return <div className="space-y-5">
    <LobbyActionBar connected={connected} players={players} onStart={onStart} />
    <div className="grid gap-5 xl:grid-cols-[350px_minmax(0,1fr)]">
      <JoinInfoCard code={code} />
      <PlayerList players={players} />
    </div>
  </div>;
}
