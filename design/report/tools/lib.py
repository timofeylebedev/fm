import asyncio, json, sys
from playwright.async_api import async_playwright
CH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
ARGS = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"]
async def page(p, w, h, mobile=False, url="http://localhost:8001/", calm=False):
    b = await p.chromium.launch(executable_path=CH, args=ARGS)
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile, bypass_csp=True,
                              reduced_motion="reduce" if calm else "no-preference")
    pg = await ctx.new_page()
    await pg.goto(url, wait_until="load")
    await pg.wait_for_timeout(800)
    return b, pg
async def warm(pg):
    H = await pg.evaluate("document.documentElement.scrollHeight")
    y = 0
    while y < H:
        await pg.evaluate(f"scrollTo(0,{y})"); await pg.wait_for_timeout(40); y += 400
    await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(500)
