/* What scrolls: the window, or (in Safari on a Mac) the page's own box.
   Safari 26 and later on a Mac draw their bar over the top of the page as glass: the page scrolls on under it and shows
   through, blurred. Safari makes the bar solid only for a page whose window does not scroll (as in Google Docs, where a
   box inside the page scrolls) or whose header at the top is dark. Measured in Safari on macOS 27 (Oct 2026): a light
   header, solid or not, never made the bar solid in dark mode; the box did, in light and dark mode.
   So there the page scrolls in its own box, .page (boot.js gives <html> the class "boxed", base.css makes .page fill
   the screen and scroll). Everywhere else nothing changes: .page is an ordinary block and the window scrolls.
   Every script asks this file instead of the window: where the page is scrolled (y), scroll it (to), how far it can go
   (max), listen to its scrolling (onScroll), watch its size (watchSize). GSAP's ScrollTrigger is told in gsap.js.
   Test in any browser: ?fmbox=1 at the end of the address turns the box on, ?fmbox=0 off. */
const root = document.documentElement;

export const box = root.classList.contains("boxed") ? document.querySelector("[data-page]") : null;
export const target = box || window;                        // what fires "scroll" and what ScrollTrigger watches
export const el = box || root;                              // its scrollHeight / clientHeight

export const y = () => (box ? box.scrollTop : window.scrollY);
export const to = (top) => (box || window).scrollTo({ top, behavior: "instant" });
export const by = (d) => { if (d) to(y() + d); };
export const height = () => el.scrollHeight;                // the height of the whole page
export const max = () => Math.max(0, el.scrollHeight - innerHeight);
export const onScroll = (fn) => target.addEventListener("scroll", fn, { passive: true });
export const offScroll = (fn) => target.removeEventListener("scroll", fn);
// the root for an IntersectionObserver that looks ahead (a rootMargin beyond the screen): the box clips what is in it,
// so seen from the screen nothing below it would ever be "near"; seen from the box it is
export const ioRoot = box || null;

// the page grew or shrank: in the box, the box itself keeps the size of the screen, so its blocks are watched
export function watchSize(observer) {
  if (box) [...box.children].forEach((child) => observer.observe(child));
  else observer.observe(document.body);
}

// the colour of the page under its sections (white): the box's own background when there is one
export const paper = () => getComputedStyle(box || document.body).backgroundColor;
