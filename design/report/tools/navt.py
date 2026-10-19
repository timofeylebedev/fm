import asyncio, sys
from lib import *
url=sys.argv[1]
async def main():
    async with async_playwright() as p:
        b,pg=await page(p,844,390,True,url)
        hero = await pg.evaluate("document.querySelector('.hero').offsetHeight")
        nav = await pg.evaluate("document.querySelector('.nav').offsetHeight")
        print("hero",hero,"nav",nav)
        T="(()=>{const n=document.querySelector('.nav');return [scrollY, Math.round(n.getBoundingClientRect().top), document.documentElement.classList.contains('nav-away')]})()"
        out=[]
        for y in range(0,900,30):
            await pg.mouse.wheel(0,30); await pg.wait_for_timeout(30)
            out.append(await pg.evaluate(T))
        print("down:", [o[:2] for o in out[::3]])
        await pg.wait_for_timeout(600); print("settled:", await pg.evaluate(T))
        for i in range(2):
            await pg.mouse.wheel(0,-8); await pg.wait_for_timeout(30)
        print("up 16:", await pg.evaluate(T)); await pg.wait_for_timeout(600); print("settled:", await pg.evaluate(T))
        for i in range(3):
            await pg.mouse.wheel(0,25); await pg.wait_for_timeout(30)
        await pg.wait_for_timeout(600); print("down 75 settled:", await pg.evaluate(T))
        await b.close()
asyncio.run(main())
