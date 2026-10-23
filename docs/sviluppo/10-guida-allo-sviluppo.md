# Guida allo sviluppo

Come si lavora sul progetto, le convenzioni e le ricette per le modifiche più comuni.

## Requisiti e avvio in locale

Per **modificare** l'app basta un editor di testo e un server di file statici; non si installa niente.

```
python3 -m http.server 8000      # dalla radice del progetto
# poi apri http://localhost:8000 in Chrome
```

`localhost` conta come indirizzo sicuro: la fotocamera, il service worker e la cartella di salvataggio funzionano. Dal telefono, con il cavo USB: apri `chrome://inspect` sul computer, attiva il reindirizzamento della porta 8000 e apri `http://localhost:8000` sul telefono. Per provare l'app "vera" installata serve https: la versione pubblicata su GitHub Pages.

> **Attenzione al service worker.** L'app risponde dalla cache (`cache-first`): modificando un file in locale e ricaricando potresti vedere ancora la versione vecchia. In Chrome, DevTools → *Application* → *Service Workers* → spunta **Bypass for network** (oppure *Update on reload*); in alternativa alza `CACHE` in `sw.js` o apri una finestra privata. Per le prove sul telefono vedi sotto "Prima di pubblicare".

Per **provare** servono, in più, quelli indicati in [Test](09-test.md#requisiti): Node (per `node --test`) e, per le prove nel browser, Playwright, Pillow, ffmpeg e poppler.

## Flusso di lavoro

1. **Un ramo per ogni modifica**: `git checkout -b nome-della-modifica` da `main`.
2. Modifica, **prova** (`node --test`, e le prove nel browser che toccano la parte modificata).
3. Commit con un messaggio in italiano: una riga che dice cosa cambia per chi usa l'app o per chi sviluppa, e se serve un elenco puntato con i dettagli.
4. **Prima di unire**: `node --test` e `tests/e2e/run.sh` per intero, `CACHE` alzata se hai toccato file dell'app, file nuovi in `FILES` ([Offline e pubblicazione](08-offline-e-pubblicazione.md)).
5. Unisci in `main` con un **fast-forward** (`git merge --ff-only nome-della-modifica`), così la storia resta lineare, e fai `git push origin main`: GitHub Pages pubblica da solo.
6. Cancella il ramo unito.

`main` è sempre pubblicabile: quello che sta lì è quello che hanno gli utenti.

## Convenzioni di codice

- **Moduli ES nativi**: `import … from './file.js'` con l'estensione `.js`; niente `require`. Un file ha un commento in testa che dice a cosa serve.
- **Stile**: 4 spazi, virgolette singole, punto e virgola, `const` per default, funzioni piccole. Nomi di codice in inglese (`saveReport`, `unitTitle`); **commenti, messaggi e testi dell'interfaccia in italiano**. I commenti spiegano il *perché*, non ripetono il codice.
- **Rispetta i livelli** ([Architettura](01-architettura.md)): `model/`, `qr/tjf/`, `lib/` non toccano il DOM né il database; le schermate non ripetono logica che sta nel modello. La prova `layers.test.mjs` ti ferma se sbagli.
- **Non costruire HTML con testo dell'utente**: si crea con `el(tag, classe, testo)` (che usa `textContent`) o con `fieldElement`; nel codice non c'è `innerHTML`.
- **Gli avvisi non bloccano**: un dato dubbio (codice fiscale, destinatario) dà un avviso e basta; l'utente è in cantiere e deve poter chiudere il rapporto.
- **Un errore si vede**: ogni operazione che può fallire (salvataggio, PDF, copia) mostra il motivo in italiano (`explainSaveError`, `folder.explain`) invece di un'eccezione muta.
- **Niente dati nei messaggi di log** che escano dal telefono: l'app non invia nulla a nessuno (l'unica chiamata di rete è la ricerca dell'indirizzo, con le sole coordinate).
- Nessun migratore dei dati: l'app non converte formati vecchi ([Decisioni e limiti](11-decisioni-e-limiti.md)).
- Se usi **ESLint**, attiva almeno `no-undef` e `no-unused-vars`: non ci sono tipi, e dopo aver spostato codice tra file è il modo più rapido per scoprire un `import` mancante, che altrimenti si vede solo quando la schermata gira.

## Ricette

### Un nuovo campo semplice nel rapporto

Esempio: un "Referente" del cliente (`customer.contact`).

1. **Modello**: aggiungilo a `newReport` in `src/model/report.js`. `normalizeReport` rilegge da solo tutti i campi di `customer` (le chiavi di `newReport`); per un campo dell'`intervention` aggiungilo all'elenco in `src/model/normalize.js`.
2. **Pagina**: un `<label>` con `<input id="c-contact">` in `index.html`.
3. **Collegamento**: una riga in `FIELDS` di `src/screens/editor/form.js` (`'c-contact': 'customer.contact'`). Il salvataggio automatico parte da solo.
4. **Ricerca**, se serve: aggiungilo a `searchText` in `src/model/list.js`.
5. **PDF**: un `{ label, value }` nel riquadro giusto (`src/pdf/parties.js`).
6. **Prove**: `tests/unit/model.test.mjs` (`normalizeReport` lo rilegge), il percorso in `tests/e2e/reports.cjs`.
7. **Documentazione**: [Modello dati](03-modello-dati.md).

I rapporti già salvati non hanno il campo: `normalizeReport` lo riempie con una stringa vuota quando li rilegge da una cartella o da un backup, e le schermate trattano il valore mancante come vuoto (`?? ''`). In IndexedDB il rapporto vecchio resta com'è finché non lo si modifica.

### Un nuovo campo o un nuovo tipo di apparecchio

Tutto parte da `UNIT_KINDS` in `src/model/units.js`.

- **Nuovo campo di un tipo**: aggiungi `{ key, label, … }` ai `fields` del tipo (con `options`, `date`, `decimal`, `unit` secondo i casi). Compare **da solo** nell'editor (`fieldElement`), nel PDF (`unitValues`) e nelle letture da fuori (`newUnit` mantiene solo i campi del tipo). Se è una scelta da menu, definisci l'elenco `{ id, label }` accanto agli altri (`FUELS`, `REFRIGERANTS`…). Aggiorna la tabella in [Modello dati](03-modello-dati.md) e `tests/unit/model.test.mjs` (apparecchi).
- **Nuovo tipo** (per esempio "Scaldacqua"): un elemento di `UNIT_KINDS` con `id`, `label` (singolare), `plural`, `short` e `fields`. In `index.html` un pulsante `e-add-<id>` accanto agli altri tre (senza, l'editor dà errore all'avvio). `unitTitle` e `unitsSummary` lo gestiscono da soli. Prova: `tests/e2e/units.cjs`.
- Il PDF mostra gli apparecchi su 5 colonne; il campo `model` prende due colonne se è lungo (`grow`): vedi `parties.js`.

### Una nuova parte del PDF

[PDF → Aggiungere una parte](05-pdf.md#aggiungere-una-parte-al-pdf).

### Una nuova schermata

1. **HTML**: un `<main id="view-nome" hidden>` in `index.html` con i suoi elementi (id con un prefisso proprio).
2. **Modulo**: `src/screens/<nome>.js` che esporta `init()` (collega i pulsanti), `enter(params)` e, se serve, `leave()`.
3. **Registrazione**: importalo in `src/app.js` e aggiungilo a `SCREENS` (la chiave è il nome della vista: `view-<nome>`).
4. **Navigazione**: `nav.go('nome', { … })` dalle altre schermate, e un pulsante "Indietro" che fa `nav.back()`.
5. Aggiungi il file a `FILES` di `sw.js` e alla mappa di [Struttura del codice](02-struttura-del-codice.md); una prova nel browser.

### Una nuova impostazione

1. `EMPTY_COMPANY` o un campo nuovo in `normalizeSettings` (`src/data/settings.js`), e in `mergeSettings` se va riempito nei ripristini.
2. Per un campo della ditta: una riga in `COMPANY_DEFS` di `src/screens/settings.js` (il campo si disegna e si salva da solo); per altro, l'HTML e `persist()`.
3. Se va nel PDF: `src/pdf/header.js`. Se va nella cartella: `writeSettings` la copia già con tutte le impostazioni (tranne `lastBackup`).
4. `tests/unit/settings.test.mjs`.

### Un nuovo tipo di intervento o di esito

Un elemento in `INTERVENTION_TYPES` o `OUTCOMES` (`src/model/report.js`): i menu, il PDF e l'email lo usano da `typeLabel` / `outcomeLabel`.

### Un nuovo canale o un'etichetta della misura

[QR e misure → Aggiungere o correggere un canale](04-qr-testo.md#aggiungere-o-correggere-un-canale).

### Una classe di stile usata dal JavaScript

Aggiungila a `src/ui/classes.js` (in `CLS`, nel gruppo giusto): [Interfaccia](07-interfaccia.md#le-classi-create-dal-javascript).

### Cambiare l'icona

Modifica `img/icon.svg` e lancia `node tools/make-icons.cjs`; alza `CACHE`. Le scorciatoie nuove appaiono dopo che Chrome ha aggiornato l'app installata (anche dopo qualche giorno).

## Prima di pubblicare

- [ ] `node --test` verde.
- [ ] `tests/e2e/run.sh` per intero verde (se hai toccato il PDF, guardane le pagine).
- [ ] `CACHE` alzata in `sw.js` se hai toccato un file dell'app; file nuovi in `FILES`.
- [ ] Documentazione aggiornata (mappa dei file, modello dati, uso) e `docs.test.mjs` verde.
- [ ] Unito in `main` con fast-forward e pubblicato (`git push origin main`).
- [ ] Dopo un minuto: apri <https://alezm00.github.io/fiamma-rapporti/> e controlla; sul telefono la versione nuova arriva **dalla seconda apertura** con internet.

## Dove guardare quando qualcosa non va

- **Console**: DevTools (o `chrome://inspect` dal telefono). Gli errori di salvataggio sono anche scritti in rosso sotto il titolo del rapporto.
- **Dati**: DevTools → *Application* → *IndexedDB* → `testoqr-reports` (rapporti, foto, `meta`) e *Local Storage* (`testoqr.config`, `testoqr.scans`). *Clear site data* azzera tutto: serve per ripartire da zero.
- **La cache**: *Application* → *Cache Storage* mostra la `fiamma-vN` attiva e i suoi file; *Service Workers* lo stato dell'installazione.
- **Un PDF che non viene come ti aspetti**: salvalo, aprilo, e confronta le pagine come descritto in [PDF](05-pdf.md#come-si-prova).
- **Una prova nel browser che fallisce**: lancia solo quella (`tests/e2e/run.sh nome`); le schermate e i PDF restano in `/tmp/testoqr-e2e/`.
