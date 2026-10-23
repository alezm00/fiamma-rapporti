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
import { updateSettings } from '../../data/settings.js';
import { ROOT, dir, writeFile, readFile, missing } from './files.js';
import { loadLink, loadQueue, saveQueue, freshIndex } from './state.js';
import { writeReport, removeReport } from './writer.js';
import { peekSettings, takeSettingsFrom, writeSettings } from './settings-file.js';
import { restoreRoot } from './restore.js';

export { peekSettings };

export const events = new EventTarget(); // 'state': cambia lo stato della copia
const emitState = () => events.dispatchEvent(new Event('state'));

// solo per i test: simula il permesso scaduto ('prompt') o negato
export const testing = { permission: null };

const DELAY = 2000; // pausa dopo l'ultima modifica, prima di scrivere
const MODE = { mode: 'readwrite' };

export const supported = () => typeof globalThis.showDirectoryPicker === 'function';

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
