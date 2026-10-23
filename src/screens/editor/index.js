// Rapporto di intervento: cliente, impianto, intervento, misure Testo, foto, note.
// Si salva da solo a ogni modifica (dopo una breve pausa) e quando si esce dalla schermata.
// Qui l'ingresso e l'uscita; le parti stanno negli altri file della cartella:
// form (campi), session (rapporto aperto e salvataggio), units, materials, measures, photos,
// address, send (PDF ed email), actions (chiudi, duplica, elimina).

import * as nav from '../../ui/nav.js';
import * as store from '../../data/store.js';
import { INTERVENTION_TYPES, OUTCOMES } from '../../model/index.js';
import { preloadPdfLibs } from '../../pdf/index.js';
import { checkFiscalCode } from '../../lib/validate.js';
import { formatTime } from '../../lib/dates.js';
import { $, showBoxMsg, toast, canShareFiles } from '../../ui/util.js';
import { session, openSession, touch, flush, showSaveState, lastSaveError, retrySave } from './session.js';
import { FIELDS, fillForm, renderHeader, updateDuration, updateMailInfo, validateCustomer } from './form.js';
import { renderUnits, initUnits } from './units.js';
import { renderMaterials, dropEmptyMaterials, initMaterials } from './materials.js';
import { renderMeasures, initMeasures } from './measures.js';
import { renderPhotos, releasePhotos, initPhotos } from './photos.js';
import { initAddress } from './address.js';
import { initSend } from './send.js';
import { initActions } from './actions.js';

export async function enter(params) {
    const doc = await store.getReport(params.id);
    if (!doc || doc.deletedAt) {
        openSession(null);
        toast('Rapporto non trovato');
        nav.replace('home');
        return;
    }
    openSession(doc);
    fillForm(doc);
    renderHeader(doc);
    showSaveState('saved');
    renderUnits();
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
    if (session.doc) dropEmptyMaterials();
    const saved = await flush();
    if (!saved) alert(`Il rapporto non è stato salvato (${lastSaveError()}). Le ultime modifiche andranno perse: salva un backup o libera spazio e riapri il rapporto.`);
    releasePhotos();
    session.doc = null;
}

export function init() {
    const fillSelect = (id, items, placeholder) => {
        $(id).replaceChildren(new Option(placeholder, ''), ...items.map((i) => new Option(i.label, i.id)));
    };
    fillSelect('e-type', INTERVENTION_TYPES, 'Seleziona…');
    fillSelect('e-outcome', OUTCOMES, 'Seleziona…');

    initUnits();
    initMaterials();
    initMeasures();
    initPhotos();
    initAddress();
    initSend();
    initActions();

    for (const event of ['input', 'change']) {
        $('view-editor').addEventListener(event, (e) => {
            if (!session.doc || !(e.target.id in FIELDS)) return;
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
            $(`e-${which}`).value = formatTime(new Date(), false);
            updateDuration();
            touch();
        });
    }

    $('e-save').addEventListener('click', retrySave);
    $('e-back').addEventListener('click', () => nav.back());

    // chi passa a un'altra app non deve perdere l'ultima modifica
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && nav.current() === 'editor') flush();
    });
}
