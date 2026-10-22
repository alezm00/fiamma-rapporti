// Report PDF (pdf-lib + font Liberation Sans): tutto in locale, funziona anche offline.
// Le librerie e i font si caricano solo quando serve il PDF.
import { formatDate } from './tjf.js';

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 42;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = MARGIN + 18; // spazio per il piè di pagina
const PAD = 10;
const TITLE_H = 24;
const GAP = 12; // spazio tra i blocchi

// dati dello strumento: in che ordine mostrarli e quali tralasciare nel PDF
const DEVICE_ORDER = ['name', 'serial', 'partNumber', 'deviceIdentifier', 'firmwareVersion', 'softwareVersion', 'lastServiceDate'];
const SKIP_DEVICE_KEYS = ['boardIndex', 'deviceTime', 'measCycle'];

// "19:10:24 → 19:11:24  (1 min 00 s)": la durata passa nell'etichetta
function phaseItem({ label, value }) {
    const [range, duration] = String(value).split(/\s{2,}/);
    return { label: duration ? `${label} ${duration}` : label, value: range };
}

// ---------------------------------------------------------------------------
// Caricamento librerie e font
// ---------------------------------------------------------------------------

let libsPromise = null;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Impossibile caricare ${src}`));
        document.head.append(s);
    });
}

async function fetchBytes(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Impossibile caricare ${url}`);
    return new Uint8Array(await res.arrayBuffer());
}

export function preloadPdfLibs() {
    if (!libsPromise) {
        libsPromise = Promise.all([
            window.PDFLib ? null : loadScript('vendor/pdf-lib.min.js'),
            window.fontkit ? null : loadScript('vendor/fontkit.umd.min.js'),
            fetchBytes('vendor/LiberationSans-Regular.ttf'),
            fetchBytes('vendor/LiberationSans-Bold.ttf'),
        ]).then(([, , regular, bold]) => ({ regular, bold }));
        libsPromise.catch(() => (libsPromise = null));
    }
    return libsPromise;
}

// ---------------------------------------------------------------------------
// Dati del cliente
// ---------------------------------------------------------------------------

const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
const oneLine = (s) => clean(String(s ?? '').replace(/[\r\n]+/g, ', '));
const code = (s) => clean(s).replace(/\s+/g, '').toUpperCase(); // codice fiscale, targa: senza spazi, maiuscolo
// testo su più righe (note): righe pulite, al massimo una riga vuota di seguito
const multiline = (s) => String(s ?? '').replace(/\r\n?/g, '\n').split('\n').map(clean).join('\n').replace(/\n{3,}/g, '\n\n').trim();

function formatInstallDate(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : clean(v);
}

export function normalizeCustomer(c = {}) {
    return {
        name: clean(c.name),
        fiscalCode: code(c.fiscalCode),
        address: oneLine(c.address),
        phone: clean(c.phone),
        brand: clean(c.brand),
        serial: clean(c.serial),
        plateCode: code(c.plateCode),
        installDate: formatInstallDate(c.installDate),
        notes: multiline(c.notes),
    };
}

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
const pad2 = (n) => String(n).padStart(2, '0');

export function reportFileName(report, customer = {}, now = new Date()) {
    const d = report.start || now;
    return `Report_${slug(customer.name) || 'cliente'}_${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.pdf`;
}

// ---------------------------------------------------------------------------
// Creazione del PDF
// ---------------------------------------------------------------------------

export async function createReportPdf(report, customer = {}, now = new Date()) {
    const { regular, bold } = await preloadPdfLibs();
    const { PDFDocument, rgb } = window.PDFLib;
    const c = normalizeCustomer(customer);

    const doc = await PDFDocument.create();
    doc.registerFontkit(window.fontkit);
    const font = await doc.embedFont(regular, { subset: true });
    const fontB = await doc.embedFont(bold, { subset: true });

    const INK = rgb(0.1, 0.1, 0.1);
    const GREY = rgb(0.4, 0.4, 0.4);
    const LINE = rgb(0.8, 0.8, 0.8);
    const FILL = rgb(0.94, 0.95, 0.97);
    const ACCENT = rgb(0.04, 0.33, 0.62);

    let page;
    let y; // bordo alto del prossimo elemento
    const newPage = () => {
        page = doc.addPage([PAGE_W, PAGE_H]);
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
        const lines = [];
        let line = '';
        for (let word of t.split(' ')) {
            while (width(word, size, f) > maxW) { // parola più lunga della riga: spezzata
                if (line) {
                    lines.push(line);
                    line = '';
                }
                let n = word.length;
                while (n > 1 && width(word.slice(0, n), size, f) > maxW) n--;
                lines.push(word.slice(0, n));
                word = word.slice(n);
            }
            const test = line ? `${line} ${word}` : word;
            if (!line || width(test, size, f) <= maxW) line = test;
            else {
                lines.push(line);
                line = word;
            }
        }
        if (line) lines.push(line);
        return lines.length ? lines : [''];
    }

    function truncate(t, size, maxW, f = font) {
        if (width(t, size, f) <= maxW) return t;
        while (t.length > 1 && width(`${t}…`, size, f) > maxW) t = t.slice(0, -1);
        return `${t}…`;
    }

    // --- riquadri con campi etichetta/valore -------------------------------

    function layoutFields(items, cellW) {
        return items.map(({ label, value }) => {
            const v = clean(value);
            const lines = v ? wrap(v, 10.5, cellW) : ['—'];
            return { label, lines, empty: !v, h: 10 + lines.length * 13 + 5 };
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

    const boxHeight = (rows) => TITLE_H + rows.reduce((n, r) => n + r.h, 0) + 4;

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

    // --- intestazione ---------------------------------------------------------

    text('Rapporto di prova', MARGIN, y, 22, { f: fontB });
    let left = y - 22 * 1.25;
    text(clean(report.title), MARGIN, left, 12, { color: GREY });
    left -= 12 * 1.35;

    let right = y;
    const rx = PAGE_W - MARGIN;
    if (report.start) {
        text('Data prova', rx, right, 8, { color: GREY, align: 'right' });
        right -= 11;
        text(formatDate(report.start), rx, right, 11, { f: fontB, align: 'right' });
        right -= 11 * 1.5;
    }
    const company = report.sections.find((s) => s.title === 'Azienda');
    if (company) {
        const co = Object.fromEntries(company.items.map((i) => [i.key, i.value]));
        const lines = [
            [co.name, true],
            [[co.street, co.houseNumber].filter(Boolean).join(' ')],
            [[co.postalCode, co.city].filter(Boolean).join(' ')],
            [co.phone && `Tel. ${co.phone}`],
            [co.email],
        ].filter(([t]) => t);
        for (const [t, isBold] of lines) {
            text(truncate(clean(t), 9, 260, isBold ? fontB : font), rx, right, 9, { f: isBold ? fontB : font, color: isBold ? INK : GREY, align: 'right' });
            right -= 12;
        }
    }
    y = Math.min(left, right) - 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: rx, y }, thickness: 1.2, color: ACCENT });
    y -= 12;

    // --- cliente e caldaia ----------------------------------------------------

    const gap = 14;
    const halfW = (CONTENT_W - gap) / 2;
    const clientRows = layoutRows([
        { label: 'Nome e cognome', value: c.name },
        { label: 'Codice fiscale', value: c.fiscalCode },
        { label: 'Indirizzo', value: c.address },
        { label: 'Telefono', value: c.phone },
    ], 1, halfW - PAD * 2);
    const boilerRows = layoutRows([
        { label: 'Marca', value: c.brand },
        { label: 'Matricola / codice caldaia', value: c.serial },
        { label: 'Targa impianto', value: c.plateCode },
        { label: 'Data di installazione', value: c.installDate },
    ], 1, halfW - PAD * 2);
    const h1 = Math.max(boxHeight(clientRows), boxHeight(boilerRows));
    ensure(h1);
    drawBox('Cliente', clientRows, MARGIN, halfW, h1);
    drawBox('Caldaia', boilerRows, MARGIN + halfW + gap, halfW, h1);
    y -= h1 + GAP;

    // --- dati della prova -----------------------------------------------------

    const testItems = report.header.map((h) => ({ label: h.label, value: h.value }));
    const testRows = layoutRows(testItems, 3, CONTENT_W - PAD * 2);
    const phases = report.sections.find((x) => x.title === 'Fasi della prova');
    if (phases) testRows.push(...layoutRows(phases.items.map(phaseItem), 3, CONTENT_W - PAD * 2));
    if (report.note) testRows.push(...layoutRows([{ label: 'Nota sulla prova', value: report.note }], 1, CONTENT_W - PAD * 2));
    if (testRows.length) {
        const h = boxHeight(testRows);
        ensure(h);
        drawBox('Dati prova', testRows, MARGIN, CONTENT_W, h);
        y -= h + GAP;
    }

    // --- risultati ------------------------------------------------------------

    const cols = report.columns.length ? report.columns : [''];
    const unitW = 54;
    const valW = cols.length > 1 ? 74 : 120;
    const labelW = CONTENT_W - unitW - cols.length * valW;
    const ROW_H = 21;
    const HEAD_H = 19;

    function tableHead() {
        text('RISULTATI', MARGIN, y, 8.5, { f: fontB, color: ACCENT });
        y -= 16;
        page.drawRectangle({ x: MARGIN, y: y - HEAD_H, width: CONTENT_W, height: HEAD_H, color: FILL });
        const base = y - HEAD_H / 2 - 3;
        put('Parametro', MARGIN + 8, base, 9, { f: fontB, color: GREY });
        cols.forEach((col, i) => put(cols.length > 1 ? col : 'Valore', MARGIN + labelW + (i + 1) * valW - 8, base, 9, { f: fontB, color: GREY, align: 'right' }));
        put('Unità', MARGIN + labelW + cols.length * valW + 8, base, 9, { f: fontB, color: GREY });
        y -= HEAD_H;
    }

    if (report.rows.length) {
        ensure(16 + HEAD_H + ROW_H * 2);
        tableHead();
        for (const row of report.rows) {
            if (y - ROW_H < BOTTOM) {
                newPage();
                tableHead();
            }
            const base = y - ROW_H / 2 - 4;
            let lx = MARGIN + 8;
            if (row.short && row.short !== row.label) {
                put(row.short, lx, base, 11, { f: fontB });
                lx += width(row.short, 11, fontB) + 8;
            }
            put(truncate(row.label, 10, MARGIN + labelW - lx - 6), lx, base, 10, { color: GREY });
            cols.forEach((col, i) => {
                const v = (row.cells[col] ?? '').replace(/^-(?=\d)/, '−');
                put(v, MARGIN + labelW + (i + 1) * valW - 8, base, 12, { f: fontB, color: /^-+$/.test(v) ? GREY : INK, align: 'right' });
            });
            put(row.unit, MARGIN + labelW + cols.length * valW + 8, base, 10, { color: GREY });
            y -= ROW_H;
            page.drawLine({ start: { x: MARGIN, y }, end: { x: rx, y }, thickness: 0.5, color: LINE });
        }
        y -= GAP;
    } else {
        const msg = report.errors.length ? report.errors.join(' ') : 'Il QR non contiene valori di misura.';
        text(msg, MARGIN, y, 11, { color: GREY });
        y -= 24;
    }

    // --- strumento -----------------------------------------------------

    for (const s of report.sections) {
        if (!/^Strumento/.test(s.title)) continue;
        const rank = (k) => (DEVICE_ORDER.includes(k) ? DEVICE_ORDER.indexOf(k) : DEVICE_ORDER.length);
        const items = s.items.filter((i) => !SKIP_DEVICE_KEYS.includes(i.key)).sort((a, b) => rank(a.key) - rank(b.key));
        const rows = layoutRows(items.map((i) => ({ label: i.label, value: i.value })), 3, CONTENT_W - PAD * 2);
        const h = boxHeight(rows);
        ensure(h);
        drawBox(s.title, rows, MARGIN, CONTENT_W, h);
        y -= h + GAP;
    }

    // --- note del tecnico: il riquadro continua sulla pagina dopo se serve ----

    if (c.notes) {
        const lines = c.notes.split('\n').flatMap((par) => wrap(par || ' ', 10.5, CONTENT_W - PAD * 2));
        for (let i = 0, first = true; i < lines.length; first = false) {
            ensure(TITLE_H + 13 * Math.min(3, lines.length - i) + 5);
            const fit = Math.max(1, Math.floor((y - BOTTOM - TITLE_H - 5) / 13));
            const chunk = lines.slice(i, i + fit);
            const h = TITLE_H + chunk.length * 13 + 5;
            page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, borderColor: LINE, borderWidth: 0.8 });
            text(first ? 'NOTE' : 'NOTE (SEGUE)', MARGIN + PAD, y - 9, 8.5, { f: fontB, color: ACCENT });
            chunk.forEach((l, j) => text(l, MARGIN + PAD, y - TITLE_H - j * 13, 10.5));
            y -= h + GAP;
            i += chunk.length;
        }
    }

    // --- piè di pagina ----------------------------------------------------------

    const pages = doc.getPages();
    pages.forEach((p, i) => {
        p.drawLine({ start: { x: MARGIN, y: MARGIN }, end: { x: rx, y: MARGIN }, thickness: 0.5, color: LINE });
        p.drawText(`Generato con Testo QR il ${formatDate(now)}`, { x: MARGIN, y: MARGIN - 12, size: 8, font, color: GREY });
        const label = `Pagina ${i + 1} di ${pages.length}`;
        p.drawText(label, { x: rx - width(label, 8), y: MARGIN - 12, size: 8, font, color: GREY });
    });

    doc.setTitle(`Rapporto di prova${c.name ? ` - ${c.name}` : ''}`);
    doc.setProducer('Testo QR');
    doc.setCreator('Testo QR');
    doc.setCreationDate(now);
    doc.setModificationDate(now);
    return doc.save();
}
