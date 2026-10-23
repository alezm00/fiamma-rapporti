// Il service worker deve elencare tutti i file dell'app: uno dimenticato non funziona offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const files = [...read('sw.js').matchAll(/^\s+'\.\/([^']*)',?$/gm)].map((m) => m[1]).filter(Boolean);
const listed = new Set(files);
// ogni .js sotto una cartella, anche nelle sottocartelle: "src/model/index.js"
const jsIn = (dir) => readdirSync(new URL(`${dir}/`, root), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`);

test('service worker: i file elencati esistono', () => {
    assert.ok(files.length > 30, `elenco letto male: ${files.length} file`);
    const missing = files.filter((f) => f !== 'index.html' && !existsSync(new URL(f, root)));
    assert.deepEqual(missing, []);
    assert.equal(new Set(files).size, files.length, 'file elencati due volte');
});

test('service worker: nessun modulo, icona o libreria dimenticati', () => {
    const modules = [...jsIn('src'), ...jsIn('css')];
    assert.deepEqual(modules.filter((f) => !listed.has(f)), [], 'moduli mancanti in FILES');
    const manifest = JSON.parse(read('manifest.json'));
    const icons = [...manifest.icons, ...manifest.shortcuts.flatMap((s) => s.icons)].map((i) => i.src);
    assert.deepEqual(icons.filter((f) => !listed.has(f)), [], 'icone del manifest mancanti in FILES');
    // file caricati dalla pagina o dal codice: script, stile, font, wasm, icone
    const html = read('index.html');
    const used = [...html.matchAll(/(?:src|href)="([^"#?]+)"/g)].map((m) => m[1]).filter((f) => !/^(https?:|data:)/.test(f));
    assert.deepEqual(used.filter((f) => !listed.has(f)), [], 'file di index.html mancanti in FILES');
    const vendor = readdirSync(new URL('vendor/', root)).filter((f) => !/LICENSE/i.test(f)).map((f) => `vendor/${f}`);
    assert.deepEqual(vendor.filter((f) => !listed.has(f)), [], 'librerie di vendor/ mancanti in FILES');
});

test('service worker: la versione della cache è una sola', () => {
    assert.match(read('sw.js'), /^const CACHE = 'fiamma-v\d+';$/m);
});
