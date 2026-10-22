// Genera i PNG delle icone da img/icon.svg (Chromium come motore di disegno).
// Uso (dalla cartella del progetto, serve Playwright): node tools/make-icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const [SVG, OUT] = process.argv.slice(2).length ? process.argv.slice(2) : ['img/icon.svg', 'img'];
const src = fs.readFileSync(SVG, 'utf8');
// variante a tutta pagina (maschera di Android): niente angoli arrotondati, disegno ridotto nella zona sicura
const fullBleed = src.replace('rx="112"', 'rx="0"').replace('<g id="art">', '<g id="art" transform="translate(256 256) scale(.86) translate(-256 -256)">');
(async () => {
  const browser = await chromium.launch();
  const render = async (svg, size, file, transparent) => {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: `${OUT}/${file}`, omitBackground: transparent });
    await page.close();
  };
  await render(src, 512, 'icon-512.png', true);
  await render(src, 192, 'icon-192.png', true);
  await render(fullBleed, 512, 'icon-maskable-512.png', false);
  await render(fullBleed.replace('scale(.86)', 'scale(.96)'), 180, 'apple-touch-icon.png', false);
  await browser.close();
})();
