/* Booyo service worker.
   Caches every file of the app on first visit so it keeps working with no internet (airplane mode).
   Same-origin only: requests to any other site are never touched or cached.
   Bump CACHE when you change the app so devices pick up the new files. */
var CACHE = 'booyo-v3.4.0';
var ASSETS = [
  './', './index.html', './app.js', './data.js', './style.css', './manifest.json', './privacy.html',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-192.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png', './icons/favicon-16.png', './icons/favicon.ico', './favicon.ico'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && (k.indexOf('booyo-') === 0 || k.indexOf('toddy-o-') === 0 || k.indexOf('little-learners-') === 0); }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var key = new Request(url.origin + url.pathname);   // ignore ?query so test flags etc. still work offline
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(key).then(function (hit) {
      // cache first (instant + offline), refresh the cached copy in the background when online
      var net = fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') c.put(key, res.clone());
        return res;
      }).catch(function () { return null; });
      if (hit) { e.waitUntil(net); return hit; }
      return net.then(function (res) {
        if (res) return res;
        return req.mode === 'navigate' ? c.match(new Request(url.origin + url.pathname.replace(/[^/]*$/, '') + 'index.html')) : Response.error();
      });
    });
  }));
});
