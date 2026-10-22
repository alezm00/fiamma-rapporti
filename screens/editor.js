// Rapporto di intervento: cliente, impianto, intervento, misure Testo, foto, note.
// Si salva da solo a ogni modifica (dopo una breve pausa) e quando si esce dalla schermata.

import * as nav from '../nav.js';
import * as store from '../store.js';
import {
    INTERVENTION_TYPES, OUTCOMES, CHAMBERS, TECHNOLOGIES, FUELS, durationMinutes, formatDuration, formatNumber, nextNumber, reportYear,
    timeString, reportFileName, isBlank, TRASH_DAYS,
} from '../model.js';
import { buildReport, formatDate } from '../tjf.js';
import { createReportPdf, preloadPdfLibs } from '../report.js';
import { getPosition, geoErrorMessage, reverseGeocode } from '../geo.js';
import { checkFiscalCode } from '../validate.js';
import { listPhotos, addPhoto, removePhoto, photosForPdf, logoForPdf } from '../photos.js';
import { buildBody, buildSubject, checkRecipients, mailtoUrl } from '../mail.js';
import { loadSettings } from '../settings.js';
import { CLS } from '../ui.js';
import { $, el, showBoxMsg, toast, debounce, downloadFile, openMailto, canShareFiles, statusBadge, explainSaveError } from '../util.js';

const MAX_PHOTOS = 20;

let doc = null;
let dirty = false;
let photoUrls = [];

// campo della pagina -> percorso nel rapporto
const FIELDS = {
    'e-date': 'date',
    'c-name': 'customer.name',
    'c-cf': 'customer.fiscalCode',
    'c-address': 'customer.address',
    'c-phone': 'customer.phone',
    'c-brand': 'plant.brand',
    'c-model': 'plant.model',
    'c-serial': 'plant.serial',
    'c-plate': 'plant.plateCode',
    'c-date': 'plant.installDate',
    'c-chamber': 'plant.chamber',
    'c-technology': 'plant.technology',
    'c-fuel': 'plant.fuel',
    'c-power-nom': 'plant.nominalPower',
    'c-power-real': 'plant.actualPower',
    'e-type': 'intervention.type',
    'e-outcome': 'intervention.outcome',
    'e-work': 'intervention.work',
    'e-start': 'intervention.startTime',
    'e-end': 'intervention.endTime',
    'c-notes': 'intervention.notes',
};

function getPath(path) {
    return path.split('.').reduce((o, k) => o?.[k], doc);
}

function setPath(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => o[k], doc)[last] = value;
}

function fillForm() {
    for (const [id, path] of Object.entries(FIELDS)) $(id).value = getPath(path) ?? '';
}

function readForm() {
    for (const [id, path] of Object.entries(FIELDS)) {
        const value = $(id).value;
        if (id === 'e-date' && !value) continue; // la data dell'intervento non resta vuota
        setPath(path, value);
    }
}

// ---------------------------------------------------------------------------
// Salvataggio
// ---------------------------------------------------------------------------

let saveError = '';

// scritta sotto il titolo: "Salvato 14:32" / "Salvataggio…" / "NON SALVATO: motivo" (si tocca per riprovare)
function showSaveState(state, detail = '') {
    const box = $('e-save');
    if (state === 'error') {
        saveError = detail;
        box.className = CLS.saveErr;
        box.textContent = 'NON SALVATO · tocca per riprovare';
        box.title = detail;
    } else if (state === 'saving') {
        box.className = CLS.saveBusy;
        box.textContent = 'Salvataggio…';
    } else {
        saveError = '';
        box.className = CLS.saveIdle;
        box.textContent = `Salvato ${timeString(new Date(doc?.updatedAt ?? Date.now()))}`;
    }
}

// Salva il rapporto. Restituisce false se non è riuscito: le modifiche restano da salvare
// (si riprova alla modifica successiva, al tocco sulla scritta e all'uscita).
async function saveNow() {
    if (!doc || !dirty) return true;
    const current = doc;
    dirty = false;
    showSaveState('saving');
    try {
        readForm();
        await store.saveReport(current);
    } catch (e) {
        dirty = true;
        console.error(e);
        if (current === doc) {
            showSaveState('error', explainSaveError(e));
            showBoxMsg('report-msg', `Il rapporto non è stato salvato: ${explainSaveError(e)}. Le modifiche restano a schermo: libera spazio e tocca la scritta rossa sotto il titolo per riprovare.`, 'error');
        }
        return false;
    }
    if (current === doc) {
        showSaveState('saved');
        renderHeader();
    }
    return true;
}

const saveLater = debounce(saveNow, 400);

function touch() {
    dirty = true;
    saveLater();
}

const flush = () => saveLater.flush();

// operazioni che cambiano il rapporto o la sua posizione: un errore si vede, non resta silenzioso
async function safely(action) {
    try {
        await action();
    } catch (e) {
        console.error(e);
        showBoxMsg('report-msg', `Operazione non riuscita: ${explainSaveError(e)}.`, 'error');
    }
}

// ---------------------------------------------------------------------------
// Intestazione e stato
// ---------------------------------------------------------------------------

function renderHeader() {
    $('e-title').textContent = doc.number ? `Rapporto n. ${doc.number}` : 'Rapporto';
    $('e-badge').replaceChildren(statusBadge(doc.status));
    $('btn-close').hidden = doc.status !== 'draft';
}

function updateMailInfo() {
    const { list } = checkRecipients(loadSettings().email);
    $('mail-info').textContent = list.length ? `Destinatario: ${list.join(', ')}` : 'Nessun destinatario impostato (si imposta dalle impostazioni nella pagina iniziale).';
}

function updateDuration() {
    const min = durationMinutes($('e-start').value, $('e-end').value);
    $('e-duration').textContent = min == null ? '' : `Durata dell'intervento: ${formatDuration(min)}`;
}

// ---------------------------------------------------------------------------
// Materiali
// ---------------------------------------------------------------------------

function renderMaterials() {
    const box = $('e-materials');
    box.replaceChildren();
    doc.intervention.materials.forEach((m, i) => {
        const row = el('div', CLS.matRow);
        const text = el('input', CLS.matText);
        text.type = 'text';
        text.value = m.text;
        text.placeholder = 'Descrizione';
        text.autocomplete = 'off';
        text.setAttribute('autocapitalize', 'sentences');
        text.setAttribute('aria-label', `Materiale ${i + 1}`);
        text.addEventListener('input', () => {
            m.text = text.value;
            touch();
        });
        const qty = el('input', CLS.matQty);
        qty.type = 'text';
        qty.value = m.qty;
        qty.placeholder = 'Quantità';
        qty.autocomplete = 'off';
        qty.setAttribute('aria-label', `Quantità del materiale ${i + 1}`);
        qty.addEventListener('input', () => {
            m.qty = qty.value;
            touch();
        });
        const del = el('button', CLS.matDel, '✕');
        del.type = 'button';
        del.setAttribute('aria-label', `Togli il materiale ${i + 1}`);
        del.addEventListener('click', () => {
            doc.intervention.materials.splice(i, 1);
            renderMaterials();
            touch();
        });
        row.append(text, qty, del);
        box.append(row);
    });
}

// ---------------------------------------------------------------------------
// Misure Testo
// ---------------------------------------------------------------------------

function renderMeasures() {
    const ul = $('e-measures');
    ul.replaceChildren();
    for (const m of doc.measures) {
        let report;
        try {
            report = buildReport(m.json);
        } catch {
            continue;
        }
        const li = el('li');
        const open = el('button', CLS.historyOpen);
        open.append(el('span', CLS.historyTitle, m.label));
        open.append(el('span', CLS.historyMeta, [report.title, formatDate(report.start || new Date(m.addedAt))].filter(Boolean).join(' · ')));
        const first = report.columns[0];
        const vals = report.rows.slice(0, 4).map((r) => `${r.short || r.label} ${r.cells[first] ?? ''}`).join(' · ');
        if (vals) open.append(el('span', CLS.historyVals, vals));
        open.addEventListener('click', () => nav.go('measure', { source: 'report', reportId: doc.id, measureId: m.id }));
        li.append(open);
        ul.append(li);
    }
    $('e-measures-empty').hidden = doc.measures.length > 0;
}

// ---------------------------------------------------------------------------
// Controllo del codice fiscale: avviso sotto il campo, non blocca mai il PDF
// ---------------------------------------------------------------------------

// restituisce i nomi dei campi da controllare
function validateCustomer() {
    const r = checkFiscalCode($('c-cf').value);
    $('cf-hint').hidden = r.ok;
    $('cf-hint').textContent = r.ok ? '' : r.error;
    return r.ok ? [] : ['codice fiscale'];
}

// ---------------------------------------------------------------------------
// Foto
// ---------------------------------------------------------------------------

async function renderPhotos() {
    const current = doc;
    const photos = await listPhotos(current.id);
    if (current !== doc) return; // nel frattempo si è aperto un altro rapporto
    photoUrls.forEach((url) => URL.revokeObjectURL(url));
    photoUrls = [];
    const grid = $('photo-grid');
    grid.replaceChildren();
    for (const photo of photos) {
        const url = URL.createObjectURL(photo.blob);
        photoUrls.push(url);
        const cell = el('div', CLS.photo);
        const img = el('img', CLS.photoImg);
        img.src = url;
        img.alt = 'Foto';
        img.addEventListener('click', () => {
            $('photo-view').querySelector('img').src = url;
            $('photo-view').hidden = false;
        });
        const del = el('button', CLS.photoDel, '✕');
        del.type = 'button';
        del.setAttribute('aria-label', 'Elimina foto');
        del.addEventListener('click', async () => {
            if (!confirm('Eliminare questa foto?')) return;
            await removePhoto(photo.id);
            renderPhotos();
        });
        cell.append(img, del);
        grid.append(cell);
    }
    $('photo-count').textContent = photos.length ? `(${photos.length} di ${MAX_PHOTOS})` : '';
    if (doc.photoCount !== photos.length) {
        doc.photoCount = photos.length;
        touch();
    }
}

async function addPhotoFiles(files) {
    const current = doc;
    const room = MAX_PHOTOS - (await listPhotos(current.id)).length;
    if (room <= 0) {
        showBoxMsg('photo-msg', `Massimo ${MAX_PHOTOS} foto per rapporto: elimina una foto per aggiungerne altre.`, 'warn');
        return;
    }
    const batch = files.slice(0, room);
    let error = '';
    for (const [i, file] of batch.entries()) {
        showBoxMsg('photo-msg', `Elaboro la foto ${i + 1} di ${batch.length}…`);
        try {
            await addPhoto(current.id, file);
            if (current === doc) await renderPhotos();
        } catch (e) {
            error = e.name === 'QuotaExceededError' ? 'Memoria del telefono piena: libera spazio e riprova.' : `Foto non aggiunta: ${e.message || e}`;
            break;
        }
    }
    if (error) showBoxMsg('photo-msg', error, 'error');
    else if (files.length > batch.length) showBoxMsg('photo-msg', `Massimo ${MAX_PHOTOS} foto per rapporto: ne ho aggiunte ${batch.length}.`, 'warn');
    else showBoxMsg('photo-msg', '');
}

// ---------------------------------------------------------------------------
// PDF ed email
// ---------------------------------------------------------------------------

async function buildPdfFile() {
    await flush();
    const settings = loadSettings();
    const [photos, logo] = await Promise.all([photosForPdf(doc.id), logoForPdf()]);
    const bytes = await createReportPdf(doc, settings, { photos, logo });
    return new File([bytes], reportFileName(doc), { type: 'application/pdf' });
}

async function runPdf(button, action) {
    button.disabled = true;
    showBoxMsg('report-msg', '');
    try {
        await action();
    } catch (e) {
        showBoxMsg('report-msg', `Impossibile creare il PDF: ${e.message || e}`, 'error');
    } finally {
        button.disabled = false;
    }
}

// dopo l'invio un rapporto chiuso passa a "inviato"
async function markSent() {
    await store.markSent(doc);
    renderHeader();
}

// condivide il PDF con il menu di Android; false se l'utente ha annullato o non è partita
async function shareFile(data) {
    try {
        await navigator.share(data);
        return true;
    } catch (e) {
        if (e.name === 'AbortError') return false; // annullato dall'utente
        if (e.name === 'NotAllowedError') {
            showBoxMsg('report-msg', 'La condivisione non è partita: premi di nuovo il pulsante.', 'error');
            return false;
        }
        throw e;
    }
}

async function onEmail() {
    const settings = loadSettings();
    const recipients = checkRecipients(settings.email);
    const problems = validateCustomer();
    await flush();
    const subject = buildSubject(doc);
    const body = buildBody(doc, settings.company);
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
        if (await shareFile({ files: [file], title: subject, text: body })) await markSent();
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
    if (await shareFile({ files: [file], title: file.name })) await markSent();
}

// ---------------------------------------------------------------------------
// Chiusura, duplicazione, eliminazione
// ---------------------------------------------------------------------------

async function onClose() {
    await flush();
    const year = reportYear(doc);
    const number = formatNumber(year, nextNumber(loadSettings().counters, year));
    const missing = doc.customer.name.trim() ? '' : 'Manca il nome del cliente. ';
    if (!confirm(`${missing}Chiudere il rapporto? Prenderà il numero ${number}.`)) return;
    await store.close(doc);
    renderHeader();
    showBoxMsg('report-msg', `Rapporto chiuso: numero ${doc.number}.`, 'success');
}

async function onDuplicate() {
    await flush();
    const copy = await store.duplicate(doc);
    toast('Nuova bozza con i dati di cliente e impianto');
    nav.replace('editor', { id: copy.id, isNew: true });
}

async function onDelete() {
    const what = doc.number ? `Il rapporto n. ${doc.number}` : 'La bozza';
    const blank = isBlank(doc, loadSettings().defaults); // bozza mai compilata: non serve il cestino
    if (!blank && !confirm(`${what} va nel cestino: si recupera entro ${TRASH_DAYS} giorni dalla schermata Cestino dell'elenco. Continuare?`)) return;
    if (!(await flush())) return; // le ultime modifiche non sono salvate: meglio non andare avanti
    const id = doc.id;
    doc = null; // niente salvataggi dopo l'eliminazione
    if (blank) await store.purgeReport(id);
    else await store.trashReport(id);
    toast(blank ? 'Bozza eliminata' : 'Rapporto nel cestino');
    nav.back();
}

// ---------------------------------------------------------------------------
// Schermata
// ---------------------------------------------------------------------------

export async function enter(params) {
    dirty = false;
    doc = await store.getReport(params.id);
    if (!doc || doc.deletedAt) {
        doc = null;
        toast('Rapporto non trovato');
        nav.replace('home');
        return;
    }
    fillForm();
    renderHeader();
    showSaveState('saved');
    renderMaterials();
    renderMeasures();
    updateDuration();
    updateMailInfo();
    validateCustomer();
    for (const id of ['geo-msg', 'report-msg', 'photo-msg']) showBoxMsg(id, '');
    $('btn-pdf-share').hidden = !canShareFiles();
    preloadPdfLibs().catch(() => {}); // pronte quando si preme "Invia" o "Condividi", altrimenti il telefono può negare la condivisione
    await renderPhotos();
}

export async function leave() {
    if (doc) {
        // righe dei materiali rimaste vuote
        const before = doc.intervention.materials.length;
        doc.intervention.materials = doc.intervention.materials.filter((m) => m.text.trim() || m.qty.trim());
        if (doc.intervention.materials.length !== before) touch();
    }
    const saved = await flush();
    if (!saved) alert(`Il rapporto non è stato salvato (${saveError}). Le ultime modifiche andranno perse: salva un backup o libera spazio e riapri il rapporto.`);
    photoUrls.forEach((url) => URL.revokeObjectURL(url));
    photoUrls = [];
    $('photo-view').hidden = true;
    doc = null;
}

export function init() {
    const fillSelect = (id, items, placeholder) => {
        $(id).replaceChildren(new Option(placeholder, ''), ...items.map((i) => new Option(i.label, i.id)));
    };
    fillSelect('e-type', INTERVENTION_TYPES, 'Seleziona…');
    fillSelect('e-outcome', OUTCOMES, 'Seleziona…');
    fillSelect('c-chamber', CHAMBERS, 'Non indicata');
    fillSelect('c-technology', TECHNOLOGIES, 'Non indicato');
    fillSelect('c-fuel', FUELS, 'Non indicato');

    for (const event of ['input', 'change']) {
        $('view-editor').addEventListener(event, (e) => {
            if (!doc || !(e.target.id in FIELDS)) return;
            if (e.target.id === 'c-cf' && event === 'input') $('cf-hint').hidden = true; // l'avviso riappare a campo finito
            if (e.target.id === 'e-start' || e.target.id === 'e-end') updateDuration();
            touch();
        });
    }
    $('c-cf').addEventListener('change', () => {
        $('c-cf').value = checkFiscalCode($('c-cf').value).value; // maiuscolo, senza spazi
        validateCustomer();
    });

    for (const which of ['start', 'end']) {
        $(`e-${which}-now`).addEventListener('click', () => {
            $(`e-${which}`).value = timeString(new Date());
            updateDuration();
            touch();
        });
    }
    $('e-mat-add').addEventListener('click', () => {
        doc.intervention.materials.push({ text: '', qty: '' });
        renderMaterials();
        $('e-materials').lastElementChild.querySelector('input').focus();
        touch();
    });
    $('e-measure-add').addEventListener('click', () => nav.go('scan', { mode: 'attach', reportId: doc.id }));

    // indirizzo dalla posizione del telefono
    $('btn-geo').addEventListener('click', async () => {
        const btn = $('btn-geo');
        btn.disabled = true;
        try {
            showBoxMsg('geo-msg', 'Rilevo la posizione…');
            let pos;
            try {
                pos = await getPosition();
            } catch (e) {
                showBoxMsg('geo-msg', geoErrorMessage(e), 'error');
                return;
            }
            const { latitude, longitude, accuracy } = pos.coords;
            showBoxMsg('geo-msg', 'Cerco l\'indirizzo…');
            try {
                const address = await reverseGeocode(latitude.toFixed(6), longitude.toFixed(6));
                if (!doc) return;
                $('c-address').value = address;
                touch();
                showBoxMsg('geo-msg', `Indirizzo trovato (precisione circa ${Math.round(accuracy)} m). Controllalo prima di creare il PDF.`, 'success');
            } catch {
                showBoxMsg('geo-msg', `Posizione trovata (${latitude.toFixed(5)}, ${longitude.toFixed(5)}) ma non riesco a ricavare l'indirizzo (serve internet). Inseriscilo a mano.`, 'error');
            }
        } finally {
            btn.disabled = false;
        }
    });

    for (const id of ['in-shoot', 'in-gallery']) {
        $(id).addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            e.target.value = '';
            if (files.length && doc) addPhotoFiles(files);
        });
    }
    $('photo-view').addEventListener('click', () => ($('photo-view').hidden = true));

    $('btn-pdf-email').addEventListener('click', () => runPdf($('btn-pdf-email'), onEmail));
    $('btn-pdf-save').addEventListener('click', () => runPdf($('btn-pdf-save'), onSave));
    $('btn-pdf-share').addEventListener('click', () => runPdf($('btn-pdf-share'), onShare));
    $('btn-close').addEventListener('click', () => safely(onClose));
    $('btn-duplicate').addEventListener('click', () => safely(onDuplicate));
    $('btn-delete').addEventListener('click', () => safely(onDelete));
    $('e-save').addEventListener('click', () => {
        if (!saveError) return;
        dirty = true;
        saveNow();
    });
    $('e-back').addEventListener('click', () => nav.back());

    // chi passa a un'altra app non deve perdere l'ultima modifica
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && nav.current() === 'editor') flush();
    });
}
