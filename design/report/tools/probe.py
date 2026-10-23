import asyncio, sys, json
from lib import *
JS = """(()=>{const r=document.querySelector('.releases'), f=document.querySelector('.features'), lg=document.querySelector('.logos');
const cs=getComputedStyle(r); return {vw:innerWidth, docW:document.documentElement.clientWidth, releasesW:r.getBoundingClientRect().width, padL:cs.paddingLeft, contentW:r.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight), cols:getComputedStyle(f).gridTemplateColumns, logosW: lg.getBoundingClientRect().width, gutter:getComputedStyle(document.documentElement).getPropertyValue('--gutter'), scrollbar: innerWidth-document.documentElement.clientWidth, boxed: document.documentElement.className}})()"""
async def main():
    async with async_playwright() as p:
        for url in ["http://localhost:8001/","http://localhost:8002/"]:
            for (w,h,m) in [(390,1100,False),(390,844,True),(390,844,False),(1000,1100,False)]:
                b, pg = await page(p, w, h, m, url)
                print(url[-5:], w, h, m, json.dumps(await pg.evaluate(JS)))
                await b.close()
asyncio.run(main())
