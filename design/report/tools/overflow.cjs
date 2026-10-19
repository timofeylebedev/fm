const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', bypassCSP: true })).newPage();
  await p.goto('http://127.0.0.1:8782/', { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: '.art, canvas, .dots { display: none !important; }' });
  const bad = []; let n = 0;
  for (let w = 320; w <= 1920; w += 16) {
    await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(250); n++;
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    for (const f of [0, 0.25, 0.5, 0.75, 0.98]) { const o = await p.evaluate((y) => { scrollTo(0, y); return document.documentElement.scrollWidth - document.documentElement.clientWidth; }, H * f); if (o > 0) bad.push([w, f, o]); }
  }
  console.log(n, 'widths; sideways scroll at', JSON.stringify(bad)); await b.close();
})();
