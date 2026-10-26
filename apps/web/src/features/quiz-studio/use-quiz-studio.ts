'use client';
import { useStudioState } from './use-studio-state';
import { useStudioOrder } from './use-studio-order';
import { useStudioResource } from './use-studio-resource';
import { useStudioMedia } from './use-studio-media';
import { useStudioTitle } from './use-studio-title';
import { useStudioActions } from './use-studio-actions';
export function useQuizStudio() {
  const state = useStudioState();
  const order = useStudioOrder(state);
  const resource = useStudioResource(state);
  const media = useStudioMedia(state);
  const title = useStudioTitle({ ...state, ...media });
  const actions = useStudioActions({ ...state, ...resource, ...title });
  return { ...state, ...order, ...resource, ...media, ...title, ...actions };
}
export type StudioController = ReturnType<typeof useQuizStudio>;
