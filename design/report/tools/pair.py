# before/after pairs at a scroll state: python3 pair.py out.jpg W H mob dpr "<js returning scrollY>" [crop x,y,w,h] [wait_ms] [hide_css]
import asyncio, sys, io, glob, os
# round 5: FM_PAIR="Round 4|Now" sets the two labels; the stable scrollbar gutter (book.css) is switched off in both, as on phones
L0, L1 = os.environ.get("FM_PAIR", "Before|After").split("|")
from PIL import Image, ImageDraw, ImageFont
from playwright.async_api import async_playwright
from lib import CH, ARGS, warm
out,W,H,mob,D,js = sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),sys.argv[4]=="1",float(sys.argv[5]),sys.argv[6]
crop = tuple(map(int,sys.argv[7].split(','))) if len(sys.argv)>7 and sys.argv[7] else None
WAIT = int(sys.argv[8]) if len(sys.argv)>8 else 900
FONT = (glob.glob('/usr/share/fonts/truetype/google-fonts/Inter*') + glob.glob('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))[0]
async def shot(p,url):
    b = await p.chromium.launch(executable_path=CH, args=ARGS)
    ctx = await b.new_context(viewport={"width":W,"height":H}, device_scale_factor=D, is_mobile=mob, has_touch=mob, bypass_csp=True)
    pg = await ctx.new_page(); await pg.goto(url); await pg.add_style_tag(content="html{scrollbar-gutter:auto!important}"); await pg.wait_for_timeout(900); await warm(pg)
    y = await pg.evaluate(js)
    if y is not None:
        # come from a little above, so whatever follows the direction of the scroll sees "down"
        await pg.evaluate(f"scrollTo(0,{y}-40)"); await pg.wait_for_timeout(250)
        for k in range(4): await pg.evaluate(f"scrollTo(0,{y}-40+{k+1}*10)"); await pg.wait_for_timeout(40)
    await pg.wait_for_timeout(WAIT)
    im = Image.open(io.BytesIO(await pg.screenshot())).convert("RGB"); await b.close()
    if crop: im = im.crop(tuple(int(v*D) for v in (crop[0],crop[1],crop[0]+crop[2],crop[1]+crop[3])))
    return im
async def main():
    async with async_playwright() as p:
        a,b = await asyncio.gather(shot(p,"http://localhost:8001/"), shot(p,"http://localhost:8002/"))
    # each side at most 490 wide and 560 tall
    k = min(490/a.width, 560/a.height); a=a.resize((int(a.width*k),int(a.height*k))); b=b.resize(a.size)
    G = Image.new("RGB",(a.width*2+30, a.height+40),"#141414"); d=ImageDraw.Draw(G); f=ImageFont.truetype(FONT,17)
    d.text((10,10),L0,fill="#8a8a8a",font=f); d.text((a.width+20,10),L1,fill="#38bdf8",font=f)
    G.paste(a,(10,34)); G.paste(b,(a.width+20,34))
    G.save(out, quality=82); print(out, G.size)
asyncio.run(main())
