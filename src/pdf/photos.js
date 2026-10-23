// Foto: griglia a 2 colonne, continua sulle pagine successive.

import { MARGIN, CONTENT_W } from './sheet.js';

export async function drawPhotos(sheet, photos) {
    const { pdf, fontB, GREY, LINE, ACCENT, text, ensure } = sheet;
    if (photos.length) {
        const PHOTO_GAP = 10;
        const CAPTION_H = 14;
        const MAX_H = 200;
        const cellW = (CONTENT_W - PHOTO_GAP) / 2;
        const images = [];
        for (const ph of photos) {
            const image = await pdf.embedJpg(ph.bytes);
            const k = Math.min(cellW / image.width, MAX_H / image.height);
            images.push({ image, w: image.width * k, h: image.height * k });
        }
        for (let i = 0; i < images.length; i += 2) {
            const row = images.slice(i, i + 2);
            const rowH = Math.max(...row.map((p) => p.h)) + CAPTION_H;
            ensure((i === 0 ? 20 : 0) + rowH);
            if (i === 0) {
                text('FOTO', MARGIN, sheet.y, 8.5, { f: fontB, color: ACCENT });
                sheet.y -= 18;
            }
            row.forEach((p, j) => {
                const x = MARGIN + j * (cellW + PHOTO_GAP);
                sheet.page.drawImage(p.image, { x, y: sheet.y - p.h, width: p.w, height: p.h });
                sheet.page.drawRectangle({ x, y: sheet.y - p.h, width: p.w, height: p.h, borderColor: LINE, borderWidth: 0.5 });
                text(`Foto ${i + j + 1}`, x, sheet.y - p.h - 3, 8, { color: GREY });
            });
            sheet.y -= rowH + 6;
        }
    }
}
