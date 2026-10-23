# one screenshot per section at a screen size, everything shown (reduce motion): python3 look.py W H mobile url outdir
import asyncio, sys
from lib import *
SECS = ["nav", ".hero", ".stack", ".royalty", ".access", ".releases", ".clients", ".cta", ".tools", ".pubs", ".footer"]
async def main():
    w, h, mob, url, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3] == "1", sys.argv[4], sys.argv[5]
    async with async_playwright() as p:
        b, pg = await page(p, w, h, mob, url, calm=True)
        await warm(pg)
        for s in SECS:
            y = await pg.evaluate(f"(()=>{{const e=document.querySelector('{s}'); if(!e) return null; const r=e.getBoundingClientRect(); return r.top+scrollY}})()")
            if y is None: continue
            await pg.evaluate(f"scrollTo(0,{max(0,y-60)})"); await pg.wait_for_timeout(900)
            await pg.screenshot(path=f"{out}/{w}x{h}-{s.strip('.')}.jpg", quality=70, type="jpeg")
        await b.close()
asyncio.run(main())
