const { chromium } = require('playwright');
const [SP, FX, BASE = 'http://localhost:8801/'] = process.argv.slice(2);
const log = (...a) => console.log('•', ...a);
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${FX}/cam.y4m`] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'it-IT', timezoneId: 'Europe/Rome', acceptDownloads: true, permissions: ['camera'] });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('dialog', (d) => { log('dialog:', d.message()); d.accept(); });
  await page.goto(BASE);
  await page.waitForSelector('#view-home:not([hidden])');
  const visible = (id) => page.isVisible(id);
  const shot = (n) => page.screenshot({ path: `${SP}/shots5/${n}.png`, fullPage: true });
  require('fs').mkdirSync(`${SP}/shots5`, { recursive: true });

  log('home vuota ->', JSON.stringify(await page.textContent('#report-empty')));
  await shot('1-home-empty');

  // nuovo rapporto
  await page.click('#btn-new');
  await page.waitForSelector('#view-editor:not([hidden])');
  log('titolo ->', await page.textContent('#e-title'), '| badge ->', await page.textContent('#e-badge'), '| chiudi visibile ->', await visible('#btn-close'));
  await page.fill('#c-name', 'Mario Rossi');
  await page.fill('#c-address', 'Via Roma 1\n33170 Pordenone PN');
  await page.fill('#c-plate', 'ab12');
  await page.fill('#c-brand', 'Beretta');
  await page.selectOption('#e-type', 'ordinaria');
  await page.selectOption('#e-outcome', 'anomalie');
  await page.fill('#e-work', 'Pulizia scambiatore');
  await page.click('#e-mat-add');
  await page.fill('#e-materials > div:nth-child(1) input:nth-child(1)', 'Guarnizione');
  await page.fill('#e-materials > div:nth-child(1) input:nth-child(2)', '2');
  await page.click('#e-mat-add'); // riga lasciata vuota: sparisce uscendo
  await page.fill('#e-start', '09:10');
  await page.fill('#e-end', '10:35');
  log('durata ->', await page.textContent('#e-duration'));
  assert((await page.textContent('#e-duration')).includes('1 h 25 min'), 'durata');
  await page.click('#e-start-now');
  const now = await page.inputValue('#e-start');
  assert(/^\d\d:\d\d$/.test(now) && now !== '09:10', 'adesso');
  await page.fill('#e-start', '09:10');
  await shot('2-editor-top');

  // scansione: file importato
  await page.click('#e-measure-add');
  await page.waitForSelector('#view-scan:not([hidden])');
  log('scan: stato ->', await page.textContent('#scan-status'));
  await page.setInputFiles('#in-file', `${FX}/sample-10389.json.gz`);
  await page.waitForSelector('#view-measure:not([hidden])');
  log('misura in rapporto: etichetta ->', await page.inputValue('#m-label'), '| titolo ->', await page.textContent('#r-title'), '| rimuovi', await visible('#m-remove'), '| again', await visible('#m-again'));
  assert((await page.inputValue('#m-label')) === 'Prima', 'etichetta Prima');
  await shot('3-measure-report');
  // seconda misura (stesso QR -> già presente)
  await page.click('#m-add');
  await page.waitForSelector('#view-scan:not([hidden])');
  await page.setInputFiles('#in-file', `${FX}/sample-10389.json.gz`);
  await page.waitForSelector('#view-measure:not([hidden])');
  log('stesso QR -> toast:', await page.textContent('#toast'), '| etichetta', await page.inputValue('#m-label'));
  await page.click('#m-add');
  await page.waitForSelector('#view-scan:not([hidden])');
  await page.setInputFiles('#in-file', `${FX}/sample-10389-b.json.gz`);
  await page.waitForSelector('#view-measure:not([hidden])');
  log('seconda misura: etichetta ->', await page.inputValue('#m-label'));
  assert((await page.inputValue('#m-label')) === 'Dopo', 'etichetta Dopo');
  await page.fill('#m-label', 'Dopo pulizia');
  await page.click('#m-back');
  await page.waitForSelector('#view-editor:not([hidden])');
  const measures = await page.$$eval('#e-measures > li', (l) => l.map((x) => x.innerText.replace(/\n/g, ' | ')));
  log('misure nell\'editor ->', JSON.stringify(measures));
  assert(measures.length === 2 && measures[1].startsWith('Dopo pulizia'), 'elenco misure');
  assert((await page.inputValue('#c-name')) === 'Mario Rossi', 'il form è rimasto compilato');
  assert((await page.$$('#e-materials > div')).length === 1, 'la riga materiale vuota è sparita uscendo dal rapporto');
  await shot('4-editor-measures');

  // scansione rapida da fotocamera finta (QR nel video)
  await page.click('#e-mat-add'); // riga vuota che sparisce uscendo
  await page.click('#e-back');
  await page.waitForSelector('#view-home:not([hidden])');
  const items = await page.$$eval('#report-list > li', (l) => l.map((x) => x.innerText.replace(/\n/g, ' | ')));
  log('elenco ->', JSON.stringify(items));
  assert(items.length === 1 && /bozza/i.test(items[0]) && items[0].includes('Mario Rossi') && items[0].includes('2 misure'), 'riga elenco');
  await shot('5-home-1');

  await page.click('#btn-quick-scan');
  await page.waitForSelector('#view-scan:not([hidden])');
  await page.waitForSelector('#view-measure:not([hidden])', { timeout: 20000 }).catch(() => log('fotocamera finta: nessuna lettura (video senza QR?)'));
  log('dopo scansione rapida: vista misura', await visible('#view-measure'), '| label card', await visible('#m-label-card'), '| again', await visible('#m-again'));
  if (await visible('#view-measure')) {
    await page.click('#m-back');
    await page.waitForSelector('#view-home:not([hidden])');
  } else {
    await page.click('#btn-cancel');
  }
  // scansione rapida da file
  await page.click('#btn-quick-scan');
  await page.setInputFiles('#in-file', `${FX}/t400.json.gz`);
  await page.waitForSelector('#view-measure:not([hidden])');
  await page.click('#m-back');
  await page.waitForSelector('#view-home:not([hidden])');
  await page.click('#btn-quick-list');
  await page.waitForSelector('#view-quick:not([hidden])');
  log('rapide ->', (await page.$$('#history > li')).length);
  await shot('6-quick');
  await page.click('#q-back');

  // ricerca e filtri
  await page.fill('#h-search', 'pordenone');
  assert((await page.$$('#report-list > li')).length === 1, 'ricerca indirizzo');
  await page.fill('#h-search', 'AB12');
  assert((await page.$$('#report-list > li')).length === 1, 'ricerca targa');
  await page.fill('#h-search', 'zzz');
  log('nessun risultato ->', await page.textContent('#report-empty'));
  await page.fill('#h-search', '');
  await page.click('#h-status [data-status="done"]');
  assert((await page.$$('#report-list > li')).length === 0, 'filtro completati vuoto');
  await page.click('#h-status [data-status="draft"]');
  assert((await page.$$('#report-list > li')).length === 1, 'filtro bozze');
  await page.click('#h-status [data-status="all"]');

  // riapro: chiusura
  await page.click('#report-list li button');
  await page.waitForSelector('#view-editor:not([hidden])');
  log('materiali alla riapertura ->', (await page.$$('#e-materials > div')).length, JSON.stringify(await page.$$eval('#e-materials input', (i) => i.map((x) => x.value))));
  assert((await page.$$('#e-materials > div')).length === 1, 'riga materiale vuota rimossa all uscita');
  await page.click('#btn-close');
  await page.waitForFunction(() => /Rapporto n\./.test(document.getElementById('e-title').textContent));
  log('dopo chiusura ->', await page.textContent('#e-title'), '|', await page.textContent('#e-badge'), '| chiudi visibile', await visible('#btn-close'));
  await shot('7-editor-closed');

  // duplica
  await page.click('#btn-duplicate');
  await page.waitForFunction(() => document.getElementById('e-title').textContent === 'Rapporto');
  log('duplicato -> nome', await page.inputValue('#c-name'), '| lavori', JSON.stringify(await page.inputValue('#e-work')), '| misure', (await page.$$('#e-measures > li')).length);
  assert((await page.inputValue('#c-name')) === 'Mario Rossi' && (await page.inputValue('#e-work')) === '', 'duplica');
  // elimina il duplicato (resta il primo)
  await page.click('#btn-delete');
  await page.waitForSelector('#view-home:not([hidden])');
  log('dopo elimina -> righe', (await page.$$('#report-list > li')).length);
  assert((await page.$$('#report-list > li')).length === 1, 'eliminato');

  // bozza vuota scartata
  await page.click('#btn-new');
  await page.waitForSelector('#view-editor:not([hidden])');
  await page.click('#e-back');
  await page.waitForSelector('#view-home:not([hidden])');
  assert((await page.$$('#report-list > li')).length === 1, 'bozza vuota scartata');

  // ricarica: i dati restano
  await page.reload();
  await page.waitForSelector('#view-home:not([hidden])');
  await page.waitForSelector('#report-list li');
  log('dopo reload ->', JSON.stringify(await page.$$eval('#report-list > li', (l) => l.map((x) => x.innerText.replace(/\n/g, ' | ')))));
  await page.click('#btn-settings');
  await page.waitForSelector('#view-settings:not([hidden])');
  await shot('8-settings');
  assert(!errors.length, 'errori: ' + errors.join(' // '));
  await browser.close();
  log('tutto ok');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
