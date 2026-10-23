// Chiusura, duplicazione ed eliminazione del rapporto.

import * as nav from '../../ui/nav.js';
import * as store from '../../data/store.js';
import { formatReportNumber, nextNumber, reportYear, isBlank, TRASH_DAYS } from '../../model/index.js';
import { loadSettings } from '../../data/settings.js';
import { showBoxMsg, toast, $ } from '../../ui/util.js';
import { session, flush, guarded } from './session.js';
import { renderHeader } from './form.js';

async function onClose() {
    await flush();
    const year = reportYear(session.doc);
    const number = formatReportNumber(year, nextNumber(loadSettings().counters, year));
    const missing = session.doc.customer.name.trim() ? '' : 'Manca il nome del cliente. ';
    if (!confirm(`${missing}Chiudere il rapporto? Prenderà il numero ${number}.`)) return;
    await store.close(session.doc);
    renderHeader(session.doc);
    showBoxMsg('report-msg', `Rapporto chiuso: numero ${session.doc.number}.`, 'success');
}

async function onDuplicate() {
    await flush();
    const copy = await store.duplicate(session.doc);
    toast('Nuova bozza con i dati di cliente e impianto');
    nav.replace('editor', { id: copy.id, isNew: true });
}

async function onDelete() {
    const what = session.doc.number ? `Il rapporto n. ${session.doc.number}` : 'La bozza';
    const blank = isBlank(session.doc); // bozza mai compilata: non serve il cestino
    if (!blank && !confirm(`${what} va nel cestino: si recupera entro ${TRASH_DAYS} giorni dalla schermata Cestino dell'elenco. Continuare?`)) return;
    if (!(await flush())) return; // le ultime modifiche non sono salvate: meglio non andare avanti
    const id = session.doc.id;
    session.doc = null; // niente salvataggi dopo l'eliminazione
    if (blank) await store.purgeReport(id);
    else await store.trashReport(id);
    toast(blank ? 'Bozza eliminata' : 'Rapporto nel cestino');
    nav.back();
}

export function initActions() {
    $('btn-close').addEventListener('click', () => guarded(onClose));
    $('btn-duplicate').addEventListener('click', () => guarded(onDuplicate));
    $('btn-delete').addEventListener('click', () => guarded(onDelete));
}
