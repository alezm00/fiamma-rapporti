# Test

Due famiglie di prove: quelle della **logica** (con Node, in un secondo) e quelle **nel browser** (con Playwright, qualche minuto). Insieme controllano quasi tutto quello che l'app fa; nessuna richiede la rete.

| Famiglia | Dove | Come si lancia | Quanto dura |
|---|---|---|---|
| Logica | `tests/unit/*.test.mjs` | `node --test` (dalla radice del progetto) | meno di un secondo |
| Browser | `tests/e2e/*.cjs` | `tests/e2e/run.sh [prova …]` | qualche minuto |

## Prove della logica (`tests/unit/`)

Usano `node:test` e `node:assert`, senza librerie. `node --test` senza argomenti trova da solo tutti i file `*.test.mjs`. Importano i moduli di `src/` direttamente: per questo `model/`, `qr/tjf/`, `lib/` e `data/settings.js` non devono toccare il DOM.

| File | Cosa controlla |
|---|---|
| `tests/unit/model.test.mjs` | Il modello: bozza vuota, chiusura e numero progressivo per anno, prossimo numero modificabile, stati, duplicazione, durata, ricerca (senza accenti, più parole), etichette e confronto delle misure, nome dei file, bozza vuota, `normalizeReport`, percorso nella cartella, apparecchi, cestino, elenco lungo per mesi e anni, `describeReport`. |
| `tests/unit/tjf.test.mjs` | La lettura dei QR con i campioni reali di `tests/e2e/fixtures/`: gzip, righe, unità, colonne Media/Min/Max, fasi della prova, numeri e date, dati non validi, `topValues`. |
| `tests/unit/mail.test.mjs` | Destinatari, oggetto, testo e `mailto:` dell'email; il modello con segnaposto: valori, righe che spariscono, parti dell'oggetto, segnaposto sconosciuti, ripiego sul testo originale. |
| `tests/unit/validate.test.mjs` | Codice fiscale e partita IVA, con i casi di `tests/unit/cf-vectors.json` (anche omocodia). |
| `tests/unit/settings.test.mjs` | `normalizeSettings` e `mergeSettings` (solo campi vuoti, contatore più alto). |
| `tests/unit/zip.test.mjs` | ZIP: CRC, scrittura e lettura, file rovinati; se `unzip` è installato verifica che lo legga. |
| `tests/unit/dates.test.mjs` | Formati di data e ora. |
| `tests/unit/geo.test.mjs` | `formatAddress`, messaggi di errore, richiesta a Nominatim (con un `fetch` finto). |
| `tests/unit/sw.test.mjs` | `FILES` del service worker: esistono, e non ne manca nessuno ([Offline e pubblicazione](08-offline-e-pubblicazione.md)). |
| `tests/unit/layers.test.mjs` | Ordine delle cartelle di `src/` e importazioni che trovano il file ([Architettura](01-architettura.md)). |
| `tests/unit/docs.test.mjs` | Questa documentazione: collegamenti, mappa dei file, elenco delle prove, diagrammi. |

### Scrivere una prova della logica

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newReport, closeReport } from '../../src/model/index.js';

test('chiusura: il numero si assegna una volta sola', () => {
    const doc = newReport({ now: new Date(2026, 2, 1), id: 'abcd1234' });
    const counters = closeReport(doc, {}, new Date(2026, 2, 1));
    assert.equal(doc.number, '2026/001');
    assert.deepEqual(counters, { 2026: 1 });
});
```

Le funzioni accettano `now` e `id` come parametri apposta: la prova non dipende dall'orologio né da numeri casuali. Per le date usa `new Date(anno, mese − 1, giorno)` (ora locale), come fa il codice.

### Le due prove "di struttura"

`sw.test.mjs`, `layers.test.mjs` e `docs.test.mjs` non provano funzioni: provano che il **progetto sia in ordine**. Falliscono se aggiungi un file senza metterlo in `FILES`, se un modulo importa dal livello sbagliato o da un file che non c'è, se un collegamento della documentazione è rotto o un file nuovo non è nella mappa. Il messaggio dice quale.

## Prove nel browser (`tests/e2e/`)

Playwright con Chromium, su un "telefono" Android finto: schermo 412 × 915, tocco, italiano, fuso `Europe/Rome`. Ogni prova apre l'app dall'indirizzo del server locale che `run.sh` avvia (`python3 -m http.server`, porta 8811), fa quello che farebbe una persona e controlla il risultato. Alcune generano un PDF e lo leggono con gli strumenti di poppler.

```
tests/e2e/run.sh                 tutte le prove, nell'ordine
tests/e2e/run.sh pdf units       solo alcune
OUT=/tmp/altro PORT=8812 tests/e2e/run.sh save     cartella di lavoro e porta diverse
```

### Requisiti

Node, **Playwright** installato per tutto il sistema (`run.sh` imposta `NODE_PATH` da `npm root -g`) con il browser Chromium che Playwright sa trovare, **Pillow** (foto di prova), **ffmpeg** (il video della fotocamera finta), **poppler** (`pdftotext`, `pdfinfo`, `pdfimages`, `pdftoppm`).

### Le prove

| Prova | Cosa copre |
|---|---|
| `reports` | Il percorso completo: nuovo rapporto, campi, materiali, misura da file e da fotocamera finta, stessa misura non duplicata, scansione rapida, ricerca e filtri, chiusura e numero, duplica, elimina, bozza vuota scartata, i dati restano dopo il ricaricamento. |
| `pdf` | Un rapporto completo (4 apparecchi, materiali, 3 misure, foto, logo) in PDF come bozza e chiuso: testi, nome del file, pagine, prima pagina compatta, fasi della prova, foto per pagina. |
| `send` | Email: condivisione (finta), `mailto`, destinatario copiato negli appunti, stato "Inviato" e ritorno a "Completato" dopo una modifica, assenza di destinatario, ripiego senza condivisione; il testo personale (anteprima, segnaposto toccati, avviso, ricaricamento, email inviata, ripristino). |
| `folder` | La cartella di salvataggio: collegamento, copia, rinomina, permesso scaduto con coda, impostazioni, ripristino su telefono nuovo, eliminazione, foto rileggibili. |
| `settings-folder` | Scegliendo una cartella con impostazioni salvate: domanda, "No" non cambia niente, "Sì" carica ditta, email (anche il testo), logo e numerazione; contatore che non torna indietro; selettore annullato. |
| `backup` | Backup ZIP e ripristino, con e senza foto; promemoria della home. |
| `offline` | Cache piena, rete spenta, l'app si apre e lavora. |
| `form` | Il modulo: codice fiscale con il suo avviso, salvataggio automatico, indirizzo dalla posizione (Nominatim finto), foto (ridimensionamento, rotazione EXIF, PNG trasparente, limite di 20, PDF con 20 foto). |
| `nav` | Il tasto indietro in ogni schermata, la fotocamera che si spegne, errori della fotocamera con ripiego sulla foto. |
| `save` | Salvataggio: esito visibile, memoria piena (scritte fallite), ritenta, avviso in uscita, etichetta della misura, archivio assente. |
| `trash` | Cestino: elimina, ripristina, elimina per sempre, scadenza dei 30 giorni, cartella e backup. |
| `long-list` | 120 rapporti in 36 mesi: raggruppamento, "Mostra altri", filtro per anno. |
| `units` | Apparecchi: nessuno di partenza, campi per tipo, numerazione dei titoli, salvataggio, rimozione, ricerca, duplica, backup. |

### `tests/e2e/lib.cjs`: la base comune

Ogni prova comincia con:

```js
const { SP, FX, BASE, log, assert, until, run, start, finish } = require('./lib.cjs');
run(async () => {
  const session = await start();                       // browser, contesto, pagina aperta sulla home
  const { browser, ctx, page, errors, dialogs } = session;
  // … la prova …
  await finish(session);                               // nessun errore in pagina, poi chiude
});
```

| Voce | Cosa fa |
|---|---|
| `start({ args, context, ignoreErrors, before })` | Un browser e un contesto del telefono finto, la pagina aperta sull'elenco. `args`: opzioni di Chromium (fotocamera finta); `context`: opzioni in più (permessi, posizione); `ignoreErrors`: espressione regolare degli errori della console da non contare; `before(page, ctx)`: prima di aprire l'app (script iniziali, finte risposte di rete). |
| `launch(args)`, `open(browser, opzioni)` | Per le prove che aprono più contesti (`send`, `save`). |
| `dialogs` | Elenco dei messaggi delle finestre di conferma; `dialogs.accept = false` risponde "no". |
| `errors` | Errori di pagina e della console, raccolti per tutta la prova; `finish` li controlla. |
| `log`, `assert`, `until` | `until(async () => …)` aspetta fino a 15 s che la condizione sia vera. |
| `SP`, `FX`, `BASE` | Cartella di lavoro (immagini, PDF, schermate), cartella dei campioni, indirizzo dell'app. |

### I file di prova

`tests/e2e/make-fixtures.py` prepara la cartella di lavoro (`/tmp/testoqr-e2e` di solito): copia i campioni di `tests/e2e/fixtures/` (un QR in PNG e tre misure in `.json.gz`, di cui due dello stesso tipo per il confronto e una di tipo diverso), genera foto (una orizzontale 3000×2250, una con rotazione EXIF 6, quattordici piccole, una PNG trasparente), un logo, e con ffmpeg due video per la fotocamera finta: uno col QR e uno vuoto. Le schermate e i PDF prodotti dalle prove finiscono in `shots5/` e `pdf5/` della stessa cartella: servono a guardare il risultato.

### Trucchi e trappole

- **`waitForFunction` non aspetta le funzioni asincrone**: una condizione `async` dà sempre "vera". Per condizioni asincrone usa `until` (si ripete nel processo Node).
- **Le date dipendono dal fuso**: il computer può essere in UTC e il telefono finto in `Europe/Rome`. Calcola le date con `toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })`, non con `new Date()` nudo.
- **Le etichette di stato sono in maiuscolo con CSS**: `textContent` restituisce "Completato", `innerText` "COMPLETATO". Confronta con `textContent` o senza distinguere maiuscole.
- **Il selettore di cartelle non si automatizza**: le prove sostituiscono `window.showDirectoryPicker` con la cartella privata del browser (OPFS) e usano `folder.testing.permission` per simulare un permesso scaduto.
- **Salvataggi che falliscono**: `save.cjs` sostituisce `IDBObjectStore.prototype.put` con una funzione che lancia `QuotaExceededError`.
- **Senza IndexedDB**: un contesto con uno script iniziale che toglie `window.indexedDB` (vedi `save.cjs`).
- **Chiamare il codice dell'app dalla prova**: `page.evaluate(async () => (await import('/src/data/store.js')).listReports())`. I moduli sono quelli già caricati dalla pagina, quindi stesso stato.
- **Un file letto dalla cartella e riscritto** diventa illeggibile: la prova di `folder.cjs` sul ripristino delle foto lo protegge (vedi `memoryCopy` in [Archiviazione e copie](06-archiviazione-e-copie.md)).

### Aggiungere una prova nel browser

1. Crea `tests/e2e/<nome>.cjs` con lo schema sopra.
2. Aggiungi `<nome>` all'elenco `TESTS` di `tests/e2e/run.sh` e al suo commento in testa.
3. Aggiungila alla tabella qui sopra (la prova `docs.test.mjs` controlla che ogni prova di `run.sh` sia nominata in questa pagina).
4. Lancia `tests/e2e/run.sh <nome>` e poi tutte.

## Quando lanciare cosa

| Modifica | Prove |
|---|---|
| Logica (`model/`, `qr/`, `lib/`, `data/settings.js`) | `node --test` |
| Schermate, editor, interfaccia | `node --test` e le prove che toccano quella schermata |
| PDF | `tests/e2e/run.sh pdf` e il confronto con la versione precedente ([PDF](05-pdf.md#come-si-prova)) |
| Cartella, backup, archivio | `folder`, `settings-folder`, `backup`, `trash`, `save` |
| Qualunque cambiamento prima di pubblicare | `node --test` **e** `tests/e2e/run.sh` per intero |
