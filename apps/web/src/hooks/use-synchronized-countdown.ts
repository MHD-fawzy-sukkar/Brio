'use client';

import { useEffect, useMemo, useState } from 'react';

export function useSynchronizedCountdown(endsAt?: number, serverNow?: number) {
  const offset = useMemo(() => serverNow ? serverNow - Date.now() : 0, [serverNow]);
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, (endsAt || 0) - (Date.now() + offset)));

  useEffect(() => {
    const update = () => setRemainingMs(Math.max(0, (endsAt || 0) - (Date.now() + offset)));
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [endsAt, offset]);

  return { remainingMs, seconds: Math.ceil(remainingMs / 1000) };
}
