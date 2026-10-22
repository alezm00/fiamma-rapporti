// Rapporto di intervento in PDF (pdf-lib + font Liberation Sans): tutto in locale, funziona anche offline.
// Le librerie e i font si caricano solo quando serve il PDF.
import { formatDate } from './tjf.js';
import {
    groupMeasures, formatDay, typeLabel, outcomeLabel, chamberLabel, technologyLabel, fuelLabel, durationMinutes, formatDuration,
} from './model.js';

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 42;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = MARGIN + 18; // spazio per il piè di pagina
const PAD = 10;
const TITLE_H = 24;
const GAP = 12; // spazio tra i blocchi

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
// Pulizia dei testi
// ---------------------------------------------------------------------------

const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
const oneLine = (s) => clean(String(s ?? '').replace(/[\r\n]+/g, ', '));
const code = (s) => clean(s).replace(/\s+/g, '').toUpperCase(); // codice fiscale, targa: senza spazi, maiuscolo
// testo su più righe (lavori, note): righe pulite, al massimo una riga vuota di seguito
const multiline = (s) => String(s ?? '').replace(/\r\n?/g, '\n').split('\n').map(clean).join('\n').replace(/\n{3,}/g, '\n\n').trim();

// ---------------------------------------------------------------------------
// Creazione del PDF
// ---------------------------------------------------------------------------

// r: il rapporto; settings: impostazioni (ditta e tecnico); photos: [{ bytes: JPEG, width, height }];
// logo: { bytes: JPEG, width, height } oppure null
export async function createReportPdf(r, settings = {}, { photos = [], logo = null, now = new Date() } = {}) {
    const { regular, bold } = await preloadPdfLibs();
    const { PDFDocument, rgb } = window.PDFLib;
    const company = settings.company ?? {};
    const customer = r.customer ?? {};
    const plant = r.plant ?? {};
    const work = r.intervention ?? {};
    const isDraft = !r.number;

    const pdf = await PDFDocument.create();
    pdf.registerFontkit(window.fontkit);
    const font = await pdf.embedFont(regular, { subset: true });
    const fontB = await pdf.embedFont(bold, { subset: true });

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
    const rx = PAGE_W - MARGIN;

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

    // --- intestazione: ditta a sinistra, numero e data a destra ----------------

    const RIGHT_W = 190;
    let left = y;
    let lx = MARGIN;
    if (logo) {
        const image = await pdf.embedJpg(logo.bytes);
        const k = Math.min(120 / image.width, 48 / image.height);
        page.drawImage(image, { x: MARGIN, y: y - image.height * k, width: image.width * k, height: image.height * k });
        lx += image.width * k + 12;
        left = y - image.height * k;
    }
    const maxLeft = rx - RIGHT_W - lx;
    let ty = y;
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

    let right = y;
    text('RAPPORTO DI INTERVENTO', rx, right, 8.5, { f: fontB, color: ACCENT, align: 'right' });
    right -= 8.5 * 1.6;
    text(isDraft ? 'BOZZA' : `n. ${r.number}`, rx, right, 20, { f: fontB, color: isDraft ? AMBER : INK, align: 'right' });
    right -= 20 * 1.3;
    if (r.date) {
        text(`Data intervento ${formatDay(r.date)}`, rx, right, 10, { color: GREY, align: 'right' });
        right -= 10 * 1.5;
    }
    y = Math.min(left, right) - 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: rx, y }, thickness: 1.2, color: ACCENT });
    y -= 12;

    // --- cliente e impianto ---------------------------------------------------

    const installDate = /^\d{4}-\d{2}-\d{2}$/.test(plant.installDate || '') ? formatDay(plant.installDate) : clean(plant.installDate);
    const kw = (v) => (/^[\d.,\s]+$/.test(clean(v)) && clean(v) ? `${clean(v)} kW` : clean(v)); // "24" -> "24 kW"
    fieldsBox('Cliente', [
        { label: 'Nome e cognome', value: customer.name },
        { label: 'Codice fiscale', value: code(customer.fiscalCode) },
        { label: 'Indirizzo', value: oneLine(customer.address) },
        { label: 'Telefono', value: customer.phone },
    ], 2);
    fieldsBox('Impianto', [
        { label: 'Marca', value: plant.brand },
        { label: 'Modello', value: plant.model },
        { label: 'Matricola / codice', value: plant.serial },
        { label: 'Targa impianto', value: code(plant.plateCode) },
        { label: 'Data di installazione', value: installDate },
        { label: 'Combustibile', value: fuelLabel(plant.fuel) },
        { label: 'Camera di combustione', value: chamberLabel(plant.chamber) },
        { label: 'Tipo di caldaia', value: technologyLabel(plant.technology) },
        { label: 'Potenza termica nominale', value: kw(plant.nominalPower) },
        { label: 'Potenza termica reale', value: kw(plant.actualPower) },
    ], 4);

    // --- intervento: tipo, esito, orari e durata -------------------------------

    const minutes = durationMinutes(work.startTime, work.endTime);
    const what = [
        { label: 'Tipo di intervento', value: typeLabel(work.type) },
        { label: 'Esito', value: outcomeLabel(work.outcome) },
        { label: 'Data', value: formatDay(r.date) },
    ];
    if (work.startTime || work.endTime) {
        what.push(
            { label: 'Arrivo', value: work.startTime },
            { label: 'Partenza', value: work.endTime },
            { label: 'Durata', value: formatDuration(minutes) },
        );
    }
    fieldsBox('Intervento', what, 3);

    const workLines = lines(work.work);
    if (workLines.join('')) textBox('LAVORI ESEGUITI', workLines);

    // --- materiali ----------------------------------------------------------------

    const materials = (work.materials ?? []).filter((m) => clean(m.text) || clean(m.qty));
    if (materials.length) {
        const qtyW = 110;
        const descW = CONTENT_W - qtyW - 16;
        const rows = materials.map((m) => {
            const ls = wrap(printable(m.text) || '—', 10.5, descW);
            return { ls, qty: printable(m.qty), h: Math.max(20, ls.length * 13 + 8) };
        });
        ensure(16 + 19 + rows[0].h);
        text('MATERIALI', MARGIN, y, 8.5, { f: fontB, color: ACCENT });
        y -= 16;
        const head = () => {
            page.drawRectangle({ x: MARGIN, y: y - 19, width: CONTENT_W, height: 19, color: FILL });
            put('Descrizione', MARGIN + 8, y - 19 / 2 - 3, 9, { f: fontB, color: GREY });
            put('Quantità', rx - 8, y - 19 / 2 - 3, 9, { f: fontB, color: GREY, align: 'right' });
            y -= 19;
        };
        head();
        for (const row of rows) {
            if (y - row.h < BOTTOM) {
                newPage();
                head();
            }
            row.ls.forEach((l, j) => put(l, MARGIN + 8, y - 5 - 10.5 * 0.8 - j * 13 - 1, 10.5));
            put(row.qty, rx - 8, y - 5 - 10.5 * 0.8 - 1, 10.5, { f: fontB, align: 'right' });
            y -= row.h;
            page.drawLine({ start: { x: MARGIN, y }, end: { x: rx, y }, thickness: 0.5, color: LINE });
        }
        y -= GAP;
    }

    // --- misure Testo: confronto affiancato per lo stesso tipo, altrimenti una tabella ciascuna ----

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
            page.drawRectangle({ x: MARGIN, y: y - HEAD_H, width: CONTENT_W, height: HEAD_H, color: FILL });
            const base = y - HEAD_H / 2 - 3;
            put('Parametro', MARGIN + 8, base, 9, { f: fontB, color: GREY });
            columns.forEach((col, i) => put(truncate(printable(col), 9, valW - 10, fontB), MARGIN + labelW + (i + 1) * valW - 8, base, 9, { f: fontB, color: GREY, align: 'right' }));
            put('Unità', MARGIN + labelW + n * valW + 8, base, 9, { f: fontB, color: GREY });
            y -= HEAD_H;
        };

        // il confronto resta su una pagina sola se ci entra; altrimenti continua con l'intestazione ripetuta
        const total = 16 + infoLines.length * 12 + HEAD_H + ROW_H * rows.length;
        ensure(total <= PAGE_H - MARGIN - BOTTOM ? total : 16 + infoLines.length * 12 + HEAD_H + ROW_H * 2);
        text(printable(title).toUpperCase(), MARGIN, y, 8.5, { f: fontB, color: ACCENT });
        y -= 16;
        for (const l of infoLines) {
            text(l, MARGIN, y, 9, { color: GREY });
            y -= 12;
        }
        if (infoLines.length) y -= 2;
        tableHead();
        for (const row of rows) {
            if (y - ROW_H < BOTTOM) {
                newPage();
                tableHead();
            }
            const base = y - ROW_H / 2 - 4;
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
            y -= ROW_H;
            page.drawLine({ start: { x: MARGIN, y }, end: { x: rx, y }, thickness: 0.5, color: LINE });
        }
        y -= GAP;
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
                text(printable(`Misura "${block.label}": ${rep.errors.length ? rep.errors.join(' ') : 'il QR non contiene valori di misura.'}`), MARGIN, y, 10, { color: GREY });
                y -= 24;
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

    // --- note ------------------------------------------------------------------

    const noteLines = lines(work.notes);
    if (noteLines.join('')) textBox('NOTE', noteLines);

    // --- foto: griglia a 2 colonne, continua sulle pagine successive ---------

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
                text('FOTO', MARGIN, y, 8.5, { f: fontB, color: ACCENT });
                y -= 18;
            }
            row.forEach((p, j) => {
                const x = MARGIN + j * (cellW + PHOTO_GAP);
                page.drawImage(p.image, { x, y: y - p.h, width: p.w, height: p.h });
                page.drawRectangle({ x, y: y - p.h, width: p.w, height: p.h, borderColor: LINE, borderWidth: 0.5 });
                text(`Foto ${i + j + 1}`, x, y - p.h - 3, 8, { color: GREY });
            });
            y -= rowH + 6;
        }
    }

    // --- tecnico ---------------------------------------------------------------

    const technician = printable(company.technician);
    if (technician) {
        ensure(30);
        y -= 6;
        text(`Tecnico: ${technician}`, MARGIN, y, 10.5, { f: fontB });
        y -= 20;
    }

    // --- piè di pagina ------------------------------------------------------------

    const label = isDraft ? 'Bozza: rapporto non ancora chiuso' : `Rapporto di intervento n. ${r.number}`;
    const pages = pdf.getPages();
    pages.forEach((p, i) => {
        p.drawLine({ start: { x: MARGIN, y: MARGIN }, end: { x: rx, y: MARGIN }, thickness: 0.5, color: LINE });
        p.drawText(printable([label, customer.name].filter(Boolean).join(' · ')), { x: MARGIN, y: MARGIN - 12, size: 8, font, color: GREY });
        const pageLabel = `Pagina ${i + 1} di ${pages.length}`;
        p.drawText(pageLabel, { x: rx - width(pageLabel, 8), y: MARGIN - 12, size: 8, font, color: GREY });
    });

    pdf.setTitle(printable(`Rapporto di intervento${r.number ? ` n. ${r.number}` : ' (bozza)'}${customer.name ? ` - ${customer.name}` : ''}`));
    pdf.setProducer('Fiamma');
    pdf.setCreator('Fiamma');
    pdf.setCreationDate(now);
    pdf.setModificationDate(now);
    return pdf.save();
}
