/* Service Worker – Neon Countdowns */
const VERSION = 'v1';
const CACHE = `countdowns-${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/icon.svg',
  './icons/icon-maskable.svg'
];

/* ---------- Install ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' umgeht den HTTP-Cache beim Precaching
    await cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

/* ---------- Activate ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

/* ---------- Fetch ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Nur GET und nur eigene Origin
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigationen: Network-First, Offline-Fallback auf gecachte index.html
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        const cached =
          (await caches.match('./index.html')) || (await caches.match('./'));
        return cached || new Response(
          '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
          '<body style="background:#0a0a12;color:#e0e6ff;font-family:system-ui;padding:40px">' +
          '<h1>Offline</h1><p>Die App wurde noch nicht zwischengespeichert. ' +
          'Bitte einmal mit Internetverbindung öffnen.</p>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // Statische Assets: Cache-First mit Hintergrund-Revalidierung
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);

    if (cached) {
      fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
        })
        .catch(() => { /* offline -> egal */ });
      return cached;
    }

    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});

/* ---------- Update auf Zuruf ---------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});