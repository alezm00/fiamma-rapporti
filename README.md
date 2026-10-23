# Fiamma

Web app (PWA) per Android per scrivere i **rapporti di intervento** di un tecnico di caldaie, pompe di calore e condizionatori, con le misure dell'analizzatore di combustione **Testo 330** lette dal suo QR code. (Non è un'app di Testo.)

Si crea il rapporto (cliente, impianto con quanti apparecchi servono, intervento, materiali, orari, foto, note), vi si aggiungono le misure scansionando il QR, si chiude (numero progressivo per anno) e si invia il **PDF** per email. Tutto resta **sul telefono** e funziona anche **senza rete**: non c'è nessun server.

**Usala**: <https://alezm00.github.io/fiamma-rapporti/> con Chrome su Android → menu ⋮ → *Installa app*.

## Documentazione

Tutta la documentazione è in [`docs/`](docs/README.md):

- **Per chi usa l'app**: [introduzione e installazione](docs/uso/01-introduzione.md), [i rapporti](docs/uso/02-rapporti.md), [compilare il rapporto](docs/uso/03-compilare-il-rapporto.md), [misure Testo](docs/uso/04-misure-testo.md), [PDF ed email](docs/uso/05-pdf-ed-email.md), [impostazioni](docs/uso/06-impostazioni.md), [copie di sicurezza](docs/uso/07-copie-di-sicurezza.md), [problemi e risposte](docs/uso/08-problemi-e-risposte.md).
- **Per chi sviluppa**: [architettura](docs/sviluppo/01-architettura.md), [struttura del codice](docs/sviluppo/02-struttura-del-codice.md), [modello dati](docs/sviluppo/03-modello-dati.md), [QR del Testo](docs/sviluppo/04-qr-testo.md), [PDF](docs/sviluppo/05-pdf.md), [archiviazione e copie](docs/sviluppo/06-archiviazione-e-copie.md), [interfaccia](docs/sviluppo/07-interfaccia.md), [offline e pubblicazione](docs/sviluppo/08-offline-e-pubblicazione.md), [test](docs/sviluppo/09-test.md), [guida allo sviluppo](docs/sviluppo/10-guida-allo-sviluppo.md), [decisioni e limiti](docs/sviluppo/11-decisioni-e-limiti.md).

## Provarla in locale

Nessuna compilazione e nessun `npm`: sono file statici.

```
python3 -m http.server 8000      # dalla radice del progetto
# apri http://localhost:8000 con Chrome
```

Con il service worker l'app risponde dalla cache: durante lo sviluppo attiva *Bypass for network* in DevTools (o alza `CACHE` in `sw.js`). Dettagli in [Guida allo sviluppo](docs/sviluppo/10-guida-allo-sviluppo.md).

## Prove

```
node --test                    # la logica, in meno di un secondo
tests/e2e/run.sh               # l'app nel browser (Playwright, Pillow, ffmpeg, poppler)
```

Prima di pubblicare: prove verdi, `CACHE` alzata in `sw.js`, file nuovi in `FILES`. Si pubblica con un `git push` su `main` (GitHub Pages). Vedi [Test](docs/sviluppo/09-test.md) e [Offline e pubblicazione](docs/sviluppo/08-offline-e-pubblicazione.md).

## Com'è fatto

```
index.html  manifest.json  sw.js    la pagina, l'app installabile, l'uso offline
src/        il programma, a livelli: screens → backup / pdf / ui / data → model → qr / lib
css/ img/ vendor/                   stile, immagini, librerie incluse (con le licenze)
tests/      unit/ (logica) e e2e/ (browser)
docs/       la documentazione
```

Librerie in `vendor/` (ognuna con la sua licenza): Tailwind CSS 4 (build "browser"), zxing-wasm (lettura del QR), pdf-lib e fontkit (PDF), font Liberation Sans.
