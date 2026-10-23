// Intestazione: logo e dati della ditta a sinistra, numero e data a destra.

import { formatDay } from '../lib/dates.js';
import { MARGIN, RIGHT } from './sheet.js';
import { clean, oneLine } from './text.js';

export async function drawHeader(sheet, r, company, logo) {
    const { pdf, fontB, font, INK, GREY, ACCENT, AMBER, text, truncate, printable } = sheet;
    const isDraft = !r.number;
    const RIGHT_W = 190;
    let left = sheet.y;
    let lx = MARGIN;
    if (logo) {
        const image = await pdf.embedJpg(logo.bytes);
        const k = Math.min(120 / image.width, 48 / image.height);
        sheet.page.drawImage(image, { x: MARGIN, y: sheet.y - image.height * k, width: image.width * k, height: image.height * k });
        lx += image.width * k + 12;
        left = sheet.y - image.height * k;
    }
    const maxLeft = RIGHT - RIGHT_W - lx;
    let ty = sheet.y;
    const coLines = [
        [company.name, 13, true],
        [oneLine(company.address), 9],
        [[company.vat && `P.IVA ${clean(company.vat)}`, company.phone && `Tel. ${clean(company.phone)}`].filter(Boolean).join('  ·  '), 9],
        [company.email, 9],
    ];
    for (const [t, size, isBold] of coLines) {
        const v = printable(t);
        if (!v) continue;
        text(truncate(v, size, maxLeft, isBold ? fontB : font), lx, ty, size, { f: isBold ? fontB : font, color: isBold ? INK : GREY });
        ty -= size * 1.35;
    }
    left = Math.min(left, ty);

    let right = sheet.y;
    text('RAPPORTO DI INTERVENTO', RIGHT, right, 8.5, { f: fontB, color: ACCENT, align: 'right' });
    right -= 8.5 * 1.6;
    text(isDraft ? 'BOZZA' : `n. ${r.number}`, RIGHT, right, 20, { f: fontB, color: isDraft ? AMBER : INK, align: 'right' });
    right -= 20 * 1.3;
    if (r.date) {
        text(`Data intervento ${formatDay(r.date)}`, RIGHT, right, 10, { color: GREY, align: 'right' });
        right -= 10 * 1.5;
    }
    sheet.y = Math.min(left, right) - 8;
    sheet.page.drawLine({ start: { x: MARGIN, y: sheet.y }, end: { x: RIGHT, y: sheet.y }, thickness: 1.2, color: ACCENT });
    sheet.y -= 12;
}
