// Misure Testo del rapporto: elenco e tasto per aggiungerne una.

import * as nav from '../../ui/nav.js';
import { buildReport, topValues } from '../../qr/tjf/index.js';
import { formatDate } from '../../lib/dates.js';
import { CLS } from '../../ui/classes.js';
import { $, el } from '../../ui/util.js';
import { session } from './session.js';

export function renderMeasures() {
    const ul = $('e-measures');
    ul.replaceChildren();
    for (const m of session.doc.measures) {
        let report;
        try {
            report = buildReport(m.json);
        } catch {
            continue;
        }
        const li = el('li');
        const open = el('button', CLS.historyOpen);
        open.append(el('span', CLS.historyTitle, m.label));
        open.append(el('span', CLS.historyMeta, [report.title, formatDate(report.start || new Date(m.addedAt))].filter(Boolean).join(' · ')));
        const vals = topValues(report);
        if (vals) open.append(el('span', CLS.historyVals, vals));
        open.addEventListener('click', () => nav.go('measure', { source: 'report', reportId: session.doc.id, measureId: m.id }));
        li.append(open);
        ul.append(li);
    }
    $('e-measures-empty').hidden = session.doc.measures.length > 0;
}

export function initMeasures() {
    $('e-measure-add').addEventListener('click', () => nav.go('scan', { mode: 'attach', reportId: session.doc.id }));
}
