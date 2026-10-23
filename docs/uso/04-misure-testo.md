# Misure Testo

Come leggere il QR dell'analizzatore **Testo 330** e usarlo nel rapporto.

## Aggiungere una misura a un rapporto

1. Nel rapporto, **Aggiungi misura** (sezione *Misure Testo*).
2. Sull'analizzatore mostra il QR della misura e **inquadralo** con la fotocamera del telefono (dentro il riquadro). Appena lo legge, il telefono vibra e si apre la misura.
3. La misura è **già nel rapporto**, con un'etichetta: **Prima** la prima volta, **Dopo** la seconda, poi **Misura 3**, **Misura 4**…

> Il QR del Testo non è un normale QR di testo: contiene i dati compressi. Le app di scansione normali lo rovinano. Fiamma lo legge nel modo giusto e lo decomprime sul telefono.

### Se la fotocamera non basta

Nella schermata della fotocamera ci sono altre due strade:

- **Da foto**: scegli una foto del QR (utile se è molto denso, o se sul display ci sono riflessi). Se la foto non basta, riprova avvicinandoti, a fuoco e senza riflessi.
- **Importa file (.gz / .json)**: se hai il file della misura invece del QR.

Se il telefono ha il flash, compare il pulsante **Torcia**. **Annulla** torna indietro. Se la fotocamera non parte (permesso negato, usata da un'altra app) la schermata resta aperta con il motivo, e **Da foto** e **Importa file** si possono usare lo stesso.

Se il QR letto **non è del Testo**, compare "Il QR letto non contiene dati Testo validi" e la lettura riprende da sola.

Un QR **diviso in più parti** si legge una parte alla volta: la schermata dice "Parte 1 di 3 letta: inquadra le altre".

### La stessa misura due volte

Se leggi di nuovo una misura che è già nel rapporto, non si duplica: compare "Questa misura è già nel rapporto" e si apre quella.

## La schermata della misura

Mostra i valori **grandi**, pensati per ricopiarli a mano (e lo schermo resta acceso):

- il titolo (per esempio *Media (UNI 10389-1)*), la data e le informazioni principali (combustibile, O₂ di riferimento, CO₂ max);
- una **tabella** con una riga per valore: sigla (TF, O₂, CO…), nome, valore e unità. Con più colonne (Media, Min, Max) ogni riga ne ha una per colonna;
- sezioni richiudibili con il resto: **Fasi della prova** (aperta di default), **Risultati**, **Dati prova**, **Strumento** (nome e numero di serie)… e **Dati grezzi (JSON)** per i curiosi;
- **Copia testo**: mette i valori negli appunti, in testo semplice.

Un valore non misurato compare come `----`.

### L'etichetta

Dentro un rapporto la misura ha un campo **Etichetta della misura**, con i pulsanti rapidi **Prima** e **Dopo**: scrivi quello che vuoi (per esempio "Dopo la pulizia"). Si salva da sola. Se la lasci vuota prende "Misura N". L'etichetta è l'intestazione della colonna nel PDF.

### I pulsanti

| Pulsante | Dove | Cosa fa |
|---|---|---|
| **Torna al rapporto** | misura di un rapporto | Torna al rapporto. |
| **Aggiungi un'altra misura** | misura di un rapporto | Apre di nuovo la fotocamera, sullo stesso rapporto. |
| **Rimuovi misura** | misura di un rapporto | La toglie dal rapporto (con conferma). |
| **Nuova scansione**, **Indietro** | scansione rapida | Nuova lettura / torna indietro. |

## Prima e Dopo: il confronto

Le misure **dello stesso tipo** e con **una sola colonna di valori** (per esempio due medie UNI 10389-1: una prima e una dopo l'intervento) si **mettono a confronto** nel PDF, in una sola tabella con una colonna per etichetta (*Prima | Dopo*), con gli stessi parametri sulla stessa riga. Le altre (Media / Min / Max, o tipi diversi) hanno una tabella ciascuna.

## Scansione rapida

Dalla home: **Scansione rapida** legge un QR **senza creare un rapporto**: ti mostra i valori da ricopiare e li tiene nell'elenco **Scansioni rapide**, che conserva le **ultime 20** letture. Rileggere lo stesso QR lo porta in cima senza duplicarlo.

L'elenco (pulsante **Scansioni rapide**) mostra per ognuna il titolo, la data e i primi valori; tocchi per riaprirla, **✕** per eliminarla (con conferma), **Cancella tutto** per svuotare. Non hanno dati del cliente né foto e **non fanno parte di nessun rapporto**.
