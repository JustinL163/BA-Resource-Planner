const cacheVersion = 3;
const cachePrefix = 'baplanner-static-v';
const cacheName = `${cachePrefix}${cacheVersion}`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await self.skipWaiting();
    await caches.open(cacheName);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const oldCaches = (await caches.keys()).filter((name) =>
      name.startsWith(cachePrefix) && name !== cacheName
    );
    await Promise.all(oldCaches.map((name) => caches.delete(name)));
  })());
});

self.addEventListener('fetch', (event) => {
  event.respondWith((async () => {
    if (event.request.method !== 'GET') return fetch(event.request);

    const cache = await caches.open(cacheName);
    const cached = await cache.match(event.request);
    if (cached) return cached;

    const response = await fetch(event.request);
    if (response.ok && response.type === 'basic') {
      const pathname = new URL(event.request.url).pathname;
      if (['halo/', 'sleeping/', 'chocolate/', 'splashart/', 'UE/'].some((segment) => pathname.includes(segment))) {
        try {
          await cache.put(event.request, response.clone());
        } catch (error) {
          console.warn('[SW] Could not cache game asset.', error);
        }
      }
    }
    return response;
  })());
});
