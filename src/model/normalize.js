// Dati letti da fuori (cartella di salvataggio, backup): si rifà un rapporto pulito.

import { newReport, STATUSES } from './report.js';
import { normalizePlant } from './units.js';
import { newId, isId, text, time, isObject } from './values.js';

// Restituisce un rapporto con tutti i campi del tipo giusto, oppure null se non è un rapporto.
export function normalizeReport(raw) {
    if (!isObject(raw) || !isId(raw.id)) return null;
    const createdAt = time(raw.createdAt, Date.now());
    const doc = newReport({ id: raw.id, now: new Date(createdAt) });
    doc.status = Object.hasOwn(STATUSES, raw.status) ? raw.status : 'draft';
    doc.number = doc.status !== 'draft' && /^\d{4}\/\d{3,}$/.test(raw.number ?? '') ? raw.number : null;
    if (!doc.number) doc.status = 'draft';
    doc.date = /^\d{4}-\d{2}-\d{2}$/.test(raw.date ?? '') ? raw.date : doc.date;
    doc.updatedAt = time(raw.updatedAt, createdAt);
    doc.closedAt = time(raw.closedAt, null);
    doc.sentAt = time(raw.sentAt, null);
    doc.deletedAt = time(raw.deletedAt, null);
    for (const k of Object.keys(doc.customer)) doc.customer[k] = text(raw.customer?.[k], 2000);
    doc.plant = normalizePlant(raw.plant);
    const w = raw.intervention ?? {};
    for (const k of ['type', 'outcome', 'work', 'startTime', 'endTime', 'notes']) doc.intervention[k] = text(w[k]);
    doc.intervention.materials = (Array.isArray(w.materials) ? w.materials : []).slice(0, 200)
        .filter(isObject).map((m) => ({ text: text(m.text, 500), qty: text(m.qty, 100) }));
    doc.measures = (Array.isArray(raw.measures) ? raw.measures : []).slice(0, 100)
        .filter((m) => isObject(m) && isObject(m.json))
        .map((m) => ({ id: text(m.id, 64) || newId(), label: text(m.label, 200), json: m.json, addedAt: time(m.addedAt, createdAt) }));
    doc.photoCount = Math.max(0, Math.floor(Number(raw.photoCount) || 0));
    return doc;
}
