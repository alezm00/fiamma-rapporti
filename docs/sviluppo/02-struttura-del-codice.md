# Struttura del codice

Mappa di tutti i file di `src/`, cartella per cartella. Ogni file è nominato qui con il suo percorso: la prova `tests/unit/docs.test.mjs` controlla che non ne manchi nessuno (quando aggiungi un file, aggiungilo anche qui). Le funzioni indicate sono quelle che gli altri file usano; le altre sono interne.

Per l'ordine delle dipendenze vedi [Architettura](01-architettura.md).

## `src/app.js`

| File | Cosa fa |
|---|---|
| `src/app.js` | Avvio: `registerClasses()`, service worker, `init()` e registrazione di ogni schermata in `nav`, `folder.start()`, `nav.start()` e `runShortcut()` (scorciatoie dell'icona). |

## `src/lib/` — funzioni generiche

| File | Cosa fa |
|---|---|
| `src/lib/dates.js` | `pad`, `dayString(Date)` → `2026-10-22`, `formatDay('2026-10-22')` → `22/10/2026`, `formatTime`, `formatDate`. Un solo posto per i formati di data e ora. |
| `src/lib/validate.js` | `checkFiscalCode(testo)`: codice fiscale a 16 caratteri (anche con omocodia) o partita IVA a 11 cifre; restituisce `{ empty, ok, value, error }`. Solo un avviso, non blocca mai. |
| `src/lib/geo.js` | `getPosition()` (GPS del telefono), `geoErrorMessage`, `reverseGeocode(lat, lon)` → indirizzo via OpenStreetMap Nominatim, `formatAddress` (risposta di Nominatim → `Via Roma 12, 33100 Udine (UD)`). |
| `src/lib/zip.js` | `createZip(voci)` e `readZip(file)`: ZIP senza librerie, con la compressione `deflate-raw` del browser; `crc32`. |

## `src/qr/` — lettura dei QR

| File | Cosa fa |
|---|---|
| `src/qr/scanner.js` | `startCamera({ video, onStatus, onBytes })` (fotocamera dal vivo con zxing-wasm, torcia, messa a fuoco continua), `readImage(file)` (da una foto), `cameraError`. Restituisce i **byte grezzi** del QR, anche per i QR divisi in più parti (structured append). |
| `src/qr/tjf/index.js` | `bytesToJson(byte)` (gzip o zlib → JSON), `buildReport(json)` (il "report" da mostrare), `reportToText` (testo da copiare), `topValues` (anteprima dei primi valori). Riesporta `formatNumber` e `toDate`. |
| `src/qr/tjf/channels.js` | `buildChannels`: righe (un valore per canale) e colonne (Media, Min, Max…), conversione delle unità. |
| `src/qr/tjf/items.js` | Elenchi etichetta/valore: proprietà, risultati, informazioni aggiuntive, appendici, `phaseItems` (fasi della prova con `range` e `duration`). |
| `src/qr/tjf/format.js` | `formatNumber` (virgola decimale, niente `-0,0`), `formatSeconds`, `toDate`, `formatScalar`, `humanize`. |
| `src/qr/tjf/labels.js` | Le tabelle: canali conosciuti (`CHANNELS`: etichetta in italiano, sigla, decimali, ordine), unità di pressione, nomi delle statistiche, etichette di proprietà, strumento, contatti, appendici, errori. |

## `src/model/` — la logica dei rapporti (senza DOM né database)

`src/model/index.js` riunisce tutto: le altre cartelle importano da `model/index.js`, tranne `mail.js` e i file interni.

| File | Cosa fa |
|---|---|
| `src/model/index.js` | Punto d'ingresso: `export *` dei file sotto. |
| `src/model/values.js` | `newId()`, `isId(valore)`, e piccole funzioni per leggere dati incerti: `text`, `time`, `isObject`, `labelIn`. |
| `src/model/units.js` | Gli apparecchi: `UNIT_KINDS` (caldaia, pompa di calore, condizionatore, con i loro campi), `newUnit`, `unitTitle` ("Caldaia 1", "Caldaia 2"), `unitsSummary`, `unitValues`, `unitName`, `normalizePlant`. |
| `src/model/report.js` | `newReport`, `STATUSES`, `INTERVENTION_TYPES`, `OUTCOMES`, `applyEdit`, `isBlank`, `duplicateReport`, la numerazione (`formatReportNumber`, `nextNumber`, `setNextNumber`, `closeReport`, `markSent`), `slug`, `reportFileName`, `describeReport`, orari (`durationMinutes`, `formatDuration`). |
| `src/model/list.js` | `searchText`, `filterReports`, `sortReports`, `yearsOf`, `monthLabel`, `groupByMonth`, e il cestino: `TRASH_DAYS`, `trashDaysLeft`, `isExpired`. |
| `src/model/measures.js` | `addMeasure`, `nextMeasureLabel` (Prima, Dopo, Misura 3…), `groupMeasures` (confronto affiancato o tabelle separate). |
| `src/model/normalize.js` | `normalizeReport(oggetto)`: rifà un rapporto pulito da dati letti da fuori (cartella, backup), oppure `null`. |
| `src/model/mail.js` | Destinatari (`parseRecipients`, `checkRecipients`), `mailtoUrl`, e il **testo** con segnaposto: `DEFAULT_MAIL`, `MAIL_PLACEHOLDERS`, `mailValues`, `renderSubject`, `renderBody`, `unknownPlaceholders`, `buildSubject`, `buildBody`. |

## `src/data/` — quello che resta sul telefono

| File | Cosa fa |
|---|---|
| `src/data/db.js` | Strato su IndexedDB: `getAll`, `get`, `put`, `remove`, `getByIndex`, `removeByIndex`, `clear`; stores `REPORTS`, `PHOTOS`, `META`. Se IndexedDB manca ripiega su una memoria temporanea (`usingMemory()`). |
| `src/data/store.js` | I rapporti: `createReport`, `saveReport`, `getReport`, `loadAll` / `listReports` / `listTrash`, `trashReport`, `restoreReport`, `purgeReport`, `purgeExpired`, `duplicate`, `close`, `markSent`, `importReport`; l'`events` `change`. |
| `src/data/photos.js` | Foto e logo: `compressImage`, `addPhoto`, `listPhotos`, `removePhoto`, `photosForPdf`, `setLogo`, `getLogo`, `logoForPdf`, `importPhoto`, `importLogo`. |
| `src/data/settings.js` | Impostazioni in `localStorage`: `loadSettings`, `saveSettings`, `updateSettings`, `normalizeSettings`, `mergeSettings`. |
| `src/data/quickscans.js` | Le ultime 20 scansioni rapide in `localStorage`: `loadScans`, `getScan`, `addScan`, `removeScan`, `clearScans`. |

## `src/pdf/` — il rapporto in PDF

| File | Cosa fa |
|---|---|
| `src/pdf/index.js` | `createReportPdf(rapporto, impostazioni, { photos, logo, now })` mette insieme le parti nell'ordine del foglio; riesporta `preloadPdfLibs`. |
| `src/pdf/libs.js` | `preloadPdfLibs()`: carica pdf-lib, fontkit e i due font solo quando serve. |
| `src/pdf/sheet.js` | La pagina: misure A4, colori, il cursore verticale `y`, `put`/`text`, `wrap`, `truncate`, i riquadri con campi (`fieldsBox`, con `span` e `grow`) e di testo (`textBox`). |
| `src/pdf/text.js` | `clean`, `oneLine`, `code`, `multiline`: pulizia dei testi. |
| `src/pdf/header.js` | Logo, dati della ditta, numero e data. |
| `src/pdf/parties.js` | Cliente, impianto (una scheda per apparecchio), intervento, lavori. |
| `src/pdf/materials.js` | Tabella dei materiali. |
| `src/pdf/measures.js` | Tabelle delle misure (confronto o singole), dati misura, strumenti. |
| `src/pdf/photos.js` | Foto a due colonne. |
| `src/pdf/footer.js` | Nome del tecnico e piè di pagina. |

## `src/backup/` — copie di sicurezza

| File | Cosa fa |
|---|---|
| `src/backup/zip-backup.js` | `createBackup({ withPhotos })` e `restoreBackup(file)`: tutto in un file ZIP. |
| `src/backup/folder/index.js` | La cartella di salvataggio: stato (`status`), coda e scrittura (`process`), collegamento (`pick`, `linkHandle`, `unlink`), `syncAll`, `reactivate`, `test`, `restore`, `start`, `explain`. |
| `src/backup/folder/files.js` | Operazioni sui file di una `FileSystemDirectoryHandle`: `dir`, `writeFile`, `readFile`, `removeDir`, `subdirs`, `memoryCopy`, `missing`; `ROOT` = `Fiamma`. |
| `src/backup/folder/state.js` | Cosa si ricorda in IndexedDB della cartella: collegamento, coda, indice di quello che è già scritto. |
| `src/backup/folder/writer.js` | `writeReport` (rapporto.json, foto, PDF) e `removeReport`. |
| `src/backup/folder/settings-file.js` | `peekSettings`, `takeSettingsFrom`, `writeSettings` (`impostazioni.json` e `logo.jpg`). |
| `src/backup/folder/restore.js` | `restoreRoot`: rilegge rapporti, foto e impostazioni dalla cartella. |
| `src/backup/folder/paths.js` | `folderPath(rapporto)`: dove va nella cartella (`rapporti/<anno>/<cartella>`), e `id8`. |

## `src/ui/` — gli strumenti della pagina

| File | Cosa fa |
|---|---|
| `src/ui/nav.js` | Navigazione tra schermate con la history API: `register`, `go`, `replace`, `back`, `home`, `current`, `start`. |
| `src/ui/classes.js` | Le classi Tailwind create dal JavaScript (`CLS`, `MSG`, `TOAST`, `BADGES`) e `registerClasses()`. |
| `src/ui/util.js` | `$` e `el`, `fieldElement` (un campo da una definizione), `showBoxMsg`, `toast`, `statusBadge`, `debounce`, `downloadFile`, `openMailto`, `canShareFiles`, `keepAwake`, `vibrate`, `explainSaveError`. |

## `src/screens/` — le schermate

Ogni schermata esporta `init()` (una volta, collega i pulsanti), `enter(params)` e, se serve, `leave()` (si chiama quando si esce).

| File | Cosa fa |
|---|---|
| `src/screens/home.js` | Elenco: ricerca, filtri per stato e anno, mesi, 50 righe alla volta, promemoria della copia di sicurezza, scarto delle bozze vuote. |
| `src/screens/scan.js` | Fotocamera, "Da foto", "Importa file"; due modi: `quick` e `attach` (aggiunge la misura a un rapporto). |
| `src/screens/measure.js` | Valori di una misura, grandi; etichetta (Prima / Dopo), copia, rimozione. |
| `src/screens/quick.js` | Elenco delle scansioni rapide. |
| `src/screens/trash.js` | Cestino: ripristina, elimina per sempre, svuota. |
| `src/screens/settings.js` | Impostazioni: ditta, logo, numerazione, email, cartella di salvataggio, backup. |
| `src/screens/settings-mail.js` | La scheda "Testo dell'email": oggetto e messaggio, segnaposto da toccare, anteprima con un rapporto d'esempio, ripristino (`initMail`, `fillMail`, `readMail`). |
| `src/screens/editor/index.js` | Il rapporto: ingresso, uscita, collegamento di tutte le parti. |
| `src/screens/editor/session.js` | Il rapporto aperto (`session.doc`) e il salvataggio automatico (`touch`, `flush`, `saveNow`, `retrySave`, `guarded`). |
| `src/screens/editor/form.js` | I campi semplici (`FIELDS`: dove va ogni campo nel rapporto), intestazione, durata, destinatario, avviso del codice fiscale. |
| `src/screens/editor/units.js` | Apparecchi: aggiungi, togli, un modulo per tipo. |
| `src/screens/editor/materials.js` | Materiali: righe descrizione e quantità. |
| `src/screens/editor/measures.js` | Elenco delle misure del rapporto e tasto "Aggiungi misura". |
| `src/screens/editor/photos.js` | Foto: griglia, fotocamera e galleria, eliminazione, visualizzazione. |
| `src/screens/editor/address.js` | "Usa la mia posizione". |
| `src/screens/editor/send.js` | "Invia email", "Salva PDF" e condivisione. |
| `src/screens/editor/actions.js` | "Chiudi rapporto", "Duplica", "Elimina". |

## Fuori da `src/`

| File | Cosa fa |
|---|---|
| `index.html` | Tutte le schermate (una per `<main>`/`<section>`, `view-…`), con gli id che il JS usa. |
| `sw.js` | Service worker: elenco `FILES`, versione `CACHE`. Vedi [Offline e pubblicazione](08-offline-e-pubblicazione.md). |
| `manifest.json` | Nome, icone, colori, scorciatoie dell'icona. |
| `css/tailwind.css`, `css/load-tailwind.js` | Tema e componenti; caricamento di Tailwind. |
