// Ripristino dalla cartella Fiamma: unisce i rapporti, le foto e le impostazioni trovati a quelli del telefono.

import * as store from '../../data/store.js';
import { importPhoto, importLogo } from '../../data/photos.js';
import { loadSettings, saveSettings, mergeSettings } from '../../data/settings.js';
import { normalizeReport } from '../../model/index.js';
import { dir, readFile, memoryCopy, missing, subdirs } from './files.js';

// Legge i rapporti della cartella Fiamma e li unisce a quelli del telefono
export async function restoreRoot(root, result) {
    const rapporti = await dir(root, ['rapporti'], false).catch(() => null);
    for (const [, years] of rapporti ? await subdirs(rapporti) : []) {
        for (const [, d] of await subdirs(years)) {
            let raw;
            try {
                raw = JSON.parse(await (await readFile(d, 'rapporto.json')).text());
            } catch {
                result.skipped++;
                continue;
            }
            const doc = normalizeReport(raw);
            if (!doc) {
                result.skipped++;
                continue;
            }
            if (await store.importReport(doc)) result.reports++;
            const fotoDir = await d.getDirectoryHandle('foto').catch(() => null);
            for (const p of Array.isArray(raw.photos) ? raw.photos : []) {
                if (!fotoDir || !/^[\w.-]+\.jpg$/.test(String(p?.file).replace(/^foto\//, ''))) continue;
                try {
                    const blob = await memoryCopy(await readFile(fotoDir, p.file.replace(/^foto\//, '')));
                    if (await importPhoto({ id: p.id, reportId: doc.id, blob, width: p.width, height: p.height, addedAt: p.addedAt })) result.photos++;
                } catch {}
            }
        }
    }
    try {
        const settings = JSON.parse(await (await readFile(root, 'impostazioni.json')).text());
        saveSettings(mergeSettings(loadSettings(), settings));
        const size = settings.logo;
        if (size) await importLogo(await memoryCopy(await readFile(root, 'logo.jpg')), size.width, size.height);
    } catch (e) {
        if (!missing(e) && !(e instanceof SyntaxError)) throw e;
    }
}
