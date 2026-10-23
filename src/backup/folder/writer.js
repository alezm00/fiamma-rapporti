// Un rapporto nella cartella: rapporto.json, foto e PDF (se chiuso); e la sua eliminazione.

import * as store from '../../data/store.js';
import { listPhotos, photosForPdf, logoForPdf } from '../../data/photos.js';
import { loadSettings } from '../../data/settings.js';
import { createReportPdf } from '../../pdf/index.js';
import { pad } from '../../lib/dates.js';
import { ROOT, dir, writeFile, removeDir, subdirs } from './files.js';
import { loadIndex, saveIndex } from './state.js';
import { folderPath, id8 } from './paths.js';

export async function writeReport(link, id) {
    const doc = await store.getReport(id);
    if (!doc || doc.deletedAt) return removeReport(link, id); // eliminato o nel cestino: via anche dalla cartella
    const { year, dir: name } = folderPath(doc);
    const years = await dir(link.handle, [ROOT, 'rapporti', year]);
    const index = await loadIndex();
    const prev = index.reports[id];

    // il rapporto ha cambiato nome o anno (la bozza prende il numero alla chiusura): via la cartella vecchia
    if (prev && (prev.year !== year || prev.dir !== name)) {
        const old = await dir(link.handle, [ROOT, 'rapporti', prev.year], false).catch(() => null);
        if (old) await removeDir(old, prev.dir);
    }
    for (const [other] of await subdirs(years)) {
        if (other !== name && other.endsWith(`_${id8(id)}`)) await removeDir(years, other);
    }

    const d = await years.getDirectoryHandle(name, { create: true });
    const photos = await listPhotos(id);
    const sig = photos.map((p) => p.id).join(',');
    if (!prev || prev.year !== year || prev.dir !== name || prev.photos !== sig) {
        await removeDir(d, 'foto');
        if (photos.length) {
            const fd = await d.getDirectoryHandle('foto', { create: true });
            for (const [i, p] of photos.entries()) await writeFile(fd, `${pad(i + 1)}.jpg`, p.blob);
        }
    }
    const file = { ...doc, photos: photos.map((p, i) => ({ id: p.id, file: `foto/${pad(i + 1)}.jpg`, width: p.width, height: p.height, addedAt: p.addedAt })) };
    await writeFile(d, 'rapporto.json', JSON.stringify(file, null, 2));
    index.reports[id] = { year, dir: name, photos: sig };
    await saveIndex(index);

    if (doc.status !== 'draft') {
        const bytes = await createReportPdf(doc, loadSettings(), { photos: await photosForPdf(id), logo: await logoForPdf() });
        await writeFile(d, 'rapporto.pdf', bytes);
    }
}

export async function removeReport(link, id) {
    const index = await loadIndex();
    const prev = index.reports[id];
    if (prev) {
        const years = await dir(link.handle, [ROOT, 'rapporti', prev.year], false).catch(() => null);
        if (years) await removeDir(years, prev.dir);
        delete index.reports[id];
        await saveIndex(index);
        return;
    }
    // senza traccia (dopo un ripristino): si cerca per id in tutti gli anni
    const rapporti = await dir(link.handle, [ROOT, 'rapporti'], false).catch(() => null);
    if (!rapporti) return;
    for (const [, years] of await subdirs(rapporti)) {
        for (const [name] of await subdirs(years)) if (name.endsWith(`_${id8(id)}`)) await removeDir(years, name);
    }
}
