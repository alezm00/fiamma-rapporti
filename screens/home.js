// Elenco dei rapporti: ricerca, filtro per stato, nuovo rapporto, scansione rapida.

import * as nav from '../nav.js';
import * as store from '../store.js';
import { filterReports, typeLabel, formatDay, isBlank } from '../model.js';
import { loadSettings } from '../settings.js';
import * as folder from '../folder.js';
import { CLS, MSG_TYPES } from '../ui.js';
import { $, el, statusBadge } from '../util.js';

let reports = [];
const filter = { query: '', status: 'all' };

function render() {
    const shown = filterReports(reports, filter);
    const ul = $('report-list');
    ul.replaceChildren();
    for (const doc of shown) {
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
        ul.append(li);
    }
    const searching = filter.query.trim() || filter.status !== 'all';
    $('report-empty').hidden = shown.length > 0;
    $('report-empty').textContent = reports.length === 0
        ? 'Nessun rapporto. Tocca «Nuovo rapporto» per iniziare.'
        : searching ? 'Nessun rapporto trovato.' : '';
    for (const chip of $('h-status').children) chip.setAttribute('aria-pressed', String(chip.dataset.status === filter.status));
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
    // le bozze mai compilate (solo i dati predefiniti) non servono: si scartano
    const defaults = loadSettings().defaults;
    for (const doc of await store.listReports()) {
        if (isBlank(doc, defaults)) await store.deleteReport(doc.id);
    }
    reports = await store.listReports();
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
        render();
    });
    $('h-status').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-status]');
        if (!chip) return;
        filter.status = chip.dataset.status;
        render();
    });
}
