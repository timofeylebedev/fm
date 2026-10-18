/* The outline of the current link in the navbar slides to the link of the section on screen. A longer way takes
   longer: the next link about 0.35s, the whole row 0.65s, everything in between in proportion to its distance.
   On the way the outline takes the width of each link.
     · a link takes part when it leads to a block on this page (#…);
     · a link that is hidden at some width is skipped there; while the section of a hidden link is on screen, the
       outline fades out;
     · a section without a link of its own (the card stack, for one) keeps the outline on the link above it.
   A section counts as reached when its top has come up to LINE: 40% of the way from the navbar's bottom edge down to
   the bottom of the screen. At the very bottom of the page the last section with a link is reached whatever its size.
   After a click on a link, the outline goes straight there and waits until the page has stopped scrolling, instead of
   stopping at every section on the way. A click on another link while it slides sends it on from where it is, at the
   speed it has (glide.js), instead of stopping it and starting again. With "reduce motion" it jumps instead of sliding.
   The current link has aria-current (screen readers say which section is on screen; the outline is its only mark). */
import { M, css } from "./motion.js";
import { bezier, glider } from "./glide.js";

const MIN = 250, MAX = 650;          // ms: the shortest move, and a move across the whole row
const LINE = 0.4;                    // where a section counts as reached (see above)

export function initPill() {
  const row = document.querySelector("[data-pill-row]");
  if (!row) return;
  const bar = row.closest("header") || row;
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  const items = [...row.querySelectorAll("a[href^='#']")].map((a) => ({ a, sec: document.getElementById(a.getAttribute("href").slice(1)) })).filter((it) => it.sec);
  if (!items.length) return;
  const pill = document.createElement("i");
  pill.className = "nav__pill";
  pill.setAttribute("aria-hidden", "true");
  row.appendChild(pill);
  document.documentElement.classList.add("pill-on");

  let cur = null, box = null, span = 1, lock = null, lockTimer = 0, lockStart = 0, queued = 0, raf = 0;
  const motion = glider(bezier(...M.curve.move), [0, 0, 0, 0]);       // x, y, width, height
  const clock = () => performance.now() / 1000;
  const shown = (el) => el.offsetWidth > 0 || el.offsetHeight > 0;

  // where a link is in its row (in the row's own px, right even while the navbar is scaled)
  const measure = (a) => {
    const r = a.getBoundingClientRect(), c = row.getBoundingClientRect(), k = row.offsetWidth ? c.width / row.offsetWidth || 1 : 1;
    return { x: (r.left - c.left) / k - row.clientLeft, y: (r.top - c.top) / k - row.clientTop, w: a.offsetWidth, h: a.offsetHeight };
  };
  // the longest way in the row: a move this long takes MAX
  const spanOf = () => {
    const pts = items.filter((it) => shown(it.a)).map((it) => { const b = measure(it.a); return [b.x + b.w / 2, b.y + b.h / 2]; });
    let s = 1;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) s = Math.max(s, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
    return s;
  };
  const draw = ([x, y, w, h]) => {
    pill.style.width = w.toFixed(2) + "px";
    pill.style.height = h.toFixed(2) + "px";
    pill.style.transform = "translate(" + x.toFixed(2) + "px, " + y.toFixed(2) + "px)";
  };
  const place = (b) => { cancelAnimationFrame(raf); raf = 0; motion.jump([b.x, b.y, b.w, b.h]); draw([b.x, b.y, b.w, b.h]); };
  const slide = (b, seconds) => {
    motion.to([b.x, b.y, b.w, b.h], seconds, clock());
    if (raf) return;
    const tick = () => { const s = motion.at(clock()); draw(s.p); raf = s.done ? 0 : requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
  };
  const mark = (a) => items.forEach((it) => { if (it.a === a) it.a.setAttribute("aria-current", "location"); else it.a.removeAttribute("aria-current"); });

  // a: the link to go to (null: none, the outline fades out); now: at once, without sliding
  function go(a, now) {
    if (a === cur && !now) return;
    mark(a);
    if (!a) { cancelAnimationFrame(raf); raf = 0; pill.style.transition = "opacity 0.25s " + css.out; pill.style.opacity = "0"; cur = box = null; return; }
    const b = measure(a);
    if (now || !box || calm.matches) {
      // it was not shown: it appears in place (fading in), it does not slide in from somewhere
      const appear = !box && !now && !calm.matches && pill.style.opacity !== "1";
      pill.style.transition = "none";
      place(b);
      if (appear) { pill.style.opacity = "0"; void pill.offsetWidth; pill.style.transition = "opacity 0.25s " + css.out; }
      pill.style.opacity = "1";
    } else {
      // the time by the way it has to go from where it is now (it may be on its way somewhere else)
      const [x, y, w, h] = motion.at(clock()).p;
      const far = Math.hypot(b.x + b.w / 2 - (x + w / 2), b.y + b.h / 2 - (y + h / 2));
      const ms = Math.round(MIN + (MAX - MIN) * Math.min(1, far / span));
      pill.style.transition = "opacity 0.25s " + css.out;
      slide(b, ms / 1000);
      pill.style.opacity = "1";
    }
    cur = a; box = b;
  }

  // the link whose section has been reached: of the sections whose top has come up to the line, the lowest one
  function pick() {
    const top = Math.max(0, bar.getBoundingClientRect().bottom), vh = innerHeight;
    const line = top + (vh - top) * LINE;
    const end = Math.ceil(scrollY + vh) >= document.documentElement.scrollHeight - 2;
    let best = null, bestTop = -Infinity;
    items.forEach((it) => {
      if (!shown(it.a)) return;
      const r = it.sec.getBoundingClientRect();
      if (!r.width && !r.height) return;
      if ((r.top <= line || (end && r.top < vh)) && r.top > bestTop + 0.5) { best = it.a; bestTop = r.top; }
    });
    return best;
  }
  const update = () => { queued = 0; if (!lock && shown(row)) go(pick()); };
  const later = () => { if (!queued) queued = requestAnimationFrame(update); };

  // after a click: straight to that link, then wait until the scrolling has stopped for 0.2s (at most 4s)
  const release = () => { lock = null; clearTimeout(lockTimer); later(); };
  items.forEach((it) => it.a.addEventListener("click", (e) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    lock = it.a; lockStart = Date.now();
    go(it.a);
    clearTimeout(lockTimer);
    lockTimer = setTimeout(release, 500);                 // the page did not scroll at all (already there)
  }));
  addEventListener("scroll", () => {
    if (lock) {
      clearTimeout(lockTimer);
      if (Date.now() - lockStart > 4000) release(); else lockTimer = setTimeout(release, 200);
    }
    later();
  }, { passive: true });

  // the layout changed (fonts, screen width): the outline goes back under its link at once
  const settle = () => {
    span = spanOf();
    if (cur && !shown(cur)) go(null);
    else if (cur) go(cur, true);
    later();
  };
  span = spanOf();
  if (shown(row)) go(pick(), true);
  new ResizeObserver(settle).observe(row);
  addEventListener("load", settle);
  document.fonts.ready.then(settle);
}
