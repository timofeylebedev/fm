# One screenshot per section of the page (as laid out, reduced motion so every reveal is done):
# python3 sections.py url out_prefix W H [mobile 0/1] [dpr]
import asyncio, sys
from lib import *
url, pre, W, H = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
mob = len(sys.argv) > 5 and sys.argv[5] == "1"; D = float(sys.argv[6]) if len(sys.argv) > 6 else 1
SECS = ["header.nav", ".hero", ".stack", ".royalty", ".access", ".releases", ".clients", ".cta", ".tools", ".pubs", ".footer"]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CH, args=ARGS)
        ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=D, is_mobile=mob, has_touch=mob, bypass_csp=True, reduced_motion="reduce")
        await prep(ctx)
        pg = await ctx.new_page(); await pg.goto(url); await pg.wait_for_timeout(1200); await warm(pg)
        for sel in SECS:
            el = await pg.query_selector(sel)
            if not el: print("missing", sel); continue
            await el.scroll_into_view_if_needed(); await pg.wait_for_timeout(700)
            name = sel.strip(".").replace("header.", "")
            try:
                await el.screenshot(path=f"{pre}-{name}.png", timeout=20000); print(f"{pre}-{name}.png")
            except Exception as e: print("fail", sel, str(e)[:80])
        await b.close()
asyncio.run(main())
