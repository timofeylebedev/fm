// Before / after pairs of one block at one size, for the report: node pairs.cjs OUTDIR
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const OUT = process.argv[2]; const only = process.argv[3];
const JOBS = [
  ['hero-1440', 1440, 900, '.hero', { art: 1, wait: 2600 }],
  ['hero-320', 320, 640, '.hero', { art: 1, wait: 2600 }],
  ['royalty-700', 700, 900, '.royalty__cards', { art: 1, wait: 2500 }],
  ['royalty-390', 390, 844, '.royalty__cards', { art: 1, wait: 2500 }],
  ['features-427', 427, 900, '.features', {}],
  ['features-856', 856, 900, '.features', {}],
  ['logos-390', 390, 844, '.clients', {}],
  ['cta-328', 328, 700, '.cta__card', {}],
  ['tool-320', 320, 700, '.tool', {}],
  ['pub-325', 325, 700, '.pubs', { clip: 760 }],
  ['access-1440', 1440, 900, '.access__stage', { wait: 2500 }],
  ['footer-390', 390, 844, '.footer', {}],
  ['ring-1440', 1440, 900, '.releases', { ring: 1, wait: 1800, clip: 900 }],
];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [id, w, h, sel, o] of JOBS) {
    if (only && !id.startsWith(only)) continue;
    const files = [];
    for (const port of [8781, 8782]) {
      const p = await (await b.newContext({ viewport: { width: w, height: h }, reducedMotion: o.ring ? 'no-preference' : 'reduce', bypassCSP: true })).newPage();
      await p.goto(`${process.env['URL_' + port] || `http://127.0.0.1:${port}/`}`, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600);
      if (!o.art && !o.ring) await p.addStyleTag({ content: '.art, canvas, .dots { display:none !important }' });
      await p.addStyleTag({ content: '.nav, .skip { visibility: hidden !important }' });
      const el = await p.$(sel);
      if (o.ring) { await p.evaluate(() => { const r = document.querySelector('.ring').getBoundingClientRect(); scrollTo(0, r.top + scrollY + r.height / 2 - innerHeight / 2); }); }
      else await el.scrollIntoViewIfNeeded();
      await p.waitForTimeout(o.wait || 900);
      const f = `${OUT}/${id}-${port}.png`;
      if (o.ring) await p.screenshot({ path: f }); else await el.screenshot({ path: f });
      files.push(f); await p.close();
    }
    execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw, ImageFont
a,b=Image.open(sys.argv[2]).convert('RGB'),Image.open(sys.argv[3]).convert('RGB'); clip=int(sys.argv[4])
if clip: a=a.crop((0,0,a.width,min(a.height,clip))); b=b.crop((0,0,b.width,min(b.height,clip)))
H=max(a.height,b.height); MAXH=620; s=min(1,MAXH/H, 700/max(a.width,b.width))
a=a.resize((int(a.width*s),int(a.height*s))); b=b.resize((int(b.width*s),int(b.height*s)))
pad=14; top=30; W=a.width+b.width+pad*3; out=Image.new('RGB',(W,max(a.height,b.height)+top+pad),(22,24,28)); d=ImageDraw.Draw(out)
try: f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
except: f=None
out.paste(a,(pad,top)); out.paste(b,(pad*2+a.width,top))
d.text((pad,8),'Before',fill=(150,156,166),font=f); d.text((pad*2+a.width,8),'After',fill=(56,189,248),font=f)
out.save(sys.argv[1],quality=82)`, `${OUT}/${id}.jpg`, ...files, String(o.clip || 0)]);
    console.log(id);
  }
  await b.close();
})();
