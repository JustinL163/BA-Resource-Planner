/**
 * Yoinked from Schale DB because it's 11pm and the documentation for service workers 
 * looks like a pain to read through and I want to play Genshin
 */

const staticCacheVer2 = 1;
const staticCacheName2 = `baplanner-static-v${staticCacheVer2}`;
const currentCacheList2 = [];


self.addEventListener('install', (e) => {
    console.log('[SW] Installed');
    e.waitUntil((async () => {
        self.skipWaiting();
        const staticCache = await caches.open(staticCacheName2);
        currentCacheList2.push(staticCacheName2);
    })());
});

self.addEventListener('activate', (e) => {
    console.log('[SW] Activated');
    e.waitUntil(
        //remove old caches
        caches.keys().then((keys) => {
            return Promise.all(keys.map((key) => {
                if (!currentCacheList2.includes(key)) {
                    console.log(`[SW] Purging outdated cache ${key}`);
                    return caches.delete(key);
                }
            }));
        })
    )
})

self.addEventListener('fetch', (e) => {
    e.respondWith((async () => {

        if (e.request.method != 'GET') { return await fetch(e.request); }

        const r = await caches.match(e.request);
        if (r) { return r; }

        const response = await fetch(e.request);
        if (response.ok && response.type == 'basic') {
            const requestURL = new URL(e.request.url);
            if (requestURL.pathname.includes('halo/') || requestURL.pathname.includes('sleeping/') || requestURL.pathname.includes('chocolate/') ||
                requestURL.pathname.includes('splashart/') || requestURL.pathname.includes('UE/')) {

                const staticCache2 = await caches.open(staticCacheName2);
                try {
                    staticCache2.put(e.request, response.clone());
                }
                catch (error) {
                    console.log(error)
                }
            }
        }
        return response;
    })());
});