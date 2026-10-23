# Introduzione

**Fiamma** è un'app per Android per scrivere i **rapporti di intervento** di un tecnico di caldaie, pompe di calore e condizionatori, con le misure dell'analizzatore di combustione **Testo 330** lette dal suo QR code. Si apre dal telefono come un'app qualsiasi, funziona anche **senza rete** e tiene tutti i dati **sul telefono**. (Non è un'app di Testo.)

## Cosa fa

- **Rapporto di intervento**: cliente, impianto con quanti apparecchi servono (caldaie, pompe di calore, condizionatori, anche insieme), tipo di intervento ed esito, lavori eseguiti, materiali, orari, foto, note.
- **Misure Testo**: inquadri il QR dell'analizzatore e la misura entra nel rapporto, con un'etichetta (*Prima*, *Dopo*…). I valori si vedono grandi, per ricopiarli.
- **PDF** in formato A4 con l'intestazione della ditta, pronto da salvare, condividere o inviare per email.
- **Numerazione** progressiva per anno (`2026/012`), assegnata alla chiusura del rapporto.
- **Elenco** con ricerca e filtri, **cestino** di 30 giorni, **copia di sicurezza** in una cartella a scelta e in un file ZIP.
- **Scansione rapida**: legge il QR solo per vedere e ricopiare i valori, senza creare un rapporto.

## Cosa non fa

- Non ha un server né un account: niente cloud, niente accesso da più dispositivi.
- Non ha un'anagrafica clienti: ogni rapporto è a sé (per un cliente che torna c'è **Duplica**).
- Non ha la firma del cliente e non invia le email da solo: prepara tutto e l'invio si completa in Gmail.

## Di cosa hai bisogno

- Un telefono **Android** con **Chrome** aggiornato.
- Internet solo per: la prima apertura (l'app si scarica sul telefono), gli aggiornamenti, e "Usa la mia posizione" per l'indirizzo.
- Il permesso della **fotocamera** (per il QR e le foto).

## Installare l'app

1. Apri con Chrome l'indirizzo dell'app: **<https://alezm00.github.io/fiamma-rapporti/>** (serve https: la fotocamera non funziona da http).
2. Menu ⋮ → **Installa app** (oppure "Aggiungi a schermata Home").
3. Da quel momento l'icona **Fiamma** è sulla schermata Home e l'app funziona anche **offline**.

Tenendo premuta l'icona compaiono due scorciatoie: **Nuovo rapporto** e **Scansione rapida** (compaiono dopo che Chrome ha aggiornato l'app installata, a volte dopo qualche giorno).

## Gli aggiornamenti

Sono automatici. Quando apri l'app con internet, il telefono scarica in silenzio la versione nuova; la **usi dall'apertura successiva**. Non devi fare niente e non perdi niente: i rapporti restano dove sono. Se non vedi una novità, chiudi l'app e riaprila ancora una volta con internet (vedi [Problemi e risposte](08-problemi-e-risposte.md#laggiornamento-non-arriva)).

## I primi passi consigliati

1. Apri **Impostazioni** (l'ingranaggio in alto a destra) e compila **Ditta e tecnico**, il **logo** se ce l'hai, e il **destinatario** delle email: compaiono nel PDF e nelle email ([Impostazioni](06-impostazioni.md)).
2. Controlla la **numerazione**: se hai un registro cartaceo, imposta il prossimo numero.
3. Collega una **cartella di salvataggio** (o almeno scarica un backup ogni tanto): i dati stanno solo sul telefono ([Copie di sicurezza](07-copie-di-sicurezza.md)).
4. Crea il primo rapporto: **Nuovo rapporto** ([Rapporti](02-rapporti.md) e [Compilare il rapporto](03-compilare-il-rapporto.md)).

## Le schermate

| Schermata | A cosa serve |
|---|---|
| **Elenco** (home) | I rapporti, la ricerca e i filtri; Nuovo rapporto, Scansione rapida, Impostazioni, Cestino. |
| **Rapporto** | Si compila: cliente, impianto, intervento, misure, foto, note; da qui si chiude, si invia, si duplica, si elimina. |
| **Fotocamera** | Legge il QR del Testo, da fotocamera, da foto o da file. |
| **Misura** | I valori di una misura, grandi; etichetta, copia, rimozione. |
| **Scansioni rapide** | Le ultime 20 letture fatte senza un rapporto. |
| **Cestino** | I rapporti eliminati, recuperabili per 30 giorni. |
| **Impostazioni** | Ditta, logo, numerazione, email, cartella di salvataggio, backup. |

## Privacy

Tutto resta sul telefono. L'app non invia i dati a nessun server. L'unica richiesta di rete "a tuo nome" è quella dell'indirizzo da posizione (**Usa la mia posizione**), che manda a OpenStreetMap **solo le coordinate**. La pagina è impostata per non essere indicizzata dai motori di ricerca.
