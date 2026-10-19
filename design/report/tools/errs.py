import asyncio
from lib import *
async def one(p,w,h,mob,calm):
    b,pg=await page(p,w,h,mob,"http://localhost:8002/?fmcards=debug" if calm=="dbg" else "http://localhost:8002/",calm==True)
    errs=[]; pg.on("pageerror",lambda e: errs.append(str(e))); pg.on("console",lambda m: errs.append(m.text) if m.type=="error" else None)
    await warm(pg)
    for d in (1,-1):
        for i in range(40):
            await pg.mouse.wheel(0,d*180); await pg.wait_for_timeout(25)
    await pg.wait_for_timeout(500); await b.close(); print(w,h,calm,errs[:3] or "no errors")
async def main():
    async with async_playwright() as p:
        await asyncio.gather(one(p,390,844,True,False), one(p,844,390,True,True))
        await asyncio.gather(one(p,1440,900,False,True), one(p,1440,900,False,"dbg"))
asyncio.run(main())
