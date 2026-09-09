const CACHE_NAME = "yunerx-cache-v1";

const urlsToCache = [
    "/",
    "/manifest.json"
];

// Install: cache a minimal set of files
self.addEventListener("install", (event) => {

    event.waitUntil(

        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache);
        })

    );

    self.skipWaiting();

});


// Activate: clean up old caches
self.addEventListener("activate", (event) => {

    event.waitUntil(

        caches.keys().then((cacheNames) => {

            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );

        })

    );

    self.clients.claim();

});


// Fetch: try network first, fall back to cache if offline
self.addEventListener("fetch", (event) => {

    event.respondWith(

        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })

    );

});
