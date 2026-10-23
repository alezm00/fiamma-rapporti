# Fiamma

Web app (PWA) per Android per scrivere i **rapporti di intervento** di un tecnico di caldaie, con le misure dell'analizzatore di combustione **Testo 330** lette dal suo QR code. (Non è un'app di Testo.) Si crea prima il rapporto e poi vi si aggiungono le scansioni; la scansione rapida (solo per leggere e ricopiare i valori) resta a parte.

Tutto resta sul telefono e funziona anche **offline**: non c'è nessun server.

## Come si usa
1. **Nuovo rapporto** (home): compili cliente, impianto, intervento, lavori, materiali, orari, note e foto. Si salva da solo a ogni modifica: sotto il titolo una scritta dice quando ("Salvato 14:32"); se il salvataggio non riesce (per esempio memoria piena) compare "NON SALVATO" in rosso, si tocca per riprovare e uscendo dal rapporto un avviso segnala cosa andrebbe perso.
2. **Aggiungi misura**: inquadri il QR del Testo (o "Da foto" / "Importa file"). La misura entra nel rapporto con un'etichetta (*Prima*, *Dopo*, o quella che scrivi). I valori si vedono grandi, per ricopiarli a mano; lo schermo resta acceso.
3. **Chiudi rapporto**: assegna il numero progressivo (2026/012) e lo stato passa da *Bozza* a *Completato*.
4. **Invia email** o **Salva PDF** (A4, con intestazione della ditta): dopo l'invio un rapporto chiuso diventa *Inviato*. Se lo modifichi torna *Completato*, così in elenco si vede che va rimandato.
5. **Duplica** copia cliente e impianto in una nuova bozza (per più interventi allo stesso cliente).
6. **Elimina** sposta il rapporto nel **cestino**, da dove si recupera entro 30 giorni (poi va via per sempre con misure e foto; una bozza mai compilata si elimina subito). Il numero già assegnato non viene riusato.

La home elenca i rapporti con **ricerca** (cliente, indirizzo, targa, matricola, numero) e filtri per stato e per anno (quando i rapporti coprono più anni). I rapporti sono raggruppati per mese e se sono molti se ne vedono 50 alla volta ("Mostra altri"). Il link "Cestino (N)" in fondo all'elenco apre i rapporti eliminati. Le bozze mai compilate si scartano da sole.

### Rapporto
Cliente (con codice fiscale controllato: un avviso, mai un blocco; indirizzo anche dalla posizione), impianto (targa e **quanti apparecchi si vuole**: caldaie, pompe di calore, condizionatori, anche insieme), tipo di intervento ed esito, lavori eseguiti, materiali (descrizione e quantità), orari di arrivo e partenza (pulsante "Adesso", durata calcolata), misure Testo, fino a 20 foto, note. Niente firma del cliente, niente rubrica: ogni rapporto è a sé.

### Impianto e apparecchi
In un impianto si aggiungono con i tasti **+ Caldaia**, **+ Pompa di calore**, **+ Condizionatore** quanti apparecchi servono (i titoli si numerano da soli: Condizionatore 1, Condizionatore 2…). Ogni tipo ha i suoi campi:
- **Tutti:** marca, modello, matricola / codice, data di installazione.
- **Caldaia:** combustibile (metano, GPL, gasolio), camera di combustione (aperta, forzata), tipo (a condensazione, tradizionale), potenza termica nominale e reale (kW).
- **Pompa di calore:** tipo (aria-acqua, aria-aria, acqua-acqua, geotermica), potenza termica nominale e frigorifera (kW), gas refrigerante (R32, R410A, R290, R134a, R407C, R454B, R744, altro), carica di refrigerante (kg).
- **Condizionatore:** tipo (monosplit, multisplit, canalizzato, cassetta, altro), unità interne, potenza frigorifera e in riscaldamento (kW), gas refrigerante, carica (kg).

La targa dell'impianto è una sola per rapporto. Un rapporto nuovo parte **senza apparecchi**: si aggiungono con i tre tasti. La ricerca trova marca, modello e matricola di qualunque apparecchio.

### Numerazione
Il numero si assegna alla chiusura (le bozze eliminate non lasciano buchi); l'anno è quello della data dell'intervento. Nelle impostazioni si cambia il prossimo numero per allinearsi a un registro cartaceo. Un rapporto eliminato non libera il suo numero.

### PDF
Intestazione con logo e dati della ditta, numero e data; cliente e impianto (una scheda per ogni apparecchio, su cinque colonne; il modello prende due colonne se è lungo); intervento (tipo, esito, orari e durata su una riga), lavori, materiali; **misure Testo**: le misure dello stesso tipo con una colonna di valori si mettono **affiancate** in una sola tabella (una colonna per etichetta, es. Prima | Dopo); le altre (Media / Min / Max, o tipi diversi) hanno una tabella ciascuna; poi gli strumenti (una riga ciascuno), le note, le foto e il nome del tecnico. La parte centrale è compatta: con quattro apparecchi la prima pagina contiene ancora intervento, lavori e materiali. Le **foto** sono su due colonne e così grandi che ne entrano circa **quattro per foglio** (una foto in piedi occupa tutta la sua casella; una in orizzontale è larga una colonna). Una bozza porta "BOZZA" al posto del numero. Si crea anche senza internet.

### Email
"Invia email" crea oggetto («Rapporto di intervento n. 2026/012 - Mario Rossi - targa … - 22/10/2026») e testo in automatico. Dalle impostazioni si sceglie come:
- *Condivisione* (predefinito): si apre il menu di Android, scegli Gmail e la mail si apre con il **PDF già allegato**; il destinatario viene copiato negli appunti perché una pagina web non può precompilarlo in questo modo.
- *Gmail con mailto*: si apre subito Gmail con destinatario, oggetto e testo compilati; una pagina web non può allegare file, quindi il PDF si salva nei download e va allegato con la graffetta.

L'icona di condivisione accanto a "Salva PDF" invia il solo PDF.

## Dati e copie di sicurezza
- I rapporti, le foto e il logo stanno nel database del browser (IndexedDB, nome `testoqr-reports`); le impostazioni e le scansioni rapide nel `localStorage` (`testoqr.config`, `testoqr.scans`). I nomi interni cominciano per `testoqr` (il nome storico del progetto): sono invisibili e non vanno cambiati senza motivo, perché cambiarli azzera i dati già salvati. L'app chiede al telefono di non cancellarli (`navigator.storage.persist()`). Se IndexedDB non è disponibile (per esempio in una finestra privata) la home lo segnala in rosso: i rapporti resterebbero solo in memoria e andrebbero persi chiudendo l'app.
- **Cartella di salvataggio** (impostazioni): ogni modifica viene copiata, 2 secondi dopo l'ultima, in una cartella scelta con il selettore di Chrome (File System Access API):
  ```
  <cartella scelta>/Fiamma/
      impostazioni.json, logo.jpg
      rapporti/2026/2026-012_Mario-Rossi_ab12cd34/      (bozza: BOZZA_2026-10-22_Mario-Rossi_ab12cd34)
          rapporto.json   rapporto.pdf (rapporti chiusi)   foto/01.jpg …
  ```
  Il `rapporto.json` è lo stesso oggetto che sta nel database del telefono e nel backup (nel file in più c'è l'elenco `photos`):
  ```
  { id, number, status: draft | done | sent, date, createdAt, updatedAt, closedAt, sentAt, deletedAt,
    customer: { name, fiscalCode, address, phone },
    plant: { plateCode, units: [{ id, kind: caldaia | pompa | condizionatore, brand, model, serial, …campi del tipo }] },
    intervention: { type, outcome, work, materials: [{ text, qty }], startTime, endTime, notes },
    measures: [{ id, label, json: (il JSON TJF del QR), addedAt }],
    photoCount }
  ```
  Quello che si legge da fuori (cartella, backup) viene sempre ripulito da `normalizeReport` (`src/model/normalize.js`): tipi sbagliati, campi in più, identificativi non validi.
  Scegliendo la cartella, se dentro ci sono già delle impostazioni (di solito di un altro telefono) l'app chiede se **caricarle al posto di quelle del telefono**: ditta, email e logo; il numero progressivo non torna mai indietro (per ogni anno vale il più alto). Rispondendo di no il telefono resta com'è e le impostazioni nella cartella non vengono cancellate.
  È una copia **a senso unico** (telefono → cartella): i rapporti si modificano solo sul telefono. Un rapporto nel cestino viene tolto dalla cartella e vi torna se lo ripristini. Sincronizzando la cartella con Drive, Syncthing o altro si ha un backup e l'ufficio legge i PDF. "Ripristina dalla cartella" rilegge i `rapporto.json` e le foto e li unisce a quelli del telefono (a parità di rapporto vince la modifica più recente). Su un telefono nuovo: scegli la cartella, poi tocca *Ripristina dalla cartella* per i rapporti.
  - Il telefono può chiedere di nuovo il permesso a ogni apertura: le modifiche restano in coda e partono quando lo riattivi (la home lo ricorda).
  - Su Android non si può scegliere la radice della memoria né Download: va scelta una sottocartella (es. Documenti/Fiamma). Il browser scrive i file con un temporaneo `.crswap`: le app di sincronizzazione vanno impostate per ignorarlo.
  - **Non verificato su un telefono reale**: la funzione risulta disponibile in Chrome per Android dalla versione 132. "Prova cartella" scrive e rilegge un file e dice subito se funziona; dove non c'è, le impostazioni mostrano "Non disponibile".
- **Backup in un file ZIP** (impostazioni): rapporti, foto (facoltative), impostazioni e logo; vale su qualunque browser. Il ripristino unisce il backup ai dati del telefono.
- La home ricorda con una riga discreta se la copia nella cartella è sospesa o se non c'è una copia di sicurezza da più di 30 giorni.

## Come funziona la lettura del QR
Il QR del Testo non contiene testo ma un JSON in formato [Testo TJF](https://github.com/testo/tjf) compresso con gzip. Le normali app di scansione lo rovinano; questa app legge i byte grezzi con [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (in `vendor/`), li decomprime e li impagina. Il formato è letto in modo generico: analisi fumi (singola o media UNI 10389-1), tiraggio, pressione, prova di tenuta… Ogni canale ha etichetta in italiano, valore e unità; i dati non riconosciuti finiscono in "Altri dati" e nel JSON grezzo. "Da foto" legge il QR da una foto, utile se è molto denso o ci sono riflessi sul display.

L'indirizzo dalla posizione usa OpenStreetMap ([Nominatim](https://nominatim.org/release-docs/latest/api/Reverse/)): serve internet e vengono inviate solo le coordinate.

## Installazione sul telefono
1. Apri l'indirizzo della pagina con Chrome (serve https: la fotocamera non funziona da http).
2. Menu ⋮ → **Installa app** (o "Aggiungi a schermata Home").
3. Da quel momento funziona anche **offline**.

Tenendo premuta l'icona sulla schermata Home compaiono le scorciatoie **Nuovo rapporto** e **Scansione rapida** (compaiono dopo che Chrome ha aggiornato l'app installata, anche dopo qualche giorno).

## Sviluppo
- Nessuna compilazione e nessun npm: file statici (`python3 -m http.server`).
- Test della logica: `node --test` dalla radice (trova da solo le prove in `tests/unit/`): modello e numerazione, date, QR del Testo, indirizzi, email, impostazioni, ZIP, codice fiscale, elenco dei file del service worker, ordine delle cartelle di `src/`.
- Prove nel browser (Playwright con Chromium, fotocamera finta, cartella privata del browser al posto di quella scelta): `tests/e2e/run.sh [prova …]`, senza argomenti le fa tutte. Le prove: `reports` (rapporto e misure), `pdf`, `send` (email e condivisione), `folder` (cartella di salvataggio), `settings-folder` (impostazioni dalla cartella), `backup` (ZIP), `offline`, `form` (modulo, foto, posizione), `nav` (tasto indietro, fotocamera), `save` (esito del salvataggio, archivio assente), `trash`, `long-list`, `units` (apparecchi). Servono Playwright (`run.sh` imposta `NODE_PATH` dall'installazione globale), Pillow, ffmpeg e poppler (`pdftotext`, `pdfimages`); la base comune è `tests/e2e/lib.cjs`. La scelta vera della cartella su Android non si può provare così.
- **Pubblicazione**: il sito è su GitHub Pages dal ramo `main` (<https://alezm00.github.io/fiamma-rapporti/>). I file sono salvati sul telefono dal service worker (`sw.js`): dopo ogni modifica aumentare `CACHE` e aggiungere i file nuovi a `FILES` (la prova `tests/sw.test.mjs` controlla che non ne manchi nessuno). L'app scarica la nuova versione alla prima apertura con internet e la usa dall'apertura successiva.

### Stile (Tailwind)
Lo stile usa [Tailwind CSS 4](https://tailwindcss.com) nella versione "browser" (`vendor/tailwindcss-browser.js`).
- `css/tailwind.css`: colori e font (`@theme`) e i componenti ricorrenti (`btn`, `btn-primary`, `card`, `input`, `fld`, `lbl`, `sect`, `icon`, `chip`). L'interfaccia è compatta e "da strumento": etichette piccole in maiuscolo, titoli di sezione con linea, numeri, date e codici in carattere a larghezza fissa (`font-mono`), valori misurati in carattere normale a cifre tabulari.
- `css/load-tailwind.js`: legge quel file e avvia Tailwind; la pagina resta nascosta finché gli stili non sono pronti.
- Le classi create dal JavaScript vanno scritte in `src/ui/classes.js`: vengono registrate all'avvio, così il loro stile è già pronto quando servono.
- Per aggiornare Tailwind: sostituire `vendor/tailwindcss-browser.js` con `dist/index.global.js` del pacchetto npm `@tailwindcss/browser` e alzare la versione in `sw.js`.
- Il build "browser" compila gli stili a ogni apertura (circa 25 KB di CSS): sul telefono aggiunge qualche decimo di secondo all'apertura.

### File
Il programma sta in `src/`, a livelli: `screens` si appoggia a `backup`, `pdf`, `ui` e `data`; questi a `model`; `model` a `qr` e `lib`. Non si risale mai (la logica non conosce lo schermo): la prova `tests/unit/layers.test.mjs` controlla anche questo, e che ogni importazione trovi il suo file.

```
index.html  manifest.json  sw.js        pagina, PWA e uso offline (devono stare in radice)
css/  img/  vendor/  tools/             stile, immagini, librerie incluse, strumenti
tests/unit/  tests/e2e/                 prove della logica e prove nel browser
src/
  app.js                                avvio: schermate, service worker, scorciatoie dell'icona
  screens/                              una schermata per file; l'editor ha una cartella
    home  trash  scan  measure  quick  settings
    editor/   index (ingresso, uscita) · form (campi) · session (salvataggio) · units · materials ·
              measures · photos · address · send (PDF, email) · actions (chiudi, duplica, elimina)
  ui/       nav (schermate, tasto indietro) · classes (classi di stile create dal JS) · util (DOM, avvisi, campi)
  backup/   zip-backup (backup in un file) · folder/ (copia nella cartella di salvataggio:
            index · state · writer · settings-file · restore · files · paths)
  pdf/      index · libs · text · sheet (pagina, riquadri) · header · parties · materials · measures · photos · footer
  data/     db (IndexedDB) · store (rapporti) · photos (foto e logo) · settings · quickscans
  model/    values · units · report (stati, numeri, orari) · list (ricerca, mesi, cestino) · measures ·
            normalize (dati letti da fuori) · mail (oggetto e testo dell'email) · index (riunisce il modello)
  qr/       scanner (fotocamera, zxing) · tjf/ (decodifica dei dati Testo: index · channels · items · format · labels)
  lib/      dates · validate (codice fiscale) · geo (posizione e indirizzo) · zip (ZIP senza librerie)
```
- La logica di `model/`, `qr/tjf/` e `lib/` non tocca il DOM né il database, ed è provata con `node --test`.
- Un file nuovo in `src/` va aggiunto a `FILES` in `sw.js` (lo controlla `tests/unit/sw.test.mjs`).
- Le prove nel browser caricano i moduli dall'indirizzo `/src/…` (per esempio `import('/src/data/store.js')`).
- `css/`: tema e componenti di Tailwind (`tailwind.css`) e il suo caricamento (`load-tailwind.js`).
- `tests/`: prove della logica (`unit/*.test.mjs`) e nel browser (`e2e/`, con i campioni QR in `e2e/fixtures/`).
- `sw.js`, `manifest.json`, `img/`: PWA offline. L'icona (foglio con fiamma e mirino del QR) è `img/icon.svg`; `node tools/make-icons.cjs` ne ricava i PNG (serve Playwright).
- `vendor/`: librerie incluse nell'app, con le rispettive licenze
  - Tailwind CSS 4.3.3, build "browser" (stile, MIT)
  - zxing-wasm 3.1.5 (lettore QR, MIT)
  - pdf-lib 1.17.1 e @pdf-lib/fontkit 1.1.1 (creazione del PDF, MIT)
  - Liberation Sans (font del PDF, SIL Open Font License 1.1)
