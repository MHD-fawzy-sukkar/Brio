export type LobbyPlayer = {
  id: string;
  nickname: string;
  avatarId?: string | null;
};

export function playerCountLabel(count: number): string {
  if (count === 0) return 'لا يوجد لاعبون بعد';
  if (count === 1) return 'لاعب واحد جاهز';
  if (count === 2) return 'لاعبان جاهزان';
  return `${count.toLocaleString('ar')} لاعبين جاهزين`;
}

export function canStartLobby(connected: boolean, players: LobbyPlayer[]): boolean {
  return connected && players.length > 0;
}
