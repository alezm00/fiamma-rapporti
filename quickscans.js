// Scansioni rapide: le ultime 20 letture, solo per rivedere i valori da ricopiare.
// Stanno nel localStorage del telefono; non hanno dati del cliente né foto.

const KEY = 'testoqr.scans';
export const MAX_SCANS = 20;

// FNV-1a: identificativo per le misure senza uuid
function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(16);
}

export function loadScans() {
    try {
        const list = JSON.parse(localStorage.getItem(KEY));
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function save(list) {
    try {
        localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SCANS)));
    } catch {}
}

export const getScan = (id) => loadScans().find((s) => s.id === id);

// riscansionando lo stesso QR la voce sale in cima senza duplicarsi
export function addScan(json, report, now = Date.now()) {
    const id = report.uuid || hash(JSON.stringify(json));
    const entry = { id, savedAt: now, json };
    save([entry, ...loadScans().filter((s) => s.id !== id)]);
    return entry;
}

export const removeScan = (id) => save(loadScans().filter((s) => s.id !== id));
export const clearScans = () => save([]);
