# Compilare il rapporto

Le parti del rapporto, dall'alto in basso. Tutto si salva da solo; i campi possono restare vuoti (il PDF scrive "—").

## Data dell'intervento

In cima, **Data dell'intervento**: oggi per un rapporto nuovo. Decide l'**anno del numero** e il mese in elenco. Il campo non può restare vuoto.

## Cliente

| Campo | Note |
|---|---|
| **Nome e cognome** | È il campo principale: compare in elenco, nel nome del file e nell'email. |
| **Codice fiscale** | Si scrive come capita: a fine campo diventa maiuscolo e senza spazi. Se non torna compare un **avviso** sotto il campo (lunghezza, formato, data di nascita, lettera di controllo; vale anche per la partita IVA a 11 cifre). **È solo un avviso**: non impedisce niente, il PDF si crea lo stesso. |
| **Telefono** | Testo libero (per esempio `0434 123123`). |
| **Indirizzo** | Più righe se vuoi. Il pulsante **Usa la mia posizione** lo compila dal GPS del telefono: serve internet e il permesso di posizione; l'indirizzo va **sempre controllato** ("Indirizzo trovato (precisione circa 12 m). Controllalo prima di creare il PDF."). Se l'indirizzo non si ricava (per esempio manca internet), un messaggio mostra le coordinate trovate e ti chiede di scriverlo a mano. |

## Impianto e apparecchi

**Targa impianto** è una sola per rapporto. Sotto, gli **apparecchi**: un rapporto nuovo parte **senza**; aggiungi quanti ne servono con i tre pulsanti:

**+ Caldaia** · **+ Pompa di calore** · **+ Condizionatore**

Puoi mettere più apparecchi dello stesso tipo e di tipi diversi nello stesso impianto. I titoli si numerano da soli ("Condizionatore 1", "Condizionatore 2"…). Ogni apparecchio ha una **✕** per toglierlo (se è già compilato chiede conferma).

| Tipo | Campi |
|---|---|
| **Tutti** | Marca · Modello · Matricola / codice · Data di installazione |
| **Caldaia** | Combustibile (metano, GPL, gasolio) · Camera di combustione (aperta, forzata) · Tipo di caldaia (a condensazione, tradizionale) · Potenza termica nominale e reale (kW) |
| **Pompa di calore** | Tipo (aria-acqua, aria-aria, acqua-acqua, geotermica) · Potenza termica nominale e frigorifera (kW) · Gas refrigerante (R32, R410A, R290, R134a, R407C, R454B, R744, altro) · Carica di refrigerante (kg) |
| **Condizionatore** | Tipo (monosplit, multisplit, canalizzato, cassetta, altro) · Unità interne · Potenza frigorifera e in riscaldamento (kW) · Gas refrigerante · Carica (kg) |

I campi numerici aprono il tastierino numerico. Tutto è facoltativo ("Non indicato" nei menu). La **ricerca** nell'elenco trova marca, modello e matricola di qualunque apparecchio.

## Intervento

- **Tipo di intervento**: manutenzione ordinaria, manutenzione straordinaria, riparazione / guasto, prima accensione, controllo di efficienza energetica, sopralluogo / preventivo, altro.
- **Esito**: impianto funzionante, funzionante con anomalie, non funzionante.
- **Lavori eseguiti**: testo libero, su più righe.
- **Materiali**: **Aggiungi materiale** crea una riga con *Descrizione* e *Quantità*; la ✕ la toglie. Le righe lasciate vuote spariscono quando esci dal rapporto.
- **Arrivo** e **Partenza**: un orario ciascuno, con il pulsante **Adesso** che mette l'ora attuale. Sotto compare la **durata** ("Durata dell'intervento: 1 h 25 min"), anche se la partenza è dopo mezzanotte.

## Misure Testo

L'elenco delle misure del rapporto, con il pulsante **Aggiungi misura** ([Misure Testo](04-misure-testo.md)). Toccando una misura si aprono i suoi valori.

## Foto

**Scatta foto** apre la fotocamera, **Dalla galleria** sceglie una o più foto. Fino a **20 per rapporto** ("Massimo 20 foto per rapporto: elimina una foto per aggiungerne altre"). Le foto si ridimensionano da sole (lato lungo 1280 px: bastano per un PDF leggibile e leggero) e si **raddrizzano** secondo l'orientamento della fotocamera.

Toccando una foto si vede a schermo intero (un tocco per chiudere); la **✕** in un angolo la elimina (con conferma). Nel PDF le foto vanno su due colonne, circa 4 per foglio.

## Note

Testo libero per anomalie, consigli, appuntamenti: compare nel PDF in un riquadro "Note".

## In fondo: le azioni

| Pulsante | Cosa fa |
|---|---|
| **Chiudi rapporto** | Assegna il numero e passa a *Completato* (solo per le bozze). |
| **Invia email** | Prepara il PDF e apre l'invio ([PDF ed email](05-pdf-ed-email.md)). Sotto, una riga dice a chi: "Destinatario: …" oppure che non è impostato. |
| **Salva PDF** | Scarica il PDF nei download. |
| *(icona di condivisione)* | Invia **solo il PDF** con il menu di Android; compare se il telefono lo permette. |
| **Duplica** | Nuova bozza con cliente e impianto. |
| **Elimina** | Nel cestino per 30 giorni. |

Il tasto indietro (la freccia in alto, o quello di Android) torna all'elenco **salvando** prima.

## Il salvataggio

Non c'è un pulsante "Salva": ogni modifica si salva dopo una breve pausa, e comunque quando esci dal rapporto o passi a un'altra app. Sotto il titolo vedi sempre l'esito:

| Scritta | Significato |
|---|---|
| **Salvato 14:32** | Tutto al sicuro (ora dell'ultima modifica salvata). |
| **Salvataggio…** | Sta scrivendo. |
| **NON SALVATO · tocca per riprovare** (in rosso) | Non è riuscito: di solito la memoria del telefono è piena. Le modifiche restano a schermo: libera spazio e tocca la scritta. Se esci senza riuscire a salvare, un avviso ti dice che le ultime modifiche andranno perse. |
