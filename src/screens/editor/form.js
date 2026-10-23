// I campi del modulo del rapporto (cliente, impianto, intervento, note), l'intestazione e i piccoli avvisi sotto i campi.

import { durationMinutes, formatDuration } from '../../model/index.js';
import { checkFiscalCode } from '../../lib/validate.js';
import { checkRecipients } from '../../model/mail.js';
import { loadSettings } from '../../data/settings.js';
import { $, statusBadge } from '../../ui/util.js';

// campo della pagina -> percorso nel rapporto
export const FIELDS = {
    'e-date': 'date',
    'c-name': 'customer.name',
    'c-cf': 'customer.fiscalCode',
    'c-address': 'customer.address',
    'c-phone': 'customer.phone',
    'c-plate': 'plant.plateCode',
    'e-type': 'intervention.type',
    'e-outcome': 'intervention.outcome',
    'e-work': 'intervention.work',
    'e-start': 'intervention.startTime',
    'e-end': 'intervention.endTime',
    'c-notes': 'intervention.notes',
};

function getPath(doc, path) {
    return path.split('.').reduce((o, k) => o?.[k], doc);
}

function setPath(doc, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => o[k], doc)[last] = value;
}

export function fillForm(doc) {
    for (const [id, path] of Object.entries(FIELDS)) $(id).value = getPath(doc, path) ?? '';
}

export function readForm(doc) {
    for (const [id, path] of Object.entries(FIELDS)) {
        const value = $(id).value;
        if (id === 'e-date' && !value) continue; // la data dell'intervento non resta vuota
        setPath(doc, path, value);
    }
}

export function renderHeader(doc) {
    $('e-title').textContent = doc.number ? `Rapporto n. ${doc.number}` : 'Rapporto';
    $('e-badge').replaceChildren(statusBadge(doc.status));
    $('btn-close').hidden = doc.status !== 'draft';
}

export function updateMailInfo() {
    const { list } = checkRecipients(loadSettings().email);
    $('mail-info').textContent = list.length ? `Destinatario: ${list.join(', ')}` : 'Nessun destinatario impostato (si imposta dalle impostazioni nella pagina iniziale).';
}

export function updateDuration() {
    const min = durationMinutes($('e-start').value, $('e-end').value);
    $('e-duration').textContent = min == null ? '' : `Durata dell'intervento: ${formatDuration(min)}`;
}

// restituisce i nomi dei campi da controllare
export function validateCustomer() {
    const r = checkFiscalCode($('c-cf').value);
    $('cf-hint').hidden = r.ok;
    $('cf-hint').textContent = r.ok ? '' : r.error;
    return r.ok ? [] : ['codice fiscale'];
}
