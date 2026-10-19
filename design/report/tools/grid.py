# frame grid through the stack: python3 grid.py W H mobile(0/1) url out.png [n] [wait]
import asyncio, sys, io
from PIL import Image
from lib import *
W,H,mob,url,out = int(sys.argv[1]),int(sys.argv[2]),sys.argv[3]=="1",sys.argv[4],sys.argv[5]
N = int(sys.argv[6]) if len(sys.argv)>6 else 32
WAIT = int(sys.argv[7]) if len(sys.argv)>7 else 450
async def main():
    async with async_playwright() as p:
        b, pg = await page(p, W, H, mob, url)
        await warm(pg)
        r = await pg.evaluate("(()=>{const s=document.querySelector('[data-stack]');const b=s.getBoundingClientRect();return [b.top+scrollY,b.bottom+scrollY]})()")
        a, z = r[0]-H*0.6, r[1]+H*0.2
        shots=[]
        for i in range(N):
            y = a + (z-a)*i/(N-1)
            await pg.evaluate(f"scrollTo(0,{y})"); await pg.wait_for_timeout(WAIT)
            shots.append((round(y), Image.open(io.BytesIO(await pg.screenshot()))))
        await b.close()
    cols = 8; sc = 0.25 if W>=1000 else 0.4
    tw, th = int(W*sc), int(H*sc)
    rows = (N+cols-1)//cols
    g = Image.new("RGB",(cols*(tw+6), rows*(th+6)),"#888")
    for i,(y,im) in enumerate(shots):
        g.paste(im.convert("RGB").resize((tw,th)), ((i%cols)*(tw+6), (i//cols)*(th+6)))
    g.save(out); print(out, a, z)
asyncio.run(main())
