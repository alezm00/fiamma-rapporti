# Problemi e risposte

## La fotocamera non parte

- **"Permesso fotocamera negato"**: in Chrome tocca l'icona a sinistra dell'indirizzo (o l'ingranaggio del sito) → Autorizzazioni → Fotocamera → Consenti, e riprova. Se l'app è installata: Impostazioni di Android → App → Chrome/Fiamma → Autorizzazioni.
- **"La fotocamera è usata da un'altra app"**: chiudi l'altra app e riprova.
- **"Nessuna fotocamera trovata"**: usa **Da foto** o **Importa file** nella schermata di scansione.
- **"Fotocamera non disponibile. Apri l'app da Chrome con indirizzo https"**: la fotocamera funziona solo da un indirizzo sicuro (https): usa l'indirizzo dell'app, non una copia salvata.

## Il QR non si legge

- Avvicinati e tieni il QR **a fuoco**, riempiendo il riquadro; evita i **riflessi** sul display (inclina un po' l'analizzatore). Accendi la **Torcia** se serve.
- Se è molto denso, scatta una foto e usa **Da foto**.
- "**Il QR letto non contiene dati Testo validi**": hai inquadrato un QR che non è una misura del Testo.
- "**La foto contiene solo N parti su M del QR**": il QR è diviso in più parti e nella foto non ci sono tutte; riprova con una foto che le comprenda, o leggile una alla volta dalla fotocamera.
- "**Nessun QR code trovato nella foto**": riprova avvicinandoti, a fuoco e senza riflessi.

## "NON SALVATO" in rosso

Il rapporto non è stato scritto sul telefono, di solito perché la **memoria è piena**. Le modifiche restano a schermo. **Libera spazio** (foto, download, app inutilizzate) e **tocca la scritta rossa** sotto il titolo per riprovare. Se esci senza riuscirci, un avviso ti dice che le ultime modifiche andranno perse: se puoi, prima fai una copia (o libera spazio e riapri).

## L'archivio del telefono non è disponibile

La riga rossa "L'archivio del telefono non è disponibile: i rapporti si perdono chiudendo l'app" compare quando il browser non lascia salvare i dati: tipicamente in una **finestra privata** (incognito). Apri Fiamma da una finestra normale di Chrome (o dall'icona installata). Finché non lo fai, **non scrivere rapporti veri**: sparirebbero alla chiusura.

## La cartella di salvataggio

- **"La copia nella cartella è sospesa"** (riga arancione in home, o "Sospesa" nelle Impostazioni): il telefono ha chiesto di nuovo il permesso. Tocca la riga o **Riattiva la cartella** e consenti.
- **"Il telefono non permette di scrivere nella cartella: riattiva il permesso"**: come sopra; se non basta, scollega e scegli di nuovo la cartella.
- **"La cartella non si trova più: scegline un'altra"**: la cartella è stata spostata o cancellata. **Scollega** e scegline un'altra: l'app copia di nuovo tutti i rapporti nella nuova cartella.
- **"Un file nella cartella è bloccato (forse da un'app di sincronizzazione): riprova tra poco"**: aspetta qualche istante, poi **Sincronizza ora**.
- **"Memoria piena: libera spazio e riprova"**: la cartella è su un disco pieno.
- **"Non disponibile in questo browser (serve Chrome recente su Android)"**: la cartella non c'è su questo browser: usa il **backup in un file ZIP**.
- **Non riesco a scegliere una cartella**: su Android non si può scegliere la radice della memoria né *Download*; crea una sottocartella (per esempio *Documenti/Fiamma*) e scegli quella.
- **L'app di sincronizzazione carica strani file `.crswap`**: sono temporanei di Chrome; impostala per ignorarli.

**Prova cartella** (nelle Impostazioni) scrive e rilegge un file: se riesce, la copia funziona.

## Il backup o il ripristino non riesce

- **"Non è un backup di Fiamma"**: il file non è uno ZIP creato da Fiamma (o è di un'altra versione del formato).
- **"Il file non è un backup ZIP valido" / "Il file ZIP è danneggiato" / "Il backup è danneggiato (…)"**: il file è stato interrotto o modificato. Prova a scaricarlo di nuovo dall'origine.
- **"Backup troppo grande per un file ZIP"**: scarica il backup **senza foto** e affidati alla cartella di salvataggio per le foto.

## L'aggiornamento non arriva

L'app si aggiorna da sola: quando la apri **con internet**, scarica la versione nuova, e la **usi dall'apertura successiva**. Se ti sembra di avere ancora la versione vecchia:

1. Apri l'app con internet attivo, aspetta qualche secondo, **chiudila del tutto** (dalle app recenti) e riaprila.
2. Ripeti una volta: l'aggiornamento è attivo alla seconda apertura.
3. Se non basta, puoi cancellare i dati del sito dalle impostazioni di Chrome (Impostazioni sito → il sito dell'app): l'app riparte pulita e scarica tutto di nuovo. **Attenzione**: cancella **anche i rapporti**. Fallo solo dopo aver fatto un backup.

Le scorciatoie dell'icona (Nuovo rapporto, Scansione rapida) compaiono dopo che Chrome ha aggiornato l'app installata, anche dopo qualche giorno.

## Il PDF non è come mi aspettavo

- I campi vuoti compaiono come "—": è voluto. Compila il campo e rigenera il PDF.
- Un'**emoji** o un carattere insolito diventa `?`.
- La **bozza** porta "BOZZA" e non il numero: chiudi il rapporto per avere il numero.
- Il PDF si rifà **ogni volta** da quello che c'è nel rapporto in quel momento: dopo una modifica, salvalo di nuovo.

## L'indirizzo dalla posizione non funziona

- **"Permesso di posizione negato"**: abilitalo dalle impostazioni del sito (icona a sinistra dell'indirizzo) e riprova.
- **"Posizione non disponibile"**: attiva il **GPS** e riprova, meglio all'aperto.
- **"Tempo scaduto"**: riprova all'aperto o con il GPS attivo.
- **"Posizione trovata (…) ma non riesco a ricavare l'indirizzo (serve internet)"**: ti manca la connessione: scrivi l'indirizzo a mano.

## Ho eliminato un rapporto per sbaglio

Dall'elenco apri **Cestino (N)** in fondo e tocca **Ripristina**: ci resta 30 giorni. Una bozza mai compilata, invece, si elimina subito e non è recuperabile (ma non conteneva nulla).

## Ho perso i dati

Se il telefono è nuovo o i dati del sito sono stati cancellati, ripristina da una **cartella di salvataggio** o da un **backup** ([Telefono nuovo](07-copie-di-sicurezza.md#telefono-nuovo)). Senza una copia i rapporti non sono recuperabili: i dati non stanno su nessun server. Per questo conviene collegare la cartella di salvataggio e scaricare ogni tanto un backup.
