import asyncio
from lib import *
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CH, args=ARGS)
        pg = await (await b.new_context(viewport={"width":320,"height":900}, bypass_csp=True)).new_page()
        await pg.goto("http://localhost:8002/"); await pg.add_style_tag(content=".art,canvas,.dots{display:none!important}"); await pg.wait_for_timeout(600)
        bad=[]; ws=list(range(320,1921,16))
        for w in ws:
            await pg.set_viewport_size({"width":w,"height":900}); await pg.wait_for_timeout(120)
            o = await pg.evaluate("document.documentElement.scrollWidth - innerWidth")
            if o>0: bad.append((w,o))
        print("widths", len(ws), "sideways scroll at", bad)
        await b.close()
asyncio.run(main())
