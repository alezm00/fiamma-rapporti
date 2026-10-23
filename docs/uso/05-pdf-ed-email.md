# PDF ed email

Il rapporto si trasforma in un PDF **A4** sul telefono (anche senza internet), che puoi salvare, condividere o inviare per email.

## Cosa c'è nel PDF

Nell'ordine, dall'alto:

1. **Intestazione**: il tuo logo e i dati della ditta (ragione sociale, indirizzo, partita IVA, telefono, email) a sinistra; a destra "RAPPORTO DI INTERVENTO", il **numero** (`n. 2026/012`) e la data dell'intervento. Una **bozza** porta "BOZZA" in arancione al posto del numero.
2. **Cliente**: nome, codice fiscale, telefono, indirizzo.
3. **Impianto**: targa e il riepilogo degli apparecchi ("1 caldaia, 1 pompa di calore, 2 condizionatori"), poi **una scheda per ogni apparecchio** con i suoi dati.
4. **Intervento**: tipo, esito, arrivo, partenza e durata, in una riga.
5. **Lavori eseguiti**, in un riquadro.
6. **Materiali**: tabella con descrizione e quantità.
7. **Misure Testo**: le misure dello stesso tipo **affiancate** (una colonna per etichetta, *Prima | Dopo*), le altre ciascuna in una tabella; sotto, le fasi della prova e le note della misura.
8. **Strumenti** usati, una riga ciascuno (nome, numero di serie, firmware).
9. **Note**.
10. **Foto**, su due colonne, circa **quattro per foglio**.
11. **Tecnico**: il nome che hai scritto nelle impostazioni.

In fondo a ogni pagina: "Rapporto di intervento n. … · Cliente" e "Pagina n di m". Una **bozza** dice "Bozza: rapporto non ancora chiuso".

Il PDF è **compatto**: i riquadri sono bassi e usano le colonne, così con quattro apparecchi la prima pagina contiene ancora intervento, lavori e materiali. Quello che non hai compilato compare come "—".

I caratteri che il PDF non sa scrivere (le emoji, per esempio) diventano `?`.

## Salvare il PDF

**Salva PDF** scarica il file nei **download** del telefono. Il nome è `Rapporto_2026-012_Mario-Rossi.pdf` (per una bozza `Bozza_2026-10-22_Mario-Rossi.pdf`). Salvare **non cambia lo stato** del rapporto.

Se il codice fiscale ha un avviso, il PDF si crea lo stesso e il messaggio dice di controllarlo.

## Inviare per email

**Invia email** crea il PDF e prepara l'invio, con **oggetto** e **testo** già scritti. Quelli qui sotto sono i testi **originali**: li puoi cambiare nelle Impostazioni ([Testo dell'email](06-impostazioni.md#testo-dellemail)).

**Oggetto**: `Rapporto di intervento n. 2026/012 - Mario Rossi - targa AB12 - 22/10/2026` (per una bozza: `Rapporto di intervento (bozza) - …`).

**Testo**:

```
Buongiorno,

in allegato il rapporto di intervento n. 2026/012 del 22/10/2026.

Cliente: Mario Rossi
Indirizzo: Via Roma 1, 33170 Pordenone PN
Impianto: targa AB12; Caldaia Beretta Ciao 24 (matricola SN1); Pompa di calore Daikin Altherma
Intervento: Manutenzione ordinaria - Impianto funzionante

Cordiali saluti
Luca Bianchi
Bianchi Srl
```

(Per una bozza: "in allegato la bozza del rapporto di intervento del …". Le righe senza dati si saltano; la firma è il nome del tecnico e la ditta delle impostazioni.)

Come si invia lo scegli nelle **Impostazioni → Email → "Il tasto Invia email"**:

### 1. Condivisione di Android (predefinito)

Si apre il **menu di condivisione** di Android: scegli **Gmail** e la mail si apre con il **PDF già allegato**, oggetto e testo pronti. Una pagina web non può precompilare il destinatario in questo modo, quindi il **destinatario viene copiato negli appunti**: nel campo "A" toccalo sopra la tastiera (la schermata lo ricorda: "Destinatario copiato negli appunti…").

Se chiudi il menu senza scegliere niente, non succede nulla e il rapporto non risulta inviato. Se il telefono nega la condivisione ("La condivisione non è partita"), premi di nuovo il pulsante.

### 2. Gmail con `mailto`

Si apre **subito Gmail** con destinatario, oggetto e testo già compilati. Una pagina web non può allegare file, quindi il **PDF si salva nei download** e lo allegherai tu con la graffetta (il messaggio dice dove l'ha salvato). In questo caso il rapporto risulta *Inviato* appena si apre Gmail.

Se il telefono **non sa condividere file** (per esempio provando da un computer), l'app usa da sola questa seconda strada.

### Solo il PDF

L'**icona di condivisione** accanto a *Salva PDF* manda **solo il PDF** con il menu di Android, senza oggetto né testo preparati.

## Lo stato "Inviato"

Dopo un invio riuscito, un rapporto **chiuso** passa a **Inviato**. Se poi lo modifichi torna *Completato*: in elenco si vede che va rimandato. Una **bozza** inviata resta bozza.

## Il destinatario

Si imposta una volta sola nelle **Impostazioni** (più indirizzi si separano con una virgola). Nel rapporto, sotto i pulsanti, una riga dice a chi va: "Destinatario: ufficio@esempio.it" oppure "Nessun destinatario impostato (si imposta dalle impostazioni nella pagina iniziale)". Se un indirizzo non è valido compare un avviso; puoi comunque procedere e scrivere il destinatario in Gmail.
