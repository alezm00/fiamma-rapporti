import { bytesToJson, buildReport, reportToText, formatDate } from './tjf.js';
import { createReportPdf, preloadPdfLibs, reportFileName } from './report.js';
import { getPosition, geoErrorMessage, reverseGeocode } from './geo.js';
import { checkFiscalCode } from './validate.js';
import { listPhotos, addPhoto, removePhoto, keepPhotosOf } from './photos.js';
import { buildBody, buildSubject, checkRecipients, mailtoUrl } from './mail.js';
import { loadSettings, saveSettings } from './settings.js';

const $ = (id) => document.getElementById(id);
const HISTORY_KEY = 'testoqr.history';
const MAX_HISTORY = 20;

// Libreria QR (zxing-wasm): il file .wasm è servito in locale, così funziona offline
const zxingReady = ZXingWASM.prepareZXingModule({
    overrides: {
        locateFile: (path, prefix) => (path.endsWith('.wasm') ? new URL(`vendor/${path}`, document.baseURI).href : prefix + path),
    },
    fireImmediately: true,
});
zxingReady.catch(() => showMsg('Impossibile caricare il lettore QR. Apri l\'app almeno una volta con internet attivo.', 'error'));

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ---------------------------------------------------------------------------
// Utilità
// ---------------------------------------------------------------------------

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
}

function showMsg(text, type = 'error') {
    const box = $('home-msg');
    box.textContent = text;
    box.className = `msg ${type}`;
    box.hidden = false;
}

function hideMsg() {
    $('home-msg').hidden = true;
}

let toastTimer;
function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 1800);
}

function vibrate(ms) {
    try { navigator.vibrate?.(ms); } catch {}
}

// FNV-1a: id per le misure senza measurementuuid
function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(16);
}

// ---------------------------------------------------------------------------
// Storico (localStorage)
// ---------------------------------------------------------------------------

function loadHistory() {
    try {
        const list = JSON.parse(localStorage.getItem(HISTORY_KEY));
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function saveHistory(list) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
    } catch {}
}

function addToHistory(json, report) {
    const id = report.uuid || hash(JSON.stringify(json));
    const list = loadHistory();
    // riscansionando lo stesso QR i dati del cliente restano
    const entry = { id, savedAt: Date.now(), json, customer: list.find((e) => e.id === id)?.customer };
    saveHistory([entry, ...list.filter((e) => e.id !== id)]);
    cleanupPhotos();
    return entry;
}

// le foto restano solo per le scansioni ancora nello storico
function cleanupPhotos() {
    keepPhotosOf(loadHistory().map((e) => e.id)).catch(() => {});
}

function updateEntry(entry) {
    saveHistory(loadHistory().map((e) => (e.id === entry.id ? entry : e)));
}

function renderHistory() {
    const list = loadHistory();
    const ul = $('history');
    ul.replaceChildren();
    $('history-empty').hidden = list.length > 0;
    $('btn-clear').hidden = list.length === 0;
    for (const entry of list) {
        let report;
        try {
            report = buildReport(entry.json);
        } catch {
            continue;
        }
        const li = el('li');
        const open = el('button', 'hitem');
        open.append(el('span', 'h-title', report.title));
        const fuel = report.header.find((h) => h.label === 'Combustibile');
        open.append(el('span', 'h-meta', [formatDate(report.start || new Date(entry.savedAt)), fuel?.value, entry.customer?.name].filter(Boolean).join(' · ')));
        const first = report.columns[0];
        const vals = report.rows.slice(0, 4).map((r) => `${r.short || r.label} ${r.cells[first] ?? ''}`).join(' · ');
        if (vals) open.append(el('span', 'h-vals', vals));
        open.addEventListener('click', () => openEntry(entry));

        const del = el('button', 'hdel', '✕');
        del.setAttribute('aria-label', 'Elimina');
        del.addEventListener('click', () => {
            if (!confirm(`Eliminare "${report.title}"?`)) return;
            saveHistory(loadHistory().filter((e) => e.id !== entry.id));
            cleanupPhotos();
            renderHistory();
        });
        li.append(open, del);
        ul.append(li);
    }
}

$('btn-clear').addEventListener('click', () => {
    if (!confirm('Cancellare tutte le scansioni salvate?')) return;
    saveHistory([]);
    cleanupPhotos();
    renderHistory();
});

// ---------------------------------------------------------------------------
// Navigazione tra le viste (il tasto "indietro" di Android torna alla home)
// ---------------------------------------------------------------------------

let current = 'home';

function show(view) {
    $('photo-view').hidden = true;
    // chi scrive e torna indietro subito non deve perdere l'ultima modifica
    if (current === 'report' && view !== 'report') flushCustomer();
    if (current === 'settings' && view !== 'settings') persistSettings();
    if (current === 'scan' && view !== 'scan') stopScan();
    for (const v of ['home', 'scan', 'result', 'report', 'settings']) $(`view-${v}`).hidden = v !== view;
    if (view !== 'home') {
        // il report è un livello in più: "indietro" torna al risultato
        if (current === 'home' || (view === 'report' && current === 'result')) history.pushState({ view }, '');
        else history.replaceState({ view }, '');
    }
    current = view;
    if (view === 'report') updateMailInfo();
    if (view === 'result') requestWakeLock();
    else releaseWakeLock();
    if (view === 'home') renderHistory();
    window.scrollTo(0, 0);
}

function goHome() {
    if (history.state?.view) history.back();
    else show('home');
}

window.addEventListener('popstate', () => {
    if (current === 'report') show('result');
    else if (current !== 'home') show('home');
});

// ---------------------------------------------------------------------------
// Schermo sempre acceso mentre si legge il risultato
// ---------------------------------------------------------------------------

let wakeLock = null;

async function requestWakeLock() {
    try {
        if (!wakeLock) wakeLock = await navigator.wakeLock?.request('screen');
        wakeLock?.addEventListener?.('release', () => (wakeLock = null));
    } catch {}
}

function releaseWakeLock() {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && current === 'result') requestWakeLock();
    if (document.hidden && current === 'scan') goHome();
});

// ---------------------------------------------------------------------------
// Fotocamera
// ---------------------------------------------------------------------------

const LIVE_OPTIONS = { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 1 };
const PHOTO_OPTIONS = { formats: ['QRCode'], tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true, maxNumberOfSymbols: 8 };

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let stream = null;
let scanning = false;
let scanTimer = null;
let parts = null; // QR divisi in più parti (structured append)

function setStatus(text) {
    $('scan-status').textContent = text;
}

function cameraError(e) {
    switch (e?.name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return 'Permesso fotocamera negato. Abilitalo dalle impostazioni del sito (icona a sinistra dell\'indirizzo) e riprova.';
        case 'NotFoundError':
        case 'OverconstrainedError':
            return 'Nessuna fotocamera trovata.';
        case 'NotReadableError':
            return 'La fotocamera è usata da un\'altra app. Chiudila e riprova.';
        default:
            return `Impossibile avviare la fotocamera: ${e?.message || e}`;
    }
}

async function startScan() {
    hideMsg();
    if (!navigator.mediaDevices?.getUserMedia) {
        showMsg('Fotocamera non disponibile. Apri l\'app da Chrome con indirizzo https, oppure usa "Da foto".');
        return;
    }
    show('scan');
    setStatus('Avvio fotocamera…');
    $('btn-torch').hidden = true;
    $('btn-torch').classList.remove('on');
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
    } catch (e) {
        goHome();
        showMsg(cameraError(e));
        return;
    }
    if (current !== 'scan') {
        stopStream();
        return;
    }
    const video = $('video');
    video.srcObject = stream;
    await video.play().catch(() => {});

    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities?.() || {};
    if (caps.focusMode?.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
    $('btn-torch').hidden = !caps.torch;

    try {
        await zxingReady;
    } catch {
        goHome();
        return;
    }
    scanning = true;
    parts = null;
    setStatus('Inquadra il QR code');
    scanFrame();
}

async function scanFrame() {
    if (!scanning) return;
    const video = $('video');
    if (video.readyState >= 2 && video.videoWidth) {
        // si analizza il quadrato centrale del fotogramma (dove c'è il riquadro)
        const w = video.videoWidth;
        const h = video.videoHeight;
        const side = Math.min(w, h);
        canvas.width = side;
        canvas.height = side;
        ctx.drawImage(video, (w - side) / 2, (h - side) / 2, side, side, 0, 0, side, side);
        try {
            const results = await ZXingWASM.readBarcodes(ctx.getImageData(0, 0, side, side), LIVE_OPTIONS);
            if (scanning && (await handleResults(results))) return;
        } catch (e) {
            console.error(e);
        }
    }
    if (scanning) scanTimer = setTimeout(scanFrame, 80);
}

// Restituisce true quando la lettura è completa
async function handleResults(results) {
    const valid = results.filter((r) => r.isValid && r.bytes?.length);
    if (!valid.length) return false;

    let bytes = valid[0].bytes;
    if (valid[0].sequenceSize > 1) {
        for (const r of valid) {
            if (!parts || parts.id !== r.sequenceId) parts = { id: r.sequenceId, size: r.sequenceSize, data: {} };
            parts.data[r.sequenceIndex] = r.bytes;
        }
        const have = Object.keys(parts.data).length;
        if (have < parts.size) {
            setStatus(`Parte ${have} di ${parts.size} letta: inquadra le altre`);
            if (current === 'scan') vibrate(40);
            return false;
        }
        bytes = joinBytes(Array.from({ length: parts.size }, (_, i) => parts.data[i]));
    }
    stopScan();
    vibrate(120);
    await processBytes(bytes, valid[0].text);
    return true;
}

function joinBytes(chunks) {
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let pos = 0;
    for (const c of chunks) {
        out.set(c, pos);
        pos += c.length;
    }
    return out;
}

function stopStream() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    $('video').srcObject = null;
}

function stopScan() {
    scanning = false;
    clearTimeout(scanTimer);
    stopStream();
}

$('btn-scan').addEventListener('click', startScan);
$('btn-again').addEventListener('click', startScan);
$('btn-cancel').addEventListener('click', goHome);
$('btn-home').addEventListener('click', goHome);

$('btn-torch').addEventListener('click', async () => {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    const on = !$('btn-torch').classList.contains('on');
    try {
        await track.applyConstraints({ advanced: [{ torch: on }] });
        $('btn-torch').classList.toggle('on', on);
    } catch {}
});

// Lettura da una foto (utile con QR molto densi o riflessi sul display)
$('in-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    showMsg('Analisi della foto…', 'info');
    try {
        await zxingReady;
        const results = await ZXingWASM.readBarcodes(file, PHOTO_OPTIONS);
        parts = null;
        const valid = results.filter((r) => r.isValid && r.bytes?.length);
        if (!valid.length) {
            showMsg('Nessun QR code trovato nella foto. Riprova avvicinandoti e tenendo il QR a fuoco, senza riflessi.');
            return;
        }
        if (!(await handleResults(valid))) {
            showMsg(`La foto contiene solo ${Object.keys(parts.data).length} parti su ${parts.size} del QR.`);
            parts = null;
        }
    } catch (err) {
        showMsg(`Errore nella lettura della foto: ${err.message || err}`);
    }
});

// Importazione di un file .gz / .json (per prove e casi particolari)
$('in-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    await processBytes(new Uint8Array(await file.arrayBuffer()));
});

// ---------------------------------------------------------------------------
// Byte letti -> risultato
// ---------------------------------------------------------------------------

async function processBytes(bytes, text) {
    let json, report;
    try {
        json = await bytesToJson(bytes);
        report = buildReport(json);
    } catch {
        if (current !== 'home') goHome();
        const preview = text && /^[\x20-\x7e -￿\s]+$/.test(text) ? ` Contenuto letto: "${text.slice(0, 200)}"` : '';
        showMsg(`Il QR letto non contiene dati Testo validi.${preview}`);
        return;
    }
    hideMsg();
    openEntry(addToHistory(json, report));
}

function openEntry(entry) {
    renderReport(buildReport(entry.json), entry);
    show('result');
}

function renderReport(r, entry) {
    currentReport = r;
    currentEntry = entry;
    $('r-title').textContent = r.title;
    const dates = [];
    if (r.start) dates.push(formatDate(r.start));
    if (r.typeId && r.typeId !== r.title) dates.push(r.typeId);
    $('r-date').textContent = dates.join(' · ');

    const head = $('r-header');
    head.replaceChildren();
    for (const h of r.header) head.append(el('dt', null, h.label), el('dd', null, h.value));
    $('r-note').hidden = !r.note;
    $('r-note').textContent = r.note ? `Note: ${r.note}` : '';

    $('r-errors').hidden = !r.errors.length;
    $('r-errors').textContent = r.errors.join('\n');

    // valori
    const table = $('r-table');
    table.replaceChildren();
    const cols = r.columns.length ? r.columns : [''];
    const multi = cols.length > 1;
    table.classList.toggle('multi', multi);
    table.style.setProperty('--cols', cols.length);
    if (multi) {
        const hdr = el('div', 'vhead');
        hdr.append(...cols.map((c) => el('span', null, c)), el('span'));
        table.append(hdr);
    }
    for (const row of r.rows) {
        const div = el('div', 'vrow');
        const label = el('div', 'vlabel');
        label.append(el('span', 'vcode', row.short || row.label));
        if (row.short && row.short !== row.label) label.append(el('span', 'vname', row.label));
        // segno meno tipografico: più leggibile del trattino
        div.append(label, ...cols.map((c) => el('div', 'vnum', (row.cells[c] ?? '').replace(/^-(?=\d)/, '\u2212'))), el('div', 'vunit', row.unit));
        table.append(div);
    }
    $('r-values').hidden = r.rows.length === 0;
    if (!r.rows.length && !r.errors.length) {
        $('r-errors').hidden = false;
        $('r-errors').textContent = 'Il QR non contiene valori di misura.';
    }

    // sezioni richiudibili
    const box = $('r-sections');
    box.replaceChildren();
    for (const s of r.sections) {
        const d = el('details', 'container');
        if (s.title === 'Fasi della prova') d.open = true;
        const dl = el('dl');
        for (const it of s.items) dl.append(el('dt', null, it.label), el('dd', null, it.value));
        d.append(el('summary', null, s.title), dl);
        box.append(d);
    }
    $('r-json').textContent = JSON.stringify(entry.json, null, 2);

    $('btn-copy').onclick = async () => {
        try {
            await navigator.clipboard.writeText(reportToText(r));
            toast('Copiato');
        } catch {
            toast('Copia non riuscita');
        }
    };
}

// ---------------------------------------------------------------------------
// Report PDF con i dati del cliente
// ---------------------------------------------------------------------------

let currentReport = null;
let currentEntry = null;

const FIELDS = {
    name: 'c-name', fiscalCode: 'c-cf', address: 'c-address', phone: 'c-phone',
    brand: 'c-brand', serial: 'c-serial', plateCode: 'c-plate', installDate: 'c-date', notes: 'c-notes',
};

function readCustomer() {
    return Object.fromEntries(Object.entries(FIELDS).map(([key, id]) => [key, $(id).value]));
}

// i dati del cliente restano nella scansione salvata sul telefono
function saveCustomer() {
    if (!currentEntry) return;
    currentEntry.customer = readCustomer();
    updateEntry(currentEntry);
}

function showBoxMsg(id, text, type = 'info') {
    const box = $(id);
    box.textContent = text;
    box.className = `msg ${type}`;
    box.hidden = !text;
}

// Controllo del codice fiscale: mostra un avviso sotto il campo ma non blocca mai il PDF.
const CHECKS = [
    { id: 'c-cf', hint: 'cf-hint', name: 'codice fiscale', check: checkFiscalCode },
];

// restituisce i nomi dei campi da controllare
function validateCustomer() {
    const problems = [];
    for (const { id, hint, name, check } of CHECKS) {
        const r = check($(id).value);
        $(hint).hidden = r.ok;
        $(hint).textContent = r.ok ? '' : r.error;
        if (!r.ok) problems.push(name);
    }
    return problems;
}

// mentre si scrive l'avviso sparisce; a campo finito il valore viene sistemato e ricontrollato
for (const { id, hint } of CHECKS) $(id).addEventListener('input', () => ($(hint).hidden = true));
$('c-cf').addEventListener('change', () => {
    $('c-cf').value = checkFiscalCode($('c-cf').value).value; // maiuscolo, senza spazi
    validateCustomer();
});

function canShareFiles() {
    try {
        return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })] });
    } catch {
        return false;
    }
}

function openReportForm() {
    const customer = currentEntry.customer ?? loadSettings().defaults; // nuova scansione: dati predefiniti
    for (const [key, id] of Object.entries(FIELDS)) $(id).value = customer[key] || '';
    showBoxMsg('geo-msg', '');
    showBoxMsg('report-msg', '');
    showBoxMsg('photo-msg', '');
    validateCustomer();
    renderPhotos();
    $('rp-summary').textContent = [currentReport.title, currentReport.start && formatDate(currentReport.start)].filter(Boolean).join(' · ');
    $('btn-pdf-share').hidden = !canShareFiles();
    preloadPdfLibs().catch(() => {}); // pronte quando si preme "Invia" o "Condividi", altrimenti il telefono può negare la condivisione
    show('report');
}

$('btn-report').addEventListener('click', openReportForm);
$('btn-report-back').addEventListener('click', () => {
    saveCustomer();
    if (history.state?.view === 'report') history.back();
    else show('result');
});

let customerTimer;
function flushCustomer() {
    clearTimeout(customerTimer);
    saveCustomer();
}
$('view-report').addEventListener('input', () => {
    clearTimeout(customerTimer);
    customerTimer = setTimeout(saveCustomer, 300);
});
// anche se si passa a un'altra app
document.addEventListener('visibilitychange', () => {
    if (document.hidden && current === 'report') flushCustomer();
    if (document.hidden && current === 'settings') persistSettings();
});

// indirizzo dalla posizione del telefono
$('btn-geo').addEventListener('click', async () => {
    const btn = $('btn-geo');
    btn.disabled = true;
    try {
        showBoxMsg('geo-msg', 'Rilevo la posizione…');
        let pos;
        try {
            pos = await getPosition();
        } catch (e) {
            showBoxMsg('geo-msg', geoErrorMessage(e), 'error');
            return;
        }
        const { latitude, longitude, accuracy } = pos.coords;
        showBoxMsg('geo-msg', 'Cerco l\'indirizzo…');
        try {
            $('c-address').value = await reverseGeocode(latitude.toFixed(6), longitude.toFixed(6));
            saveCustomer();
            showBoxMsg('geo-msg', `Indirizzo trovato (precisione circa ${Math.round(accuracy)} m). Controllalo prima di creare il PDF.`, 'success');
        } catch {
            showBoxMsg('geo-msg', `Posizione trovata (${latitude.toFixed(5)}, ${longitude.toFixed(5)}) ma non riesco a ricavare l'indirizzo (serve internet). Inseriscilo a mano.`, 'error');
        }
    } finally {
        btn.disabled = false;
    }
});

// ---- foto -------------------------------------------------------------------

const MAX_PHOTOS = 12;
let photoUrls = [];

async function renderPhotos() {
    const entry = currentEntry;
    const photos = await listPhotos(entry.id);
    if (entry !== currentEntry) return; // nel frattempo si è aperta un'altra scansione
    photoUrls.forEach((url) => URL.revokeObjectURL(url));
    photoUrls = [];
    const grid = $('photo-grid');
    grid.replaceChildren();
    for (const photo of photos) {
        const url = URL.createObjectURL(photo.blob);
        photoUrls.push(url);
        const cell = el('div', 'photo');
        const img = el('img');
        img.src = url;
        img.alt = 'Foto';
        img.addEventListener('click', () => {
            $('photo-view').querySelector('img').src = url;
            $('photo-view').hidden = false;
        });
        const del = el('button', 'photo-del', '✕');
        del.type = 'button';
        del.setAttribute('aria-label', 'Elimina foto');
        del.addEventListener('click', async () => {
            if (!confirm('Eliminare questa foto?')) return;
            await removePhoto(photo.id);
            renderPhotos();
        });
        cell.append(img, del);
        grid.append(cell);
    }
    $('photo-count').textContent = photos.length ? `(${photos.length} di ${MAX_PHOTOS})` : '';
}

async function addPhotoFiles(files) {
    const entry = currentEntry;
    const room = MAX_PHOTOS - (await listPhotos(entry.id)).length;
    if (room <= 0) {
        showBoxMsg('photo-msg', `Massimo ${MAX_PHOTOS} foto per report: elimina una foto per aggiungerne altre.`, 'warn');
        return;
    }
    const batch = files.slice(0, room);
    let error = '';
    for (const [i, file] of batch.entries()) {
        showBoxMsg('photo-msg', `Elaboro la foto ${i + 1} di ${batch.length}…`);
        try {
            await addPhoto(entry.id, file);
            if (entry === currentEntry) await renderPhotos();
        } catch (e) {
            error = e.name === 'QuotaExceededError' ? 'Memoria del telefono piena: libera spazio e riprova.' : `Foto non aggiunta: ${e.message || e}`;
            break;
        }
    }
    if (error) showBoxMsg('photo-msg', error, 'error');
    else if (files.length > batch.length) showBoxMsg('photo-msg', `Massimo ${MAX_PHOTOS} foto per report: ne ho aggiunte ${batch.length}.`, 'warn');
    else showBoxMsg('photo-msg', '');
}

for (const id of ['in-shoot', 'in-gallery']) {
    $(id).addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        e.target.value = '';
        if (files.length) addPhotoFiles(files);
    });
}
$('photo-view').addEventListener('click', () => ($('photo-view').hidden = true));

async function buildPdfFile() {
    saveCustomer();
    const customer = readCustomer();
    const photos = await Promise.all((await listPhotos(currentEntry.id)).map(async (p) => ({
        bytes: new Uint8Array(await p.blob.arrayBuffer()), width: p.width, height: p.height,
    })));
    const bytes = await createReportPdf(currentReport, customer, new Date(), photos);
    return new File([bytes], reportFileName(currentReport, customer), { type: 'application/pdf' });
}

function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const a = el('a');
    a.href = url;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function runPdf(button, action) {
    button.disabled = true;
    showBoxMsg('report-msg', '');
    try {
        await action();
    } catch (e) {
        showBoxMsg('report-msg', `Impossibile creare il PDF: ${e.message || e}`, 'error');
    } finally {
        button.disabled = false;
    }
}

$('btn-pdf-save').addEventListener('click', () => runPdf($('btn-pdf-save'), async () => {
    const problems = validateCustomer();
    const file = await buildPdfFile();
    downloadFile(file);
    if (problems.length) showBoxMsg('report-msg', `PDF salvato, ma controlla: ${problems.join(', ')}.`, 'warn');
    else showBoxMsg('report-msg', `PDF salvato nei download: ${file.name}`, 'success');
}));

$('btn-pdf-share').addEventListener('click', () => runPdf($('btn-pdf-share'), async () => {
    const problems = validateCustomer();
    if (problems.length) showBoxMsg('report-msg', `Controlla: ${problems.join(', ')}. Il PDF viene creato lo stesso.`, 'warn');
    const file = await buildPdfFile();
    if (!navigator.canShare?.({ files: [file] })) {
        downloadFile(file);
        showBoxMsg('report-msg', `Condivisione non disponibile: PDF salvato nei download (${file.name})`, 'info');
        return;
    }
    try {
        await navigator.share({ files: [file], title: file.name });
    } catch (e) {
        if (e.name === 'AbortError') return; // annullato dall'utente
        if (e.name === 'NotAllowedError') {
            showBoxMsg('report-msg', 'La condivisione non è partita: premi di nuovo il pulsante.', 'error');
            return;
        }
        throw e;
    }
}));

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

function openMailto(url) {
    const a = el('a');
    a.href = url;
    document.body.append(a);
    a.click();
    a.remove();
}

function updateMailInfo() {
    const { list } = checkRecipients(loadSettings().email);
    $('mail-info').textContent = list.length ? `Destinatario: ${list.join(', ')}` : 'Nessun destinatario impostato (si imposta dalle impostazioni nella pagina iniziale).';
}

$('btn-pdf-email').addEventListener('click', () => runPdf($('btn-pdf-email'), async () => {
    const settings = loadSettings();
    const recipients = checkRecipients(settings.email);
    const problems = validateCustomer();
    const customer = readCustomer();
    const subject = buildSubject(currentReport, customer);
    const body = buildBody(currentReport, customer);
    const useShare = settings.method !== 'mailto' && canShareFiles();

    const notes = [];
    if (!recipients.list.length) notes.push('Nessun destinatario impostato: scrivilo in Gmail oppure impostalo dalle impostazioni nella pagina iniziale.');
    else if (!recipients.ok) notes.push(`${recipients.error}.`);
    if (problems.length) notes.push(`Controlla: ${problems.join(', ')}.`);
    // con la condivisione il destinatario non si può precompilare: lo si copia negli appunti
    if (useShare && recipients.list.length) {
        const copied = await navigator.clipboard?.writeText(recipients.list.join(', ')).then(() => true, () => false);
        if (copied) notes.push('Destinatario copiato negli appunti: nel campo "A" toccalo sopra la tastiera.');
    }
    const warn = !recipients.ok || problems.length > 0 || !recipients.list.length;
    if (notes.length) showBoxMsg('report-msg', notes.join(' '), warn ? 'warn' : 'info');

    const file = await buildPdfFile();
    if (useShare && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: subject, text: body });
        } catch (e) {
            if (e.name === 'AbortError') return; // annullato dall'utente
            if (e.name === 'NotAllowedError') {
                showBoxMsg('report-msg', 'La condivisione non è partita: premi di nuovo il pulsante.', 'error');
                return;
            }
            throw e;
        }
        return;
    }
    // Gmail con destinatario, oggetto e testo già compilati; un PDF non si può allegare da una pagina web
    downloadFile(file);
    showBoxMsg('report-msg', [`PDF salvato nei download (${file.name}): in Gmail tocca la graffetta e allegalo.`, ...notes].join(' '), 'info');
    openMailto(mailtoUrl(recipients.list, subject, body));
}));

// ---------------------------------------------------------------------------
// Impostazioni
// ---------------------------------------------------------------------------

// campi che si possono precompilare nei nuovi report
const FIELD_DEFS = [
    { key: 'name', label: 'Nome e cognome', capitalize: 'words' },
    { key: 'fiscalCode', label: 'Codice fiscale', capitalize: 'characters' },
    { key: 'address', label: 'Indirizzo', rows: 2, capitalize: 'words' },
    { key: 'phone', label: 'Telefono', type: 'tel' },
    { key: 'brand', label: 'Marca caldaia', capitalize: 'words' },
    { key: 'serial', label: 'Matricola / codice caldaia', capitalize: 'characters' },
    { key: 'plateCode', label: 'Targa impianto', capitalize: 'characters' },
    { key: 'installDate', label: 'Data di installazione', type: 'date' },
    { key: 'notes', label: 'Note', rows: 4, capitalize: 'sentences' },
];

function buildDefaultsForm() {
    const box = $('s-defaults');
    for (const def of FIELD_DEFS) {
        const label = el('label', 'field');
        label.append(el('span', null, def.label));
        const input = def.rows ? el('textarea') : el('input');
        input.id = `s-d-${def.key}`;
        if (def.rows) input.rows = def.rows;
        else input.type = def.type || 'text';
        input.autocomplete = 'off';
        if (def.capitalize) input.setAttribute('autocapitalize', def.capitalize);
        label.append(input);
        box.append(label);
    }
}

function fillSettings() {
    const s = loadSettings();
    $('s-email').value = s.email;
    for (const radio of document.querySelectorAll('input[name="s-method"]')) radio.checked = radio.value === s.method;
    for (const def of FIELD_DEFS) $(`s-d-${def.key}`).value = s.defaults[def.key] || '';
    $('s-email-hint').hidden = true;
}

function persistSettings() {
    const defaults = {};
    for (const def of FIELD_DEFS) {
        const value = $(`s-d-${def.key}`).value;
        if (value.trim()) defaults[def.key] = value;
    }
    saveSettings({
        email: $('s-email').value.trim(),
        method: document.querySelector('input[name="s-method"]:checked')?.value === 'mailto' ? 'mailto' : 'share',
        defaults,
    });
}

function openSettings() {
    fillSettings();
    show('settings');
}

buildDefaultsForm();
$('btn-settings').addEventListener('click', openSettings);
$('btn-settings-back').addEventListener('click', () => {
    persistSettings();
    if (history.state?.view === 'settings') history.back();
    else show('home');
});

let settingsTimer;
$('view-settings').addEventListener('input', () => {
    $('s-email-hint').hidden = true; // l'avviso riappare a campo finito
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(persistSettings, 300);
});
$('view-settings').addEventListener('change', () => {
    persistSettings();
    const r = checkRecipients($('s-email').value);
    $('s-email-hint').hidden = r.ok;
    $('s-email-hint').textContent = r.ok ? '' : r.error;
});

$('btn-defaults-clear').addEventListener('click', () => {
    if (!confirm('Svuotare tutti i dati predefiniti?')) return;
    for (const def of FIELD_DEFS) $(`s-d-${def.key}`).value = '';
    persistSettings();
});

renderHistory();
cleanupPhotos();
