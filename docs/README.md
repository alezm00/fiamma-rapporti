# Documentazione di Fiamma

**Fiamma** è un'app per Android per scrivere i rapporti di intervento di un tecnico di caldaie, pompe di calore e condizionatori, con le misure dell'analizzatore di combustione Testo 330 lette dal suo QR code. Tutto resta sul telefono e funziona anche senza rete. L'app si usa da <https://alezm00.github.io/fiamma-rapporti/>.

Questa documentazione ha due parti. Ogni pagina si legge da sola; i collegamenti portano alle altre.

## Per chi usa l'app

| Pagina | Di cosa parla |
|---|---|
| [Introduzione](uso/01-introduzione.md) | Cos'è, cosa fa e cosa no, come si installa, i primi passi |
| [I rapporti](uso/02-rapporti.md) | Bozza, completato, inviato; il numero; duplicare; cestino; elenco, ricerca e filtri |
| [Compilare il rapporto](uso/03-compilare-il-rapporto.md) | Cliente, impianto e apparecchi, intervento, materiali, foto, note, salvataggio |
| [Misure Testo](uso/04-misure-testo.md) | Leggere il QR, Prima e Dopo, la schermata dei valori, scansione rapida |
| [PDF ed email](uso/05-pdf-ed-email.md) | Cosa c'è nel PDF, salvarlo, inviarlo per email, lo stato "Inviato" |
| [Impostazioni](uso/06-impostazioni.md) | Ditta, logo, numerazione, destinatario |
| [Copie di sicurezza](uso/07-copie-di-sicurezza.md) | Cartella di salvataggio, backup in un file, telefono nuovo |
| [Problemi e risposte](uso/08-problemi-e-risposte.md) | Fotocamera, QR, salvataggio, cartella, aggiornamenti |

## Per chi sviluppa

| Pagina | Di cosa parla |
|---|---|
| [Architettura](sviluppo/01-architettura.md) | Le scelte, i livelli di `src/`, il percorso di una modifica |
| [Struttura del codice](sviluppo/02-struttura-del-codice.md) | Tutti i file, uno per uno |
| [Modello dati](sviluppo/03-modello-dati.md) | Il rapporto, gli apparecchi, gli stati, i formati dei file |
| [Il QR del Testo](sviluppo/04-qr-testo.md) | Lettura, decodifica, tabella dei valori, confronto |
| [Il PDF](sviluppo/05-pdf.md) | Impaginazione, parti, come aggiungerne una |
| [Archiviazione e copie](sviluppo/06-archiviazione-e-copie.md) | IndexedDB, coda della cartella, ZIP |
| [Interfaccia](sviluppo/07-interfaccia.md) | Schermate, navigazione, Tailwind, editor |
| [Offline e pubblicazione](sviluppo/08-offline-e-pubblicazione.md) | Service worker, aggiornamenti, manifest, GitHub Pages |
| [Test](sviluppo/09-test.md) | Prove della logica e nel browser |
| [Guida allo sviluppo](sviluppo/10-guida-allo-sviluppo.md) | Flusso di lavoro, convenzioni, ricette per le modifiche più comuni |
| [Decisioni e limiti](sviluppo/11-decisioni-e-limiti.md) | Perché è fatto così, limiti noti, idee |

## Glossario

| Termine | Significato |
|---|---|
| **Rapporto** | Il documento di un intervento: cliente, impianto, lavori, misure, foto. Un solo oggetto (`customer`, `plant`, `intervention`, `measures`…). |
| **Bozza / Completato / Inviato** | Gli stati del rapporto (`draft`, `done`, `sent`). |
| **Chiudere** | Passare da bozza a completato assegnando il numero. |
| **Apparecchio** | Una caldaia, una pompa di calore o un condizionatore dell'impianto; un rapporto ne ha quanti servono. |
| **Misura** | Una lettura dell'analizzatore (Testo 330) entrata nel rapporto dal QR, con un'etichetta (*Prima*, *Dopo*…). |
| **Scansione rapida** | Una lettura del QR fatta senza un rapporto, solo per vedere i valori. |
| **TJF** | Il formato dei dati di Testo dentro il QR (un JSON, compresso con gzip). |
| **Cestino** | Dove vanno i rapporti eliminati per 30 giorni. |
| **Cartella di salvataggio** | Una cartella scelta dall'utente in cui l'app copia da sola rapporti, foto e PDF. |
| **Coda** | Le modifiche ai rapporti ancora da copiare nella cartella. |
| **Backup** | Un file ZIP con rapporti, foto e impostazioni. |
| **Service worker** | Il programma del browser che tiene i file dell'app sul telefono per l'uso offline (`sw.js`). |
| **Livelli** | Le cartelle di `src/`, ognuna appoggiata solo a quelle sotto di lei. |
| **`CACHE` / `FILES`** | La versione della cache e l'elenco dei file offline in `sw.js`: si alza e si aggiorna a ogni modifica dell'app. |

## Dove sta cosa nel repository

```
index.html  manifest.json  sw.js    la pagina, l'app installabile e l'uso offline
src/        il programma
css/ img/ vendor/                   stile, immagini, librerie incluse
tests/      prove della logica (unit/) e nel browser (e2e/)
tools/      strumenti (icone)
docs/       questa documentazione
```
