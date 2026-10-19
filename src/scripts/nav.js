/* The navbar: its colour follows the section behind it (tint), and in the browsers built into apps a strip of white
   covers the page above it (cap). The outline of the current link is in nav-pill.js. */
import { ScrollTrigger } from "./gsap.js";

/* ── tint ──
   The navbar takes the colour of the section that is behind it, at its own transparency (70%): behind the hero it is
   #EEEAE9 at 70%, behind a white part of the page white at 70%, behind a grey section #F7F7F7 at 70%, and so on.
   While the edge between two sections passes behind the navbar, the colour changes with it: the change starts when the
   edge reaches the navbar's bottom edge and is complete when it has gone above its top edge. In between, the colour is
   mixed by how much of the navbar's height each section covers, so it follows the scroll exactly, both ways.
     · a section without a colour of its own shows the page (white);
     · where sections overlap, the lower one on the page is drawn over the upper one, as the browser draws them;
     · the browser's own bar above the page gets the same colour, solid: the tone strip (.bar-tone, base.css) for
       Safari 26 and later, <meta name="theme-color"> for Chrome on Android and Safari before 26;
     · the colours are read once, again when the screen changes size and when the page has loaded
       (fmNavTint.refresh() in the console reads them again). */
const SECTIONS = "main > section, body > footer";

export function initTint(nav) {
  // "rgb(1, 2, 3)", "rgba(1, 2, 3, 0.5)", "rgb(1 2 3 / 50%)" → [r, g, b, a]; anything else → null
  const parse = (s) => {
    const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)/.exec(s || "");
    if (!m) return null;
    const a = m[4] === undefined ? 1 : m[5] ? m[4] / 100 : +m[4];
    return [+m[1], +m[2], +m[3], a];
  };
  const seen = (c) => (c && c[3] > 0.001 ? c : null);
  const over = (c, under) => (c[3] >= 0.999 ? c : [0, 1, 2].map((i) => c[i] * c[3] + under[i] * (1 - c[3])).concat(1));
  const alpha = (parse(getComputedStyle(nav, "::before").backgroundColor) || [0, 0, 0, 0.7])[3];
  const tone = document.querySelector(".bar-tone");
  const meta = document.querySelector('meta[name="theme-color"]');

  let page = [255, 255, 255, 1], sections = [], queued = 0, tint = "";
  const read = () => {
    page = over(seen(parse(getComputedStyle(document.body).backgroundColor)) || [255, 255, 255, 1], [255, 255, 255, 1]);
    sections = [...document.querySelectorAll(SECTIONS)]
      .map((el) => ({ el, c: seen(parse(getComputedStyle(el).backgroundColor)) }))
      .filter((s) => s.c);
  };
  const paint = () => {
    queued = 0;
    const r = nav.getBoundingClientRect();
    if (r.height <= 0) return;
    const top = r.top, bottom = r.bottom;
    const boxes = sections.map((s) => { const b = s.el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, c: s.c }; });
    // the navbar's height is cut at every edge of a section that lies behind it; each piece is one colour
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
    if (tint === v) return;
    tint = v;
    nav.style.setProperty("--nav-tint", v);
    const solid = "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
    if (tone) tone.style.backgroundColor = solid;
    if (meta) meta.setAttribute("content", solid);
  };
  const later = () => { if (!queued) queued = requestAnimationFrame(paint); };
  const refresh = () => { read(); later(); };
  refresh();
  addEventListener("scroll", later, { passive: true });
  addEventListener("resize", refresh);
  addEventListener("load", refresh);
  new ResizeObserver(later).observe(document.body);   // the page grew or shrank (pictures, the card stack, a pinned block)
  ScrollTrigger.addEventListener("refresh", later);   // pinned blocks were measured and placed again
  window.fmNavTint = { refresh };
}

/* ── cap: the strip above the navbar in the browsers built into apps ──
   Telegram's browser on iPhone (and a few other apps' browsers) lays the page out below its own floating buttons
   (✕, the address, ⋯), but lets the page scroll on behind them. The navbar is fixed to the top of that layout, so it
   sits below the buttons, and in the strip behind them the page is seen scrolling by. Telegram draws only the ordinary
   content of the page in that strip: nothing fixed, nothing sticky.
   So the cap is ordinary content: an empty white block above the top of the page (CAP_PX tall, reaching OVERLAP px
   under the navbar) that the browser moves down exactly as far as the page has scrolled (a scroll-driven animation over
   the whole scroll, moving it by --cap-max, which is kept equal to how far the page can scroll). It therefore always
   lies right above the navbar, and in such a browser fills the strip behind the buttons with white. In every other
   browser it is above the top edge of the screen and never seen. What the animation cannot do, the script does:
     · it puts the cap exactly where it belongs (past the ends of the page iOS pulls the page further and springs back;
       at the bottom of the page in Telegram its bars come back and the page can scroll further), by moving it by what
       is missing (its "translate", which adds to the animation's transform);
     · iOS does not tell the page when it is pulled past its end, so in the browsers built into apps (they have
       window.webkit.messageHandlers, Safari has not) the bounce is turned off while the last screen of the page is
       shown (overscroll-behavior), and on again above it;
     · the browser moves the cap a frame or two after the page, so while scrolling down quickly it lags a few px above
       the navbar: while scrolling down it reaches DOWN_EXTRA px further under the navbar, back to OVERLAP once the
       scrolling stops.
   Only on phones and tablets, in browsers that can do scroll-driven animations.
   Test mode: ?fmcap=debug at the end of the address (the cap turns red; see debug.js). */
export function initCap(nav) {
  const CAP_PX = 240;                       // how far up it reaches: more than any app's buttons take
  const OVERLAP = 1;                        // how far down it reaches under the navbar
  const DOWN_EXTRA = 40;                    // while scrolling down: px it reaches further under the navbar
  const IDLE_MS = 160;                      // the scrolling counts as stopped after this long without a scroll event
  const DEBUG = /[?&]fmcap=debug\b/.test(location.search);
  const touch = matchMedia("(hover: none) and (pointer: coarse)").matches;
  if (DEBUG) import("./debug.js").then((m) => m.capDebug(touch));
  if (!touch && !DEBUG) return;
  if (!CSS.supports("animation-timeline: scroll()")) return;

  const cap = document.createElement("div");
  cap.className = "nav-cap";
  cap.setAttribute("aria-hidden", "true");
  cap.style.cssText = "position:absolute;left:0;width:100%;pointer-events:none;margin:0;"
    + "top:" + (-CAP_PX) + "px;height:" + (CAP_PX + OVERLAP) + "px;z-index:200;"
    + "animation:nav-cap 1ms linear both;animation-timeline:scroll(root block);"
    + "background:" + (DEBUG ? "#ff0033" : "#fff") + (DEBUG ? ";z-index:2147483000" : "");
  document.body.prepend(cap);

  const root = document.documentElement;
  let queued = 0, max = 0, navTop = 0, lastY = scrollY, down = false, idle = 0, shift = 0, still = false;
  const inApp = !!(window.webkit && window.webkit.messageHandlers);
  const place = () => {
    queued = 0;
    const fixed = getComputedStyle(nav).position === "fixed";
    cap.style.display = fixed ? "" : "none";
    if (!fixed) return;
    navTop = Math.round(nav.getBoundingClientRect().top);
    cap.style.top = (navTop - CAP_PX) + "px";
    max = Math.max(0, root.scrollHeight - root.clientHeight);
    cap.style.setProperty("--cap-max", max + "px");
    fix();
    bounce();
  };
  const bounce = () => {
    if (!inApp) return;
    const off = scrollY > max - innerHeight;
    if (off !== still) { still = off; root.style.overscrollBehaviorY = off ? "none" : ""; }
  };
  const fix = () => {
    if (cap.style.display === "none") return;
    const off = cap.getBoundingClientRect().top - (navTop - CAP_PX);   // how far the cap is from its place (+ = too low)
    if (Math.abs(off) < 0.5) return;
    shift -= off;
    cap.style.translate = Math.abs(shift) < 0.5 ? "" : "0 " + shift.toFixed(1) + "px";
  };
  const reach = (extra) => { cap.style.height = (CAP_PX + OVERLAP + extra) + "px"; };
  addEventListener("scroll", () => {
    fix();
    bounce();
    const nowDown = scrollY > lastY;
    lastY = scrollY;
    if (nowDown !== down) { down = nowDown; reach(down ? DOWN_EXTRA : 0); }
    clearTimeout(idle);
    idle = setTimeout(() => { fix(); if (down) { down = false; reach(0); } }, IDLE_MS);
  }, { passive: true });
  const later = () => { if (!queued) queued = requestAnimationFrame(place); };
  place();
  addEventListener("resize", place);
  addEventListener("load", later);
  if (window.visualViewport) visualViewport.addEventListener("resize", place);
  new ResizeObserver(later).observe(document.body);
}

/* ── hide: on phones turned sideways the navbar slides away while the page is scrolled down ──
   A screen 320–430px tall cannot spare a strip of 56px for the navbar the whole time. So there (--sideways in
   media.css: narrower than 1024px, shorter than 500px, wider than tall) the navbar slides up out of sight once the page
   has been scrolled down by more than its own height, and slides back as soon as it is scrolled up by MOVE px or more.
   It stays while the menu is open, near the top of the page, and while the keyboard is in it.
   The class nav-hides on <html> says the mode is on (scroll.js then lands a block at the top of the screen on the way
   down, and the card stack sticks to the top: stack.css); nav-away says it is out of sight. */
export function initHide(nav) {
  const MOVE = 12;                                          // px of scrolling up that bring it back
  // whether the mode is on is read from the styles (nav.css sets --nav-hides under --sideways), so the screen sizes are
  // written in one place only, media.css
  const hides = () => getComputedStyle(nav).getPropertyValue("--nav-hides").trim() === "1";
  let on = hides();
  const root = document.documentElement;
  const menu = document.querySelector("[data-menu]");
  let last = scrollY, turn = scrollY, away = false;
  const set = (v) => { if (v !== away) { away = v; root.classList.toggle("nav-away", v); } };
  const onScroll = () => {
    const y = scrollY, h = nav.offsetHeight;
    if (!on || y <= h || (menu && menu.classList.contains("is-open")) || nav.contains(document.activeElement)) {
      set(false); last = turn = y; return;
    }
    if ((y > last) !== (last > turn)) turn = last;         // the way turned: count from here
    if (y > last && y - turn > 2) set(true);
    else if (y < last && turn - y >= MOVE) set(false);
    last = y;
  };
  const check = () => { on = hides(); root.classList.toggle("nav-hides", on); onScroll(); };
  addEventListener("resize", check);                        // a phone turned, a window made shorter
  addEventListener("scroll", onScroll, { passive: true });
  nav.addEventListener("focusin", () => set(false));
  check();
}
