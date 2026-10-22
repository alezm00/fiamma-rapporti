// Impostazioni dell'app (restano sul telefono): ditta e tecnico, numerazione, email.
// Chiave nuova: non legge le impostazioni delle versioni precedenti.

const KEY = 'testoqr.config';

export const EMPTY_COMPANY = { name: '', vat: '', address: '', phone: '', email: '', technician: '' };

const text = (v) => (typeof v === 'string' ? v : '');

// da un oggetto qualunque (localStorage, file di backup) a impostazioni complete e del tipo giusto
export function normalizeSettings(s) {
    const company = { ...EMPTY_COMPANY };
    for (const k of Object.keys(EMPTY_COMPANY)) company[k] = text(s?.company?.[k]);
    const counters = {}; // anno -> ultimo numero usato
    for (const [year, n] of Object.entries(s?.counters && typeof s.counters === 'object' ? s.counters : {})) {
        if (/^\d{4}$/.test(year) && Number.isFinite(n) && n >= 0) counters[year] = Math.floor(n);
    }
    return {
        email: text(s?.email),
        method: s?.method === 'mailto' ? 'mailto' : 'share',
        company,
        counters,
        lastBackup: Number(s?.lastBackup) || 0,
    };
}

export function loadSettings() {
    let s = null;
    try {
        s = JSON.parse(localStorage.getItem(KEY));
    } catch {}
    return normalizeSettings(s);
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

// Ripristino: i dati letti da fuori riempiono solo quello che qui è vuoto;
// i contatori dei numeri prendono il più alto, così un numero non si riassegna.
export function mergeSettings(local, incoming) {
    const inc = normalizeSettings(incoming);
    const company = { ...local.company };
    for (const k of Object.keys(company)) company[k] = company[k] || inc.company[k];
    const counters = { ...local.counters };
    for (const [year, n] of Object.entries(inc.counters)) counters[year] = Math.max(counters[year] || 0, n);
    return {
        ...local,
        email: local.email || inc.email,
        company,
        counters,
    };
}
