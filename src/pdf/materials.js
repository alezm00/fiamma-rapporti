// Materiali usati: tabella descrizione e quantità.

import { MARGIN, CONTENT_W, BOTTOM, GAP, RIGHT, FIELD_SIZE, LINE_H } from './sheet.js';
import { clean } from './text.js';

export function drawMaterials(sheet, r) {
    const { fontB, GREY, FILL, LINE, ACCENT, put, text, wrap, printable, ensure, newPage } = sheet;
    const work = r.intervention ?? {};
    const materials = (work.materials ?? []).filter((m) => clean(m.text) || clean(m.qty));
    if (materials.length) {
        const qtyW = 110;
        const descW = CONTENT_W - qtyW - 16;
        const rows = materials.map((m) => {
            const ls = wrap(printable(m.text) || '—', FIELD_SIZE, descW);
            return { ls, qty: printable(m.qty), h: Math.max(16, ls.length * LINE_H + 5) };
        });
        const HEAD_H = 16;
        ensure(14 + HEAD_H + rows[0].h);
        text('MATERIALI', MARGIN, sheet.y, 8.5, { f: fontB, color: ACCENT });
        sheet.y -= 14;
        const head = () => {
            sheet.page.drawRectangle({ x: MARGIN, y: sheet.y - HEAD_H, width: CONTENT_W, height: HEAD_H, color: FILL });
            put('Descrizione', MARGIN + 8, sheet.y - HEAD_H / 2 - 3, 8.5, { f: fontB, color: GREY });
            put('Quantità', RIGHT - 8, sheet.y - HEAD_H / 2 - 3, 8.5, { f: fontB, color: GREY, align: 'right' });
            sheet.y -= HEAD_H;
        };
        head();
        for (const row of rows) {
            if (sheet.y - row.h < BOTTOM) {
                newPage();
                head();
            }
            row.ls.forEach((l, j) => put(l, MARGIN + 8, sheet.y - 3 - FIELD_SIZE * 0.8 - j * LINE_H - 1, FIELD_SIZE));
            put(row.qty, RIGHT - 8, sheet.y - 3 - FIELD_SIZE * 0.8 - 1, FIELD_SIZE, { f: fontB, align: 'right' });
            sheet.y -= row.h;
            sheet.page.drawLine({ start: { x: MARGIN, y: sheet.y }, end: { x: RIGHT, y: sheet.y }, thickness: 0.5, color: LINE });
        }
        sheet.y -= GAP;
    }
}
