'use client';

import { useEffect, useState } from 'react';
import { CompetitionIdentitySchema } from '@brio/contracts';
import { requestJson } from '../../services/http-json';
import { DEFAULT_COMPETITION_IDENTITY, type CompetitionIdentity } from './model';

export function useRoomIdentity(roomId: string) {
  const [state, setState] = useState<{ roomId: string; identity: CompetitionIdentity; error?: string }>();
  useEffect(() => {
    if (!roomId) return;
    const controller = new AbortController();
    requestJson<{ identity: unknown }>(`/api/rooms/${encodeURIComponent(roomId)}/identity`, {
      signal: controller.signal,
    })
      .then((body) => {
        const identity =
          body.identity == null
            ? DEFAULT_COMPETITION_IDENTITY
            : CompetitionIdentitySchema.parse(body.identity);
        if (!controller.signal.aborted) setState({ roomId, identity });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ roomId, identity: DEFAULT_COMPETITION_IDENTITY, error: error.message });
      });
    return () => controller.abort();
  }, [roomId]);
  return {
    identity: state?.roomId === roomId ? state.identity : DEFAULT_COMPETITION_IDENTITY,
    loading: Boolean(roomId && state?.roomId !== roomId),
    error: state?.roomId === roomId ? state.error : undefined,
  };
}
