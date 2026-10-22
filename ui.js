// Classi Tailwind usate dal JavaScript (messaggi, elenchi, risultati, foto, impostazioni).
// Sono definite qui, in un posto solo, e registrate all'avvio: il build "browser" di Tailwind
// crea lo stile solo per le classi presenti nella pagina, e così quello degli elementi
// creati dopo è già pronto (nessun lampo senza stile).

export const MSG = 'rounded-lg border p-4 text-[.95rem] leading-[1.45]';

export const MSG_TYPES = {
    success: 'border-ok-edge bg-ok-bg text-ok-fg',
    error: 'border-err-edge bg-err-bg text-err-fg',
    warn: 'border-warn-edge bg-warn-bg text-warn-fg',
    info: 'border-info-edge bg-info-bg text-info-fg',
};

// etichetta di stato del rapporto
export const BADGES = {
    draft: 'border-warn-edge bg-warn-bg text-warn-fg',
    done: 'border-ok-edge bg-ok-bg text-ok-fg',
    sent: 'border-info-edge bg-info-bg text-info-fg',
};

export const CLS = {
    // elenco dei rapporti
    reportOpen: 'btn flex-col items-stretch gap-1 bg-card p-4 text-left font-normal',
    reportHead: 'flex items-center justify-between gap-2',
    reportNum: 'font-bold text-white',
    reportName: 'text-[1.05rem] text-white',
    reportAddr: 'truncate text-[.9rem] text-soft',
    reportMeta: 'text-[.85rem] text-muted',
    badge: 'rounded-full border px-2.5 py-0.5 text-[.75rem] font-bold whitespace-nowrap',

    // materiali del rapporto
    matRow: 'flex gap-2',
    matText: 'input min-w-0 flex-1',
    matQty: 'input w-24 flex-none',
    matDel: 'btn w-12 flex-none bg-field text-[1.1rem] text-err-fg',

    // storico delle scansioni (e misure di un rapporto)
    historyRow: 'flex gap-1.5',
    historyOpen: 'btn min-w-0 flex-1 flex-col items-start gap-0.5 bg-field text-left font-normal',
    historyTitle: 'font-bold text-white',
    historyMeta: 'text-[.85rem] text-muted',
    historyVals: 'max-w-full overflow-hidden text-[.9rem] text-ellipsis whitespace-nowrap text-accent tabular-nums',
    historyDel: 'btn w-12 flex-none bg-field text-[1.1rem] text-err-fg',

    // intestazione del risultato
    headTerm: 'text-muted',
    headDef: 'font-bold text-white',

    // tabella dei valori: una colonna di valori oppure più colonne (Media, Min, Max…)
    tableSingle: 'grid grid-cols-[1fr_auto_auto]',
    tableMulti: 'grid grid-cols-[repeat(var(--cols),1fr)_auto]',
    tableHead: 'contents',
    tableHeadCell: 'pt-1 pl-2 text-right text-[.8rem] text-muted',
    row: 'contents',
    cell: 'flex flex-col justify-center py-3',
    cellLine: 'border-b border-line',
    labelMulti: 'col-span-full flex-row items-baseline justify-start gap-2 pb-0',
    code: 'text-[1.2rem] font-bold text-white',
    name: 'text-[.8rem] text-muted',
    num: 'items-end pl-3 text-[2rem] font-bold whitespace-nowrap text-accent tabular-nums',
    numMulti: 'items-end pl-2 text-[1.45rem] font-bold whitespace-nowrap text-accent tabular-nums',
    unit: 'min-w-[2.6em] pl-1.5 text-[.95rem] text-soft',

    // sezioni apribili (Fasi, Strumento…)
    section: 'card group p-0',
    summary: "cursor-pointer list-none px-5 py-4 font-bold text-white after:float-right after:text-muted after:content-['▾'] group-open:after:content-['▴'] [&::-webkit-details-marker]:hidden",
    sectionList: 'px-5 pb-2',
    term: 'border-t border-line pt-2.5 text-[.8rem] text-muted first:border-t-0 first:pt-0',
    def: 'mt-0.5 mb-2.5 text-[1.05rem] wrap-anywhere',

    // foto del report
    photo: 'relative aspect-square overflow-hidden rounded-lg border border-edge bg-field',
    photoImg: 'block size-full cursor-pointer object-cover',
    photoDel: 'absolute top-1 right-1 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/70 text-[1rem] text-white',

    // campi generati dal JS (dati predefiniti nelle impostazioni)
    field: 'flex flex-col gap-1.5',
    fieldLabel: 'text-[.85rem] text-muted',
    input: 'input',
    textarea: 'input min-h-[4.2em] resize-y',
    dateInput: 'input min-h-[54px] [color-scheme:dark]',
};

// mette nella pagina, nascosto, un elemento con tutte le classi sopra
export function registerClasses() {
    const all = [MSG, ...Object.values(MSG_TYPES), ...Object.values(BADGES), ...Object.values(CLS)].join(' ');
    const holder = document.createElement('div');
    holder.hidden = true;
    holder.setAttribute('aria-hidden', 'true');
    holder.className = all;
    document.body.append(holder);
}
