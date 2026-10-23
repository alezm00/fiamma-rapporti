// Materiali usati: tabella descrizione e quantità.

import { MARGIN, CONTENT_W, BOTTOM, GAP, RIGHT } from './sheet.js';
import { clean } from './text.js';

export function drawMaterials(sheet, r) {
    const { fontB, GREY, FILL, LINE, ACCENT, put, text, wrap, printable, ensure, newPage } = sheet;
    const work = r.intervention ?? {};
    const materials = (work.materials ?? []).filter((m) => clean(m.text) || clean(m.qty));
    if (materials.length) {
        const qtyW = 110;
        const descW = CONTENT_W - qtyW - 16;
        const rows = materials.map((m) => {
            const ls = wrap(printable(m.text) || '—', 10.5, descW);
            return { ls, qty: printable(m.qty), h: Math.max(20, ls.length * 13 + 8) };
        });
        ensure(16 + 19 + rows[0].h);
        text('MATERIALI', MARGIN, sheet.y, 8.5, { f: fontB, color: ACCENT });
        sheet.y -= 16;
        const head = () => {
            sheet.page.drawRectangle({ x: MARGIN, y: sheet.y - 19, width: CONTENT_W, height: 19, color: FILL });
            put('Descrizione', MARGIN + 8, sheet.y - 19 / 2 - 3, 9, { f: fontB, color: GREY });
            put('Quantità', RIGHT - 8, sheet.y - 19 / 2 - 3, 9, { f: fontB, color: GREY, align: 'right' });
            sheet.y -= 19;
        };
        head();
        for (const row of rows) {
            if (sheet.y - row.h < BOTTOM) {
                newPage();
                head();
            }
            row.ls.forEach((l, j) => put(l, MARGIN + 8, sheet.y - 5 - 10.5 * 0.8 - j * 13 - 1, 10.5));
            put(row.qty, RIGHT - 8, sheet.y - 5 - 10.5 * 0.8 - 1, 10.5, { f: fontB, align: 'right' });
            sheet.y -= row.h;
            sheet.page.drawLine({ start: { x: MARGIN, y: sheet.y }, end: { x: RIGHT, y: sheet.y }, thickness: 0.5, color: LINE });
        }
        sheet.y -= GAP;
    }
}
