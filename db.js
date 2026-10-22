// Archivio del telefono (IndexedDB). Database nuovo, indipendente da quello delle versioni precedenti.
// Se IndexedDB non è disponibile (es. navigazione privata) i dati durano finché l'app resta aperta.

const DB_NAME = 'testoqr-reports';
const DB_VERSION = 1;

export const REPORTS = 'reports'; // rapporti di intervento
export const PHOTOS = 'photos'; // foto dei rapporti (indice: reportId)
export const META = 'meta'; // impostazioni interne: logo, cartella di salvataggio, coda

let dbPromise = null;
let useMemory = false;
const memory = { [REPORTS]: new Map(), [PHOTOS]: new Map(), [META]: new Map() };
const KEY_PATH = { [REPORTS]: 'id', [PHOTOS]: 'id', [META]: 'key' };

export const usingMemory = () => useMemory;

function openDb() {
    dbPromise ||= new Promise((resolve, reject) => {
        if (!globalThis.indexedDB) {
            reject(new Error('IndexedDB non disponibile'));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const d = req.result;
            d.createObjectStore(REPORTS, { keyPath: 'id' });
            d.createObjectStore(PHOTOS, { keyPath: 'id' }).createIndex('reportId', 'reportId');
            d.createObjectStore(META, { keyPath: 'key' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('IndexedDB bloccato'));
    });
    return dbPromise;
}

async function db() {
    if (useMemory) return null;
    try {
        return await openDb();
    } catch {
        useMemory = true;
        return null;
    }
}

const request = (req) => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});

// esegue le scritture e attende la fine della transazione
function write(d, store, fn) {
    return new Promise((resolve, reject) => {
        const tx = d.transaction(store, 'readwrite');
        fn(tx.objectStore(store));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

export async function getAll(store) {
    const d = await db();
    return d ? request(d.transaction(store).objectStore(store).getAll()) : [...memory[store].values()];
}

export async function get(store, key) {
    const d = await db();
    return d ? request(d.transaction(store).objectStore(store).get(key)) : memory[store].get(key);
}

export async function put(store, value) {
    const d = await db();
    if (d) await write(d, store, (s) => s.put(value));
    else memory[store].set(value[KEY_PATH[store]], value);
}

export async function remove(store, key) {
    const d = await db();
    if (d) await write(d, store, (s) => s.delete(key));
    else memory[store].delete(key);
}

// record con un certo valore dell'indice (solo PHOTOS / reportId)
export async function getByIndex(store, index, key) {
    const d = await db();
    if (d) return request(d.transaction(store).objectStore(store).index(index).getAll(key));
    return [...memory[store].values()].filter((v) => v[index] === key);
}

export async function removeByIndex(store, index, key) {
    const d = await db();
    if (!d) {
        for (const [k, v] of memory[store]) if (v[index] === key) memory[store].delete(k);
        return;
    }
    await write(d, store, (s) => {
        const req = s.index(index).openKeyCursor(IDBKeyRange.only(key));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            s.delete(cursor.primaryKey);
            cursor.continue();
        };
    });
}

export async function clear(store) {
    const d = await db();
    if (d) await write(d, store, (s) => s.clear());
    else memory[store].clear();
}
