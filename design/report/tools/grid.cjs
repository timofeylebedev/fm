// One block at many sizes, side by side: node grid.cjs PORT SELECTOR OUT.png 320x700 390x844 ... (NOART=1 hides drawings)
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const [port, sel, out, ...sizes] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const files = [];
  const ctx = await b.newContext({ viewport: { width: 400, height: 800 }, reducedMotion: 'reduce', bypassCSP: true });
  const p = await ctx.newPage();
  await p.goto(`${process.env['URL_' + port] || `http://127.0.0.1:${port}/`}`, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready);
  if (process.env.NOART) await p.addStyleTag({ content: '.art, canvas, .dots { display:none !important }' });
  for (const s of sizes) {
    const [w, h] = s.split('x').map(Number);
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(500);
    const el = await p.$(sel); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(+(process.env.WAIT || 700));
    const f = out.replace(/\.png$/, `-${s}.png`); await el.screenshot({ path: f }); files.push(f);
  }
  await b.close();
  execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
fs=sys.argv[2:]; ims=[Image.open(f) for f in fs]; H=int(sys.argv[1].split('@')[1]) if '@' in sys.argv[1] else 700
sc=[min(1, H/im.height) for im in ims]; ws=[int(im.width*s) for im,s in zip(ims,sc)]
out=Image.new('RGB',(sum(ws)+12*len(ims),H+20),(255,0,255)); x=0; d=ImageDraw.Draw(out)
for im,s,w,f in zip(ims,sc,ws,fs):
  out.paste(im.resize((w,int(im.height*s))),(x,20)); d.text((x+2,4),f.rsplit('-',1)[1][:-4],fill=(0,0,0)); x+=w+12
out.save(sys.argv[1].split('@')[0])`, out, ...files]);
  console.log(out);
})();
