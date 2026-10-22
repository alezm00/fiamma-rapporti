// Foto del report: ridimensionate e salvate sul telefono (IndexedDB), una raccolta per ogni scansione.
// Se IndexedDB non è disponibile (es. navigazione privata) le foto durano finché l'app resta aperta.

const DB_NAME = 'testoqr';
const STORE = 'photos';
const MAX_SIDE = 1280; // lato lungo in pixel: basta per un PDF leggibile e leggero da inviare
const QUALITY = 0.8;

let dbPromise = null;
let useMemory = false;
const memory = [];

function openDb() {
    dbPromise ||= new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB non disponibile'));
            return;
        }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('entryId', 'entryId');
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
function write(d, fn) {
    return new Promise((resolve, reject) => {
        const tx = d.transaction(STORE, 'readwrite');
        fn(tx.objectStore(STORE));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

// ---------------------------------------------------------------------------
// Ridimensionamento
// ---------------------------------------------------------------------------

async function decode(file) {
    try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' }); // rispetta la rotazione della fotocamera
    } catch {
        const url = URL.createObjectURL(file);
        try {
            const img = new Image();
            img.src = url;
            await img.decode();
            return img;
        } catch {
            throw new Error('Formato immagine non supportato');
        } finally {
            URL.revokeObjectURL(url);
        }
    }
}

async function compress(file) {
    const img = await decode(file);
    const srcW = img.width || img.naturalWidth;
    const srcH = img.height || img.naturalHeight;
    const k = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
    const width = Math.max(1, Math.round(srcW * k));
    const height = Math.max(1, Math.round(srcH * k));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // PNG trasparenti: sfondo bianco
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    img.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob) throw new Error('Impossibile elaborare la foto');
    return { blob, width, height };
}

// ---------------------------------------------------------------------------
// Archivio
// ---------------------------------------------------------------------------

export async function listPhotos(entryId) {
    const d = await db();
    const all = d
        ? await request(d.transaction(STORE).objectStore(STORE).index('entryId').getAll(entryId))
        : memory.filter((p) => p.entryId === entryId);
    return all.sort((a, b) => a.addedAt - b.addedAt);
}

export async function addPhoto(entryId, file) {
    const { blob, width, height } = await compress(file);
    const photo = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, entryId, blob, width, height, addedAt: Date.now() };
    const d = await db();
    if (d) await write(d, (store) => store.put(photo));
    else memory.push(photo);
    return photo;
}

export async function removePhoto(id) {
    const d = await db();
    if (d) await write(d, (store) => store.delete(id));
    else memory.splice(0, memory.length, ...memory.filter((p) => p.id !== id));
}

// elimina le foto delle scansioni che non sono più nello storico
export async function keepPhotosOf(entryIds) {
    const ids = new Set(entryIds);
    const d = await db();
    if (!d) {
        memory.splice(0, memory.length, ...memory.filter((p) => ids.has(p.entryId)));
        return;
    }
    await write(d, (store) => {
        const req = store.index('entryId').openKeyCursor();
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            if (!ids.has(cursor.key)) store.delete(cursor.primaryKey);
            cursor.continue();
        };
    });
}
