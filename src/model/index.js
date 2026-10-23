// Rapporto di intervento: struttura, stati, numerazione, ricerca e raggruppamento delle misure.
// Solo logica, senza accesso al database né al DOM (si prova anche in Node).

import { buildReport } from '../qr/tjf/index.js';
import { pad, dayString, formatDay } from '../lib/dates.js';

// piccole funzioni di aiuto: leggere valori di tipo incerto (dati da fuori) e cercare un'etichetta
const text = (v, max = 20000) => (typeof v === 'string' ? v.slice(0, max) : '');
const time = (v, fallback) => (Number.isFinite(v) && v > 0 ? v : fallback);
const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const labelIn = (list, id) => list.find((i) => i.id === id)?.label ?? '';

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

// ---------------------------------------------------------------------------
// Apparecchi dell'impianto: caldaie, pompe di calore, condizionatori (quanti si vuole)
// ---------------------------------------------------------------------------

const opt = (...labels) => labels.map((label) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label }));

export const CHAMBERS = [
    { id: 'aperta', label: 'Aperta' },
    { id: 'forzata', label: 'Forzata' },
];

export const TECHNOLOGIES = [
    { id: 'condensazione', label: 'A condensazione' },
    { id: 'tradizionale', label: 'Tradizionale' },
];

export const FUELS = [
    { id: 'metano', label: 'Metano' },
    { id: 'gpl', label: 'GPL' },
    { id: 'gasolio', label: 'Gasolio' },
];

export const HEAT_PUMP_TYPES = opt('Aria-acqua', 'Aria-aria', 'Acqua-acqua', 'Geotermica');
export const AC_TYPES = opt('Monosplit', 'Multisplit', 'Canalizzato', 'Cassetta', 'Altro');
export const REFRIGERANTS = opt('R32', 'R410A', 'R290', 'R134a', 'R407C', 'R454B', 'R744', 'Altro');

// Campi: key (nel rapporto), label, e secondo i casi options (menu), date, decimal, unit (kW, kg…).
const COMMON_FIELDS = [
    { key: 'brand', label: 'Marca' },
    { key: 'model', label: 'Modello' },
    { key: 'serial', label: 'Matricola / codice' },
    { key: 'installDate', label: 'Data di installazione', date: true },
];
const REFRIGERANT_FIELDS = [
    { key: 'refrigerant', label: 'Gas refrigerante', options: REFRIGERANTS },
    { key: 'charge', label: 'Carica di refrigerante', unit: 'kg', decimal: true },
];

export const UNIT_KINDS = [
    {
        id: 'caldaia', label: 'Caldaia', plural: 'caldaie', short: 'caldaia',
        fields: [
            ...COMMON_FIELDS,
            { key: 'fuel', label: 'Combustibile', options: FUELS },
            { key: 'chamber', label: 'Camera di combustione', options: CHAMBERS },
            { key: 'technology', label: 'Tipo di caldaia', options: TECHNOLOGIES },
            { key: 'nominalPower', label: 'Potenza termica nominale', unit: 'kW', decimal: true },
            { key: 'actualPower', label: 'Potenza termica reale', unit: 'kW', decimal: true },
        ],
    },
    {
        id: 'pompa', label: 'Pompa di calore', plural: 'pompe di calore', short: 'pompa di calore',
        fields: [
            ...COMMON_FIELDS,
            { key: 'hpType', label: 'Tipo', options: HEAT_PUMP_TYPES },
            { key: 'nominalPower', label: 'Potenza termica nominale', unit: 'kW', decimal: true },
            { key: 'coolingPower', label: 'Potenza frigorifera', unit: 'kW', decimal: true },
            ...REFRIGERANT_FIELDS,
        ],
    },
    {
        id: 'condizionatore', label: 'Condizionatore', plural: 'condizionatori', short: 'condizionatore',
        fields: [
            ...COMMON_FIELDS,
            { key: 'acType', label: 'Tipo', options: AC_TYPES },
            { key: 'indoorUnits', label: 'Unità interne', decimal: true },
            { key: 'coolingPower', label: 'Potenza frigorifera', unit: 'kW', decimal: true },
            { key: 'nominalPower', label: 'Potenza in riscaldamento', unit: 'kW', decimal: true },
            ...REFRIGERANT_FIELDS,
        ],
    },
];

export const unitKind = (id) => UNIT_KINDS.find((k) => k.id === id);

// un apparecchio nuovo del tipo dato, con i valori indicati (solo i campi di quel tipo)
export function newUnit(kindId, values = {}, id = newId()) {
    const kind = unitKind(kindId);
    const unit = { id, kind: kindId };
    for (const f of kind.fields) unit[f.key] = text(values[f.key], 2000);
    return unit;
}

// "Caldaia", e "Caldaia 1", "Caldaia 2" se ce n'è più di una dello stesso tipo
export function unitTitle(unit, units) {
    const label = unitKind(unit.kind)?.label ?? 'Apparecchio';
    const same = units.filter((u) => u.kind === unit.kind);
    return same.length > 1 ? `${label} ${same.indexOf(unit) + 1}` : label;
}

// "1 caldaia, 2 pompe di calore"
export function unitsSummary(plant) {
    const units = plant?.units ?? [];
    return UNIT_KINDS.map((k) => [k, units.filter((u) => u.kind === k.id).length])
        .filter(([, n]) => n > 0).map(([k, n]) => `${n} ${n === 1 ? k.short : k.plural}`).join(', ');
}

// i campi di un apparecchio pronti da mostrare: [{ label, value }] (menu → etichetta, data → gg/mm/aaaa, kW e kg)
export function unitValues(unit) {
    const kind = unitKind(unit.kind);
    if (!kind) return [];
    return kind.fields.map((f) => {
        let value = String(unit[f.key] ?? '').trim();
        if (f.options) value = labelIn(f.options, value) || value;
        else if (f.date) value = formatDay(value) || value;
        else if (f.unit && /^[\d.,\s]+$/.test(value) && value) value = `${value} ${f.unit}`;
        return { label: f.label, value };
    });
}

// "Beretta Ciao 24"
export const unitName = (unit) => [unit.brand, unit.model].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');

// L'impianto letto da fuori (backup, cartella): targa e apparecchi ripuliti — tipi sconosciuti scartati,
// campi del tipo giusto, identificativi non validi rifatti.
function normalizePlant(plant) {
    const p = isObject(plant) ? plant : {};
    return {
        plateCode: text(p.plateCode, 2000),
        units: (Array.isArray(p.units) ? p.units : []).slice(0, 50).filter((u) => isObject(u) && unitKind(u.kind))
            .map((u) => newUnit(u.kind, u, /^[A-Za-z0-9_-]{8,64}$/.test(u.id ?? '') ? u.id : newId())),
    };
}

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

export function newId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

// ---------------------------------------------------------------------------
// Elenco: ricerca, filtro e ordine
// ---------------------------------------------------------------------------

export const normalizeText = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const searchText = (doc) => normalizeText([
    doc.number, doc.customer?.name, doc.customer?.address, doc.customer?.phone, doc.plant?.plateCode, ...(doc.plant?.units ?? []).flatMap((u) => [u.brand, u.model, u.serial]),
].filter(Boolean).join(' '));

// query: parole separate da spazio, tutte da trovare; status: 'all' | 'draft' | 'done' | 'sent'; year: 'all' | '2026'
export function filterReports(list, { query = '', status = 'all', year = 'all' } = {}) {
    const words = normalizeText(query).split(/\s+/).filter(Boolean);
    return list.filter((r) => (status === 'all' || r.status === status)
        && (year === 'all' || reportDateYear(r) === year)
        && words.every((w) => searchText(r).includes(w)));
}

const reportDateYear = (doc) => String(doc.date || '').slice(0, 4);

// anni presenti nell'elenco, dal più recente: ['2026', '2025']
export const yearsOf = (list) => [...new Set(list.map(reportDateYear).filter(Boolean))].sort().reverse();

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

// "2026-10" -> "ottobre 2026"
export function monthLabel(key) {
    const m = /^(\d{4})-(\d{2})$/.exec(key);
    return m ? `${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`.trim() : 'senza data';
}

// raggruppa un elenco già ordinato per mese di intervento, mantenendo l'ordine
export function groupByMonth(list) {
    const groups = [];
    for (const doc of list) {
        const key = String(doc.date || '').slice(0, 7);
        if (groups.at(-1)?.key !== key) groups.push({ key, label: monthLabel(key), items: [] });
        groups.at(-1).items.push(doc);
    }
    return groups;
}

// ---------------------------------------------------------------------------
// Cestino
// ---------------------------------------------------------------------------

export const TRASH_DAYS = 30;
const DAY = 24 * 3600 * 1000;

// giorni che restano prima dell'eliminazione definitiva (almeno 1 finché non è scaduto)
export const trashDaysLeft = (doc, now = Date.now()) => Math.max(0, Math.ceil(TRASH_DAYS - (now - doc.deletedAt) / DAY));

export const isExpired = (doc, now = Date.now()) => !!doc.deletedAt && now - doc.deletedAt >= TRASH_DAYS * DAY;

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

// ---------------------------------------------------------------------------
// Dati letti da fuori (cartella di salvataggio, backup): si rifà un rapporto pulito
// ---------------------------------------------------------------------------

// Restituisce un rapporto con tutti i campi del tipo giusto, oppure null se non è un rapporto.
export function normalizeReport(raw) {
    if (!isObject(raw) || !/^[A-Za-z0-9_-]{8,64}$/.test(raw.id ?? '')) return null;
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

// Dove va il rapporto nella cartella di salvataggio: rapporti/<anno>/<dir>/
// ("2026-012_Mario-Rossi_ab12cd34", per le bozze "BOZZA_2026-10-22_Mario-Rossi_ab12cd34")
export function folderPath(doc) {
    const id8 = String(doc.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
    const who = slug(doc.customer?.name).slice(0, 30);
    const year = (doc.number || doc.date || dayString(new Date())).slice(0, 4);
    const head = doc.number ? doc.number.replace('/', '-') : `BOZZA_${doc.date}`;
    return { year, dir: [head, who, id8].filter(Boolean).join('_') };
}
