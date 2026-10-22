// Service worker: salva tutti i file dell'app per l'uso offline.
// Dopo ogni modifica ai file aumentare la versione, così i telefoni scaricano l'aggiornamento.
const CACHE = 'fiamma-v25';
const FILES = [
    './',
    './index.html',
    './app.js',
    './nav.js',
    './util.js',
    './scanner.js',
    './db.js',
    './model.js',
    './store.js',
    './quickscans.js',
    './folder.js',
    './backup.js',
    './zip.js',
    './screens/home.js',
    './screens/editor.js',
    './screens/scan.js',
    './screens/measure.js',
    './screens/quick.js',
    './screens/trash.js',
    './screens/settings.js',
    './tjf.js',
    './report.js',
    './geo.js',
    './validate.js',
    './photos.js',
    './mail.js',
    './settings.js',
    './ui.js',
    './css/tailwind.css',
    './css/load-tailwind.js',
    './manifest.json',
    './vendor/tailwindcss-browser.js',
    './vendor/zxing-reader.js',
    './vendor/zxing_reader.wasm',
    './vendor/pdf-lib.min.js',
    './vendor/fontkit.umd.min.js',
    './vendor/LiberationSans-Regular.ttf',
    './vendor/LiberationSans-Bold.ttf',
    './img/icon.svg',
    './img/apple-touch-icon.png',
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
