# Testo QR

Web app (PWA) per Android per scrivere i **rapporti di intervento** di un tecnico di caldaie, con le misure dell'analizzatore di combustione **Testo 330** lette dal suo QR code. Si crea prima il rapporto e poi vi si aggiungono le scansioni; la scansione rapida (solo per leggere e ricopiare i valori) resta a parte.

Tutto resta sul telefono e funziona anche **offline**: non c'è nessun server.

## Come si usa
1. **Nuovo rapporto** (home): compili cliente, impianto, intervento, lavori, materiali, orari, note e foto. Si salva da solo a ogni modifica.
2. **Aggiungi misura**: inquadri il QR del Testo (o "Da foto" / "Importa file"). La misura entra nel rapporto con un'etichetta (*Prima*, *Dopo*, o quella che scrivi). I valori si vedono grandi, per ricopiarli a mano; lo schermo resta acceso.
3. **Chiudi rapporto**: assegna il numero progressivo (2026/012) e lo stato passa da *Bozza* a *Completato*.
4. **Invia email** o **Salva PDF** (A4, con intestazione della ditta): dopo l'invio un rapporto chiuso diventa *Inviato*. Se lo modifichi torna *Completato*, così in elenco si vede che va rimandato.
5. **Duplica** copia cliente e impianto in una nuova bozza (per più interventi allo stesso cliente).

La home elenca i rapporti con **ricerca** (cliente, indirizzo, targa, matricola, numero) e filtro per stato. Le bozze mai compilate si scartano da sole.

### Rapporto
Cliente (con codice fiscale controllato: un avviso, mai un blocco; indirizzo anche dalla posizione), impianto (marca, matricola, targa, data di installazione), tipo di intervento ed esito, lavori eseguiti, materiali (descrizione e quantità), orari di arrivo e partenza (pulsante "Adesso", durata calcolata), misure Testo, fino a 20 foto, note. Niente firma del cliente, niente rubrica: ogni rapporto è a sé.

### Numerazione
Il numero si assegna alla chiusura (le bozze eliminate non lasciano buchi); l'anno è quello della data dell'intervento. Nelle impostazioni si cambia il prossimo numero per allinearsi a un registro cartaceo. Un rapporto eliminato non libera il suo numero.

### PDF
Intestazione con logo e dati della ditta, numero e data; cliente e impianto; intervento, lavori, materiali; **misure Testo**: le misure dello stesso tipo con una colonna di valori si mettono **affiancate** in una sola tabella (una colonna per etichetta, es. Prima | Dopo); le altre (Media / Min / Max, o tipi diversi) hanno una tabella ciascuna; poi strumento, note, foto e nome del tecnico. Una bozza porta "BOZZA" al posto del numero. Si crea anche senza internet.

### Email
"Invia email" crea oggetto («Rapporto di intervento n. 2026/012 - Mario Rossi - targa … - 22/10/2026») e testo in automatico. Dalle impostazioni si sceglie come:
- *Condivisione* (predefinito): si apre il menu di Android, scegli Gmail e la mail si apre con il **PDF già allegato**; il destinatario viene copiato negli appunti perché una pagina web non può precompilarlo in questo modo.
- *Gmail con mailto*: si apre subito Gmail con destinatario, oggetto e testo compilati; una pagina web non può allegare file, quindi il PDF si salva nei download e va allegato con la graffetta.

L'icona di condivisione accanto a "Salva PDF" invia il solo PDF.

## Dati e copie di sicurezza
- I rapporti, le foto e il logo stanno nel database del browser (IndexedDB, nome `testoqr-reports`); le impostazioni e le scansioni rapide nel `localStorage` (`testoqr.config`, `testoqr.scans`). L'app chiede al telefono di non cancellarli (`navigator.storage.persist()`).
- **Questa versione riparte da zero**: non legge, non converte e non cancella nulla di quanto salvato dalle versioni precedenti (che resta inutilizzato finché non cancelli i dati del sito da Chrome). Destinatario dell'email e dati predefiniti vanno reinseriti.
- **Cartella di salvataggio** (impostazioni): ogni modifica viene copiata, 2 secondi dopo l'ultima, in una cartella scelta con il selettore di Chrome (File System Access API):
  ```
  <cartella scelta>/TestoQR/
      impostazioni.json, logo.jpg
      rapporti/2026/2026-012_Mario-Rossi_ab12cd34/      (bozza: BOZZA_2026-10-22_Mario-Rossi_ab12cd34)
          rapporto.json   rapporto.pdf (rapporti chiusi)   foto/01.jpg …
  ```
  È una copia **a senso unico** (telefono → cartella): i rapporti si modificano solo sul telefono. Sincronizzando la cartella con Drive, Syncthing o altro si ha un backup e l'ufficio legge i PDF. "Ripristina dalla cartella" rilegge i `rapporto.json` e le foto e li unisce a quelli del telefono (a parità di rapporto vince la modifica più recente). Su un telefono nuovo: collega la cartella e tocca *Ripristina*.
  - Il telefono può chiedere di nuovo il permesso a ogni apertura: le modifiche restano in coda e partono quando lo riattivi (la home lo ricorda).
  - Su Android non si può scegliere la radice della memoria né Download: va scelta una sottocartella (es. Documenti/TestoQR). Il browser scrive i file con un temporaneo `.crswap`: le app di sincronizzazione vanno impostate per ignorarlo.
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

## Sviluppo
- Nessuna compilazione e nessun npm: file statici (`python3 -m http.server`).
- Test della logica: `node --test tests/*.test.mjs` (numerazione, stati, ricerca, raggruppamento delle misure, email, ZIP, impostazioni, codice fiscale).
- Prove nel browser (Playwright con Chromium, fotocamera finta, cartella privata del browser al posto di quella scelta): `tests/e2e/run.sh` (rapporti, PDF, email, cartella di salvataggio, backup, uso senza rete, modulo e foto, navigazione). Servono Playwright, Pillow e ffmpeg; la scelta vera della cartella su Android non si può provare così.
- **Aggiornamenti**: i file sono salvati sul telefono dal service worker (`sw.js`). Dopo una modifica aumentare `CACHE` in `sw.js` (e aggiungere i file nuovi a `FILES`): l'app scarica la nuova versione alla prima apertura con internet e la usa dall'apertura successiva.

### Stile (Tailwind)
Lo stile usa [Tailwind CSS 4](https://tailwindcss.com) nella versione "browser" (`vendor/tailwindcss-browser.js`).
- `css/tailwind.css`: colori e font (`@theme`) e i componenti ricorrenti (`btn`, `card`, `input`, `icon`, `chip`).
- `css/load-tailwind.js`: legge quel file e avvia Tailwind; la pagina resta nascosta finché gli stili non sono pronti.
- Le classi create dal JavaScript vanno scritte in `ui.js`: vengono registrate all'avvio, così il loro stile è già pronto quando servono.
- Per aggiornare Tailwind: sostituire `vendor/tailwindcss-browser.js` con `dist/index.global.js` del pacchetto npm `@tailwindcss/browser` e alzare la versione in `sw.js`.
- Il build "browser" compila gli stili a ogni apertura (circa 25 KB di CSS): sul telefono aggiunge qualche decimo di secondo all'apertura.

### File
- `index.html`, `app.js`: pagina e avvio; `nav.js`: schermate e tasto indietro di Android
- `screens/`: `home` (elenco), `editor` (rapporto), `scan` (fotocamera), `measure` (valori di una misura), `quick` (scansioni rapide), `settings`
- `model.js`: rapporto, stati, numerazione, ricerca, raggruppamento delle misure (solo logica, provata con `node --test`)
- `store.js`, `db.js`, `photos.js`: archivio sul telefono (IndexedDB), foto e logo
- `folder.js`: copia nella cartella di salvataggio; `backup.js`, `zip.js`: backup in un file ZIP (senza librerie)
- `report.js`: creazione del PDF; `mail.js`: oggetto, testo e destinatari; `settings.js`: impostazioni
- `scanner.js`, `tjf.js`: lettura del QR e decodifica dei dati Testo; `quickscans.js`: scansioni rapide
- `geo.js`, `validate.js`, `util.js`, `ui.js`: posizione e indirizzo, codice fiscale, utilità, classi di stile
- `sw.js`, `manifest.json`, `img/`: PWA offline
- `vendor/`: librerie incluse nell'app, con le rispettive licenze
  - Tailwind CSS 4.3.3, build "browser" (stile, MIT)
  - zxing-wasm 3.1.5 (lettore QR, MIT)
  - pdf-lib 1.17.1 e @pdf-lib/fontkit 1.1.1 (creazione del PDF, MIT)
  - Liberation Sans (font del PDF, SIL Open Font License 1.1)
