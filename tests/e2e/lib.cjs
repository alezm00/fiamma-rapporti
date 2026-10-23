// Base comune delle prove nel browser (Playwright + Chromium): un telefono Android in italiano.
// Uso: node tests/e2e/<prova>.cjs <cartella dei file> <cartella dei campioni> [indirizzo]  (vedi run.sh)
const { chromium } = require('playwright');

const [SP, FX, BASE = 'http://localhost:8801/'] = process.argv.slice(2);

const log = (...a) => console.log('•', ...a);
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); };

// aspetta che la condizione diventi vera (async: si usa questa e non waitForFunction)
const until = async (fn, ms = 15000, step = 200) => {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await fn()) return; await new Promise((r) => setTimeout(r, step)); }
  throw new Error('timeout in attesa');
};

const PHONE = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'it-IT', timezoneId: 'Europe/Rome', acceptDownloads: true };

const launch = (args) => chromium.launch(args ? { args } : {});

// Un contesto con la sua pagina, aperta sull'app (elenco dei rapporti). Raccoglie gli errori della pagina e
// registra le finestre di conferma, a cui risponde sì (dialogs.accept = false per rispondere no).
//   context: opzioni del contesto in più (permessi, posizione…); ignoreErrors: errori della console da non contare;
//   before(page, ctx): prima di aprire l'app (script iniziali, finte risposte di rete)
async function open(browser, { context, ignoreErrors, before } = {}) {
  const ctx = await browser.newContext({ ...PHONE, ...context });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${e.message} @ ${String(e.stack).split('\n').slice(1, 3).join(' | ')}`));
  page.on('console', (m) => m.type() === 'error' && !ignoreErrors?.test(m.text()) && errors.push(m.text()));
  const dialogs = [];
  dialogs.accept = true;
  page.on('dialog', (d) => { dialogs.push(d.message()); return dialogs.accept ? d.accept() : d.dismiss(); });
  await before?.(page, ctx);
  await page.goto(BASE);
  await page.waitForSelector('#view-home:not([hidden])');
  return { browser, ctx, page, errors, dialogs };
}

// browser + un contesto: il caso più comune. args: opzioni di Chromium (fotocamera finta…)
async function start({ args, ...options } = {}) {
  return open(await launch(args), options);
}

// fine della prova: nessun errore nelle pagine, poi si chiude il browser
async function finish(...sessions) {
  for (const s of sessions) assert(s.errors.length === 0, `errori: ${s.errors.join(' // ')}`);
  await sessions[0].browser.close();
}

function run(main) {
  main().then(() => log('ok'), (e) => { console.error('FAILED', e.message); process.exit(1); });
}

module.exports = { SP, FX, BASE, log, assert, until, launch, open, start, finish, run };
