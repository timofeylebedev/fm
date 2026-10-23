# lines and characters per line of the texts that are measured in their own letters, across widths (1100 tall):
# python3 lines.py url
import asyncio, sys, json
from lib import *
JS = r"""(sels)=>Object.fromEntries(sels.map(s=>{const e=[...document.querySelectorAll(s)].find(x=>x.getClientRects().length); if(!e) return [s,null];
 const r=document.createRange(); r.selectNodeContents(e); const tops=new Set([...r.getClientRects()].filter(q=>q.width>2).map(q=>Math.round(q.top)));
 const n=tops.size||1; return [s,{lines:n, cpl:Math.round(e.textContent.trim().length/n), w:Math.round(e.getBoundingClientRect().width)}]}))"""
SELS = [".royalty__text", ".feature__desc", ".tool__desc", ".pub__desc", ".cta__lead", ".hero__lead", ".head__title", ".cta__title"]
async def main():
    url = sys.argv[1]; out = []
    async with async_playwright() as p:
        b, pg = await page(p, 1440, 1100, False, url, calm=True)
        await pg.add_style_tag(content="html{scrollbar-gutter:auto!important} .art,canvas,.dots{display:none!important}")
        await warm(pg)
        for w in range(320, 1930, 40):
            await pg.set_viewport_size({"width": w, "height": 1100}); await pg.wait_for_timeout(350)
            d = await pg.evaluate(JS, SELS); d["w"] = w; out.append(d)
        await b.close()
    for d in out: print(d["w"], " ".join(f"{s.split('__')[0][1:]}/{s.split('__')[1]}={v['lines']}×{v['cpl']}" for s, v in d.items() if s != "w" and v))
asyncio.run(main())
