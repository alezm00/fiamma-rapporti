const { SP, FX, BASE, log, assert, until, run, start, finish } = require('./lib.cjs');
run(async () => {
  const session = await start();
  const { browser, ctx, page, errors, dialogs } = session;
  await page.waitForSelector('#view-home:not([hidden])');
  const rows = () => page.$$eval('#report-list > li:not([data-month])', (l) => l.length);
  const trashRows = () => page.$$eval('#trash-list > li', (l) => l.length);
  const photoCount = () => page.evaluate(async () => { const db = await import('/src/data/db.js'); return (await db.getAll(db.PHOTOS)).length; });
  const onHome = () => page.waitForSelector('#view-home:not([hidden])');
  const listIds = () => page.evaluate(async () => { const s = await import('/src/data/store.js'); return [(await s.listReports()).length, (await s.listTrash()).length]; });

  // due rapporti: A (chiuso, con foto e misura), B (bozza)
  const make = async (name, close) => {
    await page.click('#btn-new');
    await page.waitForSelector('#view-editor:not([hidden])');
    await page.fill('#c-name', name);
    if (close) {
      await page.setInputFiles('#in-gallery', [`${SP}/img/small00.jpg`]);
      await page.waitForFunction(() => document.querySelectorAll('#photo-grid > div').length === 1, null, { timeout: 30000 });
      await page.waitForFunction(() => document.getElementById('photo-msg').hidden);
      await page.click('#e-measure-add');
      await page.setInputFiles('#in-file', `${FX}/sample-10389.json.gz`);
      await page.waitForSelector('#view-measure:not([hidden])');
      await page.click('#m-back');
      await page.waitForSelector('#view-editor:not([hidden])');
      await page.click('#btn-close');
      await page.waitForFunction(() => /Rapporto n\./.test(document.getElementById('e-title').textContent));
    }
    await page.click('#e-back');
    await onHome();
  };
  await make('Anna Verdi', true);
  await make('Bruno Neri', false);
  assert((await rows()) === 2 && !(await page.isVisible('#h-trash')), 'due rapporti, nessun cestino');
  const numA = await page.evaluate(async () => (await (await import('/src/data/store.js')).listReports()).find((r) => r.customer.name === 'Anna Verdi').number);

  // elimina A dall'editor: finisce nel cestino, con foto e misura
  await page.fill('#h-search', 'anna');
  await page.click('#report-list li button');
  await page.waitForSelector('#view-editor:not([hidden])');
  dialogs.length = 0;
  await page.click('#btn-delete');
  await onHome();
  log('conferma ->', JSON.stringify(dialogs[0]));
  assert(/cestino/.test(dialogs[0]) && /30 giorni/.test(dialogs[0]), 'conferma cestino');
  await page.fill('#h-search', '');
  assert((await rows()) === 1 && (await page.isVisible('#h-trash')) && (await page.textContent('#h-trash')) === 'Cestino (1)', 'A tolta dall\'elenco, Cestino (1)');
  assert((await photoCount()) === 1, 'la foto c\'è ancora');
  assert((await listIds()).join() === '1,1', 'archivio: 1 rapporto e 1 nel cestino');
  await page.screenshot({ path: `${SP}/shots5/18-home-trash-link.png` });

  // schermata Cestino
  await page.click('#h-trash');
  await page.waitForSelector('#view-trash:not([hidden])');
  const row = (await page.textContent('#trash-list')).replace(/\s+/g, ' ');
  log('cestino ->', row);
  assert(row.includes(`N. ${numA}`) && row.includes('Anna Verdi') && /30 giorni rimasti/.test(row) && row.includes('1 misura') && row.includes('1 foto'), 'riga del cestino');
  await page.screenshot({ path: `${SP}/shots5/19-trash.png` });
  // ripristina: torna com'era (numero e stato conservati)
  await page.click('#trash-list li button:first-of-type');
  await page.waitForFunction(() => document.querySelectorAll('#trash-list > li').length === 0);
  assert(await page.isVisible('#trash-empty') && !(await page.isVisible('#t-empty')), 'cestino vuoto');
  await page.click('#t-back');
  await onHome();
  assert((await rows()) === 2 && !(await page.isVisible('#h-trash')), 'A di nuovo in elenco');
  const back = await page.evaluate(async () => (await (await import('/src/data/store.js')).listReports()).find((r) => r.customer.name === 'Anna Verdi'));
  assert(back.number === numA && back.status === 'done' && back.measures.length === 1 && !back.deletedAt, 'numero, stato e misura conservati');

  // elimina per sempre dal cestino
  await page.fill('#h-search', 'anna');
  await page.click('#report-list li button');
  await page.waitForSelector('#view-editor:not([hidden])');
  await page.click('#btn-delete');
  await onHome();
  await page.fill('#h-search', '');
  await page.click('#h-trash');
  await page.waitForSelector('#view-trash:not([hidden])');
  dialogs.length = 0;
  await page.click('#trash-list li button:last-of-type');
  await page.waitForFunction(() => document.querySelectorAll('#trash-list > li').length === 0);
  log('per sempre ->', JSON.stringify(dialogs[0]));
  assert(/per sempre/.test(dialogs[0]), 'conferma definitiva');
  assert((await photoCount()) === 0 && (await listIds()).join() === '1,0', 'rapporto e foto eliminati');
  await page.click('#t-back');
  await onHome();

  // una bozza mai compilata non passa dal cestino
  await page.click('#btn-new');
  await page.waitForSelector('#view-editor:not([hidden])');
  dialogs.length = 0;
  await page.click('#btn-delete');
  await onHome();
  assert(dialogs.length === 0 && (await listIds()).join() === '1,0', 'bozza vuota eliminata senza cestino');

  // scadenza: 31 giorni = via; 29 giorni = resta con "1 giorno"
  await page.evaluate(async () => {
    const db = await import('/src/data/db.js'); const model = await import('/src/model/index.js');
    for (const [id, days] of [['vecchio01', 31], ['recente01', 29.5]]) {
      const d = model.newReport({ id }); d.customer.name = id; d.deletedAt = Date.now() - days * 86400000; await db.put(db.REPORTS, d);
    }
  });
  await page.reload();
  await onHome();
  assert((await page.textContent('#h-trash')) === 'Cestino (1)', 'il vecchio è già andato via: ' + (await page.textContent('#h-trash')));
  assert((await listIds()).join() === '1,1', 'archivio dopo la scadenza');
  await page.click('#h-trash');
  await page.waitForSelector('#view-trash:not([hidden])');
  assert(/1 giorno rimasti/.test(await page.textContent('#trash-list')), 'un giorno rimasto');
  // svuota il cestino
  dialogs.length = 0;
  await page.click('#t-empty');
  await page.waitForFunction(() => document.querySelectorAll('#trash-list > li').length === 0);
  assert(/per sempre/.test(dialogs[0]) && (await listIds()).join() === '1,0', 'cestino svuotato');
  await page.click('#t-back');
  await onHome();

  // il backup conserva il cestino
  await page.fill('#h-search', 'bruno');
  await page.click('#report-list li button');
  await page.waitForSelector('#view-editor:not([hidden])');
  await page.click('#btn-delete');
  await onHome();
  const zipBytes = await page.evaluate(async () => { const b = await import('/src/backup/zip-backup.js'); const r = await b.createBackup(); return Array.from(new Uint8Array(await r.blob.arrayBuffer())); });
  await page.evaluate(async () => { const db = await import('/src/data/db.js'); await db.clear(db.REPORTS); await db.clear(db.PHOTOS); });
  assert((await listIds()).join() === '0,0', 'archivio vuoto');
  await page.evaluate(async (bytes) => { const b = await import('/src/backup/zip-backup.js'); await b.restoreBackup(new Blob([new Uint8Array(bytes)])); }, zipBytes);
  assert((await listIds()).join() === '0,1', 'dopo il ripristino è ancora nel cestino');
  log('backup -> il cestino si ripristina com\'era');

  // cartella di salvataggio: dal cestino sparisce dalla cartella, ripristinando torna
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry('SD-card', { recursive: true }).catch(() => {});
    const dest = await root.getDirectoryHandle('SD-card', { create: true });
    window.__dest = dest;
    await (await import('/src/backup/folder/index.js')).linkHandle(dest);
  });
  const tree = () => page.evaluate(async () => { const out = []; const walk = async (d, p) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, p + n + '/'); else out.push(p + n); } }; await walk(window.__dest, ''); return out.sort(); });
  const process = () => page.evaluate(async () => (await import('/src/backup/folder/index.js')).process());
  await process();
  assert(!(await tree()).some((f) => f.endsWith('rapporto.json')), 'nel cestino: niente in cartella');
  const id = await page.evaluate(async () => (await (await import('/src/data/store.js')).listTrash())[0].id);
  await page.evaluate(async (i) => (await import('/src/data/store.js')).restoreReport(i), id);
  await until(async () => { await process(); return (await tree()).some((f) => f.endsWith('rapporto.json')); });
  log('ripristinato -> in cartella:', (await tree()).filter((f) => f.endsWith('rapporto.json'))[0]);
  await page.evaluate(async (i) => (await import('/src/data/store.js')).trashReport(i), id);
  await until(async () => { await process(); return !(await tree()).some((f) => f.endsWith('rapporto.json')); });
  log('di nuovo nel cestino -> tolto dalla cartella');

  await finish(session);
});
