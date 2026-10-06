import { RoamingBolt } from './host-lobby/RoamingBolt';
import { Avatar } from './Avatar';

interface PodiumPlayer { id?:string;nickname:string;avatarId:string;score:number;rank:number }

const medals:Record<number,string>={1:'👑',2:'🥈',3:'🥉'};
const stepStyle:Record<number,string>={
  1:'podium-step-1 h-52 border-amber-300 bg-gradient-to-b from-amber-200 to-amber-400 text-amber-950',
  2:'podium-step-2 h-40 border-slate-200 bg-gradient-to-b from-slate-100 to-slate-300 text-slate-800',
  3:'podium-step-3 h-32 border-orange-200 bg-gradient-to-b from-orange-100 to-orange-300 text-orange-950'
};

function Contestant({player}:{player:PodiumPlayer}){
  return <article className="podium-rise flex min-w-0 flex-col items-center text-center"><div className="podium-winner relative z-10 flex min-h-44 w-full flex-col items-center justify-end px-1"><span className="text-3xl" aria-hidden="true">{medals[player.rank]}</span><Avatar src={player.avatarId} label={player.nickname} className="mt-2 h-16 w-16 rounded-2xl border-4 border-white bg-white shadow-xl sm:h-20 sm:w-20"/><b className="mt-2 w-full truncate text-sm text-slate-900 sm:text-base">{player.nickname}</b><strong className="text-xs text-brand-700 sm:text-sm">{player.score.toLocaleString('ar')} نقطة</strong></div><div className={`relative mt-3 flex w-full flex-col items-center justify-start rounded-t-[1.5rem] border-x border-t pt-4 shadow-xl ${stepStyle[player.rank]}`}><span className="text-4xl font-black sm:text-5xl">{player.rank}</span><span className="mt-1 text-[10px] font-black sm:text-xs">المركز</span><div className="absolute inset-x-3 top-2 h-1 rounded-full bg-white/50"/></div></article>;
}

export function Podium({players}:{players:PodiumPlayer[]}){
  const ranked=[1,2,3].map((rank)=>players.find((player)=>player.rank===rank)).filter(Boolean) as PodiumPlayer[];
  const ordered=[ranked.find((p)=>p.rank===2),ranked.find((p)=>p.rank===1),ranked.find((p)=>p.rank===3)].filter(Boolean) as PodiumPlayer[];
  return <section data-bolt-flight-root className="relative overflow-hidden rounded-[2.25rem] border border-brand-100 bg-gradient-to-br from-white via-brand-50 to-amber-50 px-3 pb-0 pt-8 text-slate-900 shadow-2xl shadow-brand-100/70 sm:px-8 sm:pt-10"><RoamingBolt scope="page" celebration/><div className="pointer-events-none absolute inset-0 opacity-75">{Array.from({length:28},(_,i)=><i key={i} className="confetti-piece" style={{left:`${(i*37)%100}%`,animationDelay:`-${(i%9)*.31}s`,background:['#fbbf24','#d97886','#34d399','#fb7185','#22d3ee'][i%5]}}/>)}</div><div className="relative z-10 text-center"><span className="text-6xl" aria-hidden="true">🏆</span><span className="mx-auto mt-4 block w-fit rounded-full border border-amber-200 bg-white px-4 py-2 text-xs font-black text-amber-700 shadow-sm">النتائج النهائية 🎉</span><h2 className="mt-5 text-3xl font-black text-brand-950 sm:text-5xl">منصة الأبطال</h2><p className="mt-2 text-sm font-bold text-slate-500">لحظة التتويج التي تستحق التصفيق!</p></div>{ordered.length?<div data-bolt-flight-boundary className="relative z-10 mx-auto mt-5 grid w-full max-w-3xl grid-cols-3 items-end gap-2 sm:mt-8 sm:gap-4">{ordered.map((player)=><Contestant key={`${player.rank}-${player.id||player.nickname}`} player={player}/>)}</div>:<div className="relative z-10 grid min-h-72 place-items-center text-center"><p className="font-black text-slate-500">لا توجد نتائج لعرضها بعد.</p></div>}</section>;
}
