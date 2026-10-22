// Valori di una misura Testo: grandi, da ricopiare a mano. Si apre da una scansione rapida
// o da un rapporto (in quel caso con etichetta, "aggiungi un'altra misura" e "rimuovi").

import * as nav from '../nav.js';
import * as store from '../store.js';
import { buildReport, reportToText } from '../tjf.js';
import { formatDate } from '../dates.js';
import { getScan } from '../quickscans.js';
import { CLS } from '../ui.js';
import { $, el, toast, debounce, keepAwake, releaseAwake, explainSaveError } from '../util.js';

let params = null;
let doc = null; // il rapporto, se la misura è in un rapporto
let measure = null;

function renderReport(r, json) {
    $('r-title').textContent = r.title;
    const dates = [];
    if (r.start) dates.push(formatDate(r.start));
    if (r.typeId && r.typeId !== r.title) dates.push(r.typeId);
    $('r-date').textContent = dates.join(' · ');

    const head = $('r-header');
    head.replaceChildren();
    for (const h of r.header) head.append(el('dt', CLS.headTerm, h.label), el('dd', CLS.headDef, h.value));
    $('r-note').hidden = !r.note;
    $('r-note').textContent = r.note ? `Note: ${r.note}` : '';

    $('r-errors').hidden = !r.errors.length;
    $('r-errors').textContent = r.errors.join('\n');

    // valori
    const table = $('r-table');
    table.replaceChildren();
    const cols = r.columns.length ? r.columns : [''];
    const multi = cols.length > 1;
    table.className = multi ? CLS.tableMulti : CLS.tableSingle;
    table.style.setProperty('--cols', cols.length);
    if (multi) {
        const hdr = el('div', CLS.tableHead);
        hdr.append(...cols.map((c) => el('span', CLS.tableHeadCell, c)), el('span', CLS.tableHeadCell));
        table.append(hdr);
    }
    r.rows.forEach((row, i) => {
        const line = i < r.rows.length - 1 ? ` ${CLS.cellLine}` : ''; // linea sotto ogni riga tranne l'ultima
        const div = el('div', CLS.row);
        const label = el('div', multi ? `${CLS.cell} ${CLS.labelMulti}` : `${CLS.cell}${line}`);
        label.append(el('span', CLS.code, row.short || row.label));
        if (row.short && row.short !== row.label) label.append(el('span', CLS.name, row.label));
        // segno meno tipografico: più leggibile del trattino
        div.append(
            label,
            ...cols.map((c) => el('div', `${CLS.cell} ${multi ? CLS.numMulti : CLS.num}${line}`, (row.cells[c] ?? '').replace(/^-(?=\d)/, '−'))),
            el('div', `${CLS.cell} ${CLS.unit}${line}`, row.unit),
        );
        table.append(div);
    });
    $('r-values').hidden = r.rows.length === 0;
    if (!r.rows.length && !r.errors.length) {
        $('r-errors').hidden = false;
        $('r-errors').textContent = 'Il QR non contiene valori di misura.';
    }

    // sezioni richiudibili
    const box = $('r-sections');
    box.replaceChildren();
    for (const s of r.sections) {
        const d = el('details', CLS.section);
        if (s.title === 'Fasi della prova') d.open = true;
        const dl = el('dl', CLS.sectionList);
        for (const it of s.items) dl.append(el('dt', CLS.term, it.label), el('dd', CLS.def, it.value));
        d.append(el('summary', CLS.summary, s.title), dl);
        box.append(d);
    }
    $('r-json').textContent = JSON.stringify(json, null, 2);

    $('btn-copy').onclick = async () => {
        try {
            await navigator.clipboard.writeText(reportToText(r));
            toast('Copiato');
        } catch {
            toast('Copia non riuscita');
        }
    };
}

function markChips() {
    const label = $('m-label').value.trim();
    for (const chip of $('m-chips').children) chip.setAttribute('aria-pressed', String(chip.dataset.label === label));
}

// salva l'etichetta (una misura senza etichetta prende "Misura N")
const saveLabel = debounce(async () => {
    if (!doc || !measure) return;
    measure.label = $('m-label').value.trim() || `Misura ${doc.measures.indexOf(measure) + 1}`;
    try {
        await store.saveReport(doc);
    } catch (e) {
        console.error(e);
        toast(`Etichetta non salvata: ${explainSaveError(e)}`, 'error');
    }
}, 300);

export async function enter(p) {
    params = p;
    doc = null;
    measure = null;
    let json;
    if (p.source === 'report') {
        doc = await store.getReport(p.reportId);
        measure = doc?.measures.find((m) => m.id === p.measureId);
        json = measure?.json;
    } else {
        json = getScan(p.id)?.json;
    }
    let report;
    try {
        report = buildReport(json);
    } catch {
        toast('Misura non trovata');
        nav.replace('home');
        return;
    }
    const inReport = !!measure;
    $('m-label-card').hidden = !inReport;
    $('m-remove').hidden = !inReport;
    $('m-add').hidden = !inReport;
    $('m-again').hidden = inReport;
    $('m-back').textContent = inReport ? 'Torna al rapporto' : 'Indietro';
    if (inReport) {
        $('m-label').value = measure.label;
        markChips();
    }
    renderReport(report, json);
    keepAwake();
}

export async function leave() {
    await saveLabel.flush();
    releaseAwake();
    doc = null;
    measure = null;
}

export function init() {
    $('m-back').addEventListener('click', () => nav.back());
    $('m-add').addEventListener('click', () => nav.replace('scan', { mode: 'attach', reportId: params.reportId }));
    $('m-again').addEventListener('click', () => nav.replace('scan', { mode: 'quick' }));

    $('m-label').addEventListener('input', () => {
        markChips();
        saveLabel();
    });
    $('m-chips').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-label]');
        if (!chip) return;
        $('m-label').value = chip.dataset.label;
        markChips();
        saveLabel();
    });

    $('m-remove').addEventListener('click', async () => {
        if (!doc || !measure) return;
        if (!confirm(`Rimuovere la misura "${measure.label}" dal rapporto?`)) return;
        saveLabel.cancel();
        const before = doc.measures;
        doc.measures = doc.measures.filter((m) => m !== measure);
        try {
            await store.saveReport(doc);
        } catch (e) {
            console.error(e);
            doc.measures = before;
            toast(`Misura non rimossa: ${explainSaveError(e)}`, 'error');
            return;
        }
        measure = null; // niente salvataggio dell'etichetta in uscita
        nav.back();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && nav.current() === 'measure') keepAwake();
    });
}
