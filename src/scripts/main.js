/* The scripts of the page, started in order. Each part is described in its own file. */
import { ScrollTrigger, refreshSoon } from "./gsap.js";
import { initMotion } from "./motion.js";
import { initScroll } from "./scroll.js";
import { initAnchor } from "./anchor.js";
import { initMenu } from "./menu.js";
import { initTint, initCap, initHide } from "./nav.js";
import { initPill } from "./nav-pill.js";
import { initCards } from "./cards.js";
import { initLinkCards } from "./link-cards.js";
import { initHero } from "./hero.js";
import { initRing } from "./ring.js";
import { initLogos } from "./logos.js";
import { initDeck } from "./deck.js";
import { box, height as pageHeight, watchSize, ioRoot } from "./scroller.js";
import { hasConsent } from "./consent.js";
import { initBook } from "./book.js";
import { initPubs } from "./pubs.js";

// Safari may run this script before the page's stylesheet has come (WebKit bug 261655: a module script does not always
// wait for it, more often with a warm cache). Everything measured then is wrong, and what is measured once stays wrong:
// the card stack read the page's colour as transparent and lost its strips (Tim's screenshots, Oct 2026). So nothing
// starts until every stylesheet of the page is in (one that fails to load does not hold the page up).
await Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].filter((link) => !link.sheet).map((link) =>
  new Promise((done) => { link.addEventListener("load", done, { once: true }); link.addEventListener("error", done, { once: true }); })));

const root = document.documentElement;
root.classList.add("motion");                   // the main script runs: the safety net of motion.css is off

// Safari on a Mac, where the page scrolls in its own box (scroller.js): the keys that scroll (space, the arrows, Page
// Down…) scroll what holds the focus, and at first nothing does. The box takes the focus (not drawn, base.css), so they
// scroll the page from the start; the first Tab still goes to the skip link, the box's first child.
if (box) {
  box.tabIndex = -1;
  box.focus({ preventScroll: true });
}

// boot.js asks for the page to be measured again (after a reload restores the scroll, or a phone's bars change)
window.fmRefresh = (soft) => ScrollTrigger.refresh(soft);

// What the first screen needs runs at once; the rest right after the first frame has been drawn, so that frame is not
// held up (the ring and the pinned logos are far below). When all of it is in place, "fm:ready" tells boot.js that the
// page has its final height (a reload then scrolls back to where the visitor was).
const nav = document.querySelector("[data-nav]");
initDeck();                                      // before the motion: it decides how the ID cards fall (onto a deck or into a row)
initPubs();                                      // before the motion too: the publications past the first four wait for «Показать больше»
initMotion();
if (nav) { initTint(nav); initHide(nav); }
initCards();
initHero();
requestAnimationFrame(() => setTimeout(() => {
  initMenu();
  initPill();
  if (nav) initCap(nav);
  initLinkCards();
  initRing();
  initLogos();
  refreshSoon();
  initAnchor();
  requestAnimationFrame(() => requestAnimationFrame(() => document.dispatchEvent(new Event("fm:ready"))));
}, 0));

// ── loaded when needed: the dots (WebGL) and the drawings, each when its blocks come within reach ──
const near = (els, margin, load) => {
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    setTimeout(load, 0);                         // in a task of its own, not together with the other work of this moment
  }, { root: ioRoot, rootMargin: margin });
  els.forEach((el) => io.observe(el));
};
["cards", "cta"].forEach((set) => near([...document.querySelectorAll(`[data-dots='${set}']`)], "100% 0px",
  () => import("./stipple.js").then((m) => m.initDots(set))));
// any drawing, not only the first one: after a reload further down the page, the drawings above it (the royalty
// ones, say) are many screens away from the first drawing of the card stack, and would never have been put in place
near([...document.querySelectorAll(".art[data-art]")], "300% 0px",
  () => import("./art/mount.js").then((m) => m.initArt()));

// ── links to a section of the page: our own smooth scroll (scroll.js) ──
initScroll();

// ── the scroll animations measure the page again when its height has changed by itself, after it has loaded
//    (a late font, a picture, an app's browser resizing the page); ScrollTrigger measures only on load and resize ──
addEventListener("load", () => setTimeout(() => {
  const height = pageHeight;
  let measured = height(), busy = false, timer = 0;
  ScrollTrigger.addEventListener("refreshInit", () => { busy = true; });
  ScrollTrigger.addEventListener("refresh", () => { busy = false; measured = height(); });
  watchSize(new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (!busy && Math.abs(height() - measured) > 2) ScrollTrigger.refresh(true); }, 300);
  }));
}, 0));

// ── the cookie notice: only for a visitor who has not pressed «ОК» yet (consent.js), loaded once the page has loaded
//    and its first screen is in place (fm:ready); it then waits a moment more by itself before it fades in (cookies.js) ──
if (!hasConsent()) {
  let ready = false, loaded = document.readyState === "complete";
  const go = () => { if (ready && loaded) import("./cookies.js").then((m) => m.showCookies(), () => {}); };   // not loaded: no notice this time
  document.addEventListener("fm:ready", () => { ready = true; go(); }, { once: true });
  if (!loaded) addEventListener("load", () => { loaded = true; go(); }, { once: true });
}
// fmCookies.replay() in the console shows the notice again, also to someone who has agreed (cookies.js is then loaded)
window.fmCookies ??= { replay: () => import("./cookies.js").then((m) => m.showCookies({ delay: 0, force: true })) };

// ── the booking of a demo: our own window with the calendar of Planerka, loaded before it is asked for once the
//    visitor has agreed to the cookies (book.js) ──
initBook();

// ── the lines of split texts may wrap again once the page is at rest (motion.css, .fm-line) ──
// While fonts arrive and while the window is being resized, a line made by SplitText keeps to one line (it may stick
// out by a few px for a moment, until it is split again, rather than make the text jump by a line). At rest, the lines
// have been split in the font and the width that show, so they fit: there a line wraps only if someone needs more
// room between the letters and words (WCAG 1.4.12, text spacing: a reading tool or the visitor's own style sheet),
// instead of being cut off by its card.
{
  let timer = 0, width = innerWidth;
  const rest = (on) => root.classList.toggle("lines-rest", on);
  const later = () => { clearTimeout(timer); timer = setTimeout(() => rest(true), 700); };
  document.addEventListener("fm:ready", () => document.fonts.ready.then(later), { once: true });
  // only a change of width splits lines again: a phone's bars coming and going (the height only) leave them be
  addEventListener("resize", () => {
    if (innerWidth === width) return;
    width = innerWidth;
    if (root.classList.contains("lines-rest") || timer) { rest(false); later(); }
  });
}

// iOS shows :active (the press of a button, see button.css) only on pages that listen to touches
document.addEventListener("touchstart", () => {}, { passive: true });
