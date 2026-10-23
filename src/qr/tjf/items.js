// Proprietà e informazioni della misura (fasi della prova, risultati, dati dello strumento…) come elenchi etichetta/valore.

import { PROP_LABELS, PROP_UNITS, APPENDIX_LABELS } from './labels.js';
import { formatTime } from '../../lib/dates.js';
import { formatSeconds, formatScalar, numberWithUnit, humanize, toDate } from './format.js';

// properties / results: [{ name, description, values: [{ name, id, value, description, unit }] }]
export function propertyItems(list) {
    const items = [];
    for (const p of list || []) {
        if (!p || typeof p !== 'object') continue;
        const values = Array.isArray(p.values) ? p.values : [];
        if (p.description && p.description !== p.name && (values.length !== 1 || values[0]?.name)) {
            items.push({ key: p.name, label: PROP_LABELS[p.name] || humanize(p.name), value: p.description });
        }
        if (values.length === 1 && !values[0].name && !values[0].id) {
            const v = values[0];
            items.push({ key: p.name, label: PROP_LABELS[p.name] || humanize(p.name), value: formatScalar(p.name, v.value, v.unit || PROP_UNITS[p.name]), raw: v.value });
        } else {
            for (const v of values) {
                const key = v.id || v.name || p.name;
                const label = PROP_LABELS[v.id] || PROP_LABELS[v.name] || v.name || humanize(key);
                const value = v.description ? numberWithUnit(v.description) : formatScalar(key, v.value, v.unit || PROP_UNITS[key]);
                items.push({ key, label, value, raw: v.value });
            }
        }
    }
    return items;
}

// additionalMeasurementInformation: [{ name, value, description }]
export function additionalItems(list) {
    const items = [];
    for (const a of list || []) {
        if (!a || a.name == null) continue;
        let value = a.value;
        // measurementuuid ha il valore in "description"
        if (value == null && a.description) value = a.description;
        items.push({ key: a.name, label: PROP_LABELS[a.name] || humanize(a.name), value: formatScalar(a.name, value), raw: value });
    }
    return items;
}

export function objectItems(obj, labels, skip = []) {
    const items = [];
    if (!obj || typeof obj !== 'object') return items;
    for (const [k, v] of Object.entries(obj)) {
        if (skip.includes(k) || v == null || v === '' || typeof v === 'object') continue;
        items.push({ key: k, label: labels[k] || humanize(k), value: formatScalar(k, v) });
    }
    return items;
}

export function appendixItems(obj) {
    const items = [];
    for (const [k, v] of Object.entries(obj || {})) {
        if (v == null || k === 'timeStamp') continue;
        let value;
        if (typeof v === 'object') value = v.description || formatScalar(k, v.value, v.unit);
        else value = formatScalar(k, v);
        items.push({ key: k, label: APPENDIX_LABELS[k] || humanize(k), value });
    }
    return items;
}

export function phaseItems(items) {
    const phases = {};
    for (const it of items) {
        const m = /^(Start|End)(?:Time)?Phase(\d+)$/i.exec(it.key || '');
        if (!m) continue;
        const d = toDate(it.raw);
        if (!d) continue;
        (phases[m[2]] ||= {})[m[1].toLowerCase()] = d;
    }
    return Object.keys(phases).sort((a, b) => a - b).map((n) => {
        const { start, end } = phases[n];
        const range = [start && formatTime(start), end && formatTime(end)].filter(Boolean).join(' → ');
        const duration = start && end ? formatSeconds(end - start) : '';
        return { key: `phase${n}`, label: `Fase ${n}`, value: duration ? `${range}  (${duration})` : range, range, duration };
    });
}
