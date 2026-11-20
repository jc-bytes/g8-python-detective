importScripts('./offline-assets.js');
const CACHE = 'python-detective-static-fb5e8e739f0cc1102d4886c7';
const FILES = new Set(['./', ...globalThis.detectiveOfflineAssets.map(file => `./${file}`)]);
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(Array.from(FILES, path => new Request(path, {cache: 'reload'})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('python-detective-static-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope)) return;
  const relative = event.request.url.slice(self.registration.scope.length).split('?')[0];
  if (!FILES.has(`./${relative}`) && relative !== '') return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request, { ignoreSearch: true })) || fetch(event.request)));
});
