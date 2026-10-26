const CACHE_NAME = 'brio-static-v6';
const MEDIA_CACHE_NAME = 'brio-media-v1';

const APP_SHELL_ASSETS = [
  '/bolt-original.png',
  '/avatars/bolt-base-v2.png'
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
          if (name !== CACHE_NAME && name !== MEDIA_CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
    return;
  }

  // Intercept Cloudinary and media requests with Cache-First from MEDIA_CACHE_NAME
  if (url.hostname.endsWith('cloudinary.com') || url.pathname.startsWith('/fixtures/images/')) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response && response.ok) {
              cache.put(event.request, response.clone()).catch(() => {});
            }
            return response;
          });
        })
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) {
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

  // Next client navigation/prefetch requests also contain route HTML or RSC.
  // Cache-first here can revive an old builder with no drag handles after deploy.
  const isRoute = event.request.headers.get('RSC') === '1' || url.searchParams.has('_rsc') ||
    !/\.[a-z0-9]+$/i.test(url.pathname) || /\.(html|txt)$/i.test(url.pathname);
  if (isRoute) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }))
  );
});
