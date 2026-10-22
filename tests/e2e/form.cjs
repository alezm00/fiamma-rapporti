const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const [SP, FX, BASE = 'http://localhost:8801/'] = process.argv.slice(2);
const log = (...a) => console.log('•', ...a);
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'it-IT', timezoneId: 'Europe/Rome', acceptDownloads: true, geolocation: { latitude: 45.9569, longitude: 12.6603 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && !/nominatim|ERR_FAILED|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on('dialog', (d) => d.accept());
  await page.route('https://nominatim.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ address: { road: 'Via Roma', house_number: '12', postcode: '33170', city: 'Pordenone', 'ISO3166-2-lvl6': 'IT-PN' } }) }));
  await page.goto(BASE);
  await page.waitForSelector('#view-home:not([hidden])');
  await page.click('#btn-new');
  await page.waitForSelector('#view-editor:not([hidden])');

  // codice fiscale: avviso che non blocca
  await page.fill('#c-cf', 'rssmra80a01h501x');
  await page.press('#c-cf', 'Tab');
  log('CF errato ->', await page.textContent('#cf-hint'), '| valore:', await page.inputValue('#c-cf'));
  assert(await page.isVisible('#cf-hint') && (await page.inputValue('#c-cf')) === 'RSSMRA80A01H501X', 'avviso CF e maiuscolo');
  await page.fill('#c-name', 'Mario Rossi');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-pdf-save')]);
  await dl.saveAs(`${SP}/dl/cf-bad.pdf`);
  log('PDF creato lo stesso ->', await page.textContent('#report-msg'), '| tipo', await page.getAttribute('#report-msg', 'data-type'));
  assert(/controlla: codice fiscale/.test(await page.textContent('#report-msg')), 'avviso nel messaggio');
  await page.fill('#c-cf', 'RSSMRA80A01H501U');
  await page.press('#c-cf', 'Tab');
  assert(!(await page.isVisible('#cf-hint')), 'CF valido: nessun avviso');
  await page.fill('#c-cf', 'RSS');
  assert(!(await page.isVisible('#cf-hint')), 'mentre si scrive nessun avviso');
  await page.fill('#c-cf', '');
  await page.press('#c-cf', 'Tab');
  assert(!(await page.isVisible('#cf-hint')), 'campo vuoto: nessun avviso');

  // posizione -> indirizzo
  await page.click('#btn-geo');
  await page.waitForFunction(() => /Indirizzo trovato/.test(document.getElementById('geo-msg').textContent));
  log('posizione ->', JSON.stringify(await page.inputValue('#c-address')), '|', await page.textContent('#geo-msg'));
  assert((await page.inputValue('#c-address')) === 'Via Roma 12, 33170 Pordenone (PN)', 'indirizzo da posizione');
  // si salva da solo: riaprendo il rapporto c'è
  await page.click('#e-back');
  await page.waitForSelector('#view-home:not([hidden])');
  await page.click('#report-list li button');
  await page.waitForSelector('#view-editor:not([hidden])');
  assert((await page.inputValue('#c-address')) === 'Via Roma 12, 33170 Pordenone (PN)', 'indirizzo salvato');

  // foto: ridimensionamento, EXIF, trasparenza, ingrandimento, eliminazione
  await page.setInputFiles('#in-gallery', [`${SP}/img/landscape.jpg`, `${SP}/img/portrait_exif6.jpg`, `${SP}/img/transparent.png`]);
  await page.waitForFunction(() => document.querySelectorAll('#photo-grid > div').length === 3, null, { timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('photo-msg').hidden);
  log('foto ->', await page.textContent('#photo-count'));
  const recs = await page.evaluate(async () => { const db = await import('/db.js'); return (await db.getAll(db.PHOTOS)).map((p) => ({ w: p.width, h: p.height, type: p.blob.type, kb: Math.round(p.blob.size / 1024) })); });
  log('salvate ->', JSON.stringify(recs.map((r) => `${r.w}x${r.h} ${r.type} ${r.kb}KB`)));
  assert(recs.every((r) => r.type === 'image/jpeg' && Math.max(r.w, r.h) <= 1280 && r.kb < 600), 'ridimensionate');
  assert(recs.some((r) => r.h > r.w && r.h === 1280), 'EXIF 6 raddrizzata');
  await page.click('#photo-grid > div:first-child img');
  assert(await page.isVisible('#photo-view'), 'anteprima');
  await page.click('#photo-view');
  await page.click('#photo-grid > div:nth-child(2) button');
  await page.waitForFunction(() => document.querySelectorAll('#photo-grid > div').length === 2);
  log('dopo eliminazione ->', await page.textContent('#photo-count'));
  // limite di 20
  await page.setInputFiles('#in-gallery', Array.from({ length: 18 }, (_, i) => `${SP}/img/small${String(i % 14).padStart(2, '0')}.jpg`));
  await page.waitForFunction(() => document.querySelectorAll('#photo-grid > div').length === 20, null, { timeout: 120000 });
  await page.waitForFunction(() => document.getElementById('photo-msg').hidden);
  await page.setInputFiles('#in-shoot', `${SP}/img/small00.jpg`);
  await page.waitForFunction(() => /Massimo 20 foto/.test(document.getElementById('photo-msg').textContent));
  log('oltre il limite ->', await page.textContent('#photo-msg'));
  // il numero di foto nell'elenco e nel PDF
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#btn-pdf-save')]);
  await dl2.saveAs(`${SP}/dl/photos20.pdf`);
  const imgs = execSync(`pdfimages -list ${SP}/dl/photos20.pdf`).toString().trim().split('\n').slice(2).length;
  const pages = execSync(`pdfinfo ${SP}/dl/photos20.pdf`).toString().match(/Pages:\s+(\d+)/)[1];
  log('PDF con 20 foto -> immagini', imgs, '| pagine', pages);
  assert(imgs === 20, 'tutte le foto nel PDF');
  await page.click('#e-back');
  await page.waitForSelector('#view-home:not([hidden])');
  assert(/20 foto/.test(await page.textContent('#report-list')), '20 foto in elenco');
  // eliminando il rapporto va nel cestino (foto comprese); eliminandolo per sempre spariscono le foto
  await page.click('#report-list li button');
  await page.waitForSelector('#view-editor:not([hidden])');
  await page.click('#btn-delete');
  await page.waitForSelector('#view-home:not([hidden])');
  const inTrash = await page.evaluate(async () => { const db = await import('/db.js'); return (await db.getAll(db.PHOTOS)).length; });
  assert(inTrash === 20, 'nel cestino le foto restano: ' + inTrash);
  await page.click('#h-trash');
  await page.waitForSelector('#view-trash:not([hidden])');
  await page.click('#trash-list li button:last-of-type');
  await page.waitForFunction(() => document.querySelectorAll('#trash-list > li').length === 0);
  const left = await page.evaluate(async () => { const db = await import('/db.js'); return (await db.getAll(db.PHOTOS)).length; });
  assert(left === 0, 'foto eliminate con il rapporto: ' + left);
  assert(errors.length === 0, 'errori: ' + errors.join(' // '));
  await browser.close();
  log('ok');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
