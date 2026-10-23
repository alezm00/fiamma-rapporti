// Elenco dei rapporti: ricerca, filtro, ordine, raggruppamento per mese e cestino.

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
