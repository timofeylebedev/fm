# frames through the hand-off of card k → k+1, down then back up: python3 hand.py W H mob url out [k]
import asyncio, sys, io
from PIL import Image
from lib import *
W,H,mob,url,out = int(sys.argv[1]),int(sys.argv[2]),sys.argv[3]=="1",sys.argv[4],sys.argv[5]
K = int(sys.argv[6]) if len(sys.argv)>6 else 0
async def main():
    async with async_playwright() as p:
        b, pg = await page(p, W, H, mob, url); await warm(pg)
        g = await pg.evaluate(f"""(()=>{{const c=fmCards.cards,s=document.querySelector('[data-stack]');
          const top=s.getBoundingClientRect().top+scrollY, m=c[{K}].m;
          // p = V - sectionTop(view) - (padTop-navH)  =>  scrollY = top + p - V + padTop - navH
          const st=document.querySelector('.stack__stage'), padTop=parseFloat(getComputedStyle(st).paddingTop), navH=parseFloat(getComputedStyle(c[0].el).top);
          const V=m.A+navH+parseFloat(getComputedStyle(st).paddingBottom);
          return {{base: top - V + padTop - navH, a: c[{K}].to + m.A*0.5, z: c[{K+1}].from + 0.55*V}}}})()""")
        shots=[]; N=14
        ys=[g['base']+g['a']+(g['z']-g['a'])*i/(N-1) for i in range(N)]
        for y in ys + ys[::-1][1:8]:
            await pg.evaluate(f"scrollTo(0,{y})"); await pg.wait_for_timeout(260)
            shots.append(Image.open(io.BytesIO(await pg.screenshot())))
        await b.close()
    sc=0.32 if W<1000 else 0.2; tw,th=int(W*sc),int(H*sc); cols=7
    G=Image.new("RGB",(cols*(tw+5),((len(shots)+cols-1)//cols)*(th+5)),"#888")
    for i,im in enumerate(shots): G.paste(im.convert("RGB").resize((tw,th)),((i%cols)*(tw+5),(i//cols)*(th+5)))
    G.save(out)
asyncio.run(main())
