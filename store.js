// Rapporti salvati sul telefono. Ogni modifica avvisa chi è in ascolto (es. la copia nella cartella).

import * as db from './db.js';
import * as model from './model.js';
import { loadSettings, saveSettings } from './settings.js';
import { removeReportPhotos } from './photos.js';

export const events = new EventTarget(); // 'change': { detail: { type: 'save' | 'delete', id } }
const emit = (type, id) => events.dispatchEvent(new CustomEvent('change', { detail: { type, id } }));

let persistAsked = false;
function askPersistence() {
    if (persistAsked) return;
    persistAsked = true;
    navigator.storage?.persist?.().catch(() => {}); // il telefono non deve cancellare i dati se manca spazio
}

// i rapporti nel cestino non compaiono nell'elenco
export async function listReports() {
    return model.sortReports((await db.getAll(db.REPORTS)).filter((r) => !r.deletedAt));
}

// nel cestino, dal più recente
export async function listTrash() {
    return (await db.getAll(db.REPORTS)).filter((r) => r.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt);
}

export const getReport = (id) => db.get(db.REPORTS, id);

// nuova bozza, con i dati predefiniti delle impostazioni
export async function createReport() {
    askPersistence();
    const doc = model.newReport({ defaults: loadSettings().defaults });
    await db.put(db.REPORTS, doc);
    emit('save', doc.id);
    return doc;
}

// salva un rapporto modificato (edit = false per i cambi di stato, che non lo "riaprono")
export async function saveReport(doc, { edit = true } = {}) {
    if (edit) model.applyEdit(doc);
    await db.put(db.REPORTS, doc);
    emit('save', doc.id);
    return doc;
}

// Eliminazione definitiva: il rapporto e le sue foto. Il numero già assegnato non si riusa.
export async function purgeReport(id) {
    await removeReportPhotos(id);
    await db.remove(db.REPORTS, id);
    emit('delete', id);
}

// Nel cestino per TRASH_DAYS giorni. Stato e numero non cambiano; updatedAt sì, così la mossa
// vince su una copia più vecchia (ripristino da backup o cartella).
export async function trashReport(id, now = Date.now()) {
    const doc = await getReport(id);
    if (!doc) return null;
    doc.deletedAt = now;
    doc.updatedAt = now;
    await db.put(db.REPORTS, doc);
    emit('save', id);
    return doc;
}

export async function restoreReport(id, now = Date.now()) {
    const doc = await getReport(id);
    if (!doc) return null;
    doc.deletedAt = null;
    doc.updatedAt = now;
    await db.put(db.REPORTS, doc);
    emit('save', id);
    return doc;
}

// toglie dal cestino, per sempre, quello che ci sta da più di TRASH_DAYS giorni
export async function purgeExpired(now = Date.now()) {
    let n = 0;
    for (const doc of await listTrash()) {
        if (model.isExpired(doc, now)) {
            await purgeReport(doc.id);
            n++;
        }
    }
    return n;
}

export async function duplicate(doc) {
    const copy = model.duplicateReport(doc);
    await db.put(db.REPORTS, copy);
    emit('save', copy.id);
    return copy;
}

// chiude la bozza e assegna il numero progressivo
export async function close(doc) {
    const settings = loadSettings();
    const counters = model.closeReport(doc, settings.counters);
    saveSettings({ ...settings, counters });
    return saveReport(doc, { edit: false });
}

// dopo l'invio dell'email o la condivisione
export async function markSent(doc) {
    if (model.markSent(doc)) await saveReport(doc, { edit: false });
    return doc;
}

// per il ripristino da cartella o backup: se esiste già, vince la modifica più recente
export async function importReport(doc) {
    const old = await getReport(doc.id);
    if (old && old.updatedAt >= doc.updatedAt) return false;
    await db.put(db.REPORTS, doc);
    emit('save', doc.id);
    return true;
}
