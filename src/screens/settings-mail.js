// Testo dell'email nelle impostazioni: oggetto e messaggio con segnaposto, anteprima e ripristino.

import { DEFAULT_MAIL, MAIL_PLACEHOLDERS, buildSubject, buildBody, unknownPlaceholders } from '../model/mail.js';
import { newReport, newUnit, formatReportNumber } from '../model/index.js';
import { CLS } from '../ui/classes.js';
import { $, el, showBoxMsg } from '../ui/util.js';

// Un rapporto d'esempio per l'anteprima (gli stessi dati degli esempi accanto ai segnaposto)
function sampleReport() {
    const doc = newReport({ id: 'esempio0' });
    doc.number = formatReportNumber(Number(doc.date.slice(0, 4)), 12);
    doc.status = 'done';
    doc.customer = { name: 'Mario Rossi', fiscalCode: '', address: 'Via Roma 1\n33170 Pordenone PN', phone: '333 1234567' };
    doc.plant = { plateCode: 'AB12', units: [newUnit('caldaia', { brand: 'Beretta', model: 'Ciao 24', serial: 'SN1' })] };
    doc.intervention = { ...doc.intervention, type: 'ordinaria', outcome: 'ok' };
    return doc;
}

// La ditta come è scritta ora nel modulo; se è vuota, un nome d'esempio, per vedere come finisce la firma
function company() {
    return {
        technician: $('s-co-technician').value.trim() || 'Luca Bianchi',
        name: $('s-co-name').value.trim() || 'Bianchi Srl',
    };
}

function renderPreview() {
    const subject = $('s-mail-subject').value;
    const body = $('s-mail-body').value;
    const doc = sampleReport();
    $('s-mail-preview-subject').textContent = buildSubject(doc, subject);
    $('s-mail-preview-body').textContent = buildBody(doc, company(), body);
    const unknown = unknownPlaceholders(`${subject}\n${body}`);
    showBoxMsg('s-mail-msg', unknown.length ? `Segnaposto che non esiste: ${unknown.join(', ')}. Controlla come è scritto, o scegli uno dei segnaposto qui sopra.` : '', 'warn');
}

// Il testo da salvare: vuoto se è quello originale (così chi non l'ha cambiato segue gli aggiornamenti dell'app)
export function readMail() {
    const clean = (value, original) => {
        const text = value.replace(/\r\n?/g, '\n').trim();
        return text === original.trim() ? '' : text;
    };
    return { subject: clean($('s-mail-subject').value, DEFAULT_MAIL.subject), body: clean($('s-mail-body').value, DEFAULT_MAIL.body) };
}

// I campi mostrano sempre il testo in uso: quello scelto, oppure quello originale
export function fillMail(mail) {
    $('s-mail-subject').value = mail.subject || DEFAULT_MAIL.subject;
    $('s-mail-body').value = mail.body || DEFAULT_MAIL.body;
    renderPreview();
}

export function initMail() {
    // il campo in cui inserire un segnaposto: l'ultimo toccato (di solito il messaggio)
    let target = $('s-mail-body');
    for (const id of ['s-mail-subject', 's-mail-body']) $(id).addEventListener('focus', () => (target = $(id)));

    for (const { key, example } of MAIL_PLACEHOLDERS) {
        const chip = el('button', CLS.mailChip, `{${key}}`);
        chip.type = 'button';
        chip.title = example;
        chip.addEventListener('click', () => {
            target.setRangeText(`{${key}}`, target.selectionStart, target.selectionEnd, 'end');
            target.dispatchEvent(new Event('input', { bubbles: true })); // si salva e si aggiorna l'anteprima
            target.focus();
        });
        $('s-mail-chips').append(chip);
    }

    $('s-mail-reset').addEventListener('click', () => {
        if (!confirm('Tornare all\'oggetto e al messaggio originali? Il testo che hai scritto andrà perso.')) return;
        $('s-mail-subject').value = DEFAULT_MAIL.subject;
        $('s-mail-body').value = DEFAULT_MAIL.body;
        $('s-mail-body').dispatchEvent(new Event('input', { bubbles: true }));
    });

    // l'anteprima segue il testo, e anche il nome della ditta e del tecnico (che finiscono nella firma)
    $('view-settings').addEventListener('input', (e) => {
        if (e.target.id.startsWith('s-mail-') || e.target.id === 's-co-technician' || e.target.id === 's-co-name') renderPreview();
    });
}
