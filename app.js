import { bytesToJson, buildReport, reportToText, formatDate } from './tjf.js';

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
    const old = list.find((e) => e.id === id);
    const entry = { id, savedAt: Date.now(), json, done: old?.done || [] };
    saveHistory([entry, ...list.filter((e) => e.id !== id)]);
    return entry;
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
        open.append(el('span', 'h-meta', [formatDate(report.start || new Date(entry.savedAt)), fuel?.value].filter(Boolean).join(' · ')));
        const first = report.columns[0];
        const vals = report.rows.slice(0, 4).map((r) => `${r.short || r.label} ${r.cells[first] ?? ''}`).join(' · ');
        if (vals) open.append(el('span', 'h-vals', vals));
        open.addEventListener('click', () => openEntry(entry));

        const del = el('button', 'hdel', '✕');
        del.setAttribute('aria-label', 'Elimina');
        del.addEventListener('click', () => {
            if (!confirm(`Eliminare "${report.title}"?`)) return;
            saveHistory(loadHistory().filter((e) => e.id !== entry.id));
            renderHistory();
        });
        li.append(open, del);
        ul.append(li);
    }
}

$('btn-clear').addEventListener('click', () => {
    if (!confirm('Cancellare tutte le scansioni salvate?')) return;
    saveHistory([]);
    renderHistory();
});

// ---------------------------------------------------------------------------
// Navigazione tra le viste (il tasto "indietro" di Android torna alla home)
// ---------------------------------------------------------------------------

let current = 'home';

function show(view) {
    if (current === 'scan' && view !== 'scan') stopScan();
    for (const v of ['home', 'scan', 'result']) $(`view-${v}`).hidden = v !== view;
    if (view !== 'home') {
        if (current === 'home') history.pushState({ view }, '');
        else history.replaceState({ view }, '');
    }
    current = view;
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
    if (current !== 'home') show('home');
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
    const done = new Set(entry.done || []);
    for (const row of r.rows) {
        const div = el('div', 'vrow');
        div.setAttribute('role', 'button');
        div.classList.toggle('done', done.has(row.key));
        const label = el('div', 'vlabel');
        const code = el('span', 'vcode');
        code.append(el('span', 'check', '✓'), document.createTextNode(row.short || row.label));
        label.append(code);
        if (row.short && row.short !== row.label) label.append(el('span', 'vname', row.label));
        // segno meno tipografico: più leggibile del trattino
        div.append(label, ...cols.map((c) => el('div', 'vnum', (row.cells[c] ?? '').replace(/^-(?=\d)/, '\u2212'))), el('div', 'vunit', row.unit));
        div.addEventListener('click', () => {
            const on = div.classList.toggle('done');
            if (on) done.add(row.key);
            else done.delete(row.key);
            entry.done = [...done];
            updateEntry(entry);
        });
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

renderHistory();
