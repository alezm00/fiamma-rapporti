import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecipients, checkRecipients, buildSubject, buildBody, mailtoUrl } from '../mail.js';
import { newReport, newUnit } from '../model.js';

const closed = () => {
    const doc = newReport({ now: new Date(2026, 9, 22, 10, 0), id: 'a' });
    doc.number = '2026/012';
    doc.status = 'done';
    doc.customer = { name: 'Mario Rossi', fiscalCode: '', address: 'Via Roma 1\n33170 Pordenone PN', phone: '' };
    doc.plant = { plateCode: 'AB12', units: [newUnit('caldaia', { brand: 'Beretta', serial: 'SN1' })] };
    doc.intervention = { ...doc.intervention, type: 'ordinaria', outcome: 'ok' };
    return doc;
};

test('destinatari: separatori e controllo', () => {
    assert.deepEqual(parseRecipients('a@x.it, b@y.it;c@z.it  d@w.it'), ['a@x.it', 'b@y.it', 'c@z.it', 'd@w.it']);
    assert.equal(checkRecipients('').ok, true);
    assert.equal(checkRecipients('a@x.it').ok, true);
    const bad = checkRecipients('a@x.it, ufficio');
    assert.equal(bad.ok, false);
    assert.match(bad.error, /ufficio/);
});

test('oggetto: numero, cliente, targa e data', () => {
    assert.equal(buildSubject(closed()), 'Rapporto di intervento n. 2026/012 - Mario Rossi - targa AB12 - 22/10/2026');
    const draft = closed();
    draft.number = null;
    draft.status = 'draft';
    draft.plant.plateCode = '';
    assert.equal(buildSubject(draft), 'Rapporto di intervento (bozza) - Mario Rossi - 22/10/2026');
});

test('testo: dati del rapporto e firma', () => {
    const body = buildBody(closed(), { technician: 'Luca Bianchi', name: 'Bianchi Srl' });
    assert.equal(body, [
        'Buongiorno,',
        '',
        'in allegato il rapporto di intervento n. 2026/012 del 22/10/2026.',
        '',
        'Cliente: Mario Rossi',
        'Indirizzo: Via Roma 1, 33170 Pordenone PN',
        'Impianto: targa AB12; Caldaia Beretta (matricola SN1)',
        'Intervento: Manutenzione ordinaria - Impianto funzionante',
        '',
        'Cordiali saluti',
        'Luca Bianchi',
        'Bianchi Srl',
    ].join('\n'));
    assert.match(buildBody(newReport({ id: 'b' })), /la bozza del rapporto/);
    const withModel = closed();
    withModel.plant.units[0].model = 'Ciao 24';
    withModel.plant.units.push(newUnit('pompa', { brand: 'Daikin', model: 'Altherma' }), newUnit('condizionatore', { brand: 'LG', serial: 'AC-1' }));
    assert.match(buildBody(withModel), /Impianto: targa AB12; Caldaia Beretta Ciao 24 \(matricola SN1\); Pompa di calore Daikin Altherma; Condizionatore LG \(matricola AC-1\)/);
    withModel.plant = { plateCode: '', units: [] };
    assert.doesNotMatch(buildBody(withModel), /Impianto:/);
});

test('mailto: destinatari, oggetto e testo codificati', () => {
    const url = mailtoUrl(['a@x.it', 'b@y.it'], 'Oggetto è ok', 'riga 1\nriga 2');
    assert.ok(url.startsWith('mailto:a@x.it,b@y.it?subject='));
    const q = new URLSearchParams(url.split('?')[1]);
    assert.equal(q.get('subject'), 'Oggetto è ok');
    assert.equal(q.get('body'), 'riga 1\r\nriga 2');
});
