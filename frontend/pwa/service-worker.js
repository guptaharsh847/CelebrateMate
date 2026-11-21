/* CelebrateMate service worker — built into dist/sw.js by vite.config.ts.
 *
 * One worker serves two jobs (a scope can only have one service worker):
 *  1. OneSignal Web Push (v16) — imported below.
 *  2. Offline application shell — precaches the built HTML/JS/CSS/icons.
 *
 * PRIVACY: only same-origin GET requests for files inside this app's scope are
 * cached. The Apps Script API, Google Sign-In, OneSignal and fonts are
 * cross-origin and never touched, so no contact data or API response is ever
 * stored in Cache Storage.
 */
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
} catch (error) {
  // Push is unavailable (offline on first install or CDN blocked); the offline shell still works.
}

const BUILD_ID = '__BUILD_ID__';
const CACHE_PREFIX = 'celebratemate-shell-';
const CACHE_NAME = CACHE_PREFIX + BUILD_ID;
const PRECACHE = __PRECACHE_URLS__;

const scopeUrl = self.registration.scope;
const toAbsolute = (path) => new URL(path, scopeUrl).href;
const PRECACHE_URLS = PRECACHE.map(toAbsolute);
const PRECACHE_SET = new Set(PRECACHE_URLS);
const INDEX_URL = toAbsolute('index.html');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !request.url.startsWith(scopeUrl)) return;

  // App navigations: network first (always fresh when online), cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(INDEX_URL)));
    return;
  }

  // Build assets (content-hashed) and icons: cache first.
  if (PRECACHE_SET.has(url.origin + url.pathname)) {
    event.respondWith(caches.match(request, { ignoreSearch: true }).then((cached) => cached || fetch(request)));
  }
});
