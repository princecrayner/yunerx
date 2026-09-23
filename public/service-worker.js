const CACHE_NAME = "yunerx-cache-v3";

const urlsToCache = [
    "/",
    "/manifest.json",
    "/offline.html",
    "/style.css",
    "/js/footer.js",
    "/css/chats.css"
];

// INSTALL: runs once when the service worker is first set up.
// We pre-cache a small set of essential files here.
self.addEventListener("install", (event) => {

    event.waitUntil(

        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache);
        })

    );

    self.skipWaiting();

});


// ACTIVATE: runs after install. We use this moment to delete
// any OLD cache versions, so nothing stale lingers forever.
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


// FETCH: runs for EVERY network request the page makes.
// Strategy: try the real network first (so data is always fresh).
// If that fails (offline), fall back to whatever we have cached.
self.addEventListener("fetch", (event) => {

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

                // Save a copy of static files AND full page loads,
                // so they're available next time if offline.
                if ((isStaticAsset || isNavigation) && response.ok) {

                    const responseClone = response.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });

                }

                return response;

            })
            .catch(() => {

                // Network failed. Do we have this exact page cached?
                return caches.match(event.request).then((cachedResponse) => {

                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    // Never seen this page before — show the offline page.
                    if (isNavigation) {
                        return caches.match("/offline.html");
                    }

                    return new Response("", { status: 408 });

                });

            })

    );

});
