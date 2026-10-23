// Decodifica dei dati Testo (formato TJF) contenuti nel QR del Testo 330
// e preparazione di un "report" generico da mostrare a schermo.
// Schema di riferimento: https://github.com/testo/tjf (slim-schema)

import { formatDate } from '../../lib/dates.js';
import { ERROR_LABELS, APPENDIX_TITLES, CONTACT_LABELS, POINT_LABELS, DEVICE_LABELS, PROP_LABELS, KNOWN_KEYS } from './labels.js';
import { formatScalar, humanize, toDate } from './format.js';
import { buildChannels } from './channels.js';
import { propertyItems, additionalItems, objectItems, appendixItems, phaseItems } from './items.js';

export { formatNumber, toDate } from './format.js';

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
