# Testo QR

Web app (PWA) per Android che legge il QR code mostrato dall'analizzatore di combustione **Testo 330** e mostra i risultati della prova in grande, per trascriverli velocemente a mano.

## Come funziona
- Il QR del Testo non contiene testo ma un JSON in formato [Testo TJF](https://github.com/testo/tjf) compresso con gzip. Le normali app di scansione lo rovinano; questa app legge i byte grezzi con [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (in `vendor/`), li decomprime e li impagina.
- Il formato è letto in modo generico: analisi fumi (singola o media UNI 10389-1), tiraggio, pressione, prova di tenuta… Ogni canale viene mostrato con etichetta in italiano, valore e unità; i dati non riconosciuti finiscono in "Altri dati" e nel JSON grezzo.
- Lo schermo resta acceso mentre guardi il risultato.
- Le ultime 20 scansioni restano salvate sul telefono (solo in locale).
- **Report PDF**: dal risultato, "Crea report PDF" apre il modulo con i dati del cliente (nome e cognome, codice fiscale, indirizzo, telefono), della caldaia (marca, matricola/codice, targa impianto, data di installazione) e un campo note libero. Il PDF A4 contiene cliente, caldaia, dati e risultati della prova e si può condividere (WhatsApp, email…) oppure salvare. I dati del cliente restano nella scansione salvata sul telefono. Codice fiscale (16 caratteri, anche con omocodia, o 11 cifre per le aziende) e telefono sono controllati: se qualcosa non torna compare un avviso sotto il campo, ma il PDF si crea lo stesso. Il telefono viene mostrato come `333 123 4567` (con `+39` se scritto).
- **Indirizzo dalla posizione**: "Usa la mia posizione" legge il GPS e ricava l'indirizzo da OpenStreetMap ([Nominatim](https://nominatim.org/release-docs/latest/api/Reverse/)); serve internet e vengono inviate solo le coordinate. Il PDF invece si crea anche offline.
- "Da foto" legge il QR da una foto, utile se il QR è molto denso o ci sono riflessi sul display.

## Installazione sul telefono
1. Apri l'indirizzo della pagina con Chrome (serve https: la fotocamera non funziona da http).
2. Menu ⋮ → **Installa app** (o "Aggiungi a schermata Home").
3. Da quel momento funziona anche **offline**.

## Aggiornamenti
I file sono salvati sul telefono dal service worker (`sw.js`). Dopo una modifica, aumentare `CACHE` in `sw.js` (es. `testo-qr-v2`): l'app scarica la nuova versione alla prima apertura con internet e la usa dall'apertura successiva.

## File
- `index.html`: pagina e stili
- `app.js`: fotocamera, storico, visualizzazione
- `tjf.js`: decodifica del QR (gzip → JSON TJF) ed etichette dei canali
- `report.js`: creazione del PDF (impaginazione A4, nome del file)
- `geo.js`: posizione e indirizzo
- `validate.js`: controllo del codice fiscale e del telefono
- `sw.js`, `manifest.json`, `img/`: PWA offline
- `vendor/`: librerie incluse nell'app, con le rispettive licenze
  - zxing-wasm 3.1.5 (lettore QR, MIT)
  - pdf-lib 1.17.1 e @pdf-lib/fontkit 1.1.1 (creazione del PDF, MIT)
  - Liberation Sans (font del PDF, SIL Open Font License 1.1)
