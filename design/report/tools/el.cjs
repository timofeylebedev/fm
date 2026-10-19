// Screenshot of one block at given sizes: node el.cjs PORT SELECTOR OUTPREFIX 328x700 425x800 ...
const { chromium } = require('playwright');
const [port, sel, out, ...sizes] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const s of sizes) {
    const [w, h] = s.split('x').map(Number);
    const p = await (await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', bypassCSP: true })).newPage();
    await p.goto(`${process.env['URL_' + port] || `http://127.0.0.1:${port}/`}`, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600);
    if (process.env.NOART) await p.addStyleTag({ content: '.art, canvas, .dots { display:none !important }' });
    const el = await p.$(sel); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(900);
    await el.screenshot({ path: `${out}-${s}.png` }); await p.close();
  }
  await b.close();
})();
