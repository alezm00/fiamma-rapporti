# Decisioni, limiti e idee

Perché il progetto è fatto così, cosa ancora non fa, e cosa si potrebbe fare. Utile prima di cambiare qualcosa di strutturale.

## Come è nato

Fiamma è nata come lettore del QR del Testo 330 ("Testo QR") per ricopiare a mano i valori dell'analizzatore. Poi il lavoro vero — il **rapporto di intervento** — è diventato il centro dell'app: si crea prima il rapporto e vi si aggiungono le misure; la lettura rapida del QR è rimasta a parte, per chi vuole solo vedere i valori. Il nome è cambiato in *Fiamma* perché non è un'app di Testo. Un tecnico di caldaie, pompe di calore e condizionatori è l'utente tipo: lavora in piedi, con una mano, spesso senza rete.

## Decisioni

| Decisione | Motivo e conseguenze |
|---|---|
| **Il rapporto viene prima, le misure dopo** | È quello che si consegna al cliente. Le misure sono un allegato del rapporto (`measures`), e il PDF le mette a confronto (Prima / Dopo). |
| **Nessuna anagrafica, nessuna rubrica** | Ogni rapporto è a sé: cliente e impianto sono campi del rapporto. Per gli interventi ripetuti c'è **Duplica**, che copia cliente e impianto. Meno da gestire, meno da perdere. |
| **Nessun dato predefinito** | Era stato fatto (cliente e apparecchio precompilati) e poi tolto, perché non serviva: un rapporto nuovo parte vuoto e **senza apparecchi**, e il tipo si sceglie con i tre pulsanti. |
| **Un impianto con apparecchi in numero libero** | Nello stesso impianto possono esserci caldaie, pompe di calore e condizionatori, quanti servono. Ogni tipo ha i suoi campi (`UNIT_KINDS`). |
| **Nessuna migrazione dei dati delle versioni precedenti** | La richiesta era di ripartire da zero. Il codice **non** contiene ponti verso formati vecchi: database e impostazioni hanno chiavi proprie e l'app non legge né converte quelle di prima. Se in futuro il formato dei dati cambia, serve un migratore esplicito (e va documentato qui). |
| **Nomi interni `testoqr…` mantenuti** | Il database (`testoqr-reports`) e le chiavi di `localStorage` (`testoqr.config`, `testoqr.scans`) cominciano per il vecchio nome. Sono invisibili e rinominarli azzererebbe i dati già salvati. |
| **Il numero si assegna alla chiusura, per anno** | Le bozze eliminate non lasciano buchi; l'anno è quello della data dell'intervento; un numero assegnato non si riusa mai, nemmeno se il rapporto viene eliminato. Il prossimo numero si può cambiare per allinearsi a un registro cartaceo. |
| **Si salva il JSON del QR, non la tabella** | Le etichette e i formati migliorano nel tempo: la tabella si ricostruisce dal dato originale ogni volta. |
| **Il telefono è la fonte; la cartella è una copia a senso unico** | Nessun conflitto da risolvere: i rapporti si modificano solo sul telefono. Il ripristino è un'azione esplicita che **unisce** (vince la modifica più recente). |
| **Un rapporto inviato torna "Completato" se lo modifichi** | In elenco si vede subito che quello che hai mandato non è più quello che hai adesso. |
| **Cestino di 30 giorni; bozza vuota scartata** | Un'eliminazione per sbaglio si recupera; una bozza mai compilata non fa rumore in elenco. |
| **Il testo dell'email è un modello con segnaposto** | L'utente scrive il testo come lo scriverebbe a mano e inserisce i dati del rapporto tra graffe. Una riga con un dato mancante sparisce, così il messaggio non resta mai "a metà". Un solo modello vale per bozze e rapporti chiusi (`{rapporto}` e `{titolo}` si adattano). Vuoto vuol dire "originale": chi non lo cambia segue gli aggiornamenti dell'app. Solo testo semplice. |
| **Avvisi, non blocchi** | Codice fiscale o email dubbi dànno un avviso: in cantiere si deve poter chiudere il rapporto. |
| **PDF con pdf-lib, non con la stampa del browser** | Impaginazione controllabile, funziona offline, produce un file allegabile alla condivisione di Android. |
| **Email con la condivisione di Android (PDF allegato)** | Una pagina web non può allegare un file a un `mailto:`; la Web Share API sì. Il `mailto:` resta come alternativa (il PDF si scarica e si allega a mano). Il destinatario non si può precompilare nella condivisione: si copia negli appunti. |
| **Nessuna compilazione, nessun `npm`** | Si modifica e si pubblica; le librerie sono in `vendor/`. Il prezzo: Tailwind genera lo stile nel browser a ogni apertura (qualche decimo di secondo), e non ci sono controlli automatici sui tipi. |
| **ZIP senza librerie** | Il browser sa già comprimere (`CompressionStream`); un backup ha pochi file. Basta un formato semplice, senza cifratura né ZIP64. |
| **Salvataggio con esito sempre visibile** | Una scritta ("Salvato 14:32" / "NON SALVATO") dice se il dato è al sicuro; un errore si può riprovare con un tocco. |
| **I livelli di `src/` sono controllati da una prova** | La logica non dipende dallo schermo: si prova con Node e si può riusare. |

## Limiti noti

- **La cartella di salvataggio non è verificata su un telefono reale.** Le prove usano la cartella privata del browser; la funzione risulta disponibile in Chrome per Android dalla versione 132. "Prova cartella" nelle impostazioni dice subito se funziona sul proprio telefono.
- **Il permesso della cartella può scadere a ogni apertura** (comportamento del telefono): le modifiche restano in coda e partono quando lo si riattiva; la home lo ricorda.
- **Su Android non si può scegliere la radice della memoria né Download**: va scelta una sottocartella. Chrome scrive i file con un temporaneo `.crswap`: le app di sincronizzazione vanno impostate per ignorarlo.
- **Un solo telefono è la fonte.** Non c'è sincronizzazione tra più dispositivi: due telefoni con la stessa cartella si sovrascriverebbero. Il ripristino unisce, non sincronizza.
- **I dati stanno nel browser.** Cancellare i dati del sito da Chrome cancella i rapporti: servono la cartella di salvataggio o i backup. L'app chiede al telefono di non cancellarli da solo (`persist()`) e la home ricorda di fare una copia.
- **In una finestra privata** l'archivio non è disponibile (i dati restano in memoria finché la pagina è aperta): la home lo avvisa.
- **Email**: il destinatario non si precompila nella condivisione (lo si copia negli appunti); l'invio non è automatico: si completa in Gmail.
- **Indirizzo dalla posizione**: serve internet (OpenStreetMap Nominatim, che ha limiti d'uso); si inviano solo le coordinate. Va sempre controllato.
- **Foto**: fino a 20 per rapporto, ridimensionate a 1280 px sul lato lungo (qualità 0,8).
- **Limiti dei dati letti da fuori**: 50 apparecchi, 200 materiali, 100 misure per rapporto (`normalizeReport`).
- **Un riquadro di campi nel PDF non si spezza tra due pagine** (lo fanno i riquadri di testo e le tabelle): una scheda enorme non è prevista.
- **Nessuna firma del cliente**, nessun invio automatico, nessun elenco di clienti.
- **Il viewport blocca lo zoom** a due dita (`user-scalable=no`).
- **Strumenti**: provata con i campioni di Testo 330 e 400; il formato TJF è letto in modo generico, ma un tipo di prova nuovo può mostrare etichette non italianizzate ("Altri dati") finché non si aggiungono in `labels.js`.

## Idee non pianificate

Cose emerse e non fatte; nessuna è un impegno.

- Firma del cliente sul telefono, da inserire nel PDF.
- Più ditte o più tecnici (oggi uno solo nelle impostazioni).
- Un modello di testo per i lavori più frequenti (frasi pronte).
- Esportare l'elenco dei rapporti in un foglio (CSV).
- Sincronizzazione tra due telefoni (richiede un'idea di conflitti: oggi evitata di proposito).
- Conferme e avvisi dell'app invece di quelli di sistema (`confirm`/`alert`).
- Spezzare ancora i file più lunghi (`src/screens/settings.js`, `src/backup/folder/index.js`).
- Togliere il gancio per le prove `folder.testing` dal codice dell'app (si potrebbe avvolgere la cartella di prova con un oggetto che risponde a `queryPermission`).
