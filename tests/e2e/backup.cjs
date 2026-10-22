const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const [SP, FX, BASE = 'http://localhost:8801/'] = process.argv.slice(2);
const log = (...a) => console.log('•', ...a);
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'it-IT', timezoneId: 'Europe/Rome', acceptDownloads: true });
  await ctx.addInitScript(() => { delete window.showDirectoryPicker; }); // browser senza cartella di salvataggio
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE);
  await page.waitForSelector('#view-home:not([hidden])');
  assert((await page.$('#home-reminder button')) === null, 'nessun promemoria senza rapporti');

  // due rapporti con foto e misure
  for (const name of ['Mario Rossi', 'Anna Verdi']) {
    await page.click('#btn-new');
    await page.waitForSelector('#view-editor:not([hidden])');
    await page.fill('#c-name', name);
    await page.fill('#e-work', `Lavori di ${name}`);
    await page.setInputFiles('#in-gallery', [`${SP}/img/small0${name === 'Mario Rossi' ? 0 : 1}.jpg`]);
    await page.waitForFunction(() => document.querySelectorAll('#photo-grid > div').length === 1, null, { timeout: 30000 });
    if (name === 'Mario Rossi') {
      await page.click('#e-measure-add');
      await page.setInputFiles('#in-file', `${FX}/sample-10389.json.gz`);
      await page.waitForSelector('#view-measure:not([hidden])');
      await page.click('#m-back');
      await page.waitForSelector('#view-editor:not([hidden])');
      await page.click('#btn-close');
      await page.waitForFunction(() => /Rapporto n\./.test(document.getElementById('e-title').textContent));
    }
    await page.click('#e-back');
    await page.waitForSelector('#view-home:not([hidden])');
  }
  log('promemoria senza copie ->', JSON.stringify(await page.textContent('#home-reminder')));
  assert(/Nessuna copia di sicurezza/.test(await page.textContent('#home-reminder')), 'promemoria copia mancante');
  await page.screenshot({ path: `${SP}/shots5/14-home-backup-reminder.png` });

  await page.click('#home-reminder button'); // porta alle impostazioni
  await page.waitForSelector('#view-settings:not([hidden])');
  log('senza cartella ->', await page.textContent('#s-folder-status'), '| scegli visibile:', await page.isVisible('#s-folder-link'));
  assert(!(await page.isVisible('#s-folder-link')) && !(await page.isVisible('#s-folder-tools')), 'cartella non disponibile');
  await page.fill('#s-co-name', 'Termoidraulica Bianchi');
  await page.press('#s-co-name', 'Tab');
  await page.fill('#s-email', 'ufficio@esempio.it');
  await page.press('#s-email', 'Tab');
  await page.setInputFiles('#s-logo-in', `${SP}/img/logo.png`);
  await page.waitForSelector('#s-logo-img:not([hidden])');

  // backup con foto
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#s-backup-save')]);
  const zip = `${SP}/dl/${dl.suggestedFilename()}`;
  await dl.saveAs(zip);
  log('backup ->', dl.suggestedFilename(), fs.statSync(zip).size, 'byte |', await page.textContent('#s-backup-msg'));
  log('unzip ->', execSync(`unzip -Z1 ${zip}`).toString().trim().split('\n').join(', '));
  assert(/^Fiamma-backup-\d{4}-\d{2}-\d{2}\.zip$/.test(dl.suggestedFilename()), 'nome backup');
  assert(execSync(`unzip -t ${zip}`).toString().includes('No errors'), 'zip valido');
  log('ultima copia ->', await page.textContent('#s-backup-last'));
  // backup senza foto è più piccolo
  await page.uncheck('#s-backup-photos');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#s-backup-save')]);
  await dl2.saveAs(`${SP}/dl/nophotos.zip`);
  log('senza foto ->', fs.statSync(`${SP}/dl/nophotos.zip`).size, 'byte');
  assert(fs.statSync(`${SP}/dl/nophotos.zip`).size < fs.statSync(zip).size, 'più piccolo senza foto');

  // telefono azzerato e ripristino
  const snap = await page.evaluate(async () => JSON.stringify(await (await import('/store.js')).listReports()));
  await page.evaluate(async () => { const db = await import('/db.js'); await db.clear(db.REPORTS); await db.clear(db.PHOTOS); await db.remove(db.META, 'logo'); localStorage.clear(); });
  await page.reload();
  await page.waitForSelector('#view-home:not([hidden])');
  assert((await page.$$('#report-list > li:not([data-month])')).length === 0, 'vuoto');
  await page.click('#btn-settings');
  await page.waitForSelector('#view-settings:not([hidden])');
  await page.setInputFiles('#s-backup-in', zip);
  await page.waitForFunction(() => /Ripristinati/.test(document.getElementById('s-backup-msg').textContent));
  log('ripristino ->', await page.textContent('#s-backup-msg'));
  log('impostazioni ->', await page.inputValue('#s-co-name'), await page.inputValue('#s-email'), '| logo visibile:', await page.isVisible('#s-logo-img'));
  assert((await page.inputValue('#s-co-name')) === 'Termoidraulica Bianchi' && (await page.inputValue('#s-email')) === 'ufficio@esempio.it' && (await page.isVisible('#s-logo-img')), 'impostazioni e logo ripristinati');
  const snap2 = await page.evaluate(async () => JSON.stringify(await (await import('/store.js')).listReports()));
  assert(snap === snap2, 'rapporti identici');
  const photos = await page.evaluate(async () => { const db = await import('/db.js'); return (await db.getAll(db.PHOTOS)).length; });
  assert(photos === 2, 'foto ripristinate: ' + photos);
  // ripetere il ripristino non duplica
  await page.setInputFiles('#s-backup-in', zip);
  await page.waitForFunction(() => /Ripristinati 0 rapporti e 0 foto/.test(document.getElementById('s-backup-msg').textContent));
  log('secondo ripristino ->', await page.textContent('#s-backup-msg'));
  // i backup fatti con il nome precedente ("testo-qr") si leggono ancora
  const legacy = await page.evaluate(async () => { const { createZip } = await import('/zip.js'); const b = await createZip([{ name: 'reports.json', data: JSON.stringify({ format: 1, app: 'testo-qr', exportedAt: new Date().toISOString(), reports: [] }) }]); return Array.from(new Uint8Array(await b.arrayBuffer())); });
  fs.writeFileSync(`${SP}/dl/legacy.zip`, Buffer.from(legacy));
  await page.evaluate(() => { document.getElementById('s-backup-msg').textContent = ''; });
  await page.setInputFiles('#s-backup-in', `${SP}/dl/legacy.zip`);
  await page.waitForFunction(() => /Ripristinati 0 rapporti e 0 foto/.test(document.getElementById('s-backup-msg').textContent));
  log('backup del nome precedente -> ok');
  // file sbagliato
  fs.writeFileSync(`${SP}/dl/finto.zip`, 'non sono uno zip');
  await page.setInputFiles('#s-backup-in', `${SP}/dl/finto.zip`);
  await page.waitForFunction(() => /non riuscito/.test(document.getElementById('s-backup-msg').textContent));
  log('file sbagliato ->', await page.textContent('#s-backup-msg'));
  await page.screenshot({ path: `${SP}/shots5/15-settings-backup.png`, fullPage: true });
  await page.click('#btn-settings-back');
  await page.waitForSelector('#view-home:not([hidden])');
  assert((await page.$$('#report-list > li:not([data-month])')).length === 2, 'due rapporti in elenco');
  // dopo un backup recente niente promemoria
  log('promemoria dopo backup ->', (await page.$('#home-reminder button')) ? 'presente' : 'assente');
  assert((await page.$('#home-reminder button')) === null || !(await page.isVisible('#home-reminder button')), 'nessun promemoria dopo il backup');
  assert(errors.length === 0, 'errori: ' + errors.join(' // '));
  await browser.close();
  log('ok');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
