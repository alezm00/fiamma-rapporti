// I canali di misura del QR: righe (un valore per canale) e colonne (Media, Min, Max…), con le conversioni di unità.

import { CHANNELS, PRESSURE_PA, PRESSURE_DEC, STAT_LABELS } from './labels.js';
import { formatNumber, humanize } from './format.js';

const INVALID = 4294967295; // valore usato da Testo per "----" (nessuna misura)

export function kv(list) {
    const out = {};
    if (Array.isArray(list)) for (const item of list) if (item && item.name != null) out[item.name] = item.value;
    return out;
}

function findDef(ch, ad) {
    const keys = [ad.measType, ch.type?.name, ch.type?.xmlid].filter((k) => typeof k === 'string' && k);
    for (const def of CHANNELS) if (keys.some((k) => def.re.test(k))) return def;
    return null;
}

function convert(value, from, to) {
    if (!to || from === to) return value;
    if (from in PRESSURE_PA && to in PRESSURE_PA) return (value * PRESSURE_PA[from]) / PRESSURE_PA[to];
    const t = { '°C': (c) => c, '°F': (c) => (c * 9) / 5 + 32, K: (c) => c + 273.15 };
    const toC = { '°C': (x) => x, '°F': (x) => ((x - 32) * 5) / 9, K: (x) => x - 273.15 };
    if (from in toC && to in t) return t[to](toC[from](value));
    return null;
}

// Testo mette in "description" il valore già formattato ("23,7", "----")
// oppure, nei formati più recenti, il nome della statistica ("TotalMean").
const isFormatted = (d) => typeof d === 'string' && /^\s*([-+]?[\d.,]+|-{2,})\s*$/.test(d);

function isInvalid(v) {
    return v.value == null || v.value === INVALID || (typeof v.value === 'number' && !isFinite(v.value)) ||
        /invalid|overrange|underrange|empty/i.test(v.status || '') || /^\s*-{2,}\s*$/.test(v.description || '');
}

function valueText(v, def, baseUnit, unit) {
    if (isInvalid(v)) return '----';
    let num = v.value;
    if (typeof num !== 'number') num = Number(String(num).replace(',', '.'));
    if (isNaN(num)) return String(v.value);
    const converted = unit !== baseUnit ? convert(num, baseUnit, unit) : null;
    // senza conversione il testo formattato dallo strumento è già quello del display
    if (converted == null && isFormatted(v.description)) return v.description.trim();
    const outUnit = converted != null ? unit : baseUnit;
    let dec;
    if (converted == null && Number.isInteger(v.exponent)) dec = Math.min(Math.abs(v.exponent), 6);
    else if (def && def.dec != null) dec = def.dec;
    else if (outUnit in PRESSURE_DEC) dec = PRESSURE_DEC[outUnit];
    return formatNumber(converted ?? num, dec);
}

export function buildChannels(channels) {
    const rows = [];
    const columns = [];
    (channels || []).forEach((ch, index) => {
        if (!ch || !Array.isArray(ch.values)) return;
        const ad = kv(ch.additionalData);
        if (ad.visible === false) return;
        const def = findDef(ch, ad);
        const baseUnit = ch.unit?.name ?? '';
        const displayUnit = ad.displayUnit || baseUnit;
        const canConvert = convert(1, baseUnit, displayUnit) != null;
        const unit = canConvert ? displayUnit : baseUnit;

        // etichetta letta dal valore (es. prova di tenuta: "P Start")
        const valueType = ch.values.map((v) => kv(v.additionalData).valueType ?? v.additionalData?.find?.((a) => a.name === 'valueType')?.description).find(Boolean);
        const code = ad.description || ch.type?.description || '';
        const label = def?.label || valueType || ch.type?.description || ad.description || humanize(ad.measType || ch.type?.name || `Canale ${index + 1}`);
        const short = def ? def.short : (code !== label ? code : '');

        // valori: statistiche con nome (Media/Min/Max...) oppure l'ultima lettura
        const named = ch.values.filter((v) => typeof v.description === 'string' && !isFormatted(v.description) && v.description.trim());
        const cells = {};
        if (named.length) {
            for (const v of named) {
                const col = STAT_LABELS[v.description] || humanize(v.description);
                if (!columns.includes(col)) columns.push(col);
                cells[col] = valueText(v, def, baseUnit, unit);
            }
        } else {
            const v = ch.values[ch.values.length - 1];
            if (!columns.includes('')) columns.push('');
            cells[''] = valueText(v, def, baseUnit, unit);
        }
        const order = def ? CHANNELS.indexOf(def) : CHANNELS.length;
        rows.push({ key: `${def?.id || code || 'ch'}|${unit}|${index}`, id: def?.id || null, label, short, unit, cells, order, index });
    });
    rows.sort((a, b) => a.order - b.order || a.index - b.index);

    // "Media" prima di Min/Max; la colonna senza nome solo se è l'unica
    columns.sort((a, b) => (a === 'Media' ? -1 : b === 'Media' ? 1 : 0));
    let cols = columns.length > 1 ? columns.filter((c) => c !== '') : columns;
    for (const row of rows) {
        if (cols.length && !cols.some((c) => c in row.cells) && '' in row.cells) row.cells[cols[0]] = row.cells[''];
    }
    return { rows, columns: cols };
}
