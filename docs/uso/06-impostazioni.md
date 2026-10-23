# Impostazioni

Si aprono con l'**ingranaggio** in alto a destra nell'elenco. Quello che scrivi si salva **da solo** (anche uscendo dalla schermata). Le impostazioni restano sul telefono.

## Ditta e tecnico

Compaiono nell'**intestazione del PDF** e nella firma dell'email.

| Campo | Dove compare |
|---|---|
| **Ragione sociale** | Intestazione del PDF, firma dell'email |
| **Partita IVA**, **Telefono**, **Indirizzo**, **Email** | Intestazione del PDF |
| **Nome del tecnico** | In fondo al PDF ("Tecnico: …") e nella firma dell'email |

### Il logo

**Scegli logo** carica un'immagine (JPG o PNG, anche con lo sfondo trasparente): si ridimensiona da sola (480 px) e compare in alto a sinistra nel PDF. **Rimuovi** lo toglie. È facoltativo.

## Numerazione

Il rapporto prende il numero quando lo **chiudi**, in ordine **per anno** (l'anno della data dell'intervento).

**Prossimo numero del 2026** mostra il numero che prenderà il prossimo rapporto chiuso con data nel 2026, per esempio `2026/001`. Puoi cambiarlo (per esempio per allinearti a un registro cartaceo: scrivi 45 e il prossimo sarà `2026/045`): vale per l'anno in corso. Il numero **non torna mai indietro** da solo: un rapporto eliminato non lo libera. Uno zero o un valore non valido riparte da 1.

## Email

- **Destinatario**: l'indirizzo a cui mandi i rapporti (di solito l'ufficio). Più indirizzi si separano con una **virgola**. Se non è valido compare un avviso sotto il campo.
- **Il tasto "Invia email"**: scegli come inviare ([PDF ed email](05-pdf-ed-email.md#inviare-per-email)):
  - **Menu di Android** (predefinito): scegli Gmail e la mail si apre con il PDF già allegato; il destinatario va negli appunti.
  - **Gmail subito**: si apre Gmail con destinatario, oggetto e testo; il PDF si salva nei download e si allega con la graffetta.

L'**oggetto** e il **messaggio** si possono cambiare: vedi [Testo dell'email](#testo-dellemail) qui sotto.

## Testo dell'email

Nella scheda **Testo dell'email** scrivi tu l'**oggetto** e il **messaggio** di *Invia email*. All'inizio ci sono quelli originali:

```
Oggetto:   {titolo} - {cliente} - targa {targa} - {data}

Messaggio: Buongiorno,

           in allegato {rapporto} del {data}.

           Cliente: {cliente}
           Indirizzo: {indirizzo}
           Impianto: {impianto}
           Intervento: {intervento}

           Cordiali saluti
           {tecnico}
           {ditta}
```

Le parole tra **graffe** sono i **segnaposto**: nell'email diventano i dati del rapporto. Tutto il resto è testo tuo: cambialo, cancellalo, aggiungi frasi. I segnaposto si scrivono a mano oppure si **toccano** nell'elenco sotto il messaggio, e si inseriscono dove sta il cursore (nell'oggetto o nel messaggio, secondo l'ultimo campo toccato).

| Segnaposto | Diventa | Esempio |
|---|---|---|
| `{titolo}` | Titolo del rapporto | Rapporto di intervento n. 2026/012 (per una bozza: Rapporto di intervento (bozza)) |
| `{rapporto}` | Il rapporto, in una frase | il rapporto di intervento n. 2026/012 (bozza: la bozza del rapporto di intervento) |
| `{numero}` | Il numero | 2026/012 (vuoto in una bozza) |
| `{data}` | La data dell'intervento | 22/10/2026 |
| `{cliente}` | Il nome del cliente | Mario Rossi |
| `{indirizzo}` | L'indirizzo, su una riga | Via Roma 1, 33170 Pordenone PN |
| `{telefono}` | Il telefono del cliente | 333 1234567 |
| `{targa}` | La targa dell'impianto | AB12 |
| `{apparecchi}` | Gli apparecchi, con la matricola | Caldaia Beretta Ciao 24 (matricola SN1); Pompa di calore Daikin Altherma |
| `{impianto}` | Targa e apparecchi insieme | targa AB12; Caldaia Beretta Ciao 24 (matricola SN1) |
| `{tipo}` | Il tipo di intervento | Manutenzione ordinaria |
| `{esito}` | L'esito | Impianto funzionante |
| `{intervento}` | Tipo ed esito | Manutenzione ordinaria - Impianto funzionante |
| `{tecnico}` | Il nome del tecnico (dalle impostazioni) | Luca Bianchi |
| `{ditta}` | La ragione sociale (dalle impostazioni) | Bianchi Srl |

**Se un dato manca, la riga sparisce.** Una riga del messaggio che contiene un segnaposto vuoto non compare, così non restano scritte a metà ("Indirizzo: " senza indirizzo). Nell'**oggetto** la stessa regola vale per le parti separate da " - ": se la targa manca, sparisce "targa {targa}" e l'oggetto resta ordinato. Per esempio, con `Tel. {telefono}` in una riga: se il cliente ha il telefono la riga c'è, altrimenti no. Una riga **senza** segnaposto compare sempre. Non restano mai due righe vuote di seguito né righe vuote all'inizio o alla fine.

**L'anteprima** sotto i campi mostra come verrebbe l'email con un rapporto d'esempio (e con il nome della ditta e del tecnico che hai scritto; se mancano, con nomi d'esempio). Si aggiorna mentre scrivi.

- Se scrivi un segnaposto **che non esiste** (per esempio `{clinete}`) resta com'è nel testo e compare un avviso giallo: controlla come l'hai scritto.
- Se **svuoti** un campo, per quel campo vale il testo originale.
- **Ripristina il testo originale** (con conferma) rimette oggetto e messaggio di partenza.
- Il testo vale sia per il **menu di Android** sia per **Gmail** (`mailto`). L'icona di condivisione del **solo PDF** non usa né oggetto né messaggio.
- È solo **testo semplice**: niente grassetto, colori o immagini (le email scritte da un'app non possono averli). L'oggetto arriva a 300 caratteri, il messaggio a 5000.
- Il testo si salva da solo con le impostazioni, e viaggia con loro: nella cartella di salvataggio e nei backup.

## Cartella di salvataggio e backup

Le ultime due sezioni (copia in una cartella e backup in un file) sono spiegate in [Copie di sicurezza](07-copie-di-sicurezza.md).
