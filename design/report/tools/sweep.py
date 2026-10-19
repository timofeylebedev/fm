# hero sweep: widths 320..1920 step 20 at 1100 tall; heights 360..1440 step 40 at 1440 wide and at 844 wide (sideways/phones)
import asyncio, json, sys
from lib import *
JS = """(()=>{const h=document.querySelector('.hero'),st=document.querySelector('.hero__stage'),tx=document.querySelector('.hero__text'),n=document.querySelector('.nav'),t=document.querySelector('.hero__title');
const r=e=>e.getBoundingClientRect();const pic=document.querySelector('.hero__table');
return {heroH:r(h).height, airTop:r(tx).top-r(n).bottom, airBottom:r(st).bottom-r(pic).height-r(tx).bottom, pic:r(pic).height, title:parseFloat(getComputedStyle(t).fontSize), text:r(tx).height, fold: innerHeight-r(h).height}})()"""
async def run(url, sizes):
    out=[]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CH, args=ARGS)
        for (w,h) in sizes:
            mob = w < 1024
            ctx = await b.new_context(viewport={"width":w,"height":h}, is_mobile=mob, has_touch=mob, bypass_csp=True)
            pg = await ctx.new_page()
            await pg.route("**/*.{avif,webp,png,jpg}", lambda r: r.continue_())
            await pg.goto(url); await pg.add_style_tag(content=".art,canvas{display:none!important}"); await pg.wait_for_timeout(250)
            d = await pg.evaluate(JS); d = {k: round(v,1) for k,v in d.items()}; out.append(d); await ctx.close()
        await b.close()
    return out
async def main():
    W=[(w,1100) for w in range(320,1921,40)]
    Hs=[(1440,h) for h in range(400,1441,40)]
    res={}
    for name,url in (("before","http://localhost:8001/"),("after","http://localhost:8002/")):
        a,bh = await asyncio.gather(run(url,W), run(url,Hs))
        res[name]={"width":[dict(w=w,**d) for (w,_),d in zip(W,a)], "height":[dict(h=h,**d) for (_,h),d in zip(Hs,bh)]}
    json.dump(res,open('hero-sweep.json','w'))
    for k in ('before','after'):
        print(k, [ (r['w'],r['heroH'],r['pic']) for r in res[k]['width'][::8]], [ (r['h'],r['heroH'],r['pic']) for r in res[k]['height'][::5]])
asyncio.run(main())
