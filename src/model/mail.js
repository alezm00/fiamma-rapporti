// Email del rapporto: destinatari, oggetto e testo (un modello con segnaposto, cambiabile nelle impostazioni).
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

// ---------------------------------------------------------------------------
// Il testo: un modello con segnaposto tra graffe, che l'utente può cambiare nelle impostazioni
// ---------------------------------------------------------------------------

// I segnaposto: la chiave, e un esempio di come diventa (per la schermata delle impostazioni)
export const MAIL_PLACEHOLDERS = [
    { key: 'titolo', example: 'Rapporto di intervento n. 2026/012' },
    { key: 'rapporto', example: 'il rapporto di intervento n. 2026/012' },
    { key: 'numero', example: '2026/012 (vuoto in una bozza)' },
    { key: 'data', example: '22/10/2026' },
    { key: 'cliente', example: 'Mario Rossi' },
    { key: 'indirizzo', example: 'Via Roma 1, 33170 Pordenone PN' },
    { key: 'telefono', example: '333 1234567' },
    { key: 'targa', example: 'AB12' },
    { key: 'apparecchi', example: 'Caldaia Beretta Ciao 24 (matricola SN1)' },
    { key: 'impianto', example: 'targa AB12; Caldaia Beretta Ciao 24 (matricola SN1)' },
    { key: 'tipo', example: 'Manutenzione ordinaria' },
    { key: 'esito', example: 'Impianto funzionante' },
    { key: 'intervento', example: 'Manutenzione ordinaria - Impianto funzionante' },
    { key: 'tecnico', example: 'Luca Bianchi' },
    { key: 'ditta', example: 'Bianchi Srl' },
];

// Il modello di partenza: quello che l'app usava prima che si potesse cambiare.
export const DEFAULT_MAIL = {
    subject: '{titolo} - {cliente} - targa {targa} - {data}',
    body: [
        'Buongiorno,',
        '',
        'in allegato {rapporto} del {data}.',
        '',
        'Cliente: {cliente}',
        'Indirizzo: {indirizzo}',
        'Impianto: {impianto}',
        'Intervento: {intervento}',
        '',
        'Cordiali saluti',
        '{tecnico}',
        '{ditta}',
    ].join('\n'),
};

// I valori dei segnaposto per un rapporto: testi su una riga, vuoti se il dato manca.
export function mailValues(doc, company = {}) {
    const c = doc.customer || {};
    const p = doc.plant || {};
    const w = doc.intervention || {};
    const targa = String(p.plateCode ?? '').trim();
    // "Caldaia Beretta Ciao 24 (matricola SN1); Pompa di calore Daikin Altherma"
    const apparecchi = (p.units ?? [])
        .map((u) => [unitKind(u.kind)?.label, unitName(u), u.serial && `(matricola ${u.serial})`].filter(Boolean).join(' '))
        .filter(Boolean).join('; ');
    const tipo = typeLabel(w.type);
    const esito = outcomeLabel(w.outcome);
    return {
        titolo: doc.number ? `Rapporto di intervento n. ${doc.number}` : 'Rapporto di intervento (bozza)',
        rapporto: doc.number ? `il rapporto di intervento n. ${doc.number}` : 'la bozza del rapporto di intervento',
        numero: doc.number || '',
        data: formatDay(doc.date),
        cliente: String(c.name ?? '').trim(),
        indirizzo: oneLine(c.address),
        telefono: String(c.phone ?? '').trim(),
        targa,
        apparecchi,
        impianto: [targa && `targa ${targa}`, apparecchi].filter(Boolean).join('; '),
        tipo,
        esito,
        intervento: [tipo, esito].filter(Boolean).join(' - '),
        tecnico: String(company.technician ?? '').trim(),
        ditta: String(company.name ?? '').trim(),
    };
}

const PLACEHOLDER = /\{([a-z]+)\}/g;
const known = (key) => MAIL_PLACEHOLDERS.some((m) => m.key === key);

// I segnaposto del modello che non esistono (un errore di battitura): ['{clinete}']
export function unknownPlaceholders(template) {
    return [...new Set([...String(template ?? '').matchAll(PLACEHOLDER)].map((m) => m[1]).filter((k) => !known(k)))].map((k) => `{${k}}`);
}

// Un pezzo di testo (una riga del messaggio, o una parte dell'oggetto tra " - "): i segnaposto si sostituiscono;
// se uno dei segnaposto è vuoto il pezzo sparisce (null), così non restano scritte a metà come "targa ".
// Un segnaposto che non esiste resta com'è.
function fillPiece(piece, values) {
    let missing = false;
    const text = piece.replace(PLACEHOLDER, (all, key) => {
        if (!known(key)) return all;
        if (!values[key]) missing = true;
        return values[key] ?? '';
    });
    return missing ? null : text;
}

// L'oggetto: su una sola riga, a pezzi separati da " - "
export function renderSubject(template, values) {
    return String(template ?? '').replace(/\s*\n\s*/g, ' ').split(' - ')
        .map((piece) => fillPiece(piece, values))
        .filter((piece) => piece && piece.trim())
        .join(' - ').replace(/\s+/g, ' ').trim();
}

// Il messaggio: una riga alla volta; mai più di una riga vuota di seguito, nessuna all'inizio né alla fine
export function renderBody(template, values) {
    const out = [];
    for (const line of String(template ?? '').replace(/\r\n?/g, '\n').split('\n')) {
        const text = fillPiece(line, values);
        if (text === null) continue;
        const blank = !text.trim();
        if (blank && (!out.length || out.at(-1) === '')) continue;
        out.push(blank ? '' : text.trimEnd());
    }
    while (out.length && out.at(-1) === '') out.pop();
    return out.join('\n');
}

// "Rapporto di intervento n. 2026/012 - Mario Rossi - targa 06BD529A822E2B20 - 22/10/2026"
// template: il modello scelto dall'utente; se manca (o non produce niente) si usa quello originale.
export function buildSubject(doc, template = '') {
    const values = mailValues(doc);
    return (template.trim() && renderSubject(template, values)) || renderSubject(DEFAULT_MAIL.subject, values);
}

export function buildBody(doc, company = {}, template = '') {
    const values = mailValues(doc, company);
    return (template.trim() && renderBody(template, values)) || renderBody(DEFAULT_MAIL.body, values);
}

export function mailtoUrl(recipients, subject, body) {
    const to = recipients.map((a) => encodeURIComponent(a).replace(/%40/g, '@')).join(',');
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, '\r\n'))}`;
}
