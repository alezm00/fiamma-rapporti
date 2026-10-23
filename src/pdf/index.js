// Rapporto di intervento in PDF (pdf-lib + font Liberation Sans): tutto in locale, funziona anche offline.
// Le librerie e i font si caricano solo quando serve il PDF. Ogni parte del foglio sta in un file:
// intestazione, cliente/impianto/intervento, materiali, misure, foto, tecnico e piè di pagina.

import { preloadPdfLibs } from './libs.js';
import { createSheet } from './sheet.js';
import { drawHeader } from './header.js';
import { drawParties } from './parties.js';
import { drawMaterials } from './materials.js';
import { drawMeasures } from './measures.js';
import { drawPhotos } from './photos.js';
import { drawTechnician, drawFooters } from './footer.js';

export { preloadPdfLibs };

// r: il rapporto; settings: impostazioni (ditta e tecnico); photos: [{ bytes: JPEG, width, height }];
// logo: { bytes: JPEG, width, height } oppure null
export async function createReportPdf(r, settings = {}, { photos = [], logo = null, now = new Date() } = {}) {
    const { regular, bold } = await preloadPdfLibs();
    const { PDFDocument, rgb } = window.PDFLib;
    const company = settings.company ?? {};

    const pdf = await PDFDocument.create();
    pdf.registerFontkit(window.fontkit);
    const font = await pdf.embedFont(regular, { subset: true });
    const fontB = await pdf.embedFont(bold, { subset: true });
    const sheet = createSheet(pdf, { font, fontB, rgb });

    await drawHeader(sheet, r, company, logo);
    drawParties(sheet, r);
    drawMaterials(sheet, r);
    drawMeasures(sheet, r);
    const noteLines = sheet.lines(r.intervention?.notes);
    if (noteLines.join('')) sheet.textBox('NOTE', noteLines);
    await drawPhotos(sheet, photos);
    drawTechnician(sheet, company);
    drawFooters(sheet, r);

    pdf.setTitle(sheet.printable(`Rapporto di intervento${r.number ? ` n. ${r.number}` : ' (bozza)'}${r.customer?.name ? ` - ${r.customer.name}` : ''}`));
    pdf.setProducer('Fiamma');
    pdf.setCreator('Fiamma');
    pdf.setCreationDate(now);
    pdf.setModificationDate(now);
    return pdf.save();
}
