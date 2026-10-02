export function registerServiceWorker(onForegroundResync?: () => void): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  const register = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Defer SW update reloads if an active game session is running
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // Check if user is in an active session
                const inActiveSession = sessionStorage.getItem('brio_active_game') === 'true';
                if (!inActiveSession) {
                  // Safe to apply update when not in an active game session
                  installingWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              }
            }
          };
        };
      })
      .catch((err) => {
        console.warn('Service Worker registration failed:', err);
      });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });

  // Handle tab foreground resync
  const onVisibility = () => {
    if (document.visibilityState === 'visible' && onForegroundResync) {
      onForegroundResync();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('load', register);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
