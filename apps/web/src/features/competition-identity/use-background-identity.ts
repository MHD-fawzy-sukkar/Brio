'use client';
import { useEffect, useReducer } from 'react';
import { backgroundIdentitySaves } from './background-identity-saves';
export function useBackgroundIdentity(quizId: string | null) {
  const [, update] = useReducer((value) => value + 1, 0);
  useEffect(() => {
    const stop = backgroundIdentitySaves.subscribe(update);
    update();
    return stop;
  }, []);
  return quizId ? backgroundIdentitySaves.get(quizId) : undefined;
}
