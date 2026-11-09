// UMBRAL — Service Worker: permite instalar la app y jugar sin conexión.
const CACHE = 'umbral-v4';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/config.js', './js/cloud.js', './assets/criaturas/sprites.js', './js/data.js', './js/art.js',
  './js/creature.js', './js/ui.js', './js/battle.js', './js/world.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero (para recibir actualizaciones), caché si no hay conexión. Solo mismo origen.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
