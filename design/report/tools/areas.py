# round 5: the parts that moved since round 4, at 22 real screen sizes: python3 areas.py url out.json
# (the hero's parts as herom.py, the ID cards as drawn, the feature tiles, the royalty titles, the air of tools and publications)
import asyncio, sys, json
from lib import *
from herom import SIZES
url = sys.argv[1]; out = sys.argv[2]
JS = r"""(()=>{const q=s=>[...document.querySelectorAll(s)].find(e=>e.getClientRects().length)||document.querySelector(s);
const r=e=>e.getBoundingClientRect(); const cs=e=>getComputedStyle(e);
const lines=e=>{const g=document.createRange(); g.selectNodeContents(e); return new Set([...g.getClientRects()].filter(x=>x.width>2).map(x=>Math.round(x.top))).size};
const h=q('.hero'),tx=q('.hero__text'),n=q('.nav'),st=q('.hero__stage'),tb=q('.hero__table'),t=q('.hero__title');
const id=q('.idcard'), row=q('.idcard__row'), f=q('.feature'), fd=q('.feature__desc'), rt=q('.royalty__text'), tools=q('.tools');
const k=new DOMMatrix(cs(q('.access__cards')).transform).a;   // the row's or the deck's scale (a card's own box is turned: its rect is wider)
return {H:innerHeight, hero:r(h).height, airTop:r(tx).top-r(n).bottom, pic:r(tb).height, title:parseFloat(cs(t).fontSize),
 heads: r(st).top+r(st).height-r(tb).height-r(tx).bottom,
 idK:Math.round(k*1000)/1000, idRow:Math.round(parseFloat(cs(row).fontSize)*k*100)/100, deck: cs(q('.access__stage')).getPropertyValue('--deck').trim()==='1',
 rTile:parseFloat(cs(f).borderTopLeftRadius), featText:Math.round(r(fd).width), featLines:lines(fd), featCols:cs(q('.features')).gridTemplateColumns.split(' ').length,
 royLines:lines(rt), royW:Math.round(r(rt).width), air:parseFloat(cs(tools).paddingTop)}})()"""
async def one(p, w, h):
    mob = w < 1024 or (w < 1100 and h > w)
    b, pg = await page(p, w, h, mob, url, calm=True)
    await pg.add_style_tag(content="html{scrollbar-gutter:auto!important}")
    await warm(pg); await pg.wait_for_timeout(300)
    d = await pg.evaluate(JS); await b.close(); d["W"] = w; return d
async def main():
    res = []
    async with async_playwright() as p:
        for i in range(0, len(SIZES), 2):
            res += await asyncio.gather(*[one(p, *s) for s in SIZES[i:i + 2]])
    json.dump(res, open(out, "w"))
    for d in res: print(d)
if __name__ == "__main__": asyncio.run(main())
