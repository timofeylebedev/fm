# the whole responsive picture: every key of the round-3 picture block, at widths 320..1920 (step 10, 1100 tall) and
# heights 400..1100 (step 25, 1440 wide). python3 fullsweep.py url out.json
import asyncio, json, sys
from lib import *
JS = r"""(()=>{
const vis = (sel) => [...document.querySelectorAll(sel)].find(e => e.getClientRects().length && getComputedStyle(e).visibility!=='hidden') || document.querySelector(sel);
const cs = (sel) => { const e = vis(sel); return e ? getComputedStyle(e) : null; };
const px = (v) => Math.round(parseFloat(v)*100)/100;
const f = (sel) => { const s = cs(sel); return s ? px(s.fontSize) : null; };
const p = (sel, k) => { const s = cs(sel); return s ? px(s[k]) : null; };
const h = (sel) => { const e = vis(sel); return e ? Math.round(e.getBoundingClientRect().height*100)/100 : null; };
const tok = (v) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;visibility:hidden;width:' + v; document.body.appendChild(d); const w = d.getBoundingClientRect().width; d.remove(); return Math.round(w*100)/100; };
const gap = (sel) => { const s = cs(sel); return s ? px(s.rowGap || s.gap) : null; };
return {
 hero: f('.hero__title'), h2: f('.head__title'), cardTitle: f('.card__title'), heading: f('.pub__title'), royalty: f('.royalty__text'),
 lead: f('.hero__lead'), ctaLead: f('.cta__lead'), tag: f('.card__tag-label'), toolDesc: f('.tool__desc'), feature: f('.feature__desc'),
 byline: f('.pub__author'), body: f('.pub__desc'), ui: f('.footer__note'),
 gutter: tok('var(--gutter)'), sectionY: tok('var(--section-y)'), sectionGap: tok('var(--section-gap)'), inset: tok('var(--inset)'),
 gapTiles: tok('var(--gap-tiles)'), gapCards: tok('var(--gap-cards)'), navPadY: p('.nav','paddingTop'), navPadL: p('.nav','paddingLeft'),
 textGapPub: tok('var(--text-gap)'), textGapHero: gap('.hero__copy'),
 rTile: p('.feature','borderTopLeftRadius'), rId: p('.idcard','borderTopLeftRadius'), rPub: p('.pub','borderTopLeftRadius'),
 rRoyalty: p('.royalty__card','borderTopLeftRadius'), rTool: p('.tool','borderTopLeftRadius'), rCta: p('.cta__card','borderTopLeftRadius'),
 rStack: p('.card','borderTopLeftRadius'), padFeature: p('.feature','paddingLeft'), padPub: p('.pub__body','paddingLeft') || p('.pub','paddingLeft'),
 padTool: p('.tool__body','paddingLeft') || p('.tool','paddingLeft'), padToolBottom: p('.tool__body','paddingBottom'), padCta: p('.cta__card','paddingLeft'),
 padStack: tok('var(--card-pad)'), ctaAir: p('.cta__card','paddingTop'), tile: h('.logo-card'), heroH: h('.hero'), ctaH: h('.cta__card'),
 heroAirTop: (()=>{const t=vis('.hero__text'), n=vis('.nav'); return t&&n ? Math.round((t.getBoundingClientRect().top-n.getBoundingClientRect().bottom)*10)/10 : null})(),
 heroAirBottom: (()=>{const t=vis('.hero__text'), s=vis('.hero__stage'), i=vis('.hero__table'); return t&&s&&i ? Math.round((s.getBoundingClientRect().bottom-i.getBoundingClientRect().height-t.getBoundingClientRect().bottom)*10)/10 : null})(),
 heroPic: h('.hero__table')
};})()"""
async def run(url, sizes, axis):
    out=[]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CH, args=ARGS)
        ctx = await b.new_context(viewport={"width":sizes[0][0],"height":sizes[0][1]}, bypass_csp=True)
        pg = await ctx.new_page(); await pg.goto(url); await pg.add_style_tag(content=".art,canvas,.dots{display:none!important}")
        await pg.wait_for_timeout(800)
        for (w,h) in sizes:
            await pg.set_viewport_size({"width":w,"height":h}); await pg.wait_for_timeout(450)
            d = await pg.evaluate(JS); d[axis] = w if axis=="w" else h; out.append(d)
        await b.close()
    return out
async def main():
    url, outp = sys.argv[1], sys.argv[2]
    W = [(w,1100) for w in range(320,1921,10)]; H = [(1440,h) for h in range(400,1101,25)]
    a, bh = await asyncio.gather(run(url,W,"w"), run(url,H,"h"))
    json.dump({"width":a,"height":bh}, open(outp,"w"))
    print(outp, a[0], bh[0])
asyncio.run(main())
