// Elenco dei rapporti: ricerca, filtri per stato e anno, mesi, nuovo rapporto, scansione rapida, cestino.

import * as nav from '../nav.js';
import * as store from '../store.js';
import { filterReports, groupByMonth, yearsOf, typeLabel, formatDay, isBlank } from '../model.js';
import { loadSettings } from '../settings.js';
import * as folder from '../folder.js';
import { CLS, MSG_TYPES } from '../ui.js';
import { $, el, statusBadge } from '../util.js';

let reports = [];
let trashCount = 0;
const PAGE = 50; // righe mostrate per volta
let limit = PAGE;
const filter = { query: '', status: 'all', year: 'all' };

function row(doc) {
    const li = el('li');
    const open = el('button', CLS.reportOpen);
    open.dataset.id = doc.id;

    const head = el('div', CLS.reportHead);
    head.append(el('span', CLS.reportNum, doc.number ? `N. ${doc.number}` : 'Senza numero'), statusBadge(doc.status));
    open.append(head, el('span', CLS.reportName, doc.customer.name || 'Senza cliente'));
    if (doc.customer.address) open.append(el('span', CLS.reportAddr, doc.customer.address.replace(/\s*\n\s*/g, ', ')));
    const meta = [
        formatDay(doc.date),
        typeLabel(doc.intervention.type),
        doc.measures.length && `${doc.measures.length} ${doc.measures.length === 1 ? 'misura' : 'misure'}`,
        doc.photoCount && `${doc.photoCount} foto`,
    ].filter(Boolean).join(' · ');
    open.append(el('span', CLS.reportMeta, meta));
    open.addEventListener('click', () => nav.go('editor', { id: doc.id }));
    li.append(open);
    return li;
}

// filtro per anno: compare solo se i rapporti coprono più di un anno
function renderYears() {
    const years = yearsOf(reports);
    if (filter.year !== 'all' && !years.includes(filter.year)) filter.year = 'all';
    const box = $('h-years');
    box.hidden = years.length < 2;
    box.replaceChildren();
    if (box.hidden) return;
    for (const [value, label] of [['all', 'Tutti gli anni'], ...years.map((y) => [y, y])]) {
        const chip = el('button', 'chip', label);
        chip.type = 'button';
        chip.dataset.year = value;
        chip.setAttribute('aria-pressed', String(value === filter.year));
        box.append(chip);
    }
}

function render() {
    renderYears();
    const shown = filterReports(reports, filter);
    const visible = shown.slice(0, limit);
    const total = new Map(groupByMonth(shown).map((g) => [g.key, g.items.length])); // rapporti del mese anche oltre quelli mostrati
    const ul = $('report-list');
    ul.replaceChildren();
    for (const group of groupByMonth(visible)) {
        const head = el('li', CLS.monthHead, `${group.label} · ${total.get(group.key)}`);
        head.dataset.month = group.key;
        ul.append(head, ...group.items.map(row));
    }
    const more = shown.length - visible.length;
    $('h-more').hidden = more <= 0;
    $('h-more').textContent = `Mostra altri (${more})`;
    const searching = filter.query.trim() || filter.status !== 'all' || filter.year !== 'all';
    $('report-empty').hidden = shown.length > 0;
    $('report-empty').textContent = reports.length === 0
        ? 'Nessun rapporto. Tocca «Nuovo rapporto» per iniziare.'
        : searching ? 'Nessun rapporto trovato.' : '';
    for (const chip of $('h-status').children) chip.setAttribute('aria-pressed', String(chip.dataset.status === filter.status));
    $('h-trash').hidden = trashCount === 0;
    $('h-trash').textContent = `Cestino (${trashCount})`;
}

// riga discreta se la copia di sicurezza è ferma o manca da tempo
const MONTH = 30 * 24 * 3600 * 1000;

async function renderReminder() {
    const box = $('home-reminder');
    let text = '';
    let type = 'warn';
    let action = () => nav.go('settings');
    if (reports.length) {
        const st = await folder.status();
        if (st.linked && st.permission !== 'granted' && st.pending) {
            text = 'La copia nella cartella è sospesa: tocca per riattivarla.';
            action = () => folder.reactivate().then(renderReminder);
        } else if (st.linked && st.error) {
            text = `Copia nella cartella non riuscita: ${st.error}`;
        } else if (!st.linked && Date.now() - loadSettings().lastBackup > MONTH) {
            text = 'Nessuna copia di sicurezza recente: collega una cartella o scarica un backup (Impostazioni).';
            type = 'info';
        }
    }
    box.hidden = !text;
    box.replaceChildren();
    if (!text) return;
    const button = el('button', `${CLS.reminder} ${MSG_TYPES[type]}`, text);
    button.type = 'button';
    button.addEventListener('click', action);
    box.append(button);
}

export async function enter() {
    await store.purgeExpired(); // dal cestino va via quello che ci sta da più di 30 giorni
    // le bozze mai compilate (solo i dati predefiniti) non servono: si scartano
    const defaults = loadSettings().defaults;
    for (const doc of await store.listReports()) {
        if (isBlank(doc, defaults)) await store.purgeReport(doc.id);
    }
    reports = await store.listReports();
    trashCount = (await store.listTrash()).length;
    limit = PAGE;
    $('h-search').value = filter.query;
    render();
    renderReminder();
}

export function init() {
    $('btn-new').addEventListener('click', async () => {
        const doc = await store.createReport();
        nav.go('editor', { id: doc.id, isNew: true });
    });
    $('btn-quick-scan').addEventListener('click', () => nav.go('scan', { mode: 'quick' }));
    $('btn-quick-list').addEventListener('click', () => nav.go('quick'));
    $('btn-settings').addEventListener('click', () => nav.go('settings'));
    folder.events.addEventListener('state', () => nav.current() === 'home' && renderReminder());

    $('h-search').addEventListener('input', (e) => {
        filter.query = e.target.value;
        limit = PAGE;
        render();
    });
    $('h-status').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-status]');
        if (!chip) return;
        filter.status = chip.dataset.status;
        limit = PAGE;
        render();
    });
    $('h-years').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-year]');
        if (!chip) return;
        filter.year = chip.dataset.year;
        limit = PAGE;
        render();
    });
    $('h-more').addEventListener('click', () => {
        limit += PAGE;
        render();
    });
    $('h-trash').addEventListener('click', () => nav.go('trash'));
}
