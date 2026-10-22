/* The navbar: its colour follows the section behind it (tint), and in the browsers built into apps a strip of white
   covers the page above it (cap). The outline of the current link is in nav-pill.js. */
import { followTint } from "./tint.js";
import { box, y as pageY, max as pageMax, onScroll as onPageScroll } from "./scroller.js";
import { glider, bezier } from "./glide.js";

/* ── tint ──
   The navbar takes the colour of the section that is behind it, at its own transparency (70%): behind the hero it is
   #EEEAE9 at 70%, behind a white part of the page white at 70%, and so on, mixed while an edge between two sections
   passes behind it. How: tint.js (the cookie notice follows the sections the same way, at 80%). */
export function initTint(nav) {
  window.fmNavTint = followTint(nav, 0.7);
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
     · iOS does not tell the page when it is pulled past its end, so in the browsers built into apps the bounce is
       turned off while the last screen of the page is shown (overscroll-behavior), and on again above it. Such a
       browser is known by window.webkit.messageHandlers (an app that talks to its page), or, on an iPhone or iPad, by
       a user agent without "Safari/" (a bare WKWebView). Telegram's browser seems not to be known by the first: its
       bounce stayed on, the page went up past its end and the cap with it, and the page showed above the navbar
       (Tim's screenshot, Oct 22; ?fmcap=debug shows both signs and the user agent). Safari itself, Chrome and the others on iOS say "Safari/" and keep their bounce;
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
  if (box) return;                          // the page scrolls in its own box (Safari on a Mac): no app's browser
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
  const ua = navigator.userAgent;
  const ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const inApp = !!(window.webkit && window.webkit.messageHandlers) || (ios && !/Safari\//.test(ua));
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
       further out of sight; scrolled up by 20px, 20px further back. Nothing jumps;
     · once the scrolling stops (STILL_MS without a scroll event), it settles, with a glide that keeps its speed: out of
       sight if it was last moving away and is a third of the way out already, back in place otherwise (so a small
       slip of the finger brings it back);
     · it stays while any of the hero is under it: it starts to move away only when the hero's bottom edge reaches it,
       and then goes up with that edge. It stays too while the menu is open and while the keyboard is in it;
     · the browser's own bars: when they come and go (iOS shows them on the way up), the page's height and scroll
       position change by themselves for a moment. Those changes are not the visitor's scrolling, so for BARS_MS after
       the visible screen changes size the navbar does not follow the scroll (it still comes back over the hero), and
       when that time is over the way the page went meanwhile decides: back if up, away if down (MOVE px or more);
       it does not follow either while the page is pulled past its top or bottom end (iOS lets it spring back). Both
       made the navbar on iPhones come down, jump up and come down again on the way up;
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
  const MOVE = 24;                                          // px the page must have gone while the bars moved, to count as a way
  const hides = () => getComputedStyle(nav).getPropertyValue("--nav-hides").trim() === "1";
  const root = document.documentElement;
  const menu = document.querySelector("[data-menu]");
  const hero = document.querySelector(".hero");
  const quiet = matchMedia("(prefers-reduced-motion: reduce)");
  const glide = glider(bezier(0.22, 1, 0.36, 1), 0);        // the site's --ease-out
  let on = false, H = 0, off = 0, last = pageY(), turn = pageY(), down = false, still = 0, bars = 0, settling = 0, cap = null;
  let barsFrom = 0, barsEnd = 0;

  // how far the page must be scrolled before the navbar may move: the hero's bottom edge at its bottom edge
  const free = () => (hero ? hero.getBoundingClientRect().bottom + pageY() - H : H);
  const held = () => (menu && menu.classList.contains("is-open")) || nav.contains(document.activeElement);
  const paint = () => {
    const away = H > 0 && off >= H - 0.5;
    root.classList.toggle("nav-away", away);
    cap = cap || document.querySelector(".nav-cap");
    if (quiet.matches) { nav.style.translate = ""; if (cap) cap.style.clipPath = ""; return; }   // nav.css fades both
    nav.style.translate = off > 0.25 ? "0 " + (-off).toFixed(2) + "px" : "";
    // the white strip: cut off from below by as much as the navbar has moved, and 48px more once it is away (nav.css)
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
  // where it goes when the scrolling stops part way: away only if it was last moving away, is a third of the way out
  // already (a small slip of the finger brings it back) and the hero is far enough up; back otherwise
  const settle = () => {
    still = 0;
    if (!on || off <= 0.25 || off >= H - 0.25) return;
    const room = pageY() - free();                          // how far it may be away here
    settleTo(down && off > H / 3 && room >= H ? H : 0);
  };
  // the browser's bars have stopped moving: what the visitor did meanwhile (the page's net way) decides
  const afterBars = () => {
    barsEnd = 0;
    if (!on || held()) return;
    const net = pageY() - barsFrom;
    if (Math.abs(net) < MOVE) return settle();
    down = net > 0;
    settleTo(down && pageY() - free() >= H ? H : 0);
  };
  const onScroll = () => {
    const y = pageY(), d = y - last;
    last = y;
    if (!on) return;
    if (y < 0 || y > pageMax() + 1) return;                     // the page pulled past its ends (iOS springs it back)
    if (performance.now() < bars) {                         // the browser's bars are moving: not followed (see afterBars),
      const most = Math.max(0, y - free());                 // but never away while the hero is under it
      if (off > most) { stopSettling(); off = most; paint(); }
      return;
    }
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
    last = pageY();
  };
  // the visible screen changed size (the browser's bars come or go): for BARS_MS the scroll is not followed; when that
  // time is over, the net way the page went meanwhile decides (afterBars)
  const barsMoved = () => {
    if (!barsEnd) barsFrom = pageY();
    bars = performance.now() + BARS_MS; last = pageY();
    clearTimeout(still); still = 0;                         // a settle timed before would use the direction from before
    clearTimeout(barsEnd); barsEnd = setTimeout(afterBars, BARS_MS + 20);
  };
  addEventListener("resize", () => { barsMoved(); check(); });   // a phone turned, a window made shorter, the browser's bars
  if (window.visualViewport) visualViewport.addEventListener("resize", barsMoved);
  onPageScroll(onScroll);
  nav.addEventListener("focusin", () => { if (off) settleTo(0); });
  if (menu) new MutationObserver(() => { if (held() && off) settleTo(0); }).observe(menu, { attributes: true, attributeFilter: ["class"] });
  quiet.addEventListener("change", () => { off = 0; paint(); });
  check();
}
