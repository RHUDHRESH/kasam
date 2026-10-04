const CACHE = 'kasam-v10';
const FILES = [
  './', './index.html', './seal.html', './verify.html', './light.html',
  './css/style.css', './js/code.js', './js/analyze.js', './js/seal.js', './js/verify.js', './js/light.js',
  './manifest.webmanifest', './icon.svg', './docs/assets/icon-192.png', './docs/assets/icon-512.png',
  './README.md', './LICENSE', './tools/kasam_check.py', './tools/requirements.txt', './tools/check.mjs',
  './docs/CONTEXT.md', './docs/VERIFICATION.md', './docs/verification-results.json',
  './docs/assets/oath.svg', './docs/assets/readme-cover.svg', './docs/assets/how-it-works.svg',
  './docs/assets/app-home.jpg', './docs/assets/app-mobile.jpg', './docs/assets/app-cut.jpg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('kasam-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Only cache the application shell, never user files, blobs or external requests.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then(cached => cached || fetch(event.request)));
});
