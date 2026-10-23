import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, mergeSettings } from '../../src/data/settings.js';

test('impostazioni: valori strani diventano campi del tipo giusto', () => {
    const s = normalizeSettings({
        email: 5, method: 'altro', defaults: { name: 'Rossi' }, company: { name: 'Bianchi', vat: 12, extra: 'x' },
        counters: { 2026: 12, abc: 4, 2025: -1, 2024: 'x' }, lastBackup: 'ieri',
        mail: { subject: 'Oggetto', body: 7, extra: 'x' },
    });
    assert.deepEqual(s, {
        email: '', method: 'share',
        company: { name: 'Bianchi', vat: '', address: '', phone: '', email: '', technician: '' },
        mail: { subject: 'Oggetto', body: '' },
        counters: { 2026: 12 }, lastBackup: 0,
    });
    assert.deepEqual(normalizeSettings(null).counters, {});
    assert.deepEqual(normalizeSettings(null).mail, { subject: '', body: '' });
    // il testo dell'email ha un limite: oggetto 300 caratteri, messaggio 5000
    const long = normalizeSettings({ mail: { subject: 'x'.repeat(400), body: 'y'.repeat(6000) } }).mail;
    assert.deepEqual([long.subject.length, long.body.length], [300, 5000]);
});

test('ripristino: riempie solo i campi vuoti e tiene il contatore più alto', () => {
    const local = normalizeSettings({ email: 'mio@x.it', company: { name: 'Mia ditta' }, counters: { 2026: 5 } });
    const merged = mergeSettings(local, {
        email: 'altro@x.it', company: { name: 'Altra ditta', technician: 'Luca' }, counters: { 2026: 12, 2025: 40 },
    });
    assert.equal(merged.email, 'mio@x.it');
    assert.equal(merged.company.name, 'Mia ditta');
    assert.equal(merged.company.technician, 'Luca');
    // il testo dell'email: anche qui solo i campi vuoti
    const withMail = mergeSettings(normalizeSettings({ mail: { subject: 'Mio oggetto' } }), { mail: { subject: 'Altro', body: 'Altro testo' } });
    assert.deepEqual(withMail.mail, { subject: 'Mio oggetto', body: 'Altro testo' });
    assert.deepEqual(merged.counters, { 2026: 12, 2025: 40 });
});
