// Minimal service worker. Pass-through only (no caching); its presence is
// what makes the app installable as a PWA on mobile Chrome / iOS Safari.
// If we ever want offline support, add a cache strategy here.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
    // intentionally empty — let the network handle every request
});
