// Email del report: destinatari, oggetto e testo creati in automatico.
import { formatDate } from './tjf.js';
import { normalizeCustomer } from './report.js';

const pad = (n) => String(n).padStart(2, '0');
const formatDay = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

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

// "Rapporto di prova - Mario Rossi - targa 06BD529A822E2B20 - 22/10/2026"
export function buildSubject(report, customer, now = new Date()) {
    const c = normalizeCustomer(customer);
    return ['Rapporto di prova', c.name, c.plateCode && `targa ${c.plateCode}`, formatDay(report.start || now)].filter(Boolean).join(' - ');
}

export function buildBody(report, customer, now = new Date()) {
    const c = normalizeCustomer(customer);
    const when = formatDate(report.start || now).replace(' ', ' alle ');
    const boiler = [c.brand, c.serial && `matricola ${c.serial}`, c.plateCode && `targa impianto ${c.plateCode}`].filter(Boolean).join(', ');
    const details = [
        c.name && `Cliente: ${c.name}`,
        c.address && `Indirizzo: ${c.address}`,
        boiler && `Caldaia: ${boiler}`,
    ].filter(Boolean);
    return [
        'Buongiorno,',
        '',
        `in allegato il rapporto di prova${report.title ? ` «${report.title}»` : ''} eseguito il ${when}.`,
        ...(details.length ? ['', ...details] : []),
        '',
        'Cordiali saluti',
    ].join('\n');
}

export function mailtoUrl(recipients, subject, body) {
    const to = recipients.map((a) => encodeURIComponent(a).replace(/%40/g, '@')).join(',');
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, '\r\n'))}`;
}
