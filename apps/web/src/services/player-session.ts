export interface JoinedPlayer {
  playerId: string;
  nickname: string;
  avatarId: string;
  sessionToken: string;
}

export function enterPlayerGame(roomId: string, code: string, player: JoinedPlayer) {
  sessionStorage.setItem(`brio_player_session:${roomId}:${player.playerId}`, player.sessionToken);
  const query = new URLSearchParams({
    roomId,
    code,
    playerId: player.playerId,
    nickname: player.nickname,
    avatar: player.avatarId,
  });
  window.location.replace(`/play/?${query}`);
}
