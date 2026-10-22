const { chromium } = require('playwright');
const [SP, FX, BASE = 'http://localhost:8801/'] = process.argv.slice(2);
const log = (...a) => console.log('•', ...a);
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${SP}/blank.y4m`] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, locale: 'it-IT', timezoneId: 'Europe/Rome', permissions: ['camera'] });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE);
  await page.waitForSelector('#view-home:not([hidden])');
  const where = async () => page.evaluate(() => [...document.querySelectorAll('main, section')].filter((e) => e.id.startsWith('view-') && !e.hidden).map((e) => e.id.slice(5)).join('+'));
  const wait = async (name) => { await page.waitForSelector(`#view-${name}:not([hidden])`, { timeout: 15000 }); const w = await where(); assert(w === name, `schermata ${name}, trovata ${w}`); };
  const back = async (name) => { await page.goBack(); await wait(name); log('indietro ->', name); };
  const count = () => page.$$eval('#report-list > li', (l) => l.length);

  // nuovo rapporto vuoto: indietro lo scarta
  await page.click('#btn-new'); await wait('editor');
  await back('home');
  assert((await count()) === 0, 'bozza vuota scartata');

  // modifica e uscita subito (prima del salvataggio ritardato)
  await page.click('#btn-new'); await wait('editor');
  await page.fill('#c-name', 'Uscita Veloce');
  await page.goBack(); await wait('home');
  assert((await count()) === 1 && /Uscita Veloce/.test(await page.textContent('#report-list')), 'modifica salvata uscendo subito');

  // editor -> scan -> indietro; editor -> scan -> misura -> indietro = editor
  await page.click('#report-list li button'); await wait('editor');
  await page.click('#e-measure-add'); await wait('scan');
  await back('editor');
  await page.click('#e-measure-add'); await wait('scan');
  await page.setInputFiles('#in-file', `${FX}/sample-10389.json.gz`); await wait('measure');
  await back('editor');
  assert((await page.$$('#e-measures > li')).length === 1, 'misura nell\'elenco');
  // dalla misura: apri, aggiungi un\'altra (sostituisce), annulla -> editor
  await page.click('#e-measures li button'); await wait('measure');
  await page.click('#m-add'); await wait('scan');
  await page.click('#btn-cancel'); await wait('editor');
  // scansione rapida: home -> scan -> misura -> indietro = home
  await page.click('#e-back'); await wait('home');
  await page.click('#btn-quick-scan'); await wait('scan');
  await page.setInputFiles('#in-file', `${FX}/t400.json.gz`); await wait('measure');
  await back('home');
  // elenco rapide: home -> elenco -> misura -> indietro = elenco -> indietro = home
  await page.click('#btn-quick-list'); await wait('quick');
  await page.click('#history li button'); await wait('measure');
  await back('quick');
  await back('home');
  // nuova scansione dalla misura rapida: sostituisce
  await page.click('#btn-quick-scan'); await wait('scan');
  await page.setInputFiles('#in-file', `${FX}/t400.json.gz`); await wait('measure');
  await page.click('#m-again'); await wait('scan');
  await page.click('#btn-cancel'); await wait('home');

  // impostazioni
  await page.click('#btn-settings'); await wait('settings');
  await back('home');
  await page.click('#btn-settings'); await wait('settings');
  await page.click('#btn-settings-back'); await wait('home');

  // QR non valido da file: resta nella scansione con un messaggio
  await page.click('#btn-quick-scan'); await wait('scan');
  await page.setInputFiles('#in-file', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('questo non è un json') });
  await page.waitForFunction(() => !document.getElementById('scan-msg').hidden);
  log('file non valido ->', await page.textContent('#scan-msg'));
  assert(/non contiene dati Testo validi/.test(await page.textContent('#scan-msg')) && (await where()) === 'scan', 'QR non valido: messaggio, resta sulla scansione');
  // in secondo piano la scansione si chiude
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await wait('home');
  await page.evaluate(() => { delete document.hidden; });

  // senza fotocamera: la schermata resta con il messaggio e "Da foto" utilizzabile
  const ctx2 = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const p2 = await ctx2.newPage();
  await p2.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })); });
  await p2.goto(BASE);
  await p2.waitForSelector('#view-home:not([hidden])');
  await p2.click('#btn-quick-scan');
  await p2.waitForSelector('#view-scan:not([hidden])');
  await p2.waitForFunction(() => !document.getElementById('scan-msg').hidden);
  log('permesso negato ->', await p2.textContent('#scan-msg'));
  await p2.setInputFiles('#in-photo', `${FX}/qr-sample.png`);
  await p2.waitForSelector('#view-measure:not([hidden])', { timeout: 20000 });
  log('QR da foto dopo errore fotocamera -> ok');
  assert(errors.length === 0, 'errori: ' + errors.join(' // '));
  await browser.close();
  log('ok');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
