import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkFiscalCode } from '../validate.js';

// codici generati con una libreria di riferimento: validi (anche con omocodia), errati, partite IVA
const v = JSON.parse(readFileSync(new URL('./cf-vectors.json', import.meta.url), 'utf8'));

test('codici fiscali validi, anche con omocodia, accettati', () => {
    const rejected = v.valid.filter((cf) => !checkFiscalCode(cf).ok);
    assert.deepEqual(rejected, []);
});

test('codici fiscali errati respinti', () => {
    const accepted = v.invalid.filter((cf) => checkFiscalCode(cf).ok);
    assert.deepEqual(accepted, []);
});

test('partite IVA di 11 cifre', () => {
    assert.deepEqual(v.vat_ok.filter((x) => !checkFiscalCode(x).ok), []);
    assert.deepEqual(v.vat_bad.filter((x) => checkFiscalCode(x).ok), []);
});

test('spazi, minuscole, campo vuoto e messaggi', () => {
    const s = v.valid[0];
    assert.equal(checkFiscalCode(` ${s.toLowerCase().slice(0, 6)} ${s.slice(6)} `).ok, true);
    assert.equal(checkFiscalCode(s.slice(0, 15)).ok, false);
    assert.match(checkFiscalCode(s.slice(0, 15)).error, /15/);
    assert.equal(checkFiscalCode('').empty, true);
    assert.match(checkFiscalCode('RSSMRA80A01H501X').error, /controllo/);
    assert.match(checkFiscalCode('RSSMRA80A32H501U').error, /Data di nascita/);
    assert.match(checkFiscalCode('12345678901').error, /cifra di controllo/);
});
