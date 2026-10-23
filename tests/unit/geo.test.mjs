import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAddress, geoErrorMessage, reverseGeocode } from '../../src/lib/geo.js';

test('indirizzo: via, civico, CAP, comune e provincia', () => {
    assert.equal(formatAddress({ address: { road: 'Via Roma', house_number: '12', postcode: '33100', city: 'Udine', 'ISO3166-2-lvl6': 'IT-UD' } }), 'Via Roma 12, 33100 Udine (UD)');
    assert.equal(formatAddress({ address: { pedestrian: 'Piazza Libertà', town: 'Pordenone', 'ISO3166-2-lvl6': 'IT-PN' } }), 'Piazza Libertà, Pordenone (PN)');
    assert.equal(formatAddress({ address: { road: 'Via Chiesa', village: 'Fontanafredda', postcode: '33074' } }), 'Via Chiesa, 33074 Fontanafredda', 'senza provincia');
    assert.equal(formatAddress({ address: { postcode: '33100', city: 'Udine' } }), '33100 Udine', 'senza via');
});

test('indirizzo: senza dati usa il nome esteso, altrimenti errore', () => {
    assert.equal(formatAddress({ address: { country: 'Italia' }, display_name: 'Bosco, Comune, Provincia, Regione, Italia' }), 'Bosco, Comune, Provincia');
    assert.throws(() => formatAddress({}), /Indirizzo non trovato/);
    assert.throws(() => formatAddress({ address: { country: 'Italia' } }), /Indirizzo non trovato/);
});

test('posizione: messaggi per ogni errore', () => {
    assert.match(geoErrorMessage({ code: 1 }), /negato/);
    assert.match(geoErrorMessage({ code: 2 }), /GPS/);
    assert.match(geoErrorMessage({ code: 3 }), /Tempo scaduto/);
    assert.match(geoErrorMessage({ code: 0 }), /non è disponibile/);
    assert.match(geoErrorMessage(undefined), /non è disponibile/);
});

test('ricerca dell\'indirizzo: richiesta e risposte', async () => {
    let asked;
    const ok = async (url, options) => {
        asked = { url, options };
        return { ok: true, json: async () => ({ address: { road: 'Via Roma', house_number: '1', city: 'Udine' } }) };
    };
    assert.equal(await reverseGeocode('46.062000', '13.235000', ok), 'Via Roma 1, Udine');
    assert.match(asked.url, /^https:\/\/nominatim\.openstreetmap\.org\/reverse\?/);
    assert.match(asked.url, /lat=46\.062000&lon=13\.235000/);
    assert.equal(asked.options.referrerPolicy, 'origin');
    await assert.rejects(() => reverseGeocode(1, 2, async () => ({ ok: false, status: 503 })), /Errore 503/);
    await assert.rejects(() => reverseGeocode(1, 2, async () => ({ ok: true, json: async () => ({ error: 'Unable to geocode' }) })), /Unable to geocode/);
});
