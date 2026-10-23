import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseRecipients, checkRecipients, buildSubject, buildBody, mailtoUrl, mailValues, renderSubject, renderBody, unknownPlaceholders,
    MAIL_PLACEHOLDERS, DEFAULT_MAIL,
} from '../../src/model/mail.js';
import { newReport, newUnit } from '../../src/model/index.js';

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

test('modello: i segnaposto diventano i dati del rapporto', () => {
    const v = mailValues(closed(), { technician: 'Luca Bianchi', name: 'Bianchi Srl' });
    assert.equal(v.titolo, 'Rapporto di intervento n. 2026/012');
    assert.equal(v.rapporto, 'il rapporto di intervento n. 2026/012');
    assert.deepEqual([v.numero, v.data, v.cliente, v.targa], ['2026/012', '22/10/2026', 'Mario Rossi', 'AB12']);
    assert.equal(v.indirizzo, 'Via Roma 1, 33170 Pordenone PN', 'su una riga sola');
    assert.equal(v.apparecchi, 'Caldaia Beretta (matricola SN1)');
    assert.equal(v.impianto, 'targa AB12; Caldaia Beretta (matricola SN1)');
    assert.deepEqual([v.tipo, v.esito, v.intervento], ['Manutenzione ordinaria', 'Impianto funzionante', 'Manutenzione ordinaria - Impianto funzionante']);
    assert.deepEqual([v.tecnico, v.ditta, v.telefono], ['Luca Bianchi', 'Bianchi Srl', '']);
    const draft = mailValues(newReport({ now: new Date(2026, 9, 22), id: 'b' }));
    assert.deepEqual([draft.titolo, draft.rapporto, draft.numero], ['Rapporto di intervento (bozza)', 'la bozza del rapporto di intervento', '']);
    // ogni segnaposto elencato per le impostazioni ha un valore
    for (const { key } of MAIL_PLACEHOLDERS) assert.ok(key in v, key);
});

test('modello: un modello personale, e quello originale quando manca', () => {
    const doc = closed();
    const company = { technician: 'Luca Bianchi', name: 'Bianchi Srl' };
    assert.equal(buildSubject(doc, '{cliente}: rapporto {numero}'), 'Mario Rossi: rapporto 2026/012');
    assert.equal(buildBody(doc, company, 'Gentile {cliente},\nvi invio {rapporto}.\n{tecnico}'), 'Gentile Mario Rossi,\nvi invio il rapporto di intervento n. 2026/012.\nLuca Bianchi');
    // vuoto o solo spazi: si usa quello originale
    assert.equal(buildSubject(doc, ''), buildSubject(doc));
    assert.equal(buildSubject(doc, '   '), buildSubject(doc));
    assert.equal(buildBody(doc, company, '\n\n'), buildBody(doc, company));
    // un modello che non produce niente (tutti i dati mancano): si ripiega sull'originale
    const empty = newReport({ now: new Date(2026, 9, 22), id: 'c' });
    assert.equal(buildSubject(empty, '{cliente}'), buildSubject(empty));
    // il modello originale dà il testo di sempre (lo provano anche i test sopra)
    assert.equal(renderSubject(DEFAULT_MAIL.subject, mailValues(doc)), buildSubject(doc));
    assert.equal(renderBody(DEFAULT_MAIL.body, mailValues(doc, company)), buildBody(doc, company));
});

test('modello: una riga con un segnaposto vuoto sparisce', () => {
    const doc = closed();
    doc.customer.address = '';
    const body = buildBody(doc, { name: 'Bianchi Srl' }, 'Cliente: {cliente}\nIndirizzo: {indirizzo}\nTel. {telefono}\nFine\n{tecnico}\n{ditta}');
    assert.equal(body, 'Cliente: Mario Rossi\nFine\nBianchi Srl');
    // una riga senza segnaposto resta, anche vuota; ma mai due righe vuote di seguito né all'inizio e alla fine
    assert.equal(renderBody('\n\nA\n\n\n{x}\n{cliente}\n\n', { cliente: 'M' }), 'A\n\n{x}\nM');
    assert.equal(renderBody('A\n{numero}\n\nB', { numero: '' }), 'A\n\nB');
    assert.equal(renderBody('A\r\nB', {}), 'A\nB');
});

test('modello: nell\'oggetto sparisce la parte tra " - " con un segnaposto vuoto', () => {
    const doc = closed();
    doc.plant.plateCode = '';
    assert.equal(buildSubject(doc, 'Rapporto {numero} - {cliente} - targa {targa} - {data}'), 'Rapporto 2026/012 - Mario Rossi - 22/10/2026');
    assert.equal(buildSubject(doc, 'Rapporto {numero}\n{cliente}'), 'Rapporto 2026/012 Mario Rossi', 'a capo diventa spazio');
    // i " - " dentro ai valori non spezzano niente: contano solo quelli del modello
    doc.customer.name = 'Rossi - Bianchi';
    assert.equal(buildSubject(doc, '{cliente} - {data}'), 'Rossi - Bianchi - 22/10/2026');
    // una bozza: {numero} è vuoto, il titolo no
    const draft = newReport({ now: new Date(2026, 9, 22), id: 'd' });
    draft.customer.name = 'Anna Verdi';
    assert.equal(buildSubject(draft, 'N. {numero} - {cliente}'), 'Anna Verdi');
    assert.equal(buildSubject(draft, '{titolo} - {cliente}'), 'Rapporto di intervento (bozza) - Anna Verdi');
});

test('modello: i segnaposto che non esistono restano e si segnalano', () => {
    assert.deepEqual(unknownPlaceholders('Ciao {cliente}, {clinete} e {clinete} {Numero} {constructor}'), ['{clinete}', '{constructor}']);
    assert.deepEqual(unknownPlaceholders(DEFAULT_MAIL.subject + DEFAULT_MAIL.body), []);
    assert.deepEqual(unknownPlaceholders(''), []);
    assert.deepEqual(unknownPlaceholders(undefined), []);
    assert.equal(renderBody('{clinete} - {cliente}', { cliente: 'M' }), '{clinete} - M');
    assert.equal(renderBody('{constructor}', {}), '{constructor}');
});

test('mailto: destinatari, oggetto e testo codificati', () => {
    const url = mailtoUrl(['a@x.it', 'b@y.it'], 'Oggetto è ok', 'riga 1\nriga 2');
    assert.ok(url.startsWith('mailto:a@x.it,b@y.it?subject='));
    const q = new URLSearchParams(url.split('?')[1]);
    assert.equal(q.get('subject'), 'Oggetto è ok');
    assert.equal(q.get('body'), 'riga 1\r\nriga 2');
});
