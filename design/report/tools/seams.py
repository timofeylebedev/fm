# count hairlines of card colour in the white strips between cards, across the stack: python3 seams.py W H dpr url
import asyncio, sys, io
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright
from lib import CH, ARGS, warm
W,H,D,url = int(sys.argv[1]),int(sys.argv[2]),float(sys.argv[3]),sys.argv[4]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CH, args=ARGS)
        ctx = await b.new_context(viewport={"width":W,"height":H}, device_scale_factor=D, is_mobile=W<1024, has_touch=W<1024, bypass_csp=True)
        pg = await ctx.new_page(); await pg.goto(url); await pg.wait_for_timeout(800); await warm(pg)
        await pg.add_style_tag(content=".card__art,canvas,.card__text,.stack__end-pin,.nav{opacity:0!important}")
        r = await pg.evaluate("(()=>{const s=document.querySelector('[data-stack]');const b=s.getBoundingClientRect();return [b.top+scrollY,b.bottom+scrollY]})()")
        bad=0; N=90; worst=0
        for i in range(N):
            y = r[0] + (r[1]-r[0]-1.3*H)*i/(N-1) + 0.37*i
            await pg.evaluate(f"scrollTo(0,{y})"); await pg.wait_for_timeout(120)
            a = np.asarray(Image.open(io.BytesIO(await pg.screenshot())).convert("RGB")).astype(int)
            mx, mn = a.max(2), a.min(2)
            white = (mn > 240); col = (mx - mn) > 25
            k = 3   # a hairline: coloured, with white 3 device px on both sides (above and below, or left and right)
            hv = col[k:-k, k:-k] & white[:-2*k, k:-k] & white[2*k:, k:-k]
            vv = col[k:-k, k:-k] & white[k:-k, :-2*k] & white[k:-k, 2*k:]
            line = int(hv.sum() + vv.sum())
            if line > 20:
                bad+=1; worst=max(worst,int(line))
                if bad in (1,5,20):
                    img=Image.fromarray(a.astype('uint8')); px=img.load()
                    ys,xs=np.nonzero(hv|vv)
                    for yy,xx in zip(ys,xs): px[int(xx)+k,int(yy)+k]=(255,0,255)
                    img.save(f'seam-{W}-{url[-6:-1]}-{bad}.png')
        print(f"{W}x{H}@{D} {url}: frames with seam rows {bad}/{N} (worst {worst} px)")
        await b.close()
asyncio.run(main())
