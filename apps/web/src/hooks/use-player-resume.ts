'use client';

import { useEffect, useRef, useState } from 'react';
import { requestJson } from '../services/http-json';
import { enterPlayerGame, type JoinedPlayer } from '../services/player-session';
import { t } from '../i18n/locale';

export function usePlayerResume(roomId: string, code: string) {
  const [result, setResult] = useState<{ roomId: string; error?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const nextRetry = useRef(0);
  useEffect(() => {
    if (!roomId || !code) return;
    const controller = new AbortController();
    setResult(null);
    requestJson<{ player: JoinedPlayer | null }>(`/api/rooms/${encodeURIComponent(roomId)}/session`, {
      signal: controller.signal,
    })
      .then(({ player }) => {
        if (controller.signal.aborted) return;
        if (player) enterPlayerGame(roomId, code, player);
        else setResult({ roomId });
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setResult({
            roomId,
            error: cause instanceof Error ? cause.message : t('تعذر الانضمام إلى اللعبة.'),
          });
      });
    return () => controller.abort();
  }, [roomId, code, revision]);
  return {
    checked: result?.roomId === roomId,
    error: result?.roomId === roomId ? result.error : undefined,
    retry: () => {
      if (Date.now() < nextRetry.current) return;
      nextRetry.current = Date.now() + 1000;
      setResult(null);
      setRevision((value) => value + 1);
    },
  };
}
