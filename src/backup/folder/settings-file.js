// impostazioni.json e logo.jpg nella cartella: leggerli, prenderli al posto di quelli del telefono, scriverli.

import { getLogo, importLogo } from '../../data/photos.js';
import { loadSettings, saveSettings, mergeSettings, normalizeSettings } from '../../data/settings.js';
import { ROOT, dir, readFile, writeFile, memoryCopy, missing } from './files.js';
import { loadIndex, saveIndex } from './state.js';

// Le impostazioni già salvate in una cartella (di solito da un altro telefono):
// { settings, logo, modified } oppure null se non ce ne sono (o il file non si legge).
export async function peekSettings(handle) {
    try {
        const root = await dir(handle, [ROOT], false);
        const file = await readFile(root, 'impostazioni.json');
        const raw = JSON.parse(await file.text());
        return { settings: normalizeSettings(raw), logo: raw?.logo ?? null, modified: file.lastModified };
    } catch (e) {
        if (missing(e) || e instanceof SyntaxError) return null;
        throw e;
    }
}

// Prende le impostazioni dalla cartella al posto di quelle del telefono (ditta, email, numerazione, logo).
// Il numero progressivo non torna mai indietro: per ogni anno vale il più alto.
export async function takeSettingsFrom(handle) {
    const found = await peekSettings(handle);
    if (!found) return false;
    const local = loadSettings();
    const counters = { ...found.settings.counters };
    for (const [year, n] of Object.entries(local.counters)) counters[year] = Math.max(counters[year] || 0, n);
    saveSettings({ ...found.settings, counters, lastBackup: local.lastBackup });
    if (found.logo) {
        try {
            const root = await dir(handle, [ROOT], false);
            await importLogo(await memoryCopy(await readFile(root, 'logo.jpg')), found.logo.width, found.logo.height, { replace: true });
        } catch (e) {
            if (!missing(e)) throw e; // senza il file del logo si tiene quello che c'è
        }
    }
    return true;
}

// impostazioni e logo (senza la data dell'ultimo backup, che è di questo telefono)
export async function writeSettings(link) {
    const root = await dir(link.handle, [ROOT]);
    // le impostazioni già in cartella non si perdono: su un telefono nuovo, collegare la cartella
    // prima del ripristino non deve sovrascriverle con quelle vuote
    let existing = null;
    try {
        existing = JSON.parse(await (await readFile(root, 'impostazioni.json')).text());
    } catch {}
    const { lastBackup, ...settings } = mergeSettings(loadSettings(), existing);
    const logo = await getLogo();
    // come per le impostazioni, il logo già in cartella non si perde se qui non c'è
    const logoInfo = logo ? { width: logo.width, height: logo.height } : (existing?.logo ?? null);
    await writeFile(root, 'impostazioni.json', JSON.stringify({ ...settings, logo: logoInfo }, null, 2));
    if (logo) {
        const index = await loadIndex();
        const sig = String(logo.blob.size);
        if (sig !== index.logo) {
            await writeFile(root, 'logo.jpg', logo.blob);
            index.logo = sig;
            await saveIndex(index);
        }
    }
}
