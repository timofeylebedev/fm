// Reload while scrolled to the tools: is the section's grey drawn? (pixel at the section's top-left padding)
const { chromium } = require('playwright');
const port = +(process.argv[2] || 8781), [w, h] = (process.argv[3] || '1440x900').split('x').map(Number), N = +(process.argv[4] || 6);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, bypassCSP: true, hasTouch: w < 800, isMobile: w < 800 });
  const p = await ctx.newPage();
  await p.goto(`${process.env['URL_' + port] || `http://127.0.0.1:${port}/`}`, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelector('.tools').scrollIntoView()); await p.waitForTimeout(1500);
  for (let i = 0; i < N; i++) {
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2500);
    const info = await p.evaluate(() => { const t = document.querySelector('.tools'); const r = t.getBoundingClientRect(); const cs = getComputedStyle(t);
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), bg: cs.backgroundColor, inline: t.getAttribute('style'), y: Math.round(scrollY), at: document.elementFromPoint(5, Math.max(2, r.top + 5))?.className };
    });
    const buf = await p.screenshot({ path: `${process.env.OUT || '/tmp'}/reload-${port}-${i}.png` });
    console.log(i, JSON.stringify(info));
  }
  await b.close();
})();
