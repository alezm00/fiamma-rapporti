const { SP, FX, BASE, log, assert, until, run, start, finish } = require('./lib.cjs');
run(async () => {
  const session = await start();
  const { browser, ctx, page, errors, dialogs } = session;
  await page.waitForSelector('#view-home:not([hidden])');
  const home = () => page.waitForSelector('#view-home:not([hidden])');
  const editor = () => page.waitForSelector('#view-editor:not([hidden])');
  const titles = () => page.$$eval('#e-units > section > div h4', (h) => h.map((x) => x.textContent));
  const kinds = () => page.$$eval('#e-units > section', (s) => s.map((x) => x.dataset.kind));
  const stored = () => page.evaluate(async () => { const s = await import('/store.js'); const l = await s.listReports(); return l[0]?.plant; });
  const wait = (ms) => page.waitForTimeout(ms);

  // 1) un rapporto nuovo parte senza apparecchi: messaggio e tre tasti per aggiungerli
  await page.click('#btn-new'); await editor();
  assert((await titles()).length === 0, 'nessun apparecchio di partenza: ' + (await titles()));
  assert(await page.isVisible('#e-units-empty'), 'messaggio di elenco vuoto');
  for (const k of ['caldaia', 'pompa', 'condizionatore']) assert(await page.isVisible(`#e-add-${k}`), 'tasto per aggiungere ' + k);
  await page.screenshot({ path: `${SP}/shots5/20a-units-empty.png`, fullPage: true });
  await page.click('#e-add-caldaia');
  assert((await titles()).join() === 'Caldaia' && !(await page.isVisible('#e-units-empty')), 'caldaia aggiunta, messaggio sparito');
  const caldaiaFields = await page.$$eval('#e-units > section:first-child input, #e-units > section:first-child select', (e) => e.map((x) => x.id.replace(/^u0-/, '')));
  log('campi della caldaia ->', caldaiaFields.join(', '));
  assert(caldaiaFields.join() === 'brand,model,serial,installDate,fuel,chamber,technology,nominalPower,actualPower', 'campi della caldaia');

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
  assert(plant.units[1].charge === '1,45' && plant.units[1].refrigerant === 'r32' && plant.units[3].indoorUnits === '3', 'valori nei posti giusti');

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

  // 7) tolti tutti gli apparecchi: messaggio e di nuovo aggiungibili
  await page.click('#btn-new'); await editor();
  await page.click('#e-add-caldaia');
  await page.click('#u0-del');
  assert((await titles()).length === 0 && (await page.isVisible('#e-units-empty')), 'elenco vuoto con messaggio');
  await page.click('#e-add-condizionatore');
  assert((await titles()).join() === 'Condizionatore' && !(await page.isVisible('#e-units-empty')), 'riaggiunto');
  await page.click('#e-back'); await home();

  // 8) backup e ripristino conservano gli apparecchi
  const before = await page.evaluate(async () => JSON.stringify((await (await import('/store.js')).listReports()).map((r) => r.plant.units.map((u) => [u.kind, u.brand, u.model]))));
  const zip = await page.evaluate(async () => { const r = await (await import('/backup.js')).createBackup(); return Array.from(new Uint8Array(await r.blob.arrayBuffer())); });
  await page.evaluate(async () => { const db = await import('/db.js'); await db.clear(db.REPORTS); });
  await page.evaluate(async (z) => (await import('/backup.js')).restoreBackup(new Blob([new Uint8Array(z)])), zip);
  const after = await page.evaluate(async () => JSON.stringify((await (await import('/store.js')).listReports()).map((r) => r.plant.units.map((u) => [u.kind, u.brand, u.model]))));
  assert(before === after, 'apparecchi uguali dopo il ripristino');
  log('backup -> apparecchi conservati');

  // 9) un rapporto nuovo e vuoto (senza apparecchi) si scarta; con un apparecchio aggiunto resta
  const count = () => page.$$eval('#report-list > li:not([data-month])', (l) => l.length);
  const n0 = await count();
  await page.click('#btn-new'); await editor();
  await page.click('#e-back'); await home();
  assert((await count()) === n0, 'bozza vuota scartata');
  await page.click('#btn-new'); await editor();
  await page.click('#e-add-caldaia');
  await page.click('#e-back'); await home();
  assert((await count()) === n0 + 1, 'la bozza con un apparecchio resta');

  // 10) impostazioni: niente "Dati predefiniti"
  await page.click('#btn-settings'); await page.waitForSelector('#view-settings:not([hidden])');
  assert((await page.$('#s-defaults')) === null && (await page.$('#btn-defaults-clear')) === null, 'nessun riquadro Dati predefiniti');
  assert(!/predefinit/i.test(await page.innerText('#view-settings')), 'nessun riferimento ai dati predefiniti');
  await page.screenshot({ path: `${SP}/shots5/21-settings.png`, fullPage: true });
  await finish(session);
});
