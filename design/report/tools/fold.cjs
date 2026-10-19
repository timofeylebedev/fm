// The first screen at several sizes (what a visitor sees on load)
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const [out, port, ...sizes] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const files = [];
  for (const s of sizes) { const [w, h] = s.split('x').map(Number);
    const p = await (await b.newContext({ viewport: { width: w, height: h }, bypassCSP: true, reducedMotion: 'reduce', isMobile: w < 800, hasTouch: w < 800 })).newPage();
    await p.goto(`${process.env['URL_' + port] || `http://127.0.0.1:${port}/`}`, { waitUntil: 'load' }); await p.waitForTimeout(2500);
    const f = out.replace(/\.png$/, `-${port}-${s}.png`); await p.screenshot({ path: f }); files.push(f); await p.close(); }
  await b.close();
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs=sys.argv[2:]; ims=[Image.open(f) for f in fs]; H=520
ws=[int(im.width*H/im.height) for im in ims]; o=Image.new('RGB',(sum(ws)+10*len(ims),H),(255,0,255)); x=0
for im,w in zip(ims,ws): o.paste(im.resize((w,H)),(x,0)); x+=w+10
o.save(sys.argv[1])`, out, ...files]);
})();
