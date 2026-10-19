/* Putting the drawings on the page (the blocks .art with data-art="s1-1" … "royalty-2"), sizing them, and moving them.
   The drawings themselves are in s1.js, s2.js, s3.js (the card stack) and royalty.js; each file is downloaded only when
   one of its drawings is about to be needed.

   When they are built: building all ten at once kept weak phones busy for more than a second. So the drawings of one
   card are built together (they take turns there) when the card comes within one and a half screens of the visible
   part of the page, and the cards that are still far away are built one by one after the page has loaded, whenever the
   browser has nothing else to do. Until then a block is simply empty: it is far from the screen anyway.

   Animation: a drawing moves only while it is the one shown in its card and its block is on screen: then its stage has
   the class is-live (the CSS animations run only under that class) and its tick(time, dt, px) is called on every frame.
   Each drawing has its own clock that stops while it is not live, so it carries on where it left off. A drawing whose
   animation has an end (the royalty ones) returns false from tick when it is over, and is not called again. */
import { pace } from "../pace.js";
import { ioRoot } from "../scroller.js";
import { SIZE, LIMIT, unit, toUnits, STILL } from "./shared.js";
import { ROYALTY } from "./royalty-settings.js";
import "../../styles/art/art.css";        // the styles of the drawings come with them

const FILES = { s1: () => import("./s1.js"), s2: () => import("./s2.js"), s3: () => import("./s3.js"), royalty: () => import("./royalty.js") };
const fileOf = (key) => key.replace(/-\d+$/, "");            // "s1-2" → "s1", "royalty-1" → "royalty"
const DETAIL = 3;                                           // see fit()
const mounted = [];
const resize = new ResizeObserver((entries) => entries.forEach((e) => fit(e.target)));
addEventListener("resize", () => mounted.forEach(fit));     // also catches a change of the screen's pixel density (browser zoom, another monitor)
const observe = (margin, change) => new IntersectionObserver((entries) => entries.forEach((e) => change(e.target, e.isIntersecting)), { root: ioRoot, rootMargin: margin });
// A drawing moves only while its block is on screen (or about to be)…
const watch = observe("100px 0px", (host, seen) => { host.fmArt.seen = seen; setLive(host); });
// …and it is kept ready only while its block is within one screen of the visible part of the page. Further away it is
// hidden (is-away), so the browser can let go of the memory it holds for it, and its big canvases give their memory back
// (up to about 5 MB each on a phone). They are made again, with the current moment drawn on them, when the block comes near.
const keep = observe("100% 0px", (host, near) => {
  const fm = host.fmArt;
  fm.away = !near;
  fm.stage.classList.toggle("is-away", !near);
  if (near) fit(host); else release(fm);
});
function release(fm) {
  if (!fm.pixels) return;
  fm.stage.querySelectorAll("canvas.fm-rings, canvas.fm-flow, canvas.fm-split").forEach((canvas) => { canvas.width = canvas.height = 0; });
  fm.pixels = 0;
}
// the lighter mode for weak devices (see pace.js) gives the canvases fewer pixels: size them again
pace.onChange(() => mounted.forEach(fit));

// Sizes a drawing for its block: on screen it is as big as the block's shorter side. Where the screen is dense enough
// (phones, tablets, retina) the stage is laid out at exactly that size, so nothing in it takes more memory than it shows.
// On a coarser screen it is laid out up to DETAIL times bigger and scaled down, which keeps thin lines and small text even
// there. The canvases get one pixel per screen pixel (at most 3 per CSS px; 2 in the lighter mode for weak devices),
// and none at all while the block is far from the screen (see release above).
function fit(host) {
  const fm = host.fmArt, shown = Math.min(host.clientWidth, host.clientHeight);   // side of the drawing on screen
  if (!(shown > 0)) return;
  const density = devicePixelRatio || 1;
  const side = Math.min(LIMIT, shown * Math.max(1, DETAIL / density));            // side of the stage in the layout
  const pixels = Math.min(LIMIT, Math.round(shown * Math.min(density, pace.slow ? 2 : 3)));   // side of the drawing in screen pixels: the size of its canvases
  if (side !== fm.side || shown !== fm.shown) {
    fm.side = side; fm.shown = shown;
    fm.px = side / fm.size;                                 // how long one Figma px is in this drawing
    fm.stage.style.setProperty("--fm-px", fm.px.toFixed(5) + "px");
    fm.stage.style.setProperty("--fm-scale", (shown / side).toFixed(5));
  }
  if (pixels !== fm.pixels && fm.art.resize && !fm.away) {
    fm.pixels = pixels;
    fm.art.resize(pixels);                                  // this empties the canvas: draw the current moment again
    if (fm.art.tick) try { fm.art.tick(fm.clock, 0, fm.px); } catch (err) { console.warn("art: " + fm.key + " was not redrawn", err); }
  }
}

function mount(host, key, drawings) {
  const art = drawings[key]();
  const size = art.size || SIZE;                            // side of the drawing's Figma frame
  const stage = document.createElement("div");
  stage.className = "fm-stage fm-" + key + " is-away";      // is-away until the browser reports that the block is near the screen
  if (size !== SIZE) stage.style.setProperty("--fm-size", size);
  stage.setAttribute("aria-hidden", "true");                // decorative: screen readers skip it
  stage.innerHTML = toUnits(art.html);
  stage.querySelectorAll("svg[width]").forEach((svg) => {   // icons: their width="…" and height="…" are Figma px too
    svg.style.width = unit(svg.getAttribute("width"));
    svg.style.height = unit(svg.getAttribute("height"));
  });
  host.classList.add("fm-turns");                           // the drawing starts hidden and waits for its turn (see takeTurns)
  host.appendChild(stage);
  host.fmArt = { key, stage, art, size, clock: 0, live: false, on: false, seen: false, held: false, over: false, away: true, side: 0, shown: 0, pixels: 0, px: 1 };
  if (art.init) art.init(stage);
}
function finish(host) {
  if (host.fmArt.art.once && !STILL) holdBack(host);       // a drawing that plays once waits for its card (see below)
  mounted.push(host);
  // measured by the ResizeObserver, right after the browser's next layout (measuring here would make the browser lay
  // out the whole page at once, for every drawing)
  resize.observe(host);
  keep.observe(host);
  watch.observe(host);
}

// ── animation ──
const moving = [];
let raf = 0, before = 0;
function frame(now) {
  raf = moving.length ? requestAnimationFrame(frame) : 0;
  pace.frame(now);
  if (!pace.due(before, now)) return;                       // the lighter mode for weak devices: every second frame only
  const dt = before ? Math.min((now - before) / 1000, 0.1) : 0.016;
  before = now;
  moving.slice().forEach((fm) => {
    fm.clock += dt;
    try {
      if (fm.art.tick(fm.clock, dt, fm.px) === false) { fm.over = true; moving.splice(moving.indexOf(fm), 1); }   // it has played to its end
    } catch (err) {
      moving.splice(moving.indexOf(fm), 1);
      console.warn("art: the animation of " + fm.key + " was stopped", err);
    }
  });
}
function setLive(host) {
  const fm = host.fmArt, live = !STILL && fm.on && fm.seen && !fm.held;
  if (live === fm.live) return;
  fm.live = live;
  fm.stage.classList.toggle("is-live", live);
  if (!fm.art.tick || fm.over) return;
  if (live) moving.push(fm); else moving.splice(moving.indexOf(fm), 1);
  if (live && !raf) { before = 0; raf = requestAnimationFrame(frame); }
}

// ── drawings that play once ──
// The two royalty drawings build themselves up one time. Until then nothing of them is shown. Such a drawing is held
// back until its card has come in (motion.js gives it the class fm-shown) and enough of the drawing's block is on
// screen ("seen" in the settings); a moment later ("wait") it starts. From then on it is like any other drawing.
function holdBack(host) {
  const fm = host.fmArt, card = host.closest("[data-reveal]");
  const cardIsThere = () => card.classList.contains("fm-shown") || parseFloat(getComputedStyle(card).opacity) >= 0.99;
  let there = !card || cardIsThere(), inView = false, timer = 0;
  fm.held = true;
  const look = new IntersectionObserver((entries) => {
    const e = entries[entries.length - 1], screen = e.rootBounds ? e.rootBounds.height : innerHeight;
    inView = e.isIntersecting && (e.intersectionRatio >= ROYALTY.seen || e.intersectionRect.height >= screen * 0.5);   // or half the screen, for a block taller than the screen
    start();
  }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].concat(ROYALTY.seen) });
  const start = () => {
    if (!there || !inView || timer) return;
    timer = setTimeout(() => { fm.held = false; look.disconnect(); setLive(host); }, ROYALTY.wait * 1000);
  };
  if (!there) {
    const wait = new MutationObserver(() => { if (cardIsThere()) { there = true; wait.disconnect(); start(); } });
    wait.observe(card, { attributes: true, attributeFilter: ["class", "style"] });
  }
  look.observe(host);
}

// For the royalty lab page, and for quick experiments in the console: fmRoyalty.settings is the list of settings.
// Change a value there and call fmRoyalty.replay(): the two drawings build themselves up again, with the new value.
window.fmRoyalty = {
  settings: ROYALTY,
  async checkEase(text) { const { easeText, easing, plainEase } = await import("./royalty.js"); const t = easeText(text); return { text: t, ok: !!t && easing(t) !== plainEase }; },
  replay() {
    mounted.forEach((host) => {
      const fm = host.fmArt;
      if (!fm.art.once) return;
      if (fm.art.setup) fm.art.setup();                    // the eases and timings are read from the settings again
      fm.clock = 0; fm.over = false;
      try { fm.art.tick(0, 0, fm.px); } catch (err) { console.warn("art: " + fm.key + " could not be started again", err); }
      if (fm.live && moving.indexOf(fm) < 0) {
        moving.push(fm);
        if (!raf) { before = 0; raf = requestAnimationFrame(frame); }
      }
    });
  }
};

// ── taking turns ──
// The drawings of one card take turns: at a trigger point the one on screen fades out, and only then the next one fades
// in, so two drawings are never visible together (the fades run on a timer, see --fm-out and --fm-in in art.css).
// In the card stack, whose turn it is, is the block cards.js has given the class fm-turn (no class: none is shown).
// Anywhere else a drawing is simply shown.
function takeTurns(hosts) {
  const turnHasCome = (host) => !host.closest(".stack-on") || host.classList.contains("fm-turn");
  let current = null;                                      // index of the drawing on screen, -1 for none
  const sync = () => {
    let next = -1;
    hosts.forEach((host, i) => { if (turnHasCome(host)) next = i; });
    if (next === current) return;
    current = next;
    // is another drawing still (partly) visible? then the new one waits until it has faded out
    const busy = hosts.some((host, i) => i !== next && parseFloat(getComputedStyle(host.fmArt.stage).opacity) > 0.01);
    hosts.forEach((host, i) => {
      const stage = host.fmArt.stage;
      stage.style.setProperty("--fm-wait", i === next && busy ? "var(--fm-out)" : "0s");
      stage.classList.toggle("is-on", i === next);
      host.fmArt.on = i === next;
      setLive(host);                                       // only the drawing on screen keeps moving
    });
  };
  hosts.forEach((host) => new MutationObserver(sync).observe(host, { attributes: true, attributeFilter: ["class"] }));
  sync();
}

// the drawings of one card: their file is downloaded (once), then they are all built, measured and started together
async function mountCard(card) {
  if (card.done) return;
  card.done = true;
  const files = {};
  await Promise.all([...new Set(card.hosts.map(([, key]) => fileOf(key)))].map(async (f) => { files[f] = (await FILES[f]()).default; }));
  const built = [];
  card.hosts.forEach(([host, key]) => {
    try { mount(host, key, files[fileOf(key)]); built.push(host); } catch (err) {
      host.classList.add("is-failed");                     // art.css shows a picture instead, where there is one
      console.warn("art: " + key + " was not drawn", err);
    }
  });
  built.forEach(finish);
  if (built.length) takeTurns(built);
}

export function initArt() {
  const cards = new Map();                                 // drawings that share a card (the same parent block), in page order
  document.querySelectorAll(".art[data-art]").forEach((host) => {
    const card = cards.get(host.parentElement) || { hosts: [], done: false };
    card.hosts.push([host, host.dataset.art]);
    cards.set(host.parentElement, card);
  });
  const list = [...cards.values()];
  const near = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const card = list.find((one) => one.hosts.some(([host]) => host === e.target));
    if (!card) return;
    card.hosts.forEach(([host]) => near.unobserve(host));
    setTimeout(() => mountCard(card), 0);                  // in a task of its own, not together with the other work of this moment
  }), { root: ioRoot, rootMargin: "150% 0px" });
  list.forEach((card) => card.hosts.forEach(([host]) => near.observe(host)));

  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  const next = async () => {
    const card = list.find((one) => !one.done);
    if (!card) return;
    card.hosts.forEach(([host]) => near.unobserve(host));
    await mountCard(card);
    idle(next, { timeout: 3000 });
  };
  const later = () => idle(next, { timeout: 3000 });
  if (document.readyState === "complete") later(); else addEventListener("load", later);
}
