const CACHE_NAME = 'mandarin-app-v5'; // Bumped to v5
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js'
];

// 1. Install and save the new files
self.addEventListener('install', event => {
    self.skipWaiting(); // 🌟 NEW: Forces the phone to use this version immediately
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// 2. 🌟 NEW: Clean up the old broken caches (v1, v2, v3, v4)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName); // Destroys the old ghosts!
                    }
                })
            );
        })
    );
    // Ensure the new service worker takes control immediately
    return self.clients.claim(); 
});

// 3. When offline, load the saved files
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
