// Service worker: salva tutti i file dell'app per l'uso offline.
// Dopo ogni modifica ai file aumentare la versione, così i telefoni scaricano l'aggiornamento.
const CACHE = 'fiamma-v28';
const FILES = [
    './',
    './index.html',
    './manifest.json',
    // programma
    './src/app.js',
    './src/backup/file.js',
    './src/backup/folder/index.js',
    './src/backup/folder/paths.js',
    './src/data/db.js',
    './src/data/photos.js',
    './src/data/quickscans.js',
    './src/data/settings.js',
    './src/data/store.js',
    './src/lib/dates.js',
    './src/lib/geo.js',
    './src/lib/validate.js',
    './src/lib/zip.js',
    './src/model/index.js',
    './src/model/list.js',
    './src/model/mail.js',
    './src/model/measures.js',
    './src/model/normalize.js',
    './src/model/report.js',
    './src/model/units.js',
    './src/model/values.js',
    './src/pdf/footer.js',
    './src/pdf/header.js',
    './src/pdf/index.js',
    './src/pdf/libs.js',
    './src/pdf/materials.js',
    './src/pdf/measures.js',
    './src/pdf/parties.js',
    './src/pdf/photos.js',
    './src/pdf/sheet.js',
    './src/pdf/text.js',
    './src/qr/scanner.js',
    './src/qr/tjf/channels.js',
    './src/qr/tjf/format.js',
    './src/qr/tjf/index.js',
    './src/qr/tjf/items.js',
    './src/qr/tjf/labels.js',
    './src/screens/editor/index.js',
    './src/screens/home.js',
    './src/screens/measure.js',
    './src/screens/quick.js',
    './src/screens/scan.js',
    './src/screens/settings.js',
    './src/screens/trash.js',
    './src/ui/classes.js',
    './src/ui/nav.js',
    './src/ui/util.js',
    // stile, librerie e immagini
    './css/tailwind.css',
    './css/load-tailwind.js',
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

// 'reload': i file si scaricano dal sito, non dalla cache HTTP del browser (che potrebbe ridare quelli vecchi)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => Promise.all(FILES.map((file) => cache.add(new Request(file, { cache: 'reload' })))))
            .then(() => self.skipWaiting()),
    );
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
