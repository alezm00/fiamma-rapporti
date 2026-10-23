const { execSync } = require('child_process');
const fs = require('fs');
const { SP, FX, BASE, log, assert, until, run, start, finish } = require('./lib.cjs');
fs.mkdirSync(`${SP}/pdf5`, { recursive: true });
run(async () => {
  const session = await start();
  const { browser, ctx, page, errors, dialogs } = session;
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
  await page.click('#e-add-caldaia');
  await page.fill('#u0-brand', 'Beretta');
  await page.fill('#u0-model', 'Luna Duo-Tec MP 24');
  await page.fill('#u0-serial', 'SN-778899');
  await page.fill('#c-plate', 'ab12 cd34');
  await page.fill('#u0-installDate', '2019-05-14');
  await page.selectOption('#u0-chamber', 'forzata');
  await page.selectOption('#u0-technology', 'condensazione');
  await page.selectOption('#u0-fuel', 'metano');
  await page.fill('#u0-nominalPower', '24');
  await page.fill('#u0-actualPower', '22,5 kW');
  // una pompa di calore e due condizionatori nello stesso impianto
  await page.click('#e-add-pompa');
  await page.fill('#u1-brand', 'Daikin');
  await page.fill('#u1-model', 'Altherma 3');
  await page.selectOption('#u1-hpType', 'aria-acqua');
  await page.fill('#u1-nominalPower', '8');
  await page.fill('#u1-coolingPower', '7,5');
  await page.selectOption('#u1-refrigerant', 'r32');
  await page.fill('#u1-charge', '1,45');
  await page.click('#e-add-condizionatore');
  await page.fill('#u2-brand', 'LG');
  await page.fill('#u2-serial', 'AC-001');
  await page.selectOption('#u2-acType', 'monosplit');
  await page.selectOption('#u2-refrigerant', 'r32');
  await page.fill('#u2-charge', '0,8');
  await page.click('#e-add-condizionatore');
  await page.fill('#u3-brand', 'Mitsubishi');
  await page.selectOption('#u3-acType', 'multisplit');
  await page.fill('#u3-indoorUnits', '3');
  await page.selectOption('#u3-refrigerant', 'r410a');
  await page.fill('#u3-charge', '2,1');
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
  for (const needle of ['Luna Duo-Tec MP 24', 'Forzata', 'A condensazione', 'Metano', '24 kW', '22,5 kW', 'POMPA DI CALORE', 'Altherma 3', 'Aria-acqua', '7,5 kW', '1,45 kg', 'CONDIZIONATORE 1', 'CONDIZIONATORE 2', 'Mitsubishi', 'Multisplit', 'R410A', '2,1 kg', 'AC-001', '1 caldaia, 1 pompa di calore, 2 condizionatori']) assert(txt.includes(needle), 'nel PDF: ' + needle);
  const info = execSync(`pdfinfo ${p}`).toString();
  log(info.split('\n').filter((l) => /Pages|Title|Producer/.test(l)).join(' | '));
  execSync(`pdftoppm -r 70 -png ${p} ${SP}/pdf5/chiuso`);
  log('immagini:', execSync(`pdfimages -list ${p}`).toString().split('\n').length - 3);
  // una sola misura (non affiancata): sotto la tabella ci sono i dati della misura, con le fasi della prova
  const json = JSON.parse(require('zlib').gunzipSync(fs.readFileSync(`${FX}/sample-10389.json.gz`)).toString());
  const solo = await page.evaluate(async (j) => {
    const m = await import('/src/model/index.js'); const r = await import('/src/pdf/index.js');
    const doc = m.newReport({ id: 'soloM001' });
    m.addMeasure(doc, j, { label: 'Prima' });
    return Array.from(await r.createReportPdf(doc, {}, {}));
  }, json);
  fs.writeFileSync(`${SP}/pdf5/solo.pdf`, Buffer.from(solo));
  const soloTxt = execSync(`pdftotext -layout ${SP}/pdf5/solo.pdf -`).toString();
  log('fasi nel PDF ->', soloTxt.split('\n').filter((l) => /Fase \d/.test(l)).map((l) => l.trim()).join(' | '));
  assert(/Fase 1 \(1 min 00 s\)/.test(soloTxt) && /Fase 3 \(1 min 00 s\)/.test(soloTxt) && (soloTxt.match(/\d\d:\d\d:\d\d → \d\d:\d\d:\d\d/g) || []).length === 3, 'fasi della prova nel PDF (etichetta con durata, tre intervalli di orari)');
  // compatto: nella prima pagina ci stanno già intervento, lavori e materiali (con 4 apparecchi)
  const page1 = execSync(`pdftotext -f 1 -l 1 -layout ${SP}/pdf5/chiuso.pdf -`).toString();
  assert(/INTERVENTO/.test(page1) && /LAVORI ESEGUITI/.test(page1) && /MATERIALI/.test(page1), 'prima pagina compatta: intervento, lavori, materiali');
  // foto grandi: al massimo 4 per foglio (due righe)
  const six = await page.evaluate(async () => {
    const s = await import('/src/data/store.js'); const p = await import('/src/data/photos.js'); const r = await import('/src/pdf/index.js');
    const doc = (await s.listReports())[0];
    const one = await p.photosForPdf(doc.id);
    return Array.from(await r.createReportPdf(doc, {}, { photos: [...one, ...one] }));
  });
  fs.writeFileSync(`${SP}/pdf5/sei-foto.pdf`, Buffer.from(six));
  const pages = Number(execSync(`pdfinfo ${SP}/pdf5/sei-foto.pdf`).toString().match(/Pages:\s+(\d+)/)[1]);
  const perPage = [];
  for (let n = 1; n <= pages; n++) perPage.push((execSync(`pdftotext -f ${n} -l ${n} ${SP}/pdf5/sei-foto.pdf -`).toString().match(/^Foto \d+$/gm) || []).length);
  log('sei foto -> pagine:', pages, '| foto per pagina:', perPage.join(','));
  assert(perPage.reduce((a, b) => a + b, 0) === 6 && Math.max(...perPage) <= 4, 'al massimo 4 foto per pagina: ' + perPage);
  await finish(session);
});
