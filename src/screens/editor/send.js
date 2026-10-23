// PDF ed email: salvare il PDF, condividerlo, inviarlo per email. Un rapporto chiuso dopo l'invio risulta "inviato".

import * as store from '../../data/store.js';
import { reportFileName } from '../../model/index.js';
import { createReportPdf } from '../../pdf/index.js';
import { photosForPdf, logoForPdf } from '../../data/photos.js';
import { buildBody, buildSubject, checkRecipients, mailtoUrl } from '../../model/mail.js';
import { loadSettings } from '../../data/settings.js';
import { $, showBoxMsg, downloadFile, openMailto, canShareFiles } from '../../ui/util.js';
import { session, flush, guarded } from './session.js';
import { renderHeader, validateCustomer } from './form.js';

async function buildPdfFile() {
    await flush();
    const settings = loadSettings();
    const [photos, logo] = await Promise.all([photosForPdf(session.doc.id), logoForPdf()]);
    const bytes = await createReportPdf(session.doc, settings, { photos, logo });
    return new File([bytes], reportFileName(session.doc), { type: 'application/pdf' });
}

// dopo l'invio un rapporto chiuso passa a "inviato"
async function markSent() {
    await store.markSent(session.doc);
    renderHeader(session.doc);
}

// condivide il PDF con il menu di Android; se la condivisione parte, il rapporto risulta inviato
async function sharePdf(data) {
    try {
        await navigator.share(data);
    } catch (e) {
        if (e.name === 'AbortError') return; // annullato dall'utente
        if (e.name === 'NotAllowedError') {
            showBoxMsg('report-msg', 'La condivisione non è partita: premi di nuovo il pulsante.', 'error');
            return;
        }
        throw e;
    }
    await markSent();
}

async function onEmail() {
    const settings = loadSettings();
    const recipients = checkRecipients(settings.email);
    const problems = validateCustomer();
    await flush();
    const subject = buildSubject(session.doc, settings.mail.subject);
    const body = buildBody(session.doc, settings.company, settings.mail.body);
    const useShare = settings.method !== 'mailto' && canShareFiles();

    const notes = [];
    if (!recipients.list.length) notes.push('Nessun destinatario impostato: scrivilo in Gmail oppure impostalo dalle impostazioni nella pagina iniziale.');
    else if (!recipients.ok) notes.push(`${recipients.error}.`);
    if (problems.length) notes.push(`Controlla: ${problems.join(', ')}.`);
    // con la condivisione il destinatario non si può precompilare: lo si copia negli appunti
    if (useShare && recipients.list.length) {
        const copied = await navigator.clipboard?.writeText(recipients.list.join(', ')).then(() => true, () => false);
        if (copied) notes.push('Destinatario copiato negli appunti: nel campo "A" toccalo sopra la tastiera.');
    }
    const warn = !recipients.ok || problems.length > 0 || !recipients.list.length;
    if (notes.length) showBoxMsg('report-msg', notes.join(' '), warn ? 'warn' : 'info');

    const file = await buildPdfFile();
    if (useShare && navigator.canShare?.({ files: [file] })) {
        await sharePdf({ files: [file], title: subject, text: body });
        return;
    }
    // Gmail con destinatario, oggetto e testo già compilati; un PDF non si può allegare da una pagina web
    downloadFile(file);
    showBoxMsg('report-msg', [`PDF salvato nei download (${file.name}): in Gmail tocca la graffetta e allegalo.`, ...notes].join(' '), 'info');
    openMailto(mailtoUrl(recipients.list, subject, body));
    await markSent();
}

async function onSave() {
    const problems = validateCustomer();
    const file = await buildPdfFile();
    downloadFile(file);
    if (problems.length) showBoxMsg('report-msg', `PDF salvato, ma controlla: ${problems.join(', ')}.`, 'warn');
    else showBoxMsg('report-msg', `PDF salvato nei download: ${file.name}`, 'success');
}

async function onShare() {
    const problems = validateCustomer();
    if (problems.length) showBoxMsg('report-msg', `Controlla: ${problems.join(', ')}. Il PDF viene creato lo stesso.`, 'warn');
    const file = await buildPdfFile();
    if (!navigator.canShare?.({ files: [file] })) {
        downloadFile(file);
        showBoxMsg('report-msg', `Condivisione non disponibile: PDF salvato nei download (${file.name})`, 'info');
        return;
    }
    await sharePdf({ files: [file], title: file.name });
}

export function initSend() {
    const pdfError = (e) => `Impossibile creare il PDF: ${e.message || e}`;
    for (const [id, action] of [['btn-pdf-email', onEmail], ['btn-pdf-save', onSave], ['btn-pdf-share', onShare]]) {
        $(id).addEventListener('click', () => guarded(action, { button: $(id), error: pdfError }));
    }
}
