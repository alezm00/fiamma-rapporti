// Funzioni di utilità condivise dalle schermate.
import { MSG, MSG_TYPES, TOAST, CLS, BADGES } from './ui.js';
import { STATUSES } from './model.js';

export const $ = (id) => document.getElementById(id);

export function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
}

// Un campo con la sua etichetta (testo, data, menu o area di testo) da una definizione:
// { label, unit, options, date, decimal, rows, type, inputmode, capitalize, wide }
export function fieldElement(def, id) {
    const label = el('label', def.wide ? CLS.fieldWide : CLS.field);
    label.append(el('span', CLS.fieldLabel, def.unit ? `${def.label} (${def.unit})` : def.label));
    let input;
    if (def.options) {
        input = el('select', CLS.select);
        input.append(new Option('Non indicato', ''), ...def.options.map((o) => new Option(o.label, o.id)));
    } else if (def.rows) {
        input = el('textarea', CLS.textarea);
        input.rows = def.rows;
    } else {
        input = el('input', def.date ? CLS.dateInput : CLS.input);
        input.type = def.date ? 'date' : def.type || 'text';
    }
    input.id = id;
    if (def.decimal) input.inputMode = 'decimal';
    else if (def.inputmode) input.inputMode = def.inputmode;
    input.autocomplete = 'off';
    if (def.capitalize) input.setAttribute('autocapitalize', def.capitalize);
    label.append(input);
    return label;
}

// messaggio in un riquadro colorato: type = success | error | warn | info
export function showBoxMsg(id, text, type = 'info') {
    const box = $(id);
    box.textContent = text;
    box.className = `${MSG} ${MSG_TYPES[type] ?? ''}`;
    box.dataset.type = type;
    box.hidden = !text;
}

// etichetta colorata dello stato del rapporto (Bozza / Completato / Inviato)
export const statusBadge = (status) => el('span', `${CLS.badge} ${BADGES[status] ?? ''}`, STATUSES[status] ?? '');

let toastTimer;
export function toast(text, type = 'success') {
    const t = $('toast');
    t.textContent = text;
    t.className = `${TOAST} ${MSG_TYPES[type] ?? ''}`;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), type === 'error' ? 4500 : 1800);
}

// motivo leggibile di un salvataggio non riuscito
export function explainSaveError(e) {
    if (e?.name === 'QuotaExceededError') return 'memoria piena: libera spazio sul telefono';
    return e?.message || String(e);
}

export function vibrate(ms) {
    try {
        navigator.vibrate?.(ms);
    } catch {}
}

export function debounce(fn, ms) {
    let timer;
    const wrapped = (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
    wrapped.flush = (...args) => {
        clearTimeout(timer);
        return fn(...args);
    };
    wrapped.cancel = () => clearTimeout(timer);
    return wrapped;
}

// tocca un collegamento invisibile: scarica un file (download) o apre un'altra app (mailto:)
function clickLink(href, download) {
    const a = el('a');
    a.href = href;
    if (download) a.download = download;
    document.body.append(a);
    a.click();
    a.remove();
}

export function downloadFile(file) {
    const url = URL.createObjectURL(file);
    clickLink(url, file.name);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export const openMailto = (url) => clickLink(url);

export function canShareFiles() {
    try {
        return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })] });
    } catch {
        return false;
    }
}

// schermo sempre acceso mentre si guardano i valori da ricopiare
let wakeLock = null;
export async function keepAwake() {
    try {
        if (!wakeLock) wakeLock = await navigator.wakeLock?.request('screen');
        wakeLock?.addEventListener?.('release', () => (wakeLock = null));
    } catch {}
}
export function releaseAwake() {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
}
