// Email del rapporto: destinatari, oggetto e testo creati in automatico.
import { formatDay } from '../lib/dates.js';
import { typeLabel, outcomeLabel } from './report.js';
import { unitKind, unitName } from './units.js';

// "a@x.it, b@y.it" -> ['a@x.it', 'b@y.it'] (separati da virgola, punto e virgola o spazio)
export function parseRecipients(text) {
    return String(text ?? '').split(/[\s,;]+/).filter(Boolean);
}

const EMAIL = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]{2,}$/;

export function checkRecipients(text) {
    const list = parseRecipients(text);
    if (!list.length) return { empty: true, ok: true, list };
    const bad = list.filter((a) => !EMAIL.test(a));
    return bad.length
        ? { empty: false, ok: false, list, error: `Indirizzo email non valido: ${bad.join(', ')}` }
        : { empty: false, ok: true, list };
}

const oneLine = (s) => String(s ?? '').trim().replace(/\s*\n\s*/g, ', ');

// "Rapporto di intervento n. 2026/012 - Mario Rossi - targa 06BD529A822E2B20 - 22/10/2026"
export function buildSubject(doc) {
    const head = doc.number ? `Rapporto di intervento n. ${doc.number}` : 'Rapporto di intervento (bozza)';
    const plate = doc.plant?.plateCode?.trim();
    return [head, doc.customer?.name?.trim(), plate && `targa ${plate}`, formatDay(doc.date)].filter(Boolean).join(' - ');
}

export function buildBody(doc, company = {}) {
    const c = doc.customer || {};
    const p = doc.plant || {};
    // "targa AB12; Caldaia Beretta Ciao 24 (matricola SN1); Pompa di calore Daikin Altherma"
    const system = [
        p.plateCode && `targa ${p.plateCode}`,
        ...(p.units ?? []).map((u) => [unitKind(u.kind)?.label, unitName(u), u.serial && `(matricola ${u.serial})`].filter(Boolean).join(' ')),
    ].filter(Boolean).join('; ');
    const what = [typeLabel(doc.intervention?.type), outcomeLabel(doc.intervention?.outcome)].filter(Boolean).join(' - ');
    const details = [
        c.name && `Cliente: ${c.name}`,
        c.address && `Indirizzo: ${oneLine(c.address)}`,
        system && `Impianto: ${system}`,
        what && `Intervento: ${what}`,
    ].filter(Boolean);
    const label = doc.number ? `il rapporto di intervento n. ${doc.number}` : 'la bozza del rapporto di intervento';
    return [
        'Buongiorno,',
        '',
        `in allegato ${label}${doc.date ? ` del ${formatDay(doc.date)}` : ''}.`,
        ...(details.length ? ['', ...details] : []),
        '',
        'Cordiali saluti',
        ...[company.technician, company.name].filter(Boolean),
    ].join('\n');
}

export function mailtoUrl(recipients, subject, body) {
    const to = recipients.map((a) => encodeURIComponent(a).replace(/%40/g, '@')).join(',');
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, '\r\n'))}`;
}
