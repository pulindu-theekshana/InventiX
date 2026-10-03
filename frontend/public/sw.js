/*
 * Service worker — the till's offline shell
 *
 * Purpose : Keeps a copy of the app's own files so the till opens with no connection. Sales already survive a dropped line (src/pos/queue.ts); this is about the app starting at all.
 * Spec    : Section 6.6
 * Look here when : The till will not open offline, or the shop is stuck on an old version.
 *
 * Plain JavaScript on purpose: this file is served as-is from public/, so it is never bundled
 * and never type-checked. Keep it small enough to read in one go.
 */

/*
 * Replaced at build time by scripts/stamp-sw.mjs, so every export is a different file and the
 * browser can see that it is. Everything under the old name is deleted on activate, which is the
 * whole upgrade mechanism -- and an unchanged sw.js means no upgrade is ever noticed.
 */
const VERSION = 'inventix-till-__BUILD__';

/*
 * What a browser needs before it can run anything. The bundle's own file names are hashed at
 * build time and unknown here, so they are cached as they are first fetched instead.
 */
const SHELL = ['/', '/pos', '/manifest.webmanifest', '/icons/till-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      // addAll fails the whole install if one file 404s, which would leave the shop with no
      // service worker at all. Each file is allowed to fail on its own.
      Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined))),
    ),
  );
  // Deliberately no skipWaiting here. A new version taking over mid-sale is how a cashier loses
  // a half-built bill; the page asks the person first and then posts SKIP_WAITING.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // The backend and Supabase are never cached. A stale bill or a stale stock figure is worse
  // than an error the screen can show, and the send queue already handles being offline.
  if (url.origin !== self.location.origin) return;

  // Navigations: try the network so a deploy is picked up, fall back to whatever is stored so
  // the shop can still open the till on a dead line.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/').then((hit) => hit || caches.match(request))),
    );
    return;
  }

  // Everything else the app is built from: serve the stored copy at once, and quietly refresh it
  // for next time. A till on a slow connection starts as fast as one on a fast connection.
  event.respondWith(
    caches.match(request).then((hit) => {
      const live = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit);
      return hit || live;
    }),
  );
});
