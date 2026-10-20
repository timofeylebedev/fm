/* The ring of covers under «Больше релизов, меньше хаоса»: the covers stand on a ring in 3D that turns as the page
   scrolls by (and a little by itself), and tilts from seen-from-above to seen-from-below. It is sized to the width of
   its block. Decorative: screen readers skip it (aria-hidden in the HTML).

   This file decides where the ring stands and how it turns; scripts/ring-gl.js draws it on one canvas with WebGL (see
   the comment there). The block gets its height at once, from the maths below, so the page never moves; the drawing
   code (about 3 KB) and the covers (about 200 KB) are downloaded only when the block comes within one screen of the
   visible part of the page. While the block is on screen, a frame costs two numbers sent to the GPU and one draw;
   off screen nothing runs.

   Rebuilt Oct 20, 2026: the ring used to be 16 DOM faces in CSS 3D (preserve-3d), and the browser re-layered them on
   every frame. Measured on a MacBook (M5 Pro, the Chromium of the Claude app, 120 Hz) with the ring turning: the whole
   page kept the main thread busy ≈ 100 ms a second with the old ring, ≈ 13–15 ms with the canvas. Checked against
   the old ring at fixed poses: the covers stand within a pixel of where they stood. */
import { ScrollTrigger, refreshSoon } from "./gsap.js";
import { ioRoot } from "./scroller.js";
import { pace } from "./pace.js";
import { calm } from "./motion.js";

const covers = import.meta.glob("../assets/img/cover-*.webp", { eager: true, query: "?url", import: "default" });

// ── the covers, in the order they stand on the ring (3 or more; the files are src/assets/img/cover-*.webp) ──
const IMAGES = [7, 8, 1, 2, 3, 4, 5, 6].map((n) => covers["../assets/img/cover-" + n + ".webp"]);

// ── settings (same names as in the tuner) ──
/* CONFIG:START */
const CONFIG = {
  // Layout. The ring is always scaled to fit the block width, so imageWidth,
  // imageHeight and perspective set proportions, not final pixel sizes.
  maxWidth: 1024,        // px, the block never gets wider than this
  fill: 1,               // 1 = ring spans the full block width, 0.8 = 80% of it
  imageWidth: 300,
  imageHeight: 300,
  spacing: 2,            // gap between cards (0 = touching)
  perspective: 3000,     // lower = stronger 3D distortion
  cornerRadius: 24,
  backFade: 6,           // how much the backs of the covers fade to the colour below: 0 (not at all) to 10 (solid colour)
  backFadeColor: "var(--paper)",
  background: "transparent",

  // Scroll. Progress runs from the block entering the viewport to it leaving.
  scrollRotate: -180,    // degrees the ring turns over that distance (negative = left, positive = right)
  tiltStart: -15,        // tilt when the block enters (negative = seen from above)
  tiltEnd: 15,           // tilt when the block leaves
  smoothing: 0.15,       // seconds of easing behind the scroll (0 = locked to scroll)

  // Extras
  speed: 1,              // idle spin on top of scroll (0 = off, 7 = the original speed)
  direction: "left",     // idle spin direction: "right" or "left"
  drag: false,           // true = visitors can drag left/right to spin
  sensitivity: 5
};
/* CONFIG:END */

const PAD = 2;               // breathing room around the ring, in design px
const LEVEL = 4;             // degrees of tilt the block's height makes room for (the rest reaches into the gaps)
const STILL_AT = 0.25;       // the pose shown to visitors who turned on "reduce motion"
const SETTLED = 1e-3;        // degrees: a pose that moved less than this since the last frame is not drawn again
const clamp01 = (v) => Math.min(1, Math.max(0, v));

const radiusOf = (c, n) => {
  const w = c.imageWidth * (1 + Math.max(0, c.spacing) * 0.15);   // below 0 the cards would overlap (ring-gl.js)
  return n > 2 ? w / (2 * Math.tan(Math.PI / n)) : w * 0.6;
};

// How much room the ring needs on screen, across every rotation and the given tilt range.
// About 13 000 steps: worked out once for a set of settings, not again on every resize.
const boundsCache = {};
function boundsOf(c, n) {
  const key = [c.imageWidth, c.imageHeight, c.spacing, c.perspective, c.tiltStart, c.tiltEnd, n].join();
  return boundsCache[key] || (boundsCache[key] = measureBounds(c, n));
}
function measureBounds(c, n) {
  const w = c.imageWidth / 2, h = c.imageHeight / 2, r = radiusOf(c, n), p = c.perspective;
  let maxX = 0, minY = 0, maxY = 0;
  for (let ti = 0; ti <= 8; ti++) {
    const t = (c.tiltStart + (c.tiltEnd - c.tiltStart) * ti / 8) * Math.PI / 180;
    const ct = Math.cos(t), st = Math.sin(t);
    for (let a = 0; a < 360; a++) {
      const phi = a * Math.PI / 180, cp = Math.cos(phi), sp = Math.sin(phi);
      for (const sx of [-1, 1]) {
        const x = sx * w * cp + r * sp, z = -sx * w * sp + r * cp;   // z measured from the ring centre
        for (const sy of [-1, 1]) {
          const y = sy * h, y2 = y * ct - z * st, z2 = y * st + z * ct - r;
          const k = p / Math.max(p - z2, 1);
          maxX = Math.max(maxX, Math.abs(x * k));
          minY = Math.min(minY, y2 * k);
          maxY = Math.max(maxY, y2 * k);
        }
      }
    }
  }
  return { halfW: maxX, minY: minY - PAD, maxY: maxY + PAD };
}

// Other scroll animations on the page measured it before the carousel took up space: ask them to re-measure.
// Not while the page is still loading: ScrollTrigger re-measures everything by itself when loading is over,
// and one more full pass at that moment only made the start heavier.
const refreshScrollTriggers = () => { if (document.readyState === "complete") refreshSoon(); };

function init(root) {
  const c = Object.assign({}, CONFIG, { images: IMAGES.slice() });
  root.textContent = "";

  let geom = null;           // where the ring stands, CSS px (see layout)
  let view = null;           // the drawing (scripts/ring-gl.js), once loaded
  let scrollRot = 0;         // rotation that follows the scroll (eased)
  let tilt = 0;              // tilt that follows the scroll (eased)
  let offset = 0;            // rotation added by the idle spin and by dragging
  let vel = 0, last = 0, raf = 0, visible = false, lastP = 0;
  let drawn = [NaN, NaN];    // the pose last drawn
  let draws = 0;             // frames drawn (for tests: nothing should be drawn off screen or with "reduce motion")
  let lastHeight = -1, lastWinW = window.innerWidth;
  const drag = { active: false, x: 0 };

  function layout() {
    root.style.maxWidth = c.maxWidth + "px";
    root.style.background = c.background;
    root.style.cursor = c.drag ? "grab" : "";
    root.style.touchAction = c.drag ? "pan-y" : "";
    const W = root.clientWidth;
    if (!W) return;
    // The width: what the ring needs across the whole tilt. The height: what it needs while nearly level (within
    // LEVEL° of no tilt), the pose it has around the middle of the screen. Tilted further, on its way in and out, its
    // covers reach a little past the block (into the section's gaps: its overflow is visible up and down,
    // sections.css), on the side that is off screen at that moment, never into the heading or the features. So the
    // canvas is as tall as the whole tilt needs and reaches past the block by the same amount.
    const n = c.images.length, b = boundsOf(c, n);
    const level = boundsOf(Object.assign({}, c, { tiltStart: -Math.min(LEVEL, Math.abs(c.tiltStart)), tiltEnd: Math.min(LEVEL, Math.abs(c.tiltEnd)) }), n);
    const s = (W * c.fill) / (2 * b.halfW);            // design px → screen px
    const cy = -level.minY * s;                        // where the ring's centre sits inside the block
    const height = Math.ceil((level.maxY - level.minY) * s);
    const above = Math.ceil((level.minY - b.minY) * s), below = Math.ceil((b.maxY - level.maxY) * s);
    root.style.height = height + "px";
    geom = {
      width: W, height: above + height + below, above,
      ox: W / 2, oy: above + cy,                       // the ring's centre on the canvas (the old perspective-origin)
      halfW: c.imageWidth * s / 2, halfH: c.imageHeight * s / 2,
      radius: radiusOf(c, n) * s, perspective: c.perspective * s,
      corner: c.cornerRadius * s, fade: clamp01(c.backFade / 10),
      dprMax: pace.slow ? 2 : 3                        // device pixels per CSS px (the lighter mode for weak devices: 2)
    };
    if (view) { view.resize(geom); drawn = [NaN, NaN]; paint(); }

    // The block changed height: the pinned logos strip below (and the card reveals) must re-measure.
    // After a window resize ScrollTrigger does that by itself, so skip the extra pass.
    if (height !== lastHeight) {
      if (window.innerWidth === lastWinW) refreshScrollTriggers();
      lastHeight = height;
    }
    lastWinW = window.innerWidth;
  }

  // 0 = the block's top edge reaches the bottom of the screen, 1 = its bottom edge leaves at the top.
  // ScrollTrigger works this out when it measures the page and keeps it up to date while scrolling (reading the block's
  // place on every frame would make the browser lay out the page again on every frame). The getBoundingClientRect line
  // is used only before ScrollTrigger has measured, and if GSAP did not load.
  const st = calm ? null : ScrollTrigger.create({ trigger: root, start: "top bottom", end: "bottom top" });
  function progress(measure) {
    if (typeof c.progress === "number") return clamp01(c.progress);   // testing aid: pins the scroll position
    if (calm || (view && !view.webgl)) return STILL_AT;   // the still picture: the pose of "reduce motion"
    if (st && !measure && st.end > st.start) return st.progress;
    const rect = root.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return clamp01((vh - rect.top) / (vh + rect.height));
  }

  // draw the pose if it changed enough to see
  function paint() {
    if (!view) return;
    const rot = scrollRot + offset;
    if (Math.abs(rot - drawn[0]) < SETTLED && Math.abs(tilt - drawn[1]) < SETTLED) return;
    drawn = [rot, tilt];
    draws++;
    view.draw(rot, tilt);
  }

  function place() {                                   // straight to the pose of the current scroll, no easing
    lastP = progress(true);
    scrollRot = c.scrollRotate * lastP;
    tilt = c.tiltStart + (c.tiltEnd - c.tiltStart) * lastP;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    pace.frame(now);
    if (!pace.due(last, now)) return;                 // the lighter mode for weak devices: every second frame only
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;

    const p = lastP = progress();
    const targetRot = c.scrollRotate * p;
    const targetTilt = c.tiltStart + (c.tiltEnd - c.tiltStart) * p;
    if (!c.smoothing) {
      scrollRot = targetRot;
      tilt = targetTilt;
    } else {
      const ease = 1 - Math.exp(-dt / c.smoothing);
      scrollRot += (targetRot - scrollRot) * ease;
      tilt += (targetTilt - tilt) * ease;
    }

    if (!drag.active) {
      if (Math.abs(vel) > 0.01) {                       // coasting after a drag
        offset += vel * dt;
        vel *= Math.pow(0.94, dt * 60);
      } else if (c.speed) {                             // idle spin
        offset += c.speed * 6 * (c.direction === "left" ? -1 : 1) * dt;
      }
    }
    paint();
  }

  // With "reduce motion", and with the 2D still picture (no WebGL 2), there is no loop: the ring is drawn once, and
  // again only on a resize.
  const still = () => calm || (view && !view.webgl);
  const start = () => { if (!raf && visible && view && !still()) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  // Dragging (only when drag: true)
  root.addEventListener("pointerdown", (e) => {
    if (!c.drag || calm) return;
    try { root.setPointerCapture(e.pointerId); } catch {}
    drag.active = true; drag.x = e.clientX; vel = 0;
    root.style.cursor = "grabbing";
  });
  root.addEventListener("pointermove", (e) => {
    if (!drag.active) return;
    const dx = e.clientX - drag.x, k = 0.3 * c.sensitivity;
    drag.x = e.clientX;
    offset += dx * k;
    vel = dx * k * 60;
  });
  const endDrag = () => {
    if (!drag.active) return;
    drag.active = false;
    root.style.cursor = c.drag ? "grab" : "";
  };
  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);

  layout();
  new ResizeObserver(layout).observe(root);
  pace.onChange(layout);                               // the lighter mode draws fewer pixels
  // a new screen density (the window moved to another screen, page zoom) changes the canvas's pixels, not its size
  const watchDensity = () => matchMedia("(resolution: " + (window.devicePixelRatio || 1) + "dppx)").addEventListener("change", () => { layout(); watchDensity(); }, { once: true });
  watchDensity();

  // Only animate while the block is on screen (or about to be)
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    visible ? start() : stop();
  }, { root: ioRoot, rootMargin: "200px 0px" }).observe(root);

  // The drawing code and the covers: when the block comes within one screen of the visible part of the page
  // (a cover that arrives, or the GPU coming back, changes the picture by itself: draw it again)
  const dirty = () => { drawn = [NaN, NaN]; if (!raf) paint(); };
  let loading = false;
  const near = new IntersectionObserver((entries) => {
    if (!entries[entries.length - 1].isIntersecting || loading || view) return;
    loading = true;
    import("./ring-gl.js").then(({ createRingView }) => {
      near.disconnect();
      view = createRingView(root, c, dirty);
      if (!view) return;                               // no WebGL and no 2D canvas: the block stays empty
      if (geom) view.resize(geom);
      place();
      paint();
      start();
    }).catch(() => {                                   // the download failed (offline for a moment): try again later
      setTimeout(() => { loading = false; near.unobserve(root); near.observe(root); }, 5000);
    });
  }, { root: ioRoot, rootMargin: "100% 0px" });
  near.observe(root);

  // For the tuner and for quick experiments in the console
  root.roundCarousel = {
    config: c,
    state: () => ({ progress: lastP, rotation: scrollRot + offset, tilt, draws, running: !!raf, webgl: view ? view.webgl : null }),
    update(patch) {
      const remake = (patch.images && patch.images !== c.images) || "backFadeColor" in patch;
      Object.assign(c, patch);
      if (view && remake) view.refresh();              // the covers or the colours: the texture is made again
      layout();
      if (still() || typeof c.progress === "number") { place(); paint(); }
    }
  };
}

export function initRing() {
  const root = document.querySelector("[data-ring]");
  if (root) init(root);
}
