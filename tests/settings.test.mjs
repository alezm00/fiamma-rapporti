import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, mergeSettings } from '../settings.js';

test('impostazioni: valori strani diventano campi del tipo giusto', () => {
    const s = normalizeSettings({
        email: 5, method: 'altro', defaults: { name: 'Rossi', brand: 3 }, company: { name: 'Bianchi', vat: 12, extra: 'x' },
        counters: { 2026: 12, abc: 4, 2025: -1, 2024: 'x' }, lastBackup: 'ieri',
    });
    assert.deepEqual(s, {
        email: '', method: 'share', defaults: { name: 'Rossi' },
        company: { name: 'Bianchi', vat: '', address: '', phone: '', email: '', technician: '' },
        counters: { 2026: 12 }, lastBackup: 0,
    });
    assert.deepEqual(normalizeSettings(null).counters, {});
});

test('ripristino: riempie solo i campi vuoti e tiene il contatore più alto', () => {
    const local = normalizeSettings({ email: 'mio@x.it', company: { name: 'Mia ditta' }, counters: { 2026: 5 } });
    const merged = mergeSettings(local, {
        email: 'altro@x.it', company: { name: 'Altra ditta', technician: 'Luca' }, defaults: { name: 'Rossi' }, counters: { 2026: 12, 2025: 40 },
    });
    assert.equal(merged.email, 'mio@x.it');
    assert.equal(merged.company.name, 'Mia ditta');
    assert.equal(merged.company.technician, 'Luca');
    assert.deepEqual(merged.defaults, { name: 'Rossi' });
    assert.deepEqual(merged.counters, { 2026: 12, 2025: 40 });
});
