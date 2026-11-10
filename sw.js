/* Офлайн: усі файли застосунку зберігаються на телефоні. Змінюй VERSION при кожному оновленні. */
const VERSION = 'trn-v1.15.2';
const FILES = ['./', 'index.html', 'styles.css', 'badges.js', 'app.js', 'program.js', 'bodymap.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'img/tomek/logo.png', 'img/tomek/ogo.png', 'img/tomek/smug.png', 'img/tomek/shake.png', 'img/tomek/inspector.png', 'img/tomek/proud.png', 'img/tomek/sleep.png', 'img/tomek/back.png', 'img/tomek/shy.png', 'img/tomek/loaf.png', 'img/tomek/first.png', 'img/tomek/yay.png', 'img/tomek/wig.png', 'img/tomek/trio.png', 'img/tomek/box.png', 'img/tomek/peek.png', 'img/tomek/sideeye.png', 'img/smith-fw161.jpg', 'img/backext-45.jpg', 'img/adductor.jpg', 'img/biceps-s40.jpg', 'img/chest-s13.jpg', 'img/hipthrust-drax.jpg', 'img/lat-s33.jpg', 'img/legcurl-s72.jpg', 'img/legext-s71.jpg', 'img/legpress-hack.jpg', 'img/legpress-s70.jpg', 'img/ms50.jpg', 'img/multifly.jpg', 'img/pecfly.jpg', 'img/rack-platform.jpg', 'img/row-s34.jpg', 'img/tbar-drax.jpg', 'img/triceps-s42.jpg', 'img/vsquat-drax.jpg'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error()))
  );
});
