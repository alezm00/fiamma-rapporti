// Funzioni di utilità condivise dalle schermate.
import { MSG, MSG_TYPES, CLS, BADGES } from './ui.js';
import { STATUSES } from './model.js';

export const $ = (id) => document.getElementById(id);

export function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
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
export function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 1800);
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

export function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const a = el('a');
    a.href = url;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function openMailto(url) {
    const a = el('a');
    a.href = url;
    document.body.append(a);
    a.click();
    a.remove();
}

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
