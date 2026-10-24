# The parts of each area at real screen sizes (phones upright and sideways, tablets, short and tall laptops, big screens):
# hero, tools, tiles, ID cards, footer. python3 areas.py url out.json   (and privacy_policy_ru.html for the legal page)
import asyncio, sys, json
from lib import *
SIZES = [(320,568),(360,740),(375,667),(390,844),(430,932),(568,320),(667,375),(844,390),(932,430),(600,960),(768,1024),(820,1180),
         (1024,768),(1024,1366),(1280,620),(1280,720),(1280,800),(1366,650),(1366,768),(1440,900),(1536,864),(1920,1080),(1920,960),(2560,1440)]
JS = r"""(()=>{
const q=s=>document.querySelector(s), r=e=>e?e.getBoundingClientRect():null, n=v=>Math.round(v*10)/10, cs=e=>getComputedStyle(e);
const o={};
const h=q('.hero'), tx=q('.hero__text'), nav=q('.nav'), st=q('.hero__stage'), tb=q('.hero__table'), t=q('.hero__title');
if(h){ const pic=r(tb), s=r(st); o.hero={H:innerHeight, hero:n(r(h).height), airTop:n(r(tx).top-r(nav).bottom), text:n(r(tx).height), gap:n(s.bottom-pic.height-r(tx).bottom), pic:n(pic.height), title:n(parseFloat(cs(t).fontSize)), fold:n(r(h).bottom+scrollY-innerHeight)}; }
const tool=q('.tool');
if(tool){ const b=q('.tool__body'), m=q('.tool__media'), im=q('.tool__img'), T=r(tool), B=r(b), Mm=r(m), I=r(im);
  o.tool={w:n(T.width), h:n(T.height), pad:n(parseFloat(cs(b).paddingLeft)), layout: Mm.left>=B.right-4?'side by side':'stacked', textTop:n(r(q('.tool__copy')).top-T.top), picTop:n(I.top-T.top), picW:n(I.width), picH:n(I.height), radius:n(parseFloat(cs(tool).borderTopLeftRadius))}; }
const f=q('.feature'), lg=q('.logo-card'), sn=q('.stat');
if(f){ o.tiles={feature:[n(r(f).width),n(r(f).height)], featurePad:n(parseFloat(cs(f).paddingLeft)), radius:n(parseFloat(cs(f).borderTopLeftRadius)), logo:n(r(lg).height), stat:n(r(sn).height), statNum:n(parseFloat(cs(q('.stat__number')).fontSize)), statLabel:n(parseFloat(cs(q('.stat__label')).fontSize)), logoName:n(parseFloat(cs(q('.logo-card__name')).fontSize)),
  featureChars: (()=>{const d=q('.feature__desc'); const range=document.createRange(); range.selectNodeContents(d); const rs=[...range.getClientRects()]; const lines=new Set(rs.map(x=>Math.round(x.top))).size; return Math.round(d.textContent.length/Math.max(1,lines))})()}; }
const id=q('.idcard'), slots=[...document.querySelectorAll('.access__slot')];
if(id){ const xs=slots.map(e=>r(e).left); o.id={mode: Math.max(...xs)-Math.min(...xs) > r(id).width*0.6 ? 'row':'stack', w:n(r(id).width), scale:n(r(id).width/240*100)/100, corner:n(24*r(id).width/240)}; }
const fl=q('.footer__legal-row');
if(fl){ const s=cs(fl), notes=[...fl.querySelectorAll('.footer__note')]; o.footer={layout: s.display.includes('flex') ? (s.flexDirection.startsWith('column')?'column':'row') : (s.gridTemplateColumns.split(' ').filter(Boolean).length+' cols'), rows:new Set(notes.map(e=>Math.round(r(e).top))).size, link:(q('.footer__note:last-child')||{}).textContent}; }
const dt=q('.doc__title, .doc h1, main h1');
if(dt && !h){ const m=q('.doc__text, .doc p, main p'); o.doc={title:n(parseFloat(cs(dt).fontSize)), family:cs(dt).fontFamily.split(',')[0], weight:cs(dt).fontWeight, measure:m?n(r(m).width):null, navBg:cs(q('.doc-nav')||q('nav')||document.body).backgroundColor}; }
o.overflow = document.documentElement.scrollWidth - innerWidth;
return o;})()"""
async def one(p, url, w, h):
    mob = w < 1024 or (w < 1100 and h > w)
    b, pg = await page(p, w, h, mob, url, calm=True)
    await warm(pg)
    if ".html" not in url:
        await pg.evaluate("document.querySelector('.tools').scrollIntoView()"); await pg.wait_for_timeout(300)
        await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(400)
    d = await pg.evaluate(JS); await b.close(); d['W'] = w; d['Hs'] = h; return d
async def main():
    url, out = sys.argv[1], sys.argv[2]
    res = []
    async with async_playwright() as p:
        for i in range(0, len(SIZES), 2):
            res += await asyncio.gather(*[one(p, url, *s) for s in SIZES[i:i+2]])
    json.dump(res, open(out, "w"), ensure_ascii=False)
    print(out, len(res))
asyncio.run(main())
