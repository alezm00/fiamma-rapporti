// Impostazioni: ditta e tecnico, logo, numerazione, email, dati predefiniti dei nuovi rapporti.

import * as nav from '../nav.js';
import { loadSettings, updateSettings } from '../settings.js';
import { formatNumber, nextNumber, setNextNumber, UNIT_KINDS, unitKind } from '../model.js';
import { checkRecipients } from '../mail.js';
import { getLogo, setLogo, removeLogo } from '../photos.js';
import * as folder from '../folder.js';
import { createBackup, restoreBackup } from '../backup.js';
import { CLS } from '../ui.js';
import { $, el, showBoxMsg, debounce, downloadFile } from '../util.js';

// wide = il campo occupa tutta la riga, gli altri stanno in due colonne
const COMPANY_DEFS = [
    { key: 'name', label: 'Ragione sociale', capitalize: 'words', wide: true },
    { key: 'vat', label: 'Partita IVA', inputmode: 'numeric' },
    { key: 'phone', label: 'Telefono', type: 'tel' },
    { key: 'address', label: 'Indirizzo', rows: 2, capitalize: 'words', wide: true },
    { key: 'email', label: 'Email', type: 'email', capitalize: 'none', wide: true },
    { key: 'technician', label: 'Nome del tecnico', capitalize: 'words', wide: true },
];

// campi del cliente e dell'impianto che si possono precompilare nei nuovi rapporti
const DEFAULT_DEFS = [
    { key: 'name', label: 'Nome e cognome', capitalize: 'words', wide: true },
    { key: 'fiscalCode', label: 'Codice fiscale', capitalize: 'characters' },
    { key: 'phone', label: 'Telefono', type: 'tel' },
    { key: 'address', label: 'Indirizzo', rows: 2, capitalize: 'words', wide: true },
    { key: 'plateCode', label: 'Targa impianto', capitalize: 'characters', wide: true },
];
const NOTES_DEF = { key: 'notes', label: 'Note', rows: 3, capitalize: 'sentences', wide: true };

// il primo apparecchio dei nuovi rapporti: del tipo scelto qui, con i suoi dati
const KIND_OPTIONS = [{ id: 'none', label: 'Nessuno' }, ...UNIT_KINDS.map((k) => ({ id: k.id, label: k.label }))];
const UNIT_CAPS = { brand: 'words', model: 'characters', serial: 'characters' };
const unitDefs = (kindId) => (unitKind(kindId)?.fields ?? []).map((f) => ({
    key: f.key,
    label: f.unit ? `${f.label} (${f.unit})` : f.label,
    options: f.options,
    type: f.date ? 'date' : 'text',
    inputmode: f.decimal ? 'decimal' : undefined,
    capitalize: UNIT_CAPS[f.key],
}));
const currentKind = () => $('s-d-unitkind').value;
let shownKind = 'caldaia'; // di che tipo sono i campi dell'apparecchio mostrati ora
let rendering = false; // mentre i campi si ricostruiscono, il browser può lanciare eventi di chi sta sparendo: si ignorano

// un campo con la sua etichetta (testo, data, menu o area di testo)
function fieldElement(def, id) {
    const label = el('label', def.wide ? CLS.fieldWide : CLS.field);
    label.append(el('span', CLS.fieldLabel, def.label));
    let input;
    if (def.options) {
        input = el('select', CLS.select);
        input.append(new Option(def.noneLabel ?? 'Non indicato', ''), ...def.options.map((o) => new Option(o.label, o.id)));
    } else {
        input = def.rows ? el('textarea', CLS.textarea) : el('input', def.type === 'date' ? CLS.dateInput : CLS.input);
        if (def.rows) input.rows = def.rows;
        else input.type = def.type || 'text';
    }
    input.id = id;
    if (def.inputmode) input.inputMode = def.inputmode;
    input.autocomplete = 'off';
    if (def.capitalize) input.setAttribute('autocapitalize', def.capitalize);
    label.append(input);
    return label;
}

function buildFields(boxId, prefix, defs) {
    $(boxId).append(...defs.map((def) => fieldElement(def, `${prefix}${def.key}`)));
}

// i campi dell'apparecchio predefinito cambiano col tipo scelto
function renderUnitDefaults(kindId, values) {
    const fields = unitDefs(kindId).map((def) => {
        const field = fieldElement(def, `s-d-u-${def.key}`);
        field.querySelector('input, select').value = values[def.key] || '';
        return field;
    });
    rendering = true;
    try {
        $('s-d-unit').replaceChildren(...fields);
        shownKind = kindId;
    } finally {
        rendering = false;
    }
}

const year = () => new Date().getFullYear();

function fillNumbering(counters) {
    const y = year();
    $('s-next-label').textContent = `Prossimo numero del ${y}`;
    $('s-next').value = nextNumber(counters, y);
    $('s-next-hint').textContent = `Il prossimo rapporto chiuso con data nel ${y} sarà il n. ${formatNumber(y, nextNumber(counters, y))}.`;
}

let logoUrl = null;
async function showLogo() {
    const logo = await getLogo();
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    logoUrl = logo ? URL.createObjectURL(logo.blob) : null;
    if (logoUrl) $('s-logo-img').src = logoUrl;
    $('s-logo-img').hidden = !logo;
    $('s-logo-del').hidden = !logo;
}

function fill() {
    const s = loadSettings();
    $('s-email').value = s.email;
    for (const radio of document.querySelectorAll('input[name="s-method"]')) radio.checked = radio.value === s.method;
    for (const def of [...DEFAULT_DEFS, NOTES_DEF]) $(`s-d-${def.key}`).value = s.defaults[def.key] || '';
    $('s-d-unitkind').value = s.defaults.unitKind ?? 'caldaia'; // come prima: una caldaia
    renderUnitDefaults(currentKind(), s.defaults);
    for (const def of COMPANY_DEFS) $(`s-co-${def.key}`).value = s.company[def.key] || '';
    $('s-email-hint').hidden = true;
    fillNumbering(s.counters);
}

function persist() {
    if (rendering) return;
    // si parte da quelli già salvati: i campi di un altro tipo di apparecchio non si perdono cambiando tipo
    const defaults = { ...loadSettings().defaults, unitKind: currentKind() };
    const inputs = [...DEFAULT_DEFS, NOTES_DEF].map((def) => [def.key, $(`s-d-${def.key}`)]);
    inputs.push(...unitDefs(shownKind).map((def) => [def.key, $(`s-d-u-${def.key}`)]));
    for (const [key, input] of inputs) {
        if (input.value.trim()) defaults[key] = input.value;
        else delete defaults[key];
    }
    const company = {};
    for (const def of COMPANY_DEFS) company[def.key] = $(`s-co-${def.key}`).value.trim();
    updateSettings({
        email: $('s-email').value.trim(),
        method: document.querySelector('input[name="s-method"]:checked')?.value === 'mailto' ? 'mailto' : 'share',
        defaults,
        company,
    });
}

const persistLater = debounce(persist, 300);

// ---------------------------------------------------------------------------
// Cartella di salvataggio e backup
// ---------------------------------------------------------------------------

const when = (ms) => new Date(ms).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

async function renderFolder() {
    const st = await folder.status();
    const lines = [];
    if (!st.linked) lines.push(st.supported ? 'Non collegata.' : 'Non disponibile in questo browser (serve Chrome recente su Android). Usa il backup in un file qui sotto.');
    else {
        lines.push(st.permission === 'granted' ? `Collegata: «${st.name}».` : `Sospesa: «${st.name}». Il telefono chiede di nuovo il permesso.`);
        if (st.lastWrite) lines.push(`Ultima copia: ${when(st.lastWrite)}.`);
        if (st.pending) lines.push(`${st.pending} ${st.pending === 1 ? 'modifica in attesa' : 'modifiche in attesa'} di essere copiate.`);
    }
    $('s-folder-status').textContent = lines.join(' ');
    $('s-folder-link').hidden = st.linked || !st.supported;
    $('s-folder-reactivate').hidden = !(st.linked && st.permission !== 'granted');
    $('s-folder-tools').hidden = !st.linked;
    if (st.error) showBoxMsg('s-folder-msg', st.error, 'error');
    const last = loadSettings().lastBackup;
    $('s-backup-last').textContent = last ? `Ultima copia di sicurezza (cartella o file): ${when(last)}.` : 'Nessuna copia di sicurezza fatta finora.';
}

// esegue un'azione sul pulsante, con il messaggio dell'esito
async function runFolder(button, action) {
    button.disabled = true;
    showBoxMsg('s-folder-msg', '');
    try {
        await action();
    } catch (e) {
        showBoxMsg('s-folder-msg', folder.explain(e), 'error');
    } finally {
        button.disabled = false;
        await renderFolder();
    }
}

// la domanda quando la cartella scelta contiene già delle impostazioni
function askSettings(handle, { settings, modified }) {
    const who = [settings.company.name, settings.email].filter(Boolean).join(', ');
    return `Nella cartella «${handle.name}» ci sono impostazioni salvate${modified ? ` il ${when(modified)}` : ''}${who ? ` (${who})` : ''}.\n\nCaricarle al posto di quelle di questo telefono? Valgono ditta, email, dati predefiniti e logo; il numero progressivo dei rapporti non torna mai indietro.`;
}

function initFolder() {
    folder.events.addEventListener('state', () => nav.current() === 'settings' && renderFolder());

    // Scegli cartella: se dentro ci sono già delle impostazioni, si chiede se prenderle e ricaricarle
    $('s-folder-link').addEventListener('click', () => runFolder($('s-folder-link'), async () => {
        const handle = await folder.pick();
        if (!handle) return; // annullato
        const found = await folder.peekSettings(handle);
        const take = !!found && confirm(askSettings(handle, found));
        await folder.linkHandle(handle, { fromFolder: take });
        if (take) {
            fill();
            await showLogo();
        }
        showBoxMsg('s-folder-msg', `${take ? 'Impostazioni caricate dalla cartella. ' : ''}Cartella collegata: sto copiando i rapporti. Tocca "Prova cartella" per controllare che funzioni.`, 'success');
    }));
    $('s-folder-reactivate').addEventListener('click', () => runFolder($('s-folder-reactivate'), async () => {
        if ((await folder.reactivate()) !== 'granted') showBoxMsg('s-folder-msg', 'Permesso non concesso: senza, la copia non può partire.', 'warn');
    }));
    $('s-folder-sync').addEventListener('click', () => runFolder($('s-folder-sync'), async () => {
        await folder.reactivate();
        await folder.syncAll();
        const st = await folder.status();
        if (!st.error) showBoxMsg('s-folder-msg', st.permission === 'granted' ? 'Copia completata.' : 'Cartella sospesa: riattivala per copiare.', st.permission === 'granted' ? 'success' : 'warn');
    }));
    $('s-folder-test').addEventListener('click', () => runFolder($('s-folder-test'), async () => {
        await folder.test();
        showBoxMsg('s-folder-msg', 'Prova riuscita: ho scritto e riletto un file nella cartella.', 'success');
    }));
    $('s-folder-restore').addEventListener('click', () => runFolder($('s-folder-restore'), async () => {
        if (!confirm('Ripristinare dalla cartella? I rapporti trovati si uniscono a quelli del telefono: a parità di rapporto vince la modifica più recente.')) return;
        const r = await folder.restore();
        showBoxMsg('s-folder-msg', `Ripristinati ${r.reports} rapporti e ${r.photos} foto${r.skipped ? ` (${r.skipped} cartelle non leggibili)` : ''}.`, r.skipped ? 'warn' : 'success');
    }));
    $('s-folder-unlink').addEventListener('click', () => runFolder($('s-folder-unlink'), async () => {
        if (!confirm('Scollegare la cartella? I file già copiati restano dove sono; le nuove modifiche non vengono più copiate.')) return;
        await folder.unlink();
    }));

    $('s-backup-save').addEventListener('click', async () => {
        const button = $('s-backup-save');
        button.disabled = true;
        try {
            const r = await createBackup({ withPhotos: $('s-backup-photos').checked });
            downloadFile(new File([r.blob], r.name, { type: 'application/zip' }));
            showBoxMsg('s-backup-msg', `Backup scaricato: ${r.name} (${r.reports} rapporti${$('s-backup-photos').checked ? `, ${r.photos} foto` : ', senza foto'}).`, 'success');
        } catch (e) {
            showBoxMsg('s-backup-msg', `Backup non riuscito: ${e.message || e}`, 'error');
        } finally {
            button.disabled = false;
            renderFolder();
        }
    });
    $('s-backup-in').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        if (!confirm('Ripristinare dal backup? I rapporti si uniscono a quelli del telefono: a parità di rapporto vince la modifica più recente.')) return;
        try {
            const r = await restoreBackup(file);
            showBoxMsg('s-backup-msg', `Ripristinati ${r.reports} rapporti e ${r.photos} foto${r.skipped ? ` (${r.skipped} non leggibili)` : ''}.`, r.skipped ? 'warn' : 'success');
            fill();
            await showLogo();
        } catch (err) {
            showBoxMsg('s-backup-msg', `Ripristino non riuscito: ${err.message || err}`, 'error');
        }
    });
}

export async function enter() {
    fill();
    for (const id of ['s-logo-msg', 's-folder-msg', 's-backup-msg']) showBoxMsg(id, '');
    await Promise.all([showLogo(), renderFolder()]);
}

export function leave() {
    persistLater.flush();
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    logoUrl = null;
}

export function init() {
    buildFields('s-company', 's-co-', COMPANY_DEFS);
    buildFields('s-defaults', 's-d-', DEFAULT_DEFS);
    // apparecchio dei nuovi rapporti: tipo e dati; poi le note
    const kindField = fieldElement({ key: 'unitkind', label: 'Apparecchio dei nuovi rapporti', options: KIND_OPTIONS, wide: true }, 's-d-unitkind');
    const kindSelect = kindField.querySelector('select');
    kindSelect.firstElementChild.remove(); // niente voce vuota: "Nessuno" è una scelta
    $('s-defaults').append(kindField);
    const unitBox = el('div', CLS.defaultsUnit);
    unitBox.id = 's-d-unit';
    $('s-defaults').append(unitBox);
    buildFields('s-defaults', 's-d-', [NOTES_DEF]);
    kindSelect.addEventListener('change', () => {
        persist(); // salva i valori del tipo di prima, poi mostra quelli del nuovo tipo
        renderUnitDefaults(currentKind(), loadSettings().defaults);
    });

    $('btn-settings-back').addEventListener('click', () => nav.back());
    initFolder();

    $('view-settings').addEventListener('input', (e) => {
        if (e.target.id === 's-next' || e.target.id === 's-logo-in') return;
        $('s-email-hint').hidden = true; // l'avviso riappare a campo finito
        persistLater();
    });
    $('view-settings').addEventListener('change', (e) => {
        if (e.target.id === 's-next' || e.target.id === 's-logo-in') return;
        persist();
        const r = checkRecipients($('s-email').value);
        $('s-email-hint').hidden = r.ok;
        $('s-email-hint').textContent = r.ok ? '' : r.error;
    });

    // numero del prossimo rapporto (a campo finito, non a ogni cifra)
    $('s-next').addEventListener('change', () => {
        const value = Math.floor(Number($('s-next').value));
        const counters = setNextNumber(loadSettings().counters, year(), value >= 1 ? value : 1);
        updateSettings({ counters });
        fillNumbering(counters);
    });

    $('s-logo-in').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
            await setLogo(file);
            showBoxMsg('s-logo-msg', '');
        } catch (err) {
            showBoxMsg('s-logo-msg', `Logo non aggiunto: ${err.message || err}`, 'error');
        }
        await showLogo();
    });
    $('s-logo-del').addEventListener('click', async () => {
        await removeLogo();
        await showLogo();
    });

    $('btn-defaults-clear').addEventListener('click', () => {
        if (!confirm('Svuotare tutti i dati predefiniti?')) return;
        updateSettings({ defaults: {} });
        fill();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && nav.current() === 'settings') persistLater.flush();
    });
}
