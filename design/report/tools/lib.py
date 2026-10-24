import asyncio, json, sys
from playwright.async_api import async_playwright
import glob, os
# Claude's workspace has Playwright's Chromium under /opt/pw-browsers (the folder name changes with its version)
CH = os.environ.get("PLAYWRIGHT_CHROMIUM") or next(iter(sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome"), reverse=True)), None)
ARGS = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"]
async def overlay(route):
    # main's html has scrollbar-gutter: stable (book.css, since the booking window): headless Chromium fills it like a
    # classic 15px scrollbar even with --hide-scrollbars. Measure as with overlay scrollbars (a Mac, a phone) unless FM_GUTTER=1.
    r = await route.fetch(); body = (await r.text()).replace("scrollbar-gutter:stable", "scrollbar-gutter:auto")
    await route.fulfill(response=r, body=body)
async def prep(ctx):
    if not os.environ.get("FM_GUTTER"): await ctx.route("**/*.css", overlay)
    return ctx
async def page(p, w, h, mobile=False, url="http://localhost:8001/", calm=False):
    b = await p.chromium.launch(executable_path=CH, args=ARGS)
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile, bypass_csp=True,
                              reduced_motion="reduce" if calm else "no-preference")
    await prep(ctx)
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
