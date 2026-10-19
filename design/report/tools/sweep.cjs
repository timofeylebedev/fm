// Rendered sizes of the page across widths (at a tall screen) and across heights (at 1440 wide), before and after.
//   node sweep.cjs OUT.json
const { chromium } = require('playwright');
const fs = require('fs');
const PROPS = {
  // type
  hero: ['.hero__title', 'fontSize'], h2: ['.head__title', 'fontSize'], cardTitle: ['.card__title', 'fontSize'],
  heading: ['.pub__title', 'fontSize'], royalty: ['.royalty__text', 'fontSize'], lead: ['.hero__lead', 'fontSize'],
  tag: ['.card__tag-label', 'fontSize'], body: ['.pub__desc', 'fontSize'], toolDesc: ['.tool__desc', 'fontSize'], feature: ['.feature__title', 'fontSize'],
  ui: ['.footer__note', 'fontSize'], button: ['.hero .btn', 'fontSize'], byline: ['.pub__author', 'fontSize'], ctaLead: ['.cta__lead', 'fontSize'],
  // space
  gutter: ['.tools', 'paddingLeft'], sectionY: ['.tools', 'paddingTop'], sectionGap: ['.tools', 'rowGap'], inset: ['.cta', 'paddingLeft'],
  gapTiles: ['.features', 'rowGap'], gapCards: ['.pubs__grid', 'rowGap'], royaltyGap: ['.royalty__cards', 'rowGap'],
  navPadY: ['.nav', 'paddingTop'], navPadL: ['.nav', 'paddingLeft'],
  // radii and paddings of cards
  rTile: ['.feature', 'borderTopLeftRadius'], rLogo: ['.logo-card', 'borderTopLeftRadius'], rId: ['.idcard', 'borderTopLeftRadius'],
  rPub: ['.pub', 'borderTopLeftRadius'], rRoyalty: ['.royalty__card', 'borderTopLeftRadius'], rTool: ['.tool', 'borderTopLeftRadius'], rCta: ['.cta__card', 'borderTopLeftRadius'], rStack: ['.card', 'borderTopLeftRadius'],
  padFeature: ['.feature', 'paddingLeft'], padPub: ['.pub', 'paddingLeft'], padRoyalty: ['.royalty__card', 'paddingLeft'], padTool: ['.tool__body', 'paddingLeft'], padCta: ['.cta__card', 'paddingLeft'], padStack: ['.card__text', 'paddingLeft'],
  ctaAir: ['.cta__card', 'paddingTop'], padToolBottom: ['.tool__body', 'paddingBottom'],
  textGapPub: ['.pub__copy', 'rowGap'], textGapTool: ['.tool__copy', 'rowGap'], textGapHero: ['.hero__copy', 'rowGap'],
};
const COLLECT = (P) => {
  const o = {};
  for (const [k, [sel, prop]] of Object.entries(P)) { const e = document.querySelector(sel); o[k] = e ? Math.round(parseFloat(getComputedStyle(e)[prop]) * 100) / 100 : null; }
  const t = document.querySelector('.hero__title'); o.heroLines = Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).fontSize));
  const l = document.querySelector('.logo-card'); o.tile = Math.round(l.getBoundingClientRect().width * 10) / 10;
  const hero = document.querySelector('.hero'); o.heroH = Math.round(hero.getBoundingClientRect().height);
  const cta = document.querySelector('.cta__card'); o.ctaH = Math.round(cta.getBoundingClientRect().height);
  // the layouts: how many columns each block has, and the shape of the stack card
  const cols = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).gridTemplateColumns.split(' ').filter(Boolean).length : null; };
  o.colsFeatures = cols('.features'); o.colsRoyalty = cols('.royalty__cards'); o.colsPubs = cols('.pubs__grid'); o.colsTool = cols('.tool');
  const tr = document.querySelector('.logos__track'); o.colsLogos = Math.round(document.querySelector('.logos').clientWidth / (parseFloat(getComputedStyle(tr).gridTemplateColumns) + parseFloat(getComputedStyle(tr).columnGap)));
  o.deck = getComputedStyle(document.querySelector('.access__stage')).getPropertyValue('--deck').trim() === '1' ? 1 : 0;
  o.stackTall = getComputedStyle(document.querySelector('.card__art')).position === 'relative' ? 1 : 0;
  o.royaltyWide = getComputedStyle(document.querySelector('.royalty__text')).marginTop === '0px' && !!document.querySelector('.royalty__card[style], .royalty__card') && getComputedStyle(document.querySelector('.royalty__card')).containerName === 'royalty-card' ? 1 : 0;
  return o;
};
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = {};
  const only = process.argv[3]; const PORTS = { before: 8781, after: 8782 };
  for (const [tag, port] of Object.entries(PORTS).filter(([t]) => t === only)) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', bypassCSP: true });
    const page = await ctx.newPage();
    await page.goto(`${process.env['URL_' + port] || `http://127.0.0.1:${port}/`}`, { waitUntil: 'load' });
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 4000))]));
    await page.evaluate(async () => { const H = () => document.documentElement.scrollHeight; for (let y = 0; y < H(); y += innerHeight * 0.6) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); });
    // the drawings, dots and the ring are re-drawn in software at every size: hidden (they are absolutely placed, sizes do not depend on them)
    await page.addStyleTag({ content: '.art, canvas, .dots, .ring .rc-tilt, .hero-chips { display: none !important; }' });
    const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    out[tag] = { width: [], height: [] };
    for (let w = 320; w <= 1920; w += 10) { await page.setViewportSize({ width: w, height: 1100 }); await settle(); out[tag].width.push({ w, ...(await page.evaluate(COLLECT, PROPS)) }); }
    for (let h = 400; h <= 1100; h += 25) { await page.setViewportSize({ width: 1440, height: h }); await settle(); out[tag].height.push({ h, ...(await page.evaluate(COLLECT, PROPS)) }); }
    for (let h = 320; h <= 900; h += 25) { await page.setViewportSize({ width: 844, height: h }); await settle(); (out[tag].heightPhone ??= []).push({ h, ...(await page.evaluate(COLLECT, PROPS)) }); }
    await ctx.close();
    console.log(tag, 'done');
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out[only]));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
