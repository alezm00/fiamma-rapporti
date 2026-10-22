// Impostazioni: ditta e tecnico, logo, numerazione, email, dati predefiniti dei nuovi rapporti.

import * as nav from '../nav.js';
import { loadSettings, updateSettings } from '../settings.js';
import { formatNumber, nextNumber, setNextNumber } from '../model.js';
import { checkRecipients } from '../mail.js';
import { getLogo, setLogo, removeLogo } from '../photos.js';
import { CLS } from '../ui.js';
import { $, el, showBoxMsg, debounce } from '../util.js';

const COMPANY_DEFS = [
    { key: 'name', label: 'Ragione sociale', capitalize: 'words' },
    { key: 'vat', label: 'Partita IVA', inputmode: 'numeric' },
    { key: 'address', label: 'Indirizzo', rows: 2, capitalize: 'words' },
    { key: 'phone', label: 'Telefono', type: 'tel' },
    { key: 'email', label: 'Email', type: 'email', capitalize: 'none' },
    { key: 'technician', label: 'Nome del tecnico', capitalize: 'words' },
];

// campi che si possono precompilare nei nuovi rapporti
const DEFAULT_DEFS = [
    { key: 'name', label: 'Nome e cognome', capitalize: 'words' },
    { key: 'fiscalCode', label: 'Codice fiscale', capitalize: 'characters' },
    { key: 'address', label: 'Indirizzo', rows: 2, capitalize: 'words' },
    { key: 'phone', label: 'Telefono', type: 'tel' },
    { key: 'brand', label: 'Marca caldaia', capitalize: 'words' },
    { key: 'serial', label: 'Matricola / codice caldaia', capitalize: 'characters' },
    { key: 'plateCode', label: 'Targa impianto', capitalize: 'characters' },
    { key: 'installDate', label: 'Data di installazione', type: 'date' },
    { key: 'notes', label: 'Note', rows: 4, capitalize: 'sentences' },
];

function buildFields(boxId, prefix, defs) {
    const box = $(boxId);
    for (const def of defs) {
        const label = el('label', CLS.field);
        label.append(el('span', CLS.fieldLabel, def.label));
        const input = def.rows ? el('textarea', CLS.textarea) : el('input', def.type === 'date' ? CLS.dateInput : CLS.input);
        input.id = `${prefix}${def.key}`;
        if (def.rows) input.rows = def.rows;
        else input.type = def.type || 'text';
        if (def.inputmode) input.inputMode = def.inputmode;
        input.autocomplete = 'off';
        if (def.capitalize) input.setAttribute('autocapitalize', def.capitalize);
        label.append(input);
        box.append(label);
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
    for (const def of DEFAULT_DEFS) $(`s-d-${def.key}`).value = s.defaults[def.key] || '';
    for (const def of COMPANY_DEFS) $(`s-co-${def.key}`).value = s.company[def.key] || '';
    $('s-email-hint').hidden = true;
    fillNumbering(s.counters);
}

function persist() {
    const defaults = {};
    for (const def of DEFAULT_DEFS) {
        const value = $(`s-d-${def.key}`).value;
        if (value.trim()) defaults[def.key] = value;
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

export async function enter() {
    fill();
    showBoxMsg('s-logo-msg', '');
    await showLogo();
}

export function leave() {
    persistLater.flush();
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    logoUrl = null;
}

export function init() {
    buildFields('s-company', 's-co-', COMPANY_DEFS);
    buildFields('s-defaults', 's-d-', DEFAULT_DEFS);

    $('btn-settings-back').addEventListener('click', () => nav.back());

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
        for (const def of DEFAULT_DEFS) $(`s-d-${def.key}`).value = '';
        persist();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && nav.current() === 'settings') persistLater.flush();
    });
}
