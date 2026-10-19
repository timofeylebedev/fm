const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const w of [380, 386, 390, 400, 410, 420]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 1100 }, bypassCSP: true, reducedMotion: 'reduce' })).newPage();
    await p.goto('http://127.0.0.1:8782/', { waitUntil: 'load' }); await p.waitForTimeout(900);
    console.log(w, await p.evaluate(() => { const t = document.querySelector('.logos__track'); return getComputedStyle(t).getPropertyValue('--cols') + ' u=' + getComputedStyle(t).gridTemplateColumns.split(' ')[0] + ' logos=' + document.querySelector('.logos').clientWidth; }));
    await p.close();
  }
  await b.close();
})();
