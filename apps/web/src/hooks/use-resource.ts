'use client';
import { useCallback, useEffect, useState } from 'react';
import { invalidateResources, loadResource, peekResource, resourceIsFresh, subscribeResources } from '../services/resource-cache';
import { requestJson } from '../services/http-json';

export function useResource<T>(key: string) {
  const [state, setState] = useState(() => {
    const data = peekResource<T>(key);
    return { data, error: '', loading: data === undefined, refreshing: data !== undefined && !resourceIsFresh(key) };
  });
  useEffect(() => {
    let active = true;
    const update = () => {
      const data = peekResource<T>(key);
      if (!active) return;
      setState(current => ({ ...current, data, loading: data === undefined, refreshing: !resourceIsFresh(key), error: resourceIsFresh(key) ? '' : current.error }));
      if (resourceIsFresh(key)) return;
      void loadResource(key, () => requestJson<T>(key)).then(() => {
        if (active) setState(current => ({ ...current, loading: false, refreshing: false }));
      }).catch(cause => { if (active) setState(current => ({ ...current, loading: false, refreshing: false, error: cause instanceof Error ? cause.message : 'تعذّر التحميل. حاول مجدداً.' })); });
    };
    const unsubscribe = subscribeResources(update, key);
    update();
    const foreground = () => { if (document.visibilityState === 'visible') update(); };
    window.addEventListener('focus', foreground);
    document.addEventListener('visibilitychange', foreground);
    return () => { active = false; unsubscribe(); window.removeEventListener('focus', foreground); document.removeEventListener('visibilitychange', foreground); };
  }, [key]);
  const reload = useCallback(() => { setState(current => ({ ...current, error: '' })); invalidateResources([key]); }, [key]);
  return { ...state, reload };
}
