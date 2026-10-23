// Formattazione dei valori del Testo (numeri con la virgola, date, durate, nomi leggibili).

import { pad, formatDate } from '../../lib/dates.js';
import { VALUE_LABELS } from './labels.js';

export function formatNumber(n, dec) {
    if (dec == null) {
        // elimina il rumore dei float (23.700000762939453 -> 23.7)
        n = Number(n.toPrecision(7));
        return n.toLocaleString('it-IT', { maximumFractionDigits: 3, useGrouping: false });
    }
    const s = n.toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: false });
    return /^-0(,0*)?$/.test(s) ? s.slice(1) : s; // niente "-0,0"
}

export function formatSeconds(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s} s`;
    return `${Math.floor(s / 60)} min ${pad(s % 60)} s`;
}

// Converte timestamp unix (s o ms, anche come stringa) o date ISO in Date
export function toDate(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim())) v = Number(v);
    if (typeof v === 'number') {
        if (v > 1e11) return new Date(v);        // millisecondi
        if (v > 1e8) return new Date(v * 1000);  // secondi
        return null;
    }
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null; // solo date ISO
    const d = new Date(v);
    return isNaN(d) ? null : d;
}

export function isTimestampKey(key) {
    return /time|date|phase/i.test(key) && !/cycle|duration|testTime|stabilisation/i.test(key);
}

export function formatScalar(key, v, unit) {
    if (v == null || v === '') return '';
    if (isTimestampKey(key)) {
        const d = toDate(v);
        if (d && d.getFullYear() > 2000) return formatDate(d, true);
    }
    if (typeof v === 'boolean') return VALUE_LABELS[v];
    if (typeof v === 'object') return JSON.stringify(v);
    let text = VALUE_LABELS[v] ?? String(v);
    if (typeof v === 'number') text = formatNumber(v);
    else if (/^-?\d+\.\d+$/.test(text)) text = text.replace('.', ',');
    return unit && !text.endsWith(unit) ? `${text} ${unit}` : text;
}

// "15.4%" -> "15,4 %"
export function numberWithUnit(text) {
    const m = /^\s*(-?\d+)(?:[.,](\d+))?\s*(.*)$/.exec(text);
    if (!m) return text;
    return (m[2] ? `${m[1]},${m[2]}` : m[1]) + (m[3] ? ` ${m[3]}` : '');
}

export const humanize = (key) => String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
