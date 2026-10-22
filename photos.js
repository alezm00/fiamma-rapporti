// Foto dei rapporti e logo della ditta: ridimensionati e salvati sul telefono (db.js).

import * as db from './db.js';

const MAX_SIDE = 1280; // lato lungo in pixel: basta per un PDF leggibile e leggero da inviare
const QUALITY = 0.8;
const LOGO_SIDE = 480;

// ---------------------------------------------------------------------------
// Ridimensionamento
// ---------------------------------------------------------------------------

async function decode(file) {
    try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' }); // rispetta la rotazione della fotocamera
    } catch {
        const url = URL.createObjectURL(file);
        try {
            const img = new Image();
            img.src = url;
            await img.decode();
            return img;
        } catch {
            throw new Error('Formato immagine non supportato');
        } finally {
            URL.revokeObjectURL(url);
        }
    }
}

export async function compressImage(file, { maxSide = MAX_SIDE, quality = QUALITY } = {}) {
    const img = await decode(file);
    const srcW = img.width || img.naturalWidth;
    const srcH = img.height || img.naturalHeight;
    const k = Math.min(1, maxSide / Math.max(srcW, srcH));
    const width = Math.max(1, Math.round(srcW * k));
    const height = Math.max(1, Math.round(srcH * k));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // PNG trasparenti: sfondo bianco
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    img.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('Impossibile elaborare la foto');
    return { blob, width, height };
}

// ---------------------------------------------------------------------------
// Foto di un rapporto
// ---------------------------------------------------------------------------

export async function listPhotos(reportId) {
    return (await db.getByIndex(db.PHOTOS, 'reportId', reportId)).sort((a, b) => a.addedAt - b.addedAt);
}

export async function addPhoto(reportId, file) {
    const { blob, width, height } = await compressImage(file);
    const photo = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, reportId, blob, width, height, addedAt: Date.now() };
    await db.put(db.PHOTOS, photo);
    return photo;
}

export const removePhoto = (id) => db.remove(db.PHOTOS, id);
export const removeReportPhotos = (reportId) => db.removeByIndex(db.PHOTOS, 'reportId', reportId);

// per il PDF: [{ bytes, width, height }]
export async function photosForPdf(reportId) {
    return Promise.all((await listPhotos(reportId)).map(async (p) => ({
        bytes: new Uint8Array(await p.blob.arrayBuffer()), width: p.width, height: p.height,
    })));
}

// ---------------------------------------------------------------------------
// Logo della ditta
// ---------------------------------------------------------------------------

export async function setLogo(file) {
    const { blob, width, height } = await compressImage(file, { maxSide: LOGO_SIDE, quality: 0.9 });
    await db.put(db.META, { key: 'logo', blob, width, height });
}

export const getLogo = () => db.get(db.META, 'logo');
export const removeLogo = () => db.remove(db.META, 'logo');

export async function logoForPdf() {
    const logo = await getLogo();
    return logo ? { bytes: new Uint8Array(await logo.blob.arrayBuffer()), width: logo.width, height: logo.height } : null;
}

// ---------------------------------------------------------------------------
// Ripristino (da backup o cartella di salvataggio): foto e logo già pronti
// ---------------------------------------------------------------------------

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const isSize = (n) => Number.isFinite(n) && n > 0 && n <= 20000;

// aggiunge la foto se non c'è già; false se è scartata o esiste
export async function importPhoto({ id, reportId, blob, width, height, addedAt }) {
    if (!SAFE_ID.test(id ?? '') || !SAFE_ID.test(reportId ?? '') || !(blob instanceof Blob) || !isSize(width) || !isSize(height)) return false;
    if (await db.get(db.PHOTOS, id)) return false;
    await db.put(db.PHOTOS, { id, reportId, blob: blob.type === 'image/jpeg' ? blob : new Blob([blob], { type: 'image/jpeg' }), width, height, addedAt: Number(addedAt) || Date.now() });
    return true;
}

// replace = true: sostituisce il logo che c'è già (altrimenti si aggiunge solo se manca)
export async function importLogo(blob, width, height, { replace = false } = {}) {
    if (!replace && (await getLogo())) return false;
    if (!(blob instanceof Blob) || !isSize(width) || !isSize(height)) return false;
    await db.put(db.META, { key: 'logo', blob, width, height });
    return true;
}
