// Scansioni rapide: le ultime 20 letture, solo per rivedere i valori.

import * as nav from '../ui/nav.js';
import { buildReport, topValues } from '../qr/tjf/index.js';
import { formatDate } from '../lib/dates.js';
import { loadScans, removeScan, clearScans } from '../data/quickscans.js';
import { CLS } from '../ui/classes.js';
import { $, el } from '../ui/util.js';

function render() {
    const list = loadScans();
    const ul = $('history');
    ul.replaceChildren();
    $('history-empty').hidden = list.length > 0;
    $('btn-clear').hidden = list.length === 0;
    for (const entry of list) {
        let report;
        try {
            report = buildReport(entry.json);
        } catch {
            continue;
        }
        const li = el('li', CLS.historyRow);
        const open = el('button', CLS.historyOpen);
        open.append(el('span', CLS.historyTitle, report.title));
        const fuel = report.header.find((h) => h.label === 'Combustibile');
        open.append(el('span', CLS.historyMeta, [formatDate(report.start || new Date(entry.savedAt)), fuel?.value].filter(Boolean).join(' · ')));
        const vals = topValues(report);
        if (vals) open.append(el('span', CLS.historyVals, vals));
        open.addEventListener('click', () => nav.go('measure', { source: 'quick', id: entry.id }));

        const del = el('button', CLS.historyDel, '✕');
        del.setAttribute('aria-label', 'Elimina');
        del.addEventListener('click', () => {
            if (!confirm(`Eliminare "${report.title}"?`)) return;
            removeScan(entry.id);
            render();
        });
        li.append(open, del);
        ul.append(li);
    }
}

export const enter = render;

export function init() {
    $('btn-clear').addEventListener('click', () => {
        if (!confirm('Cancellare tutte le scansioni rapide?')) return;
        clearScans();
        render();
    });
    $('q-scan').addEventListener('click', () => nav.go('scan', { mode: 'quick' }));
    $('q-back').addEventListener('click', () => nav.back());
}
