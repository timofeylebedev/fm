import asyncio, json
from playwright.async_api import async_playwright
from lib import CH
JS = """(()=>{const r=document.querySelector('.releases'); const pg=document.querySelector('.page');
return {cls: document.documentElement.className.includes('boxed'), vw: innerWidth, htmlClient: document.documentElement.clientWidth,
 pageClient: pg ? pg.clientWidth : null, releasesW: r.getBoundingClientRect().width, right: innerWidth - r.getBoundingClientRect().right}})()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CH, args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])   # classic 15px scrollbars
        for url in ["http://localhost:8001/","http://localhost:8002/"]:
            for q in ["", "?fmbox=1"]:
                ctx = await b.new_context(viewport={"width":1000,"height":900}, bypass_csp=True); pg = await ctx.new_page()
                await pg.goto(url+q); await pg.wait_for_timeout(1200)
                print(url[-5:], q or "window", json.dumps(await pg.evaluate(JS)))
                await pg.screenshot(path=f"/tmp/claude-0/-home-user-fm/eabc0b5f-187f-5bd7-8bb5-ac7c409cc832/scratchpad/box-{url[-5:-1]}{q.replace('?','-').replace('=','')}.png", clip={"x":700,"y":0,"width":300,"height":300})
                await ctx.close()
        await b.close()
asyncio.run(main())
