// Il rapporto aperto nell'editor e il suo salvataggio: automatico a ogni modifica (dopo una breve pausa),
// con l'esito sempre visibile sotto il titolo.

import * as store from '../../data/store.js';
import { formatTime } from '../../lib/dates.js';
import { CLS } from '../../ui/classes.js';
import { $, showBoxMsg, debounce, explainSaveError } from '../../ui/util.js';
import { readForm, renderHeader } from './form.js';

// il rapporto aperto (null quando l'editor è chiuso)
export const session = { doc: null };

let saveError = '';
let dirty = false; // modifiche non ancora salvate

export function openSession(doc) {
    session.doc = doc;
    dirty = false;
}

// scritta sotto il titolo: "Salvato 14:32" / "Salvataggio…" / "NON SALVATO: motivo" (si tocca per riprovare)
export function showSaveState(state, detail = '') {
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
        box.textContent = `Salvato ${formatTime(new Date(session.doc?.updatedAt ?? Date.now()), false)}`;
    }
}

// Salva il rapporto. Restituisce false se non è riuscito: le modifiche restano da salvare
// (si riprova alla modifica successiva, al tocco sulla scritta e all'uscita).
export async function saveNow() {
    if (!session.doc || !dirty) return true;
    const current = session.doc;
    dirty = false;
    showSaveState('saving');
    try {
        readForm(session.doc);
        await store.saveReport(current);
    } catch (e) {
        dirty = true;
        console.error(e);
        if (current === session.doc) {
            showSaveState('error', explainSaveError(e));
            showBoxMsg('report-msg', `Il rapporto non è stato salvato: ${explainSaveError(e)}. Le modifiche restano a schermo: libera spazio e tocca la scritta rossa sotto il titolo per riprovare.`, 'error');
        }
        return false;
    }
    if (current === session.doc) {
        showSaveState('saved');
        renderHeader(session.doc);
    }
    return true;
}

const saveLater = debounce(saveNow, 400);

export function touch() {
    dirty = true;
    saveLater();
}

export const flush = () => saveLater.flush();

export const lastSaveError = () => saveError;

// tocco sulla scritta rossa: si riprova a salvare
export function retrySave() {
    if (!saveError) return;
    dirty = true;
    saveNow();
}

// Esegue un'azione del rapporto: un errore si vede, non resta silenzioso. Con un pulsante, questo resta
// disattivato finché l'azione lavora (il PDF può richiedere qualche secondo).
export async function guarded(action, { button, error = (e) => `Operazione non riuscita: ${explainSaveError(e)}.` } = {}) {
    if (button) {
        button.disabled = true;
        showBoxMsg('report-msg', '');
    }
    try {
        await action();
    } catch (e) {
        console.error(e);
        showBoxMsg('report-msg', error(e), 'error');
    } finally {
        if (button) button.disabled = false;
    }
}
