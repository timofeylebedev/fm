# crops at the meeting of two cards: python3 edge.py W H dpr url out
import asyncio, sys, io
from PIL import Image
from playwright.async_api import async_playwright
from lib import CH, ARGS, warm
W,H,D,url,out = int(sys.argv[1]),int(sys.argv[2]),float(sys.argv[3]),sys.argv[4],sys.argv[5]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CH, args=ARGS)
        ctx = await b.new_context(viewport={"width":W,"height":H}, device_scale_factor=D, is_mobile=True, has_touch=True, bypass_csp=True)
        pg = await ctx.new_page(); await pg.goto(url); await pg.wait_for_timeout(800); await warm(pg)
        # positions where card 2 is half up over card 1, and where card 1 is a pill
        s = await pg.evaluate("(()=>{const c=fmCards.cards;const s=document.querySelector('[data-stack]');return {top:s.getBoundingClientRect().top+scrollY, from:c.map(x=>x.from), to:c.map(x=>x.to)}})()")
        ims=[]
        for k,frac in enumerate([0.3,0.6,0.9,0.97]):
            V = H
            y = s['top'] + s['to'][0] - V + 0 + frac*(V*0.9)
            await pg.evaluate(f"scrollTo(0,{y})"); await pg.wait_for_timeout(600)
            im = Image.open(io.BytesIO(await pg.screenshot()))
            ims.append(im)
        await b.close()
    g = Image.new("RGB",(sum(i.width for i in ims)+30, ims[0].height),"#888"); x=0
    for i in ims: g.paste(i,(x,0)); x+=i.width+10
    g.save(out)
asyncio.run(main())
