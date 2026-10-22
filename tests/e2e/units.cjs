const { chromium } = require('playwright');
const [SP, FX, BASE = 'http://localhost:8801/'] = process.argv.slice(2);
const log = (...a) => console.log('•', ...a);
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message + ' @ ' + String(e.stack).split('\n').slice(1, 3).join(' | '))); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const dialogs = []; page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
  await page.goto(BASE);
  await page.waitForSelector('#view-home:not([hidden])');
  const home = () => page.waitForSelector('#view-home:not([hidden])');
  const editor = () => page.waitForSelector('#view-editor:not([hidden])');
  const titles = () => page.$$eval('#e-units > section > div h4', (h) => h.map((x) => x.textContent));
  const kinds = () => page.$$eval('#e-units > section', (s) => s.map((x) => x.dataset.kind));
  const stored = () => page.evaluate(async () => { const s = await import('/store.js'); const l = await s.listReports(); return l[0]?.plant; });
  const wait = (ms) => page.waitForTimeout(ms);

  // 1) un rapporto nuovo parte con una caldaia (come prima)
  await page.click('#btn-new'); await editor();
  assert((await titles()).join() === 'Caldaia', 'una caldaia di partenza: ' + (await titles()));
  const caldaiaFields = await page.$$eval('#e-units > section:first-child input, #e-units > section:first-child select', (e) => e.map((x) => x.id.replace(/^u0-/, '')));
  log('campi della caldaia ->', caldaiaFields.join(', '));
  assert(caldaiaFields.join() === 'brand,model,serial,installDate,fuel,chamber,technology,nominalPower,actualPower', 'campi della caldaia');
  assert(!(await page.isVisible('#e-units-empty')), 'niente messaggio di elenco vuoto');

  // 2) pompa di calore, condizionatori, seconda caldaia: campi e numerazione dei titoli
  await page.click('#e-add-pompa');
  assert((await titles()).join() === 'Caldaia,Pompa di calore', 'pompa aggiunta');
  const pompa = await page.$$eval('#e-units > section:nth-child(2) input, #e-units > section:nth-child(2) select', (e) => e.map((x) => x.id.replace(/^u1-/, '')));
  log('campi della pompa di calore ->', pompa.join(', '));
  assert(pompa.join() === 'brand,model,serial,installDate,hpType,nominalPower,coolingPower,refrigerant,charge', 'campi della pompa');
  assert((await page.$('#u1-fuel')) === null, 'la pompa non ha il combustibile');
  const refrigerants = await page.$$eval('#u1-refrigerant option', (o) => o.map((x) => x.textContent));
  assert(refrigerants.join() === 'Non indicato,R32,R410A,R290,R134a,R407C,R454B,R744,Altro', 'gas refrigeranti: ' + refrigerants);
  await page.click('#e-add-condizionatore');
  await page.click('#e-add-condizionatore');
  const cond = await page.$$eval('#e-units > section:nth-child(3) input, #e-units > section:nth-child(3) select', (e) => e.map((x) => x.id.replace(/^u2-/, '')));
  assert(cond.join() === 'brand,model,serial,installDate,acType,indoorUnits,coolingPower,nominalPower,refrigerant,charge', 'campi del condizionatore: ' + cond);
  assert((await titles()).join() === 'Caldaia,Pompa di calore,Condizionatore 1,Condizionatore 2', 'titoli: ' + (await titles()));
  await page.click('#e-add-caldaia');
  assert((await titles()).join() === 'Caldaia 1,Pompa di calore,Condizionatore 1,Condizionatore 2,Caldaia 2', 'due caldaie numerate: ' + (await titles()));
  assert((await kinds()).join() === 'caldaia,pompa,condizionatore,condizionatore,caldaia', 'tipi in ordine');

  // 3) compila e controlla che si salvi nel posto giusto
  await page.fill('#c-name', 'Impianto Misto');
  await page.fill('#c-plate', 'xy99');
  await page.fill('#u0-brand', 'Beretta');
  await page.selectOption('#u0-fuel', 'metano');
  await page.fill('#u1-brand', 'Daikin');
  await page.fill('#u1-model', 'Altherma 3');
  await page.selectOption('#u1-refrigerant', 'r32');
  await page.fill('#u1-charge', '1,45');
  await page.fill('#u2-brand', 'LG');
  await page.selectOption('#u2-acType', 'monosplit');
  await page.fill('#u3-brand', 'Mitsubishi');
  await page.fill('#u3-indoorUnits', '3');
  await page.fill('#u4-brand', 'Vaillant');
  await page.fill('#u4-serial', 'VA-42');
  await wait(800);
  await page.screenshot({ path: `${SP}/shots5/20-units.png`, fullPage: true });
  let plant = await stored();
  log('salvato ->', JSON.stringify(plant.units.map((u) => `${u.kind}:${u.brand}`)), '| targa', plant.plateCode);
  assert(plant.units.map((u) => `${u.kind}:${u.brand}`).join() === 'caldaia:Beretta,pompa:Daikin,condizionatore:LG,condizionatore:Mitsubishi,caldaia:Vaillant', 'apparecchi salvati');
  assert(plant.units[1].charge === '1,45' && plant.units[1].refrigerant === 'r32' && plant.units[3].indoorUnits === '3' && !('brand' in plant) && !('fuel' in plant), 'valori nei posti giusti, niente campi vecchi in plant');

  // 4) tolto un apparecchio vuoto: senza conferma; uno compilato: con conferma e titoli rinumerati
  await page.click('#e-add-pompa');
  assert((await titles()).length === 6, 'sesto apparecchio');
  dialogs.length = 0;
  await page.click('#u5-del');
  assert(dialogs.length === 0 && (await titles()).length === 5, 'vuoto: tolto senza conferma');
  await page.click('#u2-del'); // LG (compilato)
  log('conferma ->', JSON.stringify(dialogs[0]));
  assert(/Condizionatore 1/.test(dialogs[0]) && (await titles()).join() === 'Caldaia 1,Pompa di calore,Condizionatore,Caldaia 2', 'compilato: conferma e titoli rinumerati: ' + (await titles()));

  // 5) ricerca per modello e matricola di qualunque apparecchio; riaprendo il rapporto i dati ci sono
  await page.click('#e-back'); await home();
  await page.fill('#h-search', 'altherma');
  assert((await page.$$('#report-list > li:not([data-month])')).length === 1, 'ricerca per modello della pompa');
  await page.fill('#h-search', 'va-42');
  assert((await page.$$('#report-list > li:not([data-month])')).length === 1, 'ricerca per matricola della seconda caldaia');
  await page.fill('#h-search', 'xy99');
  assert((await page.$$('#report-list > li:not([data-month])')).length === 1, 'ricerca per targa');
  await page.fill('#h-search', '');
  await page.reload(); await home();
  await page.click('#report-list li button'); await editor();
  assert((await titles()).join() === 'Caldaia 1,Pompa di calore,Condizionatore,Caldaia 2', 'dopo il ricaricamento: stessi apparecchi');
  assert((await page.inputValue('#u1-model')) === 'Altherma 3' && (await page.inputValue('#u1-refrigerant')) === 'r32' && (await page.inputValue('#u3-serial')) === 'VA-42', 'valori dopo il ricaricamento');

  // 6) duplica: gli stessi apparecchi, indipendenti
  await page.click('#btn-duplicate');
  for (let i = 0; i < 50 && (await page.evaluate(async () => (await (await import('/store.js')).listReports()).length)) < 2; i++) await wait(100);
  await wait(500); // il nuovo rapporto si apre al posto del vecchio
  assert((await titles()).join() === 'Caldaia 1,Pompa di calore,Condizionatore,Caldaia 2' && (await page.inputValue('#u1-model')) === 'Altherma 3', 'duplicato con gli apparecchi');
  await page.fill('#u1-model', 'Altherma 4');
  await wait(700);
  const both = await page.evaluate(async () => (await (await import('/store.js')).listReports()).map((r) => r.plant.units[1].model).sort());
  assert(both.join() === 'Altherma 3,Altherma 4', 'copie indipendenti: ' + both);
  await page.click('#e-back'); await home();

  // 7) nessun apparecchio: messaggio e di nuovo aggiungibili
  await page.click('#btn-new'); await editor();
  await page.click('#u0-del');
  assert((await titles()).length === 0 && (await page.isVisible('#e-units-empty')), 'elenco vuoto con messaggio');
  await page.click('#e-add-condizionatore');
  assert((await titles()).join() === 'Condizionatore' && !(await page.isVisible('#e-units-empty')), 'riaggiunto');
  await page.click('#e-back'); await home();

  // 8) rapporto salvato con la scheda dell'impianto di prima: si legge come una caldaia
  await page.evaluate(async () => {
    const db = await import('/db.js'); const model = await import('/model.js');
    const d = model.newReport({ id: 'vecchio-001' });
    d.customer.name = 'Cliente Vecchio';
    d.plant = { brand: 'Junkers', model: 'Cerapur', serial: 'JK-5', plateCode: 'OLD1', installDate: '2015-02-03', chamber: 'forzata', technology: 'condensazione', fuel: 'gpl', nominalPower: '24', actualPower: '22' };
    await db.put(db.REPORTS, d);
  });
  await page.reload(); await home();
  await page.fill('#h-search', 'cerapur');
  assert((await page.$$('#report-list > li:not([data-month])')).length === 1, 'si trova per modello anche se salvato nel formato di prima');
  await page.click('#report-list li button'); await editor();
  assert((await titles()).join() === 'Caldaia' && (await page.inputValue('#u0-brand')) === 'Junkers' && (await page.inputValue('#u0-fuel')) === 'gpl' && (await page.inputValue('#u0-installDate')) === '2015-02-03' && (await page.inputValue('#c-plate')) === 'OLD1', 'caldaia ricavata dal formato di prima');
  await page.click('#e-add-pompa');
  await wait(800);
  const migrated = await page.evaluate(async () => (await (await import('/db.js')).get((await import('/db.js')).REPORTS, 'vecchio-001')).plant);
  assert(migrated.units.length === 2 && !('brand' in migrated) && migrated.units[0].brand === 'Junkers', 'salvato nel formato nuovo');
  log('formato di prima -> caldaia + pompa salvate nel formato nuovo');
  await page.click('#e-back'); await home();

  // 9) backup e ripristino conservano gli apparecchi
  const before = await page.evaluate(async () => JSON.stringify((await (await import('/store.js')).listReports()).map((r) => r.plant.units.map((u) => [u.kind, u.brand, u.model]))));
  const zip = await page.evaluate(async () => { const r = await (await import('/backup.js')).createBackup(); return Array.from(new Uint8Array(await r.blob.arrayBuffer())); });
  await page.evaluate(async () => { const db = await import('/db.js'); await db.clear(db.REPORTS); });
  await page.evaluate(async (z) => (await import('/backup.js')).restoreBackup(new Blob([new Uint8Array(z)])), zip);
  const after = await page.evaluate(async () => JSON.stringify((await (await import('/store.js')).listReports()).map((r) => r.plant.units.map((u) => [u.kind, u.brand, u.model]))));
  assert(before === after, 'apparecchi uguali dopo il ripristino');
  log('backup -> apparecchi conservati');

  // 10) impostazioni: apparecchio dei nuovi rapporti
  await page.click('#btn-settings');
  await page.waitForSelector('#view-settings:not([hidden])');
  assert((await page.inputValue('#s-d-unitkind')) === 'caldaia', 'predefinito: caldaia');
  await page.selectOption('#s-d-unitkind', 'pompa');
  const defFields = await page.$$eval('#s-d-unit input, #s-d-unit select', (e) => e.map((x) => x.id.replace('s-d-u-', '')));
  assert(defFields.join() === 'brand,model,serial,installDate,hpType,nominalPower,coolingPower,refrigerant,charge', 'campi predefiniti della pompa: ' + defFields);
  await page.fill('#s-d-u-brand', 'Daikin');
  await page.selectOption('#s-d-u-refrigerant', 'r32');
  await page.selectOption('#s-d-unitkind', 'caldaia');
  await page.fill('#s-d-u-fuel', '').catch(() => {});
  await page.selectOption('#s-d-u-fuel', 'metano');
  await page.selectOption('#s-d-unitkind', 'pompa');
  assert((await page.inputValue('#s-d-u-brand')) === 'Daikin' && (await page.inputValue('#s-d-u-refrigerant')) === 'r32', 'cambiando tipo i valori comuni restano');
  await page.selectOption('#s-d-unitkind', 'caldaia');
  assert((await page.inputValue('#s-d-u-fuel')) === 'metano', 'e quelli dell\'altro tipo si ritrovano');
  await page.selectOption('#s-d-unitkind', 'pompa');
  await page.screenshot({ path: `${SP}/shots5/21-settings-units.png`, fullPage: true });
  await page.click('#btn-settings-back'); await home();
  await page.click('#btn-new'); await editor();
  assert((await titles()).join() === 'Pompa di calore' && (await page.inputValue('#u0-brand')) === 'Daikin' && (await page.inputValue('#u0-refrigerant')) === 'r32', 'nuovo rapporto con la pompa predefinita');
  await page.click('#e-back'); await home();
  // nessun apparecchio
  await page.click('#btn-settings'); await page.waitForSelector('#view-settings:not([hidden])');
  await page.selectOption('#s-d-unitkind', 'none');
  assert((await page.$$('#s-d-unit > *')).length === 0, 'nessun campo con "Nessuno"');
  await page.click('#btn-settings-back'); await home();
  await page.click('#btn-new'); await editor();
  assert((await titles()).length === 0 && (await page.isVisible('#e-units-empty')), 'nuovo rapporto senza apparecchi');
  // aggiungere un apparecchio lo rende "compilato": la bozza non si scarta
  await page.click('#e-add-caldaia');
  await page.click('#e-back'); await home();
  await page.fill('#h-search', '');
  assert((await page.$$('#report-list > li:not([data-month])')).length >= 3, 'la bozza con un apparecchio resta');
  // svuota i dati predefiniti: torna la caldaia
  await page.click('#btn-settings'); await page.waitForSelector('#view-settings:not([hidden])');
  await page.click('#btn-defaults-clear');
  assert((await page.inputValue('#s-d-unitkind')) === 'caldaia' && (await page.inputValue('#s-d-u-brand')) === '', 'svuotati: di nuovo caldaia');
  assert(errors.length === 0, 'errori: ' + errors.join(' // '));
  await browser.close();
  log('ok');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
