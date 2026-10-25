# The whole responsive picture: every size of the page and every block's layout state, at widths 320..1920
# Overlay scrollbars (a Mac, a phone) by default; FM_GUTTER=1 keeps the stable gutter, which headless Chromium fills like a classic scrollbar.
# (step 10, 1100 tall) and heights 400..1100 (step 25, 1440 wide). python3 fullsweep.py url out.json
# Sizes feed the report's picture block, states (keys starting with "@") its responsive map.
import asyncio, json, sys
from lib import *
JS = r"""(()=>{
const shown = (e) => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
const vis = (sel) => [...document.querySelectorAll(sel)].find(shown) || document.querySelector(sel);
const all = (sel) => [...document.querySelectorAll(sel)].filter(shown);
const cs = (sel) => { const e = vis(sel); return e ? getComputedStyle(e) : null; };
const r2 = (v) => Math.round(v*100)/100;
const f = (sel) => { const s = cs(sel); return s ? r2(parseFloat(s.fontSize)) : null; };
const p = (sel, k) => { const s = cs(sel); return s ? r2(parseFloat(s[k])) : null; };
const h = (sel) => { const e = vis(sel); return e ? r2(e.getBoundingClientRect().height) : null; };
const w = (sel) => { const e = vis(sel); return e ? r2(e.getBoundingClientRect().width) : null; };
const tok = (v) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;visibility:hidden;width:' + v; document.body.appendChild(d); const x = d.getBoundingClientRect().width; d.remove(); return r2(x); };
const gap = (sel) => { const s = cs(sel); return s ? r2(parseFloat(s.rowGap || s.gap)) : null; };
// columns of a grid: children whose top equals the first child's top
const cols = (sel) => { const k = all(sel); if (!k.length) return null; const xs = []; for (const e of k) { const x = e.getBoundingClientRect().left; if (!xs.some(v => Math.abs(v - x) < 4)) xs.push(x); } return xs.length; };
const lines = (sel) => { const e = vis(sel); if (!e) return null; const lh = parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize); return Math.round(e.getBoundingClientRect().height / lh); };
const beside = (a, b) => { const x = vis(a), y = vis(b); if (!x || !y) return null; const A = x.getBoundingClientRect(), B = y.getBoundingClientRect(); return B.left >= A.right - 4 ? 'side by side' : 'stacked'; };
const R = (sel) => { const e = vis(sel); return e ? e.getBoundingClientRect() : null; };
const out = {
 hero: f('.hero__title'), h2: f('.head__title'), cardTitle: f('.card__title'), heading: f('.pub__title'), royalty: f('.royalty__text'),
 toolTitle: f('.tool__title'), lead: f('.hero__lead'), ctaLead: f('.cta__lead'), ctaTitle: f('.cta__title'), tag: f('.card__tag-label'),
 toolDesc: f('.tool__desc'), feature: f('.feature__desc'), featureTitle: f('.feature__title'), statNum: f('.stat__number'), statLabel: f('.stat__label'),
 byline: f('.pub__author'), body: f('.pub__desc'), ui: f('.footer__note'), navLink: f('.nav__link'), button: f('.hero .btn'), logoName: f('.logo-card__name'),
 gutter: tok('var(--gutter)'), sectionY: tok('var(--section-y)'), sectionGap: tok('var(--section-gap)'), airL: tok('var(--section-air-l)'), inset: tok('var(--inset)'),
 gapTiles: tok('var(--gap-tiles)'), gapCards: tok('var(--gap-cards)'), navPadY: p('.nav','paddingTop'), navPadL: p('.nav','paddingLeft'),
 textGapPub: tok('var(--text-gap)'), textGapHero: gap('.hero__copy'), actionGap: tok('var(--action-gap)'), featureGap: tok('var(--feature-gap)'),
 rTile: p('.feature','borderTopLeftRadius'), rLogo: p('.logo-card','borderTopLeftRadius'), rStat: p('.stat','borderTopLeftRadius'),
 rId: p('.idcard__face','borderTopLeftRadius') || p('.idcard','borderTopLeftRadius'), rPub: p('.pub','borderTopLeftRadius'),
 rRoyalty: p('.royalty__card','borderTopLeftRadius'), rTool: p('.tool','borderTopLeftRadius'), rCta: p('.cta__card','borderTopLeftRadius'),
 rStack: p('.card','borderTopLeftRadius'), rButton: p('.hero .btn','borderTopLeftRadius'),
 padFeature: p('.feature','paddingLeft'), padLogo: p('.logo-card','paddingLeft'), padStat: p('.stat','paddingLeft'), padPub: p('.pub__body','paddingLeft') || p('.pub','paddingLeft'),
 padRoyalty: p('.royalty__card','paddingLeft'), padTool: p('.tool__body','paddingLeft') || p('.tool','paddingLeft'), padToolBottom: p('.tool__body','paddingBottom'),
 padCta: p('.cta__card','paddingLeft'), padStack: tok('var(--card-pad)'), ctaAir: p('.cta__card','paddingTop'),
 tile: h('.logo-card'), stat: h('.stat'), feat: h('.feature'), toolH: h('.tool'), heroH: h('.hero'), ctaH: h('.cta__card'), idW: w('.idcard'),
 heroAirTop: (()=>{const t=R('.hero__text'), n=R('.nav'); return t&&n ? r2(t.top-n.bottom) : null})(),
 heroAirBottom: (()=>{const t=R('.hero__text'), s=R('.hero__stage'), i=R('.hero__table'); return t&&s&&i ? r2(s.bottom-i.height-t.bottom) : null})(),
 heroPic: h('.hero__table'), column: w('.releases .head') || w('.features'),
 '@nav': (()=>{const b=vis('.nav__burger'); return b && getComputedStyle(b).display!=='none' && b.getBoundingClientRect().width>0 ? 'burger' : 'links'})(),
 '@heroTitle': (()=>{const t=vis('.hero__title'); if(!t) return null; const n=lines('.hero__title'); return n + ' lines'})(),
 '@stackCard': beside('.card__text', '.card__art') === 'side by side' ? 'horizontal' : 'vertical',
 '@royalty': (()=>{const c=cols('.royalty__card'); const k=vis('.royalty__card'); const t=k&&k.querySelector('.royalty__text'), a=k&&k.querySelector('.art'); let wide=null; if(t&&a){wide = a.getBoundingClientRect().left >= t.getBoundingClientRect().right-4}; return c + (c>1?' cols':' col') + (wide ? ', wide card' : '')})(),
 '@idcards': (()=>{const k=all('.access__slot'); if(k.length<2) return null; const xs=k.map(e=>e.getBoundingClientRect().left); return (Math.max(...xs)-Math.min(...xs) > k[0].getBoundingClientRect().width*0.6) ? 'row' : 'stack'})(),
 '@features': cols('.feature') + ' cols', '@logos': (()=>{const t=vis('.logos__track'); return t ? getComputedStyle(t).getPropertyValue('--cols').trim() + ' cols' : null})(),
 '@tools': beside('.tool__body', '.tool__media'), '@pubs': cols('.pub') + ' cols',
 '@footer': (()=>{const e=vis('.footer__legal-row'); if(!e) return null; const s=getComputedStyle(e); if(s.display.includes('flex')) return s.flexDirection.startsWith('column') ? 'column' : 'row'; if(s.display.includes('grid')) { const n=s.gridTemplateColumns.split(' ').filter(Boolean).length; return n>1 ? n+' cols' : 'column'; } return s.display})(),
 overflow: document.documentElement.scrollWidth > innerWidth + 1 ? document.documentElement.scrollWidth - innerWidth : 0,
};
return out;})()"""
async def run(url, sizes, axis):
    out = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CH, args=ARGS)
        ctx = await b.new_context(viewport={"width": sizes[0][0], "height": sizes[0][1]}, bypass_csp=True, reduced_motion="reduce")
        await prep(ctx)
        pg = await ctx.new_page(); await pg.goto(url); await pg.add_style_tag(content=".art{visibility:hidden!important} canvas,.dots{display:none!important}")
        await pg.wait_for_timeout(800); await warm(pg)
        for (w, h) in sizes:
            await pg.set_viewport_size({"width": w, "height": h}); await pg.wait_for_timeout(450)
            d = await pg.evaluate(JS); d[axis] = w if axis == "w" else h; out.append(d)
        await b.close()
    return out
async def main():
    url, outp = sys.argv[1], sys.argv[2]
    W = [(w, 1100) for w in range(320, 1921, 10)]; H = [(1440, h) for h in range(400, 1101, 25)]
    a, bh = await asyncio.gather(run(url, W, "w"), run(url, H, "h"))
    json.dump({"width": a, "height": bh}, open(outp, "w"))
    print(outp, len(a), len(bh))
if __name__ == "__main__": asyncio.run(main())
