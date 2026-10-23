// Foto del rapporto: griglia, aggiunta da fotocamera o galleria, eliminazione e visualizzazione a schermo intero.

import { listPhotos, addPhoto, removePhoto } from '../../data/photos.js';
import { CLS } from '../../ui/classes.js';
import { $, el, showBoxMsg } from '../../ui/util.js';
import { session, touch } from './session.js';

const MAX_PHOTOS = 20;
let photoUrls = [];

export async function renderPhotos() {
    const current = session.doc;
    const photos = await listPhotos(current.id);
    if (current !== session.doc) return; // nel frattempo si è aperto un altro rapporto
    photoUrls.forEach((url) => URL.revokeObjectURL(url));
    photoUrls = [];
    const grid = $('photo-grid');
    grid.replaceChildren();
    for (const photo of photos) {
        const url = URL.createObjectURL(photo.blob);
        photoUrls.push(url);
        const cell = el('div', CLS.photo);
        const img = el('img', CLS.photoImg);
        img.src = url;
        img.alt = 'Foto';
        img.addEventListener('click', () => {
            $('photo-view').querySelector('img').src = url;
            $('photo-view').hidden = false;
        });
        const del = el('button', CLS.photoDel, '✕');
        del.type = 'button';
        del.setAttribute('aria-label', 'Elimina foto');
        del.addEventListener('click', async () => {
            if (!confirm('Eliminare questa foto?')) return;
            await removePhoto(photo.id);
            renderPhotos();
        });
        cell.append(img, del);
        grid.append(cell);
    }
    $('photo-count').textContent = photos.length ? `(${photos.length} di ${MAX_PHOTOS})` : '';
    if (session.doc.photoCount !== photos.length) {
        session.doc.photoCount = photos.length;
        touch();
    }
}

async function addPhotoFiles(files) {
    const current = session.doc;
    const room = MAX_PHOTOS - (await listPhotos(current.id)).length;
    if (room <= 0) {
        showBoxMsg('photo-msg', `Massimo ${MAX_PHOTOS} foto per rapporto: elimina una foto per aggiungerne altre.`, 'warn');
        return;
    }
    const batch = files.slice(0, room);
    let error = '';
    for (const [i, file] of batch.entries()) {
        showBoxMsg('photo-msg', `Elaboro la foto ${i + 1} di ${batch.length}…`);
        try {
            await addPhoto(current.id, file);
            if (current === session.doc) await renderPhotos();
        } catch (e) {
            error = e.name === 'QuotaExceededError' ? 'Memoria del telefono piena: libera spazio e riprova.' : `Foto non aggiunta: ${e.message || e}`;
            break;
        }
    }
    if (error) showBoxMsg('photo-msg', error, 'error');
    else if (files.length > batch.length) showBoxMsg('photo-msg', `Massimo ${MAX_PHOTOS} foto per rapporto: ne ho aggiunte ${batch.length}.`, 'warn');
    else showBoxMsg('photo-msg', '');
}

// uscendo: si liberano le anteprime e si chiude la foto aperta
export function releasePhotos() {
    photoUrls.forEach((url) => URL.revokeObjectURL(url));
    photoUrls = [];
    $('photo-view').hidden = true;
}

export function initPhotos() {
    for (const id of ['in-shoot', 'in-gallery']) {
        $(id).addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            e.target.value = '';
            if (files.length && session.doc) addPhotoFiles(files);
        });
    }
    $('photo-view').addEventListener('click', () => ($('photo-view').hidden = true));
}
