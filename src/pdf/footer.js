// Nome del tecnico e piè di pagina.

import { MARGIN, RIGHT } from './sheet.js';

export function drawTechnician(sheet, company) {
    const { fontB, text, ensure, printable } = sheet;
    const technician = printable(company.technician);
    if (technician) {
        ensure(30);
        sheet.y -= 6;
        text(`Tecnico: ${technician}`, MARGIN, sheet.y, 10.5, { f: fontB });
        sheet.y -= 20;
    }
}

// su ogni pagina: righe, "Bozza"/numero con il cliente, e "Pagina n di m"
export function drawFooters(sheet, r) {
    const { pdf, font, GREY, LINE, width, printable } = sheet;
    const label = r.number ? `Rapporto di intervento n. ${r.number}` : 'Bozza: rapporto non ancora chiuso';
    const pages = pdf.getPages();
    pages.forEach((p, i) => {
        p.drawLine({ start: { x: MARGIN, y: MARGIN }, end: { x: RIGHT, y: MARGIN }, thickness: 0.5, color: LINE });
        p.drawText(printable([label, r.customer?.name].filter(Boolean).join(' · ')), { x: MARGIN, y: MARGIN - 12, size: 8, font, color: GREY });
        const pageLabel = `Pagina ${i + 1} di ${pages.length}`;
        p.drawText(pageLabel, { x: RIGHT - width(pageLabel, 8), y: MARGIN - 12, size: 8, font, color: GREY });
    });
}
