// Rapporto di intervento: struttura, stati, numerazione, orari e nome dei file.
// Solo logica, senza accesso al database né al DOM (si prova anche in Node).

import { pad, dayString, formatDay } from '../lib/dates.js';
import { newId } from './values.js';

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

// Le righe dell'elenco e del cestino: numero, cliente e "data · tipo · 2 misure · 3 foto"
export function describeReport(doc) {
    const measures = doc.measures.length;
    return {
        number: doc.number ? `N. ${doc.number}` : 'Senza numero',
        customer: doc.customer.name || 'Senza cliente',
        meta: [
            formatDay(doc.date),
            typeLabel(doc.intervention.type),
            measures && `${measures} ${measures === 1 ? 'misura' : 'misure'}`,
            doc.photoCount && `${doc.photoCount} foto`,
        ].filter(Boolean).join(' · '),
    };
}

// ---------------------------------------------------------------------------
// Creazione e modifica
// ---------------------------------------------------------------------------

// Un rapporto nuovo è una bozza vuota: senza apparecchi (si aggiungono dalla scheda Impianto).
export function newReport({ now = new Date(), id = newId() } = {}) {
    return {
        id,
        number: null,
        status: 'draft',
        date: dayString(now),
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
        closedAt: null,
        sentAt: null,
        deletedAt: null, // nel cestino da questo momento (si elimina per sempre dopo TRASH_DAYS giorni)
        customer: { name: '', fiscalCode: '', address: '', phone: '' },
        plant: { plateCode: '', units: [] },
        intervention: { type: '', outcome: '', work: '', materials: [], startTime: '', endTime: '', notes: '' },
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

// Bozza mai compilata: si scarta da sola, per non lasciare righe vuote in elenco
export function isBlank(doc) {
    if (doc.status !== 'draft' || doc.number || doc.measures.length || doc.photoCount) return false;
    const fresh = newReport({ id: doc.id });
    // gli apparecchi si confrontano senza identificativo (cambia a ogni rapporto nuovo)
    const plant = (p) => ({ plateCode: p?.plateCode ?? '', units: (p?.units ?? []).map(({ id: _id, ...u }) => u) });
    const form = (d) => JSON.stringify([{ ...fresh.customer, ...d.customer }, plant(d.plant), { ...fresh.intervention, ...d.intervention, startTime: '', endTime: '' }]);
    return form(doc) === form(fresh);
}

// copia i dati di cliente e impianto in un nuovo rapporto (non misure, foto né lavori)
export function duplicateReport(doc, { now = new Date(), id = newId() } = {}) {
    const copy = newReport({ now, id });
    copy.customer = { ...doc.customer };
    copy.plant = {
        plateCode: doc.plant?.plateCode ?? '',
        units: (doc.plant?.units ?? []).map((u) => ({ ...u, id: newId() })), // gli stessi apparecchi, con identificativi nuovi
    };
    return copy;
}

// ---------------------------------------------------------------------------
// Numerazione e stati
// ---------------------------------------------------------------------------

export const formatReportNumber = (year, n) => `${year}/${String(n).padStart(3, '0')}`;

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
        doc.number = formatReportNumber(year, next[year]);
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
