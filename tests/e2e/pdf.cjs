const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const [SP, FX, BASE = 'http://localhost:8801/'] = process.argv.slice(2);
const log = (...a) => console.log('•', ...a);
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); };
fs.mkdirSync(`${SP}/pdf5`, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'it-IT', timezoneId: 'Europe/Rome', acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE);
  await page.waitForSelector('#view-home:not([hidden])');

  // impostazioni: ditta, logo, numerazione
  await page.click('#btn-settings');
  await page.waitForSelector('#view-settings:not([hidden])');
  await page.fill('#s-co-name', 'Termoidraulica Bianchi S.r.l.');
  await page.fill('#s-co-vat', '01234567890');
  await page.fill('#s-co-address', 'Via dell\'Artigianato 12\n33170 Pordenone PN');
  await page.fill('#s-co-phone', '0434 123123');
  await page.fill('#s-co-email', 'info@bianchi.example');
  await page.fill('#s-co-technician', 'Luca Bianchi');
  await page.setInputFiles('#s-logo-in', `${SP}/img/logo.png`);
  await page.waitForSelector('#s-logo-img:not([hidden])');
  await page.fill('#s-next', '12');
  await page.dispatchEvent('#s-next', 'change');
  log('numerazione ->', await page.textContent('#s-next-hint'));
  await page.fill('#s-email', 'ufficio@bianchi.example');
  await page.screenshot({ path: `${SP}/shots5/9-settings-company.png`, fullPage: true });
  await page.click('#btn-settings-back');
  await page.waitForSelector('#view-home:not([hidden])');

  // rapporto completo
  await page.click('#btn-new');
  await page.waitForSelector('#view-editor:not([hidden])');
  await page.fill('#c-name', 'Mario Rossi');
  await page.fill('#c-cf', 'RSSMRA80A01H501U');
  await page.fill('#c-address', 'Via Roma 1\n33170 Pordenone PN');
  await page.fill('#c-phone', '333 1234567');
  await page.fill('#c-brand', 'Beretta');
  await page.fill('#c-model', 'Luna Duo-Tec MP 24');
  await page.fill('#c-serial', 'SN-778899');
  await page.fill('#c-plate', 'ab12 cd34');
  await page.fill('#c-date', '2019-05-14');
  await page.selectOption('#c-chamber', 'forzata');
  await page.selectOption('#c-technology', 'condensazione');
  await page.selectOption('#c-fuel', 'metano');
  await page.fill('#c-power-nom', '24');
  await page.fill('#c-power-real', '22,5 kW');
  await page.selectOption('#e-type', 'ordinaria');
  await page.selectOption('#e-outcome', 'ok');
  await page.fill('#e-work', 'Pulizia scambiatore e bruciatore.\nControllo valvola gas e verifica tiraggio 😀 → ok.\n\nSostituita guarnizione del vaso di espansione.');
  for (const [t, q] of [['Guarnizione DN20', '2'], ['Anodo di magnesio', '1 pz'], ['Sifone condensa con descrizione molto lunga che deve andare a capo su più righe nel PDF', '1']]) {
    await page.click('#e-mat-add');
    const rows = await page.$$('#e-materials > div');
    const last = rows[rows.length - 1];
    await (await last.$('input:nth-child(1)')).fill(t);
    await (await last.$('input:nth-child(2)')).fill(q);
  }
  await page.fill('#e-start', '09:10');
  await page.fill('#e-end', '10:35');
  await page.fill('#c-notes', 'Consigliata sostituzione del vaso di espansione entro l\'anno.\nProssimo controllo tra 12 mesi.');
  await page.setInputFiles('#in-gallery', [`${SP}/img/landscape.jpg`, `${SP}/img/small00.jpg`, `${SP}/img/portrait_exif6.jpg`]);
  await page.waitForFunction(() => document.querySelectorAll('#photo-grid > div').length === 3, null, { timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('photo-msg').hidden);
  // misure: due dello stesso tipo + una di tipo diverso
  for (const f of ['sample-10389.json.gz', 'sample-10389-b.json.gz', 't400.json.gz']) {
    await page.click('#e-measure-add');
    await page.waitForSelector('#view-scan:not([hidden])');
    await page.setInputFiles('#in-file', `${FX}/${f}`);
    await page.waitForSelector('#view-measure:not([hidden])');
    log('misura', f, '->', await page.inputValue('#m-label'));
    await page.click('#m-back');
    await page.waitForSelector('#view-editor:not([hidden])');
  }

  const savePdf = async (name) => { const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-pdf-save')]); const p = `${SP}/pdf5/${name}.pdf`; await dl.saveAs(p); return [p, dl.suggestedFilename()]; };
  // bozza
  let [p, fname] = await savePdf('bozza');
  log('bozza ->', fname, '|', await page.textContent('#report-msg'));
  assert(/^Bozza_\d{4}-\d{2}-\d{2}_Mario-Rossi\.pdf$/.test(fname), 'nome file bozza');
  // chiudi e rifai
  await page.click('#btn-close');
  await page.waitForFunction(() => /Rapporto n\./.test(document.getElementById('e-title').textContent));
  log('numero ->', await page.textContent('#e-title'));
  assert((await page.textContent('#e-title')).includes('2026/012'), 'numero 2026/012');
  [p, fname] = await savePdf('chiuso');
  log('chiuso ->', fname);
  assert(fname === 'Rapporto_2026-012_Mario-Rossi.pdf', 'nome file chiuso');
  const txt = execSync(`pdftotext -layout ${p} -`).toString();
  fs.writeFileSync(`${SP}/pdf5/chiuso.txt`, txt);
  console.log(txt);
  for (const needle of ['Luna Duo-Tec MP 24', 'Forzata', 'A condensazione', 'Metano', '24 kW', '22,5 kW']) assert(txt.includes(needle), 'nel PDF: ' + needle);
  const info = execSync(`pdfinfo ${p}`).toString();
  log(info.split('\n').filter((l) => /Pages|Title|Producer/.test(l)).join(' | '));
  execSync(`pdftoppm -r 70 -png ${p} ${SP}/pdf5/chiuso`);
  log('immagini:', execSync(`pdfimages -list ${p}`).toString().split('\n').length - 3);
  assert(errors.length === 0, 'errori: ' + errors.join(' // '));
  await browser.close();
  log('ok');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
