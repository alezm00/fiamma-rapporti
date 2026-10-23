const { execSync } = require('child_process');
const fs = require('fs');
const { SP, FX, BASE, log, assert, until, run, start, finish } = require('./lib.cjs');
const ISO_TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' }); // aaaa-mm-gg
fs.mkdirSync(`${SP}/dl`, { recursive: true });
run(async () => {
  const session = await start();
  const { browser, ctx, page, errors, dialogs } = session;
  await page.waitForSelector('#view-home:not([hidden])');

  // utilità nella pagina
  const installT = () => page.evaluate(() => {
    window.T = {
      async dest() { const root = await navigator.storage.getDirectory(); return root.getDirectoryHandle('SD-card', { create: true }); },
      async wipe() { const root = await navigator.storage.getDirectory(); await root.removeEntry('SD-card', { recursive: true }).catch(() => {}); },
      async tree() {
        const out = [];
        const walk = async (d, p) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, p + n + '/'); else out.push(p + n + ' ' + (await h.getFile()).size); } };
        await walk(await this.dest(), '');
        return out.sort();
      },
      async read(path) { let d = await this.dest(); const parts = path.split('/'); for (const x of parts.slice(0, -1)) d = await d.getDirectoryHandle(x); const f = await (await d.getFileHandle(parts.at(-1))).getFile(); return new Uint8Array(await f.arrayBuffer()); },
    };
  });
  await installT();
  const tree = () => page.evaluate(() => window.T.tree());
  const strip = (t) => t.map((x) => x.replace(/ \d+$/, ''));
  const png = () => page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#3a8'; x.fillRect(0, 0, 600, 400); const b = await new Promise((r) => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer())); });

  // 1) collegamento a una cartella (la cartella privata del browser fa da cartella scelta)
  await page.evaluate(async () => { await window.T.wipe(); const f = await import('/src/backup/folder/index.js'); await f.linkHandle(await window.T.dest()); });
  let st = await page.evaluate(async () => (await import('/src/backup/folder/index.js')).status());
  log('stato dopo il collegamento ->', JSON.stringify(st));
  assert(st.linked && st.name === 'SD-card' && st.permission === 'granted' && st.pending === 0, 'collegata');
  log('cartella vuota ->', JSON.stringify(strip(await tree())));
  assert(strip(await tree()).join() === 'Fiamma/impostazioni.json', 'solo le impostazioni');

  // 2) nuovo rapporto da interfaccia: dopo 2 secondi compare in cartella
  await page.click('#btn-new');
  await page.waitForSelector('#view-editor:not([hidden])');
  await page.fill('#c-name', 'Mario Rossi');
  await page.fill('#c-address', 'Via Roma 1');
  await page.setInputFiles('#in-gallery', [`${SP}/img/small00.jpg`, `${SP}/img/small01.jpg`]);
  await page.waitForFunction(() => document.querySelectorAll('#photo-grid > div').length === 2, null, { timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('photo-msg').hidden);
  await page.click('#e-measure-add');
  await page.setInputFiles('#in-file', `${FX}/sample-10389.json.gz`);
  await page.waitForSelector('#view-measure:not([hidden])');
  await page.click('#m-back');
  await page.waitForSelector('#view-editor:not([hidden])');
  st = await page.evaluate(async () => (await import('/src/backup/folder/index.js')).status());
  log('subito dopo la modifica: in coda ->', st.pending);
  assert(st.pending >= 1, 'modifica in coda');
  await until(async () => (await page.evaluate(async () => (await import('/src/backup/folder/index.js')).status())).pending === 0);
  let files = strip(await tree());
  log('dopo la pausa ->', JSON.stringify(files));
  const draftDir = files.find((f) => f.endsWith('rapporto.json')).replace('/rapporto.json', '');
  assert(new RegExp(`^Fiamma/rapporti/${ISO_TODAY.slice(0, 4)}/BOZZA_${ISO_TODAY}_Mario-Rossi_[0-9a-f]{8}$`).test(draftDir), 'cartella della bozza');
  assert(files.includes(`${draftDir}/foto/01.jpg`) && files.includes(`${draftDir}/foto/02.jpg`) && !files.some((f) => f.endsWith('.pdf')), 'foto sì, PDF no per la bozza');
  const json = JSON.parse(new TextDecoder().decode(await page.evaluate(async (p) => Array.from(await window.T.read(p)), `${draftDir}/rapporto.json`).then((a) => Uint8Array.from(a))));
  assert(json.customer.name === 'Mario Rossi' && json.measures.length === 1 && json.photos.length === 2 && json.photos[0].file === 'foto/01.jpg', 'contenuto del json');

  // 3) chiusura: cartella rinominata, PDF
  await page.click('#btn-close');
  await page.waitForFunction(() => /Rapporto n\./.test(document.getElementById('e-title').textContent));
  await page.evaluate(async () => (await import('/src/backup/folder/index.js')).process());
  files = strip(await tree());
  log('dopo la chiusura ->', JSON.stringify(files));
  assert(files.some((f) => /2026\/2026-001_Mario-Rossi_[0-9a-f]{8}\/rapporto\.pdf$/.test(f)) && !files.some((f) => f.includes('BOZZA')), 'rinominata e con PDF, bozza tolta');
  const pdfPath = files.find((f) => f.endsWith('.pdf'));
  const pdfBytes = Buffer.from(await page.evaluate(async (p) => Array.from(await window.T.read(p)), pdfPath));
  fs.writeFileSync(`${SP}/dl/folder.pdf`, pdfBytes);
  const txt = execSync(`pdftotext -layout ${SP}/dl/folder.pdf -`).toString();
  assert(/n\. 2026\/001/.test(txt) && /Mario Rossi/.test(txt) && /TF/.test(txt), 'PDF corretto');
  log('PDF in cartella ->', pdfBytes.length, 'byte, contiene numero, cliente e misura');

  // 4) cambio nome: la cartella si rinomina e non resta quella vecchia
  await page.fill('#c-name', 'Mario Rossi Verdi');
  await until(async () => (await page.evaluate(async () => (await import('/src/backup/folder/index.js')).status())).pending > 0);
  await page.evaluate(async () => (await import('/src/backup/folder/index.js')).process());
  files = strip(await tree());
  assert(files.filter((f) => f.endsWith('rapporto.json')).length === 1 && files.some((f) => f.includes('Mario-Rossi-Verdi')), 'una sola cartella, nuovo nome');
  log('rinomina ->', files.find((f) => f.endsWith('rapporto.json')));

  // 5) permesso scaduto: la coda resta, la home lo ricorda, un tocco riattiva
  await page.evaluate(async () => { (await import('/src/backup/folder/index.js')).testing.permission = 'prompt'; });
  await page.fill('#c-phone', '0434 123123');
  await until(async () => (await page.evaluate(async () => (await import('/src/backup/folder/index.js')).status())).pending > 0);
  await page.evaluate(async () => (await import('/src/backup/folder/index.js')).process());
  st = await page.evaluate(async () => (await import('/src/backup/folder/index.js')).status());
  const before = await tree();
  log('permesso scaduto -> stato', st.permission, '| in coda', st.pending);
  assert(st.permission === 'prompt' && st.pending === 1, 'coda con permesso scaduto');
  await page.click('#e-back');
  await page.waitForSelector('#view-home:not([hidden])');
  await page.waitForSelector('#home-reminder button');
  log('promemoria in home ->', await page.textContent('#home-reminder'));
  await page.screenshot({ path: `${SP}/shots5/12-home-reminder.png` });
  assert(/sospesa/.test(await page.textContent('#home-reminder')), 'promemoria sospesa');
  const json2 = JSON.parse(new TextDecoder().decode(Uint8Array.from(await page.evaluate(async (p) => Array.from(await window.T.read(p)), files.find((f) => f.endsWith('rapporto.json'))))));
  assert(json2.customer.phone === '', 'in cartella ancora il vecchio contenuto');
  await page.click('#home-reminder button');
  await page.waitForFunction(() => document.getElementById('home-reminder').hidden, null, { timeout: 15000 });
  const json3 = JSON.parse(new TextDecoder().decode(Uint8Array.from(await page.evaluate(async (p) => Array.from(await window.T.read(p)), files.find((f) => f.endsWith('rapporto.json'))))));
  log('dopo la riattivazione -> telefono in cartella:', json3.customer.phone);
  assert(json3.customer.phone === '0434 123123', 'coda svuotata dopo la riattivazione');

  // 6) impostazioni: stato e pulsanti
  await page.fill('#h-search', '');
  await page.click('#btn-settings');
  await page.waitForSelector('#view-settings:not([hidden])');
  await page.fill('#s-co-name', 'Termoidraulica Bianchi');
  await page.press('#s-co-name', 'Tab');
  log('impostazioni -> stato:', await page.textContent('#s-folder-status'));
  assert(/Collegata: «SD-card»/.test(await page.textContent('#s-folder-status')) && !(await page.isVisible('#s-folder-link')) && (await page.isVisible('#s-folder-tools')), 'stato collegata');
  await page.click('#s-folder-test');
  await page.waitForFunction(() => /Prova riuscita/.test(document.getElementById('s-folder-msg').textContent));
  assert(!(await tree()).some((f) => f.includes('prova.txt')), 'file di prova rimosso');
  await page.click('#s-folder-sync');
  await page.waitForFunction(() => /Copia completata/.test(document.getElementById('s-folder-msg').textContent), null, { timeout: 20000 });
  assert((await tree()).some((f) => f.startsWith('Fiamma/impostazioni.json')), 'impostazioni copiate');
  const sets = JSON.parse(new TextDecoder().decode(Uint8Array.from(await page.evaluate(async () => Array.from(await window.T.read('Fiamma/impostazioni.json'))))));
  assert(sets.company.name === 'Termoidraulica Bianchi' && sets.counters['2026'] === 1 && !('lastBackup' in sets), 'impostazioni.json');
  await page.screenshot({ path: `${SP}/shots5/13-settings-folder.png`, fullPage: true });

  // 7) telefono nuovo: si azzera tutto, si ricollega, si ripristina
  const snapshot = await page.evaluate(async () => { const s = await import('/src/data/store.js'); return JSON.stringify(await s.listReports()); });
  const photosBefore = await page.evaluate(async () => { const db = await import('/src/data/db.js'); return (await db.getAll(db.PHOTOS)).length; });
  await page.evaluate(async () => {
    const f = await import('/src/backup/folder/index.js'); const db = await import('/src/data/db.js');
    await f.unlink();
    await db.clear(db.REPORTS); await db.clear(db.PHOTOS);
    localStorage.clear();
  });
  await page.reload();
  await page.waitForSelector('#view-home:not([hidden])');
  await installT();
  assert((await page.$$('#report-list > li:not([data-month])')).length === 0, 'telefono vuoto');
  await page.evaluate(async () => { const f = await import('/src/backup/folder/index.js'); const root = await navigator.storage.getDirectory(); await f.linkHandle(await root.getDirectoryHandle('SD-card')); });
  await page.evaluate(async () => (await import('/src/backup/folder/index.js')).process());
  // il ricollegamento non deve aver cancellato nulla dalla cartella
  assert((await tree()).filter((f) => f.includes('rapporto.json')).length === 1, 'cartella intatta dopo il ricollegamento');
  const res = await page.evaluate(async () => (await import('/src/backup/folder/index.js')).restore());
  log('ripristino ->', JSON.stringify(res));
  const after = await page.evaluate(async () => { const s = await import('/src/data/store.js'); return JSON.stringify(await s.listReports()); });
  const photosAfter = await page.evaluate(async () => { const db = await import('/src/data/db.js'); return (await db.getAll(db.PHOTOS)).length; });
  assert(res.reports === 1 && res.photos === 2 && photosAfter === photosBefore, 'conteggi del ripristino');
  assert(after === snapshot, 'rapporto identico dopo il ripristino');
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('testoqr.config')));
  assert(restored.company.name === 'Termoidraulica Bianchi' && restored.counters['2026'] === 1, 'impostazioni ripristinate');
  st = await page.evaluate(async () => (await import('/src/backup/folder/index.js')).status());
  assert(st.pending === 0, 'il ripristino non rimette nulla in coda: ' + st.pending);
  // le foto ripristinate dalla cartella si possono riscrivere nella stessa cartella (non dipendono più dal suo file)
  await page.evaluate(async () => {
    const s = await import('/src/data/store.js'); const ph = await import('/src/data/photos.js');
    const doc = (await s.listReports())[0];
    const c = document.createElement('canvas'); c.width = 300; c.height = 200; c.getContext('2d').fillRect(0, 0, 300, 200);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    await ph.addPhoto(doc.id, new File([blob], 'nuova.png', { type: 'image/png' }));
    doc.photoCount = (await ph.listPhotos(doc.id)).length;
    await s.saveReport(doc);
    await (await import('/src/backup/folder/index.js')).process();
  });
  const sizes = await page.evaluate(async () => {
    const out = []; const walk = async (d, p) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, p + n + '/'); else if (p.includes('/foto/')) out.push((await (await h.getFile()).arrayBuffer()).byteLength); } };
    await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle('SD-card'), '');
    return out;
  });
  log('foto nella cartella dopo il ripristino e una modifica ->', JSON.stringify(sizes));
  assert(sizes.length === 3 && sizes.every((n) => n > 1000), 'foto leggibili nella cartella');
  // numerazione: il prossimo rapporto chiuso è il 002
  await page.reload();
  await installT();
  await page.waitForSelector('#report-list li');
  log('elenco dopo il ripristino ->', JSON.stringify(await page.$$eval('#report-list > li:not([data-month])', (l) => l.map((x) => x.innerText.replace(/\n/g, ' | ')))));

  // 8) eliminazione: sparisce anche dalla cartella
  await page.click('#report-list li button');
  await page.waitForSelector('#view-editor:not([hidden])');
  await page.click('#btn-delete');
  await page.waitForSelector('#view-home:not([hidden])');
  await page.evaluate(async () => (await import('/src/backup/folder/index.js')).process());
  files = strip(await tree());
  log('dopo l\'eliminazione ->', JSON.stringify(files));
  assert(!files.some((f) => f.includes('rapporto.json')), 'eliminato dalla cartella');

  // 9) cartella non più raggiungibile: errore chiaro, coda intatta
  await page.evaluate(async () => { const s = await import('/src/data/store.js'); const r = await s.createReport(); r.customer.name = 'Prova errore'; await s.saveReport(r); });
  await page.evaluate(async () => { const root = await navigator.storage.getDirectory(); await root.removeEntry('SD-card', { recursive: true }); });
  await page.evaluate(async () => (await import('/src/backup/folder/index.js')).process());
  st = await page.evaluate(async () => (await import('/src/backup/folder/index.js')).status());
  log('cartella sparita -> errore:', JSON.stringify(st.error), '| in coda', st.pending);
  assert(st.pending >= 1, 'coda intatta');

  await finish(session);
});
