// The whole stack, frame by frame: N full-screen shots from the hero to the section after the stack, as one grid
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const [w, h] = (process.argv[2] || '1440x900').split('x').map(Number); const OUT = process.argv[3]; const port = +(process.argv[4] || 8782); const N = +(process.argv[5] || 24);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', bypassCSP: true, hasTouch: w < h || h < 500, isMobile: w < h || h < 500 });
  const p = await ctx.newPage();
  await p.goto(`${process.env['URL_' + port] || `http://127.0.0.1:${port}/`}`, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1200);
  await p.addStyleTag({ content: '.art, canvas { display:none !important }' });
  const [a, z] = await p.evaluate(() => { const s = document.querySelector('.stack'); const r = s.getBoundingClientRect(); return [r.top + scrollY - innerHeight, r.bottom + scrollY]; });
  const files = [];
  for (let k = 0; k < N; k++) { const y = Math.round(a + (z - a) * k / (N - 1)); await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(250);
    const f = `${OUT}/seq-${port}-${w}x${h}-${k}.png`; await p.screenshot({ path: f }); files.push(f); }
  await b.close();
  execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
fs=sys.argv[2:]; ims=[Image.open(f) for f in fs]; w,h=ims[0].size; s=min(1, 240/w); tw,th=int(w*s),int(h*s); cols=8 if w<h else 6
rows=(len(ims)+cols-1)//cols; out=Image.new('RGB',(cols*(tw+6),rows*(th+6)),(255,0,255))
for i,im in enumerate(ims): out.paste(im.resize((tw,th)),((i%cols)*(tw+6),(i//cols)*(th+6)))
out.save(sys.argv[1])`, `${OUT}/seq-${port}-${w}x${h}.png`, ...files]);
  console.log(`${OUT}/seq-${port}-${w}x${h}.png`);
})();
