// Misure Testo: confronto affiancato per lo stesso tipo, altrimenti una tabella ciascuna; poi gli strumenti usati.

import { formatDate } from '../lib/dates.js';
import { groupMeasures } from '../model/index.js';
import { MARGIN, CONTENT_W, BOTTOM, PAGE_H, GAP, RIGHT } from './sheet.js';

// la durata della fase passa nell'etichetta: "Fase 1 (1 min 00 s)" con valore "19:10:24 → 19:11:24"
const phaseItem = ({ label, range, duration }) => ({ label: duration ? `${label} (${duration})` : label, value: range });

export function drawMeasures(sheet, r) {
    const { fontB, INK, GREY, LINE, FILL, ACCENT, put, text, width, wrap, truncate, printable, ensure, newPage, fieldsBox } = sheet;
    // columns: intestazioni; rows: [{ short, label, unit, values }]; info: righe grigie sotto il titolo
    function drawTable(title, info, columns, rows) {
        const n = columns.length;
        const unitW = 54;
        const valW = Math.min(n > 1 ? 100 : 120, (CONTENT_W - unitW - 150) / n);
        const labelW = CONTENT_W - unitW - n * valW;
        const ROW_H = 21;
        const HEAD_H = 19;
        const infoLines = info.flatMap((t) => wrap(printable(t), 9, CONTENT_W));

        const tableHead = () => {
            sheet.page.drawRectangle({ x: MARGIN, y: sheet.y - HEAD_H, width: CONTENT_W, height: HEAD_H, color: FILL });
            const base = sheet.y - HEAD_H / 2 - 3;
            put('Parametro', MARGIN + 8, base, 9, { f: fontB, color: GREY });
            columns.forEach((col, i) => put(truncate(printable(col), 9, valW - 10, fontB), MARGIN + labelW + (i + 1) * valW - 8, base, 9, { f: fontB, color: GREY, align: 'right' }));
            put('Unità', MARGIN + labelW + n * valW + 8, base, 9, { f: fontB, color: GREY });
            sheet.y -= HEAD_H;
        };

        // il confronto resta su una pagina sola se ci entra; altrimenti continua con l'intestazione ripetuta
        const total = 16 + infoLines.length * 12 + HEAD_H + ROW_H * rows.length;
        ensure(total <= PAGE_H - MARGIN - BOTTOM ? total : 16 + infoLines.length * 12 + HEAD_H + ROW_H * 2);
        text(printable(title).toUpperCase(), MARGIN, sheet.y, 8.5, { f: fontB, color: ACCENT });
        sheet.y -= 16;
        for (const l of infoLines) {
            text(l, MARGIN, sheet.y, 9, { color: GREY });
            sheet.y -= 12;
        }
        if (infoLines.length) sheet.y -= 2;
        tableHead();
        for (const row of rows) {
            if (sheet.y - ROW_H < BOTTOM) {
                newPage();
                tableHead();
            }
            const base = sheet.y - ROW_H / 2 - 4;
            let tx = MARGIN + 8;
            if (row.short && row.short !== row.label) {
                put(row.short, tx, base, 11, { f: fontB });
                tx += width(row.short, 11, fontB) + 8;
            }
            put(truncate(row.label, 10, MARGIN + labelW - tx - 6), tx, base, 10, { color: GREY });
            row.values.forEach((v0, i) => {
                const v = String(v0 ?? '').replace(/^-(?=\d)/, '−');
                put(v, MARGIN + labelW + (i + 1) * valW - 8, base, 12, { f: fontB, color: /^-+$/.test(v) ? GREY : INK, align: 'right' });
            });
            put(row.unit, MARGIN + labelW + n * valW + 8, base, 10, { color: GREY });
            sheet.y -= ROW_H;
            sheet.page.drawLine({ start: { x: MARGIN, y: sheet.y }, end: { x: RIGHT, y: sheet.y }, thickness: 0.5, color: LINE });
        }
        sheet.y -= GAP;
    }

    const devices = new Map(); // gli strumenti usati, senza ripetizioni
    const when = (rep, label) => [label, [rep.start && formatDate(rep.start), rep.header.find((h) => h.label === 'Combustibile')?.value].filter(Boolean).join(' · ')].filter(Boolean).join(': ');

    for (const block of groupMeasures(r.measures ?? [])) {
        const reports = block.kind === 'compare' ? block.items.map((i) => i.report) : [block.report];
        for (const rep of reports) {
            for (const s of rep.sections) {
                if (!/^Strumento/.test(s.title)) continue;
                const key = s.items.find((i) => i.key === 'serial')?.value || JSON.stringify(s.items);
                if (!devices.has(key)) devices.set(key, s);
            }
        }
        if (block.kind === 'compare') {
            drawTable(`Misure Testo · ${block.title}`, block.items.map((i) => when(i.report, i.label)), block.table.columns, block.table.rows);
        } else {
            const rep = block.report;
            const cols = rep.columns.length ? rep.columns : ['Valore'];
            const rows = rep.rows.map((row) => ({
                short: row.short, label: row.label, unit: row.unit, values: (rep.columns.length ? rep.columns : ['']).map((c) => row.cells[c] ?? ''),
            }));
            if (rows.length) {
                drawTable(`Misure Testo · ${block.label} · ${rep.title}`, [when(rep, '')].filter((t) => t !== ''), cols, rows);
            } else {
                ensure(40);
                text(printable(`Misura "${block.label}": ${rep.errors.length ? rep.errors.join(' ') : 'il QR non contiene valori di misura.'}`), MARGIN, sheet.y, 10, { color: GREY });
                sheet.y -= 24;
            }
            const extra = [
                ...rep.header,
                ...(rep.sections.find((x) => x.title === 'Fasi della prova')?.items.map(phaseItem) ?? []),
                ...(rep.note ? [{ label: 'Nota sulla misura', value: rep.note }] : []),
            ];
            const phaseOnly = extra.filter((it) => it.label !== 'Combustibile');
            if (phaseOnly.length) fieldsBox(`Dati misura · ${block.label}`, phaseOnly, 3);
        }
    }

    // gli strumenti in un riquadro solo: una riga ciascuno (nome, numero di serie, firmware)
    if (devices.size) {
        const items = [];
        for (const s of devices.values()) {
            const get = (k) => s.items.find((i) => i.key === k);
            items.push(
                { label: 'Strumento', value: get('name')?.value || s.title },
                { label: 'N. di serie', value: get('serial')?.value },
                { label: 'Firmware', value: get('firmwareVersion')?.value },
            );
        }
        fieldsBox(devices.size > 1 ? 'Strumenti di misura' : 'Strumento di misura', items, 3);
    }
}
