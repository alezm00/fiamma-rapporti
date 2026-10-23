# Il PDF

Il rapporto si trasforma in un PDF A4 **tutto sul telefono**, con [pdf-lib](https://pdf-lib.js.org/) e il font Liberation Sans: funziona anche senza internet. Il codice è in `src/pdf/`, una parte del foglio per file.

## Come si chiama

```js
const bytes = await createReportPdf(rapporto, impostazioni, { photos, logo, now });
```

- `rapporto`: l'oggetto rapporto ([Modello dati](03-modello-dati.md)).
- `impostazioni`: serve `company` (ditta e tecnico).
- `photos`: `[{ bytes, width, height }]` (JPEG), da `photosForPdf(reportId)`; `logo`: `{ bytes, width, height }` o `null`, da `logoForPdf()`.
- `now`: la data di creazione scritta nel file (per le prove).
- Restituisce i byte del PDF (`Uint8Array`).

Chi lo usa: `src/screens/editor/send.js` (Salva PDF, condividi, email) e `src/backup/folder/writer.js` (il `rapporto.pdf` dei rapporti chiusi nella cartella di salvataggio).

Le librerie (`vendor/pdf-lib.min.js`, `vendor/fontkit.umd.min.js`) e i due font (`vendor/LiberationSans-Regular.ttf`, `…-Bold.ttf`) si caricano solo quando servono (`preloadPdfLibs`, in `src/pdf/libs.js`). L'editor le precarica appena si apre un rapporto: sul telefono la condivisione (`navigator.share`) può essere negata se passa troppo tempo dal tocco, e caricare le librerie in quel momento richiederebbe tempo.

## L'ordine del foglio

`src/pdf/index.js` mette insieme le parti nell'ordine in cui compaiono:

| # | Parte | File | Contenuto |
|---|---|---|---|
| 1 | Intestazione | `header.js` | Logo e dati della ditta a sinistra; "RAPPORTO DI INTERVENTO", numero (o "BOZZA" in arancione) e data a destra. |
| 2 | Cliente, impianto, intervento, lavori | `parties.js` | Riquadri di campi; una scheda per apparecchio; "Lavori eseguiti" come testo libero. |
| 3 | Materiali | `materials.js` | Tabella descrizione / quantità. |
| 4 | Misure Testo | `measures.js` | Confronto o tabelle singole, "Dati misura" (fasi, note), poi gli strumenti. |
| 5 | Note | `index.js` | Riquadro di testo libero. |
| 6 | Foto | `photos.js` | Due colonne, circa 4 per foglio. |
| 7 | Tecnico, piè di pagina | `footer.js` | "Tecnico: …"; su ogni pagina "Rapporto … · Cliente" e "Pagina n di m". |

Il titolo del PDF è `Rapporto di intervento n. 2026/012 - Mario Rossi` (per una bozza `… (bozza) …`); produttore e creatore `Fiamma`.

## `sheet.js`: la pagina e il cursore

`createSheet(pdf, { font, fontB, rgb })` restituisce l'oggetto che le parti usano. Il concetto base è il **cursore verticale** `sheet.y`: il bordo alto del prossimo elemento. Si scrive e poi si scende (`sheet.y -= altezza`). Se un elemento non ci sta, `ensure(altezza)` apre una nuova pagina.

| Funzione | A cosa serve |
|---|---|
| `ensure(h)`, `newPage()` | Pagina nuova se non c'è spazio per `h`. |
| `put(testo, x, base, size, opts)`, `text(testo, x, alto, size, opts)` | Scrivono con la linea di base o con il bordo alto a una certa quota. `opts`: `f` (font), `color`, `align`. |
| `wrap(testo, size, larghezza)` | A capo per parole; una parola più lunga della riga viene spezzata. |
| `truncate(testo, size, larghezza)` | Taglia con "…". |
| `printable(testo)`, `lines(testo)` | Pulizia: i caratteri che il font non ha (emoji…) diventano `?` invece di rompere il PDF. |
| `fieldsBox(titolo, campi, colonne)` | Un riquadro con campi etichetta/valore. Non si spezza tra due pagine. |
| `textBox(titolo, righe)` | Un riquadro di testo libero che **continua** sulla pagina dopo ("… (SEGUE)"). |

`fieldsBox` riceve `campi = [{ label, value, span?, grow? }]` e il numero di `colonne`. Un campo occupa `span` colonne (1 se non indicato); con `grow: true` ne prende **due se il testo non entra in una** (si usa per il modello dell'apparecchio). Un campo vuoto si scrive come "—" in grigio. I campi vanno a capo quando la riga è piena.

### Misure di impaginazione

Costanti in `src/pdf/sheet.js` (punti PostScript, 1 pt = 1/72 di pollice):

| Costante | Valore | Significato |
|---|---|---|
| `PAGE_W` × `PAGE_H` | 595,28 × 841,89 | A4 |
| `MARGIN` | 42 | margine; `CONTENT_W` = larghezza − 2 × margine |
| `BOTTOM` | `MARGIN + 18` | limite in basso (lascia spazio al piè di pagina) |
| `PAD` | 10 | rientro nei riquadri |
| `TITLE_H` | 18 | altezza del titolo di un riquadro |
| `GAP` | 8 | spazio tra i blocchi |
| `FIELD_SIZE`, `LINE_H` | 10, 12 | corpo e interlinea del testo nei riquadri |

Il PDF è "compatto" per scelta: titoli e righe bassi, e i riquadri usano le colonne per tenere vicino quello che va letto insieme (cliente su 4 colonne; apparecchi su 5; intervento su 7: tipo e esito su due colonne ciascuno, poi arrivo, partenza, durata).

## Le misure

`drawMeasures` scorre `groupMeasures(r.measures)` ([QR e misure](04-qr-testo.md)):

- blocco `compare`: **una tabella** "Misure Testo · titolo" con una colonna per etichetta (Prima | Dopo), e sotto il titolo una riga grigia per misura ("Prima: 22/10/2026 19:10 · Metano");
- blocco `single`: una tabella per misura, con le colonne che ha (Media, Min, Max…) e sotto i "Dati misura" (combustibile escluso: è già nella riga grigia): O₂ riferimento, CO₂ max, **fasi della prova** (`Fase 1 (1 min 00 s)` / `19:10:24 → 19:11:24`) e nota;
- una misura senza valori (errore dello strumento, QR vuoto) → una riga con il messaggio;
- alla fine, **gli strumenti usati**, senza ripetizioni (il numero di serie distingue), una riga ciascuno: "testo 330 · N. di serie 65899481 · Firmware 1.2.3".

Righe di tabella alte 17 pt, intestazione 16. Il confronto resta su **una pagina sola se ci entra**; se non ci entra continua sulla pagina dopo con l'intestazione ripetuta. I valori negativi usano il segno meno tipografico (−).

## Le foto

Due colonne (larghezza di una colonna ≈ 250 pt, con 10 pt tra le colonne). L'**altezza massima** di una foto è calcolata perché **due righe entrino in una pagina intera** (≈ 340 pt): una foto in piedi riempie la sua casella (≈ 250 × 335), una in orizzontale è larga una colonna (≈ 250 × 190). Ogni riga ha l'altezza della foto più alta e una didascalia "Foto n". Se una riga non entra, passa alla pagina dopo.

Le foto nel database sono già ridimensionate (lato lungo 1280 px, JPEG qualità 0,8): su una casella da 250 pt sono circa 275–370 dpi, più che abbastanza per la stampa.

## Aggiungere una parte al PDF

1. Crea un file `src/pdf/<nome>.js` con `export function draw<Nome>(sheet, r)`. Prendi dal `sheet` quello che serve (`const { text, ensure, fieldsBox, … } = sheet`) e i colori (`INK`, `GREY`, `LINE`, `FILL`, `ACCENT`, `AMBER`).
2. Scrivi con il cursore: `ensure(altezza)`, disegna usando `sheet.page` e `sheet.y` (**sempre** `sheet.page`, perché la pagina cambia), poi `sheet.y -= altezza + GAP`.
3. Chiamala in `src/pdf/index.js` nel punto giusto.
4. Aggiungi il file a `FILES` di `sw.js` e alla mappa di [Struttura del codice](02-struttura-del-codice.md); alza `CACHE`.
5. Verifica a occhio e con il testo (sotto).

## Come si prova

- `tests/e2e/pdf.cjs` crea un rapporto completo (4 apparecchi, materiali, tre misure, foto, logo), salva bozza e rapporto chiuso, e controlla con `pdftotext` che ci siano i dati, la prima pagina contenga intervento, lavori e materiali, le fasi della prova siano nel PDF e le foto siano al massimo 4 per pagina.
- Per un cambiamento di impaginazione, **confronta con la versione precedente**: genera i PDF (`tests/e2e/run.sh pdf` li lascia in `/tmp/testoqr-e2e/pdf5/`), poi `pdftoppm -r 80 -png file.pdf prefisso` per vedere le pagine e `pdftotext -layout` per il testo. Per un refactoring che non deve cambiare nulla le pagine devono risultare **identiche** (`cmp` sulle immagini).
