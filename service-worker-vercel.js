/* Vercel root PWA shell. Personal accounts, API and posts must never be cached. */
const CACHE = 'tuongai-vercel-assets-v1';
const ASSETS = [
  '/offline.html', '/app-icon.svg', '/icon-180.png', '/icon-192.png',
  '/icon-512.png', '/manifest-vercel.webmanifest'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('tuongai-vercel-assets-') && key !== CACHE) {
        await caches.delete(key);
      }
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () =>
      (await caches.match('/offline.html')) || Response.error()));
    return;
  }
  if (!ASSETS.includes(u.pathname)) return;
  event.respondWith(caches.match(req).then(response => response || fetch(req)));
});
