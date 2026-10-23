const { SP, FX, BASE, log, assert, until, run, start, open, finish } = require('./lib.cjs');
run(async () => {
  const session = await start({ ignoreErrors: /QuotaExceeded|piena/ });
  const { browser, ctx, page, errors, dialogs } = session;
  await page.waitForSelector('#view-home:not([hidden])');
  const saveText = () => page.textContent('#e-save');
  const failWrites = () => page.evaluate(() => { window.__put = window.__put || IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('piena', 'QuotaExceededError'); }; });
  const allowWrites = () => page.evaluate(() => { IDBObjectStore.prototype.put = window.__put; });

  // 1) salvataggio normale: la scritta dice quando
  await page.click('#btn-new');
  await page.waitForSelector('#view-editor:not([hidden])');
  log('appena aperto ->', await saveText());
  assert(/^Salvato \d\d:\d\d$/.test(await saveText()), 'scritta iniziale');
  await page.fill('#c-name', 'Mario Rossi');
  await until(async () => (await page.evaluate(async () => (await (await import('/store.js')).listReports())[0]?.customer.name)) === 'Mario Rossi');
  await until(async () => /^Salvato \d\d:\d\d$/.test(await saveText()));
  log('dopo il salvataggio ->', await saveText());

  // 2) memoria piena: scritta rossa, messaggio, dati ancora a schermo
  await failWrites();
  await page.fill('#c-name', 'Mario Rossi Verdi');
  await until(async () => /NON SALVATO/.test(await saveText()));
  log('con errore ->', await saveText(), '|', (await page.textContent('#report-msg')).trim().slice(0, 90));
  assert(/memoria piena/.test(await page.textContent('#report-msg')) && /memoria piena/.test(await page.getAttribute('#e-save', 'title')), 'motivo leggibile');
  assert(await page.isVisible('#report-msg') && (await page.getAttribute('#report-msg', 'data-type')) === 'error', 'messaggio di errore');
  assert((await page.inputValue('#c-name')) === 'Mario Rossi Verdi', 'il testo resta a schermo');
  await page.screenshot({ path: `${SP}/shots5/16-save-error.png`, fullPage: false });
  // nel database c'è ancora il vecchio nome
  assert((await page.evaluate(async () => (await (await import('/store.js')).listReports())[0].customer.name)) === 'Mario Rossi', 'non salvato');

  // 3) tocco sulla scritta con la scrittura di nuovo possibile: salva
  await allowWrites();
  await page.click('#e-save');
  await until(async () => /^Salvato \d\d:\d\d$/.test(await saveText()));
  assert((await page.evaluate(async () => (await (await import('/store.js')).listReports())[0].customer.name)) === 'Mario Rossi Verdi', 'salvato dopo il tocco');
  log('dopo il tocco ->', await saveText());

  // 4) l'errore sparisce anche con una modifica successiva
  await failWrites();
  await page.fill('#c-phone', '0434 1');
  await until(async () => /NON SALVATO/.test(await saveText()));
  await allowWrites();
  await page.fill('#c-phone', '0434 123123');
  await until(async () => /^Salvato/.test(await saveText()));
  assert((await page.evaluate(async () => (await (await import('/store.js')).listReports())[0].customer.phone)) === '0434 123123', 'salvato alla modifica successiva');
  log('ritenta alla modifica successiva -> ok');

  // 5) uscendo con un salvataggio fallito: avviso
  await failWrites();
  await page.fill('#c-notes', 'nota che non si salva');
  await page.waitForTimeout(100);
  dialogs.length = 0;
  await page.click('#e-back');
  await page.waitForSelector('#view-home:not([hidden])');
  log('uscita con errore -> avviso:', JSON.stringify(dialogs[0]));
  assert(dialogs.some((d) => /non è stato salvato/.test(d)), 'avviso in uscita');
  await allowWrites();

  // 6) etichetta di una misura che non si salva: avviso a comparsa
  await page.click('#report-list li button');
  await page.waitForSelector('#view-editor:not([hidden])');
  await page.click('#e-measure-add');
  await page.setInputFiles('#in-file', `${FX}/sample-10389.json.gz`);
  await page.waitForSelector('#view-measure:not([hidden])');
  await failWrites();
  await page.fill('#m-label', 'Etichetta nuova');
  await until(async () => /Etichetta non salvata/.test((await page.textContent('#toast')) || ''));
  log('etichetta ->', await page.textContent('#toast'));
  await allowWrites();
  assert(errors.length === 0, 'errori: ' + errors.join(' // '));

  // 7) archivio del telefono non disponibile (navigazione privata): la home lo dice, l'app resta usabile
  const priv = await open(browser, { before: (p) => p.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true })) });
  const p2 = priv.page;
  await until(async () => /archivio del telefono non è disponibile/.test((await p2.textContent('#home-reminder')) || ''));
  assert((await p2.getAttribute('#home-reminder button', 'data-type')) === null && /err/.test(await p2.getAttribute('#home-reminder button', 'class')), 'avviso in rosso');
  await p2.click('#btn-new');
  await p2.waitForSelector('#view-editor:not([hidden])');
  await p2.fill('#c-name', 'Senza archivio');
  await until(async () => /^Salvato/.test((await p2.textContent('#e-save')) || ''));
  log('senza archivio ->', (await p2.textContent('#e-save')).trim(), '| il rapporto si usa lo stesso');
  await p2.screenshot({ path: `${SP}/shots5/23-no-storage.png`, fullPage: false });
  await p2.click('#e-back');
  await p2.waitForSelector('#view-home:not([hidden])');
  await p2.screenshot({ path: `${SP}/shots5/23-no-storage-home.png`, fullPage: false });
  await finish(session, priv);
});
