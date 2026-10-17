/* Scrolling to a part of the page (every link to #…, from the navbar, the menu, the logo, anywhere): our own
   smooth scroll instead of the browser's.
     · it lands softly: it gathers speed gently and then glides to a stop over the last part of the way (EASE), instead
       of the browser's scroll, which on a long way runs at full speed almost to the end and stops short;
     · the time grows with the distance (0.55s for a short hop, at most 1.5s across the whole page), so a long way is
       not a blur and a short one does not drag;
     · a new click while it is under way sends it to the new place from where it is, at the speed it has (glide.js):
       no stop, no jerk;
     · it lands where the block is seen whole: its top right under the navbar, not under the top of the screen
       (where the navbar would cover it). A block that is pinned while the page scrolls (the logos) lands where its
       pinning starts, if it fits there whole. Where the navbar hides on the way down (phones turned sideways,
       nav.js), a block further down the page lands at the top of the screen;
     · the place is worked out again on every frame, so it lands right even if the page changes on the way (a picture
       loads, a pinned block is measured again);
     · the visitor takes over at once: a turn of the wheel, a touch, a key that scrolls, a drag of the scrollbar stops it;
     · "reduce motion": it jumps.
   The page's CSS (base.css) also has scroll-padding-top as tall as the navbar, for whatever the browser scrolls to by
   itself (the focus, a #link in the address). */
import { bezier, glider } from "./glide.js";
import { reveal } from "./motion.js";
import { ScrollTrigger } from "./gsap.js";

const EASE = bezier(0.5, 0, 0.12, 1);          // gentle start, long soft landing
const TIME = { min: 0.55, max: 1.5, perScreen: 0.16 };   // seconds: the least, the most, and per screen of distance
const calm = matchMedia("(prefers-reduced-motion: reduce)");
const root = document.documentElement;

const nav = () => document.querySelector("[data-nav]");
// how far down the navbar covers the page now (0 where it hides on the way down and the way goes down)
function navCover(down) {
  const n = nav();
  if (!n) return 0;
  if (down && root.classList.contains("nav-hides")) return 0;
  const s = getComputedStyle(n);
  return Math.max(0, (parseFloat(s.top) || 0) + n.offsetHeight);
}

// the scroll position at which a block is seen as described above
export function placeOf(el) {
  if (!el || el === document.body || el === root) return 0;
  const spacer = el.parentElement && el.parentElement.classList.contains("pin-spacer") ? el.parentElement : null;
  const top = (spacer || el).getBoundingClientRect().top + scrollY;
  let y = top - navCover(top > scrollY);
  // pinned: where its pinning starts, when the block is seen whole there
  const st = spacer && ScrollTrigger.getAll().find((t) => t.pin === el);
  if (st && st.start < y) y = st.start;
  const max = root.scrollHeight - innerHeight;
  return Math.round(Math.min(max, Math.max(0, y)));
}

let run = null;                                // the scroll under way: { glide, el, raf }
const now = () => performance.now() / 1000;
function stop() {
  if (!run) return;
  cancelAnimationFrame(run.raf);
  const done = run.done;
  run = null;
  root.classList.remove("fm-scrolling");
  done.forEach((fn) => fn());
}
// the visitor scrolls: ours stops
// (a press on another section link does not stop it: its click sends it on from where it is, at its speed)
["wheel", "touchstart", "pointerdown"].forEach((type) => addEventListener(type, (e) => {
  if (run && !(type !== "wheel" && e.target.closest && e.target.closest("a[href^='#']"))) stop();
}, { passive: true, capture: true }));
addEventListener("keydown", (e) => {
  if (run && /^(Arrow(Up|Down)|Page(Up|Down)|Home|End| )$/.test(e.key)) stop();
}, { capture: true });

export function scrollToEl(el, onDone) {
  const instant = calm.matches;
  const t = now();
  if (instant) { stop(); scrollTo({ top: placeOf(el), behavior: "instant" }); if (onDone) onDone(); return; }
  if (!run) {
    run = { glide: glider(EASE, scrollY), el, raf: 0, done: [], last: scrollY };
    root.classList.add("fm-scrolling");
  }
  run.el = el;
  if (onDone) run.done.push(onDone);
  const goal = placeOf(el), here = run.glide.at(t).p[0];
  const dist = Math.abs(goal - here);
  const T = Math.min(TIME.max, Math.max(TIME.min, TIME.min + TIME.perScreen * dist / innerHeight));
  run.glide.to(goal, T, t);
  cancelAnimationFrame(run.raf);
  const frame = () => {
    if (!run) return;
    // the page moved under the scroll (a pinned block measured again): the end follows it, the timing stays
    const goalNow = placeOf(run.el);
    if (Math.abs(goalNow - run.glide.target[0]) > 1) run.glide.retarget(goalNow);
    // the visitor dragged the scrollbar: the page is not where we left it
    if (Math.abs(scrollY - run.last) > 2) { stop(); return; }
    const s = run.glide.at(now());
    scrollTo({ top: s.p[0], behavior: "instant" });
    run.last = scrollY;
    if (s.done) { stop(); return; }
    run.raf = requestAnimationFrame(frame);
  };
  run.raf = requestAnimationFrame(frame);
}
export const scrolling = () => !!run;

// ── every link to a part of this page ("#top": to the top) ──
export function initScroll() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='#']");
    if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = a.getAttribute("href").slice(1);
    const target = id === "top" || !id ? document.body : document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (target !== document.body) reveal(target);       // everything in it is there when the scroll arrives
    scrollToEl(target);
    history.pushState(null, "", target === document.body ? location.pathname + location.search : "#" + id);
    if (target === document.body) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");   // keyboard and screen readers go on from there
    target.focus({ preventScroll: true });
  });
}
