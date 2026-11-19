const CACHE = 'python-detective-static-105-repair-feedback';
const FILES = ['./', './index.html', './favicon.png', './sound.js', './answer-field.js', './audio/book_flip_1.wav', './audio/book_open.wav', './audio/door_open_1.wav', './audio/footstep_0.wav', './audio/footstep_1.wav', './audio/handle_coins.wav', './audio/handle_small_leather.wav', './style.css', './printer.css', './speech.js', './shop-art.js', './printer-scene.js', './shop-walk.js', './shop-tasks.js', './task-scene.js', './rule-book.js', './printer-state.js', './app.js', './case.js', './model.js', './runtime.js', './runtime-worker.js', './export.js', './report-view.js', './vendor/pdf-view.mjs', './vendor/pdf.worker.min.mjs', './vendor/pdfmake.js', './vendor/pdf-fonts.js', './vendor/pyodide/pyodide.js', './vendor/pyodide/pyodide.asm.js', './vendor/pyodide/pyodide.asm.wasm', './vendor/pyodide/python_stdlib.zip', './vendor/pyodide/pyodide-lock.json'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('python-detective-static-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope)) return;
  const relative = event.request.url.slice(self.registration.scope.length).split('?')[0];
  if (!FILES.includes(`./${relative}`) && relative !== '') return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request, { ignoreSearch: true })) || fetch(event.request)));
});
