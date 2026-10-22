// Classi Tailwind usate dal JavaScript (messaggi, elenchi, risultati, foto, impostazioni).
// Sono definite qui, in un posto solo, e registrate all'avvio: il build "browser" di Tailwind
// crea lo stile solo per le classi presenti nella pagina, e così quello degli elementi
// creati dopo è già pronto (nessun lampo senza stile).

export const MSG = 'rounded border px-3 py-2 text-[.82rem] leading-[1.35]';

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
    // elenco dei rapporti: righe fitte, numeri e date a larghezza fissa
    reportOpen: 'btn flex-col items-stretch gap-0.5 bg-field px-2.5 py-1.5 text-left font-normal',
    reportHead: 'flex items-center justify-between gap-2',
    reportNum: 'font-mono text-[.82rem] font-bold text-white',
    reportName: 'truncate text-[.9rem] text-white',
    reportAddr: 'truncate text-[.78rem] text-soft',
    reportMeta: 'font-mono text-[.7rem] text-muted',
    badge: 'rounded-sm border px-1.5 py-px font-mono text-[.62rem] font-bold tracking-[.06em] whitespace-nowrap uppercase',

    // promemoria nella home (copia di sicurezza)
    reminder: `${MSG} mb-2.5 block w-full cursor-pointer text-left`,

    // materiali del rapporto
    matRow: 'flex gap-1.5',
    matText: 'input min-w-0 flex-1',
    matQty: 'input w-20 flex-none',
    matDel: 'btn w-9 flex-none bg-field px-0 text-[.95rem] text-err-fg',

    // storico delle scansioni (e misure di un rapporto)
    historyRow: 'flex gap-1.5',
    historyOpen: 'btn min-w-0 flex-1 flex-col items-start gap-0.5 bg-field px-2.5 py-1.5 text-left font-normal',
    historyTitle: 'text-[.88rem] font-bold text-white',
    historyMeta: 'font-mono text-[.7rem] text-muted',
    historyVals: 'max-w-full overflow-hidden font-mono text-[.76rem] text-ellipsis whitespace-nowrap text-accent tabular-nums',
    historyDel: 'btn w-9 flex-none bg-field px-0 text-[.95rem] text-err-fg',

    // intestazione del risultato
    headTerm: 'text-muted',
    headDef: 'font-mono font-bold text-white',

    // tabella dei valori: una colonna di valori oppure più colonne (Media, Min, Max…)
    tableSingle: 'grid grid-cols-[1fr_auto_auto]',
    tableMulti: 'grid grid-cols-[repeat(var(--cols),1fr)_auto]',
    tableHead: 'contents',
    tableHeadCell: 'pl-2 text-right font-mono text-[.66rem] tracking-[.06em] text-muted uppercase',
    row: 'contents',
    cell: 'flex flex-col justify-center py-1.5',
    cellLine: 'border-b border-line',
    labelMulti: 'col-span-full flex-row items-baseline justify-start gap-2 pb-0',
    code: 'text-[1rem] font-bold text-white',
    name: 'text-[.7rem] leading-tight text-muted',
    num: 'items-end pl-2 text-[1.65rem] leading-none font-bold whitespace-nowrap text-accent tabular-nums',
    numMulti: 'items-end pl-2 text-[1.2rem] leading-none font-bold whitespace-nowrap text-accent tabular-nums',
    unit: 'min-w-[2.6em] pl-1.5 font-mono text-[.78rem] text-soft',

    // sezioni apribili (Fasi, Strumento…)
    section: 'card group p-0',
    summary: "cursor-pointer list-none px-3 py-2.5 text-[.72rem] font-bold tracking-[.12em] text-white uppercase after:float-right after:text-muted after:content-['▾'] group-open:after:content-['▴'] [&::-webkit-details-marker]:hidden",
    sectionList: 'px-3 pb-1.5',
    term: 'border-t border-line pt-1.5 text-[.68rem] tracking-[.05em] text-muted uppercase first:border-t-0 first:pt-0',
    def: 'mt-0.5 mb-1.5 font-mono text-[.85rem] wrap-anywhere',

    // foto del report
    photo: 'relative aspect-square overflow-hidden rounded border border-edge bg-field',
    photoImg: 'block size-full cursor-pointer object-cover',
    photoDel: 'absolute top-0.5 right-0.5 flex size-6 cursor-pointer items-center justify-center rounded-full bg-black/70 text-[.8rem] text-white',

    // campi generati dal JS (impostazioni)
    field: 'fld',
    fieldWide: 'fld col-span-2',
    fieldLabel: 'lbl',
    input: 'input',
    textarea: 'input min-h-[3.4em] resize-y',
    select: 'input [color-scheme:dark]',
    dateInput: 'input [color-scheme:dark]',
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
