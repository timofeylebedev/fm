/* How things come in, and how the ID cards answer the mouse. One system for every animation of the page that is not
   a drawing: everything takes its curves and timings from M below, so a change there changes the whole page.

   THE WAY IN
   What comes in, and how (the attribute data-reveal in the HTML):
     · chars   a heading: letter by letter, each one up from below its place, a little past it and back (the wave);
     · lines   a text: line by line, up from one line below, calmly (no bounce: text is for reading);
     · block   a block (a card, a button, a picture): up from 40px below, a little past its place and back (settle),
               fading in during the first half of that;
     · tilt    an ID card of «Гибкая настройка прав доступа»: falls onto the page, as if dropped on a table (DROP below).
               It starts bigger, as if closer, and gets smaller faster and faster until it lands; its shadow is wide and
               faint while it is in the air and tightens as it lands. In the air it drifts up and turns at an even speed;
               when it lands it keeps going a little by its own momentum, sliding and turning a bit further while
               friction slows it to a stop, at its own angle (--rest in the HTML). No bounce.
               The cards overlap, and a card that fades in over another one shows that one through itself. So the cards
               come in from the side, as if dealt onto the table: each one fades in next to the card before it, not over
               it, and only slides over it once it is solid (see dealX).
   Things that belong together come in as one movement:
     · a group is everything in one section, or everything inside one block or tilt card (a card is a group of its own
       for what is in it). A block with data-reveal-group is a group too;
     · in a group, things come in one after another in the order they are read (top to bottom, then left to right).
       Each one starts a beat after the one before it has started (BEAT below): a heading lets the next thing start once
       about half of its letters are on their way, a text once its last line has started, a block after 0.14s;
     · nothing starts before its top has come up to 88% of the screen height (LINE);
     · what is inside a card starts once the card itself has started (0.2s later), with the same beats;
     · a thing that is above the screen when its turn comes (after a reload further down the page, or a jump with a
       menu link), or that cannot be seen at all, is simply shown, and does not hold up the others;
     · other parts of the page can join a group with motion.cue (the hero's people and chips do, and the first card of
       the stack joins the hero's group, so it comes after the hero). A cue can take its turn at the place of another
       element (at: the people start with the heading), in another section's group (group), and from another line
       (line: the first card as soon as any of it is on screen). A thing that comes in
       gets the class fm-showing when it starts and fm-shown when it has arrived.
   Hover colours and the press of buttons are done by the styles (button.css). "Reduce motion": everything is simply
   shown, nothing leans.
   For quick experiments in the console: fmMotion.M is the list below; fmMotion.state() lists what has come in. */

import { gsap, ScrollTrigger, SplitText, CustomEase } from "./gsap.js";

export const M = {
  // the curves of the site: [x1, y1, x2, y2] as in CSS cubic-bezier, or a path (CustomEase), or a GSAP ease
  curve: {
    out: [0.22, 1, 0.36, 1],          // arriving: quick, then a long soft landing. Text, fades, hovers
    move: [0.65, 0, 0.25, 1],         // travelling from one place to another: slow start, slow arrival (the navbar pill)
    leave: [0.55, 0, 0.75, 0.2],      // going away: gathers speed (the titles of the card stack)
    wave: [0.5, 0, 0.5, 1],           // each step of the letters' wave
    settle: "M0,0 C0,0.788 0.135,1.212 0.32,1.215 0.5,1.218 0.51,0.847 1,1",  // blocks: about a fifth past their place, then back
    fall: [0.55, 0.085, 0.68, 0.53],  // falling: faster and faster, until it lands (the tilt cards)
    glide: "power1.out"               // sliding to a stop after landing: friction
  },
  // a heading, letter by letter: [moment, % of its height below its place, opacity]: up from 25% below, past its
  // place by 10%, back by 4%, past by 1%, in place; fully visible at 40%
  chars: { time: 1.1, stagger: 0.03, wave: [[0, 25, 0], [0.4, -10, 1], [0.65, 4], [0.85, -1], [1, 0]] },
  lines: { time: 0.9, stagger: 0.1, rise: 100 },        // a text: seconds, between lines, % of a line it comes up from
  block: { time: 1.0, rise: 40, fade: 0.5 },            // a block: seconds, px it comes up from, the part of its time it fades in
  tilt: { lean: 8, follow: 0.6 },                       // tilt cards: how far they lean to the mouse (°), seconds to follow it
  // a tilt card falling:
  //   land   seconds in the air, until it lands
  //   scale  how big it starts (as if closer)
  //   move   [px, °] it drifts up and turns while in the air (at an even speed)
  //   glide  [px, °] it slides and turns further after landing, slowing down
  //   fade   the part of the time in the air it fades in
  //   gap    px between a card that is fading in and the card next to it
  //   air    its shadow in the air: [offset ×, blur ×, opacity ×]
  DROP: { land: 0.55, scale: 1.15, move: [24, 4.5], glide: [13, 2.5], fade: 0.36, gap: 6, air: [2.4, 2, 0.5] },
  BEAT: { chars: [0.25, 0.5, 0.6], lines: 0.3, block: 0.14, drop: 0.2, inside: 0.2 },
  LINE: 0.88,                                           // a thing may start once its top is above this part of the screen height
  FONT: 0.3                                             // a text whose turn has come waits at most this long (s) for its font
};

const bez = (c) => "cubic-bezier(" + c.join(", ") + ")";
export const css = { out: bez(M.curve.out), move: bez(M.curve.move), leave: bez(M.curve.leave) };
export const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const now = () => performance.now() / 1000;
const OWNER = '[data-reveal="block"], [data-reveal="tilt"], [data-reveal-group], section';

// the curves as GSAP eases: "fm-out", "fm-move", "fm-leave", "fm-wave", "fm-settle", "fm-fall", "fm-glide"
Object.keys(M.curve).forEach((k) => {
  const c = M.curve[k];
  if (typeof c === "string" && !/^M/.test(c)) gsap.registerEase("fm-" + k, gsap.parseEase(c));
  else CustomEase.create("fm-" + k, Array.isArray(c) ? c.join(",") : c);
});

// ── the things that come in, and their groups ──
const items = [];
const groups = new Map();                                   // the block of a group → the group
let booted = false, live = false;
const waiting = [];                                         // cues added before the start

function groupFor(el, owner) {
  const key = owner || (el.parentElement && el.parentElement.closest(OWNER)) || document.body;
  let g = groups.get(key);
  if (!g) groups.set(key, (g = { el: key, owner: null, open: true, free: 0, queue: [], busy: false }));
  return g;
}

function add(el, kind, extra) {
  if (el.fmItem) return el.fmItem;
  const it = Object.assign({ el, kind, state: "idle", ready: kind === "block" || kind === "tilt", waiters: [], targets: null, tween: null, inner: null }, extra);
  el.fmItem = it;
  items.push(it);
  return it;
}

// ── at the start ──
export function initMotion() {
  booted = true;
  document.querySelectorAll("[data-reveal]").forEach((el) => add(el, el.dataset.reveal));
  items.forEach((it) => {
    if (it.kind !== "tilt") return;
    it.rest = parseFloat(getComputedStyle(it.el).getPropertyValue("--rest")) || 0;   // its angle, from the HTML
    it.el.style.rotate = "none";                                                       // from now on GSAP turns it
    shadowOf(it);
  });
  if (calm) { items.forEach(show); waiting.splice(0).forEach((c) => c.whenReady(() => c.play(true))); return; }
  live = true;
  items.forEach((it) => { it.group = groupFor(it.el); });
  // groups that belong to a card: closed until the card starts
  items.forEach((it) => {
    const g = groups.get(it.el);
    if (g) { g.owner = it; g.open = false; it.inner = g; }
  });
  waiting.splice(0).forEach(enlist);
  items.forEach(watch);
  prepareNear();
  lean();
  // whatever the keyboard reaches is there at once: a card that gets the focus (and the block it is in) is shown
  // without waiting for its beat, so the focus ring never lands on something still invisible
  document.addEventListener("focusin", (e) => {
    for (let n = e.target; n && n !== document.body; n = n.parentElement) if (n.fmItem && n.fmItem.state !== "done") finish(n.fmItem);
  });
}

// A jump to a section (a link of the navbar or the menu): everything in it is shown at once, so it is all there when
// the scroll arrives, instead of coming in one by one after it (main.js calls this)
export function reveal(section) {
  if (!live || !section) return;
  items.filter((it) => it.state !== "done" && section.contains(it.el)).forEach(finish);
}

// where a tilt card starts, and where it lands (from there it slides on to y 0 and its own angle).
// It turns the way it will be leaning: towards its angle, and on past 0 to it if it has to.
const turnWay = (it) => (it.rest < 0 ? -1 : 1);
const dropLanding = (it) => ({ y: M.DROP.glide[0], rotation: it.rest - turnWay(it) * M.DROP.glide[1] });
const dropStart = (it) => ({ y: M.DROP.move[0] + M.DROP.glide[0], rotation: it.rest - turnWay(it) * (M.DROP.move[1] + M.DROP.glide[1]) });

const rgba = (s) => {
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)/.exec(s || "");
  if (!m) return null;
  let a = m[4] == null ? 1 : parseFloat(m[4]);
  if (m[5]) a /= 100;
  return [+m[1], +m[2], +m[3], +a.toFixed(3)];
};
// the shadow of a tilt card (the card itself or the first block inside it that has one), at rest and in the air
function shadowOf(it) {
  let el = it.el;
  for (let n = 0; el && n < 4 && getComputedStyle(el).boxShadow === "none"; n++) el = el.firstElementChild;
  const rest = el && getComputedStyle(el).boxShadow;
  if (!rest || rest === "none") return;
  const [k, b, o] = M.DROP.air;
  const air = rest.split(/,(?![^(]*\))/).map((layer) => {
    if (/inset/.test(layer)) return layer.trim();
    const c = rgba((layer.match(/rgba?\([^)]*\)/) || [""])[0]);
    const v = (layer.replace(/rgba?\([^)]*\)/, "").match(/-?[\d.]+/g) || []).map(Number);
    if (!c || v.length < 2) return layer.trim();
    const [x, y, blur = 0, spread = 0] = v;
    return "rgba(" + c[0] + ", " + c[1] + ", " + c[2] + ", " + +(c[3] * o).toFixed(3) + ") " + (x * k) + "px " + (y * k) + "px " + (blur * b) + "px " + spread + "px";
  }).join(", ");
  it.shadow = { el, rest, air };
}

// The shadow while a card falls. Animating the box-shadow itself makes the browser paint those big soft shadows again
// on every frame. Instead two copies of the shadow are laid under the card's face, one as it is in the air and one as it
// is at rest, each painted once, and only their opacity changes. When the card has landed they are taken away.
function dropShadow(it) {
  dropShadowDone(it);
  const s = it.shadow;
  if (!s || s.el === it.el || s.el.parentNode !== it.el) return null;
  const f = s.el, cs = getComputedStyle(f);
  const layer = (shadow) => {
    const d = document.createElement("i");
    d.setAttribute("aria-hidden", "true");
    d.style.cssText = "position:absolute;display:block;margin:0;pointer-events:none;will-change:opacity;"
      + "left:" + f.offsetLeft + "px;top:" + f.offsetTop + "px;width:" + f.offsetWidth + "px;height:" + f.offsetHeight + "px;"
      + "border-radius:" + cs.borderRadius + ";box-shadow:" + shadow;
    it.el.insertBefore(d, f);                                 // before the face: painted under it
    return d;
  };
  f.style.boxShadow = "none";
  it.layers = { air: layer(s.air), rest: layer(s.rest) };
  return it.layers;
}
function dropShadowDone(it) {
  if (!it.layers) return;
  it.layers.air.remove(); it.layers.rest.remove(); it.layers = null;
  if (it.shadow) it.shadow.el.style.boxShadow = "";
}

// How far to the side a tilt card comes in from (px), so that while it fades in it never lies over a card that is
// already there. Worked out when the card starts, from where the cards really are at that moment: the cards before it
// may still be falling or sliding. A few moments of its fade are checked against them, and the card is moved away from
// the card it would cover just far enough. A card with nothing under it comes straight down.
const dropTimes = () => {
  const D = M.DROP, Y = D.move[0] + D.glide[0];
  return { D, Y, g: D.glide[0] / Y, fall: gsap.parseEase("fm-fall"), glide: gsap.parseEase("fm-glide"),
    slide: [0, 1].map((i) => Math.max(0.1, 2 * D.glide[i] / D.move[i] * D.land)) };
};
// where a tilt card is (drift to the side, drift up, scale, angle), t seconds after it started
function dropPose(o, t, T) {
  const { D, Y, g } = T, X = o.dealt || 0, a = dropStart(o), b = dropLanding(o);
  if (t <= 0) return { x: X, y: Y, s: D.scale, r: a.rotation };
  if (t < D.land) {
    const u = t / D.land, q = 1 - (1 - g) * u;
    return { x: X * q, y: Y * q, s: 1 + (D.scale - 1) * (1 - T.fall(u)), r: a.rotation + (b.rotation - a.rotation) * u };
  }
  const v = T.glide(Math.min(1, (t - D.land) / T.slide[0])), w = T.glide(Math.min(1, (t - D.land) / T.slide[1]));
  return { x: X * g * (1 - v), y: Y * g * (1 - v), s: 1, r: b.rotation + (o.rest - b.rotation) * w };
}
function dealX(it) {
  if (it.el.closest(".is-deck")) return (it.dealt = 0);    // a deck (deck.js): the cards are meant to lie on one another
  const T = dropTimes(), D = T.D, tf = D.land * D.fade, t0 = now();
  const centre = (o) => {                                    // where the card lies, without any of its movement
    const r = o.el.getBoundingClientRect();
    return { x: (r.left + r.right) / 2 - gsap.getProperty(o.el, "x"), y: (r.top + r.bottom) / 2 - gsap.getProperty(o.el, "y"), w: o.el.offsetWidth, h: o.el.offsetHeight };
  };
  const box = (c, p) => {                                    // its box at a pose (the box around the turned card)
    const a = Math.abs(p.r) * Math.PI / 180, hx = (c.w * Math.cos(a) + c.h * Math.sin(a)) / 2 * p.s, hy = (c.w * Math.sin(a) + c.h * Math.cos(a)) / 2 * p.s;
    const x = c.x + p.x, y = c.y + p.y;
    return { x, l: x - hx, r: x + hx, t: y - hy, b: y + hy };
  };
  const others = items.filter((o) => o !== it && o.kind === "tilt" && o.group === it.group && (o.state === "done" || o.state === "play"))
    .map((o) => ({ o, c: centre(o), since: o.state === "done" || o.at == null ? 1e3 : t0 - o.at }));
  if (!others.length) return (it.dealt = 0);
  const me = centre(it), moments = [0, tf * 0.5, tf];
  const clash = (X) => {                                     // the first card it would lie over with this drift, or null
    it.dealt = X;
    for (const m of moments) {
      const A = box(me, dropPose(it, m, T));
      for (const { o, c, since } of others) {
        const B = box(c, dropPose(o, since + m, T));
        if (A.l < B.r + D.gap && A.r > B.l - D.gap && A.t < B.b && A.b > B.t) return c;
      }
    }
    return null;
  };
  const first = clash(0);
  if (!first) return (it.dealt = 0);
  const way = me.x >= first.x ? 1 : -1;                      // away from where the card it would cover lies
  for (let X = 4; X <= 480; X += 4) if (!clash(way * X)) return (it.dealt = way * X);
  return (it.dealt = 0);
}

// How a thing looks once it is there. (Before, it is hidden by the styles: motion.css. Its way in starts from where it
// should start: build() below says both ends of every movement.)
function show(it) {
  const el = it.el;
  if (it.kind === "block") { if (it.tween) gsap.set(el, { y: 0 }); }
  else if (it.kind === "tilt") {
    gsap.set(el, { y: 0, scale: 1, rotation: it.rest || 0, opacity: 1, transformPerspective: 800 });
    dropShadowDone(it);
  } else if (it.targets) gsap.set(it.targets, { yPercent: 0, opacity: 1 });
  el.style.visibility = "visible";
  if (it.kind === "block" || it.kind === "tilt") el.style.opacity = "1";
  el.classList.add("fm-showing", "fm-shown");
  it.state = "done";
}

// ── when a thing may start ──
function watch(it) {
  const box = it.el.getBoundingClientRect();
  if (!box.width && !box.height) { finish(it); return; }   // not on the page at this screen width
  if (box.bottom <= 0) { finish(it); return; }               // above the screen already
  const line = it.line || M.LINE;
  if (box.top < innerHeight * line) { due(it); return; }     // on screen now
  it.trigger = ScrollTrigger.create({ trigger: it.el, start: "top " + line * 100 + "%", once: true, onEnter: () => due(it) });
}

// things that became due together are sorted into their groups at once
const fresh = new Set();
let flushing = false;
function due(it) {
  if (it.state !== "idle") return;
  it.state = "due";
  fresh.add(it);
  if (!flushing) { flushing = true; Promise.resolve().then(flush); }
}
function flush() {
  // After a reload further down the page, the page is kept invisible (the class restoring on <html>, see boot.js)
  // until it has been scrolled back to where the visitor was. Nothing starts before the page is shown.
  const html = document.documentElement;
  if (html.classList.contains("restoring")) {
    const wait = new MutationObserver(() => { if (!html.classList.contains("restoring")) { wait.disconnect(); flush(); } });
    wait.observe(html, { attributes: true, attributeFilter: ["class"] });
    return;
  }
  flushing = false;
  const list = [...fresh];
  fresh.clear();
  const touched = new Set();
  list.forEach((it) => {
    it.box = (it.at || it.el).getBoundingClientRect();
    if (it.at) it.box = { top: it.box.top, left: it.box.left - 0.5 };   // a cue placed at an element goes right before it
    it.group.queue.push(it); touched.add(it.group);
  });
  touched.forEach((g) => {
    g.queue.sort((a, b) => (Math.abs(a.box.top - b.box.top) > 8 ? a.box.top - b.box.top : a.box.left - b.box.left));
    pump(g);
  });
}

// the group plays its queue in order, a beat apart; a heading or text that is not split yet holds the queue
function pump(g) {
  if (!g.open || g.busy) return;
  while (g.queue.length) {
    const it = g.queue[0];
    if (it.state === "done") { g.queue.shift(); continue; }
    if (!it.ready) {
      g.busy = true;
      it.waiters.push(() => { g.busy = false; pump(g); });
      prepare(it);
      if (it.hurry) it.hurry();
      return;
    }
    g.queue.shift();
    if (!seen(it)) { finish(it); continue; }
    const t = now(), at = Math.max(t, g.free);
    g.free = at + lead(it);
    play(it, at - t);
  }
}

// can it be seen at all right now? (above the screen, or cut off by a block around it: then it is simply shown)
function seen(it) {
  const box = it.el.getBoundingClientRect();
  if ((!box.width && !box.height) || box.bottom <= 0) return false;
  let left = 0, right = innerWidth;
  for (let el = it.el.parentElement, n = 0; el && el !== document.body && n < 12; el = el.parentElement, n++) {
    if (getComputedStyle(el).overflowX !== "visible") { const b = el.getBoundingClientRect(); left = Math.max(left, b.left); right = Math.min(right, b.right); }
  }
  return box.right > left + 1 && box.left < right - 1;
}

// how soon the next thing of its group may start
function lead(it) {
  if (it.lead != null) return it.lead;
  if (it.kind === "chars") { const [lo, part, hi] = M.BEAT.chars; return Math.min(hi, Math.max(lo, shownOf(it.targets).length * M.chars.stagger * part)); }
  if (it.kind === "lines") return (it.targets.length - 1) * M.lines.stagger + M.BEAT.lines;
  return it.kind === "tilt" ? M.BEAT.drop : M.BEAT.block;
}

function open(g, at) {
  if (!g || g.open) return;
  g.open = true;
  g.free = at + M.BEAT.inside;
  pump(g);
}

function play(it, delay) {
  it.state = "play";
  it.at = now() + delay;                                    // when it starts
  open(it.inner, it.at);
  if (it.kind === "cue") { gsap.delayedCall(delay, () => { began(it); it.play(false); ended(it); }); return; }
  it.tween = build(it, delay);
}
// when it starts: if it has been scrolled past while it waited for its turn, it is simply put in place
const began = (it) => {
  it.el.classList.add("fm-showing");
  if (it.tween && it.el.getBoundingClientRect().bottom < 0) Promise.resolve().then(() => { if (it.tween) it.tween.progress(1); });
};
const ended = (it) => { it.state = "done"; it.tween = null; it.el.classList.add("fm-shown"); };
// the letters that are shown at this screen width (a heading can have a part for some widths only: the hero's title on
// the narrowest phones); the others are simply put in place, so they do not hold up the letters that are seen
const shownOf = (parts) => parts.filter((p) => p.getClientRects().length);
// the animation of a thing, starting after a delay
function build(it, delay) {
  const el = it.el, on = { delay, onStart: () => began(it), onComplete: () => ended(it) };
  if (it.kind === "chars") {
    const seen = shownOf(it.targets);
    if (seen.length < it.targets.length) gsap.set(it.targets.filter((p) => seen.indexOf(p) < 0), { yPercent: 0, opacity: 1 });
    const kf = {};
    M.chars.wave.forEach(([t, y, o]) => { kf[Math.round(t * 100) + "%"] = o == null ? { yPercent: y } : { yPercent: y, opacity: o }; });
    kf.easeEach = "fm-wave";
    return gsap.to(seen, Object.assign({ keyframes: kf, duration: M.chars.time, stagger: M.chars.stagger }, on));
  }
  if (it.kind === "lines") {
    return gsap.fromTo(it.targets, { yPercent: M.lines.rise, opacity: 0 },
      Object.assign({ yPercent: 0, opacity: 1, duration: M.lines.time, ease: "fm-out", stagger: M.lines.stagger }, on));
  }
  const tl = gsap.timeline(on);
  if (it.kind === "tilt") {
    const D = M.DROP, a = dropStart(it), b = dropLanding(it), X = dealX(it), g = D.glide[0] / (D.move[0] + D.glide[0]);
    a.x = X; b.x = X * g;                                     // the drift to the side, in step with the drift up
    // the speed it has in the air, kept at the moment it lands: the glide curve starts at twice its average speed
    const slide = (i) => Math.max(0.1, 2 * D.glide[i] / D.move[i] * D.land);
    tl.fromTo(el, { scale: D.scale }, { scale: 1, duration: D.land, ease: "fm-fall" }, 0)
      .fromTo(el, a, { x: b.x, y: b.y, rotation: b.rotation, duration: D.land, ease: "none" }, 0)        // in the air
      .fromTo(el, { x: b.x, y: b.y }, { x: 0, y: 0, duration: slide(0), ease: "fm-glide", immediateRender: false }, D.land)   // sliding on
      .fromTo(el, { rotation: b.rotation }, { rotation: it.rest, duration: slide(1), ease: "fm-glide", immediateRender: false }, D.land)
      .fromTo(el, { opacity: 0 }, { opacity: 1, duration: D.land * D.fade, ease: "fm-out" }, 0);
    const sh = dropShadow(it);
    if (sh) {
      tl.fromTo(sh.air, { opacity: 1 }, { opacity: 0, duration: D.land, ease: "fm-fall" }, 0)
        .fromTo(sh.rest, { opacity: 0 }, { opacity: 1, duration: D.land, ease: "fm-fall" }, 0)
        .call(() => dropShadowDone(it), null, D.land);
    }
    return tl;
  }
  const T = M.block.time;
  tl.fromTo(el, { y: M.block.rise }, { y: 0, duration: T, ease: "fm-settle" }, 0)
    .fromTo(el, { opacity: 0 }, { opacity: 1, duration: T * M.block.fade, ease: "fm-out" }, 0);
  return tl;
}

// shown at once, without its beat; what is inside it is let in
function finish(it) {
  if (it.state === "done") return;
  if (it.tween) it.tween.kill();
  if (it.trigger) it.trigger.kill();
  if (it.kind === "cue") { if (it.ready) it.play(true); else it.waiters.push(() => it.play(true)); it.state = "done"; it.el.classList.add("fm-showing", "fm-shown"); }
  else show(it);
  open(it.inner, now());
}

// ── headings and texts: split when they come near the screen ──
function prepareNear() {
  const list = items.filter((it) => !it.ready && it.state !== "done");
  const near = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    near.unobserve(e.target);
    setTimeout(() => prepare(e.target.fmItem), 0);       // each in a task of its own: the browser can paint and answer taps in between
  }), { rootMargin: "100% 0px" });
  list.forEach((it) => near.observe(it.el));
}

// normal whitespace collapsed (non-breaking spaces kept), ends trimmed
export function tidy(el) {
  el.normalize();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((n) => { n.nodeValue = n.nodeValue.replace(/[ \t\n\r]+/g, " "); });
  for (const n of nodes) { n.nodeValue = n.nodeValue.replace(/^ +/, ""); if (n.nodeValue) break; }
  for (const n of nodes.reverse()) { n.nodeValue = n.nodeValue.replace(/ +$/, ""); if (n.nodeValue) break; }
}
// Lines are measured in the font that is showing. Measured in the stand-in font, a line could take words that no longer
// fit once the real font arrives. So a text is split once its font is there: it waits up to 3 seconds while it is only
// near the screen, but once its turn has come only FONT seconds more, so it does not hold up its group. If the font
// arrives later, SplitText splits the text again, and the lines carry on from the same moment (see onSplit).
function fontOf(el) {
  const s = getComputedStyle(el), text = el.textContent.trim().slice(0, 100) || "a";
  return Promise.race([document.fonts.load(s.fontStyle + " " + s.fontWeight + " " + s.fontSize + " " + s.fontFamily, text).catch(() => {}),
    new Promise((done) => setTimeout(done, 3000))]);
}

function prepare(it) {
  if (!it || it.ready || it.preparing || it.state === "done") return;
  if (it.kind === "cue") return;                          // a cue says itself when it is ready
  it.preparing = true;
  const lines = it.kind === "lines";
  const font = lines ? Promise.race([fontOf(it.el), new Promise((go) => { it.hurry = () => setTimeout(go, M.FONT * 1000); })]) : Promise.resolve();
  // the label screen readers hear: SplitText writes the heading's text; a heading with parts for some widths only (the
  // hero's) says in data-label what it reads as
  const label = it.el.dataset.label;
  font.then(() => {
    tidy(it.el);
    SplitText.create(it.el, {
      type: lines ? "lines" : "words, chars",
      linesClass: lines ? "fm-line" : undefined,         // a line never wraps again by itself (see .fm-line in the styles)
      reduceWhiteSpace: false,                            // keep the non-breaking spaces
      autoSplit: true,                                    // split again when the width or the font changes
      // screen readers: a heading is read from its label (its letters are hidden from them); a text split into lines
      // is read as it is (whole words in every line), as a paragraph may not have a label of its own
      aria: /^H\d$/.test(it.el.tagName) ? "auto" : "none",
      onSplit(self) {
        const parts = lines ? self.lines : self.chars;
        if (label) it.el.setAttribute("aria-label", label);
        const first = !it.targets;
        it.targets = parts;
        if (it.state === "done") gsap.set(parts, { yPercent: 0, opacity: 1 });
        else if (it.state === "play" && it.tween) {
          // split again while it is coming in (its font arrived, the window was resized): the new letters or lines
          // carry on from the same moment
          const gone = now() - it.at;
          it.tween.kill();
          it.tween = build(it, Math.max(0, -gone));
          if (gone > 0) it.tween.totalTime(gone);
        } else gsap.set(parts, lines ? { yPercent: M.lines.rise, opacity: 0 } : { yPercent: M.chars.wave[0][1], opacity: 0 });
        gsap.set(it.el, { visibility: "visible" });
        if (first) ready(it);
      }
    });
  });
}
function ready(it) {
  it.ready = true;
  it.waiters.splice(0).forEach((fn) => fn());
}

// ── other parts of the page join a group: cue(el, { play(instant), whenReady(done) }) ──
// play(true): it is shown without its way in. Returns false when there is no way in ("reduce motion"):
// the caller then plays it itself.
export function cue(el, opts) {
  const c = { el, play: opts.play, whenReady: opts.whenReady, lead: opts.lead != null ? opts.lead : 0, at: opts.at || null, owner: opts.group || null, line: opts.line || 0 };
  if (!booted) { waiting.push(c); return true; }
  if (!live) return false;
  enlist(c);
  return true;
}
function enlist(c) {
  const it = add(c.el, "cue", { play: c.play, lead: c.lead, at: c.at, line: c.line, ready: false });
  it.group = groupFor(it.el, c.owner);
  c.whenReady(() => ready(it));
  watch(it);
}

// ── the ID cards lean towards the mouse, up to 8° ──
function lean() {
  if (!fine) return;
  items.filter((it) => it.kind === "tilt").forEach(({ el: card }) => {
    gsap.set(card, { transformPerspective: 800 });
    const rx = gsap.quickTo(card, "rotationX", { duration: M.tilt.follow, ease: "fm-out" });
    const ry = gsap.quickTo(card, "rotationY", { duration: M.tilt.follow, ease: "fm-out" });
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * M.tilt.lean * 2);
      rx(-((e.clientY - r.top) / r.height - 0.5) * M.tilt.lean * 2);
    });
    card.addEventListener("mouseleave", () => { rx(0); ry(0); });
  });
}

window.fmMotion = { M, css, cue, get calm() { return calm; }, state: () => items.map((it) => ({ el: it.el, kind: it.kind, state: it.state })) };
