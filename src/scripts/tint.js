/* A frosted element that takes the colour of the sections behind it: the navbar (nav.js) and the cookie notice
   (cookies.js). Each keeps its own transparency (the alpha of its background colour in the styles: the navbar 70%, the
   notice 80%) and takes the colour of the section that is behind it: behind the hero #EEEAE9, behind a white part of the
   page white, behind a grey section #F7F7F7, and so on.
   While the edge between two sections passes behind the element, the colour changes with it: the change starts when the
   edge reaches the element's bottom edge and is complete when it has gone above its top edge. In between, the colour is
   mixed by how much of the element's height each section covers, so it follows the scroll exactly, both ways.
     · a section without a colour of its own shows the page (white);
     · where sections overlap, the lower one on the page is drawn over the upper one, as the browser draws them;
     · the colours are read once, again when the screen changes size and when the page has loaded
       (refresh() of what followTint returns reads them again; fmNavTint.refresh() in the console for the navbar).
   onColour(rgb), if given, hears every new colour as [r, g, b] (solid): for something else that should take it too.
   Returns { refresh, stop }: stop() lets the element go (its listeners are removed, its colour stays as it was). */
import { ScrollTrigger } from "./gsap.js";

const SECTIONS = "main > section, body > footer";

// "rgb(1, 2, 3)", "rgba(1, 2, 3, 0.5)", "rgb(1 2 3 / 50%)" → [r, g, b, a]; anything else → null
const parse = (s) => {
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)/.exec(s || "");
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[5] ? m[4] / 100 : +m[4];
  return [+m[1], +m[2], +m[3], a];
};
const seen = (c) => (c && c[3] > 0.001 ? c : null);
const over = (c, under) => (c[3] >= 0.999 ? c : [0, 1, 2].map((i) => c[i] * c[3] + under[i] * (1 - c[3])).concat(1));

export function followTint(el, fallbackAlpha = 0.7, onColour = null) {
  const alpha = (parse(getComputedStyle(el).backgroundColor) || [0, 0, 0, fallbackAlpha])[3];

  let page = [255, 255, 255, 1], sections = [], queued = 0, tint = "";
  const read = () => {
    page = over(seen(parse(getComputedStyle(document.body).backgroundColor)) || [255, 255, 255, 1], [255, 255, 255, 1]);
    sections = [...document.querySelectorAll(SECTIONS)]
      .map((s) => ({ el: s, c: seen(parse(getComputedStyle(s).backgroundColor)) }))
      .filter((s) => s.c);
  };
  const paint = () => {
    queued = 0;
    const r = el.getBoundingClientRect();
    if (r.height <= 0) return;
    const top = r.top, bottom = r.bottom;
    const boxes = sections.map((s) => { const b = s.el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, c: s.c }; });
    // the element's height is cut at every edge of a section that lies behind it; each piece is one colour
    const cuts = [top, bottom];
    boxes.forEach((b) => { if (b.top > top && b.top < bottom) cuts.push(b.top); if (b.bottom > top && b.bottom < bottom) cuts.push(b.bottom); });
    cuts.sort((a, b) => a - b);
    const sum = [0, 0, 0];
    for (let i = 1; i < cuts.length; i++) {
      const h = cuts[i] - cuts[i - 1];
      if (h <= 0) continue;
      const y = (cuts[i] + cuts[i - 1]) / 2;
      let c = page;
      boxes.forEach((b) => { if (b.top <= y && b.bottom > y) c = over(b.c, c); });
      for (let j = 0; j < 3; j++) sum[j] += c[j] * h;
    }
    const rgb = sum.map((s) => Math.round(s / (bottom - top)));
    const v = "rgba(" + rgb.join(", ") + ", " + alpha + ")";
    if (tint !== v) { tint = v; el.style.backgroundColor = v; if (onColour) onColour(rgb); }
  };
  const later = () => { if (!queued) queued = requestAnimationFrame(paint); };
  const refresh = () => { read(); later(); };
  refresh();
  addEventListener("scroll", later, { passive: true });
  addEventListener("resize", refresh);
  addEventListener("load", refresh);
  const ro = new ResizeObserver(later);               // the page grew or shrank (pictures, the card stack, a pinned block)
  ro.observe(document.body);
  ScrollTrigger.addEventListener("refresh", later);   // pinned blocks were measured and placed again
  const stop = () => {
    cancelAnimationFrame(queued); queued = 0;
    removeEventListener("scroll", later);
    removeEventListener("resize", refresh);
    removeEventListener("load", refresh);
    ro.disconnect();
    ScrollTrigger.removeEventListener("refresh", later);
  };
  return { refresh, stop };
}
