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

export async function listReports() {
    return model.sortReports(await db.getAll(db.REPORTS));
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

export async function deleteReport(id) {
    await removeReportPhotos(id);
    await db.remove(db.REPORTS, id);
    emit('delete', id);
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
