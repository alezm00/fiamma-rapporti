import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pad, dayString, formatDay, formatTime, formatDate } from '../../src/lib/dates.js';

test('date: gg/mm/aaaa, aaaa-mm-gg e orari', () => {
    const d = new Date(2026, 9, 2, 7, 5, 9);
    assert.equal(pad(7), '07');
    assert.equal(dayString(d), '2026-10-02');
    assert.equal(formatDay('2026-10-22'), '22/10/2026');
    assert.equal(formatDay('2026-10-22T10:00:00Z'), '22/10/2026');
    assert.equal(formatDay(''), '');
    assert.equal(formatDay('boh'), '');
    assert.equal(formatTime(d), '07:05:09');
    assert.equal(formatTime(d, false), '07:05');
    assert.equal(formatDate(d), '02/10/2026 07:05');
    assert.equal(formatDate(d, true), '02/10/2026 07:05:09');
});
