// Ordine delle cartelle di src/: ognuna si appoggia solo a quelle sotto di lei, e ogni importazione trova il suo file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = join(root, 'src');

// da cartella a cartelle da cui può dipendere (app.js sta in "app")
const ALLOWED = {
    app: ['screens', 'backup', 'data', 'ui'],
    screens: ['backup', 'data', 'lib', 'model', 'pdf', 'qr', 'ui'],
    backup: ['data', 'lib', 'model', 'pdf'],
    pdf: ['lib', 'model'],
    ui: ['model'],
    data: ['model'],
    model: ['lib', 'qr'],
    qr: ['lib'],
    lib: [],
};

const files = readdirSync(src, { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => join(src, f));
const layerOf = (file) => relative(src, file).split(sep)[1] ? relative(src, file).split(sep)[0] : 'app';

function importsOf(file) {
    const code = readFileSync(file, 'utf8');
    return [...code.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)'(\.[^']*)'/g)].map((m) => normalize(join(dirname(file), m[1])));
}

test('src: ogni importazione trova il suo file', () => {
    assert.ok(files.length > 40, `file letti: ${files.length}`);
    const broken = files.flatMap((f) => importsOf(f).filter((t) => !existsSync(t)).map((t) => `${relative(root, f)} -> ${relative(root, t)}`));
    assert.deepEqual(broken, []);
});

test('src: le cartelle dipendono solo da quelle sotto', () => {
    const wrong = [];
    for (const f of files) {
        const from = layerOf(f);
        assert.ok(from in ALLOWED, `cartella non prevista: ${from}`);
        for (const t of importsOf(f)) {
            const to = layerOf(t);
            if (to !== from && !ALLOWED[from].includes(to)) wrong.push(`${relative(root, f)} importa da ${to}`);
        }
    }
    assert.deepEqual(wrong, []);
});
