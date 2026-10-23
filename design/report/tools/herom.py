import asyncio, sys, json
from lib import *
url, out = (sys.argv + ["", ""])[1:3]
SIZES = [(320,568),(375,667),(390,844),(430,932),(568,320),(667,375),(844,390),(932,430),(768,1024),(1024,768),(1024,1366),(1280,620),(1280,720),(1280,800),(1366,650),(1366,768),(1440,900),(1536,864),(1920,1080),(1920,960),(2560,1440),(1440,1440)]
JS = """(()=>{const h=document.querySelector('.hero'),st=document.querySelector('.hero__stage'),t=document.querySelector('.hero__title'),tx=document.querySelector('.hero__text'),n=document.querySelector('.nav'),tb=document.querySelector('.hero__table');
const r=e=>e.getBoundingClientRect();return {H:innerHeight,hero:r(h).height,navB:r(n).bottom,textT:r(tx).top,textB:r(tx).bottom,title:parseFloat(getComputedStyle(t).fontSize),stageT:r(st).top,stageH:r(st).height,pic:r(tb).height,picW:r(tb).width}})()"""
async def one(p,w,h):
    mob = w<1024 or (w<1100 and h>w)
    b, pg = await page(p,w,h,mob,url)
    await pg.wait_for_timeout(300)
    d = await pg.evaluate(JS); await b.close(); d['W']=w; return d
async def main():
    res=[]
    async with async_playwright() as p:
        for i in range(0,len(SIZES),2):
            res += await asyncio.gather(*[one(p,*s) for s in SIZES[i:i+2]])
    json.dump(res,open(out,'w'))
    print(f"{'size':>10} {'hero':>5} {'airTop':>6} {'text':>5} {'gap':>5} {'pic':>5} {'title':>5} {'heads%'}")
    for d in res:
        heads = d['stageT']+d['stageH']-d['pic']  # picture top
        print(f"{d['W']:>4}x{d['H']:<5} {d['hero']:>5.0f} {d['textT']-d['navB']:>6.0f} {d['textB']-d['textT']:>5.0f} {heads-d['textB']:>5.0f} {d['pic']:>5.0f} {d['title']:>5.1f}")
if __name__ == "__main__": asyncio.run(main())
