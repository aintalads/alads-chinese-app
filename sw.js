const CACHE_NAME = 'mandarin-app-v3';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js'
];

// 1. Install and save the files to the phone
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// 2. When offline, load the saved files!
self.addEventListener('fetch', event => {
    event.respondWith(
        // Always try to get the newest version from the internet first
        fetch(event.request).catch(() => {
            // If the internet is off, serve the file from the phone's memory!
            return caches.match(event.request);
        })
    );
});
