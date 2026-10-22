const { chromium } = require('playwright');
const [SP, FX, BASE = 'http://localhost:8801/'] = process.argv.slice(2);
const log = (...a) => console.log('•', ...a);
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); };
const until = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return; await new Promise((r) => setTimeout(r, 200)); } throw new Error('timeout in attesa'); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  let answer = true;
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); answer ? d.accept() : d.dismiss(); });
  await page.goto(BASE);
  await page.waitForSelector('#view-home:not([hidden])');

  // cartelle di prova nella memoria privata del browser; il selettore di sistema è sostituito da una funzione
  const prepare = () => page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    window.__root = root;
    window.__pick = async () => root.getDirectoryHandle(window.__target, { create: true });
    window.showDirectoryPicker = (...a) => window.__pick(...a);
  });
  const target = (name) => page.evaluate((n) => { window.__target = n; }, name);
  const peek = (name) => page.evaluate(async (n) => { const f = await import('/folder.js'); const root = await navigator.storage.getDirectory(); const r = await f.peekSettings(await root.getDirectoryHandle(n)); return r && { company: r.settings.company.name, email: r.settings.email, technician: r.settings.company.technician, counters: r.settings.counters, logo: r.logo }; }, name);
  const openSettings = async () => { await page.click('#btn-settings'); await page.waitForSelector('#view-settings:not([hidden])'); };
  const closeSettings = async () => { await page.click('#btn-settings-back'); await page.waitForSelector('#view-home:not([hidden])'); };
  await prepare();

  // 1) telefono A: impostazioni complete, cartella collegata
  await openSettings();
  await page.fill('#s-co-name', 'Ditta Uno Srl');
  await page.fill('#s-co-technician', 'Luca Bianchi');
  await page.fill('#s-email', 'ufficio@dittauno.it');
  await page.setInputFiles('#s-logo-in', `${SP}/img/logo.png`);
  await page.waitForSelector('#s-logo-img:not([hidden])');
  await page.fill('#s-next', '6');
  await page.dispatchEvent('#s-next', 'change');
  await page.press('#s-email', 'Tab');
  await target('cartella-A');
  dialogs.length = 0;
  await page.click('#s-folder-link');
  await page.waitForFunction(() => /Cartella collegata/.test(document.getElementById('s-folder-msg').textContent));
  assert(dialogs.length === 0, 'cartella senza impostazioni: nessuna domanda');
  await page.evaluate(async () => (await import('/folder.js')).process());
  let a = await peek('cartella-A');
  log('nella cartella A ->', JSON.stringify(a));
  assert(a.company === 'Ditta Uno Srl' && a.email === 'ufficio@dittauno.it' && a.technician === 'Luca Bianchi' && a.counters['2026'] === 5 && a.logo.width > 0, 'impostazioni scritte nella cartella');

  // 2) telefono nuovo (dati azzerati): "Scegli cartella" chiede se prendere le impostazioni; "No" non cambia nulla
  await closeSettings(); // uscendo dalle impostazioni si salvano: prima, poi si azzera
  await page.evaluate(async () => { const f = await import('/folder.js'); const db = await import('/db.js'); await f.unlink(); await db.remove(db.META, 'logo'); localStorage.clear(); });
  await page.reload();
  await page.waitForSelector('#view-home:not([hidden])');
  await prepare();
  await openSettings();
  assert((await page.inputValue('#s-co-name')) === '' && (await page.inputValue('#s-email')) === '', 'impostazioni vuote');
  await target('cartella-A');
  answer = false;
  dialogs.length = 0;
  await page.click('#s-folder-link');
  await page.waitForFunction(() => /Cartella collegata/.test(document.getElementById('s-folder-msg').textContent));
  log('domanda ->', JSON.stringify(dialogs[0]));
  assert(dialogs.length === 1 && /impostazioni salvate/.test(dialogs[0]) && dialogs[0].includes('Ditta Uno Srl') && dialogs[0].includes('ufficio@dittauno.it') && dialogs[0].includes('«cartella-A»') && /Caricarle al posto/.test(dialogs[0]), 'testo della domanda');
  assert((await page.inputValue('#s-co-name')) === '' && !/caricate/.test(await page.textContent('#s-folder-msg')), 'No: il telefono resta com\'era');
  assert(/Collegata/.test(await page.textContent('#s-folder-status')), 'collegata comunque');
  await page.evaluate(async () => (await import('/folder.js')).process());
  a = await peek('cartella-A');
  assert(a.company === 'Ditta Uno Srl' && a.technician === 'Luca Bianchi', 'No: le impostazioni nella cartella non si perdono');

  // 3) "Sì": le impostazioni della cartella sostituiscono quelle del telefono
  answer = true;
  await page.click('#s-folder-unlink');
  await page.waitForFunction(() => !document.getElementById('s-folder-link').hidden);
  dialogs.length = 0;
  await page.click('#s-folder-link');
  await page.waitForFunction(() => /Impostazioni caricate/.test(document.getElementById('s-folder-msg').textContent));
  log('dopo "Sì" ->', await page.textContent('#s-folder-msg'));
  assert((await page.inputValue('#s-co-name')) === 'Ditta Uno Srl' && (await page.inputValue('#s-co-technician')) === 'Luca Bianchi' && (await page.inputValue('#s-email')) === 'ufficio@dittauno.it', 'ditta ed email caricate');
  log('numero', await page.inputValue('#s-next'), '| logo visibile', await page.isVisible('#s-logo-img'), '| logo in archivio', await page.evaluate(async () => { const db = await import('/db.js'); return !!(await db.get(db.META, 'logo')); }));
  assert((await page.inputValue('#s-next')) === '6' && await page.isVisible('#s-logo-img'), 'numerazione e logo caricati');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('testoqr.config')));
  assert(stored.company.name === 'Ditta Uno Srl' && stored.counters['2026'] === 5, 'salvate sul telefono');
  await page.screenshot({ path: `${SP}/shots5/22-settings-from-folder.png`, fullPage: false });

  // 4) il numero progressivo non torna indietro: il telefono è più avanti della cartella
  await page.fill('#s-next', '10');
  await page.dispatchEvent('#s-next', 'change');
  await page.fill('#s-co-name', 'Nome cambiato qui');
  await page.press('#s-co-name', 'Tab');
  await page.click('#s-folder-unlink');
  await page.waitForFunction(() => !document.getElementById('s-folder-link').hidden);
  // il file nella cartella ha di nuovo un contatore basso
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('cartella-A')).getDirectoryHandle('Fiamma');
    const w = await (await dir.getFileHandle('impostazioni.json')).createWritable();
    const cur = JSON.parse(await (await (await dir.getFileHandle('impostazioni.json')).getFile()).text());
    cur.counters = { 2026: 3, 2025: 40 };
    cur.company.name = 'Ditta dalla cartella';
    await w.write(JSON.stringify(cur));
    await w.close();
  });
  await page.click('#s-folder-link');
  await page.waitForFunction(() => /Impostazioni caricate/.test(document.getElementById('s-folder-msg').textContent));
  assert((await page.inputValue('#s-co-name')) === 'Ditta dalla cartella', 'ditta presa dalla cartella');
  assert((await page.inputValue('#s-next')) === '10', 'il prossimo numero resta 10, non scende a 4: ' + (await page.inputValue('#s-next')));
  const counters = await page.evaluate(() => JSON.parse(localStorage.getItem('testoqr.config')).counters);
  assert(counters['2026'] === 9 && counters['2025'] === 40, 'contatori: il più alto per anno ' + JSON.stringify(counters));
  log('contatori ->', JSON.stringify(counters));

  // 5) cartella senza impostazioni, con un file rotto, o selettore annullato: nessuna domanda e nessun errore
  await page.click('#s-folder-unlink');
  await page.waitForFunction(() => !document.getElementById('s-folder-link').hidden);
  await target('cartella-vuota');
  dialogs.length = 0;
  await page.click('#s-folder-link');
  await page.waitForFunction(() => /Cartella collegata/.test(document.getElementById('s-folder-msg').textContent), null, { timeout: 5000 }).catch(async () => {
    console.log('DEBUG msg:', JSON.stringify(await page.textContent('#s-folder-msg')), '| stato:', await page.textContent('#s-folder-status'), '| dialoghi:', JSON.stringify(dialogs), '| errori:', errors.join(' // '));
    throw new Error('collegamento non riuscito');
  });
  assert(dialogs.length === 0, 'cartella vuota: nessuna domanda');
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('cartella-rotta', { create: true })).getDirectoryHandle('Fiamma', { create: true });
    const w = await (await dir.getFileHandle('impostazioni.json', { create: true })).createWritable();
    await w.write('questo non è un json');
    await w.close();
  });
  await page.click('#s-folder-unlink');
  await page.waitForFunction(() => !document.getElementById('s-folder-link').hidden);
  await target('cartella-rotta');
  dialogs.length = 0; // (lo scollega chiede conferma)
  await page.click('#s-folder-link');
  await page.waitForFunction(() => /Cartella collegata/.test(document.getElementById('s-folder-msg').textContent));
  assert(dialogs.length === 0 && (await page.getAttribute('#s-folder-msg', 'data-type')) === 'success', 'file rotto: ignorato');
  await page.click('#s-folder-unlink');
  await page.waitForFunction(() => !document.getElementById('s-folder-link').hidden);
  await page.evaluate(() => { window.__pick = async () => { throw new DOMException('annullato', 'AbortError'); }; });
  dialogs.length = 0;
  await page.click('#s-folder-link');
  await page.waitForTimeout(300);
  assert(dialogs.length === 0 && !(await page.isVisible('#s-folder-tools')) && (await page.inputValue('#s-co-name')) === 'Ditta dalla cartella', 'selettore annullato: nulla cambia');
  assert(errors.length === 0, 'errori: ' + errors.join(' // '));
  await browser.close();
  log('ok');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
