const CACHE_NAME = "yunerx-cache-v2";

const urlsToCache = [
    "/",
    "/manifest.json",
    "/offline.html",
    "/style.css",
    "/js/footer.js",
    "/css/chats.css"
];

// Install: cache the app shell (static assets + offline page)
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


// Fetch: network first, cache fallback, offline page as last resort for navigation
self.addEventListener("fetch", (event) => {

    // Only handle GET requests
    if (event.request.method !== "GET") {
        return;
    }

    const isNavigation = event.request.mode === "navigate";

    event.respondWith(

        fetch(event.request)
            .then((response) => {

                const isStaticAsset =
                    event.request.destination === "style" ||
                    event.request.destination === "script" ||
                    event.request.destination === "image" ||
                    event.request.destination === "font";

                // Cache static assets AND successful page navigations
                if ((isStaticAsset || isNavigation) && response.ok) {

                    const responseClone = response.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });

                }

                return response;

            })
            .catch(() => {

                // Network failed — try to serve this exact page from cache
                return caches.match(event.request).then((cachedResponse) => {

                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    // Never visited this page before while online — show offline page
                    if (isNavigation) {
                        return caches.match("/offline.html");
                    }

                    return new Response("", { status: 408 });

                });

            })

    );

});
