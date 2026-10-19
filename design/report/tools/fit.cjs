// Text that does not fit its box: for every text block, a word wider than the block (scrollWidth > clientWidth), at many widths
const { chromium } = require('playwright');
const port = +(process.argv[2] || 8782), [a, z, st] = (process.argv[3] || '320-440-2').split('-').map(Number), h = +(process.argv[4] || 800);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: a, height: h }, reducedMotion: 'reduce', bypassCSP: true })).newPage();
  await p.goto(`${process.env['URL_' + port] || `http://127.0.0.1:${port}/`}`, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: '.art, canvas, .dots { display: none !important; }' });
  const seen = {};
  for (let w = a; w <= z; w += st) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(120);
    const bad = await p.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('h1,h2,h3,p,.pub__title,.tool__title,.royalty__text,.feature__title,.feature__desc,.footer__note,.card__title')) {
        if (!el.offsetParent || el.closest('.hero-chips,.logo-card__name')) continue;
        const o = el.scrollWidth - el.clientWidth;
        // also: the text past the padding box of the card/section it sits in
        const r = document.createRange(); r.selectNodeContents(el); const tr = r.getBoundingClientRect();
        const box = el.closest('.royalty__card,.pub,.pub__cover,.tool__body,.cta__card,.feature,.card,section,footer');
        let o2 = 0; if (box) { const bs = getComputedStyle(box), br = box.getBoundingClientRect(); o2 = Math.max(tr.right - (br.right - parseFloat(bs.paddingRight)), (br.left + parseFloat(bs.paddingLeft)) - tr.left); }
        if (o > 1 || o2 > 1) out.push((el.className || el.tagName).split(' ')[0] + ' ' + Math.round(Math.max(o, o2)) + 'px «' + el.textContent.trim().slice(0, 28) + '»');
      }
      return out;
    });
    for (const k of bad) (seen[k.replace(/ \d+px/, '')] ||= []).push(w);
  }
  for (const [k, ws] of Object.entries(seen)) console.log(k, ws[0] + '…' + ws[ws.length - 1], '(' + ws.length + ')');
  await b.close();
})();
