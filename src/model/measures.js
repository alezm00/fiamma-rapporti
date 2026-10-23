// Misure Testo di un rapporto: etichette e raggruppamento (confronto affiancato).

import { buildReport } from '../qr/tjf/index.js';
import { newId } from './values.js';

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
