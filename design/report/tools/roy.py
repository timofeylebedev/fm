import asyncio
from lib import *
async def main():
    async with async_playwright() as p:
        b, pg = await page(p, 600, 1100, False, "http://localhost:8002/", calm=True)
        await pg.add_style_tag(content="html{scrollbar-gutter:auto!important} .art,canvas,.dots{display:none!important}")
        res=[]
        for w in range(320, 1930, 10):
            await pg.set_viewport_size({"width": w, "height": 1100}); await pg.wait_for_timeout(120)
            res.append((w, await pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.royalty__text')).marginTop)===0?1:0")))
        segs=[]
        for w,v in res:
            if segs and segs[-1][2]==v: segs[-1][1]=w
            else: segs.append([w,w,v])
        print(segs); await b.close()
asyncio.run(main())
