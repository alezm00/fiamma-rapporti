// Service worker: salva tutti i file dell'app per l'uso offline.
// Dopo ogni modifica ai file aumentare la versione, così i telefoni scaricano l'aggiornamento.
const CACHE = 'testo-qr-v9';
const FILES = [
    './',
    './index.html',
    './app.js',
    './tjf.js',
    './report.js',
    './geo.js',
    './validate.js',
    './photos.js',
    './manifest.json',
    './vendor/zxing-reader.js',
    './vendor/zxing_reader.wasm',
    './vendor/pdf-lib.min.js',
    './vendor/fontkit.umd.min.js',
    './vendor/LiberationSans-Regular.ttf',
    './vendor/LiberationSans-Bold.ttf',
    './img/icon-192.png',
    './img/icon-512.png',
    './img/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
    event.respondWith(
        caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)),
    );
});
