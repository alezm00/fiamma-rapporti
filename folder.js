// Cartella di salvataggio: copia a senso unico (telefono -> cartella) di rapporti, foto e PDF.
// L'archivio principale resta quello del telefono (IndexedDB); la cartella serve da copia di sicurezza
// e per far leggere i PDF all'ufficio, sincronizzandola con Drive, Syncthing o altro.
// Funziona su qualunque FileSystemDirectoryHandle (da showDirectoryPicker, o la cartella privata nei test).
//
//   <cartella scelta>/Fiamma/
//       impostazioni.json, logo.jpg
//       rapporti/2026/2026-012_Mario-Rossi_ab12cd34/   (bozza: BOZZA_2026-10-22_Mario-Rossi_ab12cd34)
//           rapporto.json, rapporto.pdf (solo se chiuso), foto/01.jpg…

import * as db from './db.js';
import * as store from './store.js';
import { folderPath, normalizeReport } from './model.js';
import { listPhotos, photosForPdf, logoForPdf, getLogo, importPhoto, importLogo } from './photos.js';
import { createReportPdf } from './report.js';
import { loadSettings, saveSettings, updateSettings, mergeSettings } from './settings.js';

export const events = new EventTarget(); // 'state': cambia lo stato della copia
const emitState = () => events.dispatchEvent(new Event('state'));

// solo per i test: simula il permesso scaduto ('prompt') o negato
export const testing = { permission: null };

const ROOT = 'Fiamma';
const LEGACY_ROOT = 'TestoQR'; // nome della cartella nelle versioni con il nome precedente dell'app: il ripristino la legge ancora
const DELAY = 2000; // pausa dopo l'ultima modifica, prima di scrivere
const MODE = { mode: 'readwrite' };
const pad = (n) => String(n).padStart(2, '0');

export const supported = () => typeof globalThis.showDirectoryPicker === 'function';

// ---------------------------------------------------------------------------
// Stato salvato nel telefono: cartella collegata, coda delle modifiche, cosa è già scritto
// ---------------------------------------------------------------------------

const loadLink = async () => (await db.get(db.META, 'folder')) ?? null;
const loadQueue = async () => (await db.get(db.META, 'folderQueue'))?.items ?? {};
const saveQueue = (items) => db.put(db.META, { key: 'folderQueue', items });
const freshIndex = () => ({ key: 'folderIndex', reports: {}, logo: '', root: ROOT });
const loadIndex = async () => (await db.get(db.META, 'folderIndex')) ?? freshIndex();
const saveIndex = (index) => db.put(db.META, index);

let linked = false;
let lastError = '';
let running = null;
let again = false;
let restoring = false;
let timer = null;
let version = 0;
let withSettings = false; // la prossima scrittura include le impostazioni anche senza rapporti in coda

async function permissionOf(handle) {
    if (testing.permission) return testing.permission;
    try {
        return await handle.queryPermission(MODE);
    } catch {
        return 'denied';
    }
}

// Stato per la schermata: collegata / sospesa (serve un tocco) / non collegata
export async function status() {
    const link = await loadLink();
    const pending = Object.keys(await loadQueue()).length;
    return {
        supported: supported(),
        linked: !!link,
        name: link?.name ?? '',
        permission: link ? await permissionOf(link.handle) : null,
        pending,
        lastWrite: link?.lastWrite ?? 0,
        error: lastError,
    };
}

// ---------------------------------------------------------------------------
// Scrittura di file e cartelle
// ---------------------------------------------------------------------------

async function dir(parent, names, create = true) {
    let d = parent;
    for (const name of names) d = await d.getDirectoryHandle(name, { create });
    return d;
}

async function writeFile(parent, name, data) {
    const handle = await parent.getFileHandle(name, { create: true });
    const w = await handle.createWritable();
    try {
        await w.write(data);
        await w.close();
    } catch (e) {
        await w.abort().catch(() => {});
        throw e;
    }
}

async function readFile(parent, name) {
    return (await parent.getFileHandle(name)).getFile();
}

const missing = (e) => e?.name === 'NotFoundError' || e?.name === 'TypeMismatchError';

async function removeDir(parent, name) {
    try {
        await parent.removeEntry(name, { recursive: true });
    } catch (e) {
        if (!missing(e)) throw e;
    }
}

async function subdirs(parent) {
    const out = [];
    for await (const [name, handle] of parent.entries()) if (handle.kind === 'directory') out.push([name, handle]);
    return out;
}

const id8 = (id) => String(id).replace(/[^A-Za-z0-9]/g, '').slice(0, 8);

// ---------------------------------------------------------------------------
// Un rapporto nella cartella
// ---------------------------------------------------------------------------

async function writeReport(link, id) {
    const doc = await store.getReport(id);
    if (!doc || doc.deletedAt) return removeReport(link, id); // eliminato o nel cestino: via anche dalla cartella
    const { year, dir: name } = folderPath(doc);
    const years = await dir(link.handle, [ROOT, 'rapporti', year]);
    const index = await loadIndex();
    const prev = index.reports[id];

    // il rapporto ha cambiato nome o anno (la bozza prende il numero alla chiusura): via la cartella vecchia
    if (prev && (prev.year !== year || prev.dir !== name)) {
        const old = await dir(link.handle, [ROOT, 'rapporti', prev.year], false).catch(() => null);
        if (old) await removeDir(old, prev.dir);
    }
    for (const [other] of await subdirs(years)) {
        if (other !== name && other.endsWith(`_${id8(id)}`)) await removeDir(years, other);
    }

    const d = await years.getDirectoryHandle(name, { create: true });
    const photos = await listPhotos(id);
    const sig = photos.map((p) => p.id).join(',');
    if (!prev || prev.year !== year || prev.dir !== name || prev.photos !== sig) {
        await removeDir(d, 'foto');
        if (photos.length) {
            const fd = await d.getDirectoryHandle('foto', { create: true });
            for (const [i, p] of photos.entries()) await writeFile(fd, `${pad(i + 1)}.jpg`, p.blob);
        }
    }
    const file = { ...doc, photos: photos.map((p, i) => ({ id: p.id, file: `foto/${pad(i + 1)}.jpg`, width: p.width, height: p.height, addedAt: p.addedAt })) };
    await writeFile(d, 'rapporto.json', JSON.stringify(file, null, 2));
    index.reports[id] = { year, dir: name, photos: sig };
    await saveIndex(index);

    if (doc.status !== 'draft') {
        const bytes = await createReportPdf(doc, loadSettings(), { photos: await photosForPdf(id), logo: await logoForPdf() });
        await writeFile(d, 'rapporto.pdf', bytes);
    }
}

async function removeReport(link, id) {
    const index = await loadIndex();
    const prev = index.reports[id];
    if (prev) {
        const years = await dir(link.handle, [ROOT, 'rapporti', prev.year], false).catch(() => null);
        if (years) await removeDir(years, prev.dir);
        delete index.reports[id];
        await saveIndex(index);
        return;
    }
    // senza traccia (dopo un ripristino): si cerca per id in tutti gli anni
    const rapporti = await dir(link.handle, [ROOT, 'rapporti'], false).catch(() => null);
    if (!rapporti) return;
    for (const [, years] of await subdirs(rapporti)) {
        for (const [name] of await subdirs(years)) if (name.endsWith(`_${id8(id)}`)) await removeDir(years, name);
    }
}

// impostazioni e logo (senza la data dell'ultimo backup, che è di questo telefono)
async function writeSettings(link) {
    const root = await dir(link.handle, [ROOT]);
    // le impostazioni già in cartella non si perdono: su un telefono nuovo, collegare la cartella
    // prima del ripristino non deve sovrascriverle con quelle vuote
    let existing = null;
    try {
        existing = JSON.parse(await (await readFile(root, 'impostazioni.json')).text());
    } catch {}
    const { lastBackup, ...settings } = mergeSettings(loadSettings(), existing);
    const logo = await getLogo();
    await writeFile(root, 'impostazioni.json', JSON.stringify({ ...settings, logo: logo ? { width: logo.width, height: logo.height } : null }, null, 2));
    const index = await loadIndex();
    const sig = logo ? String(logo.blob.size) : '';
    if (sig !== index.logo) {
        if (logo) await writeFile(root, 'logo.jpg', logo.blob);
        else await root.removeEntry('logo.jpg').catch(() => {});
        index.logo = sig;
        await saveIndex(index);
    }
}

// ---------------------------------------------------------------------------
// Coda delle modifiche: resta sul telefono finché la cartella non è raggiungibile
// ---------------------------------------------------------------------------

async function enqueue(id, op) {
    const items = await loadQueue();
    items[id] = { op, v: ++version + Date.now() };
    await saveQueue(items);
    schedule();
    emitState();
}

function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => process(), DELAY);
}

// scrive quello che è in coda; si ferma se manca il permesso (la coda resta)
export function process() {
    clearTimeout(timer);
    if (running) {
        again = true;
        return running;
    }
    running = (async () => {
        try {
            const link = await loadLink();
            if (!link || (await permissionOf(link.handle)) !== 'granted') return;
            lastError = '';
            let wrote = false;
            for (const [id, item] of Object.entries(await loadQueue())) {
                try {
                    if (item.op === 'delete') await removeReport(link, id);
                    else await writeReport(link, id);
                } catch (e) {
                    lastError = explain(e);
                    break;
                }
                const items = await loadQueue();
                if (items[id]?.v === item.v) delete items[id]; // modificato di nuovo nel frattempo: resta in coda
                await saveQueue(items);
                wrote = true;
            }
            if ((wrote || withSettings) && !lastError) {
                withSettings = false;
                wrote = true;
                try {
                    await writeSettings(link);
                } catch (e) {
                    lastError = explain(e);
                }
            }
            const current = await loadLink();
            if (wrote && !lastError && current) {
                const now = Date.now();
                await db.put(db.META, { ...current, lastWrite: now });
                updateSettings({ lastBackup: now });
            }
        } finally {
            running = null;
            emitState();
            if (again) {
                again = false;
                schedule(); // altre modifiche arrivate durante la scrittura
            }
        }
    })();
    return running;
}

export function explain(e) {
    switch (e?.name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return 'Il telefono non permette di scrivere nella cartella: riattiva il permesso.';
        case 'QuotaExceededError':
            return 'Memoria piena: libera spazio e riprova.';
        case 'NotFoundError':
            return 'La cartella non si trova più: scegline un\'altra.';
        case 'InvalidStateError':
        case 'NoModificationAllowedError':
            return 'Un file nella cartella è bloccato (forse da un\'app di sincronizzazione): riprova tra poco.';
        default:
            return e?.message || String(e);
    }
}

// ---------------------------------------------------------------------------
// Collegare, riattivare, scollegare
// ---------------------------------------------------------------------------

// Collega una cartella (da usare con un tocco dell'utente) e la riempie con tutti i rapporti.
export async function link() {
    let handle;
    try {
        handle = await globalThis.showDirectoryPicker({ id: 'testoqr', ...MODE });
    } catch (e) {
        if (e.name === 'AbortError') return false; // annullato
        throw e;
    }
    await linkHandle(handle);
    return true;
}

export async function linkHandle(handle) {
    await db.put(db.META, { key: 'folder', handle, name: handle.name, linkedAt: Date.now(), lastWrite: 0 });
    await db.put(db.META, freshIndex());
    linked = true;
    lastError = '';
    await syncAll();
}

// mette in coda tutti i rapporti (anche a cartella sospesa: partono alla riattivazione)
export async function syncAll() {
    const items = await loadQueue();
    for (const doc of await store.listReports()) items[doc.id] = { op: 'save', v: ++version + Date.now() };
    await saveQueue(items);
    withSettings = true;
    emitState();
    return process();
}

// chiede di nuovo il permesso (serve un tocco dell'utente) e scrive quello che è in coda
export async function reactivate() {
    const link = await loadLink();
    if (!link) return 'denied';
    let permission = await permissionOf(link.handle);
    if (permission !== 'granted') {
        if (testing.permission) permission = testing.permission = 'granted';
        else permission = await link.handle.requestPermission(MODE).catch(() => 'denied');
    }
    emitState();
    if (permission === 'granted') await process();
    return permission;
}

export async function unlink() {
    clearTimeout(timer);
    linked = false;
    lastError = '';
    for (const key of ['folder', 'folderQueue', 'folderIndex']) await db.remove(db.META, key);
    emitState();
}

// Scrive e rilegge un file di prova: dice subito se la cartella funziona su questo telefono.
export async function test() {
    const link = await loadLink();
    if (!link) throw new Error('Nessuna cartella collegata');
    if ((await reactivate()) !== 'granted') throw new Error('Permesso non concesso: tocca "Riattiva" e consenti l\'accesso.');
    const root = await dir(link.handle, [ROOT]);
    const text = `Prova di Fiamma ${new Date().toISOString()}`;
    await writeFile(root, 'prova.txt', text);
    const back = await (await readFile(root, 'prova.txt')).text();
    await root.removeEntry('prova.txt').catch(() => {});
    if (back !== text) throw new Error('Il file scritto non corrisponde a quello riletto');
    return true;
}

// ---------------------------------------------------------------------------
// Ripristino dalla cartella: unisce i rapporti trovati a quelli del telefono
// ---------------------------------------------------------------------------

// Legge i rapporti di una cartella (Fiamma, o TestoQR del nome precedente) e li unisce a quelli del telefono
async function restoreRoot(root, result) {
    const rapporti = await dir(root, ['rapporti'], false).catch(() => null);
    for (const [, years] of rapporti ? await subdirs(rapporti) : []) {
        for (const [, d] of await subdirs(years)) {
            let raw;
            try {
                raw = JSON.parse(await (await readFile(d, 'rapporto.json')).text());
            } catch {
                result.skipped++;
                continue;
            }
            const doc = normalizeReport(raw);
            if (!doc) {
                result.skipped++;
                continue;
            }
            if (await store.importReport(doc)) result.reports++;
            const fotoDir = await d.getDirectoryHandle('foto').catch(() => null);
            for (const p of Array.isArray(raw.photos) ? raw.photos : []) {
                if (!fotoDir || !/^[\w.-]+\.jpg$/.test(String(p?.file).replace(/^foto\//, ''))) continue;
                try {
                    const blob = await readFile(fotoDir, p.file.replace(/^foto\//, ''));
                    if (await importPhoto({ id: p.id, reportId: doc.id, blob, width: p.width, height: p.height, addedAt: p.addedAt })) result.photos++;
                } catch {}
            }
        }
    }
    try {
        const settings = JSON.parse(await (await readFile(root, 'impostazioni.json')).text());
        saveSettings(mergeSettings(loadSettings(), settings));
        const size = settings.logo;
        if (size) await importLogo(await readFile(root, 'logo.jpg'), size.width, size.height);
    } catch (e) {
        if (!missing(e) && !(e instanceof SyntaxError)) throw e;
    }
}

export async function restore() {
    const link = await loadLink();
    if (!link) throw new Error('Nessuna cartella collegata');
    if ((await reactivate()) !== 'granted') throw new Error('Permesso non concesso: tocca "Riattiva" e consenti l\'accesso.');
    const roots = [];
    for (const name of [ROOT, LEGACY_ROOT]) {
        try {
            roots.push(await dir(link.handle, [name], false));
        } catch (e) {
            if (!missing(e)) throw e;
        }
    }
    if (!roots.length) throw new Error(`Nella cartella non c'è ancora nessuna copia (manca la cartella ${ROOT}).`);
    const result = { reports: 0, photos: 0, skipped: 0 };
    restoring = true; // i rapporti letti dalla cartella non vanno riscritti nella cartella
    try {
        for (const root of roots) await restoreRoot(root, result);
    } finally {
        restoring = false;
    }
    return result;
}

// ---------------------------------------------------------------------------
// Avvio: ogni modifica ai rapporti finisce in coda
// ---------------------------------------------------------------------------

export async function start() {
    linked = !!(await loadLink());
    store.events.addEventListener('change', (e) => {
        if (!linked || restoring) return;
        enqueue(e.detail.id, e.detail.type === 'delete' ? 'delete' : 'save');
    });
    // la copia fatta con il nome precedente sta in un'altra cartella: si ricopia tutto in quella nuova
    // (la vecchia resta dov'è, si può eliminare)
    if (linked && ((await loadIndex()).root ?? LEGACY_ROOT) !== ROOT) {
        await saveIndex(freshIndex());
        syncAll();
    } else if (linked && Object.keys(await loadQueue()).length) schedule();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && linked) {
            emitState();
            if (!lastError) process();
        }
    });
}
