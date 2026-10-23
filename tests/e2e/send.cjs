const fs = require('fs');
const { SP, FX, BASE, log, assert, until, launch, open, finish, run } = require('./lib.cjs');
const TODAY = new Date().toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' }); // gg/mm/aaaa, come nel browser di prova
const CAPTURE_MAILTO = () => document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a'); if (a && a.href.startsWith('mailto:')) { window.__mailto = a.href; e.preventDefault(); } }, true);
const STUB_SHARE = () => {
  navigator.canShare = (d) => !!d?.files?.length;
  navigator.share = async (d) => { window.__shared = { title: d.title, text: d.text, name: d.files[0].name, type: d.files[0].type, size: d.files[0].size }; };
};
run(async () => {
  const browser = await launch();
  const mk = (share) => open(browser, {
    context: { permissions: ['clipboard-read', 'clipboard-write'] },
    before: async (page) => {
      await page.addInitScript(CAPTURE_MAILTO);
      if (share) await page.addInitScript(STUB_SHARE);
    },
  });
  const vis = (page, sel) => page.isVisible(sel);
  const badge = (page) => page.textContent('#e-badge');
  const setConfig = (page, patch) => page.evaluate((p) => { const k = 'testoqr.config'; const s = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...s, ...p })); }, patch);

  // ============ impostazioni ============
  const first = await mk(true);
  const { ctx, page } = first;
  await page.click('#btn-settings');
  await page.waitForSelector('#view-settings:not([hidden])');
  log('metodo predefinito:', await page.$eval('input[name="s-method"]:checked', (r) => r.value));
  await page.fill('#s-email', 'ufficio');
  await page.press('#s-email', 'Tab');
  assert(await vis(page, '#s-email-hint'), 'avviso email non valida');
  await page.fill('#s-email', 'ufficio@esempio.it, secondo@esempio.it');
  await page.press('#s-email', 'Tab');
  assert(!(await vis(page, '#s-email-hint')), 'avviso sparito');
  await page.fill('#s-co-name', 'Termoidraulica Bianchi');
  await page.fill('#s-co-technician', 'Luca Bianchi');
  await page.press('#s-co-technician', 'Tab');
  await page.goBack();
  await page.waitForSelector('#view-home:not([hidden])');
  await page.reload();
  await page.waitForSelector('#view-home:not([hidden])');
  await page.click('#btn-settings');
  const saved = await page.evaluate(() => ['s-email', 's-co-name', 's-co-technician'].map((id) => document.getElementById(id).value));
  log('dopo reload:', JSON.stringify(saved));
  assert(saved[0] === 'ufficio@esempio.it, secondo@esempio.it' && saved[1] === 'Termoidraulica Bianchi' && saved[2] === 'Luca Bianchi', 'impostazioni salvate');
  await page.goBack();
  await page.waitForSelector('#view-home:not([hidden])');

  // ============ nuovo rapporto: vuoto, senza apparecchi ============
  await page.click('#btn-new');
  await page.waitForSelector('#view-editor:not([hidden])');
  const form = await page.evaluate(() => ['c-name', 'c-address', 'c-plate', 'c-notes', 'c-phone'].map((id) => document.getElementById(id).value));
  log('modulo:', JSON.stringify(form));
  assert(form.every((v) => v === ''), 'nuovo rapporto vuoto');
  assert((await page.$$('#e-units > section')).length === 0 && (await vis(page, '#e-units-empty')), 'nessun apparecchio');
  await page.click('#e-add-caldaia');
  log('riga destinatario:', await page.textContent('#mail-info'));
  await page.fill('#c-name', 'Mario Rossi');
  await page.fill('#c-plate', '06BD529A822E2B20');
  await page.selectOption('#e-type', 'riparazione');
  await page.selectOption('#e-outcome', 'anomalie');
  await page.fill('#c-phone', '0434 123123');

  // ============ email da bozza: condivisione, resta bozza ============
  await page.click('#btn-pdf-email');
  await page.waitForFunction(() => window.__shared);
  let sh = await page.evaluate(() => window.__shared);
  log('bozza -> oggetto:', JSON.stringify(sh.title), '| file:', sh.name);
  assert(sh.title === `Rapporto di intervento (bozza) - Mario Rossi - targa 06BD529A822E2B20 - ${TODAY}`, 'oggetto bozza');
  assert(sh.type === 'application/pdf' && /^Bozza_/.test(sh.name), 'file bozza');
  assert((await badge(page)) === 'Bozza', 'una bozza inviata resta bozza');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert(clip === 'ufficio@esempio.it, secondo@esempio.it', 'destinatari copiati');

  // ============ chiudi, invia: diventa "Inviato" ============
  await page.click('#btn-close');
  await page.waitForFunction(() => /Rapporto n\./.test(document.getElementById('e-title').textContent));
  assert((await badge(page)) === 'Completato', 'chiuso = completato');
  await page.evaluate(() => { window.__shared = null; });
  await page.click('#btn-pdf-email');
  await page.waitForFunction(() => window.__shared);
  sh = await page.evaluate(() => window.__shared);
  const lines = sh.text.split('\n');
  log('chiuso -> oggetto:', JSON.stringify(sh.title), '| file:', sh.name);
  console.log(sh.text.split('\n').map((l) => '    ' + l).join('\n'));
  assert(sh.title === `Rapporto di intervento n. ${(await page.textContent('#e-title')).slice(12)} - Mario Rossi - targa 06BD529A822E2B20 - ${TODAY}`, 'oggetto chiuso');
  assert(sh.text.includes('Intervento: Riparazione / guasto - Funzionante con anomalie') && lines.at(-2) === 'Luca Bianchi' && lines.at(-1) === 'Termoidraulica Bianchi', 'testo con intervento e firma');
  await page.waitForFunction(() => document.getElementById('e-badge').textContent === 'Inviato');
  log('stato dopo invio ->', await badge(page));
  await page.screenshot({ path: `${SP}/shots5/10-sent.png`, fullPage: true });

  // "Salva PDF" non cambia lo stato; una modifica riporta a "completato"
  const [dl0] = await Promise.all([page.waitForEvent('download'), page.click('#btn-pdf-save')]);
  assert((await badge(page)) === 'Inviato', 'salva PDF non cambia lo stato');
  await page.fill('#c-phone', '0434 999999');
  await page.waitForFunction(() => document.getElementById('e-badge').textContent === 'Completato');
  log('dopo modifica ->', await badge(page));

  // icona condividi: invia il solo file, poi "inviato"
  await page.evaluate(() => { window.__shared = null; });
  await page.click('#btn-pdf-share');
  await page.waitForFunction(() => window.__shared);
  log('icona condividi ->', JSON.stringify(await page.evaluate(() => ({ title: window.__shared.title, text: window.__shared.text }))));
  await page.waitForFunction(() => document.getElementById('e-badge').textContent === 'Inviato');

  // ============ metodo Gmail (mailto) ============
  await page.fill('#c-phone', '0434 111111');
  await page.waitForFunction(() => document.getElementById('e-badge').textContent === 'Completato');
  await setConfig(page, { method: 'mailto' });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-pdf-email')]);
  await dl.saveAs(`${SP}/dl/mail.pdf`);
  await page.waitForFunction(() => window.__mailto);
  const mailto = await page.evaluate(() => window.__mailto);
  const q = new URLSearchParams(mailto.split('?')[1]);
  log('mailto -> a:', decodeURIComponent(mailto.slice(7, mailto.indexOf('?'))), '| oggetto:', q.get('subject'));
  log('       -> PDF salvato:', dl.suggestedFilename(), fs.statSync(`${SP}/dl/mail.pdf`).size, 'byte | stato', await badge(page));
  assert(mailto.startsWith('mailto:ufficio@esempio.it,secondo@esempio.it?') && q.get('body').includes('Buongiorno,\r\n'), 'mailto');
  assert((await badge(page)) === 'Inviato', 'mailto -> inviato');

  // elenco: stato "Inviato" e filtro
  await page.click('#e-back');
  await page.waitForSelector('#view-home:not([hidden])');
  await page.click('#h-status [data-status="sent"]');
  assert((await page.$$('#report-list > li:not([data-month])')).length === 1, 'filtro inviati');
  log('elenco inviati ->', JSON.stringify((await page.textContent('#report-list')).replace(/\s+/g, ' ')));
  await page.screenshot({ path: `${SP}/shots5/11-home-sent.png`, fullPage: true });

  // ============ nessun destinatario ============
  await setConfig(page, { method: 'share', email: '' });
  await page.click('#h-status [data-status="all"]');
  await page.click('#report-list li button');
  await page.waitForSelector('#view-editor:not([hidden])');
  log('senza destinatario, riga:', await page.textContent('#mail-info'));
  await page.evaluate(() => { window.__shared = null; });
  await page.click('#btn-pdf-email');
  await page.waitForFunction(() => window.__shared);
  const m2 = (await page.textContent('#report-msg')).trim();
  log('senza destinatario ->', m2, '| tipo:', await page.getAttribute('#report-msg', 'data-type'));
  assert(/Nessun destinatario/.test(m2), 'avviso senza destinatario');

  // ============ testo dell'email: modello personale con segnaposto ============
  const sendAgain = async () => {
    await page.evaluate(() => { window.__shared = null; });
    await page.click('#btn-pdf-email');
    await page.waitForFunction(() => window.__shared);
    return page.evaluate(() => window.__shared);
  };
  const number = (await page.textContent('#e-title')).replace('Rapporto n. ', '');
  await page.click('#e-back');
  await page.waitForSelector('#view-home:not([hidden])');
  await page.click('#btn-settings');
  await page.waitForSelector('#view-settings:not([hidden])');
  const ORIGINAL_SUBJECT = '{titolo} - {cliente} - targa {targa} - {data}';
  assert((await page.inputValue('#s-mail-subject')) === ORIGINAL_SUBJECT && /\{rapporto\}/.test(await page.inputValue('#s-mail-body')), 'si parte dal testo originale');
  log('anteprima originale ->', (await page.textContent('#s-mail-preview-subject')).trim());
  assert(/^Rapporto di intervento n\. \d{4}\/012 - Mario Rossi - targa AB12 - \d\d\/\d\d\/\d{4}$/.test((await page.textContent('#s-mail-preview-subject')).trim()), 'anteprima dell\'oggetto originale');
  assert(!(await vis(page, '#s-mail-msg')), 'nessun avviso sui segnaposto');

  await page.fill('#s-mail-subject', '{numero} · {cliente}');
  await page.fill('#s-mail-body', 'Gentile {cliente},\nin allegato {rapporto}.\nTel. {telefono}\nGrazie,\n{tecnico}');
  await page.press('#s-mail-body', 'Tab');
  const preview = (await page.textContent('#s-mail-preview-body')).trim();
  log('anteprima personale ->', JSON.stringify(preview));
  assert(/^Gentile Mario Rossi,\nin allegato il rapporto di intervento n\. \d{4}\/012\.\nTel\. 333 1234567\nGrazie,\nLuca Bianchi$/.test(preview), 'anteprima del messaggio');
  // un segnaposto toccato si inserisce dove sta il cursore, e salva
  await page.click('#s-mail-body');
  await page.keyboard.press('Control+End');
  await page.click('#s-mail-chips button:has-text("{targa}")');
  assert((await page.inputValue('#s-mail-body')).endsWith('{tecnico}{targa}'), 'segnaposto inserito alla fine: ' + (await page.inputValue('#s-mail-body')));
  assert(/Luca BianchiAB12$/.test((await page.textContent('#s-mail-preview-body')).trim()), 'l\'anteprima lo usa');
  // un errore di battitura si segnala
  await page.fill('#s-mail-body', 'Ciao {clinete}');
  assert(await vis(page, '#s-mail-msg') && /\{clinete\}/.test(await page.textContent('#s-mail-msg')), 'avviso del segnaposto che non esiste');
  await page.fill('#s-mail-body', 'Gentile {cliente},\nin allegato {rapporto}.\nTel. {telefono}\nGrazie,\n{tecnico}');
  assert(!(await vis(page, '#s-mail-msg')), 'avviso sparito');
  await page.press('#s-mail-body', 'Tab');
  await page.reload();
  await page.waitForSelector('#view-home:not([hidden])');
  await page.click('#btn-settings');
  await page.waitForSelector('#view-settings:not([hidden])');
  assert((await page.inputValue('#s-mail-subject')) === '{numero} · {cliente}' && /^Gentile \{cliente\},/.test(await page.inputValue('#s-mail-body')), 'il testo personale resta dopo il ricaricamento');
  assert((await page.evaluate(() => JSON.parse(localStorage.getItem('testoqr.config')).mail.subject)) === '{numero} · {cliente}', 'salvato nelle impostazioni');
  await page.screenshot({ path: `${SP}/shots5/12-mail-text.png`, fullPage: true });
  await page.click('#btn-settings-back');
  await page.waitForSelector('#view-home:not([hidden])');
  await page.click('#report-list li button');
  await page.waitForSelector('#view-editor:not([hidden])');
  sh = await sendAgain();
  log('email personale -> oggetto:', JSON.stringify(sh.title), '| testo:', JSON.stringify(sh.text));
  assert(sh.title === `${number} · Mario Rossi`, 'oggetto personale');
  const phone = await page.inputValue('#c-phone');
  assert(phone && sh.text === `Gentile Mario Rossi,\nin allegato il rapporto di intervento n. ${number}.\nTel. ${phone}\nGrazie,\nLuca Bianchi`, 'messaggio personale');
  // ripristino: tornano l'oggetto e il messaggio originali, e non resta niente nelle impostazioni
  await page.click('#e-back');
  await page.waitForSelector('#view-home:not([hidden])');
  await page.click('#btn-settings');
  await page.waitForSelector('#view-settings:not([hidden])');
  await page.click('#s-mail-reset');
  assert((await page.inputValue('#s-mail-subject')) === ORIGINAL_SUBJECT && /Buongiorno,/.test(await page.inputValue('#s-mail-body')), 'ripristinato');
  await page.press('#s-mail-body', 'Tab');
  await page.waitForTimeout(500);
  assert((await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('testoqr.config')).mail))) === '{"subject":"","body":""}', 'nelle impostazioni resta vuoto (= originale)');
  await page.click('#btn-settings-back');
  await page.waitForSelector('#view-home:not([hidden])');
  await page.click('#report-list li button');
  await page.waitForSelector('#view-editor:not([hidden])');
  sh = await sendAgain();
  assert(sh.title === `Rapporto di intervento n. ${number} - Mario Rossi - targa 06BD529A822E2B20 - ${TODAY}` && /^Buongiorno,\n\nin allegato il rapporto di intervento n\./.test(sh.text), 'dopo il ripristino: oggetto e testo originali');
  log('dopo il ripristino -> oggetto:', JSON.stringify(sh.title));
  log('errori pagina:', first.errors.length ? first.errors : 'nessuno');
  assert(!first.errors.length, 'errori');
  await ctx.close();

  // ============ senza condivisione (desktop): ripiega su Gmail/mailto ============
  const b = await mk(false);
  await setConfig(b.page, { email: 'ufficio@esempio.it', method: 'share' });
  await b.page.click('#btn-new');
  await b.page.waitForSelector('#view-editor:not([hidden])');
  await b.page.fill('#c-name', 'Anna Verdi');
  log('senza supporto: icona condividi nascosta ->', !(await vis(b.page, '#btn-pdf-share')), '| email visibile ->', await vis(b.page, '#btn-pdf-email'));
  const [dl2] = await Promise.all([b.page.waitForEvent('download'), b.page.click('#btn-pdf-email')]);
  await b.page.waitForFunction(() => window.__mailto);
  log('senza supporto: scarica il PDF', dl2.suggestedFilename(), 'e apre mailto ->', (await b.page.evaluate(() => window.__mailto)).slice(0, 60) + '…');
  await finish(b);
});
