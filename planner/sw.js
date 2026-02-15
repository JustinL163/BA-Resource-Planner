/**
 * Yoinked from Schale DB because it's 11pm and the documentation for service workers 
 * looks like a pain to read through and I want to play Genshin
 */

const staticCacheVer = 2;
const staticCacheName = `baplanner-static-v${staticCacheVer}`;
const currentCacheList = [];


self.addEventListener('install', (e) => {
    console.log('[SW] Installed');
    e.waitUntil((async () => {
        self.skipWaiting();
        const staticCache = await caches.open(staticCacheName);
        currentCacheList.push(staticCacheName);
    })());
});

self.addEventListener('activate', (e) => {
    console.log('[SW] Activated');
    e.waitUntil(
        //remove old caches
        caches.keys().then((keys) => {
            return Promise.all(keys.map((key) => {
                if (!currentCacheList.includes(key)) {
                    console.log(`[SW] Purging outdated cache ${key}`);
                    return caches.delete(key);
                }
            }));
        })
    )
})

self.addEventListener('fetch', (e) => {
    e.respondWith((async () => {

        if (e.request.method != 'GET') {return await fetch(e.request);}
        
        const r = await caches.match(e.request);
        if (r) {return r;}

        const response = await fetch(e.request);
        if (response.ok && response.type == 'basic') {
            const requestURL = new URL(e.request.url);
            if (requestURL.pathname.includes('/icons/') || requestURL.pathname.includes('/packages/')) {
                const staticCache = await caches.open(staticCacheName);
                try {
                    staticCache.put(e.request, response.clone());
                }
                catch (error) {
                    console.log(error)
                }
            }
        }
        return response;
    })());
});