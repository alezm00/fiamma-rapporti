# Testo QR

Web app (PWA) per Android che legge il QR code mostrato dall'analizzatore di combustione **Testo 330** e mostra i risultati della prova in grande, per trascriverli velocemente a mano.

## Come funziona
- Il QR del Testo non contiene testo ma un JSON in formato [Testo TJF](https://github.com/testo/tjf) compresso con gzip. Le normali app di scansione lo rovinano; questa app legge i byte grezzi con [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (in `vendor/`), li decomprime e li impagina.
- Il formato è letto in modo generico: analisi fumi (singola o media UNI 10389-1), tiraggio, pressione, prova di tenuta… Ogni canale viene mostrato con etichetta in italiano, valore e unità; i dati non riconosciuti finiscono in "Altri dati" e nel JSON grezzo.
- Tocca una riga per segnarla come trascritta. Lo schermo resta acceso mentre guardi il risultato.
- Le ultime 20 scansioni restano salvate sul telefono (solo in locale).
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
- `sw.js`, `manifest.json`, `img/`: PWA offline
- `vendor/`: zxing-wasm 3.1.5 (lettore QR, licenza MIT)
