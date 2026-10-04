import { Avatar } from '../Avatar';
import { LobbyPlayer, playerCountLabel } from './lobby-model';

export function PlayerList({ players }: { players: LobbyPlayer[] }) {
  return <section aria-labelledby="players-title" className="lobby-player-panel card min-h-[390px] p-5 sm:p-7">
    <div data-bolt-flight-boundary className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
      <div>
        <p className="text-xs font-black text-brand-600">مباشر الآن</p>
        <h2 id="players-title" className="mt-1 text-xl font-black sm:text-2xl">اللاعبون في الغرفة</h2>
      </div>
      <span aria-live="polite" className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-black text-brand-700">{playerCountLabel(players.length)}</span>
    </div>

    {players.length === 0 ? <div className="grid min-h-[285px] place-items-center text-center">
      <div>
        <div aria-hidden="true" className="text-5xl">👋</div>
        <h3 className="mt-4 text-xl font-black">بانتظار أول لاعب</h3>
        <p className="mt-2 text-sm font-bold text-slate-500">شارك بطاقة الانضمام، وستظهر الأسماء هنا فوراً.</p>
      </div>
    </div> : <ul className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {players.map((player, index) => <li key={player.id} className="lobby-avatar min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center" style={{ animationDelay: `${(index % 8) * -.3}s` }}>
        <Avatar src={player.avatarId || ''} playerIndex={index} label={player.nickname} className="mx-auto h-14 w-14 rounded-2xl bg-white shadow-sm sm:h-16 sm:w-16" />
        <span className="mt-2 block truncate text-xs font-black text-slate-800">{player.nickname}</span>
      </li>)}
    </ul>}
  </section>;
}
