// Logica dei rapporti: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    newReport, applyEdit, duplicateReport, closeReport, markSent, setNextNumber, nextNumber, formatNumber,
    durationMinutes, formatDuration, filterReports, sortReports, nextMeasureLabel, addMeasure, groupMeasures, reportLabel,
} from '../model.js';

const at = (y, m, d, h = 10, min = 0) => new Date(y, m - 1, d, h, min);

// misura Testo minima ma realistica (formato TJF)
const channel = (measType, unit, value, desc = measType) => ({
    additionalData: [{ name: 'measType', value: measType }, { name: 'displayUnit', value: unit }],
    type: { name: measType, description: desc },
    unit: { name: unit },
    values: [{ description: 'TotalMean', timeStamp: '1', value }],
});
const tjf = (typeId, typeName, channels) => ({ type: { id: typeId, name: typeName }, timeStamp: '1792689281', channels });
const combustion = (tf, o2, co) => tjf('val_10389_1', 'Media (UNI 10389-1)', [
    channel('FluegasTemperature', '°C', tf), channel('Oxygen', '%', o2), channel('CarbonMonoxide', 'ppm', co),
]);

test('nuovo rapporto: bozza con i dati predefiniti', () => {
    const r = newReport({ now: at(2026, 10, 22), id: 'a', defaults: { name: 'Condominio Rossi', brand: 'Beretta', notes: 'Manutenzione ordinaria.', model: 'Ciao 24', fuel: 'metano', chamber: 'forzata', nominalPower: '24' } });
    assert.deepEqual([r.plant.model, r.plant.fuel, r.plant.chamber, r.plant.technology, r.plant.nominalPower, r.plant.actualPower], ['Ciao 24', 'metano', 'forzata', '', '24', '']);
    assert.equal(r.status, 'draft');
    assert.equal(r.number, null);
    assert.equal(r.date, '2026-10-22');
    assert.equal(r.customer.name, 'Condominio Rossi');
    assert.equal(r.plant.brand, 'Beretta');
    assert.equal(r.intervention.notes, 'Manutenzione ordinaria.');
    assert.deepEqual(r.measures, []);
    assert.equal(reportLabel(r), 'Bozza');
});

test('chiusura: numero progressivo per anno, assegnato una sola volta', () => {
    let counters = {};
    const a = newReport({ now: at(2026, 3, 1), id: 'a' });
    const b = newReport({ now: at(2026, 3, 2), id: 'b' });
    const old = newReport({ now: at(2025, 12, 30), id: 'c' });
    counters = closeReport(a, counters, at(2026, 3, 1));
    counters = closeReport(b, counters, at(2026, 3, 2));
    counters = closeReport(old, counters, at(2026, 3, 2)); // anno della data dell'intervento, non della chiusura
    assert.equal(a.number, '2026/001');
    assert.equal(b.number, '2026/002');
    assert.equal(old.number, '2025/001');
    assert.deepEqual(counters, { 2026: 2, 2025: 1 });
    assert.equal(a.status, 'done');
    assert.ok(a.closedAt);
    // già chiuso: nessun cambiamento
    const again = closeReport(a, counters, at(2026, 4, 1));
    assert.equal(again, counters);
    assert.equal(a.number, '2026/001');
    assert.equal(reportLabel(a), 'n. 2026/001');
});

test('prossimo numero modificabile', () => {
    let counters = setNextNumber({}, 2026, 45);
    assert.equal(nextNumber(counters, 2026), 45);
    const r = newReport({ now: at(2026, 5, 5), id: 'a' });
    counters = closeReport(r, counters, at(2026, 5, 5));
    assert.equal(r.number, '2026/045');
    assert.equal(formatNumber(2026, 7), '2026/007');
    assert.equal(setNextNumber({}, 2026, 'x')[2026], 0); // valore non valido: riparte da 1
});

test('stati: modificare un rapporto inviato lo riporta a completato', () => {
    const r = newReport({ now: at(2026, 1, 1), id: 'a' });
    assert.equal(markSent(r), false, 'una bozza non diventa "inviata"');
    assert.equal(r.status, 'draft');
    closeReport(r, {}, at(2026, 1, 1));
    assert.equal(markSent(r, at(2026, 1, 2)), true);
    assert.equal(r.status, 'sent');
    assert.equal(r.sentAt, at(2026, 1, 2).getTime());
    applyEdit(r, at(2026, 1, 3));
    assert.equal(r.status, 'done');
    assert.equal(r.updatedAt, at(2026, 1, 3).getTime());
    const draft = newReport({ now: at(2026, 1, 1), id: 'b' });
    applyEdit(draft);
    assert.equal(draft.status, 'draft');
});

test('duplica: copia cliente e impianto, non il resto', () => {
    const r = newReport({ now: at(2026, 1, 1), id: 'a' });
    r.customer.name = 'Mario Rossi';
    r.plant.serial = 'AB123';
    r.intervention.work = 'Pulizia';
    addMeasure(r, combustion(60, 4, 10));
    const copy = duplicateReport(r, { now: at(2026, 6, 1), id: 'b' });
    assert.equal(copy.id, 'b');
    assert.equal(copy.status, 'draft');
    assert.equal(copy.number, null);
    assert.equal(copy.date, '2026-06-01');
    assert.equal(copy.customer.name, 'Mario Rossi');
    assert.equal(copy.plant.serial, 'AB123');
    assert.equal(copy.intervention.work, '');
    assert.deepEqual(copy.measures, []);
    copy.customer.name = 'Altro';
    assert.equal(r.customer.name, 'Mario Rossi', 'nessun dato condiviso con l\'originale');
});

test('durata tra arrivo e partenza', () => {
    assert.equal(durationMinutes('08:30', '10:00'), 90);
    assert.equal(durationMinutes('23:00', '01:30'), 150, 'oltre la mezzanotte');
    assert.equal(durationMinutes('', '10:00'), null);
    assert.equal(durationMinutes('8:05', '8:05'), 0);
    assert.equal(formatDuration(90), '1 h 30 min');
    assert.equal(formatDuration(45), '45 min');
    assert.equal(formatDuration(120), '2 h 00 min');
    assert.equal(formatDuration(null), '');
});

test('elenco: ricerca senza accenti, più parole, stato, ordine', () => {
    const mk = (id, date, name, extra = {}) => {
        const r = newReport({ now: at(...date), id });
        r.customer.name = name;
        Object.assign(r.plant, extra.plant);
        Object.assign(r.customer, extra.customer);
        if (extra.status) r.status = extra.status;
        if (extra.number) r.number = extra.number;
        return r;
    };
    const list = [
        mk('1', [2026, 1, 10], 'Maria Zanutta', { customer: { address: 'Via Roma 1, Udine' }, status: 'done', number: '2026/001' }),
        mk('2', [2026, 3, 5], 'Renzo Čok', { plant: { plateCode: '06BD529A822E2B20' }, status: 'sent', number: '2026/002' }),
        mk('3', [2026, 3, 5], 'Anna Verdi', { plant: { serial: 'XY-99', brand: 'Vaillant' } }),
    ];
    list[2].updatedAt += 1000; // a pari data vince la modifica più recente
    assert.deepEqual(sortReports(list).map((r) => r.id), ['3', '2', '1']);
    const ids = (q, status) => filterReports(list, { query: q, status }).map((r) => r.id);
    assert.deepEqual(ids('zanuta'), [], 'una lettera diversa non trova nulla');
    assert.deepEqual(ids('zanutta'), ['1']);
    assert.deepEqual(ids('COK'), ['2'], 'senza accenti e maiuscole');
    assert.deepEqual(ids('udine roma'), ['1'], 'tutte le parole');
    assert.deepEqual(ids('06bd529a'), ['2'], 'targa');
    assert.deepEqual(ids('vaillant xy-99'), ['3'], 'marca e matricola');
    assert.deepEqual(ids('2026/002'), ['2'], 'numero');
    assert.deepEqual(ids('', 'sent'), ['2']);
    assert.deepEqual(ids('', 'draft'), ['3']);
    assert.equal(ids('').length, 3);
});

test('etichette delle misure', () => {
    assert.equal(nextMeasureLabel([]), 'Prima');
    assert.equal(nextMeasureLabel([1]), 'Dopo');
    assert.equal(nextMeasureLabel([1, 2]), 'Misura 3');
    const r = newReport({ now: at(2026, 1, 1), id: 'a' });
    assert.equal(addMeasure(r, combustion(60, 4, 10)).label, 'Prima');
    assert.equal(addMeasure(r, combustion(58, 3, 8), { label: 'Dopo regolazione' }).label, 'Dopo regolazione');
    assert.equal(r.measures.length, 2);
});

test('misure dello stesso tipo: confronto affiancato', () => {
    const r = newReport({ now: at(2026, 1, 1), id: 'a' });
    addMeasure(r, combustion(62.8, 4.3, 12), { label: 'Prima' });
    addMeasure(r, tjf('val_10389_1', 'Media (UNI 10389-1)', [channel('Oxygen', '%', 3.1), channel('FluegasTemperature', '°C', 58.4), channel('NO', 'ppm', 7)]), { label: 'Dopo' });
    const blocks = groupMeasures(r.measures);
    assert.equal(blocks.length, 1);
    const [b] = blocks;
    assert.equal(b.kind, 'compare');
    assert.deepEqual(b.table.columns, ['Prima', 'Dopo']);
    const byShort = Object.fromEntries(b.table.rows.map((row) => [row.short, row.values]));
    assert.deepEqual(byShort.TF, ['62,8', '58,4']);
    assert.deepEqual(byShort['O₂'], ['4,3', '3,1']);
    assert.deepEqual(byShort.CO, ['12', ''], 'canale presente solo in una misura: cella vuota');
    assert.deepEqual(byShort.NO, ['', '7']);
    // ordine dei canali come nella stampa Testo: temperatura fumi prima di O₂
    const order = b.table.rows.map((row) => row.short);
    assert.ok(order.indexOf('TF') < order.indexOf('O₂'));
});

test('misure di tipo diverso o a più colonne: una tabella ciascuna', () => {
    const r = newReport({ now: at(2026, 1, 1), id: 'a' });
    addMeasure(r, combustion(60, 4, 10), { label: 'Prima' });
    addMeasure(r, tjf('t', 'Prova di tenuta', [channel('Pressure', 'mbar', 20)]), { label: 'Tenuta' });
    // una misura con Media / Min / Max (più colonne di valori)
    const multi = tjf('val_10389_1', 'Media (UNI 10389-1)', [{
        ...channel('FluegasTemperature', '°C', 60),
        values: [{ description: 'TotalMean', timeStamp: '1', value: 60 }, { description: 'TotalMinimum', timeStamp: '1', value: 58 }, { description: 'TotalMaximum', timeStamp: '1', value: 61 }],
    }]);
    addMeasure(r, multi, { label: 'Dopo' });
    const blocks = groupMeasures(r.measures);
    assert.deepEqual(blocks.map((b) => b.kind), ['single', 'single', 'single']);
    assert.deepEqual(blocks.map((b) => b.label), ['Prima', 'Dopo', 'Tenuta']);
    assert.equal(blocks.find((b) => b.label === 'Tenuta').title, 'Prova di tenuta');
});

test('nessuna misura', () => {
    assert.deepEqual(groupMeasures([]), []);
});

test('formatDay, slug e nome del file', async () => {
    const { formatDay, slug, reportFileName, newReport } = await import('../model.js');
    assert.equal(formatDay('2026-10-22'), '22/10/2026');
    assert.equal(formatDay(''), '');
    assert.equal(slug('  Mario D\'Èrrico & Figli  '), 'Mario-D-Errico-Figli');
    const doc = newReport({ now: new Date(2026, 9, 22), id: 'x' });
    doc.customer.name = 'Mario Rossi';
    assert.equal(reportFileName(doc), 'Bozza_2026-10-22_Mario-Rossi.pdf');
    doc.number = '2026/012';
    assert.equal(reportFileName(doc), 'Rapporto_2026-012_Mario-Rossi.pdf');
    assert.equal(reportFileName(doc, 'json'), 'Rapporto_2026-012_Mario-Rossi.json');
    doc.customer.name = '';
    assert.equal(reportFileName(doc), 'Rapporto_2026-012.pdf');
});

test('bozza vuota: solo i dati predefiniti, nessuna misura né foto', async () => {
    const { isBlank, newReport, addMeasure } = await import('../model.js');
    const defaults = { name: 'Condominio Rossi', brand: 'Beretta' };
    const doc = newReport({ defaults, id: 'x' });
    assert.equal(isBlank(doc, defaults), true);
    doc.intervention.startTime = '09:00'; // gli orari da soli non contano
    assert.equal(isBlank(doc, defaults), true);
    doc.customer.address = 'Via Roma 1';
    assert.equal(isBlank(doc, defaults), false);
    doc.customer.address = '';
    doc.photoCount = 1;
    assert.equal(isBlank(doc, defaults), false);
    doc.photoCount = 0;
    addMeasure(doc, { type: { name: 'x' } });
    assert.equal(isBlank(doc, defaults), false);
    const done = newReport({ id: 'y' });
    done.status = 'done';
    assert.equal(isBlank(done), false);
});

test('rapporto letto da fuori: campi puliti e tipi giusti', async () => {
    const { normalizeReport, newReport, closeReport } = await import('../model.js');
    assert.equal(normalizeReport(null), null);
    assert.equal(normalizeReport({ id: '../evil' }), null);
    assert.equal(normalizeReport([]), null);
    const doc = newReport({ now: at(2026, 10, 22), id: 'abcd1234-aaaa' });
    doc.customer.name = 'Mario Rossi';
    doc.intervention.materials = [{ text: 'Guarnizione', qty: '2' }];
    addMeasure(doc, combustion(60, 4, 10));
    closeReport(doc, {}, at(2026, 10, 22));
    const copy = normalizeReport(JSON.parse(JSON.stringify(doc)));
    assert.deepEqual(copy, doc);
    // dati strani: numeri al posto di testi, stato inventato, numero senza chiusura
    const odd = normalizeReport({
        id: 'abcd1234-bbbb', status: 'hacked', number: '2026/001', customer: { name: 42, address: 'Via Roma' },
        intervention: { materials: [{ text: 1 }, 'x', { text: 'ok', qty: 3 }] }, measures: [{ json: 'no' }, { id: 'm1', label: 'Prima', json: {} }],
        updatedAt: 'ieri', photoCount: -4,
    });
    assert.equal(odd.status, 'draft');
    assert.equal(odd.number, null);
    assert.equal(odd.customer.name, '');
    assert.equal(odd.customer.address, 'Via Roma');
    assert.deepEqual(odd.intervention.materials, [{ text: '', qty: '' }, { text: 'ok', qty: '' }]);
    assert.deepEqual(odd.measures.map((m) => m.id), ['m1']);
    assert.equal(typeof odd.updatedAt, 'number');
    assert.equal(odd.photoCount, 0);
});

test('percorso nella cartella: anno, numero, cliente e id', async () => {
    const { folderPath, newReport, closeReport } = await import('../model.js');
    const doc = newReport({ now: at(2025, 12, 30), id: 'ab12cd34-0000' });
    doc.customer.name = 'Anna Verdi';
    assert.deepEqual(folderPath(doc), { year: '2025', dir: 'BOZZA_2025-12-30_Anna-Verdi_ab12cd34' });
    closeReport(doc, { 2025: 11 }, at(2026, 1, 2));
    assert.deepEqual(folderPath(doc), { year: '2025', dir: '2025-012_Anna-Verdi_ab12cd34' });
    doc.customer.name = '';
    assert.equal(folderPath(doc).dir, '2025-012_ab12cd34');
});

test('caldaia: etichette e rapporti salvati prima dei campi nuovi', async () => {
    const { chamberLabel, technologyLabel, fuelLabel, isBlank, newReport, normalizeReport, searchText } = await import('../model.js');
    assert.equal(chamberLabel('aperta'), 'Aperta');
    assert.equal(chamberLabel('forzata'), 'Forzata');
    assert.equal(technologyLabel('condensazione'), 'A condensazione');
    assert.equal(technologyLabel('tradizionale'), 'Tradizionale');
    assert.deepEqual(['metano', 'gpl', 'gasolio'].map(fuelLabel), ['Metano', 'GPL', 'Gasolio']);
    assert.equal(fuelLabel('carbone'), '');
    // un rapporto senza i campi nuovi dell'impianto vale ancora come bozza vuota
    const old = newReport({ id: 'old' });
    for (const k of ['model', 'chamber', 'technology', 'fuel', 'nominalPower', 'actualPower']) delete old.plant[k];
    assert.equal(isBlank(old), true);
    const doc = normalizeReport({ id: 'abcd1234', plant: { brand: 'Beretta', model: 'Ciao', fuel: 'gpl', nominalPower: 24, actualPower: '22,5' } });
    assert.deepEqual(doc.plant, { brand: 'Beretta', model: 'Ciao', serial: '', plateCode: '', installDate: '', chamber: '', technology: '', fuel: 'gpl', nominalPower: '', actualPower: '22,5' });
    assert.match(searchText(doc), /ciao/);
});
