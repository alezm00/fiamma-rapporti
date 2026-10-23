// Lettura del QR del Testo: gzip + JSON TJF -> righe, colonne, fasi (campioni in tests/e2e/fixtures/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bytesToJson, buildReport, formatNumber, toDate, topValues, reportToText } from '../../src/qr/tjf/index.js';

const fixture = (name) => bytesToJson(new Uint8Array(readFileSync(new URL(`../e2e/fixtures/${name}`, import.meta.url))));

test('QR gzip: media UNI 10389-1 con valori, unità e intestazione', async () => {
    const r = buildReport(await fixture('sample-10389.json.gz'));
    assert.equal(r.title, 'Media (UNI 10389-1)');
    assert.deepEqual(r.columns, ['Media']);
    assert.deepEqual(r.rows.map((x) => x.short), ['TF', 'TA', 'O₂', 'CO₂', 'COnd', 'CO', 'η', 'qA', 'λ', 'Tir.']);
    const row = (short) => r.rows.find((x) => x.short === short);
    assert.deepEqual([row('TF').cells.Media, row('TF').unit], ['62,8', '°C']);
    assert.deepEqual([row('O₂').cells.Media, row('O₂').unit], ['4,3', '%']);
    assert.deepEqual([row('CO').cells.Media, row('CO').unit], ['12', 'ppm']);
    assert.deepEqual([row('λ').cells.Media, row('λ').unit], ['1,25', '']);
    assert.deepEqual(r.header.map((h) => [h.label, h.value]), [['Combustibile', 'Metano'], ['O₂ rif.', '3,0 %'], ['CO₂ max', '11,7 %']]);
    assert.match(r.uuid, /^20f205d8-/);
    assert.ok(r.start instanceof Date);
    assert.deepEqual(r.sections.map((s) => s.title), ['Fasi della prova', 'Dati prova', 'Azienda', 'Strumento']);
    assert.deepEqual(r.errors, []);
});

test('anteprima e testo da copiare', async () => {
    const r = buildReport(await fixture('sample-10389.json.gz'));
    assert.equal(topValues(r), 'TF 62,8 · TA 20,7 · O₂ 4,3 · CO₂ 9,2');
    assert.equal(topValues(r, 2), 'TF 62,8 · TA 20,7');
    const lines = reportToText(r).split('\n');
    assert.equal(lines[0], 'Media (UNI 10389-1)');
    assert.ok(lines.includes('Combustibile: Metano'));
    assert.ok(lines.some((l) => /^TF Temperatura fumi: 62,8 °C$/.test(l)), lines.join('\n'));
});

test('fasi della prova: intervallo e durata separati', async () => {
    const r = buildReport(await fixture('sample-10389.json.gz'));
    const fasi = r.sections.find((s) => s.title === 'Fasi della prova').items;
    assert.deepEqual(fasi.map((f) => f.label), ['Fase 1', 'Fase 2', 'Fase 3']);
    for (const f of fasi) {
        assert.match(f.range, /^\d\d:\d\d:\d\d → \d\d:\d\d:\d\d$/); // gli orari dipendono dal fuso del computer
        assert.equal(f.duration, '1 min 00 s');
        assert.equal(f.value, `${f.range}  (${f.duration})`);
    }
});

test('più colonne: Media, Min e Max (prova di pressione)', async () => {
    const r = buildReport(await fixture('t400.json.gz'));
    assert.deepEqual(r.columns, ['Media', 'Min', 'Max']);
    assert.deepEqual(r.rows.map((x) => [x.short, x.cells.Media, x.cells.Min, x.cells.Max, x.unit]), [
        ['ΔP', '-0,08', '-0,08', '-0,08', 'hPa'],
        ['P', '919,50', '919,50', '919,50', 'hPa'],
    ]);
    assert.equal(topValues(r), 'ΔP -0,08 · P 919,50');
    assert.deepEqual(r.sections.map((s) => s.title).slice(-2), ['Strumento 1', 'Strumento 2']);
});

test('byte non compressi, e dati che non sono del Testo', async () => {
    const plain = new TextEncoder().encode(JSON.stringify({ type: { name: 'Prova' }, channels: [] }));
    assert.equal(buildReport(await bytesToJson(plain)).title, 'Prova');
    await assert.rejects(() => bytesToJson(new TextEncoder().encode('non è json')));
    assert.throws(() => buildReport(null), /Formato dati non riconosciuto/);
    assert.throws(() => buildReport([1, 2]), /Formato dati non riconosciuto/);
    const empty = buildReport({});
    assert.deepEqual([empty.title, empty.rows, empty.columns], ['Misura', [], []]);
    const failed = buildReport({ errors: [{ name: 'TjfError_NoMeasurementsAvailable' }] });
    assert.deepEqual([failed.title, failed.errors], ['Errore', ['Nessun risultato di misura disponibile']]);
});

test('numeri e date', () => {
    assert.equal(formatNumber(23.700000762939453), '23,7');
    assert.equal(formatNumber(5, 2), '5,00');
    assert.equal(formatNumber(-0.01, 1), '0,0'); // niente "-0,0"
    assert.equal(formatNumber(1234.5, 0), '1235');
    assert.equal(toDate('1792689281').getUTCFullYear(), 2026); // secondi, anche come testo
    assert.equal(toDate(1792689281000).getUTCFullYear(), 2026); // millisecondi
    assert.equal(toDate('2026-10-22T10:00:00Z').getUTCDate(), 22);
    assert.equal(toDate(5), null);
    assert.equal(toDate('boh'), null);
    assert.equal(toDate(''), null);
});
