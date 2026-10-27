import { t, numberLocale } from '../../i18n/locale';
export type LobbyPlayer = {
  id: string;
  nickname: string;
  avatarId?: string | null;
};

export function playerCountLabel(count: number): string {
  if (count === 0) return t('لا يوجد لاعبون بعد');
  if (count === 1) return t('لاعب واحد جاهز');
  if (count === 2) return t('لاعبان جاهزان');
  return t('{0} لاعبين جاهزين', { 0: count.toLocaleString(numberLocale()) });
}

export function canStartLobby(connected: boolean, players: LobbyPlayer[]): boolean {
  return connected && players.length > 0;
}
