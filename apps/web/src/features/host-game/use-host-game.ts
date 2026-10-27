'use client';
import { t } from '../../i18n/locale';

import { requestJson } from '../../services/http-json';

import type { HostLiveSnapshot } from '../game-session/model';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrioRoomSocket } from '../../services/socket';
import { globalMediaPrefetchEngine } from '../../services/media-prefetch';
import { registerServiceWorker } from '../../services/sw-register';
import { useSynchronizedCountdown } from '../../hooks/use-synchronized-countdown';
import { useRoomMediaPrefetch } from '../../hooks/use-room-media-prefetch';
import { isLanMode } from '../../services/runtime-mode';

export function useHostGame() {
  const params = useSearchParams();

  const roomId = params.get('roomId') || '';

  const requestedCode = params.get('code') || '';

  const quizId = params.get('quizId') || '';

  const [snapshot, setSnapshot] = useState<HostLiveSnapshot | null>(null);

  const [socket, setSocket] = useState<BrioRoomSocket | null>(null);

  const [connection, setConnection] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const [error, setError] = useState<string | null>(null);

  const [ending, setEnding] = useState(false);

  const [confirmEndOpen, setConfirmEndOpen] = useState(false);

  const [, setMediaTick] = useState(0);

  const phase = snapshot?.phase || 'LOBBY';

  const players = snapshot?.lobbyPlayers || [];

  const question = snapshot?.question;

  const countdown = useSynchronizedCountdown(snapshot?.phaseEndsAt, snapshot?.serverNow);

  useRoomMediaPrefetch(roomId, snapshot?.questionIndex);

  useEffect(() => {
    return globalMediaPrefetchEngine.subscribe(() => {
      setMediaTick((tick) => tick + 1);
    });
  }, []);

  useEffect(() => {
    if (!roomId) {
      window.location.replace(isLanMode ? '/local/' : '/dashboard/');
      return;
    }
    const roomSocket = new BrioRoomSocket(roomId, 'host');
    const offSnapshot = roomSocket.onSnapshot((data) => {
      setSnapshot(data);
      const imageUrl = data?.question?.essentialImage;
      if (imageUrl && !globalMediaPrefetchEngine.isLoaded(imageUrl)) {
        globalMediaPrefetchEngine.queueImages([
          { url: imageUrl, questionId: data.question.id, isEssential: true, priority: 1 },
        ]);
      }
    });
    const offConnection = roomSocket.onConnectionState(setConnection);
    const unregister = registerServiceWorker(() => roomSocket.connect());
    roomSocket.connect();
    setSocket(roomSocket);
    return () => {
      offSnapshot();
      offConnection();
      unregister();
      roomSocket.close();
      setSocket(null);
      setSnapshot(null);
    };
  }, [roomId]);

  const start = () => {
    if (!socket || connection !== 'connected') return setError(t('الاتصال بالغرفة غير جاهز بعد.'));
    if (players.length === 0) return setError(t('انتظر انضمام لاعب واحد على الأقل.'));
    setError(null);
    socket.startQuiz();
  };

  const requestEndRoom = () => {
    if (!roomId || ending) return;
    setConfirmEndOpen(true);
  };

  const confirmEndRoom = async () => {
    if (!roomId) return;
    setEnding(true);
    setError(null);
    try {
      await requestJson(`/api/rooms/${encodeURIComponent(roomId)}`, { method: 'DELETE' });
      setSnapshot((current) => {
        if (!current) return current;
        const fallbackLeaderboard =
          current.leaderboard?.length > 0
            ? current.leaderboard
            : (current.lobbyPlayers || []).map((player, index: number) => ({
                id: player.id,
                nickname: player.nickname,
                avatarId: player.avatarId,
                score: 'score' in player ? Number(player.score) : 0,
                rank: index + 1,
              }));
        return {
          ...current,
          phase: 'FINISHED',
          leaderboard: fallbackLeaderboard,
        };
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('تعذر إنهاء اللعبة.'));
    } finally {
      setEnding(false);
      setConfirmEndOpen(false);
    }
  };

  const code = /^\d{6}$/.test(snapshot?.code || '') ? snapshot?.code || requestedCode : requestedCode;

  const finalLeaderboard =
    (snapshot?.leaderboard?.length ?? 0) > 0
      ? (snapshot?.leaderboard ?? [])
      : players.map((player, index: number) => ({
          id: player.id,
          nickname: player.nickname,
          avatarId: player.avatarId,
          score: 'score' in player ? Number(player.score) : 0,
          rank: index + 1,
        }));
  return {
    params,
    roomId,
    requestedCode,
    quizId,
    snapshot,
    setSnapshot,
    socket,
    setSocket,
    connection,
    setConnection,
    error,
    setError,
    ending,
    setEnding,
    confirmEndOpen,
    setConfirmEndOpen,
    setMediaTick,
    phase,
    players,
    question,
    countdown,
    start,
    requestEndRoom,
    confirmEndRoom,
    code,
    finalLeaderboard,
  };
}
export type HostGameController = ReturnType<typeof useHostGame>;
