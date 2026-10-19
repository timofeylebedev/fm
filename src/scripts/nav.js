/* The navbar: its colour follows the section behind it (tint), and in the browsers built into apps a strip of white
   covers the page above it (cap). The outline of the current link is in nav-pill.js. */
import { ScrollTrigger } from "./gsap.js";
import { glider, bezier } from "./glide.js";

/* ── tint ──
   The navbar takes the colour of the section that is behind it, at its own transparency (70%): behind the hero it is
   #EEEAE9 at 70%, behind a white part of the page white at 70%, behind a grey section #F7F7F7 at 70%, and so on.
   While the edge between two sections passes behind the navbar, the colour changes with it: the change starts when the
   edge reaches the navbar's bottom edge and is complete when it has gone above its top edge. In between, the colour is
   mixed by how much of the navbar's height each section covers, so it follows the scroll exactly, both ways.
     · a section without a colour of its own shows the page (white);
     · where sections overlap, the lower one on the page is drawn over the upper one, as the browser draws them;
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
  const alpha = (parse(getComputedStyle(nav).backgroundColor) || [0, 0, 0, 0.7])[3];

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
    const v = "rgba(" + sum.map((s) => Math.round(s / (bottom - top))).join(", ") + ", " + alpha + ")";
    if (tint !== v) { tint = v; nav.style.backgroundColor = v; }
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

/* ── hide: on phones turned sideways the navbar moves away while the page is scrolled down ──
   A screen 320–430px tall cannot spare a strip of 56px for the navbar the whole time. So there (--sideways in
   media.css: narrower than 1024px, shorter than 500px, wider than tall) the navbar goes up out of sight while the page is
   scrolled down, and comes back while it is scrolled up. How:
     · it follows the scroll, px for px, like the bars of the phone's own browser: scrolled down by 20px, it is 20px
       further out of sight; scrolled up by 20px, 20px further back. Nothing jumps, and a small slip of the finger the
       other way moves it only by that much;
     · once the scrolling stops (STILL_MS without a scroll event), it settles, with a glide that keeps its speed: back
       in place if it was last moving back (or is mostly back), out of sight if it was last moving away;
     · it stays while any of the hero is under it: it starts to move away only when the hero's bottom edge reaches it,
       and then goes up with that edge. It stays too while the menu is open and while the keyboard is in it;
     · the browser's own bars: when they come and go (iOS shows them on the way up), the page's height and scroll
       position change by themselves for a moment. Those changes are not the visitor's scrolling, so for BARS_MS after
       the visible screen changes size the navbar does not follow the scroll; neither does it while the page is pulled
       past its top or bottom end (iOS lets it spring back). Both made the navbar on iPhones come down, jump up and
       come down again on the way up;
     · with "reduce motion" it does not move: it fades out once the page has gone AWAY px down, and back in after
       BACK px up.
   The class nav-hides on <html> says the mode is on (scroll.js then lands a block at the top of the screen on the way
   down, and the card stack sticks to the top: stack.css); nav-away says it is all the way out of sight.
   The white strip of the browsers built into apps (cap, above) is cut off with it. */
export function initHide(nav) {
  const STILL_MS = 140;                                     // the scrolling has stopped after this long without a scroll event
  const BARS_MS = 400;                                      // after the visible screen changed size: not the visitor's scrolling
  const SETTLE_S = 0.42;                                    // seconds for settling
  const AWAY = 24, BACK = 12;                               // reduce motion: px down that fade it out, px up that bring it back
  const hides = () => getComputedStyle(nav).getPropertyValue("--nav-hides").trim() === "1";
  const root = document.documentElement;
  const menu = document.querySelector("[data-menu]");
  const hero = document.querySelector(".hero");
  const quiet = matchMedia("(prefers-reduced-motion: reduce)");
  const glide = glider(bezier(0.22, 1, 0.36, 1), 0);        // the site's --ease-out
  let on = false, H = 0, off = 0, last = scrollY, turn = scrollY, down = false, still = 0, bars = 0, settling = 0, cap = null;

  // how far the page must be scrolled before the navbar may move: the hero's bottom edge at its bottom edge
  const free = () => (hero ? hero.offsetTop + hero.offsetHeight - H : H);
  const held = () => (menu && menu.classList.contains("is-open")) || nav.contains(document.activeElement);
  const paint = () => {
    const away = H > 0 && off >= H - 0.5;
    root.classList.toggle("nav-away", away);
    if (quiet.matches) { nav.style.translate = ""; return; }
    nav.style.translate = off > 0.25 ? "0 " + (-off).toFixed(2) + "px" : "";
    cap = cap || document.querySelector(".nav-cap");
    // the white strip: cut off from below by as much as the navbar has moved, and 48px more once it is away (stack.css)
    if (cap) cap.style.clipPath = off > 0.25 ? "inset(0 0 " + (off * (H + 48) / H).toFixed(2) + "px 0)" : "";
  };
  const stopSettling = () => { if (settling) { cancelAnimationFrame(settling); settling = 0; } };
  const settleTo = (to) => {
    stopSettling();
    if (quiet.matches) { off = to; paint(); return; }
    glide.jump(off);
    glide.to(to, SETTLE_S, performance.now() / 1000);
    const tick = () => {
      const g = glide.at(performance.now() / 1000);
      off = g.p[0]; paint();
      settling = g.done ? 0 : requestAnimationFrame(tick);
    };
    settling = requestAnimationFrame(tick);
  };
  const settle = () => {
    still = 0;
    if (!on || off <= 0.25 || off >= H - 0.25) return;
    const room = scrollY - free();                          // how far it may be away here
    settleTo(down && room >= H ? H : 0);
  };
  const onScroll = () => {
    const y = scrollY, d = y - last;
    last = y;
    if (!on) return;
    const max = root.scrollHeight - innerHeight;
    if (y < 0 || y > max + 1 || performance.now() < bars) return;   // the page pulled past its ends, or the browser's bars moving
    if (Math.abs(d) < 0.01) return;
    if (held()) { if (off) settleTo(0); return; }
    if (quiet.matches) {                                    // reduce motion: in or out at once (it fades: nav.css)
      if ((d > 0) !== (turn < y - d)) turn = y - d;         // the way turned: count from here
      if (y <= free()) off = 0;
      else if (d > 0 && y - turn >= AWAY) off = H;
      else if (d < 0 && turn - y >= BACK) off = 0;
      paint(); return;
    }
    stopSettling();
    down = d > 0;
    // follows the scroll, and never further away than the page is past the hero
    off = Math.max(0, Math.min(H, off + d, y - free()));
    paint();
    clearTimeout(still);
    still = setTimeout(settle, STILL_MS);
  };
  const check = () => {
    on = hides();
    H = nav.offsetHeight + 1;
    root.classList.toggle("nav-hides", on);
    if (!on || held()) { stopSettling(); off = 0; paint(); }
    last = scrollY;
  };
  const barsMoved = () => { bars = performance.now() + BARS_MS; last = scrollY; };
  addEventListener("resize", () => { barsMoved(); check(); });   // a phone turned, a window made shorter, the browser's bars
  if (window.visualViewport) visualViewport.addEventListener("resize", barsMoved);
  addEventListener("scroll", onScroll, { passive: true });
  nav.addEventListener("focusin", () => { if (off) settleTo(0); });
  if (menu) new MutationObserver(() => { if (held() && off) settleTo(0); }).observe(menu, { attributes: true, attributeFilter: ["class"] });
  quiet.addEventListener("change", () => { off = 0; paint(); });
  check();
}
