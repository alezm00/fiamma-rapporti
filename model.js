// Rapporto di intervento: struttura, stati, numerazione, ricerca e raggruppamento delle misure.
// Solo logica, senza accesso al database né al DOM (si prova anche in Node).

import { buildReport } from './tjf.js';

export const STATUSES = { draft: 'Bozza', done: 'Completato', sent: 'Inviato' };

export const INTERVENTION_TYPES = [
    { id: 'ordinaria', label: 'Manutenzione ordinaria' },
    { id: 'straordinaria', label: 'Manutenzione straordinaria' },
    { id: 'riparazione', label: 'Riparazione / guasto' },
    { id: 'accensione', label: 'Prima accensione' },
    { id: 'efficienza', label: 'Controllo di efficienza energetica' },
    { id: 'sopralluogo', label: 'Sopralluogo / preventivo' },
    { id: 'altro', label: 'Altro' },
];

export const OUTCOMES = [
    { id: 'ok', label: 'Impianto funzionante' },
    { id: 'anomalie', label: 'Funzionante con anomalie' },
    { id: 'ko', label: 'Non funzionante' },
];

export const typeLabel = (id) => INTERVENTION_TYPES.find((t) => t.id === id)?.label ?? '';
export const outcomeLabel = (id) => OUTCOMES.find((o) => o.id === id)?.label ?? '';

const pad = (n) => String(n).padStart(2, '0');
export const dayString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const timeString = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// "2026-10-22" -> "22/10/2026"
export function formatDay(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function newId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Creazione e modifica
// ---------------------------------------------------------------------------

// defaults: i dati predefiniti delle impostazioni
export function newReport({ now = new Date(), defaults = {}, id = newId() } = {}) {
    const d = defaults;
    return {
        id,
        number: null,
        status: 'draft',
        date: dayString(now),
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
        closedAt: null,
        sentAt: null,
        customer: { name: d.name || '', fiscalCode: d.fiscalCode || '', address: d.address || '', phone: d.phone || '' },
        plant: { brand: d.brand || '', serial: d.serial || '', plateCode: d.plateCode || '', installDate: d.installDate || '' },
        intervention: { type: '', outcome: '', work: '', materials: [], startTime: '', endTime: '', notes: d.notes || '' },
        measures: [],
        photoCount: 0,
    };
}

// ogni modifica: un rapporto inviato torna "completato", così in elenco si vede che va rimandato
export function applyEdit(doc, now = new Date()) {
    doc.updatedAt = now.getTime();
    if (doc.status === 'sent') doc.status = 'done';
    return doc;
}

// Bozza mai compilata (solo i dati predefiniti): si scarta da sola, per non lasciare righe vuote in elenco
export function isBlank(doc, defaults = {}) {
    if (doc.status !== 'draft' || doc.number || doc.measures.length || doc.photoCount) return false;
    const fresh = newReport({ defaults, id: doc.id });
    const form = (d) => JSON.stringify([d.customer, d.plant, { ...d.intervention, startTime: '', endTime: '' }]);
    return form(doc) === form(fresh);
}

// copia i dati di cliente e impianto in un nuovo rapporto (non misure, foto né lavori)
export function duplicateReport(doc, { now = new Date(), id = newId() } = {}) {
    const copy = newReport({ now, id });
    copy.customer = { ...doc.customer };
    copy.plant = { ...doc.plant };
    return copy;
}

// ---------------------------------------------------------------------------
// Numerazione e stati
// ---------------------------------------------------------------------------

export const formatNumber = (year, n) => `${year}/${String(n).padStart(3, '0')}`;

export const reportYear = (doc, now = new Date()) => Number(String(doc.date || dayString(now)).slice(0, 4));

// numero che avrà il prossimo rapporto chiuso in quell'anno
export const nextNumber = (counters, year) => (counters?.[year] || 0) + 1;

// imposta il prossimo numero di un anno (per allinearsi a un registro cartaceo)
export function setNextNumber(counters, year, next) {
    return { ...counters, [year]: Math.max(0, Math.floor(Number(next) || 1) - 1) };
}

// Chiude una bozza: assegna il numero (se manca) e passa a "completato".
// Restituisce i contatori aggiornati; il rapporto viene modificato sul posto.
export function closeReport(doc, counters = {}, now = new Date()) {
    if (doc.status !== 'draft') return counters;
    const next = { ...counters };
    if (!doc.number) {
        const year = reportYear(doc, now);
        next[year] = nextNumber(counters, year);
        doc.number = formatNumber(year, next[year]);
    }
    doc.status = 'done';
    doc.closedAt = now.getTime();
    doc.updatedAt = now.getTime();
    return next;
}

// Dopo l'invio dell'email o la condivisione: solo un rapporto chiuso diventa "inviato"
export function markSent(doc, now = new Date()) {
    if (doc.status === 'draft') return false;
    doc.status = 'sent';
    doc.sentAt = now.getTime();
    doc.updatedAt = now.getTime();
    return true;
}

export const reportLabel = (doc) => (doc.number ? `n. ${doc.number}` : 'Bozza');

// per i nomi di file e cartelle: senza accenti né caratteri speciali ("Mario Rossi" -> "Mario-Rossi")
export const slug = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// "Rapporto_2026-012_Mario-Rossi.pdf" oppure "Bozza_2026-10-22_Mario-Rossi.pdf"
export function reportFileName(doc, ext = 'pdf') {
    const who = slug(doc.customer?.name).slice(0, 40);
    const head = doc.number ? `Rapporto_${doc.number.replace('/', '-')}` : `Bozza_${doc.date || dayString(new Date())}`;
    return `${[head, who].filter(Boolean).join('_')}.${ext}`;
}

// ---------------------------------------------------------------------------
// Orari
// ---------------------------------------------------------------------------

function minutes(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// durata in minuti tra arrivo e partenza (oltre la mezzanotte se la partenza è "prima")
export function durationMinutes(start, end) {
    const a = minutes(start);
    const b = minutes(end);
    if (a == null || b == null) return null;
    return b >= a ? b - a : b + 1440 - a;
}

export function formatDuration(min) {
    if (min == null) return '';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? `${h} h ${pad(m)} min` : `${m} min`;
}

// ---------------------------------------------------------------------------
// Elenco: ricerca, filtro e ordine
// ---------------------------------------------------------------------------

export const normalizeText = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const searchText = (doc) => normalizeText([
    doc.number, doc.customer?.name, doc.customer?.address, doc.customer?.phone, doc.plant?.plateCode, doc.plant?.serial, doc.plant?.brand,
].filter(Boolean).join(' '));

// query: parole separate da spazio, tutte da trovare; status: 'all' | 'draft' | 'done' | 'sent'
export function filterReports(list, { query = '', status = 'all' } = {}) {
    const words = normalizeText(query).split(/\s+/).filter(Boolean);
    return list.filter((r) => (status === 'all' || r.status === status) && words.every((w) => searchText(r).includes(w)));
}

// più recenti per data di intervento, poi per ultima modifica
export function sortReports(list) {
    return [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.updatedAt - a.updatedAt);
}

// ---------------------------------------------------------------------------
// Misure Testo
// ---------------------------------------------------------------------------

// "Prima", poi "Dopo", poi "Misura 3"…
export function nextMeasureLabel(measures) {
    const n = measures.length;
    return n === 0 ? 'Prima' : n === 1 ? 'Dopo' : `Misura ${n + 1}`;
}

export function addMeasure(doc, json, { label, now = new Date(), id = newId() } = {}) {
    const measure = { id, label: label || nextMeasureLabel(doc.measures), json, addedAt: now.getTime() };
    doc.measures.push(measure);
    return measure;
}

// Una tabella con una colonna per misura (etichette come intestazioni).
// Le righe sono i canali: stesso canale e stessa unità sulla stessa riga.
function compareTable(items) {
    const rows = [];
    const index = new Map();
    items.forEach((item, col) => {
        const seen = new Map();
        const column = item.report.columns[0] ?? '';
        for (const row of item.report.rows) {
            const base = `${row.id || row.short || row.label}|${row.unit}`;
            const n = (seen.get(base) || 0) + 1; // lo stesso canale più volte nella stessa misura
            seen.set(base, n);
            const key = `${base}#${n}`;
            let r = index.get(key);
            if (!r) {
                r = { short: row.short, label: row.label, unit: row.unit, order: row.order, first: rows.length, values: Array(items.length).fill('') };
                index.set(key, r);
                rows.push(r);
            }
            r.values[col] = row.cells[column] ?? '';
        }
    });
    rows.sort((a, b) => a.order - b.order || a.first - b.first);
    return {
        columns: items.map((i) => i.label),
        rows: rows.map(({ short, label, unit, values }) => ({ short, label, unit, values })),
    };
}

// Misure dello stesso tipo (type.id, altrimenti type.name) con una sola colonna di valori
// → un confronto affiancato; le altre → una tabella ciascuna. Ordine: primo apparire.
export function groupMeasures(measures) {
    const groups = new Map();
    for (const m of measures) {
        const report = buildReport(m.json);
        const key = m.json?.type?.id || m.json?.type?.name || 'misura';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ measure: m, label: m.label, report });
    }
    const blocks = [];
    for (const items of groups.values()) {
        const comparable = items.length >= 2 && items.every((i) => i.report.columns.length <= 1 && i.report.rows.length > 0);
        if (comparable) blocks.push({ kind: 'compare', title: items[0].report.title, items, table: compareTable(items) });
        else for (const it of items) blocks.push({ kind: 'single', title: it.report.title, label: it.label, report: it.report, measure: it.measure });
    }
    return blocks;
}
