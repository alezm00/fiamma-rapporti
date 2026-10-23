// Apparecchi dell'impianto: caldaie, pompe di calore, condizionatori (quanti si vuole).
// Solo logica, senza accesso al database né al DOM.

import { formatDay } from '../lib/dates.js';
import { newId, isId, text, isObject, labelIn } from './values.js';

const opt = (...labels) => labels.map((label) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label }));

export const CHAMBERS = [
    { id: 'aperta', label: 'Aperta' },
    { id: 'forzata', label: 'Forzata' },
];

export const TECHNOLOGIES = [
    { id: 'condensazione', label: 'A condensazione' },
    { id: 'tradizionale', label: 'Tradizionale' },
];

export const FUELS = [
    { id: 'metano', label: 'Metano' },
    { id: 'gpl', label: 'GPL' },
    { id: 'gasolio', label: 'Gasolio' },
];

export const HEAT_PUMP_TYPES = opt('Aria-acqua', 'Aria-aria', 'Acqua-acqua', 'Geotermica');
export const AC_TYPES = opt('Monosplit', 'Multisplit', 'Canalizzato', 'Cassetta', 'Altro');
export const REFRIGERANTS = opt('R32', 'R410A', 'R290', 'R134a', 'R407C', 'R454B', 'R744', 'Altro');

// Campi: key (nel rapporto), label, e secondo i casi options (menu), date, decimal, unit (kW, kg…).
const COMMON_FIELDS = [
    { key: 'brand', label: 'Marca' },
    { key: 'model', label: 'Modello' },
    { key: 'serial', label: 'Matricola / codice' },
    { key: 'installDate', label: 'Data di installazione', date: true },
];
const REFRIGERANT_FIELDS = [
    { key: 'refrigerant', label: 'Gas refrigerante', options: REFRIGERANTS },
    { key: 'charge', label: 'Carica di refrigerante', unit: 'kg', decimal: true },
];

export const UNIT_KINDS = [
    {
        id: 'caldaia', label: 'Caldaia', plural: 'caldaie', short: 'caldaia',
        fields: [
            ...COMMON_FIELDS,
            { key: 'fuel', label: 'Combustibile', options: FUELS },
            { key: 'chamber', label: 'Camera di combustione', options: CHAMBERS },
            { key: 'technology', label: 'Tipo di caldaia', options: TECHNOLOGIES },
            { key: 'nominalPower', label: 'Potenza termica nominale', unit: 'kW', decimal: true },
            { key: 'actualPower', label: 'Potenza termica reale', unit: 'kW', decimal: true },
        ],
    },
    {
        id: 'pompa', label: 'Pompa di calore', plural: 'pompe di calore', short: 'pompa di calore',
        fields: [
            ...COMMON_FIELDS,
            { key: 'hpType', label: 'Tipo', options: HEAT_PUMP_TYPES },
            { key: 'nominalPower', label: 'Potenza termica nominale', unit: 'kW', decimal: true },
            { key: 'coolingPower', label: 'Potenza frigorifera', unit: 'kW', decimal: true },
            ...REFRIGERANT_FIELDS,
        ],
    },
    {
        id: 'condizionatore', label: 'Condizionatore', plural: 'condizionatori', short: 'condizionatore',
        fields: [
            ...COMMON_FIELDS,
            { key: 'acType', label: 'Tipo', options: AC_TYPES },
            { key: 'indoorUnits', label: 'Unità interne', decimal: true },
            { key: 'coolingPower', label: 'Potenza frigorifera', unit: 'kW', decimal: true },
            { key: 'nominalPower', label: 'Potenza in riscaldamento', unit: 'kW', decimal: true },
            ...REFRIGERANT_FIELDS,
        ],
    },
];

export const unitKind = (id) => UNIT_KINDS.find((k) => k.id === id);

// un apparecchio nuovo del tipo dato, con i valori indicati (solo i campi di quel tipo)
export function newUnit(kindId, values = {}, id = newId()) {
    const kind = unitKind(kindId);
    const unit = { id, kind: kindId };
    for (const f of kind.fields) unit[f.key] = text(values[f.key], 2000);
    return unit;
}

// "Caldaia", e "Caldaia 1", "Caldaia 2" se ce n'è più di una dello stesso tipo
export function unitTitle(unit, units) {
    const label = unitKind(unit.kind)?.label ?? 'Apparecchio';
    const same = units.filter((u) => u.kind === unit.kind);
    return same.length > 1 ? `${label} ${same.indexOf(unit) + 1}` : label;
}

// "1 caldaia, 2 pompe di calore"
export function unitsSummary(plant) {
    const units = plant?.units ?? [];
    return UNIT_KINDS.map((k) => [k, units.filter((u) => u.kind === k.id).length])
        .filter(([, n]) => n > 0).map(([k, n]) => `${n} ${n === 1 ? k.short : k.plural}`).join(', ');
}

// i campi di un apparecchio pronti da mostrare: [{ label, value }] (menu → etichetta, data → gg/mm/aaaa, kW e kg)
export function unitValues(unit) {
    const kind = unitKind(unit.kind);
    if (!kind) return [];
    return kind.fields.map((f) => {
        let value = String(unit[f.key] ?? '').trim();
        if (f.options) value = labelIn(f.options, value) || value;
        else if (f.date) value = formatDay(value) || value;
        else if (f.unit && /^[\d.,\s]+$/.test(value) && value) value = `${value} ${f.unit}`;
        return { key: f.key, label: f.label, value };
    });
}

// "Beretta Ciao 24"
export const unitName = (unit) => [unit.brand, unit.model].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');

// L'impianto letto da fuori (backup, cartella): targa e apparecchi ripuliti — tipi sconosciuti scartati,
// campi del tipo giusto, identificativi non validi rifatti.
export function normalizePlant(plant) {
    const p = isObject(plant) ? plant : {};
    return {
        plateCode: text(p.plateCode, 2000),
        units: (Array.isArray(p.units) ? p.units : []).slice(0, 50).filter((u) => isObject(u) && unitKind(u.kind))
            .map((u) => newUnit(u.kind, u, isId(u.id) ? u.id : newId())),
    };
}
