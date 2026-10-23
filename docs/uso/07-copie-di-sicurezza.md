# Copie di sicurezza

**I rapporti, le foto e le impostazioni stanno solo sul telefono.** Se il telefono si rompe, si perde o cancelli i dati del sito da Chrome, senza una copia perdi tutto. Fiamma ti dà due modi per fare copie, e puoi usarli insieme:

| | **Cartella di salvataggio** | **Backup in un file ZIP** |
|---|---|---|
| Come funziona | Ogni modifica viene copiata **da sola** in una cartella che scegli | Premi un pulsante e scarichi un file |
| Cosa contiene | Rapporti (leggibili e ripristinabili), foto, **PDF** dei rapporti chiusi, impostazioni, logo | Rapporti, foto (facoltative), impostazioni, logo |
| Quando è utile | Copia sempre aggiornata; con Drive o Syncthing l'ufficio legge i PDF | Su qualunque telefono e browser; da conservare dove vuoi |
| Disponibilità | Chrome recente su Android | Ovunque |

Entrambe stanno nelle **Impostazioni**. La home ti ricorda con una riga se la copia nella cartella è sospesa o se non fai una copia da più di 30 giorni.

## Cartella di salvataggio

Una copia **a senso unico**: dal telefono verso la cartella. I rapporti si modificano **solo sul telefono**.

### Collegarla

1. **Impostazioni → Cartella di salvataggio → Scegli cartella**.
2. Scegli (o crea) una cartella: su Android **non si può scegliere** la radice della memoria né la cartella *Download*; scegli una **sottocartella** (per esempio *Documenti/Fiamma*).
3. Se nella cartella ci sono già impostazioni salvate (di un altro telefono), l'app chiede se **caricarle al posto di quelle di questo telefono**: valgono ditta, email, logo e numerazione; il numero progressivo dei rapporti non torna mai indietro (per ogni anno vale il più alto). Rispondendo **No** il telefono resta com'è e le impostazioni nella cartella non vengono cancellate.
4. L'app comincia a copiare tutti i rapporti ("Cartella collegata: sto copiando i rapporti"). Tocca **Prova cartella** per controllare che funzioni: scrive e rilegge un file di prova.

### Cosa ci trovi

```
<cartella scelta>/Fiamma/
    impostazioni.json    logo.jpg
    rapporti/2026/2026-012_Mario-Rossi_ab12cd34/    (bozza: BOZZA_2026-10-22_Mario-Rossi_ab12cd34)
        rapporto.json   rapporto.pdf (rapporti chiusi)   foto/01.jpg …
```

Una cartella per rapporto, divisa per anno. Il **PDF** c'è solo per i rapporti chiusi; per le bozze solo `rapporto.json` e le foto. Quando una bozza prende il numero, la sua cartella si **rinomina** (e quella vecchia sparisce). Un rapporto **nel cestino** viene tolto dalla cartella, e ci torna se lo ripristini.

### Come funziona la copia

Ogni modifica a un rapporto viene messa **in coda** e copiata **2 secondi dopo l'ultima**. Se il telefono è lento, o la cartella non è raggiungibile, le modifiche restano in coda e partono appena possibile: **non si perdono** nemmeno chiudendo l'app.

Lo stato si legge nelle Impostazioni: *Non collegata* · *Collegata: «nome»* · *Sospesa: «nome»* (il telefono chiede di nuovo il permesso) · *Ultima copia: gg/mm/aaaa hh:mm* · *N modifiche in attesa di essere copiate*.

### Il permesso scade? **Riattiva la cartella**

Il telefono può chiedere di nuovo il permesso a **ogni apertura** dell'app. In quel caso la cartella è **sospesa**: le modifiche aspettano. In Impostazioni compare **Riattiva la cartella**: toccalo e consenti l'accesso, e la coda parte (la home te lo ricorda con una riga arancione: "La copia nella cartella è sospesa: tocca per riattivarla").

### I pulsanti

| Pulsante | Cosa fa |
|---|---|
| **Scegli cartella** | Collega una cartella (se non ce n'è una). |
| **Riattiva la cartella** | Chiede di nuovo il permesso e fa partire la coda. |
| **Sincronizza ora** | Copia **tutti** i rapporti e le impostazioni, anche se sono già copiati. |
| **Prova cartella** | Scrive e rilegge un file: dice subito se la cartella funziona. |
| **Ripristina dalla cartella** | Rilegge i rapporti, le foto e le impostazioni dalla cartella e li **unisce** a quelli del telefono. |
| **Scollega** | Smette di copiare. I file già copiati restano dove sono. |

### Sincronizzare la cartella con Drive o altro

Se la cartella è sincronizzata con Google Drive, Syncthing o simili, ottieni una **copia di sicurezza fuori dal telefono** e l'ufficio può leggere i **PDF**. Attenzione: Chrome scrive i file con un file temporaneo `.crswap`; nell'app di sincronizzazione impostalo come file da **ignorare**.

> **Una cosa da sapere**: la funzione di cartella usa una tecnologia di Chrome per Android (File System Access) che risulta disponibile dalla versione 132. Non è stata ancora provata su un telefono reale da chi ha scritto l'app: **Prova cartella** serve a questo. Se nelle Impostazioni leggi "Non disponibile in questo browser", usa il backup in un file.

## Backup in un file ZIP

- **Includi le foto** (spuntato di default): togliendolo il file è molto più piccolo ma senza le foto.
- **Scarica il backup**: crea `Fiamma-backup-aaaa-mm-gg.zip` nei download ("Backup scaricato: … (12 rapporti, 30 foto)"). Conservalo fuori dal telefono (Drive, email, computer).
- **Ripristina da ZIP**: scegli un backup di Fiamma. **Unisce** il backup ai dati del telefono: se lo stesso rapporto è in entrambi, vince quello **modificato più di recente**. Non cancella niente.

Un file che non è un backup di Fiamma viene rifiutato con un messaggio.

Sotto i pulsanti, una riga dice **quando hai fatto l'ultima copia** (cartella o file). Fare un ripristino da un backup conta come copia di quel momento.

## Telefono nuovo

1. Installa l'app sul nuovo telefono ([Introduzione](01-introduzione.md#installare-lapp)).
2. **Con la cartella**: Impostazioni → *Scegli cartella* (la stessa, già sincronizzata) → rispondi **Sì** a "Caricare le impostazioni?" → poi **Ripristina dalla cartella** per i rapporti.
3. **Con il backup**: copia il file ZIP sul telefono e usa **Ripristina da ZIP**.

Dopo il ripristino controlla il prossimo numero (Impostazioni → Numerazione): il contatore è quello più alto tra telefono e copia, quindi non riparte da un numero già usato.

## Le regole di unione, in breve

- Un rapporto che c'è già si sostituisce solo se quello in arrivo è **più recente**.
- Le foto si aggiungono se non ci sono già.
- Le impostazioni del telefono **non si sovrascrivono**: ditta ed email si riempiono solo se qui sono vuote; i numeri tengono il valore più alto. (Fa eccezione la scelta di "caricare le impostazioni dalla cartella" quando colleghi la cartella: quella le sostituisce.)
- Il ripristino non cancella mai un rapporto del telefono.
