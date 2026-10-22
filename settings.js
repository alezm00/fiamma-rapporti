// Impostazioni dell'app (restano sul telefono): destinatario dell'email, modo di invio, dati predefiniti dei nuovi report.

const KEY = 'testoqr.settings';

export function loadSettings() {
    let s = null;
    try {
        s = JSON.parse(localStorage.getItem(KEY));
    } catch {}
    return {
        email: typeof s?.email === 'string' ? s.email : '',
        method: s?.method === 'mailto' ? 'mailto' : 'share',
        defaults: s?.defaults && typeof s.defaults === 'object' ? s.defaults : {},
    };
}

export function saveSettings(settings) {
    try {
        localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {}
}
