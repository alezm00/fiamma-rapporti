// La documentazione resta in regola: collegamenti che funzionano, ogni file nominato nella mappa, ogni prova elencata.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const walk = (dir, ext) => readdirSync(join(root, dir), { recursive: true }).filter((f) => f.endsWith(ext)).map((f) => `${dir}/${f}`.replaceAll('\\', '/'));

const pages = ['README.md', ...walk('docs', '.md')];

// il testo senza i blocchi di codice (i collegamenti e i titoli stanno fuori)
const prose = (text) => text.replace(/^```[\s\S]*?^```/gm, '');

// come GitHub trasforma un titolo in un'ancora: minuscolo, senza segni, spazi in trattini
function anchors(text) {
    const seen = new Map();
    const out = new Set();
    for (const m of prose(text).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
        const plain = m[1].replace(/`/g, '').replace(/\*\*?|__?/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
        const slug = plain.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
        const n = seen.get(slug) ?? 0;
        seen.set(slug, n + 1);
        out.add(n ? `${slug}-${n}` : slug);
    }
    return out;
}

test('docs: ci sono le pagine, e l\'indice le raggiunge tutte', () => {
    const docs = walk('docs', '.md').filter((p) => p !== 'docs/README.md');
    assert.ok(docs.length >= 19, `pagine trovate: ${docs.length}`);
    const index = read('docs/README.md');
    const missing = docs.filter((p) => !index.includes(`](${p.replace('docs/', '')})`));
    assert.deepEqual(missing, [], 'pagine non nell\'indice di docs/README.md');
});

test('docs: i collegamenti relativi portano a file e titoli che esistono', () => {
    const broken = [];
    for (const page of pages) {
        const text = read(page);
        for (const m of prose(text).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
            const href = m[1];
            if (/^(https?:|mailto:)/.test(href)) continue;
            const [file, hash] = href.split('#');
            const target = file ? normalize(join(dirname(page), file)) : page;
            if (!existsSync(join(root, target))) {
                broken.push(`${page}: ${href} (manca ${target})`);
                continue;
            }
            if (hash && target.endsWith('.md') && !anchors(read(target)).has(hash)) broken.push(`${page}: ${href} (nessun titolo "${hash}")`);
        }
    }
    assert.deepEqual(broken, []);
});

test('docs: i percorsi di file scritti tra apici esistono davvero', () => {
    const missing = [];
    for (const page of pages) {
        for (const m of read(page).matchAll(/`((?:src|tests|css|img|vendor|tools|docs)\/[\w./-]+\.\w+)`/g)) {
            if (!existsSync(join(root, m[1]))) missing.push(`${page}: ${m[1]}`);
        }
    }
    assert.deepEqual(missing, []);
});

test('docs: ogni file di src/ è nella mappa del codice', () => {
    const map = read('docs/sviluppo/02-struttura-del-codice.md');
    const files = walk('src', '.js');
    assert.ok(files.length > 40, `file letti: ${files.length}`);
    assert.deepEqual(files.filter((f) => !map.includes(`\`${f}\``)), [], 'file di src/ non nominati in 02-struttura-del-codice.md');
});

test('docs: ogni prova è nella pagina dei test', () => {
    const page = read('docs/sviluppo/09-test.md');
    const units = walk('tests/unit', '.test.mjs');
    assert.deepEqual(units.filter((f) => !page.includes(`\`${f}\``)), [], 'prove della logica non nominate in 09-test.md');
    const suites = /&& TESTS=\(([^)]*)\)/.exec(read('tests/e2e/run.sh'))[1].trim().split(/\s+/);
    assert.ok(suites.length >= 13, `prove nel browser trovate: ${suites.length}`);
    assert.deepEqual(suites.filter((s) => !page.includes(`| \`${s}\` |`)), [], 'prove nel browser non nella tabella di 09-test.md');
});

test('docs: i diagrammi mermaid hanno un tipo noto e parentesi pari', () => {
    const TYPES = /^(flowchart|graph|sequenceDiagram|stateDiagram(-v2)?|classDiagram|erDiagram|gantt|pie|journey)\b/;
    let count = 0;
    const bad = [];
    for (const page of pages) {
        for (const m of read(page).matchAll(/^```mermaid\n([\s\S]*?)^```/gm)) {
            count++;
            const code = m[1].trim();
            if (!TYPES.test(code)) bad.push(`${page}: tipo di diagramma non riconosciuto`);
            for (const [open, close] of ['()', '[]', '{}']) {
                const n = (s) => code.split(s).length - 1;
                if (n(open) !== n(close)) bad.push(`${page}: parentesi ${open}${close} non pari`);
            }
            if ((code.match(/"/g) || []).length % 2) bad.push(`${page}: virgolette dispari`);
        }
    }
    assert.ok(count >= 4, `diagrammi trovati: ${count}`);
    assert.deepEqual(bad, []);
});
