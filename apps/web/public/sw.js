const CACHE_NAME = 'brio-static-v4';

const APP_SHELL_ASSETS = [
  '/bolt-original.png',
  '/avatars/avatar-1.svg',
  '/avatars/avatar-2.svg',
  '/avatars/avatar-3.svg',
  '/avatars/avatar-4.svg',
  '/avatars/avatar-5.svg',
  '/avatars/avatar-6.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
    return;
  }

  // Route HTML must always come from the same deployment as its JS chunks.
  // Serving an old cached document after a deploy causes React hydration error #418.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => new Response(
        '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Brio</title><body style="font-family:system-ui;text-align:center;padding:3rem"><h1>أنت غير متصل بالإنترنت</h1><p>تحقق من الاتصال ثم أعد تحميل الصفحة.</p></body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      ))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }))
  );
});
