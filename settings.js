// Impostazioni dell'app (restano sul telefono): ditta e tecnico, numerazione, email, dati predefiniti.
// Chiave nuova: non legge le impostazioni delle versioni precedenti.

const KEY = 'testoqr.config';

export const EMPTY_COMPANY = { name: '', vat: '', address: '', phone: '', email: '', technician: '' };

const text = (v) => (typeof v === 'string' ? v : '');

export function loadSettings() {
    let s = null;
    try {
        s = JSON.parse(localStorage.getItem(KEY));
    } catch {}
    const company = { ...EMPTY_COMPANY };
    for (const k of Object.keys(EMPTY_COMPANY)) company[k] = text(s?.company?.[k]);
    return {
        email: text(s?.email),
        method: s?.method === 'mailto' ? 'mailto' : 'share',
        defaults: s?.defaults && typeof s.defaults === 'object' ? s.defaults : {},
        company,
        counters: s?.counters && typeof s.counters === 'object' ? s.counters : {}, // anno -> ultimo numero usato
        lastBackup: Number(s?.lastBackup) || 0,
    };
}

export function saveSettings(settings) {
    try {
        localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {}
}

// modifica solo alcuni campi, senza perdere gli altri
export function updateSettings(patch) {
    const next = { ...loadSettings(), ...patch };
    saveSettings(next);
    return next;
}
