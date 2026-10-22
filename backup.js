// Backup in un file ZIP (rapporti, foto, impostazioni, logo) e ripristino.
// Funziona su qualunque browser, anche dove la cartella di salvataggio non è disponibile.

import * as db from './db.js';
import { normalizeReport } from './model.js';
import { importReport } from './store.js';
import { loadSettings, saveSettings, mergeSettings, updateSettings } from './settings.js';
import { getLogo, importPhoto, importLogo } from './photos.js';
import { createZip, readZip } from './zip.js';

const FORMAT = 1;
const APP = 'fiamma';
const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());
const parse = (bytes, what) => {
    try {
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        throw new Error(`Il backup è danneggiato (${what})`);
    }
};

// withPhotos = false: file più piccolo, senza le foto
export async function createBackup({ withPhotos = true, now = new Date() } = {}) {
    const reports = await db.getAll(db.REPORTS);
    const entries = [];
    const settings = loadSettings();
    entries.push({ name: 'reports.json', data: JSON.stringify({ format: FORMAT, app: APP, exportedAt: now.toISOString(), reports }) });
    entries.push({ name: 'settings.json', data: JSON.stringify(settings) });
    let photoCount = 0;
    if (withPhotos) {
        const index = [];
        for (const p of await db.getAll(db.PHOTOS)) {
            entries.push({ name: `photos/${p.id}.jpg`, data: await bytesOf(p.blob), store: true });
            index.push({ id: p.id, reportId: p.reportId, width: p.width, height: p.height, addedAt: p.addedAt });
            photoCount++;
        }
        entries.push({ name: 'photos/index.json', data: JSON.stringify(index) });
    }
    const logo = await getLogo();
    if (logo) {
        entries.push({ name: 'logo.jpg', data: await bytesOf(logo.blob), store: true });
        entries.push({ name: 'logo.json', data: JSON.stringify({ width: logo.width, height: logo.height }) });
    }
    const blob = await createZip(entries);
    updateSettings({ lastBackup: now.getTime() });
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return { blob, name: `Fiamma-backup-${stamp}.zip`, reports: reports.length, photos: photoCount };
}

// Unisce il backup ai dati del telefono: a parità di rapporto vince la modifica più recente.
export async function restoreBackup(file) {
    const files = await readZip(file);
    const reportsFile = files.get('reports.json');
    if (!reportsFile) throw new Error('Non è un backup di Fiamma');
    const data = parse(reportsFile, 'rapporti');
    if (data.app !== APP || data.format !== FORMAT || !Array.isArray(data.reports)) throw new Error('Non è un backup di Fiamma');

    let reports = 0;
    let skipped = 0;
    for (const raw of data.reports) {
        const doc = normalizeReport(raw);
        if (!doc) skipped++;
        else if (await importReport(doc)) reports++;
    }

    let photos = 0;
    const index = files.get('photos/index.json');
    if (index) {
        for (const p of parse(index, 'foto')) {
            const bytes = files.get(`photos/${p?.id}.jpg`);
            if (!bytes || !(await db.get(db.REPORTS, p.reportId))) continue;
            if (await importPhoto({ ...p, blob: new Blob([bytes], { type: 'image/jpeg' }) })) photos++;
        }
    }

    if (files.has('settings.json')) saveSettings(mergeSettings(loadSettings(), parse(files.get('settings.json'), 'impostazioni')));
    // i dati del telefono sono ora quelli del backup: vale come copia di sicurezza di quel momento
    const exportedAt = Date.parse(data.exportedAt);
    if (exportedAt > loadSettings().lastBackup) updateSettings({ lastBackup: exportedAt });
    if (files.has('logo.jpg') && files.has('logo.json')) {
        const size = parse(files.get('logo.json'), 'logo');
        await importLogo(new Blob([files.get('logo.jpg')], { type: 'image/jpeg' }), size.width, size.height);
    }
    return { reports, photos, skipped };
}
