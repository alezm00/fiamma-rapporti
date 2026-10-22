const { chromium } = require('playwright');
const [SP, FX, BASE = 'http://localhost:8801/'] = process.argv.slice(2);
const log = (...a) => console.log('•', ...a);
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE);
  await page.waitForSelector('#view-home:not([hidden])');
  const rows = () => page.$$eval('#report-list > li:not([data-month])', (l) => l.length);
  const heads = () => page.$$eval('#report-list > li[data-month]', (l) => l.map((x) => x.textContent));

  // 120 rapporti in 36 mesi (novembre 2023 - ottobre 2026), creati direttamente nell'archivio
  const made = await page.evaluate(async () => {
    const db = await import('/db.js'); const model = await import('/model.js');
    const per = {};
    for (let i = 0; i < 120; i++) {
      const back = i % 36;
      const d = new Date(2026, 9 - back, 5 + (i % 20));
      const doc = model.newReport({ now: d, id: `lungo${String(i).padStart(4, '0')}` });
      doc.date = model.dayString(d);
      doc.customer.name = `Cliente ${i}`;
      doc.customer.address = `Via Prova ${i}`;
      doc.status = i % 3 === 0 ? 'done' : 'draft';
      if (doc.status === 'done') doc.number = model.formatNumber(d.getFullYear(), i + 1);
      await db.put(db.REPORTS, doc);
      const key = doc.date.slice(0, 4); per[key] = (per[key] || 0) + 1;
    }
    return per;
  });
  log('creati per anno ->', JSON.stringify(made));
  const t0 = Date.now();
  await page.reload();
  await page.waitForSelector('#view-home:not([hidden])');
  await page.waitForSelector('#report-list li');
  log('apertura con 120 rapporti ->', Date.now() - t0, 'ms');

  // primi 50, intestazioni dei mesi, "Mostra altri"
  assert((await rows()) === 50, 'prime 50 righe: ' + (await rows()));
  const h = await heads();
  log('mesi ->', JSON.stringify(h.slice(0, 3)), '… in tutto', h.length);
  assert(/^ottobre 2026 · \d+$/i.test(h[0]) && h.length > 8, 'intestazioni dei mesi');
  assert((await page.textContent('#h-more')) === 'Mostra altri (70)' && (await page.isVisible('#h-more')), 'pulsante Mostra altri');
  // il conteggio del mese a cavallo del limite è quello totale, non delle sole righe mostrate
  const last = h.at(-1);
  const monthTotal = Number(last.split('·')[1]);
  const lastShown = await page.$$eval('#report-list > li', (l) => { let n = 0; for (let i = l.length - 1; i >= 0 && !l[i].dataset.month; i--) n++; return n; });
  log('ultimo mese ->', last, '| righe mostrate', lastShown);
  assert(monthTotal >= lastShown, 'conteggio del mese totale');
  await page.screenshot({ path: `${SP}/shots5/17-long-list.png` });
  await page.click('#h-more');
  assert((await rows()) === 100 && (await page.textContent('#h-more')) === 'Mostra altri (20)', 'altri 50');
  await page.click('#h-more');
  assert((await rows()) === 120 && !(await page.isVisible('#h-more')), 'tutti, pulsante nascosto');
  assert(h.length < (await heads()).length, 'più mesi dopo "mostra altri"');

  // filtro per anno
  const chips = await page.$$eval('#h-years > button', (b) => b.map((x) => x.textContent));
  log('anni ->', JSON.stringify(chips));
  assert(chips.join() === 'Tutti gli anni,2026,2025,2024,2023', 'chip degli anni');
  await page.click('#h-years [data-year="2025"]');
  assert((await rows()) === made['2025'], 'solo il 2025: ' + (await rows()));
  assert((await heads()).every((x) => /2025 · \d+$/.test(x)), 'solo mesi del 2025');
  // il limite riparte da 50 cambiando filtro
  await page.click('#h-years [data-year="all"]');
  assert((await rows()) === 50, 'limite azzerato');
  // ricerca e stato insieme
  await page.fill('#h-search', 'cliente 11');
  const n = await rows();
  assert(n === 11 && /cliente 11/i.test(await page.textContent('#report-list li button')), 'ricerca (11, 110..119): ' + n);
  await page.fill('#h-search', '');
  await page.click('#h-status [data-status="done"]');
  assert((await rows()) === 40, 'completati: ' + (await rows()));
  await page.click('#h-years [data-year="2026"]');
  const done2026 = await page.evaluate(async () => { const db = await import('/db.js'); return (await db.getAll(db.REPORTS)).filter((r) => r.status === 'done' && r.date.startsWith('2026')).length; });
  assert((await rows()) === done2026, `completati del 2026: ${await rows()} invece di ${done2026}`);
  await page.click('#h-status [data-status="all"]');
  await page.click('#h-years [data-year="all"]');

  // eliminando tutti quelli di un anno il filtro scompare da solo
  await page.evaluate(async () => { const db = await import('/db.js'); for (const r of await db.getAll(db.REPORTS)) if (r.date.startsWith('2023')) await db.remove(db.REPORTS, r.id); });
  await page.click('#btn-settings');
  await page.waitForSelector('#view-settings:not([hidden])');
  await page.click('#btn-settings-back');
  await page.waitForSelector('#view-home:not([hidden])');
  const chips2 = await page.$$eval('#h-years > button', (b) => b.map((x) => x.textContent));
  assert(chips2.join() === 'Tutti gli anni,2026,2025,2024', 'anno 2023 sparito dai chip: ' + chips2);
  // un solo anno: niente filtro
  await page.evaluate(async () => { const db = await import('/db.js'); for (const r of await db.getAll(db.REPORTS)) if (!r.date.startsWith('2026')) await db.remove(db.REPORTS, r.id); });
  await page.click('#btn-settings');
  await page.waitForSelector('#view-settings:not([hidden])');
  await page.click('#btn-settings-back');
  await page.waitForSelector('#view-home:not([hidden])');
  assert(!(await page.isVisible('#h-years')), 'con un solo anno il filtro non c\'è');
  assert(errors.length === 0, 'errori: ' + errors.join(' // '));
  await browser.close();
  log('ok');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
