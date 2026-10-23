// La pagina del PDF: misure A4, colori, cursore verticale (y), testo, riquadri con campi e testo libero.
// createSheet(pdf, { font, fontB, rgb }) restituisce l'oggetto che le sezioni usano per scrivere.

import { clean, multiline } from './text.js';

export const PAGE_W = 595.28; // A4
export const PAGE_H = 841.89;
export const MARGIN = 42;
export const RIGHT = PAGE_W - MARGIN;
export const CONTENT_W = PAGE_W - MARGIN * 2;
export const BOTTOM = MARGIN + 18; // spazio per il piè di pagina
export const PAD = 10;
export const TITLE_H = 24;
export const GAP = 12; // spazio tra i blocchi

export function createSheet(pdf, { font, fontB, rgb }) {
    const INK = rgb(0.1, 0.1, 0.1);
    const GREY = rgb(0.4, 0.4, 0.4);
    const LINE = rgb(0.8, 0.8, 0.8);
    const FILL = rgb(0.94, 0.95, 0.97);
    const ACCENT = rgb(0.04, 0.33, 0.62);
    const AMBER = rgb(0.72, 0.42, 0);

    // i caratteri che il font non ha (emoji…) diventano "?" invece di rompere il PDF
    const glyphs = new Set(font.getCharacterSet());
    const printable = (s) => [...clean(s)].map((ch) => (glyphs.has(ch.codePointAt(0)) ? ch : /[‍︎️]/.test(ch) ? '' : '?')).join('');
    const lines = (s) => multiline(s).split('\n').map(printable);

    let page;
    let y; // bordo alto del prossimo elemento
    const newPage = () => {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
    };
    const ensure = (h) => {
        if (y - h < BOTTOM) newPage();
    };
    newPage();

    const width = (t, size, f = font) => f.widthOfTextAtSize(t, size);

    // testo con la linea di base a "baseline"
    function put(t, x, baseline, size, { f = font, color = INK, align = 'left' } = {}) {
        if (!t) return;
        const w = width(t, size, f);
        page.drawText(t, { x: align === 'right' ? x - w : x, y: baseline, size, font: f, color });
    }
    // testo con il bordo alto a "top"
    const text = (t, x, top, size, opts) => put(t, x, top - size * 0.8, size, opts);

    function wrap(t, size, maxW, f = font) {
        const out = [];
        let line = '';
        for (let word of t.split(' ')) {
            while (width(word, size, f) > maxW) { // parola più lunga della riga: spezzata
                if (line) {
                    out.push(line);
                    line = '';
                }
                let n = word.length;
                while (n > 1 && width(word.slice(0, n), size, f) > maxW) n--;
                out.push(word.slice(0, n));
                word = word.slice(n);
            }
            const test = line ? `${line} ${word}` : word;
            if (!line || width(test, size, f) <= maxW) line = test;
            else {
                out.push(line);
                line = word;
            }
        }
        if (line) out.push(line);
        return out.length ? out : [''];
    }

    function truncate(t, size, maxW, f = font) {
        if (width(t, size, f) <= maxW) return t;
        while (t.length > 1 && width(`${t}…`, size, f) > maxW) t = t.slice(0, -1);
        return `${t}…`;
    }

    // --- riquadri con campi etichetta/valore -------------------------------

    function layoutFields(items, cellW) {
        return items.map(({ label, value }) => {
            const v = printable(value);
            const l = v ? wrap(v, 10.5, cellW) : ['—'];
            return { label, lines: l, empty: !v, h: 10 + l.length * 13 + 5 };
        });
    }

    // righe di celle: "cols" campi per riga
    function layoutRows(items, cols, innerW) {
        const rows = [];
        const cellW = innerW / cols;
        for (let i = 0; i < items.length; i += cols) {
            const cells = layoutFields(items.slice(i, i + cols), cellW - 8);
            rows.push({ cells, cellW, h: Math.max(...cells.map((x) => x.h)) });
        }
        return rows;
    }

    const boxHeight = (rows) => TITLE_H + rows.reduce((n, row) => n + row.h, 0) + 4;

    function drawBox(title, rows, x, w, h) {
        page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: LINE, borderWidth: 0.8 });
        text(title.toUpperCase(), x + PAD, y - 9, 8.5, { f: fontB, color: ACCENT });
        let top = y - TITLE_H;
        for (const row of rows) {
            row.cells.forEach((cell, i) => {
                const cx = x + PAD + i * row.cellW;
                text(truncate(cell.label, 8, row.cellW - 8), cx, top, 8, { color: GREY });
                cell.lines.forEach((l, j) => text(l, cx, top - 10 - j * 13, 10.5, { color: cell.empty ? GREY : INK }));
            });
            top -= row.h;
        }
    }

    // riquadro con campi, a tutta larghezza
    function fieldsBox(title, items, cols = 3) {
        const rows = layoutRows(items, cols, CONTENT_W - PAD * 2);
        if (!rows.length) return;
        const h = boxHeight(rows);
        ensure(h);
        drawBox(title, rows, MARGIN, CONTENT_W, h);
        y -= h + GAP;
    }

    // riquadro di testo libero: continua sulla pagina dopo se serve
    function textBox(title, ls) {
        const all = ls.flatMap((par) => wrap(par || ' ', 10.5, CONTENT_W - PAD * 2));
        for (let i = 0, first = true; i < all.length; first = false) {
            ensure(TITLE_H + 13 * Math.min(3, all.length - i) + 5);
            const fit = Math.max(1, Math.floor((y - BOTTOM - TITLE_H - 5) / 13));
            const chunk = all.slice(i, i + fit);
            const h = TITLE_H + chunk.length * 13 + 5;
            page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, borderColor: LINE, borderWidth: 0.8 });
            text(first ? title : `${title} (SEGUE)`, MARGIN + PAD, y - 9, 8.5, { f: fontB, color: ACCENT });
            chunk.forEach((l, j) => text(l, MARGIN + PAD, y - TITLE_H - j * 13, 10.5));
            y -= h + GAP;
            i += chunk.length;
        }
    }

    return {
        pdf, font, fontB, INK, GREY, LINE, FILL, ACCENT, AMBER,
        get page() { return page; },
        get y() { return y; },
        set y(value) { y = value; },
        newPage, ensure, width, put, text, wrap, truncate, printable, lines, fieldsBox, textBox,
    };
}
