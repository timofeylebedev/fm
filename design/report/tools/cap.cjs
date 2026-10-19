// Phone turned sideways, scrolling down: the navbar hides; is there a band of the cap left at the top? (?fmcap=debug: red)
const { chromium } = require('playwright');
const port = +(process.argv[2] || 8782), OUT = process.argv[3];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, bypassCSP: true })).newPage();
  await p.goto(`${process.env['URL_' + port] || `http://127.0.0.1:${port}/`}?fmcap=debug`, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  for (let y = 0; y < 2400; y += 80) { await p.mouse.wheel(0, 80); await p.waitForTimeout(30); }
  await p.waitForTimeout(80);
  const moving = await p.screenshot({ clip: { x: 0, y: 0, width: 844, height: 80 }, path: `${OUT}/cap-${port}-a.png` });
  await p.waitForTimeout(800);
  await p.screenshot({ clip: { x: 0, y: 0, width: 844, height: 80 }, path: `${OUT}/cap-${port}-b.png` });
  const info = await p.evaluate(() => ({ away: document.documentElement.classList.contains('nav-away'), cap: !!document.querySelector('.nav-cap'), clip: document.querySelector('.nav-cap') && getComputedStyle(document.querySelector('.nav-cap')).clipPath }));
  console.log(port, JSON.stringify(info));
  // count red pixels in the top 80px
  const sharp = require('sharp');
  for (const k of ['a', 'b']) { const { data, info: m } = await sharp(`${OUT}/cap-${port}-${k}.png`).raw().toBuffer({ resolveWithObject: true }); let red = 0; for (let i = 0; i < data.length; i += m.channels) if (data[i] > 200 && data[i + 1] < 60 && data[i + 2] < 90) red++; console.log(k, 'red px', red, 'rows ~', (red / 844).toFixed(1)); }
  await b.close();
})();
