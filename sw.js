/**
 * sw.js
 * A minimal service worker so the app installs like a real app (PWA) and
 * keeps working — app shell included — on a bad or missing connection,
 * which matters a lot for a study app used on the go. Two strategies:
 *
 * - The HTML shell (navigation requests) is network-first: always try to
 *   fetch the latest index.html when online, so an actively-developed app
 *   never gets stuck showing stale markup/routing to someone who has a
 *   connection; only fall back to the cached copy when the network fails.
 * - Everything else same-origin (JS/CSS/data/icons) is cache-first: these
 *   rarely change moment-to-moment, and bumping CACHE_VERSION below
 *   invalidates all of them at once on the next deploy anyway.
 *
 * Cross-origin requests (Google Fonts, Firebase) are deliberately left
 * alone — intercepting those means dealing with opaque cross-origin
 * responses for no real benefit, since the browser's own HTTP cache
 * already handles repeat font/SDK loads reasonably well.
 */
'use strict';

const CACHE_VERSION = 'tfs-v1';

const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './styles/tokens.css',
    './styles/base.css',
    './styles/components.css',
    './styles/screens.css',
    './data/subjects.js',
    './js/errorBoundary.js',
    './js/utils.js',
    './js/storage.js',
    './js/planner.js',
    './js/srs.js',
    './js/state.js',
    './js/i18n.js',
    './js/theme.js',
    './js/toast.js',
    './js/streak.js',
    './js/customSounds.js',
    './js/firebaseConfig.js',
    './js/auth.js',
    './js/presence.js',
    './js/modal.js',
    './js/router.js',
    './js/profile.js',
    './js/landing.js',
    './js/datepicker.js',
    './js/wheelpicker.js',
    './js/onboarding.js',
    './js/dashboard.js',
    './js/stats.js',
    './js/schedule.js',
    './js/flashcards.js',
    './js/focus.js',
    './js/settings.js',
    './js/history.js',
    './js/recap.js',
    './js/app.js',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .catch((e) => console.warn('[sw] precache failed (some assets may not be available offline yet)', e))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return; // never cache writes
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // leave cross-origin requests alone entirely

    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
                    return res;
                })
                .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
        );
        return;
    }

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                const copy = res.clone();
                caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
                return res;
            });
        })
    );
});
