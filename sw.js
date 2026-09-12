/**
 * sw.js
 * A minimal service worker so the app installs like a real app (PWA) and
 * keeps working — app shell included — on a bad or missing connection,
 * which matters a lot for a study app used on the go.
 *
 * Every same-origin GET request is network-first: always try to fetch the
 * freshest copy when online, and only fall back to whatever's cached when
 * the network fails outright. This app has no version number a client can
 * check against and ships new commits constantly, so a cache-first
 * strategy for JS/CSS (an earlier version of this file used one) is
 * actively dangerous here: a returning visitor's browser would keep
 * serving old cached scripts forever after the very first install, even
 * once a fresh index.html referencing new element ids/behavior had loaded
 * — the two go stale relative to each other and things silently break.
 * Network-first means the cache only ever matters when there's truly no
 * connection, which is exactly the case it exists for.
 *
 * Cross-origin requests (Google Fonts, Firebase) are deliberately left
 * alone — intercepting those means dealing with opaque cross-origin
 * responses for no real benefit, since the browser's own HTTP cache
 * already handles repeat font/SDK loads reasonably well.
 */
'use strict';

// Bump this on any change to this file (or to the strategy above) so every
// previously-installed service worker discards its old cache on its next
// activate — see the comment on activate() below.
const CACHE_VERSION = 'tfs-v4';

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
    './js/garden.js',
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
    // Deletes every cache from a previous CACHE_VERSION, not just stale
    // entries within the current one — this is the actual fix for the
    // "old cached JS + new HTML" desync described above: any visitor whose
    // browser already has a service worker installed gets a fully clean
    // slate the moment this new version activates, rather than merging old
    // and new cached files together.
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return; // never cache writes
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // leave cross-origin requests alone entirely

    event.respondWith(
        // `cache: 'no-store'` is the actual fix here, not just the network-
        // first strategy above it: fetch() from inside a service worker
        // still goes through the browser's own ordinary HTTP cache by
        // default, which can satisfy a "network" request with a
        // recently-fetched (and by now stale, relative to a just-shipped
        // deploy) response without a real round-trip at all. This forces a
        // genuine fetch from the server every time, so "network-first"
        // actually means the network, not whatever the browser's HTTP
        // cache thinks is still fresh enough.
        fetch(req, { cache: 'no-store' })
            .then((res) => {
                const copy = res.clone();
                caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
                return res;
            })
            .catch(() => caches.match(req).then((cached) => cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
    );
});
