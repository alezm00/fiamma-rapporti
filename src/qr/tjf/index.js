// Decodifica dei dati Testo (formato TJF) contenuti nel QR del Testo 330
// e preparazione di un "report" generico da mostrare a schermo.
// Schema di riferimento: https://github.com/testo/tjf (slim-schema)

import { pad, formatDate, formatTime } from '../../lib/dates.js';

const INVALID = 4294967295; // valore usato da Testo per "----" (nessuna misura)

// ---------------------------------------------------------------------------
// Byte del QR -> oggetto JSON
// ---------------------------------------------------------------------------

export async function bytesToJson(bytes) {
    let data = bytes;
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) data = await inflate(bytes, 'gzip');
    else if (bytes[0] === 0x78 && (bytes[0] * 256 + bytes[1]) % 31 === 0) data = await inflate(bytes, 'deflate');
    const text = new TextDecoder('utf-8').decode(data).replace(/^﻿/, '');
    return JSON.parse(text);
}

async function inflate(bytes, format) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---------------------------------------------------------------------------
// Canali conosciuti (etichette in italiano, ordine di visualizzazione, decimali)
// ---------------------------------------------------------------------------

// L'ordine dell'array è l'ordine con cui i valori vengono mostrati.
// "re" viene confrontata con measType, type.name e type.xmlid del canale.
const CHANNELS = [
    { id: 'TF', label: 'Temperatura fumi', short: 'TF', dec: 1, re: /^(FT|T_Flue)$|flue.?gas.?temp/i },
    { id: 'TA', label: 'Temperatura aria comburente', short: 'TA', dec: 1, re: /^(AT|T_Air)$|ambient.?temp|air.?temp/i },
    { id: 'O2', label: 'Ossigeno', short: 'O₂', dec: 1, re: /^O2$|oxygen/i },
    { id: 'CO2', label: 'Anidride carbonica', short: 'CO₂', dec: 1, re: /^CO2$|carbon.?dioxid/i },
    { id: 'uCO', label: 'CO non diluito', short: 'COnd', dec: 0, re: /^(uCO|CO_Norm|COunv)$|undilut/i },
    { id: 'COamb', label: 'CO ambiente', short: 'COamb', dec: 0, re: /ambient.?co\b|co.?ambient/i },
    { id: 'CO', label: 'Monossido di carbonio', short: 'CO', dec: 0, re: /^(CO|CO_Dil)$|carbon.?monoxid/i },
    { id: 'eta', label: 'Rendimento', short: 'η', dec: 1, re: /^(Eff[gn]?|Efficiency)$|efficien/i },
    { id: 'qA', label: 'Perdite fumi', short: 'qA', dec: 1, re: /^qA|flue.?gas.?loss|^loss/i },
    { id: 'lambda', label: "Eccesso d'aria", short: 'λ', dec: 2, re: /^(λ|Lambda)$|excess.?air|lambda/i },
    { id: 'NOx', label: 'Ossidi di azoto', short: 'NOx', dec: 0, re: /^NOx$|nox/i },
    { id: 'NO2', label: 'Biossido di azoto', short: 'NO₂', dec: 0, re: /^NO2$|nitrogen.?dioxid/i },
    { id: 'NO', label: 'Monossido di azoto', short: 'NO', dec: 0, re: /^(NO|NO_Dil)$|nitrogen.?monoxid/i },
    { id: 'draught', label: 'Tiraggio', short: 'Tir.', re: /draught|draft/i },
    { id: 'dew', label: 'Temperatura di rugiada', short: 'Trug', dec: 1, re: /dew/i },
    { id: 'dP', label: 'Pressione differenziale', short: 'ΔP', re: /differential.?pressure|^dP$/i },
    { id: 'P', label: 'Pressione', short: 'P', re: /pressure/i },
    { id: 'Tinst', label: 'Temperatura strumento', short: 'T str.', dec: 1, re: /^(Itemp|GT)$|instrument.?temp|internal.?temp/i },
];

const PRESSURE_PA = { Pa: 1, hPa: 100, mbar: 100, kPa: 1000, bar: 1e5, MPa: 1e6, psi: 6894.757, inH2O: 249.0889, mmH2O: 9.80665, inHg: 3386.39, mmHg: 133.322 };
const PRESSURE_DEC = { Pa: 1, hPa: 2, mbar: 2, kPa: 3, bar: 3, MPa: 4, psi: 3, inH2O: 3, mmH2O: 1, inHg: 3, mmHg: 1 };

// Nomi delle statistiche presenti in values[].description (formato testo 400 / 330 nuovo)
const STAT_LABELS = {
    TotalMean: 'Media', TotalMinimum: 'Min', TotalMaximum: 'Max',
    Mean: 'Media', Minimum: 'Min', Maximum: 'Max', Current: 'Attuale',
};

// ---------------------------------------------------------------------------
// Etichette per proprietà, informazioni aggiuntive e contatti
// ---------------------------------------------------------------------------

const PROP_LABELS = {
    Fuel: 'Combustibile', CurrentFuelName: 'Combustibile', CurrentFuelId: 'ID combustibile',
    O2Ref: 'O₂ rif.', 'O₂-Bezug': 'O₂ rif.', CO2Max: 'CO₂ max',
    MeasurementType: 'Modalità misura', MeasCycle: 'Ciclo di misura', ProbeProblem: 'Problemi sonda',
    measurementuuid: 'ID misura', appVersion: 'Versione app', note: 'Note',
    startTime: 'Inizio', endTime: 'Fine', deviceTime: 'Ora strumento',
    stabilisationTime: 'Tempo di stabilizzazione', testTime: 'Durata prova',
};
const PROP_UNITS = { O2Ref: '%', 'O₂-Bezug': '%', CO2Max: '%' };
const VALUE_LABELS = { Continuous: 'Continua', NoProblem: 'Nessuno', true: 'Sì', false: 'No' };

const DEVICE_LABELS = {
    name: 'Strumento', serial: 'N. di serie', deviceIdentifier: 'Identificativo', partNumber: 'Codice',
    firmwareVersion: 'Firmware', softwareVersion: 'Software', lastServiceDate: 'Ultima assistenza',
    measCycle: 'Ciclo di misura (ms)', boardIndex: 'Modulo',
};
const CONTACT_LABELS = {
    name: 'Nome', personOfContact: 'Referente', street: 'Via', houseNumber: 'N. civico', postalCode: 'CAP',
    city: 'Città', country: 'Paese', phone: 'Telefono', fax: 'Fax', email: 'Email', homepage: 'Sito web',
};
const POINT_LABELS = {
    name: 'Nome', systemNumber: 'N. impianto', systemType: 'Tipo impianto', systemManufacturer: 'Costruttore',
    systemSerial: 'Matricola', yearOfConstruction: 'Anno di costruzione', notes: 'Note',
};
const APPENDIX_LABELS = {
    smokeNumber1: 'Bacharach 1', smokeNumber2: 'Bacharach 2', smokeNumber3: 'Bacharach 3',
    calculatedSmokeNumber: 'Bacharach medio', smokePumpId: 'Pompa fumi', isOilDerivative: 'Derivati olio',
    heatCarrierTemperature: 'Temperatura vettore termico',
    gasAmount: 'Quantità gas', heatingValue: 'Potere calorifico', duration: 'Durata (s)', gasFlowRate: 'Portata gas',
    burnerCapacityNet: 'Potenza bruciatore (netta)', burnerCapacityGross: 'Potenza bruciatore (lorda)',
    flowRate: 'Portata olio', oilPressure: 'Pressione olio', burnerCapacity: 'Potenza bruciatore',
};
const APPENDIX_TITLES = { smokeNumber: 'Indice di fumo', gasFlow: 'Portata gas', oilFlow: 'Portata olio' };
const ERROR_LABELS = {
    TjfError_NoMeasurementsAvailable: 'Nessun risultato di misura disponibile',
    TjfError_NoMeasurementDeviceConnected: 'Nessuno strumento di misura collegato',
};
const KNOWN_KEYS = new Set([
    '$schema', 'schemaVersion', 'channels', 'device', 'customer', 'organisation', 'organization', 'measuringPoint',
    'properties', 'results', 'timeStamp', 'type', 'additionalMeasurementInformation', 'images', 'snapshots',
    'appendix', 'errors',
]);

// ---------------------------------------------------------------------------
// Formattazione
// ---------------------------------------------------------------------------

export function formatNumber(n, dec) {
    if (dec == null) {
        // elimina il rumore dei float (23.700000762939453 -> 23.7)
        n = Number(n.toPrecision(7));
        return n.toLocaleString('it-IT', { maximumFractionDigits: 3, useGrouping: false });
    }
    const s = n.toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: false });
    return /^-0(,0*)?$/.test(s) ? s.slice(1) : s; // niente "-0,0"
}

function formatDuration(ms) {
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

function isTimestampKey(key) {
    return /time|date|phase/i.test(key) && !/cycle|duration|testTime|stabilisation/i.test(key);
}

function formatScalar(key, v, unit) {
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
function numberWithUnit(text) {
    const m = /^\s*(-?\d+)(?:[.,](\d+))?\s*(.*)$/.exec(text);
    if (!m) return text;
    return (m[2] ? `${m[1]},${m[2]}` : m[1]) + (m[3] ? ` ${m[3]}` : '');
}

const humanize = (key) => String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');

// ---------------------------------------------------------------------------
// Canali
// ---------------------------------------------------------------------------

function kv(list) {
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

function buildChannels(channels) {
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

// ---------------------------------------------------------------------------
// Proprietà / info
// ---------------------------------------------------------------------------

// properties / results: [{ name, description, values: [{ name, id, value, description, unit }] }]
function propertyItems(list) {
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
function additionalItems(list) {
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

function objectItems(obj, labels, skip = []) {
    const items = [];
    if (!obj || typeof obj !== 'object') return items;
    for (const [k, v] of Object.entries(obj)) {
        if (skip.includes(k) || v == null || v === '' || typeof v === 'object') continue;
        items.push({ key: k, label: labels[k] || humanize(k), value: formatScalar(k, v) });
    }
    return items;
}

function appendixItems(obj) {
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

function phaseItems(items) {
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
        const duration = start && end ? formatDuration(end - start) : '';
        return { key: `phase${n}`, label: `Fase ${n}`, value: duration ? `${range}  (${duration})` : range, range, duration };
    });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export function buildReport(tjf) {
    if (!tjf || typeof tjf !== 'object' || Array.isArray(tjf)) throw new Error('Formato dati non riconosciuto');

    const errors = (tjf.errors || []).map((e) => ERROR_LABELS[e.name] || e.description || e.name || 'Errore');
    const { rows, columns } = buildChannels(tjf.channels);

    const info = additionalItems(tjf.additionalMeasurementInformation);
    const props = propertyItems(tjf.properties);
    const results = propertyItems(tjf.results);
    const infoMap = Object.fromEntries([...info, ...props].map((it) => [it.key, it]));

    // data della prova: inizio misura, altrimenti timeStamp del file
    const start = toDate(infoMap.startTime?.raw) || toDate(tjf.timeStamp);
    const end = toDate(infoMap.endTime?.raw);

    const title = tjf.type?.name || (errors.length ? 'Errore' : 'Misura');
    const header = [];
    const fuel = infoMap.CurrentFuelName || infoMap.Fuel;
    if (fuel) header.push({ label: 'Combustibile', value: fuel.value });
    for (const k of ['O2Ref', 'O₂-Bezug', 'CO2Max']) {
        if (infoMap[k] && !header.some((h) => h.label === infoMap[k].label)) header.push({ label: infoMap[k].label, value: infoMap[k].value });
    }
    const note = infoMap.note?.value;

    const phases = phaseItems(props);
    const used = new Set(['CurrentFuelName', 'Fuel', 'O2Ref', 'O₂-Bezug', 'CO2Max', 'note']);
    const isPhase = (it) => /^(Start|End)(Time)?Phase\d+$/i.test(it.key || '');

    const sections = [];
    const add = (title, items) => { items = items.filter((it) => it.value !== ''); if (items.length) sections.push({ title, items }); };
    add('Fasi della prova', phases);
    add('Risultati', results);
    for (const [k, v] of Object.entries(tjf.appendix || {})) add(APPENDIX_TITLES[k] || humanize(k), appendixItems(v));
    add('Dati prova', [
        ...(tjf.type?.id ? [{ key: 'typeId', label: 'Tipo prova', value: tjf.type.id }] : []),
        ...props.filter((it) => !used.has(it.key) && !isPhase(it)),
        ...info.filter((it) => !used.has(it.key) && it.key !== 'measurementuuid'),
    ]);
    add('Punto di misura', objectItems(tjf.measuringPoint, POINT_LABELS));
    add('Cliente', objectItems(tjf.customer, CONTACT_LABELS));
    add('Azienda', objectItems(tjf.organisation || tjf.organization, CONTACT_LABELS, ['logo']));
    const devices = Array.isArray(tjf.device) ? tjf.device : tjf.device ? [tjf.device] : [];
    devices.forEach((d, i) => {
        const items = objectItems(d, DEVICE_LABELS);
        for (const a of d.additionalData || []) {
            if (a && a.value != null && a.value !== '' && typeof a.value !== 'object') items.push({ key: a.name, label: PROP_LABELS[a.name] || humanize(a.name), value: formatScalar(a.name, a.value, a.unit) });
        }
        add(devices.length > 1 ? `Strumento ${i + 1}` : 'Strumento', items);
    });
    const other = [];
    for (const [k, v] of Object.entries(tjf)) {
        if (KNOWN_KEYS.has(k) || v == null) continue;
        other.push({ key: k, label: humanize(k), value: typeof v === 'object' ? JSON.stringify(v) : formatScalar(k, v) });
    }
    add('Altri dati', other);

    const uuid = infoMap.measurementuuid?.raw || null;
    return { title, typeId: tjf.type?.id || null, start, end, header, note, rows, columns, sections, errors, uuid };
}

// Testo semplice (per "Copia")
export function reportToText(r) {
    const lines = [r.title];
    if (r.start) lines.push(formatDate(r.start));
    for (const h of r.header) lines.push(`${h.label}: ${h.value}`);
    lines.push('');
    for (const row of r.rows) {
        const vals = r.columns.map((c) => (row.cells[c] ?? '') + (c && r.columns.length > 1 ? ` (${c})` : '')).join('  ');
        lines.push(`${row.short ? row.short + ' ' : ''}${row.short === row.label ? '' : row.label}: ${vals} ${row.unit}`.replace(/\s+$/, '').replace(/ {2,}/g, ' '));
    }
    return lines.join('\n');
}

// I primi valori di una misura, per le anteprime negli elenchi: "TF 120,5 · O₂ 4,1"
export function topValues(report, n = 4) {
    const column = report.columns[0];
    return report.rows.slice(0, n).map((r) => `${r.short || r.label} ${r.cells[column] ?? ''}`).join(' · ');
}
