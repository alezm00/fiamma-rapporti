// Pulizia dei testi prima di scriverli nel PDF.

export const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
export const oneLine = (s) => clean(String(s ?? '').replace(/[\r\n]+/g, ', '));
export const code = (s) => clean(s).replace(/\s+/g, '').toUpperCase(); // codice fiscale, targa: senza spazi, maiuscolo
// testo su più righe (lavori, note): righe pulite, al massimo una riga vuota di seguito
export const multiline = (s) => String(s ?? '').replace(/\r\n?/g, '\n').split('\n').map(clean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
