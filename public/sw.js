// public/sw.js
// Nestery's service worker. Nestery needs the server for its data, so this
// doesn't cache the app: it only shows public/offline.html when a page can't
// load without a connection. Registered in src/components/ServiceWorker.tsx.

const CACHE = "nestery-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Drop caches from older versions of this file
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Only page loads; API calls, scripts and images go to the network as usual
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL, { cacheName: CACHE }))
  );
});
