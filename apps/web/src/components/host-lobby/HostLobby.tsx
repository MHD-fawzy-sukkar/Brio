import { JoinInfoCard } from './JoinInfoCard';
import { PlayerList } from './PlayerList';
import { type LobbyPlayer } from './lobby-model';
import { GameControls } from './GameControls';

type HostLobbyProps = {
  quizTitle?: string;
  code: string;
  connected: boolean;
  players: LobbyPlayer[];
  onStart: () => void;
  onEnd: () => void;
  ending: boolean;
};

export function HostLobby({ quizTitle, code, connected, players, onStart, onEnd, ending }: HostLobbyProps) {
  return <div className="host-lobby">
    <GameControls quizTitle={quizTitle} connected={connected} players={players} onStart={onStart} onEnd={onEnd} ending={ending} />
    <div className="mt-5 grid gap-5 xl:grid-cols-[350px_minmax(0,1fr)]">
      <JoinInfoCard code={code} />
      <PlayerList players={players} />
    </div>
  </div>;
}
