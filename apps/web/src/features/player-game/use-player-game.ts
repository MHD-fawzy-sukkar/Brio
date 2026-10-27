'use client';
import { t } from '../../i18n/locale';

import type { PlayerLiveSnapshot } from '../game-session/model';
import { createSubmissionId } from '../../services/submission-id';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrioRoomSocket } from '../../services/socket';
import { globalMediaPrefetchEngine } from '../../services/media-prefetch';
import { registerServiceWorker } from '../../services/sw-register';
import { useSynchronizedCountdown } from '../../hooks/use-synchronized-countdown';
import { useRoomMediaPrefetch } from '../../hooks/use-room-media-prefetch';
export type SubmissionState = 'idle' | 'submitting' | 'accepted' | 'rejected';
export function usePlayerGame() {
  const params = useSearchParams();

  const roomId = params.get('roomId') || '';

  const code = params.get('code') || '';

  const playerId = params.get('playerId') || '';

  const nickname = params.get('nickname') || '';

  const avatar = params.get('avatar') || '';

  const playerSessionKey = `brio_player_session:${roomId}:${playerId}`;

  const validJoin = Boolean(roomId && playerId && nickname && avatar && /^\d{6}$/.test(code));

  const [snapshot, setSnapshot] = useState<PlayerLiveSnapshot | null>(null);

  const [socket, setSocket] = useState<BrioRoomSocket | null>(null);

  const [connection, setConnection] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const [textAnswer, setTextAnswer] = useState('');

  const [submission, setSubmission] = useState<SubmissionState>('idle');

  const pendingSubmissionIdRef = useRef<string | null>(null);

  const [rejection, setRejection] = useState('');

  const [imageLoaded, setImageLoaded] = useState(false);

  const [imageError, setImageError] = useState(false);

  const [leaving, setLeaving] = useState(false);

  const lastImageUrlRef = useRef<string | null>(null);

  const countdown = useSynchronizedCountdown(snapshot?.phaseEndsAt, snapshot?.serverNow);

  const mediaReadiness = useRoomMediaPrefetch(roomId, snapshot?.questionIndex);

  useEffect(() => {
    if (!validJoin) {
      window.location.replace('/');
      return;
    }
    sessionStorage.setItem('brio_active_game', 'true');
    const roomSocket = new BrioRoomSocket(roomId, 'player', playerId);
    const offSnapshot = roomSocket.onSnapshot((data) => {
      setSnapshot(data);
      const imageUrl = data?.question?.essentialImage || null;
      if (imageUrl !== lastImageUrlRef.current) {
        lastImageUrlRef.current = imageUrl;
        setImageError(false);
        if (!imageUrl || globalMediaPrefetchEngine.isLoaded(imageUrl)) {
          setImageLoaded(true);
        } else {
          setImageLoaded(false);
          globalMediaPrefetchEngine.queueImages([
            { url: imageUrl, questionId: data?.question?.id || 'current', isEssential: true, priority: 1 },
          ]);
        }
      } else if (imageUrl && globalMediaPrefetchEngine.isLoaded(imageUrl)) {
        setImageLoaded(true);
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
      sessionStorage.removeItem('brio_active_game');
      setSnapshot(null);
      setSocket(null);
    };
  }, [validJoin, roomId, playerId]);

  useEffect(() => {
    pendingSubmissionIdRef.current = null;
    setSelectedOption(null);
    setTextAnswer('');
    setSubmission('idle');
    setRejection('');
  }, [snapshot?.roundId]);

  useEffect(() => {
    if (snapshot?.ownReceipt) {
      setSubmission('accepted');
      setSelectedOption(snapshot.ownReceipt.optionId || null);
      setTextAnswer(snapshot.ownReceipt.textAnswer || '');
    }
  }, [snapshot?.roundId, snapshot?.ownReceipt]);

  useEffect(
    () =>
      globalMediaPrefetchEngine.subscribe((states) => {
        const url = snapshot?.question?.essentialImage;
        if (!url) return;
        const state = states.get(url);
        if (state?.status === 'loaded' || globalMediaPrefetchEngine.isLoaded(url)) {
          setImageLoaded(true);
          setImageError(false);
        }
        if (state?.status === 'error') setImageError(true);
      }),
    [snapshot?.question?.essentialImage],
  );

  const phase = snapshot?.phase || 'LOBBY';

  const question = snapshot?.question;

  const roundId = snapshot?.roundId || '';

  const ownScore = snapshot?.ownScore ?? 0;

  const players = snapshot?.lobbyPlayers || [{ id: playerId, nickname, avatarId: avatar }];

  const imageBlocking = Boolean(question?.essentialImage && !imageLoaded);

  const resolvedQuestionImage = question?.essentialImage
    ? globalMediaPrefetchEngine.resolveUrl(question.essentialImage)
    : '';

  const submit = async (optionId?: string) => {
    if (!socket || !roundId || imageBlocking || submission === 'submitting' || submission === 'accepted')
      return;
    if (optionId) setSelectedOption(optionId);
    setSubmission('submitting');
    setRejection('');
    try {
      pendingSubmissionIdRef.current ||= createSubmissionId();
      await socket.submitAnswer(roundId, pendingSubmissionIdRef.current, {
        optionId,
        textAnswer: question?.type === 'ShortAnswer' ? textAnswer : undefined,
      });
      setSubmission('accepted');
    } catch (cause) {
      setSubmission('rejected');
      setRejection(
        cause instanceof Error ? cause.message : t('لم نتمكن من إرسال الإجابة. تحقق من اتصالك وحاول مجدداً.'),
      );
    }
  };

  const leaveLobby = () => {
    if (leaving) return;
    setLeaving(true);
    socket?.close();
    sessionStorage.removeItem('brio_active_game');
    const sessionToken = sessionStorage.getItem(playerSessionKey) || '';
    sessionStorage.removeItem(playerSessionKey);
    const request = sessionToken
      ? fetch(`/api/rooms/${encodeURIComponent(roomId)}/leave`, {
          method: 'POST',
          keepalive: true,
          signal: AbortSignal.timeout(5000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, sessionToken }),
        })
      : Promise.resolve();
    void request.catch(() => {});
    window.location.replace('/');
  };
  return {
    params,
    roomId,
    code,
    playerId,
    nickname,
    avatar,
    playerSessionKey,
    validJoin,
    snapshot,
    setSnapshot,
    socket,
    setSocket,
    connection,
    setConnection,
    selectedOption,
    setSelectedOption,
    textAnswer,
    setTextAnswer,
    submission,
    setSubmission,
    pendingSubmissionIdRef,
    rejection,
    setRejection,
    imageLoaded,
    setImageLoaded,
    imageError,
    setImageError,
    leaving,
    setLeaving,
    lastImageUrlRef,
    countdown,
    mediaReadiness,
    phase,
    question,
    roundId,
    ownScore,
    players,
    imageBlocking,
    resolvedQuestionImage,
    submit,
    leaveLobby,
  };
}
export type PlayerGameController = ReturnType<typeof usePlayerGame>;
