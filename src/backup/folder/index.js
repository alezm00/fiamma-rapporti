// Cartella di salvataggio: copia a senso unico (telefono -> cartella) di rapporti, foto e PDF.
// L'archivio principale resta quello del telefono (IndexedDB); la cartella serve da copia di sicurezza
// e per far leggere i PDF all'ufficio, sincronizzandola con Drive, Syncthing o altro.
// Funziona su qualunque FileSystemDirectoryHandle (da showDirectoryPicker, o la cartella privata nei test).
//
//   <cartella scelta>/Fiamma/
//       impostazioni.json, logo.jpg
//       rapporti/2026/2026-012_Mario-Rossi_ab12cd34/   (bozza: BOZZA_2026-10-22_Mario-Rossi_ab12cd34)
//           rapporto.json, rapporto.pdf (solo se chiuso), foto/01.jpg…

import * as db from '../../data/db.js';
import * as store from '../../data/store.js';
import { folderPath, normalizeReport } from '../../model/index.js';
import { pad } from '../../lib/dates.js';
import { listPhotos, photosForPdf, logoForPdf, getLogo, importPhoto, importLogo } from '../../data/photos.js';
import { createReportPdf } from '../../pdf/index.js';
import { loadSettings, saveSettings, updateSettings, mergeSettings, normalizeSettings } from '../../data/settings.js';

export const events = new EventTarget(); // 'state': cambia lo stato della copia
const emitState = () => events.dispatchEvent(new Event('state'));

// solo per i test: simula il permesso scaduto ('prompt') o negato
export const testing = { permission: null };

const ROOT = 'Fiamma';
const DELAY = 2000; // pausa dopo l'ultima modifica, prima di scrivere
const MODE = { mode: 'readwrite' };

export const supported = () => typeof globalThis.showDirectoryPicker === 'function';

// ---------------------------------------------------------------------------
// Stato salvato nel telefono: cartella collegata, coda delle modifiche, cosa è già scritto
// ---------------------------------------------------------------------------

const loadLink = async () => (await db.get(db.META, 'folder')) ?? null;
const loadQueue = async () => (await db.get(db.META, 'folderQueue'))?.items ?? {};
const saveQueue = (items) => db.put(db.META, { key: 'folderQueue', items });
const freshIndex = () => ({ key: 'folderIndex', reports: {}, logo: '' });
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

// Un File preso dalla cartella dipende dal file che sta nella cartella: se poi lo riscrivi (o cambia) non si legge più.
// Quello che si tiene sul telefono (foto, logo) si copia quindi in memoria.
async function memoryCopy(file) {
    return new Blob([await file.arrayBuffer()], { type: 'image/jpeg' });
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
    // come per le impostazioni, il logo già in cartella non si perde se qui non c'è
    const logoInfo = logo ? { width: logo.width, height: logo.height } : (existing?.logo ?? null);
    await writeFile(root, 'impostazioni.json', JSON.stringify({ ...settings, logo: logoInfo }, null, 2));
    if (logo) {
        const index = await loadIndex();
        const sig = String(logo.blob.size);
        if (sig !== index.logo) {
            await writeFile(root, 'logo.jpg', logo.blob);
            index.logo = sig;
            await saveIndex(index);
        }
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

// Fa scegliere la cartella con il selettore di sistema (serve un tocco dell'utente). null se si annulla.
export async function pick() {
    try {
        return await globalThis.showDirectoryPicker({ id: 'testoqr', ...MODE });
    } catch (e) {
        if (e.name === 'AbortError') return null;
        throw e;
    }
}

// Le impostazioni già salvate in una cartella (di solito da un altro telefono):
// { settings, logo, modified } oppure null se non ce ne sono (o il file non si legge).
export async function peekSettings(handle) {
    try {
        const root = await dir(handle, [ROOT], false);
        const file = await readFile(root, 'impostazioni.json');
        const raw = JSON.parse(await file.text());
        return { settings: normalizeSettings(raw), logo: raw?.logo ?? null, modified: file.lastModified };
    } catch (e) {
        if (missing(e) || e instanceof SyntaxError) return null;
        throw e;
    }
}

// Prende le impostazioni dalla cartella al posto di quelle del telefono (ditta, email, numerazione, logo).
// Il numero progressivo non torna mai indietro: per ogni anno vale il più alto.
async function takeSettingsFrom(handle) {
    const found = await peekSettings(handle);
    if (!found) return false;
    const local = loadSettings();
    const counters = { ...found.settings.counters };
    for (const [year, n] of Object.entries(local.counters)) counters[year] = Math.max(counters[year] || 0, n);
    saveSettings({ ...found.settings, counters, lastBackup: local.lastBackup });
    if (found.logo) {
        try {
            const root = await dir(handle, [ROOT], false);
            await importLogo(await memoryCopy(await readFile(root, 'logo.jpg')), found.logo.width, found.logo.height, { replace: true });
        } catch (e) {
            if (!missing(e)) throw e; // senza il file del logo si tiene quello che c'è
        }
    }
    return true;
}

// Collega la cartella scelta e la riempie con tutti i rapporti.
// fromFolder = true: prima prende le impostazioni salvate nella cartella (vedi takeSettingsFrom).
export async function linkHandle(handle, { fromFolder = false } = {}) {
    if (fromFolder) await takeSettingsFrom(handle);
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

// Legge i rapporti della cartella Fiamma e li unisce a quelli del telefono
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
                    const blob = await memoryCopy(await readFile(fotoDir, p.file.replace(/^foto\//, '')));
                    if (await importPhoto({ id: p.id, reportId: doc.id, blob, width: p.width, height: p.height, addedAt: p.addedAt })) result.photos++;
                } catch {}
            }
        }
    }
    try {
        const settings = JSON.parse(await (await readFile(root, 'impostazioni.json')).text());
        saveSettings(mergeSettings(loadSettings(), settings));
        const size = settings.logo;
        if (size) await importLogo(await memoryCopy(await readFile(root, 'logo.jpg')), size.width, size.height);
    } catch (e) {
        if (!missing(e) && !(e instanceof SyntaxError)) throw e;
    }
}

export async function restore() {
    const link = await loadLink();
    if (!link) throw new Error('Nessuna cartella collegata');
    if ((await reactivate()) !== 'granted') throw new Error('Permesso non concesso: tocca "Riattiva" e consenti l\'accesso.');
    let root;
    try {
        root = await dir(link.handle, [ROOT], false);
    } catch (e) {
        if (missing(e)) throw new Error(`Nella cartella non c'è ancora nessuna copia (manca la cartella ${ROOT}).`);
        throw e;
    }
    const result = { reports: 0, photos: 0, skipped: 0 };
    restoring = true; // i rapporti letti dalla cartella non vanno riscritti nella cartella
    try {
        await restoreRoot(root, result);
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
    if (linked && Object.keys(await loadQueue()).length) schedule();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && linked) {
            emitState();
            if (!lastError) process();
        }
    });
}
