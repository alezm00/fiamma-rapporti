import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createZip, readZip, crc32 } from '../../src/lib/zip.js';

test('crc32 di un valore noto', () => {
    assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('zip: scrittura e lettura, testi compressi e file binari', async () => {
    const big = JSON.stringify({ righe: Array.from({ length: 400 }, (_, i) => `riga ${i} con àccénti`) });
    const jpeg = Uint8Array.from({ length: 5000 }, (_, i) => (i * 31) % 251);
    const blob = await createZip([
        { name: 'reports.json', data: big },
        { name: 'photos/a/b.jpg', data: jpeg, store: true },
        { name: 'vuoto.txt', data: '' },
        { name: 'è/ñ.txt', data: 'ciao' },
    ]);
    assert.ok(blob.size < big.length + jpeg.length, 'il testo è compresso');
    const files = await readZip(blob);
    assert.deepEqual([...files.keys()], ['reports.json', 'photos/a/b.jpg', 'vuoto.txt', 'è/ñ.txt']);
    assert.equal(new TextDecoder().decode(files.get('reports.json')), big);
    assert.deepEqual(files.get('photos/a/b.jpg'), jpeg);
    assert.equal(files.get('vuoto.txt').length, 0);
    assert.equal(new TextDecoder().decode(files.get('è/ñ.txt')), 'ciao');
});

test('zip: leggibile da unzip', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    const blob = await createZip([{ name: 'a.json', data: JSON.stringify({ x: 'y'.repeat(500) }) }, { name: 'dir/b.bin', data: Uint8Array.of(1, 2, 3), store: true }]);
    writeFileSync(join(dir, 't.zip'), Buffer.from(await blob.arrayBuffer()));
    try {
        const out = execFileSync('unzip', ['-t', join(dir, 't.zip')]).toString();
        assert.match(out, /No errors detected/);
        assert.deepEqual(readFileSync(join(dir, 't.zip')).subarray(0, 2), Buffer.from('PK'));
    } catch (e) {
        if (e.code === 'ENOENT') return; // unzip non installato
        throw e;
    }
});

test('zip: file rovinati o non zip', async () => {
    await assert.rejects(readZip(new TextEncoder().encode('non sono uno zip')), /ZIP valido/);
    const blob = await createZip([{ name: 'a.txt', data: 'x'.repeat(300) }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    bytes[40] ^= 0xff; // un byte dei dati
    await assert.rejects(readZip(bytes), /danneggiato/);
});
