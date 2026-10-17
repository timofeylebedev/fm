/* The page stays where the visitor is reading when the window changes size.
   Much of the page is sized by the screen's height (the hero, the card stack: many screens tall, the pinned logos,
   the CTA card). When the window gets taller or shorter, everything above the visitor grows or shrinks, and the same
   scroll position then shows another part of the page: one changed the window's height and found oneself somewhere
   else. (The browser's own scroll anchoring is off on purpose, see base.css: the scripts change the page's height
   while they lay it out.)
   So the part of the page at the reading line (a third of the way down under the navbar) is remembered while the
   visitor scrolls: which section, and how far into it the line is, as a share of its height. After the window has
   changed size, and again after the scroll animations have measured the page anew (ScrollTrigger's refresh), the page
   is scrolled so that the same share of the same section is at the line again. A share, not px, because in the card
   stack a share is a moment of the cards: the same card, the same step, whatever the screen's height.
   On phones and tablets, a change of height alone is the browser's bars coming and going: boot.js keeps the page
   steady for that, so only a change of width counts there. */
import { ScrollTrigger } from "./gsap.js";

const BLOCKS = "main > section, main > .pin-spacer, body > footer";
const LINE = 1 / 3;

export function initAnchor() {
  const touch = matchMedia("(hover: none) and (pointer: coarse)").matches;
  let mark = null, quiet = 0, resized = -1e9, width = innerWidth, height = innerHeight, frame = 0;
  const line = () => {
    const nav = document.querySelector("[data-nav]");
    const top = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
    return top + (innerHeight - top) * LINE;
  };
  const remember = () => {
    if (Date.now() < quiet) return;
    if (scrollY <= 1) { mark = { top: true }; return; }  // at the very top it stays at the top
    const y = line();
    for (const el of document.querySelectorAll(BLOCKS)) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.top <= y && r.bottom > y) { mark = { el, share: (y - r.top) / r.height }; return; }
    }
  };
  const restore = () => {
    if (mark && mark.top) { if (scrollY > 0) scrollTo({ top: 0, behavior: "instant" }); return; }
    if (!mark || !mark.el.isConnected) return;
    const r = mark.el.getBoundingClientRect(), by = r.top + mark.share * r.height - line();
    if (Math.abs(by) >= 1) scrollTo({ top: scrollY + by, behavior: "instant" });
  };
  // a change of size: the remembered place is kept (not overwritten by the scrolls the change itself causes) for a
  // moment after each change and each measuring; the visitor's own scrolling after that is remembered again
  const hold = (ms) => { quiet = Math.max(quiet, Date.now() + ms); };
  addEventListener("scroll", remember, { passive: true });
  addEventListener("resize", () => {
    const wide = innerWidth !== width, tall = innerHeight !== height;
    width = innerWidth; height = innerHeight;
    if (!wide && !(tall && !touch)) return;
    hold(150);
    resized = Date.now();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(restore);
  });
  // after a measuring, once ScrollTrigger has put its own scroll position back (it does so after its event)
  ScrollTrigger.addEventListener("refresh", () => {
    if (Date.now() - resized > 1500) return;              // a measuring that has nothing to do with a resize
    hold(150);
    restore();
    requestAnimationFrame(restore);
  });
  remember();
  window.fmAnchor = { get mark() { return mark; }, restore };
}
