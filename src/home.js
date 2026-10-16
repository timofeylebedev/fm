/* home.js: all scripts of the page in one file (the readable source; this is the file to edit).
   `npm run build` minifies it into f/home-64min.js, which index.html loads with a script tag before </body>
   (no defer, no async). GSAP and its plugins are loaded by the site-wide code earlier in the page, which runs first.
   Image paths here are relative to the page (d/…), not to this file. */

// The page knows home.js is running. This switches off the safety net in the styles (see the top of home.css) that shows
// the hidden headings and cards after a few seconds when this file never arrives.
document.documentElement.classList.add("fm-js");


/* ═══════════ pace: a lighter mode for weak devices ═══════════ */
/* Every animation loop below reports here when its frames come. When the middle (median) one of 90 frames in a row
   takes longer than 22 ms (fewer than about 45 frames a second), the device cannot keep up, and the page switches to
   a lighter mode for the rest of the visit:
     · the loops drawn by the script (the chips of the hero, the ring of covers, the dots, the section drawings) draw on
       every second frame only, 30 times a second. Their motions are slow: at 30 frames they look the same, while a device
       that keeps missing frames looks jerky;
     · the chips of the hero lose their frosted glass;
     · the canvases of the section drawings get at most 2 pixels per CSS px (3 on the sharpest phone screens otherwise).
   The animations done by the styles and by GSAP (headings, cards, the logos strip) are not touched.
   To see the lighter mode on a fast computer: fmPace.slow = true in the console (fmPace.slow = false to go back). */
const fmPace = window.fmPace = (() => {
  const SAMPLE = 90;           // frames looked at, in a row
  const SLOW_MS = 22;          // a median frame longer than this switches the lighter mode on
  const STEP_MS = 28;          // in the lighter mode a loop draws only when this much time has passed since it last drew
  let times = [], prev = 0, slow = false;
  const listeners = [];
  return {
    get slow() { return slow; },
    set slow(v) { v = !!v; if (v !== slow) { slow = v; listeners.forEach((fn) => fn(v)); } },
    onChange(fn) { listeners.push(fn); },
    // called by the loops on every frame with the frame's time; several loops in one frame count once
    frame(now) {
      if (now === prev) return;
      if (prev && now - prev < 250) times.push(now - prev);   // a longer gap is a hidden tab or a pause, not the pace
      prev = now;
      if (times.length < SAMPLE) return;
      const median = times.sort((a, b) => a - b)[SAMPLE >> 1];
      times = [];
      if (!slow && median > SLOW_MS) {
        console.info("fm: the lighter mode for weak devices is on (median frame " + median.toFixed(1) + " ms)");
        this.slow = true;
      }
    },
    // should a loop draw on this frame? last: when it drew before (0 = never)
    due(last, now) { return !slow || !last || now - last >= STEP_MS; }
  };
})();

/* ═══════════ motion: how things come in, and how they answer the mouse ═══════════ */
/* One system for every animation of the page that is not a drawing. Everything takes its curves and timings from M below,
   so a change there changes the whole page.

   THE WAY IN
   What comes in, and how (the classes are set in Taptop):
     · split-chars   a heading: letter by letter, each one up from below its place, a little past it and back (the wave);
     · split-lines   a text: line by line, up from one line below, calmly (no bounce: text is for reading);
     · reveal-card,  a block (a card, a button, a picture): up from 40px below, a little past its place and back (settle),
       reveal        fading in during the first half of that. reveal is the same as reveal-card, for things that are not cards;
     · tilt-card     a card of «Гибкая настройка прав доступа»: falls onto the page, as if dropped on a table (DROP below).
                     It starts bigger, as if closer, and gets smaller faster and faster until it lands; its shadow is
                     wide and faint while it is in the air and tightens as it lands. In the air it drifts up and turns
                     at an even speed; when it lands it keeps going a little by its own momentum, sliding and turning
                     a bit further while friction slows it to a stop, at its own angle (TILT: -5°, -1.5° and 8°, in
                     the order of the cards on the page). No bounce: it never goes past its place and back.
                     The cards overlap, and a card that fades in over another one shows that one through itself.
                     So the cards come in from the side, as if dealt onto the table: each one fades in next to the
                     card before it, not over it, and only slides over it once it is solid. How far to the side is
                     worked out from where the cards lie (see dealX), so it follows the layout at every width; cards
                     that do not overlap come straight down;
     · a button that sits in the same group as a split heading or text (the hero, the purple CTA card) comes in as a block
       by itself, with no class. A button that should not: give it the class no-reveal (anything inside no-reveal is left alone).
   Things that belong together come in as one movement:
     · a group is everything in one section, or everything inside one card that comes in (a card is a group of its own for
       what is in it). A block with the class reveal-group is a group too;
     · in a group, things come in one after another in the order they are read (top to bottom, then left to right). Each one
       starts a beat after the one before it has started (BEAT below): a heading lets the next thing start once about half of
       its letters are on their way, a text once its last line has started, a block after 0.14s. So a heading, its text and
       its button play as one animation, and a row of cards follows them like a wave;
     · nothing starts before its top has come up to 88% of the screen height (LINE). A thing that comes into view later than
       its turn simply starts then;
     · what is inside a card starts once the card itself has started (0.2s later), with the same beats;
     · a thing that is above the screen when its turn comes (after a reload further down the page, or a jump with a menu link),
       or that cannot be seen at all (cut off by its block, or not on the page at this screen width), is simply shown, and
       does not hold up the others;
     · other parts of the page can join a group with fmMotion.cue (the hero's table and chips do: they come in after the
       hero's button). A thing that comes in starts with the class fm-showing and ends with fm-shown (the royalty drawings
       wait for their card by these).
   Taptop's own Appear and Hover interactions are switched off by the script (see "Taptop" below), so they never play over
   these. They can be deleted in Taptop, or left there: it makes no difference. Click interactions and Taptop animations that
   loop (the strip of icons in the CTA card) are left alone.

   THE HOVER (on devices with a mouse)
   Colours and fades are done by the styles (home.css, "motion: hover"), with the timings below written into the page as
   --fm-ease, --fm-hover-in and --fm-hover-out: quick in, a little slower out. What changes is found by the script, by kind:
     · a text link: its text turns black;
     · a button or a card with a colour of its own: the colour deepens (FILLS below: the hover colour of each colour
       of the site; any other colour gets 8% darker). A white button: its text fades to 80%. A light grey button or card:
       a little darker grey, and its text turns black;
     · a link made of a picture (the video covers): it fades to 70%;
     · an icon in a card that is a link (the arrows of the publications): from its own opacity to 0.2 more;
     · a logo card: the name of the label fades in over the logo;
     · a card that opens its button from anywhere (the purple CTA card, the two tool cards): the whole card is the button,
       so the button looks hovered while the mouse is anywhere on the card;
     · a button pressed (mouse or finger): it gives in to 97% and springs back (GSAP);
     · a tilt card: it leans towards the mouse, up to 8° (GSAP).
   "Reduce motion": everything is simply shown, nothing leans or springs. The colours still change.

   For quick experiments in the console: fmMotion.M is the list below; fmMotion.state() lists what has come in. */
const fmMotion = window.fmMotion = (() => {
  const M = {
    // the curves of the site: [x1, y1, x2, y2] as in CSS cubic-bezier, or a path (CustomEase)
    curve: {
      out: [0.22, 1, 0.36, 1],          // arriving: quick, then a long soft landing. Text, fades, hovers
      move: [0.65, 0, 0.25, 1],         // travelling from one place to another: slow start, slow arrival (the navbar pill)
      leave: [0.55, 0, 0.75, 0.2],      // going away: gathers speed (the titles of the card stack)
      wave: [0.5, 0, 0.5, 1],           // each step of the letters' wave
      settle: "M0,0 C0,0.788 0.135,1.212 0.32,1.215 0.5,1.218 0.51,0.847 1,1",  // blocks: about a fifth past their place, then back
      fall: [0.55, 0.085, 0.68, 0.53],  // falling: faster and faster, until it lands (the tilt cards)
      glide: "power1.out"               // sliding to a stop after landing: friction (a GSAP ease: quadratic, its speed at the start is 2)
    },
    // a heading, letter by letter: where a letter is (% of its height below its place) at each moment of its time
    // [moment, % below, opacity]: up from 25% below, past its place by 10%, back by 4%, past by 1%, in place; fully visible at 40%
    chars: { time: 1.1, stagger: 0.03, wave: [[0, 25, 0], [0.4, -10, 1], [0.65, 4], [0.85, -1], [1, 0]] },
    lines: { time: 0.9, stagger: 0.1, rise: 100 },        // a text: seconds, between lines, % of a line it comes up from
    block: { time: 1.0, rise: 40, fade: 0.5 },            // a block: seconds, px it comes up from, the part of its time it fades in
    tilt: { lean: 8, follow: 0.6 },                       // tilt cards: how far they lean to the mouse (°), seconds to follow it
    TILT: [-5, -1.5, 8],                                  // the angle each tilt card lands at, in page order (the last one for any more)
    // a tilt card falling:
    //   land   seconds in the air, until it lands
    //   scale  how big it starts (as if closer)
    //   move   [px, °] it drifts up and turns while in the air (at an even speed); the drift to the side is added
    //          to this (see dealX) and keeps the same proportions
    //   glide  [px, °] it slides and turns further after landing, slowing down. The time it takes follows from these:
    //          it keeps exactly the speed it had in the air and slows to a stop (more glide = a longer slide)
    //   fade   the part of the time in the air it fades in (0.36 × 0.55s = 0.2s)
    //   gap    px between a card that is fading in and the card next to it
    //   air    its shadow in the air: [offset ×, blur ×, opacity ×]
    DROP: { land: 0.55, scale: 1.15, move: [24, 4.5], glide: [13, 2.5], fade: 0.36, gap: 6, air: [2.4, 2, 0.5] },
    BEAT: { chars: [0.25, 0.5, 0.6], lines: 0.3, block: 0.14, drop: 0.2, inside: 0.2 },
    //   chars: [at least, the part of its letters, at most]: the next thing starts once that part of the letters has started
    //   lines: after its last line has started; block: after it has started; drop: a tilt card, after it has started;
    //   inside: what is in a card, after the card
    LINE: 0.88,                                           // a thing may start once its top is above this part of the screen height
    FONT: 0.3,                                            // a text whose turn has come waits at most this long (s) for its font (see prepare)
    hover: { in: 0.2, out: 0.45, press: 0.97 },           // seconds in and out; how far a pressed button gives in
    FILLS: {                                              // the hover colour of each colour of the site (as rgba numbers)
      "136,77,255,1": "119,51,255,1",                     //   purple
      "245,110,0,1": "235,100,0,1",                       //   orange
      "0,159,191,1": "0,139,171,1",                       //   teal (the Telegram bot)
      "0,0,0,0.03": "0,0,0,0.05"                          //   light grey (the publications, «Показать больше»)
    }
  };

  const bez = (c) => "cubic-bezier(" + c.join(", ") + ")";
  const css = { out: bez(M.curve.out), move: bez(M.curve.move), leave: bez(M.curve.leave) };
  const calm = !!window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = !!window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  const SKIP = "nav, .fm-cards, .fm-stage, .no-reveal, .menu-list";   // never touched by the way in
  const now = () => performance.now() / 1000;

  // the curves as GSAP eases ("fm-out", "fm-move", "fm-leave", "fm-wave", "fm-settle"); called by every part that uses them
  let eased = false;
  function setup() {
    if (eased || !window.gsap) return !!window.gsap;
    eased = true;
    if (window.CustomEase) {
      gsap.registerPlugin(CustomEase);
      Object.keys(M.curve).forEach((k) => {
        const c = M.curve[k];
        if (typeof c === "string" && !/^M/.test(c)) gsap.registerEase("fm-" + k, gsap.parseEase(c));   // a GSAP ease by its name
        else CustomEase.create("fm-" + k, Array.isArray(c) ? c.join(",") : c);
      });
    } else {                                                // CustomEase did not load: GSAP's own eases that are closest
      const near = { out: "power3.out", move: "power2.inOut", leave: "power2.in", wave: "sine.inOut", settle: "back.out(1.7)", fall: "power2.in", glide: "power1.out" };
      Object.keys(near).forEach((k) => gsap.registerEase("fm-" + k, gsap.parseEase(near[k])));
    }
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    return true;
  }
  // the timings the styles use (home.css has the same values as a fallback)
  const root = document.documentElement.style;
  root.setProperty("--fm-ease", css.out);
  root.setProperty("--fm-ease-move", css.move);
  root.setProperty("--fm-hover-in", M.hover.in + "s");
  root.setProperty("--fm-hover-out", M.hover.out + "s");

  // ── the things that come in, and their groups ──
  const items = [];
  const groups = new Map();                                   // the block of a group → the group
  let booted = false, live = false;
  const waiting = [];                                         // cues added before the start

  function groupFor(el) {
    const owner = el.parentElement && el.parentElement.closest(".reveal-card, .reveal, .tilt-card, .reveal-group, section");
    const key = owner || document.body;
    let g = groups.get(key);
    if (!g) {
      g = { el: key, owner: null, open: true, free: 0, queue: [], busy: false };
      groups.set(key, g);
    }
    return g;
  }

  function add(el, kind, extra) {
    if (el.fmItem) return el.fmItem;
    const it = Object.assign({ el, kind, state: "idle", ready: kind === "block" || kind === "tilt", waiters: [], targets: null, tween: null, inner: null }, extra || {});
    el.fmItem = it;
    items.push(it);
    return it;
  }

  // ── at the start ──
  function boot() {
    booted = true;
    taptop();                                                 // see "Taptop" below: runs with or without GSAP
    collect();
    taptopRest();
    hovers();
    const ok = setup() && window.ScrollTrigger && !calm;
    if (!ok) { items.forEach(show); waiting.splice(0).forEach((c) => c.whenReady(() => c.play(true))); return; }
    live = true;
    items.forEach((it) => { it.group = groupFor(it.el); });
    // groups that belong to a card: closed until the card starts
    items.forEach((it) => {
      const g = groups.get(it.el);
      if (g) { g.owner = it; g.open = false; it.inner = g; }
    });
    items.forEach(hide);
    waiting.splice(0).forEach((c) => enlist(c));
    items.forEach(watch);
    prepareNear();
    leanAndPress(true);
  }

  function collect() {
    const skip = (el) => !!el.closest(SKIP);
    const take = (sel, kind) => document.querySelectorAll(sel).forEach((el) => { if (!skip(el)) add(el, kind); });
    take(".split-chars", "chars");
    take(".split-lines", "lines");
    take(".tilt-card", "tilt");
    take(".reveal-card, .reveal", "block");
    // a button in the same group as a split heading or text comes in by itself
    const texts = items.filter((it) => it.kind === "chars" || it.kind === "lines");
    const homes = new Set(texts.map((it) => groupFor(it.el).el));
    homes.forEach((home) => home.querySelectorAll(".button").forEach((btn) => {
      if (btn.fmItem || skip(btn)) return;
      const inside = btn.parentElement.closest(".reveal-card, .reveal, .tilt-card, .reveal-group, section");
      if (inside === home) add(btn, "block");
    }));
    groups.clear();                                           // made again once every item is known
    // the tilt cards: their angle, in page order
    let t = 0;
    items.forEach((it) => {
      if (it.kind !== "tilt") return;
      it.rest = M.TILT[Math.min(t++, M.TILT.length - 1)];
      shadowOf(it);
    });
  }

  // where a tilt card starts, and where it lands (from there it slides on to y 0 and its own angle).
  // It turns the way it will be leaning: towards its angle, and on past 0 to it if it has to.
  const turnWay = (it) => (it.rest < 0 ? -1 : 1);
  const dropLanding = (it) => ({ y: M.DROP.glide[0], rotation: it.rest - turnWay(it) * M.DROP.glide[1] });
  const dropStart = (it) => ({ y: M.DROP.move[0] + M.DROP.glide[0], rotation: it.rest - turnWay(it) * (M.DROP.move[1] + M.DROP.glide[1]) });

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

  // The shadow while a card falls. Animating the box-shadow itself made the browser paint those big soft shadows again on
  // every frame, and that was slow enough to switch the whole page to the lighter mode for weak devices (see "pace").
  // Instead two copies of the shadow are laid under the card's face, one as it is in the air and one as it is at rest,
  // each painted once, and only their opacity changes (which the browser does without painting anything). When the card
  // has landed they are taken away, and the face has its own shadow back.
  function dropShadow(it) {
    dropShadowDone(it);
    const s = it.shadow;
    if (!s || s.el === it.el || s.el.parentNode !== it.el) return null;   // a shadow on the card itself is left as it is
    const f = s.el, cs = getComputedStyle(f);
    if (getComputedStyle(it.el).position === "static") it.el.style.position = "relative";
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
  // already there (a card that fades in over another one shows that one through itself). Worked out when the card starts,
  // from where the cards really are at that moment: the cards before it may still be falling or sliding, and a falling
  // card is bigger and turned. A few moments of its fade are checked against them, and the card is moved away from the
  // card it would cover (to the right of a card on its left) just far enough. A card with nothing under it comes
  // straight down, so the first card always does; how far the others come from depends on the layout and the width.
  const DROP_T = () => {                                       // the timings of a drop, worked out once
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
    const T = DROP_T(), D = T.D, tf = D.land * D.fade, t0 = now();
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

  // how a thing looks before it comes in, and once it is there
  function hide(it) {
    if (it.kind === "block" || it.kind === "tilt") {
      gsap.set(it.el, { clearProps: "translate,rotate,scale" });
      const from = { x: 0, y: M.block.rise, rotation: 0, rotationX: 0, rotationY: 0, scale: 1, opacity: 0 };
      if (it.kind === "tilt") Object.assign(from, dropStart(it), { scale: M.DROP.scale, transformPerspective: 800 });
      gsap.set(it.el, from);
    }
    // headings and texts stay hidden by the styles (visibility) until they are split
  }
  function show(it) {
    const el = it.el;
    if (window.gsap) {
      if (it.kind === "block") gsap.set(el, { y: 0, opacity: 1 });
      else if (it.kind === "tilt") {
        gsap.set(el, { y: 0, scale: 1, rotation: it.rest || 0, opacity: 1, transformPerspective: 800 });
        dropShadowDone(it);
      }
      else if (it.targets) gsap.set(it.targets, { yPercent: 0, opacity: 1 });
    } else if (it.kind === "tilt") el.style.transform = "rotate(" + (it.rest || 0) + "deg)";
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
    if (box.top < innerHeight * M.LINE) { due(it); return; }   // on screen now
    it.trigger = ScrollTrigger.create({ trigger: it.el, start: "top " + M.LINE * 100 + "%", once: true, onEnter: () => due(it) });
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
    // After a reload further down the page, the page is kept invisible (the class fm-restoring on <html>, see the "inside
    // head" code) until it has been scrolled back to where the visitor was. Nothing starts before the page is shown:
    // otherwise the blocks there were already half-way in (or only fading) by the time the visitor saw them.
    const html = document.documentElement;
    if (html.classList.contains("fm-restoring") && window.MutationObserver) {
      const wait = new MutationObserver(() => { if (!html.classList.contains("fm-restoring")) { wait.disconnect(); flush(); } });
      wait.observe(html, { attributes: true, attributeFilter: ["class"] });
      return;
    }
    flushing = false;
    const list = [...fresh];
    fresh.clear();
    const touched = new Set();
    list.forEach((it) => { it.box = it.el.getBoundingClientRect(); it.group.queue.push(it); touched.add(it.group); });
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
      const ox = getComputedStyle(el).overflowX;
      if (ox !== "visible") { const b = el.getBoundingClientRect(); left = Math.max(left, b.left); right = Math.min(right, b.right); }
    }
    return box.right > left + 1 && box.left < right - 1;
  }

  // how soon the next thing of its group may start
  function lead(it) {
    if (it.lead != null) return it.lead;
    if (it.kind === "chars") { const [lo, part, hi] = M.BEAT.chars; return Math.min(hi, Math.max(lo, it.targets.length * M.chars.stagger * part)); }
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
  // the animation of a thing, starting after a delay
  function build(it, delay) {
    const el = it.el, on = { delay, onStart: () => began(it), onComplete: () => ended(it) };
    if (it.kind === "chars") {
      const kf = {};
      M.chars.wave.forEach(([t, y, o]) => { kf[Math.round(t * 100) + "%"] = o == null ? { yPercent: y } : { yPercent: y, opacity: o }; });
      kf.easeEach = "fm-wave";
      return gsap.to(it.targets, Object.assign({ keyframes: kf, duration: M.chars.time, stagger: M.chars.stagger }, on));
    }
    if (it.kind === "lines") {
      return gsap.fromTo(it.targets, { yPercent: M.lines.rise, opacity: 0 },
        Object.assign({ yPercent: 0, opacity: 1, duration: M.lines.time, ease: "fm-out", stagger: M.lines.stagger }, on));
    }
    // from and to are both written out, so what is on the block when it starts (Taptop, a resize) never changes its way in
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
    if (!window.IntersectionObserver) { list.forEach(prepare); return; }
    const near = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      near.unobserve(e.target);
      setTimeout(() => prepare(e.target.fmItem), 0);       // each in a task of its own: the browser can paint and answer taps in between
    }), { rootMargin: "100% 0px" });
    list.forEach((it) => near.observe(it.el));
  }

  // normal whitespace collapsed (non-breaking spaces kept), Taptop's no-break spans made into non-breaking spaces, ends trimmed
  function tidy(el) {
    el.querySelectorAll('span[style*="white-space"]').forEach((span) => span.replaceWith(document.createTextNode(span.textContent.replace(/ /g, "\u00a0"))));
    el.normalize();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => { n.nodeValue = n.nodeValue.replace(/[ \t\n\r]+/g, " "); });
    for (const n of nodes) { n.nodeValue = n.nodeValue.replace(/^ +/, ""); if (n.nodeValue) break; }
    for (const n of nodes.reverse()) { n.nodeValue = n.nodeValue.replace(/ +$/, ""); if (n.nodeValue) break; }
  }
  // Lines are measured in the font that is showing. Measured in a narrower stand-in font, a line took words that no longer
  // fitted once the real font arrived. So a text is split once its font is there: it waits up to 3 seconds while it is only
  // near the screen, but once its turn has come only FONT seconds more, so it does not hold up its group. If the font
  // arrives later, SplitText splits the text again, and the lines carry on from the same moment (see onSplit).
  function fontOf(el) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const s = getComputedStyle(el), text = el.textContent.trim().slice(0, 100) || "a";
    return Promise.race([document.fonts.load(s.fontStyle + " " + s.fontWeight + " " + s.fontSize + " " + s.fontFamily, text).catch(() => {}),
      new Promise((done) => setTimeout(done, 3000))]);
  }

  function prepare(it) {
    if (!it || it.ready || it.preparing || it.state === "done") return;
    if (it.kind === "cue") return;                          // a cue says itself when it is ready
    it.preparing = true;
    if (!window.SplitText) { it.targets = [it.el]; gsap.set(it.el, { visibility: "visible" }); return ready(it); }
    gsap.registerPlugin(SplitText);
    const lines = it.kind === "lines";
    const font = lines ? Promise.race([fontOf(it.el), new Promise((go) => { it.hurry = () => setTimeout(go, M.FONT * 1000); })]) : Promise.resolve();
    font.then(() => {
      tidy(it.el);
      SplitText.create(it.el, {
        type: lines ? "lines" : "words, chars",
        linesClass: lines ? "fm-line" : undefined,         // a line never wraps again by itself (see .fm-line in the styles)
        reduceWhiteSpace: false,                            // keep the non-breaking spaces
        autoSplit: true,                                    // split again when the width or the font changes
        onSplit(self) {
          const parts = lines ? self.lines : self.chars;
          if (lines) it.el.dataset.lines = parts.length;
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

  // ── other parts of the page join a group: fmMotion.cue(el, { play(instant), whenReady(done) }) ──
  // play(true): it is shown without its way in. Returns false when there is no way in (no GSAP, "reduce motion"):
  // the caller then plays it itself.
  function cue(el, opts) {
    const c = { el, play: opts.play, whenReady: opts.whenReady, lead: opts.lead != null ? opts.lead : 0 };
    if (!booted) { waiting.push(c); return true; }
    if (!live) return false;
    enlist(c);
    return true;
  }
  function enlist(c) {
    const it = add(c.el, "cue", { play: c.play, lead: c.lead, ready: false });
    it.group = groupFor(it.el);
    c.whenReady(() => ready(it));
    watch(it);
  }

  // ── leaning (tilt cards) and pressing (buttons): GSAP, on devices with a mouse / on every device ──
  function leanAndPress(on) {
    if (!on || calm || !window.gsap) return;
    if (fine) document.querySelectorAll(".tilt-card").forEach((card) => {
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
    document.querySelectorAll(".button").forEach((btn) => {
      if (btn.closest(".menu-list, .fm-stage")) return;
      const down = () => gsap.to(btn, { scale: M.hover.press, duration: 0.15, ease: "fm-out", overwrite: "auto" });
      const up = () => { if (gsap.getProperty(btn, "scale") < 1) gsap.to(btn, { scale: 1, duration: 0.6, ease: "fm-settle", overwrite: "auto" }); };
      btn.addEventListener("pointerdown", down);
      ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((ev) => btn.addEventListener(ev, up));
    });
  }

  // ── hover: what changes is found here, how it changes is in home.css ("motion: hover") ──
  const rgba = (s) => {
    const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)/.exec(s || "");
    if (!m) return null;
    let a = m[4] == null ? 1 : parseFloat(m[4]);
    if (m[5]) a /= 100;
    return [+m[1], +m[2], +m[3], +a.toFixed(3)];
  };
  function hoverFill(c) {
    const known = M.FILLS[c.join(",")];
    if (known) return "rgba(" + known + ")";
    if (c[3] < 0.2) return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.min(1, c[3] + 0.02) + ")";
    return "rgba(" + c.slice(0, 3).map((v) => Math.round(v * 0.92)).join(",") + "," + c[3] + ")";
  }
  function hovers() {
    document.querySelectorAll("a.link").forEach((a) => { if (!a.closest(".fm-stage")) a.classList.add("fm-h-ink"); });
    document.querySelectorAll(".button, a.link-block").forEach((el) => {
      if (el.closest(".fm-stage")) return;
      const c = rgba(getComputedStyle(el).backgroundColor);
      if (!c || c[3] === 0) {                                // no colour of its own: a picture that is a link
        if (el.matches("a.link-block") && !el.closest("nav") && !el.fmItem) el.classList.add("fm-h-dim");
        return;
      }
      const light = c[0] + c[1] + c[2] > 720 && c[3] > 0.9;
      if (light) { el.classList.add("fm-h-label"); return; }  // a white button: its text fades
      el.style.setProperty("--fm-fill", hoverFill(c));
      el.classList.add("fm-h-fill");
      if (c[3] < 0.2) el.classList.add("fm-h-ghost");        // a light grey one: its text turns black too
    });
    document.querySelectorAll("a .svg-icon, .fm-linkcard .svg-icon").forEach((icon) => {
      const o = parseFloat(getComputedStyle(icon).opacity);
      if (o > 0 && o < 0.9) { icon.style.setProperty("--fm-icon", Math.min(1, o + 0.2).toFixed(2)); icon.classList.add("fm-h-icon"); }
    });
  }

  // ── Taptop ──
  // Taptop plays its own interactions with a GSAP of its own (window.taptop.gsap), a moment after the page has opened.
  // The Appear and Hover ones are switched off here as soon as they are made, so the page has one way in and one hover:
  //   · an Appear interaction is put at its end at once (the block looks as Taptop leaves it) and stopped; if the block is
  //     one that comes in here, it is hidden again for its own way in;
  //   · a Hover interaction is undone (the colour it wrote into the block is taken away) and stopped.
  // Click interactions (the cookie notice, «Показать больше») and the ones that loop are left as they are.
  // Taptop makes them again when the screen crosses one of its widths, so this looks again after every resize.
  function taptop() {
    let kinds = null;
    const handled = new WeakSet();
    const read = () => {
      kinds = {};
      try {
        const data = JSON.parse(document.getElementById("data_do_json").textContent);
        Object.values(data.params || {}).forEach((p) => {
          if (typeof p === "string") { try { p = JSON.parse(p); } catch (e) { return; } }
          const anims = p && p.animations;
          if (!anims || typeof anims !== "object") return;
          Object.keys(anims).forEach((id) => {
            const a = anims[id], media = Object.values(a.mediaParams || {});
            kinds[id] = { trigger: a.triggerName, loop: media.some((m) => m && m.loop && m.loop !== "none") };
          });
        });
      } catch (e) {}
    };
    const sweep = () => {
      const tg = window.taptop && window.taptop.gsap;
      if (!tg || !tg.globalTimeline) return;
      if (!kinds) read();
      tg.globalTimeline.getChildren(false, false, true).forEach((tl) => {
        if (handled.has(tl)) return;
        const kind = kinds[tl.vars && tl.vars.id];
        if (!kind || kind.loop || (kind.trigger !== "HOVER" && kind.trigger !== "APPEAR_ON_SCREEN")) return;
        handled.add(tl);
        const targets = [], props = [];
        tl.getChildren(true, true, false).forEach((tw) => {
          tw.targets().forEach((t) => { if (targets.indexOf(t) < 0) targets.push(t); });
          Object.keys(tw.vars).forEach((k) => { if (!/^(ease|duration|delay|startAt|parent|immediateRender|overwrite|id|on[A-Z].*|data|lazy|runBackwards|stagger|repeat|yoyo|keyframes)$/.test(k)) props.push(k); });
        });
        try {
          if (tl.scrollTrigger) tl.scrollTrigger.kill();
          if (kind.trigger === "HOVER") tl.revert(); else tl.progress(1);
          tl.clear();
          tl.kill();
        } catch (e) {}
        targets.forEach((el) => {
          // what a Hover wrote into the block (its colour at rest) goes, so the styles can change it
          if (kind.trigger === "HOVER" && el && el.style) props.forEach((k) => el.style.removeProperty(k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())));
          const it = el && el.fmItem;
          if (!it || !live || (it.kind !== "block" && it.kind !== "tilt")) return;
          if (it.state === "done") show(it);
          else if (it.state !== "play" || (it.tween && it.tween.time() === 0)) hide(it);   // waiting, or not started yet
        });
      });
    };
    // every frame for the first 10 seconds (Taptop's own script arrives a moment after the page), then after every resize
    let until = now() + 10;
    const loop = () => { sweep(); if (now() < until) requestAnimationFrame(loop); };
    loop();
    let timer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => { const going = now() < until; until = Math.max(until, now() + 2); if (!going) loop(); }, 200);
    });
  }

  // Until Taptop's script arrives, its Appear interactions hold their blocks hidden or moved, by Taptop's own styles
  // (animation-design-styles.css). A block like that inside a tilt card or a card that comes in here would show up empty
  // (the card without its content) for that moment. So such blocks are put where their Appear would leave them, at once.
  // The blocks that come in here are left alone: hide() above takes care of them.
  function taptopRest() {
    if (!window.gsap) return;
    let data;
    try { data = JSON.parse(document.getElementById("data_do_json").textContent); } catch (e) { return; }
    const map = (data.data && data.data.tt_animation) || {}, params = data.params || {};
    Object.keys(map).forEach((elId) => {
      let p = params[map[elId]];
      if (typeof p === "string") { try { p = JSON.parse(p); } catch (e) { return; } }
      if (!p || !p.animations) return;
      Object.values(p.animations).forEach((a) => {
        const m = a.mediaParams && a.mediaParams.screen;
        if (a.triggerName !== "APPEAR_ON_SCREEN" || !m || m.disabled || (m.loop && m.loop !== "none")) return;
        const end = {};
        (m.effectIds || []).forEach((id) => {
          const e = p.effects && p.effects[id] && p.effects[id].screen;
          if (!e || e.disabled || !e.keyframes || !e.keyframes.length) return;
          const k = e.keyframes[e.keyframes.length - 1];
          if (e.name === "OPACITY") end.opacity = +k.opacity;
          if (e.name === "MOVE") { end.x = parseFloat(k.x) || 0; end.y = parseFloat(k.y) || 0; }
          if (e.name === "SCALE") end.scale = +k.scale;
          if (e.name === "ROTATE") { end.rotation = parseFloat(k.rotationZ) || 0; end.rotationX = parseFloat(k.rotationX) || 0; end.rotationY = parseFloat(k.rotationY) || 0; }
        });
        if (!Object.keys(end).length) return;
        document.querySelectorAll('[id^="' + elId + '_"]').forEach((el) => { if (!el.fmItem) gsap.set(el, end); });
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    M, css, setup, cue,
    get calm() { return calm; },
    wave: M.chars.wave,
    state: () => items.map((it) => ({ el: it.el, kind: it.kind, state: it.state }))
  };
})();

/* ═══════════ mobile menu ═══════════ */
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector(".menu-btn");
  const menu = document.querySelector(".menu-list");
  if (!btn || !menu) return;

  // Make the div behave like a real button (keyboard + screen readers)
  btn.setAttribute("role", "button");
  btn.setAttribute("tabindex", "0");
  btn.setAttribute("aria-label", "Меню");
  btn.setAttribute("aria-expanded", "false");

  // GSAP did not load (the site-wide code takes it from a CDN): the menu still opens and closes, only without the animation
  if (!window.gsap || !window.CustomEase) {
    let open = false;
    const set = (v) => { open = v; menu.classList.toggle("is-open", v); btn.setAttribute("aria-expanded", String(v)); };
    btn.addEventListener("click", (e) => { e.preventDefault(); set(!open); });
    btn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); set(!open); } });
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
    document.addEventListener("click", (e) => { if (open && !menu.contains(e.target) && !btn.contains(e.target)) set(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) set(false); });
    return;
  }

  const items = gsap.utils.toArray(menu.children); // links + button inside the menu
  const [barTop, barBottom] = btn.children;        // the two lines of the burger
  let isOpen = false;

  // Items grow from the button's corner
  gsap.set(items, { transformOrigin: "100% 0%" });

  gsap.registerPlugin(CustomEase);
  fmMotion.setup();                                // the curves of the site ("fm-settle" for the items, see "motion")
  CustomEase.create("customIn", "0.42, 0, 1, 1");
  CustomEase.create("customOut", "0, 0, 0.58, 1");

  // How far each line moves to meet the other in the middle: half the distance between their centres.
  // Measured from the layout, so it follows Taptop: lines 1px tall with a 5px gap are 6px apart, so each moves 3px.
  // If the line height or the gap is changed in Taptop, the cross still closes exactly, with no change here.
  // (3 is used while the button is hidden and cannot be measured: that is the current layout.)
  const meet = () => {
    const centre = (bar) => bar.offsetTop + bar.offsetHeight / 2;
    const half = (centre(barBottom) - centre(barTop)) / 2;
    return half > 0 ? half : 3;
  };

  const tl = gsap.timeline({
    paused: true,
    onReverseComplete: () => menu.classList.remove("is-open") // hide once fully closed
  });

  tl
    // burger → cross: the lines meet in the middle, then turn
    .to(barTop,    { y: () => meet(),  duration: 0.12, ease: "customIn" }, 0)
    .to(barBottom, { y: () => -meet(), duration: 0.12, ease: "customIn" }, 0)
    .to(barTop,    { rotation: 45,  scaleX: 1.15, duration: 0.12, ease: "customOut" }, 0.12)
    .to(barBottom, { rotation: -45, scaleX: 1.15, duration: 0.12, ease: "customOut" }, 0.12)
    // menu items pop in one after another; lower items start smaller
    .fromTo(items,
      { opacity: 0, y: -12, scale: (i) => Math.max(0.2, 0.8 - i * 0.2) },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "fm-settle", stagger: 0.06 },
      0.05
    );

  function openMenu() {
    isOpen = true;
    menu.classList.add("is-open");
    // fully closed: measure the lines again (the page may have been opened at a width where the button was hidden,
    // or turned from a phone to a tablet since)
    if (tl.progress() === 0) tl.invalidate();
    tl.timeScale(1).play();
    btn.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    isOpen = false;
    tl.timeScale(1.6).reverse(); // closing is a bit faster than opening
    btn.setAttribute("aria-expanded", "false");
  }

  const toggle = (e) => { e.preventDefault(); isOpen ? closeMenu() : openMenu(); };
  btn.addEventListener("click", toggle);
  btn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") toggle(e); });

  // Close after tapping a link, tapping outside the menu, or pressing Escape
  items.forEach((item) => item.addEventListener("click", () => { if (isOpen) closeMenu(); }));
  document.addEventListener("click", (e) => {
    if (isOpen && !menu.contains(e.target) && !btn.contains(e.target)) closeMenu();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen) closeMenu(); });

  // If the screen grows past the layout with the burger (phones and tablets, up to 991px) while open, reset instantly
  window.matchMedia("(min-width: 992px)").addEventListener("change", (e) => {
    if (e.matches && isOpen) {
      isOpen = false;
      tl.pause(0);
      menu.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
});


/* ═══════════ navbar: the colour of the section behind it ═══════════ */
/* The navbar takes the colour of the section that is behind it, at the navbar's own transparency from Taptop (70%):
   behind the first section («Весь лейбл — на одной волне») it is #EEEAE9 at 70%, behind a white part of the page white
   at 70%, behind a #F7F7F7 section #F7F7F7 at 70%, and so on, for every section of the page.
   While the edge between two sections passes behind the navbar, the colour changes with it: the change starts when the
   edge reaches the navbar's bottom edge and is complete when the edge has gone above the navbar's top edge. In between,
   the colour is mixed by how much of the navbar's height each section covers, so it follows the scroll exactly, both
   down and up (as the change at the first section did up to home-56).
     · the colour of a section is its background colour in Taptop. A background made in Taptop as a gradient of one
       colour (two stops of the same colour) counts as that colour. A picture does not: then its background colour counts;
     · a section without a colour of its own shows the page: the first background colour found from the page's wrapper
       up to <html>, else white. So a section that should look white needs no colour at all;
     · where sections overlap (the card stack is pulled up under the hero, and the section after it under the last card),
       the lower one on the page is drawn over the upper one, as the browser draws them; one without a colour lets the
       colour under it show. The cards themselves are not sections: the navbar does not take their colour;
     · the colours are read once, and again when the screen changes size (Taptop can give a section another colour at
       another width) and when the page has loaded; fmNavTint.refresh() in the console reads them again.
   Nothing here needs GSAP. If the script does not run, the navbar keeps its colour from Taptop. */
document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector("nav");                        // the navbar (the first <nav> on the page)
  if (!nav) return;
  navCap(nav);                                           // see "navbar cap" below
  navTint([...document.querySelectorAll("nav")]);        // every <nav>: the second one is hidden in Taptop and is skipped while it is
});

function navTint(navs) {
  // "rgb(1, 2, 3)", "rgba(1, 2, 3, 0.5)", "rgb(1 2 3 / 50%)" → [r, g, b, a]; anything else → null
  const parse = (s) => {
    const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)/.exec(s || "");
    if (!m) return null;
    const a = m[4] === undefined ? 1 : m[5] ? m[4] / 100 : +m[4];
    return [+m[1], +m[2], +m[3], a];
  };
  // a colour that can be seen: [r, g, b, a] with a > 0, else null
  const seen = (c) => (c && c[3] > 0.001 ? c : null);
  // the colour of a block: a gradient of one colour over it (Taptop's way of a flat colour in a background layer),
  // else its background colour; a picture or a gradient of several colours does not count
  const colourOf = (el) => {
    const css = getComputedStyle(el), img = css.backgroundImage;
    if (img && img !== "none" && !/url\(/.test(img)) {
      const stops = (img.match(/rgba?\([^)]*\)/g) || []).map(parse);
      if (stops.length && stops.every((c) => c && c.join() === stops[0].join()) && stops[0][3] >= 0.999) return stops[0];
    }
    return seen(parse(css.backgroundColor));
  };
  // c laid over under (both [r, g, b, a]; under is opaque)
  const over = (c, under) => c[3] >= 0.999 ? c : [0, 1, 2].map((i) => c[i] * c[3] + under[i] * (1 - c[3])).concat(1);

  let page = [255, 255, 255, 1], sections = [], alpha = new Map(), queued = 0;
  navs.forEach((nav) => {
    const c = parse(getComputedStyle(nav).backgroundColor);      // Taptop's colour, before this script sets its own
    alpha.set(nav, c ? c[3] : 0.7);
  });

  const read = () => {
    // the page: the first colour from the wrapper of the sections up to <html>
    page = [255, 255, 255, 1];
    for (let n = document.querySelector(".mosaic-wrap") || document.body; n && n.nodeType === 1; n = n.parentElement) {
      const c = seen(parse(getComputedStyle(n).backgroundColor));
      if (c) { page = over(c, [255, 255, 255, 1]); break; }
    }
    // the sections (not a section inside another one), in the order of the page, with the colours they have
    sections = [...document.querySelectorAll("section")]
      .filter((el) => !el.parentElement.closest("section"))
      .map((el) => ({ el, c: colourOf(el) }))
      .filter((s) => s.c);
  };

  const paint = () => {
    queued = 0;
    // where each coloured section is on screen now (the sticky, pinned and moved ones too)
    const boxes = sections.map((s) => { const r = s.el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, c: s.c }; });
    navs.forEach((nav) => {
      const r = nav.getBoundingClientRect();
      if (r.height <= 0) return;                                    // hidden
      const top = r.top, bottom = r.bottom;
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
        boxes.forEach((b) => { if (b.top <= y && b.bottom > y) c = over(b.c, c); });   // later sections over earlier ones
        for (let j = 0; j < 3; j++) sum[j] += c[j] * h;
      }
      const h = bottom - top;
      const v = "rgba(" + sum.map((s) => Math.round(s / h)).join(", ") + ", " + alpha.get(nav) + ")";
      if (nav.fmTint !== v) { nav.fmTint = v; nav.style.backgroundColor = v; }
    });
  };

  const later = () => { if (!queued) queued = requestAnimationFrame(paint); };
  const refresh = () => { read(); later(); };
  refresh();
  window.addEventListener("scroll", later, { passive: true });
  window.addEventListener("resize", refresh);
  window.addEventListener("load", refresh);
  if (window.ResizeObserver) new ResizeObserver(later).observe(document.body);   // the page grew or shrank (pictures, the card stack, a pinned block)
  if (window.ScrollTrigger) ScrollTrigger.addEventListener("refresh", later);     // pinned blocks were measured and placed again
  window.fmNavTint = { refresh };
}


/* ═══════════ navbar cap: the strip above the navbar in the browsers built into apps ═══════════ */
/* Telegram's browser on iPhone (and a few other apps' browsers) lays the page out below its own floating buttons
   (✕, the address, ⋯), but lets the page scroll on behind them. The navbar is fixed to the top of that layout, so it sat
   below the buttons, and in the strip behind them the page was seen scrolling by, with nothing to cover it.
   Telegram draws only the ordinary content of the page in that strip: nothing fixed and nothing sticky, not even a block
   that reaches down onto the page (all three were tried in home-32…34, with ?fmcap=debug).
   So the cap is ordinary content. It is an empty block above the top of the page (CAP_PX tall, reaching OVERLAP px under
   the navbar), plain white (CAP_COLOR), and the
   browser moves it down exactly as far as the page has scrolled: a scroll-driven animation, the same kind as the card
   sections in home.css (see "the bottom bar of Safari" there). It therefore always lies right above the navbar, and in
   such a browser fills the strip behind the buttons with white. In every other browser it is
   above the top edge of the screen and is never seen.
   The animation runs over the whole scroll of the page and moves the block by --fm-cap-max, which the script keeps equal
   to how far the page can scroll (measured again whenever the page or the screen changes height), so it follows the
   scroll 1 : 1.
   Two things the animation cannot do, the script does (on every scroll event and every resize, see fix):
     · it puts the cap exactly where it belongs. The animation alone was off in two places: past the ends of the page
       (iOS pulls the whole page further and lets it spring back, while the animation stops at its end), and at the
       bottom of the page in Telegram, where its bars come back, the page can scroll further, and the animation's own
       range did not follow (the strip was about 80px too high there). So the script measures where the cap is on the
       screen and moves it by what is missing (its "translate", which adds to the animation's transform);
     · iOS does not tell the page when it is pulled past its end (the springy "bounce"): neither the scroll position nor
       the layout shows it, so nothing can follow it, and the cap was carried up with the page, as far as it was pulled.
       So in the browsers built into apps (they have window.webkit.messageHandlers, Safari has not) the bounce is turned
       off while the last screen of the page is shown (overscroll-behavior on <html>), and on again above it. The top of
       the page keeps its bounce (Telegram may use the pull at the top to close its browser), and Safari keeps it everywhere;
     · the browser moves the cap a frame or two after the page itself, so while scrolling down quickly it lagged a few px
       above the navbar and the page showed between them. While scrolling down, the cap reaches DOWN_EXTRA px further
       under the navbar, which hides that lag; once the scrolling stops, it is back to OVERLAP. (Not while scrolling up:
       then the lag pushes the cap lower, and the extra part could show below the navbar.)
   It does not touch the bottom of the screen, and it is neither fixed nor sticky, so Safari's bottom bar is not affected.
   Nor does it change the navbar itself, so the measurements of the colour change above stay as they were.
   Only on phones and tablets (as the "steady screen height" code in "inside head"), and only in browsers that can do
   scroll-driven animations (Telegram's can: it is the Safari engine).
   Test mode: open the page with ?fmcap=debug at the end of its address: the cap is then bright red,
   a yellow line marks the top edge of the page, and a box shows what the browser reports. Nothing changes without it. */
function navCapDebug(touch) {
  const add = (css) => { const el = document.createElement("div"); el.style.cssText = "position:fixed;pointer-events:none;z-index:2147483600;" + css; document.body.appendChild(el); return el; };
  add("left:0;right:0;top:0;height:3px;background:#ffd400");
  const box = add("left:8px;top:60px;max-width:calc(100% - 16px);padding:6px 8px;border-radius:6px;background:rgba(0,0,0,.8);color:#fff;font:11px/1.35 monospace;text-align:left");
  const show = () => {
    const cap = document.querySelector(".fm-nav-cap"), r = cap && cap.getBoundingClientRect();
    box.innerText = [
      "fmcap debug · home-58",
      "touch: " + touch + "   scroll-driven: " + !!(window.CSS && CSS.supports("animation-timeline: scroll()")),
      "inner: " + innerWidth + "×" + innerHeight + "   scrollY: " + Math.round(scrollY),
      "cap: " + (r ? Math.round(r.top) + "…" + Math.round(r.bottom) + " (should end at 1)" : "none"),
      "can scroll: " + (document.documentElement.scrollHeight - document.documentElement.clientHeight) + "   cap travel: " + (cap ? cap.style.getPropertyValue("--fm-cap-max") : "none"),
      "correction: " + (cap ? cap.style.translate || "0" : "none") + "   height: " + (cap ? cap.style.height : "none"),
      "in an app: " + !!(window.webkit && window.webkit.messageHandlers) + "   bounce off: " + (document.documentElement.style.overscrollBehaviorY === "none")
    ].join("\n");
  };
  setTimeout(show, 0);                      // once the cap is on the page
  addEventListener("scroll", show, { passive: true });
  addEventListener("resize", show);
}

function navCap(nav) {
  const CAP_PX = 240;                       // how far up it reaches: more than any app's buttons take
  const OVERLAP = 1;                        // how far down it reaches under the navbar (white under its edge: kept to 1px)
  const CAP_COLOR = "#ffffff";              // its colour: plain white, no glass
  const DOWN_EXTRA = 40;                    // while scrolling down: px it reaches further under the navbar (less than the navbar's 56)
  const IDLE_MS = 160;                      // the scrolling counts as stopped after this long without a scroll event
  const DEBUG = /[?&]fmcap=debug\b/.test(location.search);
  const touch = !!window.matchMedia && matchMedia("(hover: none) and (pointer: coarse)").matches;
  if (DEBUG) navCapDebug(touch);
  if (!touch && !DEBUG) return null;
  if (!window.CSS || !CSS.supports("animation-timeline: scroll()")) return null;

  const keyframes = document.createElement("style");
  keyframes.textContent = "@keyframes fm-nav-cap { from { transform: translateY(0); } to { transform: translateY(var(--fm-cap-max, 0px)); } }";
  document.head.appendChild(keyframes);

  const css = getComputedStyle(nav);
  const cap = document.createElement("div");
  cap.className = "fm-nav-cap";
  cap.setAttribute("aria-hidden", "true");
  // the animation shorthand first: it resets animation-timeline and animation-range, which are set after it
  cap.style.cssText = "position:absolute;left:0;width:100%;pointer-events:none;margin:0;"
    + "top:" + (-CAP_PX) + "px;height:" + (CAP_PX + OVERLAP) + "px;"
    + "animation:fm-nav-cap 1ms linear both;animation-timeline:scroll(root block);";
  cap.style.zIndex = css.zIndex === "auto" ? "" : css.zIndex;   // the navbar's layer; it comes first on the page, so the navbar lies over its last px
  cap.style.backgroundColor = DEBUG ? "#ff0033" : CAP_COLOR;
  if (DEBUG) cap.style.zIndex = "2147483000";
  document.body.insertBefore(cap, document.body.firstChild);

  // The cap follows the navbar's top edge (0 in Taptop) and is hidden when the navbar is not fixed.
  // Its travel is how far the page can scroll: measured again whenever the page or the screen changes height
  // (fonts, pictures, the pinned logos, the app's bars collapsing or coming back).
  const root = document.documentElement;
  let queued = 0, max = 0;
  const place = () => {
    queued = 0;
    const fixed = getComputedStyle(nav).position === "fixed";
    cap.style.display = fixed ? "" : "none";
    if (!fixed) return;
    navTop = Math.round(nav.getBoundingClientRect().top);
    cap.style.top = (navTop - CAP_PX) + "px";
    max = Math.max(0, root.scrollHeight - root.clientHeight);
    cap.style.setProperty("--fm-cap-max", max + "px");
    fix();
    bounce();
  };

  // the cap where it belongs, and the lag while scrolling down (see above)
  let lastY = window.scrollY, down = false, idle = 0, shift = 0, navTop = 0, still = false;
  const inApp = !!(window.webkit && window.webkit.messageHandlers);
  // in an app's browser: no bounce while the last screen of the page is shown (see above)
  const bounce = () => {
    if (!inApp) return;
    const off = window.scrollY > max - window.innerHeight;
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
  const onScroll = () => {
    const y = window.scrollY;
    fix();
    bounce();
    const nowDown = y > lastY;
    lastY = y;
    if (nowDown !== down) { down = nowDown; reach(down ? DOWN_EXTRA : 0); }
    clearTimeout(idle);
    idle = setTimeout(() => { fix(); if (down) { down = false; reach(0); } }, IDLE_MS);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  const later = () => { if (!queued) queued = requestAnimationFrame(place); };
  place();
  window.addEventListener("resize", place);
  window.addEventListener("load", later);
  if (window.visualViewport) visualViewport.addEventListener("resize", place);
  if (window.ResizeObserver) new ResizeObserver(later).observe(document.body);
  return cap;
}


/* ═══════════ navbar pill: the outline of the current link slides to the link of the section on screen ═══════════ */
/* While the page scrolls, the pill (the outline around «Продукт» in Taptop) moves to the link of the section that has
   been reached. A longer way takes longer: the next link takes about 0.35s, the whole row 0.65s, and every move in
   between is in proportion to its distance. On the way the pill takes the width of each link.
   Nothing about the links is written here, so they are changed in Taptop only:
     · a link takes part when it has the class nav-link and its link is an anchor to a block on this page (#…).
       A link to another page, or to an anchor that is not on the page, keeps its place in the row but never gets the pill;
     · the links of one parent block share one pill. Links in different wrappers can share one too: give the block that
       holds them all the class nav-pill-track;
     · what the pill looks like is the class nav-link-active (its border, background and shadow) at each screen width.
       The script moves that class to the current link, so the colour of its text keeps working, and the class's own
       border is hidden there (in home.css, "navbar pill"), as the pill draws it now;
     · the current link keeps the text colour of nav-link-active while the mouse is over it: the hover interaction of the
       links in Taptop changes the colour by writing it into the link (an inline style), and home.css holds the current
       link at the class's colour (--fm-navpill-ink, read here) over that. The other links change on hover as before;
     · a link that is hidden at some width is skipped there; while the section of a hidden link is on screen, the pill
       fades out;
     · a section without a link of its own (the card stack, for one) keeps the pill on the link above it.
   A block counts as reached when its top has come up to LINE: 0.4 = 40% of the way from the navbar's bottom edge down
   to the bottom of the screen. At the very bottom of the page the last section with a link is reached whatever its size.
   After a click on a link, the pill goes straight there and waits until the page has stopped scrolling, instead of
   stopping at every section on the way.
   The numbers below can also be set for one row of links in Taptop, as attributes of the links' parent block:
   data-pill-min, data-pill-max, data-pill-ease, data-pill-line.
   With "reduce motion" the pill jumps instead of sliding. Without this script the outline stays where Taptop puts it.
   fmNavPill.refresh() in the console reads the links again. */
(() => {
  const SET = {
    min: 250,                               // ms: the shortest move (two links side by side get a little more than this)
    max: 650,                               // ms: a move across the whole row
    ease: fmMotion.css.move,                // slow start, slow arrival (the curve "move" of the motion system)
    line: 0.4                               // where a section counts as reached (see above)
  };
  const LINK = "nav-link", ACTIVE = "nav-link-active", TRACK = ".nav-pill-track";
  const calm = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  let rows = [], queued = 0;

  const shown = (el) => el.offsetWidth > 0 || el.offsetHeight > 0;
  const num = (v, fallback) => (v != null && v !== "" && isFinite(v) ? +v : fallback);

  // the block a link leads to: the part of its href after # (Taptop writes the full address in front of it)
  const target = (a) => {
    const href = a.getAttribute("href") || "", i = href.indexOf("#");
    if (i < 0 || i === href.length - 1) return null;
    let id = href.slice(i + 1);
    try { id = decodeURIComponent(id); } catch (e) {}
    return document.getElementById(id);
  };

  // every row of links gets its own pill (and a hidden copy of a link with nav-link-active, to read the look from)
  function build() {
    const groups = new Map();
    document.querySelectorAll("." + LINK).forEach((a) => {
      if (a.classList.contains("fm-navpill-probe")) return;
      const host = a.closest(TRACK) || a.parentElement;
      if (!host) return;
      if (!groups.has(host)) groups.set(host, []);
      groups.get(host).push({ a, sec: target(a) });
    });
    groups.forEach((items, el) => {
      if (!items.some((it) => it.sec)) return;
      const d = el.dataset;
      const row = {
        el, items,
        bar: el.closest("nav, header") || el,   // the navbar: its bottom edge is where "reached" is measured from
        set: {
          min: num(d.pillMin, SET.min),
          max: num(d.pillMax, SET.max),
          ease: d.pillEase || SET.ease,
          line: Math.min(1, Math.max(0, num(d.pillLine, SET.line)))
        },
        pill: document.createElement("div"),
        probe: document.createElement("span"),
        cur: null, box: null, span: 1, lock: null, lockTimer: 0, lockStart: 0
      };
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.classList.add("fm-navpill-host");
      row.pill.className = "fm-navpill";
      row.pill.setAttribute("aria-hidden", "true");
      row.probe.className = LINK + " " + ACTIVE + " fm-navpill-probe";
      row.probe.setAttribute("aria-hidden", "true");
      row.pill.appendChild(row.probe);
      el.appendChild(row.pill);
      items.forEach((it) => {
        it.a.classList.add("fm-navpilled");
        it.a.fmNavPill = it.sec ? row : null;
        if (it.a.fmNavPillBound) return;              // one listener per link, also after refresh()
        it.a.fmNavPillBound = true;
        it.a.addEventListener("click", (e) => {
          const own = it.a.fmNavPill;
          if (!own || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          lockTo(own, it.a);
        });
      });
      if (window.ResizeObserver) {
        row.ro = new ResizeObserver(() => settle(row));
        row.ro.observe(el);
        items.forEach((it) => row.ro.observe(it.a));
      }
      rows.push(row);
    });
  }

  // the look of the pill: the border, background and shadow of nav-link-active at this screen width,
  // and the colour of its text, which the current link keeps on hover (see home.css)
  function look(row) {
    const css = getComputedStyle(row.probe), p = row.pill.style;
    row.el.style.setProperty("--fm-navpill-ink", css.color);
    p.borderStyle = css.borderTopStyle;
    p.borderWidth = css.borderTopWidth;
    p.borderColor = css.borderTopColor;
    p.backgroundColor = css.backgroundColor;
    p.backgroundImage = css.backgroundImage;
    p.boxShadow = css.boxShadow;
  }

  // where a link is in its row, in the row's own px (right even while the navbar is scaled); its corners are its own
  function measure(row, a) {
    const r = a.getBoundingClientRect(), c = row.el.getBoundingClientRect();
    let k = row.el.offsetWidth ? c.width / row.el.offsetWidth : 1;
    if (!k) k = 1;
    return {
      x: (r.left - c.left) / k - row.el.clientLeft,
      y: (r.top - c.top) / k - row.el.clientTop,
      w: a.offsetWidth, h: a.offsetHeight,
      r: getComputedStyle(a).borderTopLeftRadius
    };
  }

  // the longest way in the row (between the centres of the two links furthest apart): a move this long takes SET.max
  function spanOf(row) {
    const pts = row.items.filter((it) => it.sec && shown(it.a)).map((it) => {
      const b = measure(row, it.a);
      return [b.x + b.w / 2, b.y + b.h / 2];
    });
    let s = 1;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) s = Math.max(s, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
    return s;
  }

  function place(p, b) {
    p.style.width = b.w + "px";
    p.style.height = b.h + "px";
    p.style.borderRadius = b.r;
    p.style.transform = "translate(" + b.x + "px, " + b.y + "px)";
  }

  // the current link gets nav-link-active (the colour of its text in Taptop), and aria-current for screen readers
  function mark(row, a) {
    row.items.forEach((it) => {
      const on = it.a === a;
      it.a.classList.toggle(ACTIVE, on);
      if (on) it.a.setAttribute("aria-current", "location"); else it.a.removeAttribute("aria-current");
    });
  }

  // a: the link to go to (null: none, the pill fades out); now: at once, without sliding
  function go(row, a, now) {
    const p = row.pill;
    if (a === row.cur && !now) return;
    mark(row, a);
    if (!a) {
      p.style.transition = "opacity 0.25s ease";
      p.style.opacity = "0";
      row.cur = null; row.box = null;
      return;
    }
    const b = measure(row, a);
    if (now || !row.box || calm.matches) {
      // it was not shown: it appears in place (fading in), it does not slide in from somewhere
      const appear = !row.box && !now && !calm.matches && p.style.opacity !== "1";
      p.style.transition = "none";
      place(p, b);
      if (appear) { p.style.opacity = "0"; void p.offsetWidth; p.style.transition = "opacity 0.25s ease"; }
      p.style.opacity = "1";
    } else {
      const { min, max, ease } = row.set;
      const far = Math.hypot(b.x + b.w / 2 - (row.box.x + row.box.w / 2), b.y + b.h / 2 - (row.box.y + row.box.h / 2));
      const ms = Math.round(min + (max - min) * Math.min(1, far / row.span));
      p.style.transition = ["transform", "width", "height", "border-radius"].map((k) => k + " " + ms + "ms " + ease).join(", ")
        + ", opacity 0.25s ease";
      place(p, b);
      p.style.opacity = "1";
    }
    row.cur = a; row.box = b;
  }

  // the link whose section has been reached: of the sections whose top has come up to the line, the lowest one
  function pick(row) {
    const top = Math.max(0, row.bar.getBoundingClientRect().bottom);
    const vh = window.innerHeight;
    const line = top + (vh - top) * row.set.line;
    const end = Math.ceil(window.scrollY + vh) >= document.documentElement.scrollHeight - 2;
    let best = null, bestTop = -Infinity;
    row.items.forEach((it) => {
      if (!it.sec || !shown(it.a)) return;
      const r = it.sec.getBoundingClientRect();
      if (!r.width && !r.height) return;
      if ((r.top <= line || (end && r.top < vh)) && r.top > bestTop + 0.5) { best = it.a; bestTop = r.top; }
    });
    return best;
  }

  function update() {
    queued = 0;
    rows.forEach((row) => { if (!row.lock && shown(row.el)) go(row, pick(row)); });
  }
  const later = () => { if (!queued) queued = requestAnimationFrame(update); };

  // after a click: straight to that link, then wait until the scrolling has stopped for 0.2s (at most 4s)
  function lockTo(row, a) {
    row.lock = a;
    row.lockStart = Date.now();
    go(row, a);
    clearTimeout(row.lockTimer);
    row.lockTimer = setTimeout(() => release(row), 500);   // the page did not scroll at all (already there)
  }
  function release(row) {
    row.lock = null;
    clearTimeout(row.lockTimer);
    later();
  }
  function onScroll() {
    rows.forEach((row) => {
      if (!row.lock) return;
      clearTimeout(row.lockTimer);
      if (Date.now() - row.lockStart > 4000) release(row);
      else row.lockTimer = setTimeout(() => release(row), 200);
    });
    later();
  }

  // the layout changed (fonts, screen width, a breakpoint): the look is read again, the pill goes back under its link at once
  function settle(row) {
    look(row);
    row.span = spanOf(row);
    if (row.cur && !shown(row.cur)) go(row, null);
    else if (row.cur) go(row, row.cur, true);
    later();
  }

  function boot() {
    build();
    if (!rows.length) return;
    document.documentElement.classList.add("fm-navpill-on");   // from now on the pill draws the outline (see home.css)
    rows.forEach((row) => {
      look(row);
      row.span = spanOf(row);
      if (shown(row.el)) go(row, pick(row), true);
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => rows.forEach(settle), { passive: true });
    window.addEventListener("load", () => rows.forEach(settle));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => rows.forEach(settle));
  }

  window.fmNavPill = {
    refresh() {
      rows.forEach((row) => {
        if (row.ro) row.ro.disconnect();
        row.pill.remove();
        row.items.forEach((it) => it.a.classList.remove("fm-navpilled"));
      });
      rows = [];
      build();
      rows.forEach((row) => { look(row); row.span = spanOf(row); go(row, pick(row), true); });
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();


/* ═══════════ main landmark ═══════════ */
// Taptop builds the page out of divs, so there is no <main>. Screen readers use it to jump to the content,
// and PageSpeed's accessibility check asks for it: the block that holds the whole page is marked as the main content.
document.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector("main, [role='main']")) return;
  const page = document.querySelector(".mosaic-wrap > .root") || document.querySelector(".mosaic-wrap");
  if (page) page.setAttribute("role", "main");
});


/* ═══════════ card stack: «Управление», «Документы», «Финансы» ═══════════ */
/* The three cards live in one section (class fm-cards) and take turns on one screen while the page scrolls by.
   (Up to home-45 they grew from a small pill and back, drawn from six moving pieces; home-46…48 kept that as ?fmlook=stack.)
     · the smallest a card gets is as wide as the card and as tall as its label with the card's top padding above and
       below it (the padding of fm-card-text in Taptop). Nothing in the card moves or changes its size: the label stays
       where Taptop puts it, and the corners are always the card's own (Taptop's border-radius). With a radius of half
       that height and the same padding on the left as on the top, the smallest card is a perfect pill (?fmcards=debug
       says whether it is);
     · every edge moves with the scroll, px for px (SET.speed), with no easing and no fading: the cards never move by
       themselves and never change their opacity;
     · the first card comes up with the page from under the section above, as the smallest card. Once all of it is on
       screen its bottom edge stays at the bottom of the stage and its top keeps coming up with the page: it grows until
       it fills the stage;
     · while it fills the stage it goes through its steps: one title and one illustration per step; the label fills from
       the left (the progress);
     · then the next card comes up from the bottom in the same way, the gap of the stage under the old one. The old card
       gives it the room: its top stays, its bottom edge goes up as fast as the new card comes, so the two of them and
       the gap between them always fill the stage. The old card's content stays where it is (the card is a window that
       shows less of it); its label turns white. Once it is the smallest card it does not stop: it goes on up with the
       page and leaves the screen under the navbar, like anything else that is scrolled away. The new card fills the
       stage the moment its top reaches the top;
     · the last card does the same for the section after the stack: when its steps are done, that section comes up from
       the bottom, the stage's gap under the card, and the card gives it room until it is the smallest card; then it is
       scrolled away with the page. (The stage stays pinned for that much longer: the section is that much taller, and
       the section after it is pulled up by as much, --fm-tail in home.css. The rest of the page does not move.)
   A title is shown while the open part of its card reaches below it (with the card's padding under it); an illustration
   once the card is SET.artAt of its full height.

   How it moves, so that it stays smooth on phones:
     · everywhere ("native": phones and tablets from home-50, computers from home-56): the browser moves the cards
       itself, with the page, like any other
       block: nothing is moved by the script or by an animation, so nothing can lag behind the page or shake.
       Each card is sticky (it stays under the navbar) in a block of its own (fm-slot, made by the script) that is as
       tall as the scroll the card stays for; the next slot overlaps it from below, so the next card comes up over the
       old one. The gap between them and the rounded bottom corners of the old card are drawn over it: a strip in the
       colour of the page above every card but the first (fm-collar), with the card's corners cut out of it. The same
       strip stands at the bottom of the screen (fm-mask, in fm-frame: one screen tall and sticky), so a card that comes
       up ends the gap above the bottom of the screen, with rounded corners, as before. The heights of the slots are
       written in --fm-vh, so they follow the steady screen height by themselves.
       (Up to home-49 phones had "follow": the script set where every card should be and a short CSS transition took
       it there. The cards lagged behind the page and shook, and as the position and the cut of a card were played
       apart, two cards overlapped for a moment while they traded places. It can still be compared: ?fmcards=follow.);
     · nothing is laid out again while scrolling: on computers a card is only moved (transform) and cut to its shape by
       a clip-path (inset … round …) on the card itself, which keeps its own background from Taptop;
     · "follow" (only with ?fmcards=follow): on every scroll update (at most every SET.every seconds) the script sets
       where every card should be, and a short CSS transition (SET.follow) takes it there;
     · "css" (computers up to home-55; now only with ?fmcards=css): all of it is written once, as CSS keyframes along
       the scroll of the section (measured again
       whenever ScrollTrigger measures the page), and the browser plays them as the page scrolls, tied to it exactly.
       Where that is not possible, the script writes the same values on every scroll update ("js");
     · the script itself only decides, on scroll, what is shown and what not: which title (with its own timed animation,
       by lines), whose turn it is among the illustrations (the class fm-turn; they fade as before, see "section
       illustrations"), the white label, and which illustrations can be put to sleep.
   To compare the ways anywhere: add ?fmcards=native, ?fmcards=follow, ?fmcards=css or ?fmcards=js to the address
   (and fmcards=debug, with &).

   The structure, in Taptop (the classes are the ones this script and home.css look for; the look is all Taptop's):
     Section .fm-cards                      no height, no padding: the script sets the height
       Div .fm-cards-stage                  its padding (left, right, bottom) is the space around the cards and between them
         Div .fm-card   (as many as needed) the colour, the corners, max-width; it is stretched to fill the stage
           Div .fm-card-text                the left column: the label and the titles; its padding is the card's padding
             Div .fm-tag                    the label: a pill with a border
               Text .fm-tag-label
             Div .fm-card-titles
               Text .fm-card-title          one per step
           Div .fm-card-art                 the illustrations, one per step, in the same order as the titles
             Div .art-s11 …                 the illustration blocks, as before
   A card has as many steps as it has titles (or illustrations, if there are more of those).
   To try values in the console: fmCards.settings.step = 0.5, then fmCards.update(). If GSAP did not load, the class
   fm-cards-on is never set and the cards simply stand one under another, as laid out in Taptop. */
document.addEventListener("DOMContentLoaded", () => {
  const section = document.querySelector(".fm-cards");
  const stage = section && section.querySelector(".fm-cards-stage");
  if (!stage || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  const SET = {
    step: 0.7,             // scroll for one step of a card (a title and its illustration), in screen heights
    speed: 1,              // while two cards trade places: px they move per px of scroll (1 = with the page; 0.5 = twice the scroll)
    artAt: 0.5,            // a card shows its illustration once it is this tall (0…1 of its full height)
    artWake: 0.3,          // a card that leaves lets its illustration go below this height (0…1); one that comes is made ready at once
    title: { in: 0.75, out: 0.35, stagger: 0.08, rise: 70, lift: 45 },  // the titles: seconds, and how far the lines travel (% of a line)
    follow: 0.2,           // "follow" only (phones): how long each card takes to get to where the scroll has put it, in seconds…
    every: 0.04            // …and how often (at most) it is told where that is, in seconds
  };
  const STILL = window.matchMedia("(prefers-reduced-motion: reduce)").matches;   // the titles then change at once
  // How the cards are moved (see "How it moves" above):
  //   native  everywhere (computers too, from home-56): sticky cards, moved by the browser with the page;
  //   follow  the script sets where every card should be on each scroll update, and a short CSS transition
  //           (SET.follow) takes it there (?fmcards=smooth or ?fmcards=follow; phones had it up to home-49);
  //   css     the browser plays keyframes along the scroll (?fmcards=css; computers had it up to home-55: Chrome cut the
  //           cards by their clip-path a moment after it had moved them, so their edges trailed behind the page);
  //   js      the script writes every card on every update, tied to the scroll (?fmcards=js; also where "css" is not possible).
  const ASK = (location.search.match(/[?&]fmcards=(css|js|smooth|follow|native)\b/) || [])[1];
  const CAN_CSS = !!(window.CSS && CSS.supports && CSS.supports("animation-timeline: view()") && CSS.supports("animation-range: contain 0px contain 100px"));
  const MODE = ASK === "smooth" || ASK === "follow" ? "follow" : ASK === "js" ? "js" : ASK === "css" ? (CAN_CSS ? "css" : "js")
    : "native";                                              // everywhere, computers included (from home-56)
  const BY_CSS = MODE === "css", FOLLOW = MODE === "follow", NATIVE = MODE === "native";
  if (NATIVE) SET.speed = 1;                                 // the cards move with the page: px for px
  const nav = document.querySelector("nav");
  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const n2 = (v) => +(+v).toFixed(2);

  // ── the cards ──
  const cards = [...stage.querySelectorAll(".fm-card")].map((el) => {
    const tag = el.querySelector(".fm-tag");
    const titles = [...el.querySelectorAll(".fm-card-title")].map((title) => ({ el: title, lines: [title], on: false, size: null }));
    const artBox = el.querySelector(".fm-card-art");
    const arts = artBox ? [...artBox.children] : [];
    const c = {
      el, tag, titles, arts, artBox,
      bg: getComputedStyle(el).backgroundColor,              // the card's colour (home.css keeps it as --fm-card-bg)
      label: null, copy: null, fill: null, done: null,
      steps: Math.max(1, titles.length, arts.length),
      m: {}, title: -1, turn: -1, off: null, asleep: null, white: null
    };
    el.style.setProperty("--fm-card-bg", c.bg);
    if (tag) {
      c.label = tag.querySelector(".fm-tag-label") || tag.firstElementChild;
      // two layers made here: the progress (fills it from the left) and the white label (fades in when the card is done)
      c.fill = document.createElement("span");
      c.fill.className = "fm-tag-fill";
      c.done = document.createElement("span");
      c.done.className = "fm-tag-done";
      c.done.style.setProperty("--fm-ink", c.bg);            // the text of the white label: the card's colour
      if (c.label) {
        c.copy = c.label.cloneNode(true);
        [c.copy, ...c.copy.querySelectorAll("[id]")].forEach((n) => n.removeAttribute("id"));
        c.done.appendChild(c.copy);
      } else c.done.textContent = tag.textContent.trim();
      [c.fill, c.done].forEach((n) => n.setAttribute("aria-hidden", "true"));
      tag.prepend(c.fill);
      tag.appendChild(c.done);
    }
    return c;
  });
  if (!cards.length) return;
  section.classList.add("fm-cards-on");
  if (FOLLOW) { section.classList.add("fm-follow"); section.style.setProperty("--fm-follow", SET.follow + "s"); }
  // ?fmpin=scroll: on iPhones and iPads, the stage is moved by the scroll instead of sticky (to compare the two, see home.css)
  if (/[?&]fmpin=scroll\b/.test(location.search)) section.classList.add("fm-pin-scroll");

  // ── "native" (phones and tablets): the blocks the browser moves by itself (see "How it moves" above, and home.css) ──
  //   fm-frame   one screen tall, sticky at the top of the screen from the moment the section comes up; it holds fm-mask,
  //              the strip at the bottom of the screen that ends a card the gap above the bottom, with rounded corners;
  //   fm-slot    one per card, around it: the card is sticky in it, so the slot's height is how long the card stays;
  //   fm-collar  above every card but the first: the gap over it and the rounded bottom corners of the card it covers;
  //              the last one (fm-collar-end) is at the bottom of the section, above the section after the stack;
  //   fm-cap     under every card but the first, sticky with it: the page colour around its top corners. The card
  //              before it is as tall as ever under it (only covered), and once the collar has gone up with the slot,
  //              it showed in those corners for as long as the card stayed (home-50). Once nothing of a card is seen
  //              any more (is-off, see draw), it is hidden altogether: it no longer shows under the navbar either.
  //   (home-53) A card that comes up is cut to the smallest card by itself while it is that small (is-pill), and fm-mask
  //   is hidden meanwhile, so it is not cut by the strip. (home-52 tried a strip of its own under every card, sticky:
  //   on an iPhone those strips were put in the wrong places and covered the cards, and Safari coloured its bottom bar.)
  // Their sizes are set by measure() below.
  const native = NATIVE ? { frame: null, mask: null, end: null, after: null } : null;
  if (NATIVE) {
    section.classList.add("fm-native");
    const div = (cls) => { const n = document.createElement("div"); n.className = cls; n.setAttribute("aria-hidden", "true"); return n; };
    native.frame = div("fm-frame");
    native.mask = div("fm-collar fm-mask");
    native.frame.appendChild(native.mask);
    stage.prepend(native.frame);
    cards.forEach((c, i) => {
      c.slot = div("fm-slot");
      c.slot.removeAttribute("aria-hidden");
      c.el.before(c.slot);
      c.slot.appendChild(c.el);
      if (i) {
        c.cap = div("fm-cap");
        c.slot.prepend(c.cap);
        c.collar = div("fm-collar");
        c.slot.prepend(c.collar);
      }
    });
    native.end = div("fm-collar fm-collar-end");
    stage.appendChild(native.end);
    // The colour of the page (the strips are painted in it): the first background found from the section up, else white
    let bg = "", n = section;
    for (; n && n.nodeType === 1; n = n.parentElement) {
      const b = getComputedStyle(n).backgroundColor;
      if (b && b !== "transparent" && !/rgba\(.*,\s*0\)$/.test(b)) { bg = b; break; }
    }
    section.style.setProperty("--fm-page", bg || "#fff");
    // The section after the stack comes up over the last card, which stays whole under it: it needs a background of
    // its own, and must be drawn above the section of the cards (position).
    native.after = section.nextElementSibling;
    if (native.after) {
      const css = getComputedStyle(native.after), b = css.backgroundColor;
      if (!b || b === "transparent" || /rgba\(.*,\s*0\)$/.test(b)) native.after.style.backgroundColor = bg || "#fff";
      if (css.position === "static") native.after.style.position = "relative";
    }
  }

  // The height of the section: one screen for the stage itself, one for the first card to grow (while the section above
  // goes away), the steps of every card; between two cards, the height of the stage without the navbar (one screen -
  // --fm-nav) divided by SET.speed; and the scroll for the last card to give room to the section after it (--fm-tail, px,
  // measured). In screen heights, so it follows the steady screen height on phones (--fm-vh, see "inside head").
  const screens = () => 2 + cards.reduce((sum, c) => sum + c.steps * SET.step, 0);
  const vh = (n) => {
    const k = (cards.length - 1) / SET.speed;
    return "calc(" + ((n + k) * 100).toFixed(3) + " * var(--fm-vh, 1vh) - " + k.toFixed(4) + " * var(--fm-nav, 64px) + var(--fm-tail, 0px))";
  };
  function size() {
    if (NATIVE) return;                                      // "native": the slots give the section its height (see measure)
    section.style.height = vh(screens());
    stage.style.setProperty("--fm-travel", vh(screens() - 1));   // how far the stage moves on iPhones and iPads (see home.css)
  }
  size();

  // ── the titles: split into lines, which come and go one after another ──
  function tidy(el) {                                        // normal whitespace collapsed (non-breaking spaces kept), ends trimmed
    el.querySelectorAll('span[style*="white-space"]').forEach((span) => span.replaceWith(document.createTextNode(span.textContent.replace(/ /g, " "))));
    el.normalize();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => { n.nodeValue = n.nodeValue.replace(/[ \t\n\r]+/g, " "); });
    for (const n of nodes) { n.nodeValue = n.nodeValue.replace(/^ +/, ""); if (n.nodeValue) break; }
    for (const n of nodes.reverse()) { n.nodeValue = n.nodeValue.replace(/ +$/, ""); if (n.nodeValue) break; }
  }
  // a title's lines where they belong right now, without animation (after a split, and at the start)
  const settle = (title) => {
    title.size = null;                                       // measured again (see sizeOf)
    gsap.set(title.lines, { yPercent: 0, opacity: title.on ? 1 : 0 });
    title.el.style.visibility = "visible";
  };
  const useSplit = !!window.SplitText;
  if (useSplit) gsap.registerPlugin(SplitText);
  cards.forEach((c) => c.titles.forEach((title) => {
    if (!useSplit) { settle(title); return; }
    tidy(title.el);
    // Split again by refresh() below (when the width or the fonts change, with every card at its full size and unmoved),
    // not by SplitText itself.
    title.split = SplitText.create(title.el, {
      type: "lines",
      linesClass: "fm-line",
      reduceWhiteSpace: false,
      onSplit(self) { title.lines = self.lines; settle(title); }
    });
  }));

  function showTitle(c, k, dir) {
    if (k === c.title) return;
    const was = c.titles[c.title], now = c.titles[k], T = SET.title, d = STILL ? 0 : 1;
    c.title = k;
    if (was) {
      was.on = false;
      gsap.to(was.lines, { yPercent: -T.lift * dir, opacity: 0, duration: T.out * d, ease: "fm-leave", stagger: 0.03 * d, overwrite: true });
    }
    if (now) {
      now.on = true;
      if (!(gsap.getProperty(now.lines[0], "opacity") > 0.05)) gsap.set(now.lines, { yPercent: T.rise * dir });   // gone: it comes from the side it is scrolled from
      gsap.to(now.lines, { yPercent: 0, opacity: 1, duration: T.in * d, ease: "fm-out", stagger: T.stagger * d, delay: was ? T.out * 0.6 * d : 0, overwrite: true });
    }
  }

  const navBottom = () => {
    if (!nav) return 0;
    const css = getComputedStyle(nav);
    if (css.position !== "fixed" && css.position !== "sticky") return Math.max(0, Math.round(nav.getBoundingClientRect().bottom));
    return Math.max(0, Math.round((parseFloat(css.top) || 0) + nav.offsetHeight));
  };

  // ── measuring (whenever ScrollTrigger measures the page) ──
  let V = 0, gap = 0, total = 0, st = null, navH = 0, lastTail = -1;
  const offsetIn = (el, root) => {                           // where el is inside root, as laid out (transforms do not count)
    let x = 0, y = 0;
    for (let n = el; n && n !== root; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { x, y };
  };
  // where a title is in its card and how much room its text takes (its lines together, not the block, which may be
  // stretched). Measured the first time it is needed after a split or a measuring of the page. (The lines may be moved
  // by their animation right now: heights are read from the layout.)
  function sizeOf(c, title) {
    if (title.size) return title.size;
    const at = offsetIn(title.el, c.el), range = document.createRange();
    let top = 0, bottom = 0;
    title.lines.forEach((line, i) => {
      const lineTop = line === title.el ? 0 : offsetIn(line, title.el).y;
      if (!i) top = lineTop;
      if (line === title.el) range.selectNodeContents(line);
      bottom = Math.max(bottom, lineTop + (line === title.el ? range.getBoundingClientRect().height : line.offsetHeight));
    });
    return (title.size = { y: at.y + top, h: bottom - top });
  }
  function measure() {
    // the cards start right under the navbar: its bottom edge (64px on computers, 56px on phones in Taptop)
    // (From its own height and its "top", not from where the browser shows it right now: on iPhones that can be off by
    // the part of the screen Safari's bars cover while they collapse or come back.)
    navH = navBottom();
    section.style.setProperty("--fm-nav", navH + "px");
    gap = parseFloat(getComputedStyle(stage).paddingBottom) || 0;   // between two cards while they trade places
    if (NATIVE) section.style.setProperty("--fm-gap", gap + "px");   // the height of a card follows from it (see home.css)
    V = NATIVE ? native.frame.offsetHeight : stage.clientHeight;
    cards.forEach((c) => {
      const el = c.el, m = c.m;
      m.A = el.offsetHeight;
      m.R = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;   // Taptop's radius (read while measuring, see home.css)
      if (c.tag) {
        const at = offsetIn(c.tag, el);
        m.tagH = c.tag.offsetHeight; m.padX = at.x; m.padY = at.y;
        c.done.style.setProperty("--fm-tag-bw", getComputedStyle(c.tag).borderTopWidth);
      } else { m.tagH = 48; m.padX = m.padY = 24; }
      m.ph = Math.min(m.tagH + 2 * m.padY, m.A);             // the smallest card: the label with the card's top padding above and below it
      c.titles.forEach((title) => { title.size = null; });
    });
    // where each card fills the stage: positions in px of scroll since the stage was pinned
    let at = V;                                              // the first card fills it once the section above has gone (one screen)
    cards.forEach((c, i) => {
      if (i) at += (V - navH) / SET.speed;                   // the new card's top comes up from the bottom to the top
      c.from = at;
      at += c.steps * SET.step * V;
      c.to = at;
    });
    // the last card gives room to the section after the stack: the stage stays pinned for that much more scroll
    const last = cards[cards.length - 1].m, tail = Math.max(0, Math.round(last.A - last.ph));
    at += tail;
    total = at;
    if (NATIVE) { layOut(); return; }
    if (tail !== lastTail) {
      const first = lastTail < 0;
      lastTail = tail;
      section.style.setProperty("--fm-tail", tail + "px");
      // the section's height has changed: everything on the page is measured again (once, the value is the same then)
      if (!first || tail) requestAnimationFrame(() => ScrollTrigger.refresh());
    }
    total = at;                                              // = the section's height - one screen: the scroll while pinned
  }

  // "native": the sizes of the slots, the strips and the section, so that the browser moves every card exactly as
  // state() below describes it (A: the height of a card, var(--fm-a) in home.css; ph: its smallest height):
  //   · a slot is A (the card) + the scroll of its steps + A - ph: the card stays until only ph of it is left uncovered,
  //     then its slot ends and it goes on up with the page;
  //   · every slot but the first is pulled up by A - ph, less the gap: the next card comes up under the old one's
  //     smallest size, the gap between them. The section after the stack is pulled up the same way under the last card.
  // In --fm-vh, like the cards, so all of it follows the steady screen height without being measured again.
  function layOut() {
    const px = (v) => n2(v) + "px";
    const place = (strip, c, top, height) => {               // as wide as the card (1px more on each side), its corners
      const m = c.m, box = strip.offsetParent;
      const x = c.el.getBoundingClientRect().left - (box ? box.getBoundingClientRect().left + box.clientLeft : 0);
      strip.style.left = px(x - 1);
      strip.style.width = px(c.el.offsetWidth + 2);
      strip.style.setProperty("--fm-r", px(m.R));
      if (top !== null) strip.style.top = top;
      if (height !== null) strip.style.height = height;
    };
    cards.forEach((c, i) => {
      const prev = cards[i - 1];
      c.slot.style.height = "calc(2 * var(--fm-a) + " + (c.steps * SET.step * 100).toFixed(3) + " * var(--fm-vh, 1vh) - " + px(c.m.ph) + ")";
      c.slot.style.marginTop = prev ? "calc(" + px(gap + prev.m.ph) + " - var(--fm-a))" : "";
      // from the old card's corners down under the new card's: the new card is drawn over it, its corners are not
      if (c.collar) place(c.collar, prev, px(-(gap + prev.m.R)), px(gap + prev.m.R + c.m.R));
      if (c.cap) {                                           // in the flow, centred like the card, 1px wider on each side
        c.cap.style.width = px(c.el.offsetWidth + 2);
        c.cap.style.marginLeft = px(c.el.offsetLeft - 1);
        c.cap.style.height = px(c.m.R);
        c.cap.style.marginBottom = px(-c.m.R);
        c.cap.style.setProperty("--fm-r", px(c.m.R));
      }
      // the smallest card, as a cut of the card (see is-pill in draw), with its corners
      c.el.style.setProperty("--fm-pill", "inset(0px 0px calc(var(--fm-a) - " + px(c.m.ph) + ") 0px round " + px(Math.min(c.m.R, c.m.ph / 2)) + ")");
    });
    const last = cards[cards.length - 1];
    place(native.mask, cards[0], null, null);
    place(native.end, last, "auto", px(gap + last.m.R));   // (the section after the stack has no corners to fill)
    native.end.style.bottom = "calc(var(--fm-a) - " + px(last.m.ph) + ")";
    section.style.marginBottom = "calc(" + px(last.m.ph) + " - var(--fm-a))";
    // the first time, the section has just taken its new height: everything on the page is measured again (once)
    if (!native.laid) { native.laid = true; requestAnimationFrame(() => ScrollTrigger.refresh()); }
  }

  // ── one moment: where a card is, at p px of scroll since the stage was pinned ──
  // y: where its top is (px, from the top of its own box, which starts under the navbar), h: how tall it is (px from its
  // top; the rest of it is cut away), r: the radius of its corners (Taptop's, or less while it is not that tall). Its
  // bottom edge never goes below the bottom of the stage (A) unless it is coming in, and it is never smaller than the
  // smallest card (ph): one that goes on moving up is scrolled away.
  function shapeOf(c, y, h, leaving) {
    const m = c.m;
    y = Math.max(y, -navH - m.ph - 2);                       // gone above the screen: it stays there
    const seen = y < m.A + gap - 0.5 && y + h > -navH;
    return { seen, leaving, y, h, r: Math.min(m.R, h / 2) };
  }
  // a card whose top is at y, coming up: the smallest card until all of it is on screen, then its bottom stays at the bottom
  const rising = (c, y) => shapeOf(c, y, Math.max(c.m.ph, c.m.A - y), false);
  function state(c, i, p) {
    const m = c.m, A = m.A, ph = m.ph, prev = cards[i - 1], next = cards[i + 1];
    let g, step = 0, fill = 0, white = false;
    if (p < c.from) {                                        // coming
      if (!prev) g = rising(c, V - Math.max(0, p));          // the first one comes up with the page (one navbar below the section above)
      else g = rising(c, A + gap - Math.max(0, p - prev.to) * SET.speed);   // under the card that gives it room, the gap between them
    } else if (p <= c.to) {                                  // filling the stage: going through its steps
      g = shapeOf(c, 0, A, false);
      step = Math.min(c.steps - 1, Math.floor((p - c.from) / (SET.step * V)));
      fill = clamp((p - c.from) / (c.to - c.from));
    } else {                                                 // giving room to the next one (or to the section after the stack)
      // its bottom edge: as far above the next card's top as the gap. The section after the stack comes up with the page.
      const bottom = A - (p - c.to) * (next ? SET.speed : 1);
      step = c.steps - 1; fill = 1; white = true;
      g = shapeOf(c, Math.min(0, bottom - ph), Math.max(ph, bottom), true);   // then the smallest card is scrolled away
    }
    return { g, step, fill, white };
  }

  // What the browser shows for a moment, in "tracks" (see below): the card is moved and cut (its corners included) by a
  // clip-path, as wide as it is and as tall as it is open; the progress fills the label. Nothing else moves.
  function tracksOf(c) {
    const m = c.m;
    const list = [
      { el: c.el, get: (g) => [g.y, m.A - g.h, g.r],
        css: (v) => [["transform", "translate(0px," + n2(v[0]) + "px)"],
          ["clip-path", "inset(0px 0px " + n2(Math.max(0, v[1])) + "px 0px round " + n2(Math.max(0, v[2])) + "px)"]], tol: [0.3, 0.3, 0.2] }
    ];
    if (c.fill) list.push({ el: c.fill, get: (g, s) => [100 - s.fill * 100], css: (v) => [["clip-path", "inset(0 " + n2(v[0]) + "% 0 0)"]], tol: [0.05] });
    return list;
  }

  // ── the browser plays it: keyframes along the scroll of the section ──
  // Every moving part gets an animation on the section's view timeline (--fm-pin-cards, named in home.css), from the moment
  // the section's top reaches the top of the screen to `total` px later: exactly 1 px of animation per px of scroll.
  // The numbers are sampled along the scroll (densely where the card changes, once where it does not), and a sample that
  // lies on the straight line between its neighbours is left out: the browser draws straight lines between keyframes.
  // (y and h are straight lines between a few corners; the radius near the smallest size is not.)
  const sheet = BY_CSS ? document.head.appendChild(document.createElement("style")) : null;
  let built = "", version = 0;
  function samplesOf(c, i) {
    const prev = cards[i - 1], next = cards[i + 1], m = c.m;
    const marks = new Set([0, total, c.from, c.to]);
    const fine = Math.max(8, Math.round(V / 24));            // samples per screen of scroll while the card changes
    const span = (a, b) => { const n = Math.max(2, Math.ceil(fine * (b - a) / V)); for (let j = 0; j <= n; j++) marks.add(a + (b - a) * j / n); };
    span(prev ? prev.to : 0, c.from);
    if (next) span(c.to, c.to + (m.A + navH + gap) / SET.speed);
    else span(c.to, total);                                  // the last one gives room to the section after the stack
    return [...marks].filter((p) => p >= 0 && p <= total).sort((a, b) => a - b);
  }
  function prune(points, tol) {                              // drop the samples that lie on the line between their neighbours
    const out = [points[0]];
    for (let j = 1; j < points.length - 1; j++) {
      const a = out[out.length - 1], b = points[j + 1], q = points[j], f = (q.p - a.p) / ((b.p - a.p) || 1);
      if (q.v.some((v, n) => Math.abs(v - (a.v[n] + (b.v[n] - a.v[n]) * f)) > tol[n])) out.push(q);
    }
    if (points.length > 1) out.push(points[points.length - 1]);
    return out;
  }
  function build() {
    if (!sheet || !total) return;
    const rules = [], uses = [];
    version++;
    cards.forEach((c, i) => {
      const moments = samplesOf(c, i).map((p) => ({ p, s: state(c, i, p) }));
      tracksOf(c).forEach((track, n) => {
        const name = "fmcard" + i + "x" + n + "v" + version;
        const points = prune(moments.map((mo) => ({ p: mo.p, v: track.get(mo.s.g, mo.s) })), track.tol);
        rules.push("@keyframes " + name + "{" + points.map((pt) => (pt.p / total * 100).toFixed(4) + "%{" +
          track.css(pt.v).map((pv) => pv[0] + ":" + pv[1]).join(";") + "}").join("") + "}");
        uses.push([track.el, name]);
      });
    });
    const css = rules.join("\n");
    if (css.replace(/v\d+/g, "") === built) { version--; return; }   // nothing has changed
    built = css.replace(/v\d+/g, "");
    sheet.textContent = css;
    uses.forEach(([el, name]) => {
      // the shorthand first: it resets the timeline and the range, which are set after it
      el.style.animation = name + " 1ms linear both";
      el.style.animationTimeline = "--fm-pin-cards";
      el.style.animationRange = "contain 0px contain " + total.toFixed(1) + "px";
    });
  }

  // ── the script plays it (phones, and browsers without scroll-driven animations): the same numbers, written on updates ──
  const write = (el, prop, value) => {                       // only what has changed is written
    if (!el) return;
    const was = el.fmCards || (el.fmCards = {});
    if (was[prop] !== value) { was[prop] = value; el.style.setProperty(prop, value); }
  };
  // ("native": the browser moves the cards itself; only the progress in the label is written)
  function drawCard(c, s) {
    tracksOf(c).forEach((track, n) => {
      if (NATIVE && !n) return;
      track.css(track.get(s.g, s)).forEach(([prop, value]) => write(track.el, prop, value));
    });
  }

  // ── on scroll: what is shown ──
  const flag = (c, key, cls, on, el) => { if (c[key] !== on) { c[key] = on; (el || c.el).classList.toggle(cls, on); } };
  // p: the scroll, in px since the stage was pinned. In the "follow" way the cards are told where to be at most every
  // SET.every seconds (the last update is never skipped): the transitions fill the frames in between.
  let shown = null, dir = 1, last = 0, later = 0;
  // ("native": read from where the section is; p = 0 when its top is one screen below the top of the screen, as before)
  const target = () => NATIVE ? V - section.getBoundingClientRect().top : st.progress * (st.end - st.start);
  function render() {
    if (!V || !st) return;
    dir = st.direction < 0 ? -1 : 1;
    if (FOLLOW) {
      const now = performance.now(), wait = SET.every * 1000 - (now - last);
      clearTimeout(later);
      if (wait > 0) { later = setTimeout(render, wait); return; }
      last = now;
    }
    shown = target();
    draw(shown);
  }
  let onDraw = null;                                         // ?fmcards=debug: the box is updated after every drawing
  let pillOn = null;
  function draw(p) {
    if (onDraw) onDraw();
    let pill = false;
    cards.forEach((c, i) => {
      const s = state(c, i, p), g = s.g, m = c.m;
      if (!BY_CSS) drawCard(c, s);
      flag(c, "off", "is-off", !g.seen);                     // nothing of it is seen
      // "native": a card that comes up and is still the smallest card (its top less than that above the bottom of the
      // stage) is cut to that size itself (is-pill), and the strip at the bottom of the screen is hidden meanwhile
      // (fm-rising on the section), so it comes up whole instead of being cut by the strip. At the moment it changes,
      // the card ends exactly where the strip begins, so nothing jumps.
      if (NATIVE) {
        const isPill = g.seen && !g.leaving && p < c.from && g.y > m.A - m.ph + 0.5;
        flag(c, "pill", "is-pill", isPill);
        if (isPill) pill = true;
      }
      if (c.tag) flag(c, "white", "is-done", s.white, c.tag);   // the colour change itself is a transition in home.css
      // a title is shown while the open part of the card reaches below it (and the card's padding under it)
      const now = c.titles[s.step];
      let fits = false;
      if (now && g.seen) { const b = sizeOf(c, now); fits = b.y + b.h + m.padY <= g.h + 0.5; }
      showTitle(c, fits ? s.step : -1, dir);
      // the illustration whose turn it is (the illustrations script fades it in, see takeTurns there)
      const turn = g.seen && g.h >= SET.artAt * m.A ? s.step : -1;
      if (turn !== c.turn) { c.turn = turn; c.arts.forEach((art, k) => art.classList.toggle("fm-turn", k === turn)); }
      // not seen, or leaving and small: hidden, so its drawings let go of their memory (a card that comes is made ready at once)
      flag(c, "asleep", "is-asleep", !g.seen || (g.leaving && g.h < SET.artWake * m.A));
    });
    if (NATIVE && pill !== pillOn) { pillOn = pill; section.classList.toggle("fm-rising", pill); }
  }

  // Measured with every card at its full size, unmoved (the class fm-measuring stops their animations for that moment;
  // nothing is drawn in between): the titles are split into lines again, and their sizes are read.
  function refresh() {
    section.classList.add("fm-instant", "fm-measuring");   // fm-instant: no transitions while everything is put in place
    measure();
    cards.forEach((c) => c.titles.forEach((title) => { if (title.split) title.split.split(); sizeOf(c, title); }));
    section.classList.remove("fm-measuring");
    build();
    if (st && V) { shown = target(); draw(shown); }
    void section.offsetWidth;                                // the new places are taken without a transition…
    requestAnimationFrame(() => section.classList.remove("fm-instant"));   // …and from the next frame on they follow again
  }
  st = ScrollTrigger.create(NATIVE
    ? { trigger: section, start: "top bottom", end: "bottom top", onUpdate: render, onRefresh: refresh }
    : { trigger: section, start: "top top", end: "bottom bottom", onUpdate: render, onRefresh: refresh });
  refresh();
  // the label is measured in the font that shows: once the site's fonts have arrived, measure it again
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", refresh);

  window.fmCards = { settings: SET, cards, byCSS: BY_CSS, update() { size(); ScrollTrigger.refresh(); } };

  // ── ?fmcards=debug: a box with what the page measures, to compare with what is seen on a phone ──
  // "stage" should be 0 while the cards are pinned (it is where the stage's top is on the screen), "card" is where the
  // top of the biggest card that is seen is, against where it should be; "smallest" is the smallest card of each, and
  // whether its corners make it a perfect pill (radius = half its height). Combine with ?fmpin=scroll or ?fmcards=js (&).
  if (/[?&]fmcards=debug\b/.test(location.search)) {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;right:8px;bottom:96px;z-index:2147483600;max-width:calc(100% - 16px);padding:6px 8px;border-radius:6px;" +
      "background:rgba(0,0,0,.82);color:#fff;font:11px/1.35 monospace;white-space:pre;pointer-events:none;text-align:left";
    document.body.appendChild(box);
    const ua = navigator.userAgent, ios = (ua.match(/OS (\d+)_(\d+)/) || []).slice(1).join("."), ver = (ua.match(/Version\/([\d.]+)/) || [])[1];
    const show = () => {
      const p = shown === null ? target() : shown, vv = window.visualViewport, root = getComputedStyle(document.documentElement);
      const sCss = getComputedStyle(stage), sec = getComputedStyle(section), rect = stage.getBoundingClientRect();
      const seen = cards.map((c, i) => ({ c, s: state(c, i, p) })).filter((o) => o.s.g.seen).sort((a, b) => b.s.g.h - a.s.g.h)[0];
      let card = "none";
      if (seen) {
        const expected = rect.top + parseFloat(sCss.paddingTop) + seen.s.g.y;
        card = Math.round(seen.c.el.getBoundingClientRect().top) + " (should be " + Math.round(expected) + ")";
      }
      box.textContent = [
        "fmcards debug · home-58",
        "iOS " + (ios || "-") + "  Safari " + (ver || "-") + "  by " + MODE + "  stage " + sCss.position + " " + sCss.visibility,
        "nav " + navBottom() + " (on screen " + (nav ? Math.round(nav.getBoundingClientRect().bottom) : "-") + ")  --fm-nav " + section.style.getPropertyValue("--fm-nav"),
        "stage " + Math.round(rect.top) + "  h " + V + "  inner " + innerHeight + "  vv " + (vv ? Math.round(vv.height) + " +" + Math.round(vv.offsetTop) : "-"),
        "scroll-padding-top " + root.scrollPaddingTop + "  inset " + (sec.viewTimelineInset || "-"),
        "card " + card + "  p " + Math.round(p),
        "smallest " + cards.map((c, i) => (i + 1) + ": " + n2(c.m.ph) + "px r " + n2(c.m.R) +
          (c.m.R + 0.5 >= c.m.ph / 2 ? " pill" : " (pill: r " + n2(c.m.ph / 2) + ")") +
          (Math.abs(c.m.padX - c.m.padY) > 0.5 ? " left " + n2(c.m.padX) + "≠top " + n2(c.m.padY) : "")).join("  ")
      ].join("\n");
    };
    let queued = 0;
    const later = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; show(); }); };
    onDraw = later;
    window.addEventListener("resize", later);
    if (window.visualViewport) visualViewport.addEventListener("resize", later);
    setTimeout(show, 300);
  }
});


/* ═══════════ clickable cards: the purple CTA card and the two tool cards ═══════════ */
/* The CTA card («От тихой рутины к громким результатам») and the two cards under «Полезные инструменты для вашего лейбла»
   open their link from anywhere on the card. A link cannot hold another link, so in Taptop the cards stay Divs and the
   button inside each one stays the only real link. A click anywhere else on the card is passed on to that button, so it
   does exactly what the button does: the demo buttons open the Planerka popup, the bot button opens Telegram in a new tab.
     · a click on the button itself is left alone: it works as before;
     · selecting text on a card opens nothing;
     · Ctrl/⌘-click, Shift-click or a middle click opens the link in a new tab, as on any link;
     · keyboard and screen readers: nothing changes, the button is still the card's only link (one stop for Tab).
   The three cards are found by their Taptop classes. Another card can be made clickable too, or one of these after it was
   rebuilt and got a new class: give it the class link-card in Taptop. If a card has more than one link, give the one the
   card should open the class card-link (otherwise the first link of the card is used). */
document.addEventListener("DOMContentLoaded", () => {
  const CARDS = ".link-card, .div--u-izrw1lrxy, .div--u-i1dd0doah, .div--u-iw3lwz57n";

  document.querySelectorAll(CARDS).forEach((card) => {
    const link = card.querySelector("a.card-link[href]") || card.querySelector("a[href]");
    if (!link) return;
    card.style.cursor = "pointer";
    card.classList.add("fm-linkcard");                     // the button looks hovered while the mouse is anywhere on the card (home.css)
    link.classList.add("fm-linkcard-link");

    // the click was on a link or a control of the card's own (the button itself): leave it to that
    const own = (e) => e.target.closest("a, button, input, select, textarea, label");
    const newTab = () => window.open(link.href, "_blank", "noopener");

    card.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0 || own(e)) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.toString().trim()) return;   // the visitor was selecting text
      if (e.ctrlKey || e.metaKey || e.shiftKey) newTab();
      else link.click();                                                                 // the button's own click: popup, new tab…
    });
    card.addEventListener("auxclick", (e) => {                                           // the middle button
      if (e.button === 1 && !own(e)) { e.preventDefault(); newTab(); }
    });
  });
});


/* ═══════════ steady small screen height, for the hero ═══════════ */
/* The hero is as tall as the screen less 40px (see "hero" in home.css), in svh: the visible height with the browser's bars
   shown. In Safari and Chrome that stays the same while the bars hide and show; in the browsers built into apps
   (Telegram, Instagram, VK…) it may not, and the hero, at the top of the page, would then change its height while scrolling,
   moving everything below it. So on phones and tablets the height is read once here, written as --fm-svh (one hundredth
   of it, in px), and read again only when the screen gets wider or narrower (the phone was turned). On computers --fm-svh
   is not set, and the hero follows the window as it is resized. */
(() => {
  if (!window.matchMedia || !matchMedia("(hover: none) and (pointer: coarse)").matches) return;
  if (!(window.CSS && CSS.supports && CSS.supports("height", "1svh"))) return;
  const root = document.documentElement;
  let probe = null, width = -1;
  function read() {
    if (window.innerWidth === width) return;
    width = window.innerWidth;
    const unit = probe.getBoundingClientRect().height / 100;
    if (unit > 0) root.style.setProperty("--fm-svh", unit.toFixed(3) + "px");
  }
  function start() {
    probe = document.createElement("div");                // an empty block 100svh tall, only to read what svh is
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:fixed;left:0;top:0;width:0;height:100svh;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    read();
    window.addEventListener("resize", read);
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();


/* ═══════════ hero: the chips that float over the table in the first section («Весь лейбл — на одной волне») ═══════════ */
/* The table picture is the background of the Div with the class hero-table (see "hero" in home.css, where the look of the
   chips is too). The chips travel over the table from right to left, each at its own depth, floating a little. */
(() => {
  // ── the chips ──
  // icon: the cell of s1-chips-3.webp (0 … 11, from the left); shape: "cover" (rounded square), "round" or "" (the icon has its own shape)
  // dot: the colour of the status dot, or "" for a line without a dot (a sum)
  // Their order here is their order on the table, from right to left.
  const CHIPS = [
    { icon: 0,  shape: "cover", title: "Альбом «Home»",          dot: "#16d947", text: "Готов к релизу" },
    { icon: 2,  shape: "round", title: "Сборы с концерта",       dot: "",        text: "+ 4 160 000 ₸" },
    { icon: 1,  shape: "",      title: "Лиц. договор № К-011",   dot: "#16d947", text: "Подписан" },
    { icon: 7,  shape: "round", title: "Аванс на клип",          dot: "#16d947", text: "Согласован" },
    { icon: 3,  shape: "cover", title: "Last Seen Leaving",      dot: "#ffbf00", text: "На модерации" },
    { icon: 4,  shape: "round", title: "Роялти за сентябрь",     dot: "",        text: "+ 865 947 ₽" },
    { icon: 5,  shape: "round", title: "Лицензия для сериала",   dot: "#e366ff", text: "Согласование" },
    { icon: 6,  shape: "cover", title: "Сингл «Любовь»",         dot: "#ffbf00", text: "Сведение" },
    { icon: 9,  shape: "",      title: "Акт № У-067",            dot: "#ffbf00", text: "В разработке" },
    { icon: 10, shape: "round", title: "Продажа мерча",          dot: "",        text: "+ 210 000 ₽" },
    { icon: 8,  shape: "cover", title: "EP «slow blink»",        dot: "#33a0ff", text: "Отгружен на площадки" },
    { icon: 11, shape: "round", title: "Обложка релиза",         dot: "#33a0ff", text: "На проверке" }
  ];

  // ── settings ──
  // Places on the table are given as shares of the picture's height (0 = its top, 1 = its bottom edge),
  // so they fit the picture at every screen width. The table's far edge is at about 0.47.
  // Lengths in px are for the chips at their full size (1440px screens); on smaller screens they shrink with the chips.
  /* HERO:START */
  var HERO = {
    // Where each chip travels (in the order of CHIPS), set by hand so the chips lie about the table loosely,
    // not in rows: [where its shadow lies on the table, how far it is moved along its way, as a share of spacing].
    // Chosen so that neighbours never cover each other, and so that the depths do not fall into rows or steady steps.
    places: [[0.79, 0], [0.895, 0], [0.825, 0.08], [0.715, 0], [0.775, 0], [0.84, 0.04],
             [0.775, 0.09], [0.94, 0.06], [0.85, 0.06], [0.715, 0.02], [0.81, -0.03], [0.87, -0.03]],
    horizon: -1.4,      // the perspective: chips further back are a little smaller, as if seen from this height of the picture
                        // (lower = less difference: with -1.4 a chip at the back is about 93% of one at the front)
    spacing: 225,       // px between two chips, along their way (on average)
    speed: 40,          // px per second, right to left
    lift: 14,           // px a chip floats above the table
    // Each chip floats on its own, never in step with the others: it bobs up and down and drifts a little forwards and back
    // along its way, like something carried by the air. Every chip gets its own speeds and sizes from these ranges [from, to].
    bob: [3, 6],        // px up and down
    bobTime: [2.6, 4.2],// seconds for one bob
    drift: [4, 9],      // px forwards and back
    driftTime: [4.5, 7.5],
    fade: 50,           // px over which a chip fades in and out where the table ends (on screens wider than the picture)
    shadow: 1,          // how dark the shadows are (0 … 1.5)
    // the way in: the chips that are on screen rise from the table one after another, like the letters of the heading
    enterDelay: 0.35,   // seconds after the picture has started to fade in
    enterTime: 1.1,     // seconds for one chip (the same as the letters of a heading: fmMotion.M.chars.time)
    enterStagger: 0.08  // seconds between two chips, from left to right
  };
  /* HERO:END */

  const PICTURE = ".hero-table";                         // the chips go into the section of this block

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smooth = (e0, e1, v) => { const t = clamp01((v - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;

  // The way in follows the curve of the heading's letters (see "split characters" above):
  // up from 25% of its height below its place, past it by 10%, back by 4%, past by 1%, and in place;
  // fully visible at 40% of the time. Each step eases in and out.
  const ENTER = window.fmMotion ? fmMotion.wave.map(([t, y]) => [t, y / 100]) : [[0, 0.25], [0.4, -0.1], [0.65, 0.04], [0.85, -0.01], [1, 0]];
  const easeInOut = (t) => t * t * (3 - 2 * t);
  function enterOffset(t) {                                  // t 0…1 → how far below its place, as a share of its height
    for (let i = 1; i < ENTER.length; i++) {
      if (t <= ENTER[i][0]) {
        const [t0, v0] = ENTER[i - 1], [t1, v1] = ENTER[i];
        return v0 + (v1 - v0) * easeInOut((t - t0) / (t1 - t0));
      }
    }
    return 0;
  }

  // The shadow of a chip on the table, painted the way a real one falls on wood under soft daylight: the chip's outline
  // laid flat (a thin band, as the table is seen at a low angle), in three layers:
  //   · a wide, faint penumbra, a little wider than the chip;
  //   · a body as wide as the chip's middle;
  //   · a denser core in the middle, where the chip blocks the most light.
  // The canvas is multiplied into the table (mix-blend-mode in the styles), so SHADE is not the colour of the shadow itself
  // but the colour the wood is multiplied by: a warm brown keeps the wood warm where it gets darker, as a real shadow on wood does.
  // Drawn once on a small canvas whenever the chip's size changes; on every frame the canvas is only moved.
  const SHADE = "168, 122, 86";
  function paintShadow(canvas, w, h, k) {
    const soft = 24 * k, flat = h * 0.26, pad = Math.ceil(soft * 2.2);
    const cw = Math.ceil(w + pad * 2), ch = Math.ceil(flat + pad * 2);
    canvas.width = cw; canvas.height = ch;
    canvas.style.width = cw + "px"; canvas.style.height = ch + "px";
    const ctx = canvas.getContext("2d"), far = 10000;
    // a rounded band (inset from the chip's sides, and this tall), drawn far to the left: only its shadow lands on the canvas
    const band = (inset, tall, blur, alpha) => {
      const bw = w - inset * 2, x = pad + inset - far, y = pad + (flat - tall) / 2, r = tall / 2;
      ctx.shadowColor = "rgba(" + SHADE + "," + alpha + ")"; ctx.shadowBlur = blur; ctx.shadowOffsetX = far; ctx.shadowOffsetY = 0;
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + bw, y, x + bw, y + tall, r); ctx.arcTo(x + bw, y + tall, x, y + tall, r);
      ctx.arcTo(x, y + tall, x, y, r); ctx.arcTo(x, y, x + bw, y, r); ctx.closePath();
      ctx.fill();
    };
    ctx.clearRect(0, 0, cw, ch);
    band(-w * 0.03, flat, soft, 0.4);               // penumbra
    band(w * 0.05, flat * 0.8, soft * 0.6, 0.45);   // body
    band(w * 0.14, flat * 0.6, soft * 0.42, 0.45);  // core
    return { cw, ch };
  }

  function init(section, picture) {
    const layer = document.createElement("div");
    layer.className = "hero-chips";
    layer.setAttribute("aria-hidden", "true");             // decorative: screen readers skip it
    const dot = (c) => (c.dot ? '<i style="background:' + c.dot + '"></i>' : "");
    // shadows first, so every shadow lies under every chip
    layer.innerHTML = '<b class="hero-unit"></b>'                       // measured: the size of the chips (see measure)
      + CHIPS.map(() => '<canvas class="hero-chip-shadow"></canvas>').join("")
      + CHIPS.map((c) => '<div class="hero-chip"><i class="' + (c.shape ? "is-" + c.shape : "") + '" style="background-position:' + (c.icon / 11 * 100).toFixed(4) + '% 0"></i>'
        + "<span><b>" + c.title + "</b><span>" + dot(c) + c.text + "</span></span></div>").join("");
    section.appendChild(layer);

    const unit = layer.querySelector(".hero-unit");
    const shadows = Array.from(layer.querySelectorAll(".hero-chip-shadow"));
    let seed = 11;                                         // fixed random numbers: every visit looks the same
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const pick = ([from, to]) => from + (to - from) * rnd();
    const items = Array.from(layer.querySelectorAll(".hero-chip")).map((el, i) => ({
      el, shadow: shadows[i], w: 0, h: 0, cw: 0, ch: 0,
      lane: HERO.places[i % HERO.places.length][0],
      seat: (i + HERO.places[i % HERO.places.length][1]) / CHIPS.length,   // its place in the round, 0…1
      // its own way of floating (the same on every visit)
      bobA: pick(HERO.bob), bobT: pick(HERO.bobTime), bobP: rnd() * TAU,
      driftA: pick(HERO.drift), driftT: pick(HERO.driftTime), driftP: rnd() * TAU,
      enter: -1, shown: false
    }));
    // closer chips in front of further ones (their depths never change, so neither does the order)
    items.slice().sort((a, b) => a.lane - b.lane).forEach((it, i) => { it.el.style.zIndex = 20 + i; });

    // sizes, measured on every change of the layout
    let W = 0, H = 0, picL = 0, picW = 0, k = 1, round = 1, sized = "";
    function measure() {
      const box = section.getBoundingClientRect(), pic = picture.getBoundingClientRect();
      W = box.width; H = pic.height; picL = pic.left - box.left; picW = pic.width;
      // the size of the chips: it follows the height of the section (see "hero" in home.css), so it is measured,
      // on a block 1000 chip px wide, rather than read from the styles
      k = unit.getBoundingClientRect().width / 1000 || 1;
      let widest = 0;
      items.forEach((it) => { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; widest = Math.max(widest, it.w); });
      // One round of the 12 chips: a chip every `spacing` px, and long enough that a chip has left the visible part
      // before it comes round again. The chips are evenly spaced on screen, so a new one comes in at a steady beat.
      const seen = Math.min(W, picW);
      round = Math.max(HERO.spacing * k * items.length, seen + widest + 40);
      const key = items.map((it) => it.w + "x" + it.h).join() + "/" + k;
      if (key !== sized) {
        sized = key;
        items.forEach((it) => { const c = paintShadow(it.shadow, it.w, it.h, k); it.cw = c.cw; it.ch = c.ch; });
      }
      if (!raf) draw(clock);
    }
    // how big things are at a height y of the picture, compared to the bottom edge
    const scaleAt = (y) => Math.max(0.05, (y - HERO.horizon * H) / (H - HERO.horizon * H));
    // its middle on screen at this moment
    const xOf = (it) => picL + picW / 2 + (((((it.seat - travel) % 1) + 1) % 1) - 0.5) * round;

    let clock = 0, travel = 0, started = false;
    function draw(time) {
      if (!H) return;
      // where the table fades out at the sides of the picture (on screens wider than the picture): the chips fade there, quickly
      const edgeL = picL + picW * 0.035, edgeR = picL + picW * 0.965, fade = HERO.fade * k;
      items.forEach((it) => {
        const ground = it.lane * H, s = scaleAt(ground);  // its point on the table, and its size there
        // its drift forwards and back
        const dPhase = TAU * time / it.driftT + it.driftP, drift = it.driftA * Math.sin(dPhase) * k * s;
        const sx = xOf(it) + drift, half = it.w * s / 2;
        let alpha = started ? smooth(edgeL, edgeL + fade, sx) * (1 - smooth(edgeR - fade, edgeR, sx)) : 0;
        // the way in
        let rise = 0;
        if (it.enter >= 0) {                               // (-1: it was off screen at the start, so it is simply there)
          const e = clamp01((time - it.enter) / HERO.enterTime);
          rise = enterOffset(e);
          alpha *= clamp01(e / 0.4);
        }
        // off screen, or faded out: hidden, and nothing is written for it
        if (sx + half < 0 || sx - half > W || alpha <= 0.001) {
          if (it.shown) { it.el.style.visibility = it.shadow.style.visibility = "hidden"; it.shown = false; }
          return;
        }
        if (!it.shown) { it.el.style.visibility = it.shadow.style.visibility = "visible"; it.shown = true; }

        // floating up and down
        const bob = Math.sin(TAU * time / it.bobT + it.bobP);                // -1…1
        const air = (HERO.lift + it.bobA * bob) * k * s;  // how high above the table it is, on screen
        const bottom = ground - air + rise * it.h * s;
        it.el.style.transform = "translate3d(" + (sx - it.w / 2).toFixed(2) + "px," + (bottom - it.h).toFixed(2) + "px,0) scale(" + s.toFixed(4) + ")";
        it.el.style.opacity = alpha >= 0.999 ? "" : alpha.toFixed(3);
        // its shadow, right under it: the higher it floats, the wider and fainter
        const up = (it.bobA * bob) / 6;                   // about -1…1: how much higher than usual it is
        const spread = s * (1 + 0.06 * up);
        it.shadow.style.transform = "translate3d(" + (sx - it.cw / 2).toFixed(2) + "px," + (ground - it.ch / 2).toFixed(2) + "px,0) scale(" + spread.toFixed(4) + ")";
        it.shadow.style.opacity = Math.min(1, HERO.shadow * alpha * (1 - 0.2 * up)).toFixed(3);
      });
    }

    // ── the loop: only while the section is on screen ──
    let raf = 0, last = 0, visible = true;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      fmPace.frame(now);
      if (!fmPace.due(last, now)) return;                 // the lighter mode for weak devices: every second frame only
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      clock += dt;
      travel += (HERO.speed * k * dt) / round;
      draw(clock);
    }
    const start = () => { if (!raf && visible && started && !reduceMotion) { last = 0; raf = requestAnimationFrame(frame); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    // the lighter mode for weak devices also takes away the frosted glass (see .is-light in the styles)
    const light = () => layer.classList.toggle("is-light", fmPace.slow);
    light(); fmPace.onChange(light);

    // The picture and the chips are the last part of the hero's way in (see "motion" at the top): once the heading, its
    // text and the button have started, the picture fades in (the class fm-hero-in on <html>, see the styles) and the
    // chips rise from the table. They wait for the picture to load; without the motion system they come in as soon as it has.
    let loaded = false;
    const onLoad = [];
    function begin() {                                     // the picture has loaded
      if (loaded) return;
      loaded = true;
      document.documentElement.classList.add("fm-hero");
      measure();
      onLoad.splice(0).forEach((fn) => fn());
    }
    function enter(instant) {                              // the picture fades in, the chips rise
      if (started) return;
      started = true;
      document.documentElement.classList.add("fm-hero-in");
      measure();
      // the chips that are on screen now rise in one after another, from left to right; the others are simply there
      items.map((it) => [xOf(it), it])
        .filter(([sx, it]) => !instant && !reduceMotion && sx + it.w / 2 > 0 && sx - it.w / 2 < W)
        .sort((a, b) => a[0] - b[0])
        .forEach(([, it], i) => { it.enter = clock + HERO.enterDelay + i * HERO.enterStagger; });
      draw(clock);
      start();
    }
    const whenLoaded = (fn) => (loaded ? fn() : onLoad.push(fn));
    const cued = window.fmMotion && fmMotion.cue(picture, { whenReady: whenLoaded, play: enter });
    if (!cued) whenLoaded(() => enter(false));
    const url = (getComputedStyle(picture).backgroundImage.match(/url\(["']?(.*?)["']?\)/) || [])[1];
    if (url) {
      const img = new Image();
      img.onload = img.onerror = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(begin);
      img.src = url;
      setTimeout(begin, 4000);                             // never wait longer than this
    } else begin();

    new ResizeObserver(measure).observe(section);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);   // the chips change width when their font arrives
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      visible ? start() : stop();
    }).observe(section);
    measure();

    // For quick experiments in the console: change a value in fmHero.settings, then call fmHero.update()
    window.fmHero = { settings: HERO, update() { sized = ""; measure(); }, state: () => ({ clock, travel, round, W, H, k, section: Math.round(section.getBoundingClientRect().height) }) };
  }

  function boot() {
    const picture = document.querySelector(PICTURE);
    const section = picture && (picture.closest("section") || picture.parentElement);
    if (!picture) return;
    try { init(section, picture); } catch (err) {
      document.documentElement.classList.add("fm-hero", "fm-hero-in");   // the picture is shown in any case
      console.warn("hero: the chips were not added", err);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();


/* ═══════════ rotating covers ═══════════ */
(() => {
  // ── covers: replace with your own image links (3 or more) ──
  const IMAGES = [
    "d/cover-7.webp",
    "d/cover-8.webp",
    "d/cover-1.webp",
    "d/cover-2.webp",
    "d/cover-3.webp",
    "d/cover-4.webp",
    "d/cover-5.webp",
    "d/cover-6.webp",
  ];

  // ── where it goes ──
  // The carousel is added right after this block: the wrapper of the «Больше релизов, меньше хаоса»
  // header. It becomes a new row of that section, between the header and the four cards.
  // To place it by hand instead, add an empty Div with the class "round-carousel" in Taptop:
  // the script then fills that Div and ignores this line.
  const INSERT_AFTER = ".div--u-ixkclyliq";

  // ── settings (same names as in the tuner) ──
  /* CONFIG:START */
  var CONFIG = {
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
    backFadeColor: "#ffffff",
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
  const STILL_AT = 0.25;       // the pose shown to visitors who turned on "reduce motion"
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  const radiusOf = (c, n) => {
    const w = c.imageWidth * (1 + c.spacing * 0.15);
    return n > 2 ? w / (2 * Math.tan(Math.PI / n)) : w * 0.6;
  };

  // How much room the ring needs on screen, across every rotation and the whole tilt range.
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
  let refreshTimer = 0;
  const refreshScrollTriggers = () => {
    if (document.readyState !== "complete") return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { if (window.ScrollTrigger) window.ScrollTrigger.refresh(); }, 60);
  };

  function init(root) {
    const c = Object.assign({}, CONFIG, { images: IMAGES.slice() });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    root.setAttribute("aria-hidden", "true");          // decorative: screen readers skip it
    root.innerHTML = '<div class="rc-tilt"><div class="rc-ring"></div></div>';
    const tiltEl = root.firstChild, ring = tiltEl.firstChild;

    let radius = 0;            // ring radius on screen, px
    let scrollRot = 0;         // rotation that follows the scroll (eased)
    let tilt = 0;              // tilt that follows the scroll (eased)
    let offset = 0;            // rotation added by the idle spin and by dragging
    let vel = 0, last = 0, raf = 0, visible = true, lastP = 0;
    let lastHeight = -1, lastWinW = window.innerWidth;
    const drag = { active: false, x: 0 };

    function build() {
      ring.innerHTML = "";
      c.images.forEach((src, i) => {
        const item = document.createElement("div");
        item.className = "rc-item";
        item.style.setProperty("--rc-angle", (i * 360 / c.images.length) + "deg");
        ["rc-front", "rc-back"].forEach((side) => {
          const face = document.createElement("div");
          face.className = "rc-face " + side;
          if (src) face.dataset.src = src;
          item.appendChild(face);
        });
        ring.appendChild(item);
      });
      if (coversWanted) loadCovers();
    }

    // The covers (about 360 KB) are downloaded only when the block comes within one screen of the visible part of the page
    let coversWanted = !window.IntersectionObserver;
    function loadCovers() {
      coversWanted = true;
      ring.querySelectorAll(".rc-face[data-src]").forEach((face) => {
        face.style.backgroundImage = 'url("' + face.dataset.src + '")';
        face.removeAttribute("data-src");
      });
    }

    function layout() {
      root.style.maxWidth = c.maxWidth + "px";
      root.style.background = c.background;
      root.style.cursor = c.drag ? "grab" : "";
      root.style.touchAction = c.drag ? "pan-y" : "";
      const W = root.clientWidth;
      if (!W) return;
      const n = c.images.length, b = boundsOf(c, n);
      const s = (W * c.fill) / (2 * b.halfW);            // design px → screen px
      const cy = -b.minY * s;                            // where the ring's centre sits inside the block
      const height = Math.ceil((b.maxY - b.minY) * s);
      radius = radiusOf(c, n) * s;
      root.style.height = height + "px";
      root.style.perspective = (c.perspective * s) + "px";
      root.style.perspectiveOrigin = "50% " + cy + "px";
      root.style.setProperty("--rc-radius", radius + "px");
      root.style.setProperty("--rc-corner", (c.cornerRadius * s) + "px");
      root.style.setProperty("--rc-fade", clamp01(c.backFade / 10));
      root.style.setProperty("--rc-fade-color", c.backFadeColor);
      tiltEl.style.width = (c.imageWidth * s) + "px";
      tiltEl.style.height = (c.imageHeight * s) + "px";
      tiltEl.style.left = ((W - c.imageWidth * s) / 2) + "px";
      tiltEl.style.top = (cy - (c.imageHeight * s) / 2) + "px";
      tiltEl.style.transformOrigin = "50% 50% " + (-radius) + "px";   // tilt around the centre of the ring
      apply();

      // The block changed height: the pinned logos strip below (and the card reveals) must re-measure.
      // After a window resize ScrollTrigger does that by itself, so skip the extra pass.
      if (height !== lastHeight) {
        if (window.innerWidth === lastWinW) refreshScrollTriggers();
        lastHeight = height;
      }
      lastWinW = window.innerWidth;
    }

    // 0 = the block's top edge reaches the bottom of the screen, 1 = its bottom edge leaves at the top.
    // ScrollTrigger works this out when it measures the page and keeps it up to date while scrolling. Reading the block's
    // place on every frame instead (the line with getBoundingClientRect below) made the browser lay out the page again on
    // every frame, after the other animations had moved things. That line is still used before ScrollTrigger has measured,
    // and if GSAP did not load.
    let st = null;
    if (window.gsap && window.ScrollTrigger && !reduceMotion) {
      gsap.registerPlugin(ScrollTrigger);
      st = ScrollTrigger.create({ trigger: root, start: "top bottom", end: "bottom top" });
    }
    function progress(measure) {
      if (typeof c.progress === "number") return clamp01(c.progress);   // testing aid: pins the scroll position
      if (reduceMotion) return STILL_AT;
      if (st && !measure && st.end > st.start) return st.progress;
      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return clamp01((vh - rect.top) / (vh + rect.height));
    }

    function apply() {
      tiltEl.style.transform = "rotateX(" + tilt.toFixed(3) + "deg)";
      ring.style.transform = "translateZ(" + (-radius) + "px) rotateY(" + (scrollRot + offset).toFixed(3) + "deg)";
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      fmPace.frame(now);
      if (!fmPace.due(last, now)) return;                 // the lighter mode for weak devices: every second frame only
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;

      const p = lastP = progress();
      const targetRot = c.scrollRotate * p;
      const targetTilt = c.tiltStart + (c.tiltEnd - c.tiltStart) * p;
      if (!c.smoothing || reduceMotion) {
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
        } else if (c.speed && !reduceMotion) {            // idle spin
          offset += c.speed * 6 * (c.direction === "left" ? -1 : 1) * dt;
        }
      }
      apply();
    }

    const start = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    // Dragging (only when drag: true)
    root.addEventListener("pointerdown", (e) => {
      if (!c.drag) return;
      try { root.setPointerCapture(e.pointerId); } catch (err) {}
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

    build();
    layout();
    lastP = progress(true);                              // place the ring before the first paint
    scrollRot = c.scrollRotate * lastP;
    tilt = c.tiltStart + (c.tiltEnd - c.tiltStart) * lastP;
    apply();

    new ResizeObserver(layout).observe(root);
    // Only animate while the block is on screen (or about to be)
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      visible ? start() : stop();
    }, { rootMargin: "200px 0px" }).observe(root);
    if (!coversWanted) {
      const near = new IntersectionObserver((entries) => {
        if (entries[entries.length - 1].isIntersecting) { near.disconnect(); loadCovers(); }
      }, { rootMargin: "100% 0px" });
      near.observe(root);
    }
    start();

    // For the tuner and for quick experiments in the console
    root.roundCarousel = {
      config: c,
      state: () => ({ progress: lastP, rotation: scrollRot + offset, tilt }),
      update(patch) {
        const rebuild = patch.images && patch.images !== c.images;
        Object.assign(c, patch);
        if (rebuild) build();
        layout();
      }
    };
  }

  function boot() {
    let roots = [...document.querySelectorAll(".round-carousel")];
    if (!roots.length) {
      const anchor = document.querySelector(INSERT_AFTER);
      if (!anchor) { console.warn("round-carousel: nothing matches " + INSERT_AFTER + ", so the carousel was not added"); return; }
      const root = document.createElement("div");
      root.className = "round-carousel";
      anchor.insertAdjacentElement("afterend", root);
      roots = [root];
    }
    roots.forEach((root) => { if (!root.roundCarousel) init(root); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();


/* ═══════════ logos: pinned section, strip slides from left-aligned to right-aligned ═══════════ */
document.addEventListener("DOMContentLoaded", () => {
  if (!window.gsap || !window.ScrollTrigger) return;   // the strip then simply stays where it is
  gsap.registerPlugin(ScrollTrigger);

  document.querySelectorAll(".logos-frame").forEach((frame) => {
    const track = frame.querySelector(".logos-track");
    const section = frame.closest("section");
    if (!track || !section) return;

    gsap.to(track, {
      x: () => frame.clientWidth - track.offsetWidth,   // from left-aligned to right-aligned
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "center center",                                                  // pin when the section is centred on screen
        end: () => "+=" + Math.abs(frame.clientWidth - track.offsetWidth),       // 1px of scroll = 1px of movement
        pin: true,                 // title + strip stay in place
        scrub: 0.6,                // follows the scroll, with a little smoothing
        invalidateOnRefresh: true, // re-measure on resize / rotation
        refreshPriority: 1         // measure this first: it adds space to the page
      }
    });
  });
});


/* ═══════════ stipple: dots that move to the music (the stat cards under «Три года музыки», the purple CTA card) ═══════════ */
/* A WebGL version of Originkit's "Tidal Stipple". A block is filled with tiny dots that thin out in one direction:
   on the stat cards they are dense at the bottom (where the white text sits) and sparse at the top;
   on the CTA card they are dense along its rounded border and thin out towards the middle.
   A slow tide rolls through the dots, and a simulated track pushes them on, column by column, like a level meter.
   Each kind of block has its own set of settings below. Another block can use one of them: give it the class "stipple"
   and data-stipple="cards" or data-stipple="cta". */
(() => {
  // ── settings ──
  // Most names and units are those of the Originkit panel, so values tried out there can be copied here as they are.
  // The "Stipple tuner" page has sliders for all of them and a button that copies a whole set, ready to paste here.

  // The three stat cards. The colour of their dots is --bar-color in the styles (.stat-orange, .stat-blue, .stat-green).
  /* STIPPLE:START */
  var STIPPLE = {
    background: "#F7F7F7",   // colour between the dots (the cards' own grey on the white page)
    density: 0,              // 0…100: how far up the dots reach
    scale: 45,               // % size of the dot grid
    dotTop: 10,              // % size of a dot at the top
    speed: 100,              // 0…100: speed of the tide (50 = normal, 100 = twice as fast)
    tide: 20,                // 0…20: how far the tide moves the dots up and down

    seed: 7,                 // which pattern of dots
    cellPx: 2,               // size of one grid cell, CSS px (before scale)
    jitter: 30,              // % how far a dot strays from the grid
    dotBottom: 151,          // % size of a dot at the bottom
    sizeJitter: 0,           // % random difference in dot size
    topDensity: 0,           // ‰ dots at the very top
    peakDensity: 150,        // % dots at the very bottom
    curveStart: 11,          // % where the rise in density starts (from the top)
    curveEnd: 93,            // % where it ends
    curveExp: 76,            // % shape of the rise (100 = even, lower = fills up sooner)
    growWidth: 0,            // % how gradually a dot grows in as the density reaches it (0 = it pops in)
    edgeSoft: 60,            // % softness of a dot's edge
    colorVar: 0,             // % random difference in the colour of the dots
    rimDarken: 0,            // % darker edge on each dot
    glint: 0,                // % dots that flash the accent colour
    shimmerTop: 0,           // % flicker of the dots at the top
    shimmerBottom: 0,        // % flicker of the dots at the bottom
    tidePeriod: 6400,        // ms for one tide (at speed 50)
    waveLength: 259,         // % length of a wave, as a share of the card's height
    waveMix: 100,            // % 0 = the whole card breathes together, 100 = waves roll across it
    crest: 0,                // % accent colour on the crests of the waves

    // The music. These are the settings of the bars that were here before: the same simulated track.
    bpm: 116,                // tempo of the beat
    bands: 48,               // columns the track is split into across a card (up to 64)
    stepped: 0,              // % 0 = the columns melt into each other, 100 = sharp bars
    lift: 70,                // % how far the loudest column pushes the dots up (0 = no music)
    kick: 8,                 // % how much every dot jumps on the beat
    attack: 35,              // % how fast a column rises…
    release: 15,             // % …and how fast it falls back, like a level meter

    // The text sits on the lower part of a card. There the dots always stay together, whatever the tide and the music do.
    hold: 20,                // % of the card's height, from the bottom, that stays filled (0 = off)
    holdFade: 20,            // % of the height over which that filled part melts into the rest

    maxDpr: 2                // render resolution cap: lower = lighter on phones
  };
  /* STIPPLE:END */

  // The purple CTA card («От тихой рутины к громким результам»). The dots grow from its border inwards, the way the light
  // did before: purple dots on a lighter purple. Words that differ from the set above:
  // "top" means the inner end of the dots (towards the middle of the card), "bottom" means the border.
  /* STIPPLE_CTA:START */
  var STIPPLE_CTA = {
    background: "#B596FF",   // colour between the dots
    color: "#884DFF",        // colour of the dots
    accent: "#FFFFFF",       // colour of glint and crest
    reach: 36,               // % of the card's shorter side: how far in from the border the dots go
    invert: 0,               // 1 = the other way round: dense in the middle, thinning out towards the border
    density: 0,              // 0…100: how far in the dots reach
    scale: 45,               // % size of the dot grid
    dotTop: 119,             // % size of a dot at the inner end
    speed: 100,              // 0…100: speed of the tide (50 = normal, 100 = twice as fast)
    tide: 20,                // 0…20: how far the tide moves the dots in and out

    seed: 7,                 // which pattern of dots
    cellPx: 2,               // size of one grid cell, CSS px (before scale)
    jitter: 30,              // % how far a dot strays from the grid
    dotBottom: 151,          // % size of a dot at the border
    sizeJitter: 0,           // % random difference in dot size
    topDensity: 0,           // ‰ dots at the inner end
    peakDensity: 110,        // % dots at the border
    curveStart: 11,          // % where the rise in density starts (from the inner end)
    curveEnd: 120,           // % where it ends
    curveExp: 140,           // % shape of the rise (100 = even, lower = fills up sooner)
    growWidth: 0,            // % how gradually a dot grows in as the density reaches it (0 = it pops in)
    edgeSoft: 60,            // % softness of a dot's edge
    colorVar: 0,             // % random difference in the colour of the dots
    rimDarken: 0,            // % darker edge on each dot
    glint: 12,               // % dots that flash the accent colour
    shimmerTop: 10,          // % flicker of the dots at the inner end
    shimmerBottom: 0,        // % flicker of the dots at the border
    tidePeriod: 6400,        // ms for one tide (at speed 50)
    waveLength: 120,         // % length of a wave along the border, as a share of the card's shorter side
    waveMix: 100,            // % 0 = the whole card breathes together, 100 = waves run around it
    crest: 0,                // % accent colour on the crests of the waves

    // The music: the same kind of track as on the stat cards, at the tempo the light of this card had
    bpm: 86,                 // tempo of the beat
    bands: 40,               // columns the track is split into, all the way round the card (up to 64)
    stepped: 0,              // % 0 = the columns melt into each other, 100 = sharp bars
    lift: 55,                // % how far the loudest column pushes the dots in (0 = no music)
    kick: 6,                 // % how much every dot jumps on the beat
    attack: 35,              // % how fast a column rises…
    release: 15,             // % …and how fast it falls back, like a level meter
    spin: 8,                 // degrees per second the columns travel round the card (negative = the other way)

    hold: 0,                 // % of the reach, from the border, that stays filled (0 = off)
    holdFade: 20,            // % of the reach over which that filled part melts into the rest

    maxDpr: 2                // render resolution cap: lower = lighter on phones
  };
  /* STIPPLE_CTA:END */

  // ── where each set goes ──
  // shape "bottom": dense at the bottom; shape "edge": dense along the rounded border (the radius is read from the block's styles).
  const SETS = {
    cards: { settings: STIPPLE, shape: "bottom", hosts: ".stat-card, .stipple[data-stipple='cards']" },
    cta:   { settings: STIPPLE_CTA, shape: "edge", hosts: ".light-card, .stipple[data-stipple='cta']" }
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MAX_BANDS = 64;

  // smooth random values (value noise), the same as the bars used
  const rand = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const noise = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return rand(i) * (1 - u) + rand(i + 1) * u; };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const num = (v, lo, hi, d) => clamp(typeof v === "number" && isFinite(v) ? v : d, lo, hi);

  // where each column "wants" to be at time t: 0…1 (the bars' formula)
  function target(c, seed, i, t) {
    const bpm = num(c.bpm, 20, 300, 116), bands = Math.round(num(c.bands, 1, MAX_BANDS, 48));
    const beat = Math.exp(-((t * bpm / 60) % 1) * 5);              // kick: jumps up on each beat, then fades
    const broad = noise(i * 0.12 * 128 / bands + seed + t * 0.35);  // slow wave across the columns
    const sharp = noise(i * 1.7 + seed * 2 + t * 2.4);              // fast jitter per column
    return clamp(-0.18 + broad * 0.5 + sharp * 0.7 + beat * 0.3 * noise(i * 0.3 + t + seed), 0, 1);
  }

  function color(s, fallback) {
    s = (s || "").trim();
    let m = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(s);
    if (m) {
      let h = m[1]; if (h.length === 3) h = h.replace(/./g, "$&$&");
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    }
    m = /^rgba?\(([^)]+)\)$/i.exec(s);
    if (m) { const p = m[1].split(/[\s,/]+/).map(parseFloat); if (p.length >= 3) return p.slice(0, 3).map((v) => clamp(v / 255, 0, 1)); }
    return fallback;
  }
  // a lighter version of a colour, for the accent when none is set
  const lighter = (c) => c.map((v) => v + (1 - v) * 0.35);

  const VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  // random values per dot of the grid, and the order in which the dots appear as the density grows
  const DOT_RANDOM = `
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 h22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec4 h42(vec2 p) { vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw) * p4.zywx); }

// the order in which the dots of the grid appear as the density grows: a shuffled ordered dither
float rankAt(vec2 c) {
  ivec2 ic = ivec2(c) + ivec2(4096);
  float r = 0.0, w = 0.25;
  for (int k = 0; k < 6; k++) {
    int bx = (ic.x >> k) & 1, by = (ic.y >> k) & 1;
    ivec2 blk = ic >> (k + 1);
    int sym = int(h12(vec2(blk) + vec2(float(k) * 17.31, uSeed * 3.7)) * 8.0);
    if ((sym & 1) == 1) bx = 1 - bx;
    if ((sym & 2) == 2) by = 1 - by;
    if ((sym & 4) == 4) { int t = bx; bx = by; by = t; }
    int idx = (bx == by) ? bx : (bx == 1 ? 2 : 3);
    r += float(idx) * w; w *= 0.25;
  }
  return r + h12(c * 1.37 + uSeed) * w * 4.0;
}`;

  // where a point is between the sparse end (0) and the dense end (1), and where along the block it is (0…1, for the waves and the music)
  const PLACE = `
uniform vec2 uRes;
uniform float uEdge;     // 0 = dense at the bottom, 1 = dense along the rounded border
uniform float uReach;    // edge: how far in the dots go, px
uniform float uRadius;   // edge: corner radius of the block, px
uniform float uInvert;   // edge: 1 = dense in the middle instead
float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec2 place(vec2 p) {
  if (uEdge < 0.5) return vec2(clamp(1.0 - p.y / max(uRes.y, 1.0), 0.0, 1.0), p.x / max(uRes.x, 1.0));
  vec2 c = uRes * 0.5, d = p - c;
  float inside = -sdRoundBox(d, c, min(uRadius, min(c.x, c.y)));       // px from the border, inwards
  float f = inside / max(uReach, 1.0);
  float y = uInvert > 0.5 ? f : 1.0 - f;                                // goes below 0 deep inside: no dots there
  return vec2(y, atan(d.y, d.x) / 6.2831853 + 0.5);
}`;

  // Those values never change for a dot. Worked out on every frame, for each of the 9 dots around every pixel, they were
  // a large part of the work of the drawing. So they are worked out once, when the size of the block is known, by this little
  // program: it writes them into three pictures with one pixel per dot of the grid, and the drawing below only looks them up
  // (about 40% less work for the graphics chip, with the same dots).
  //   picture A: the dot's place in the order (two bytes, for enough precision) and how far it strays from the grid (x, y)
  //   picture B: its random size, flicker speed, flicker phase and colour (the four values of h42)
  //   picture C: where the dot is in the block (the two values of place(), two bytes each): it depends on the block's size
  //              and corner radius, so this picture is made again when they change
  // Pixel (x, y) of the pictures is the dot (x - 1, y - 1): the drawing also looks at the dots just outside the block.
  const BAKE = `#version 300 es
precision highp float;
precision highp int;
uniform float uSeed; uniform float uCell; uniform float uJit;
layout(location = 0) out vec4 outA;
layout(location = 1) out vec4 outB;
layout(location = 2) out vec4 outC;
${DOT_RANDOM}
${PLACE}
vec2 bytes(float v) { v = floor(clamp(v, 0.0, 1.0) * 65535.0 + 0.5); return vec2(floor(v / 256.0), mod(v, 256.0)) / 255.0; }
void main() {
  vec2 c = floor(gl_FragCoord.xy) - 1.0, h = h22(c + uSeed * 13.1);
  outA = vec4(bytes(rankAt(c)), h);
  outB = h42(c + uSeed * 1.7);
  vec2 at = place((c + 0.5 + (h - 0.5) * uJit) * uCell);
  outC = vec4(bytes((at.x + 2.0) / 4.0), bytes(at.y));               // the first value is kept between -2 (deep inside) and 2
}`;

  // The drawing. With "baked" it looks the per-dot values up in the two pictures; without (if the browser could not make
  // them) it works them out itself, as before. Both give the same dots.
  const FRAG = (baked) => `#version 300 es
${baked ? "#define BAKED" : ""}
precision highp float;
precision highp int;
uniform float uTime; uniform float uBeat;
uniform vec3 uBg; uniform vec3 uBase; uniform vec3 uAccent;
uniform float uCell; uniform float uJit; uniform float uDotTop; uniform float uDotBot; uniform float uSizeJit;
uniform float uFloor; uniform float uPeak; uniform float uLo; uniform float uHi; uniform float uExp;
uniform float uGrow; uniform float uSoft; uniform float uPeriod; uniform float uWaveLen; uniform float uWaveMix;
uniform float uCrest; uniform float uShTop; uniform float uShBot; uniform float uGlint; uniform float uColVar; uniform float uRim;
uniform float uSeed; uniform float uDensOff; uniform float uTide;
uniform float uLevels[${MAX_BANDS}]; uniform float uBands; uniform float uStepped; uniform float uLift; uniform float uKick;
uniform float uHold; uniform float uHoldFade;
uniform float uSpin;     // edge: how far the columns have travelled round the block, 0…1
uniform vec2 uWaveN;     // edge: whole numbers of waves round the block (so they meet without a seam)
#ifdef BAKED
uniform highp sampler2D uDotsA;   // picture A of the BAKE program above
uniform highp sampler2D uDotsB;   // picture B
uniform highp sampler2D uDotsC;   // picture C
#endif
out vec4 outColor;
${PLACE}

#ifdef BAKED
vec4 dotA(vec2 c) { return texelFetch(uDotsA, ivec2(c) + 1, 0); }
vec4 dotB(vec2 c) { return texelFetch(uDotsB, ivec2(c) + 1, 0); }
vec2 dotPlace(vec2 c, vec2 ctr) {
  vec4 k = texelFetch(uDotsC, ivec2(c) + 1, 0);
  return vec2((k.x * 65280.0 + k.y * 255.0) / 65535.0 * 4.0 - 2.0, (k.z * 65280.0 + k.w * 255.0) / 65535.0);
}
#else
${DOT_RANDOM}
vec4 dotA(vec2 c) { return vec4(0.0, 0.0, h22(c + uSeed * 13.1)); }
vec4 dotB(vec2 c) { return h42(c + uSeed * 1.7); }
vec2 dotPlace(vec2 c, vec2 ctr) { return place(ctr); }
#endif

float densityAt(float y) {
  float t = smoothstep(uLo, max(uHi, uLo + 1e-3), y);
  return uFloor + (uPeak - uFloor) * pow(t, max(uExp, 0.1));
}

float band(float i) {                                        // one column of the track; round the block they wrap
  i = uEdge > 0.5 ? mod(i, uBands) : clamp(i, 0.0, uBands - 1.0);
  return uLevels[int(i)];
}
// loudness of the track at a point across the block (0…1): sharp columns, or columns melted into each other
float levelAt(float x) {
  float f = (uEdge > 0.5 ? fract(x) : clamp(x, 0.0, 0.99999)) * uBands;
  float g = f - 0.5, i0 = floor(g);
  return mix(mix(band(i0), band(i0 + 1.0), smoothstep(0.0, 1.0, g - i0)), band(floor(f)), uStepped);
}

void main() {
  vec2 q = gl_FragCoord.xy;
  float soft = uSoft, cell = uCell;
  float per = max(uPeriod, 0.1), T = uTime / per;
  float swell = sin(6.2831853 * T);

  // a pixel far inside the block, where no dot can reach even at the loudest moment: background at once
  if (uEdge > 0.5 && uInvert < 0.5) {
    float most = place(q).x + (2.0 * cell + soft) / max(uReach, 1.0) + uDensOff + uTide + uLift + uKick;
    if (densityAt(most) < 0.004) { outColor = vec4(uBg, 1.0); return; }
  }

  vec2 gi = floor(q / cell);
  float kx = 6.2831853 / max(uWaveLen * uRes.y, 1.0);
  float maxR = 0.5 * cell * max(uDotTop, uDotBot) * (1.0 + uSizeJit) + soft + 0.5;

  vec3 col = uBg;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = gi + vec2(float(i), float(j));
    vec4 ka = dotA(c);
    vec2 h = ka.zw;
    vec2 ctr = (c + 0.5 + (h - 0.5) * uJit) * cell;
    float dist = length(q - ctr);
    if (dist > maxR) continue;

    vec2 at = dotPlace(c, ctr);
    float yT = at.x, ySize = clamp(yT, 0.0, 1.0);
    vec2 xw = uEdge > 0.5 ? 6.2831853 * at.y * uWaveN : vec2(ctr.x * kx, ctr.x * kx * 1.73);
    float roll = 0.65 * sin(xw.x - 6.2831853 * T) + 0.35 * sin(xw.y + 12.5663706 * T + 1.3);
    float wave = mix(swell, roll, uWaveMix);

    float music = uLift * levelAt(at.y + uSpin) + uKick * uBeat;        // the track pushes the dots on
    float d = densityAt(yT + uDensOff + uTide * wave + music);
    if (uHold > 0.0) d = mix(d, max(d, 1.05), smoothstep(1.0 - uHold - uHoldFade, 1.0 - uHold, yT));   // keeps the dense end filled
    if (d < 0.004) continue;

#ifdef BAKED
    float r = (ka.x * 65280.0 + ka.y * 255.0) / 65535.0;                 // the two bytes of picture A: hi * 255 * 256 + lo * 255
#else
    float r = rankAt(c);
#endif
    float w = uGrow * r + 0.004;
    float s = smoothstep(r - w, r + w, d);
    if (s < 0.02) continue;

    vec4 h2 = dotB(c);
    float rad = 0.5 * cell * mix(uDotTop, uDotBot, ySize) * (1.0 + uSizeJit * (h2.x * 2.0 - 1.0)) * s;
    float a = 1.0 - smoothstep(rad - soft, rad + soft, dist);
    if (a <= 0.0) continue;

    float pick = floor(h2.y * 3.0);
    float sp = per * (pick < 1.0 ? 0.25 : (pick < 2.0 ? 0.33333333 : 0.5));
    float sv = sin(6.2831853 * (uTime / max(sp, 0.05) + h2.z));
    float amp = mix(uShTop, uShBot, smoothstep(0.4, 0.9, ySize));
    float qd = clamp(dist / max(rad, 1e-3), 0.0, 1.0);
    vec3 dc = uBase * (1.0 + uColVar * (h2.w * 2.0 - 1.0)) * (1.0 - uRim * qd * qd) * (1.0 + amp * sv);
    dc = mix(dc, uAccent, uGlint * pow(max(sv, 0.0), 6.0));
    float bandLit = smoothstep(0.05, 0.4, d) * (1.0 - smoothstep(0.65, 1.1, d));
    float lit = uCrest * smoothstep(0.3, 1.0, wave) * bandLit;
    dc = mix(dc, uAccent * 1.3, lit) * (1.0 + 0.4 * lit);
    col = mix(col, dc, a);
  }
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  const instances = [];
  const api = { paused: false };                       // paused: true stops the clocks (the tuner's Pause button)

  // Everything WebGL keeps for one block: the programs, the triangle, the two pictures of per-dot values.
  // Made when the block is set up, and made again if the browser takes the WebGL context away and gives it back
  // (phones do that when the page is in the background or memory runs low).
  function makeGL(gl) {
    const compile = (type, src) => {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const link = (frag) => {
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const cache = {};
      return { prog, u: (n) => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(prog, n))) };
    };
    const g = { baked: null, plain: null, bake: null, main: null, tex: [], fb: null, key: "" };
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    try {
      g.bake = link(BAKE);
      g.baked = link(FRAG(true));
      g.tex = [gl.createTexture(), gl.createTexture(), gl.createTexture()];
      g.tex.forEach((t) => {
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      });
      g.fb = gl.createFramebuffer();
      g.main = g.baked;
    } catch (err) {
      console.warn("stipple: the dots are worked out on every frame instead", err);
      g.baked = null;
    }
    g.usePlain = () => { if (!g.plain) g.plain = link(FRAG(false)); g.main = g.plain; g.baked = null; };
    if (!g.main) g.usePlain();
    gl.useProgram(g.main.prog);
    return g;
  }

  function mount(host, set) {
    if (host.fmStipple) return;
    const canvas = document.createElement("canvas");
    canvas.className = "stipple-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.prepend(canvas);
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, premultipliedAlpha: false });
    const fail = (err) => { if (err) console.warn("stipple:", err); canvas.remove(); host.classList.add("stipple-failed"); };
    if (!gl) return fail();                            // no WebGL2: the block keeps its plain look

    const css = getComputedStyle(host);
    const c0 = set.settings;
    const cssBase = color(css.getPropertyValue("--bar-color"), null);
    const me = {
      host, canvas, gl, set,
      // the colour of the dots: the set's own "color", or else --bar-color of the block
      base: color(c0.color, cssBase || [0.96, 0.43, 0]),
      accent: color(c0.accent, color(css.getPropertyValue("--bar-accent"), lighter(cssBase || [0.96, 0.43, 0]))),
      seed: instances.length * 37.3,                 // every block plays its own part of the track
      levels: new Float32Array(MAX_BANDS), visible: false, dpr: 1, radius: 0, cell: 2,
      music: 3, tide: 0, spin: 0                     // its clocks
    };
    for (let i = 0; i < MAX_BANDS; i++) me.levels[i] = target(c0, me.seed, i, 0);
    try { me.g = makeGL(gl); } catch (err) { return fail(err); }

    me.resize = () => {
      me.dpr = Math.min(window.devicePixelRatio || 1, num(me.set.settings.maxDpr, 0.5, 3, 2));
      const w = Math.max(1, Math.round(host.clientWidth * me.dpr)), h = Math.max(1, Math.round(host.clientHeight * me.dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      me.radius = (parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0) * me.dpr;   // follows the block's corner radius
    };
    // the per-dot pictures, for the grid as it is now: made again only when the size of the block, of a dot or the seed changes
    me.bake = () => {
      const g = me.g;
      if (!g.baked) return;
      const seed = num(me.set.settings.seed, 0, 999, 7);
      const tw = Math.ceil(canvas.width / me.cell) + 3, th = Math.ceil(canvas.height / me.cell) + 3;
      const c = me.set.settings, edge = me.set.shape === "edge", reach = num(c.reach, 1, 100, 34) / 100 * Math.min(canvas.width, canvas.height);
      const jit = num(c.jitter, 0, 100, 30) / 100;
      const key = [canvas.width, canvas.height, me.cell, seed, jit, edge, reach, me.radius, !!c.invert].join("/");
      if (key === g.key) return;
      const max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      if (tw > max || th > max) { g.usePlain(); return; }
      g.tex.forEach((t) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); });
      gl.bindFramebuffer(gl.FRAMEBUFFER, g.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, g.tex[0], 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, g.tex[1], 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, g.tex[2], 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); g.usePlain(); return;
      }
      const b = g.bake.u;
      gl.useProgram(g.bake.prog);
      gl.uniform1f(b("uSeed"), seed);
      gl.uniform1f(b("uCell"), me.cell);
      gl.uniform1f(b("uJit"), jit);
      gl.uniform2f(b("uRes"), canvas.width, canvas.height);
      gl.uniform1f(b("uEdge"), edge ? 1 : 0);
      gl.uniform1f(b("uReach"), reach);
      gl.uniform1f(b("uRadius"), me.radius);
      gl.uniform1f(b("uInvert"), c.invert ? 1 : 0);
      gl.viewport(0, 0, tw, th);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(g.main.prog);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.tex[0]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, g.tex[1]);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, g.tex[2]);
      g.key = key;
    };
    // The settings that do not change from frame to frame: given to the program once, and again after a resize or fmStipple.update()
    me.setup = () => {
      const c = me.set.settings, cw = canvas.width, ch = canvas.height, edge = me.set.shape === "edge";
      me.cell = Math.max(num(c.cellPx, 0.5, 40, 2) * num(c.scale, 10, 300, 100) / 100 * me.dpr, 1.5);
      me.bake();
      const g = me.g, u = g.main.u;
      gl.useProgram(g.main.prog);
      const short = Math.min(cw, ch), waveLen = num(c.waveLength, 20, 400, 100) / 100;
      // edge: whole numbers of waves round the block, so the first and the last wave meet without a seam
      const round = 2 * (cw + ch) - (8 - 2 * Math.PI) * Math.min(me.radius, short / 2), n1 = Math.max(1, Math.round(round / (waveLen * short)));
      if (g.baked) { gl.uniform1i(u("uDotsA"), 0); gl.uniform1i(u("uDotsB"), 1); gl.uniform1i(u("uDotsC"), 2); }
      gl.uniform2f(u("uRes"), cw, ch);
      gl.uniform3fv(u("uBg"), color(c.background, [0.97, 0.97, 0.97]));
      gl.uniform3fv(u("uBase"), c.color ? color(c.color, me.base) : me.base);
      gl.uniform3fv(u("uAccent"), c.accent ? color(c.accent, me.accent) : me.accent);
      gl.uniform1f(u("uCell"), me.cell);
      gl.uniform1f(u("uJit"), num(c.jitter, 0, 100, 30) / 100);
      gl.uniform1f(u("uDotTop"), num(c.dotTop, 10, 200, 33) / 100);
      gl.uniform1f(u("uDotBot"), num(c.dotBottom, 10, 200, 145) / 100);
      gl.uniform1f(u("uSizeJit"), num(c.sizeJitter, 0, 50, 0) / 100);
      gl.uniform1f(u("uFloor"), num(c.topDensity, 0, 300, 0) / 1000);
      gl.uniform1f(u("uPeak"), num(c.peakDensity, 50, 150, 150) / 100);
      gl.uniform1f(u("uLo"), num(c.curveStart, -50, 100, -50) / 100);
      gl.uniform1f(u("uHi"), num(c.curveEnd, 0, 150, 150) / 100);
      gl.uniform1f(u("uExp"), num(c.curveExp, 20, 400, 84) / 100);
      gl.uniform1f(u("uGrow"), num(c.growWidth, 0, 50, 0) / 100);
      gl.uniform1f(u("uSoft"), num(c.edgeSoft, 10, 300, 60) / 100);
      gl.uniform1f(u("uPeriod"), num(c.tidePeriod, 1000, 30000, 6400) / 1000);
      gl.uniform1f(u("uWaveLen"), waveLen);
      gl.uniform1f(u("uWaveMix"), num(c.waveMix, 0, 100, 100) / 100);
      gl.uniform1f(u("uCrest"), num(c.crest, 0, 100, 0) / 100);
      gl.uniform1f(u("uShTop"), num(c.shimmerTop, 0, 50, 0) / 100);
      gl.uniform1f(u("uShBot"), num(c.shimmerBottom, 0, 50, 0) / 100);
      gl.uniform1f(u("uGlint"), num(c.glint, 0, 100, 0) / 100);
      gl.uniform1f(u("uColVar"), num(c.colorVar, 0, 50, 0) / 100);
      gl.uniform1f(u("uRim"), num(c.rimDarken, 0, 80, 0) / 100);
      gl.uniform1f(u("uSeed"), num(c.seed, 0, 999, 7));
      gl.uniform1f(u("uDensOff"), ((num(c.density, 0, 100, 0) - 50) / 100) * 0.5);
      gl.uniform1f(u("uTide"), num(c.tide, 0, 20, 20) / 100);
      gl.uniform1f(u("uBands"), Math.round(num(c.bands, 1, MAX_BANDS, 48)));
      gl.uniform1f(u("uStepped"), num(c.stepped, 0, 100, 0) / 100);
      gl.uniform1f(u("uLift"), num(c.lift, 0, 200, 50) / 100);
      gl.uniform1f(u("uKick"), num(c.kick, 0, 100, 6) / 100);
      gl.uniform1f(u("uHold"), num(c.hold, 0, 100, 0) / 100);
      gl.uniform1f(u("uHoldFade"), num(c.holdFade, 1, 100, 20) / 100);
      gl.uniform1f(u("uEdge"), edge ? 1 : 0);
      gl.uniform1f(u("uReach"), num(c.reach, 1, 100, 34) / 100 * short);
      gl.uniform1f(u("uRadius"), me.radius);
      gl.uniform1f(u("uInvert"), c.invert ? 1 : 0);
      gl.uniform2f(u("uWaveN"), n1, Math.max(1, Math.round(n1 * 1.73)));
    };
    // one frame: only the values that move are given again
    me.draw = () => {
      const c = me.set.settings, u = me.g.main.u;
      const beatPh = (me.music * num(c.bpm, 20, 300, 116) / 60) % 1;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(u("uTime"), me.tide);
      gl.uniform1f(u("uBeat"), Math.exp(-beatPh * 6));
      gl.uniform1fv(u("uLevels"), me.levels);
      gl.uniform1f(u("uSpin"), me.spin);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    // the clocks move on, and the columns of the track move towards where they want to be: up quickly, down slower
    me.step = (dt) => {
      const c = me.set.settings, bands = Math.round(num(c.bands, 1, MAX_BANDS, 48));
      me.music += dt;
      me.tide = (me.tide + dt * num(c.speed, 0, 100, 100) / 50) % 3600;
      me.spin = (me.spin + dt * num(c.spin, -360, 360, 0) / 360) % 1;
      const up = 1 - Math.pow(1 - num(c.attack, 1, 100, 35) / 100, dt * 60);
      const down = 1 - Math.pow(1 - num(c.release, 1, 100, 15) / 100, dt * 60);
      for (let i = 0; i < bands; i++) {
        const t = target(c, me.seed, i, me.music);
        me.levels[i] += (t - me.levels[i]) * (t > me.levels[i] ? up : down);
      }
    };
    me.redraw = () => { if (me.lost) return; me.resize(); me.setup(); me.draw(); };

    // The browser took the WebGL context away (phones do that in the background or when memory runs low): until it gives it
    // back, the block shows its plain look (the class stipple-failed, see the styles) instead of a black or frozen canvas.
    // When it is back, everything is made again and the dots carry on.
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); me.lost = true; host.classList.add("stipple-failed"); });
    canvas.addEventListener("webglcontextrestored", () => {
      try { me.g = makeGL(gl); } catch (err) { console.warn("stipple:", err); return; }
      me.lost = false;
      host.classList.remove("stipple-failed");
      me.redraw();
      wake();
    });
    new ResizeObserver(me.redraw).observe(host);
    new IntersectionObserver((entries) => { me.visible = entries[entries.length - 1].isIntersecting; wake(); }, { rootMargin: "100px 0px" }).observe(host);

    host.fmStipple = me;
    instances.push(me);
    me.redraw();                                       // first frame right away (and the still frame for reduced motion)
  }

  // ── one loop for all blocks; a block that is off screen is skipped ──
  let raf = 0, last = 0;
  function frame(now) {
    fmPace.frame(now);
    if (!fmPace.due(last, now)) { raf = requestAnimationFrame(frame); return; }   // the lighter mode for weak devices: every second frame only
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0.016;
    last = now;
    let any = false;
    instances.forEach((me) => {
      if (!me.visible || me.lost) return;
      any = true;
      me.step(dt);
      me.draw();
    });
    raf = any && !document.hidden && !api.paused ? requestAnimationFrame(frame) : 0;
  }
  function wake() {
    if (raf || reduceMotion || document.hidden || api.paused) return;
    if (!instances.some((me) => me.visible && !me.lost)) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", wake);

  // A set's blocks are set up only when one of them comes within one screen of the visible part of the page
  // (all blocks of the set together: the stat cards slide in from the side). Setting up WebGL takes a moment on a weak
  // phone, and these blocks are far down the page.
  function boot() {
    Object.keys(SETS).forEach((name) => {
      const hosts = [...document.querySelectorAll(SETS[name].hosts)];
      if (!hosts.length) return;
      const mountAll = () => hosts.forEach((host) => { try { mount(host, SETS[name]); } catch (err) { console.warn("stipple:", err); } });
      if (!window.IntersectionObserver) return mountAll();
      const near = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        near.disconnect();
        setTimeout(mountAll, 0);                       // in a task of its own, not together with the other work of this moment
      }, { rootMargin: "100% 0px" });
      hosts.forEach((host) => near.observe(host));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // For the tuner page and for quick experiments in the console: change fmStipple.settings (the stat cards)
  // or fmStipple.cta (the CTA card), then call fmStipple.update()
  window.fmStipple = Object.assign(api, {
    settings: STIPPLE,
    cta: STIPPLE_CTA,
    sets: SETS,
    update() { instances.forEach((me) => me.redraw()); wake(); },
    instances
  });
})();


/* ═══════════ section illustrations (drawn in code instead of the s1…s3 and royalty PNGs) ═══════════ */
(() => {
  // ── where the pictures are: the folder with the uploaded art-* files ──
  const ASSETS = "d/";
  // The files the drawings use (photos at twice their size in the Figma frame; an .svg can be any size, only its proportions matter):
  //   s1-1  art-card-video.png, art-card-hoodie.png, art-card-cap.png, art-card-home.png, art-card-concert.png   320×320 each, the whole card as one flat picture
  //   s1-2  art-thumb-home.png 90×90 · art-face-mark.png 210×210 (also used in s1-3) · art-face-petr.png 90×90 · art-icon-calendar.svg 24×24
  //   s1-3  art-face-anna.png, art-face-elvira.png 210×210 · art-thumb-lastseen.png 53×53
  //   s2-1  art-icon-signature.svg 34×32
  //   s3-2  art-icon-video.svg, art-icon-copyright.svg, art-icon-star.svg, art-icon-brush.svg, art-icon-tshirt.svg   56×56 each: the glyph centred in a box as big as its circle
  //   s3-3  art-cube.png (the cube alone, transparent background), art-cube-bg.png (the cube on its green background)   596×596 each
  //   royalty-2  art-logo-spotify.svg, art-logo-apple-music.svg, art-logo-vk-music.svg, art-logo-yandex-music.svg   168×32 each:
  //              the whole line with the logo, as it is in Figma (the logo at the left, the rest of the line empty), exported as SVG
  // Photos are square files: the circles and rounded corners are cut here, in the code.

  // ── where each illustration goes ──
  // The second selector in each line is the block that shows the PNG in Taptop, so nothing has to change there.
  // If a block is ever rebuilt and gets a new id, give it the class from the first selector (art-s11 …) instead.
  // (The same list is in the styles, where it keeps the browser from downloading those PNGs.)
  const TARGETS = {
    "s1-1": ".art-s11, .div--u-iqmxy62zu",
    "s1-2": ".art-s12, .div--u-i19ky0v4l",
    "s1-3": ".art-s13, .div--u-ihccgwl5i",
    "s2-1": ".art-s21, .div--u-idnsn5pgf",
    "s2-2": ".art-s22, .div--u-irqclxvo5",
    "s3-1": ".art-s31, .div--u-izocvxw9j",
    "s3-2": ".art-s32, .div--u-iw132kbgd",
    "s3-3": ".art-s33, .div--u-i2lqr5l9e",
    "royalty-1": ".art-royalty1, .div--u-i60l9uhmv",
    "royalty-2": ".art-royalty2, .div--u-ictcjbusr"
  };

  const SIZE = 1000;                       // an illustration is drawn on a 1000×1000 stage, in the px of the Figma frame
                                           // (a drawing made in a frame of another size says so itself: see "size" in royalty-1)
  const LIMIT = 2000;                      // …and is never laid out or painted with more than this many px a side
  const file = (name) => ASSETS + name;
  const at = (x, y) => "left:" + x + "px;top:" + y + "px";
  // a picture from the uploaded files. Extra classes: fm-in = flows inside its parent, fm-face = square photo cropped to a circle
  const pic = (name, style, classes) => '<img' + (classes ? ' class="' + classes + '"' : "") + ' src="' + file(name) + '" alt="" decoding="async" style="' + style + '">';

  // On the page the stage is not as wide as in Figma. It is laid out at about the size it has on screen, and one Figma px
  // is var(--fm-px) long there (the script sets --fm-px for every drawing, see fit() below).
  // Why: a big stage that is only scaled down looks the same, but iPhones and iPads keep every moving part of it
  // in memory at the full size (times the screen's pixel density). That took hundreds of MB and crashed the page.
  // So all the numbers below stay as they are in Figma, and:
  //   · every "…px" in a drawing's HTML is turned into calc(… * var(--fm-px)) when the drawing is put on the page (toUnits);
  //   · wherever the script sets a length later on, it uses unit();
  //   · the styles of the drawings are written with calc(… * var(--fm-px)) as well.
  const unit = (v) => "calc(" + v + "*var(--fm-px))";
  const toUnits = (html) => html.replace(/(-?\d*\.?\d+)px/g, "calc($1*var(--fm-px))");
  // A canvas that covers the whole stage: it gets as many pixels as the stage has on screen, and is drawn on in Figma px
  function stageCanvas(canvas, pixels) {
    canvas.width = canvas.height = pixels;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(pixels / SIZE, 0, 0, pixels / SIZE, 0, 0);
    return ctx;
  }
  let uid = 0;                             // keeps SVG gradient ids unique on the page

  // ── small shapes ──
  const ARROW = '<svg class="fm-in" width="32.5" height="32.5" viewBox="0 0 52 52"><path fill="#000" fill-opacity=".6" d="M27.4 12.23c.42-.42 1.11-.42 1.53 0l13 13c.43.43.43 1.11 0 1.54l-13 13c-.42.42-1.11.42-1.53 0-.42-.43-.42-1.11 0-1.54l11.15-11.15H10.83c-.6 0-1.08-.48-1.08-1.08s.49-1.08 1.08-1.08h27.72L27.4 13.77c-.42-.43-.42-1.11 0-1.54Z"/></svg>';

  // ── procedural bits ──

  // Deterministic random numbers, so the wobble looks the same on every visit
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const TAU = Math.PI * 2;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  // Smooth random values that drift instead of jumping: noise1 along a line, noise3 in space. Both return 0…1.
  const hash1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const noise1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash1(i) * (1 - u) + hash1(i + 1) * u; };
  const hash3 = (x, y, z) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let u = x - xi, v = y - yi, w = z - zi;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); w = w * w * (3 - 2 * w);
    const mix = (a, b, f) => a + (b - a) * f;
    return mix(
      mix(mix(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), mix(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
      mix(mix(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), mix(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
      w);
  }

  // An SVG path made of M, L, C, V and H commands (absolute coordinates) as a list of points close to each other
  function flatten(d, dx, dy) {
    const pts = [];
    let x = 0, y = 0;
    (d.match(/[MLCVH][^MLCVH]*/g) || []).forEach((part) => {
      const cmd = part[0], n = (part.slice(1).match(/-?\d*\.?\d+/g) || []).map(Number);
      if (cmd === "C") {
        for (let i = 0; i + 5 < n.length; i += 6) {
          for (let k = 1; k <= 60; k++) {
            const t = k / 60, u = 1 - t;
            pts.push([
              u * u * u * x + 3 * u * u * t * n[i] + 3 * u * t * t * n[i + 2] + t * t * t * n[i + 4] + dx,
              u * u * u * y + 3 * u * u * t * n[i + 1] + 3 * u * t * t * n[i + 3] + t * t * t * n[i + 5] + dy
            ]);
          }
          x = n[i + 4]; y = n[i + 5];
        }
        return;
      }
      if (cmd === "V") y = n[0]; else if (cmd === "H") x = n[0]; else { x = n[0]; y = n[1]; }
      pts.push([x + dx, y + dy]);
    });
    return pts;
  }

  // The comet tails of s3-2. In Figma: a tapering gradient line, blurred more towards its tip.
  // A tail is two pictures. The coarse one (one canvas pixel per `block` px of the stage) runs from the tip to where the tail is still
  // and is repainted while the tail flies. The fine one never changes: it carries the tail into its payment, and on the way
  // the softness of the edge melts away until the tail is as sharp as the payment. So the payment has no background of its own on the left.
  // These are the settings of the "Tail tuner" page, under the same names and in the same units,
  // so a set of values copied from that page can be put here as it is. Lengths are px of the 1000px drawing.
  const TAIL = {
    // shape: a soft wedge that grows from a blurred point to the height of the payment
    length: 635.526,        // how long the tail is; its right end stays under the payment
    thick: 88.421,          // thickness at the payment (88.421 = the height of the payment)
    fullAt: 66.6,           // % of the length (from the tip) where it reaches that thickness
    blur: 22.3125,          // blur at the tip
    sharpAt: 77.2,          // % of the length where the blur is gone
    edge: 0.5,              // softness of the edge where there is no blur
    crispAt: 94,            // % of the length from where the edge is fully sharp (the softness melts away between animEnd and here)
    grain: 0,               // fine grain on the sharper edges of the coarse picture (0 = none)
    grainBelow: 7.35,       // the grain shows only where the blur is weaker than this
    // colour from the tip to the payment: c0 fades in from nothing, turns into c1, then into c2
    c0: "#fbff00", c1: "#00cc37", c2: "#ffffff",
    p1: 31.41,              // % of the length where the colour is c1
    p2: 62.81,              // % of the length from where it is c2
    opaqueAt: 31.41,        // % of the length from where the tail is fully opaque
    // streaks: thin gaps that rush through the tail from the payment to the tip
    streaks: 35,            // % how deep they cut during a burst
    calm: 35,               // % of that between bursts
    flow: 787.5,            // their speed, px per second
    streakLen: 15,          // length of one streak
    streakThick: 1.5,       // thickness of one streak
    streakFill: 58,         // % how much of the tail they cut
    streakSoft: 0.8,        // softness of their edges (0.05 hard … 0.8 soft)
    // waving of the loose part
    animEnd: 77.2,          // % of the length from where the tail is still: the fine picture takes over there
    swell: 16,              // % how much it gets thicker and thinner
    swellWaves: 1.7507,     // waves of that along the tail
    swellSpeed: 2.5,        // waves per second
    snake: 3.465,           // how far it bends up and down
    snakeWaves: 1.1141,
    snakeSpeed: 1.0345,
    // flight of the payment with its tail
    sway: 15,               // how far it drifts ahead and falls back
    swaySpeed: 1,           // × the basic speed of that drift
    shake: 3.5,             // how far it shakes during a burst
    shakeRate: 1,           // × the basic speed of the shaking
    burstEvery: 5,          // seconds between bursts of the first payment (each next one: 0.7s more)
    burstSharp: 2,          // higher = shorter bursts with longer calm between them
    follow: 50,             // % of the shake that the tail repeats
    // smoothness against work for weak phones
    every: 5,               // a tail is repainted on every …th frame
    block: 2                // size of one canvas pixel
  };
  const TAIL_PAD = Math.max(52.5, TAIL.blur * 2.2, TAIL.snake + TAIL.thick * TAIL.swell / 400 + 12);   // empty room around the tail on its canvas
  const erf = (x) => {
    const s = x < 0 ? -1 : 1, a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
  };
  const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
  // Where the two pictures of a tail meet, as shares of its length
  const TAIL_JOIN = (() => {
    const T = TAIL, lag = (T.shake + 1.5) / T.length;                                  // the fine picture shakes with the payment: it comes in this much earlier, so no gap can open
    const from = Math.min(T.animEnd, 85) / 100, to = from + Math.max(0.05, 2 * lag + 16 / T.length);   // between `from` and `to` the fine picture takes the place of the coarse one
    const crisp = Math.min(0.94, Math.max(T.crispAt / 100, to + 0.03)), solid = crisp + 0.03;           // the edge is fully sharp at `crisp`; the payment's own white takes over by `solid`
    return { from, to, lag, crisp, solid };
  })();
  // colour along the tail: c0 → c1 → c2
  const tailTone = (() => {
    const T = TAIL, p1 = T.p1 / 100, p2 = Math.max(T.p2 / 100, p1 + 0.001), c0 = rgb(T.c0), c1 = rgb(T.c1), c2 = rgb(T.c2);
    return (x) => {
      const k = x < p1 ? clamp01(x / p1) : clamp01((x - p1) / (p2 - p1)), from = x < p1 ? c0 : c1, to = x < p1 ? c1 : c2;
      return [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, from[2] + (to[2] - from[2]) * k];
    };
  })();
  // The fine picture, the same for every payment: drawn once for a size of the drawing, then copied.
  // FINE: its canvas pixels per px of the drawing (one per screen pixel). Returns its canvas and where it sits: px from the tail's tip and from its axis.
  const FINE_TAIL = 24;                                      // px it runs on under the payment's white, fading out (hides a hair's difference between the two edges)
  let fine = null;
  function finePicture(FINE) {
    if (fine && fine.scale === FINE) return fine;
    const T = TAIL, J = TAIL_JOIN, half = T.thick / 2, fullAt = T.fullAt / 100, sharpAt = T.sharpAt / 100, opaqueAt = Math.max(0.001, T.opaqueAt / 100);
    // softness of the edge and how far it sits inside the payment's edge: as in the coarse picture at first, none at `crisp`
    const edgeAt = (x) => {
      const done = smooth((x - J.to) / (J.crisp - J.to));
      const soft = Math.hypot(Math.max(T.edge, T.blur * clamp01(1 - x / sharpAt)) * 1.4142, T.block * 0.4);   // + the softness of the coarse picture's big pixels
      return [soft + (0.5 - soft) * done, T.edge * (1 - done)];
    };
    const room = Math.ceil(2.3 * edgeAt(J.from)[0] + 2), left = J.from * T.length, solid = J.solid * T.length, right = solid + FINE_TAIL;
    const w = Math.ceil((right - left) * FINE), h = Math.ceil((2 * half + 2 * room) * FINE);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d"), image = ctx.createImageData(w, h), px = image.data;
    for (let cx = 0; cx < w; cx++) {
      const at = left + (cx + 0.5) / FINE, x = at / T.length, [sigma, inset] = edgeAt(x), c = tailTone(x);
      const halfHere = half * clamp01(x / fullAt) - inset, shown = clamp01(x / opaqueAt);
      const turn = smooth((x - J.from - J.lag) / (J.to - J.lag - J.from));   // how far the coarse picture below has faded: it shows whole × (1 - turn)
      const lead = smooth((at - left) / 1.5);                                // the solid middle comes in at once, before the coarse picture starts to fade
      const leave = 1 - smooth((at - solid - 4) / (FINE_TAIL - 4));          // the fade-out under the payment's white
      for (let cy = 0; cy < h; cy++) {
        const y = (cy + 0.5) / FINE - room - half, i = (cy * w + cx) * 4;
        const whole = shown * 0.5 * (erf((halfHere - y) / sigma) + erf((halfHere + y) / sigma));   // the tail as it should look here
        // exactly what is missing over the coarse picture; and the solid middle in any case
        const missing = (whole * turn) / (1 - whole * (1 - turn) + 1e-6), middle = lead * smooth((whole - 0.97) / 0.03);
        px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
        px[i + 3] = 255 * leave * Math.max(missing, middle);
      }
    }
    ctx.putImageData(image, 0, 0);
    return (fine = { canvas, scale: FINE, left, top: -half - room, width: w / FINE, height: h / FINE, pivot: solid - left });
  }
  // Prepares the coarse picture of one tail and returns the function that paints it for a moment in time (burst 0…1: how hard it is flying right now)
  function makeTail(canvas, seed) {
    const T = TAIL, J = TAIL_JOIN, block = T.block, half = T.thick / 2, pad = TAIL_PAD;
    const fullAt = T.fullAt / 100, sharpAt = T.sharpAt / 100, opaqueAt = Math.max(0.001, T.opaqueAt / 100);
    const w = Math.ceil((T.length * J.to + pad) / block), h = Math.ceil((2 * half + 2 * pad) / block), mid = (h - 1) / 2;
    canvas.width = w; canvas.height = h;
    canvas.style.width = unit(w * block); canvas.style.height = unit(h * block);
    const ctx = canvas.getContext("2d"), image = ctx.createImageData(w, h), px = image.data, rnd = seeded(seed);
    const still = new Float32Array(w * h);                 // the tail at rest: how solid every pixel is
    const dust = new Float32Array(w * h);                  // the grain: how much every pixel is pushed towards solid or clear
    const loose = new Float32Array(w), top = new Int16Array(w), bottom = new Int16Array(w);
    let reach = 0;                                         // the columns from the tip up to here are repainted while the tail flies
    for (let cx = 0; cx < w; cx++) {
      const x = ((cx + 0.5) * block - pad) / T.length;                      // 0 at the tip, 1 where the tail ends under the payment
      const halfHere = half * clamp01(x / fullAt) - T.edge;                 // the line gets wider towards the payment…
      const blur = T.blur * clamp01(1 - x / sharpAt);                       // …and sharper
      const sigma = Math.max(T.edge, blur) * 1.4142, grain = T.grain * clamp01(1 - blur / T.grainBelow) * 4;   // grain only where the edge is sharp
      loose[cx] = clamp01(1 - x / J.from);                                  // 1 at the tip, 0 where the tail is still
      if (loose[cx] > 0) reach = cx + 1;
      const c = tailTone(x);
      const shown = x > 0 ? clamp01(x / opaqueAt) * (1 - smooth((x - J.from - J.lag) / (J.to - J.lag - J.from))) : 0;   // it fades out where the fine picture takes its place
      let first = h, last = -1;
      for (let cy = 0; cy < h; cy++) {
        const y = (cy + 0.5) * block - pad - half, i = cy * w + cx;         // distance from the tail's axis
        still[i] = 0.5 * (erf((halfHere - y) / sigma) + erf((halfHere + y) / sigma)) * shown;
        dust[i] = (rnd() - 0.5) * grain;
        px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2];
        if (still[i] > 0.003) { first = Math.min(first, cy); last = cy; }
      }
      if (last < 0) { top[cx] = 1; bottom[cx] = 0; continue; }             // nothing to paint in this column
      const room = Math.max(5, Math.ceil((((last - first) / 2) * T.swell / 100 + T.snake / block) * loose[cx]) + 2);   // room for the swelling and snaking
      top[cx] = Math.max(0, first - room); bottom[cx] = Math.min(h - 1, last + room);
    }
    // streaks: a strip of smooth smudges that is slid along the tail (it repeats every SW pixels, without a seam)
    const CELLS = 6, SW = Math.max(CELLS * 2, Math.round((CELLS * T.streakLen) / block)), streak = new Float32Array(SW * h);
    const across = block / T.streakThick, cutFrom = 1 - T.streakFill / 100;
    const knot = (ix, iy) => hash3(((ix % CELLS) + CELLS) % CELLS, iy, seed);
    for (let cy = 0; cy < h; cy++) {
      const gy = cy * across, iy = Math.floor(gy), fy = gy - iy, v = fy * fy * (3 - 2 * fy);
      for (let sx = 0; sx < SW; sx++) {
        const gx = (sx / SW) * CELLS, ix = Math.floor(gx), fx = gx - ix, u = fx * fx * (3 - 2 * fx);
        const n = (knot(ix, iy) * (1 - u) + knot(ix + 1, iy) * u) * (1 - v) + (knot(ix, iy + 1) * (1 - u) + knot(ix + 1, iy + 1) * u) * v;
        const s = clamp01((n - cutFrom) / T.streakSoft);
        streak[cy * SW + sx] = s * s * (3 - 2 * s);
      }
    }
    // the part beyond `reach` never changes: paint it once
    for (let i = 0; i < w * h; i++) px[i * 4 + 3] = 255 * (still[i] + dust[i] * still[i] * (1 - still[i]));

    const swell = T.swell / 100, swellK = T.swellWaves * TAU, swellW = T.swellSpeed * TAU;
    const snake = T.snake / block, snakeK = T.snakeWaves * TAU, snakeW = T.snakeSpeed * TAU, calm = T.calm / 100;
    return (time, burst) => {
      const slide = (time * T.flow) / block, si = Math.floor(slide), sf = slide - si;
      const strength = (T.streaks / 100) * (calm + (1 - calm) * burst);
      for (let cx = 0; cx < reach; cx++) {
        const free = loose[cx], x = cx / w;
        const widen = 1 / (1 + swell * free * Math.sin(x * swellK + time * swellW + seed));   // thicker and thinner, in waves running to the tip
        const lift = snake * free * Math.sin(x * snakeK + time * snakeW + seed * 2);          // and it snakes a little
        const cutting = strength * Math.min(1, free * 2.5);
        const a0 = (cx + si) % SW, a1 = (a0 + 1) % SW;
        for (let cy = top[cx], end = bottom[cx]; cy <= end; cy++) {
          const row = mid + (cy - mid) * widen - lift, r0 = Math.floor(row), f = row - r0, i = cy * w + cx;
          let solid = r0 >= 0 && r0 < h - 1 ? still[r0 * w + cx] * (1 - f) + still[(r0 + 1) * w + cx] * f : 0;
          solid *= 1 - cutting * (streak[cy * SW + a0] * (1 - sf) + streak[cy * SW + a1] * sf);
          px[i * 4 + 3] = 255 * (solid + dust[i] * solid * (1 - solid));
        }
      }
      ctx.putImageData(image, 0, 0);
    };
  }

  // The soft wedge under each document of s2-1 that fades the document behind into the background.
  // In Figma: a four-cornered shape, transparent on the left, blurred more and more towards the right.
  // It is the same for all four documents, so it is drawn once and copied onto a small canvas under each one.
  // (It used to be turned into a PNG picture first. On phones that meant reading the canvas back from the graphics chip
  // and encoding it, the slowest single step of the whole start of the page.)
  const FADE = { w: 366.316, h: 304.737, corner: 157.895, pad: 60, block: 2.4, blur: 25.2, color: [245, 110, 0] };
  let fadeCanvas = null;
  function fadePicture() {
    if (fadeCanvas) return fadeCanvas;
    const F = FADE, w = Math.ceil((F.w + 2 * F.pad) / F.block), h = Math.ceil((F.h + 2 * F.pad) / F.block);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d"), image = ctx.createImageData(w, h), px = image.data;
    for (let cx = 0; cx < w; cx++) {
      const x = (cx + 0.5) * F.block - F.pad, along = Math.min(1, Math.max(0, x / F.w));
      const sigma = Math.max(0.9, F.blur * along) * 1.4142;
      const bottom = F.corner + (F.h - F.corner) * along;                 // the slanted lower edge
      const right = 0.5 * (1 - erf((x - F.w) / (F.blur * 1.4142)));
      for (let cy = 0; cy < h; cy++) {
        const y = (cy + 0.5) * F.block - F.pad, i = (cy * w + cx) * 4;
        px[i] = F.color[0]; px[i + 1] = F.color[1]; px[i + 2] = F.color[2];
        px[i + 3] = 255 * along * right * 0.5 * (erf(y / sigma) - erf((y - bottom) / sigma));
      }
    }
    ctx.putImageData(image, 0, 0);
    return (fadeCanvas = canvas);
  }

  // ── the illustrations ──
  // The eight of s1…s3 keep moving for as long as they are on screen. The two royalty drawings build themselves up once
  // and then stay as they are. Everything about that build-up is set here, for both of them.
  //
  // Times. "play" is the length of the whole build-up in seconds, the same for both drawings. Every other moment or length
  // of time is a part of it: 0 is the start, 1 the end, 0.1 a tenth of it. So "play" alone makes everything slower or faster.
  // A share or a report that is still on its way when the time is over is not cut off: it finishes its way, and the drawing
  // simply takes that little bit longer. (The labels, the rows and the sum are always ready exactly at the end.)
  //
  // Eases: how a movement speeds up and slows down. Each one is a GSAP ease (GSAP is loaded by the site-wide code):
  //   · the name of one of your own curves from the list "curves" at the top of the settings: "smooth", "overshoot"
  //   · a name: "none" (even speed), "power1.out" … "power4.out" (slowing down, more and more sharply), "sine.inOut",
  //     "expo.out", "back.out(1.7)" (goes past its place and settles back: the number is how far), "elastic.out(1, 0.4)" …
  //   · or a CustomEase curve, drawn in GSAP's ease visualizer (gsap.com/docs/v3/Eases). It can be written the way the visualizer
  //     gives it, CustomEase.create("custom", "M0,0 C0.3,1.4 0.6,1 1,1"), or as the curve alone, "M0,0 C0.3,1.4 0.6,1 1,1",
  //     or as the four numbers of a cubic-bezier, "0.3, 1.4, 0.6, 1". (Inside the quotes of a setting, write the inner quotes as ' .)
  // (The same names are used on the "royalty lab" page, so the values tried out there can be pasted here as they are.)
  /* ROYALTY:START */
  const ROYALTY = {
    // Curves of your own. Each is written once, here, and used by its name in the eases below ("smooth", "overshoot"):
    // change a curve and every ease that names it follows. More curves can be added to the list under names of their own.
    curves: {
      smooth: "M0,0 C0,0.371 0.046,0.601 0.244,0.8 0.443,1 0.699,1 1,1",                // slows down softly into its place
      overshoot: "M0,0 C0,0.672 0.124,1.171 0.353,1.167 0.559,1.162 0.595,1.006 1,1"   // goes about 17% past its place and settles back
    },

    play: 2.6,                    // seconds for the whole build-up of one drawing
    wait: 0.3,                    // seconds between "the card is there and the drawing is on screen" and the start
    seen: 0.35,                   // how much of a drawing's block must be on screen before it starts (0.35 = 35%)

    // royalty-1, the ring. A share appears and travels round the ring to its place; its label follows it. (Whose turn it is when: "turn" in the drawing.)
    shareGap: 0.2,                // a share starts this long after the one before it
    shareTime: 0.8,               // how long a share takes to arrive
    shareTurn: 0.3,               // how far round the ring it travels on the way: a part of the full circle (0.25 = a quarter)
    shareGrow: 0.6,               // how long it is when it appears, as a part of its own length (1 = full length from the start)
    whiteGrow: 0,                 // how long its fade from clear to white is when it appears, as a part of the length that fade has at the end (1 = full length from the start)
    shareEase: "smooth",          // its travelling and growing
    shareFade: 0.6,               // it is fully visible after this part of its way
    shareFadeEase: "power1.out",  // its fading in
    clear: 0,                     // the white of a share is gone this far before the white end of the share behind it (a part of the circle; 0 = gone exactly where that end begins)
    labelAfter: 0.02,             // a label starts this long after its own share has started
    labelTurn: 0.06,              // how far round the ring a label travels on the way
    labelEase: "overshoot",       // its travelling
    labelFade: 0.1,               // it is fully visible after this part of its way (small = hardly any moment of being see-through)
    labelFadeEase: "power2.out",  // its fading in
    sumShows: 0.6,                // the sum has faded in by this moment
    sumEase: "smooth",            // its counting up from 0, which takes the whole length
    // (a label takes the time that is left after shareGap and labelAfter, so the last label arrives exactly at the end)

    // royalty-2, the reports. They come up from below one after another; then the rows come up line by line from the top.
    sheetGap: 0.15,               // a report starts this long after the one before it
    sheetTime: 0.8,               // how long a report takes to arrive
    sheetRise: 60,                // how far below its place it starts, Figma px
    sheetEase: "overshoot",       // its rising
    sheetFade: 0.4,               // it is fully visible after this part of its way
    sheetFadeEase: "overshoot",   // its fading in (going past 1 changes nothing: fully visible is fully visible)
    rowsAt: 0.56,                 // the first line of rows starts here (the pause after the reports)
    rowTime: 0.16,                // how long one row takes to appear
    rowRise: 16,                  // how far below its place a row starts, Figma px
    rowEase: "smooth",            // its rising
    rowFadeEase: "power3.out"     // its fading in, from fully see-through
    // (the lines follow each other so that the last one is ready exactly at the end)
  };
  /* ROYALTY:END */

  // Reads the text of an ease the way it may have been pasted: the whole CustomEase.create("name", "M0,0 C…") line from the
  // ease visualizer, with or without "ease:" in front and a comma behind, a cubic-bezier(…) from CSS, or a name in quotes.
  // What is left is a name ("power3.out") or a curve ("M0,0 C…", or four numbers).
  function easeText(text) {
    let t = String(text == null ? "" : text).trim();
    const made = t.match(/CustomEase\s*\.\s*create\s*\(\s*(?:(["'`])[^"'`]*\1\s*,\s*)?(["'`])([^"'`]*)\2/);
    if (made) return made[3].trim();
    t = t.replace(/^ease\s*:\s*/, "").replace(/[,;]\s*$/, "").trim().replace(/^(["'`])([\s\S]*)\1$/, "$2").trim();
    const css = t.match(/^cubic-bezier\s*\(([^)]*)\)$/);
    return css ? css[1].trim() : t;
  }
  const isCurve = (text) => /^(M|-?[\d.]+\s*,)/.test(text);
  // Turns the text of an ease into the function that does it. If GSAP did not load, or the text is not an ease,
  // a plain slowing-down is used instead, so the drawings still build up. (checkEase tells which of the two happened.)
  const plainEase = (t) => 1 - Math.pow(1 - t, 3);
  const made = {};                                           // the curves that have been made already, by their text
  function easing(text) {
    const gsap = window.gsap, named = easeText(text);
    const t = Object.prototype.hasOwnProperty.call(ROYALTY.curves, named) ? easeText(ROYALTY.curves[named]) : named;   // one of your own curves, by its name
    if (!gsap) return plainEase;
    try {
      if (isCurve(t)) {                                      // a CustomEase curve
        if (made[t]) return made[t];
        if (!window.CustomEase) return plainEase;
        gsap.registerPlugin(CustomEase);
        const curve = CustomEase.create("fmCurve" + Object.keys(made).length, t);
        return typeof curve === "function" && isFinite(curve(0.5)) ? (made[t] = curve) : plainEase;
      }
      return gsap.parseEase(t) || plainEase;
    } catch (err) { return plainEase; }
  }

  const ART = {

    // S1 · 1 — grid of tiles: video, merch, cover, concert
    "s1-1"() {
      // ── settings of the animation ──
      // The white tiles shimmer: each one keeps getting brighter and dimmer, without ever stopping.
      // A tile is moved by two things at once, both in the styles: a quick flicker (fm-shimmer) and a slower swell
      // that dims the flicker and lets it out again (fm-dim). Every tile has its own pair of speeds and its own start,
      // so no two tiles ever keep in step.
      const FAST = 0.5, FAST_STEP = 0.04;   // seconds one way for the quickest flicker, and how much slower each next "pace" is
      const SLOW = 1.15, SLOW_STEP = 0.08;  // the same for the swell
      const rnd = seeded(7);
      // a white tile: its position, its opacity in the design (visitors who turned on "reduce motion" see that one),
      // and its two paces, 0…10. Tiles next to each other have paces far apart.
      const tile = (x, y, alpha, quick, slow) => {
        const flicker = FAST + quick * FAST_STEP, swell = SLOW + slow * SLOW_STEP;
        return '<div class="fm-tile fm-blink" style="' + at(x, y) + ";opacity:" + alpha + ";animation-duration:" + swell.toFixed(2) + "s;animation-delay:" + (-rnd() * 2 * swell - 1).toFixed(2) + 's">'
          + '<i style="animation-duration:' + flicker.toFixed(2) + "s;animation-delay:" + (-rnd() * 2 * flicker - 1).toFixed(2) + 's"></i></div>';
      };
      // a tile with content: one flat picture (photo, play button, price, date are all part of the file)
      const card = (x, y, name) => pic(name, at(x, y), "fm-tile");
      return { html:
        tile(420, 68, 0.2, 5, 2) + tile(772, 245, 0.2, 8, 6) + tile(68, 421, 0.2, 0, 7) + tile(772, 421, 0.3, 3, 0)
        + tile(68, 597, 0.1, 6, 3) + tile(244, 772, 0.2, 10, 1) + tile(772, 772, 0.2, 7, 5)
        + tile(420, 245, 0.3, 1, 9) + tile(596, 421, 0.1, 9, 4) + tile(244, 597, 0.3, 2, 8) + tile(596, 597, 0.3, 4, 10)
        + card(244, 244, "art-card-video.png")
        + card(596, 244, "art-card-hoodie.png")
        + card(244, 420, "art-card-cap.png")
        + card(420, 420, "art-card-home.png")
        + card(420, 596, "art-card-concert.png")
      };
    },

    // S1 · 2 — project fields on wobbly rings
    "s1-2"() {
      // The four rings drawn in Figma, from the inside out: base curve, its position, opacity,
      // and the "dynamic stroke" settings (frequency, wiggle). The second one is the main ring the fields sit on.
      // A dynamic stroke is a smooth curve whose outline is pushed sideways by a random amount every `line width × frequency` px.
      const LINE = 4.13;       // width of the rings' line
      const KEYS = [
        ["M198.97.07C169.78 1.09 40.26 19.23 23.5 74.87 2.55 144.42-23.64 191.66 40.52 217.25 104.69 242.84 100.11 308.45 158.38 320.26 216.65 332.07 329.93 217.9 281.47 135.23 233.02 52.56 263.76-2.2 198.97.07", 323.512, 320.939, 0.1, 3.2, 2.7],
        ["M313.77.11C267.73 1.71 63.49 30.26 37.06 117.81 4.02 227.26-37.28 301.6 63.9 341.87 165.09 382.13 157.86 485.38 249.75 503.97 341.64 522.55 520.27 342.9 443.86 212.8 367.46 82.71 415.92-3.46 313.77.11", 238.961, 228.937, 0.5, 1.9, 2],
        ["M436.27 0C638.64 0 551.91 161.51 626.25 182.75 767.31 223.06 702.65 357.24 626.25 388.22 540.81 422.86 607.66 670.09 375.35 670.09 143.04 670.09 245.02 515.43 101.74 487.34-56.24 456.36 20.28 368.6 7.78 282.9-4.72 197.21 8.81 157.97 54.24 125.96 104.29 90.71 158.52 105.31 236.99 76.4 315.46 47.49 323.72 0 436.27 0", 138.144, 152.636, 0.1, 3, 2.2],
        ["M610.26 0C888.84 0 769.45 222.24 871.79 251.46 1065.97 306.92 976.97 491.56 871.79 534.17 754.18 581.83 875.68 920.99 555.88 920.99 236.07 920.99 301.58 814.6 174.43 726.37 47.94 638.61 13.16 496.13 2.46 422.81-8.24 349.49 15.81 204.08 78.35 160.04 147.24 111.52 227.91 144.91 335.93 105.13 443.96 65.35 455.33 0 610.26 0", -5.218, 26.671, 0.05, 5, 3]
      ];
      // ── settings of the animation ──
      const BEAT = 0.6;        // seconds per beat: the main ring is struck on every beat
      const HIT = 0.4;         // how much stronger the wobble gets on a beat (0 = no pulse)
      const DRIFT = 0.55;      // how fast the wobble changes shape by itself
      const OUT = 2.5, OUT_BEATS = 8;     // a wave going outwards travels this far (2 = the outermost drawn ring) in this many beats
      const IN = -1.6, IN_BEATS = 4;      // a wave going inwards (-1 = the inner drawn ring)
      const GAIN = 1.1;        // matches the strength of the wobble to Figma's
      const SHAPE = 15;        // how far the outline of the main ring is pushed out and pulled in by the waves below, px (its size stays the same)
      const SHAPE_SPEED = 1;   // how fast those waves run (2 = twice as fast)
      const FLOAT = 5;         // how far a field floats by itself, on top of riding the waves, px
      // The outline moves like a wave: a few sets of crests run around the ring, each at its own speed, and add up.
      // Each one is [number of crests, speed (negative = the other way round), where they start, share of SHAPE]
      const WAVES = [[2, 1.1, 1.1, 0.45], [3, -0.8, 4, 0.35], [5, 1.7, 2.3, 0.2]];
      const drift = (angle, time) => {
        let d = 0;
        for (let j = 0; j < WAVES.length; j++) d += WAVES[j][3] * Math.sin(WAVES[j][0] * angle - time * WAVES[j][1] * SHAPE_SPEED + WAVES[j][2]);
        const rise = clamp01(time / 2);                    // the waves grow from nothing in the first two seconds: the drawing starts from its shape in Figma
        return d * SHAPE * rise * rise * (3 - 2 * rise);
      };

      // Every ring is kept as a distance from one centre for N directions, so one ring can turn into another smoothly
      const CX = 467.35, CY = 469.44, N = 420;
      const cos = new Float32Array(N), sin = new Float32Array(N), X = new Float32Array(N), Y = new Float32Array(N), PX = new Float32Array(N), PY = new Float32Array(N);
      const bend = new Float32Array(N);    // how far the waves push the main ring's outline at this moment, for every direction
      for (let k = 0; k < N; k++) { cos[k] = Math.cos((k / N) * TAU); sin[k] = Math.sin((k / N) * TAU); }
      const radii = KEYS.map(([curve, x, y]) => {
        const polar = flatten(curve, x, y).map(([px, py]) => [(Math.atan2(py - CY, px - CX) + TAU) % TAU, Math.hypot(px - CX, py - CY)]).sort((a, b) => a[0] - b[0]);
        const out = new Float32Array(N), count = polar.length;
        for (let k = 0, i = 0; k < N; k++) {
          const a = (k / N) * TAU;
          while (i < count && polar[i][0] < a) i++;
          const p = polar[(i + count - 1) % count], q = polar[i % count];
          const span = (q[0] - p[0] + TAU) % TAU || 1, f = ((a - p[0] + TAU) % TAU) / span;
          out[k] = p[1] + (q[1] - p[1]) * f;
        }
        return out;
      });

      // s says where a ring is between the drawn ones: -1 the inner ring, 0 the main ring, 1 and 2 the outer rings.
      // Its shape, opacity and stroke settings are blended from the two drawn rings it is between.
      const between = (s) => { const i = Math.min(2, Math.max(0, Math.floor(s + 1))); return [i, s + 1 - i]; };
      const setting = (j, s) => { const [i, f] = between(s); return KEYS[i][j] + (KEYS[i + 1][j] - KEYS[i][j]) * clamp01(f); };
      const opacity = (s) => s < -1 ? 0.1 * clamp01((s - IN) / (-1 - IN)) : s > 2 ? 0.05 * clamp01((OUT - s) / (OUT - 2)) : setting(3, s);

      function drawRing(s, z, strength) {
        const [i, f] = between(s), A = radii[i], B = radii[i + 1];      // f may run past 0…1: the ring keeps travelling
        const hold = clamp01(1 - Math.abs(s));                          // a ring leaves the main ring with its shape and loses it on the way
        let total = 0;
        for (let k = 0; k < N; k++) {
          const r = A[k] + (B[k] - A[k]) * f + bend[k] * hold;
          X[k] = CX + r * cos[k]; Y[k] = CY + r * sin[k];
          if (k) total += Math.hypot(X[k] - X[k - 1], Y[k] - Y[k - 1]);
        }
        total += Math.hypot(X[0] - X[N - 1], Y[0] - Y[N - 1]);
        const amount = 0.875 * LINE * setting(5, s) * strength * GAIN, R = total / (LINE * setting(4, s)) / TAU;
        for (let k = 0, len = 0; k < N; k++) {                           // push every point sideways, off the smooth ring
          const p = (k + N - 1) % N, n = (k + 1) % N, tx = X[n] - X[p], ty = Y[n] - Y[p], tl = Math.hypot(tx, ty) || 1;
          if (k) len += Math.hypot(X[k] - X[p], Y[k] - Y[p]);
          const a = (len / total) * TAU, off = (noise3(R * Math.cos(a) + 40, R * Math.sin(a) + 40, z) * 2 - 1) * amount;
          PX[k] = X[k] + (ty / tl) * off; PY[k] = Y[k] - (tx / tl) * off;
        }
        // a smooth line through the points
        ctx.beginPath();
        ctx.moveTo((PX[N - 1] + PX[0]) / 2, (PY[N - 1] + PY[0]) / 2);
        for (let k = 0; k < N; k++) {
          const n = (k + 1) % N;
          ctx.quadraticCurveTo(PX[k], PY[k], (PX[k] + PX[n]) / 2, (PY[k] + PY[n]) / 2);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // the fields: position, width, left padding, the picture or icon, and the two lines of text
      const face = (name) => pic(name, "width:44.738px;height:44.738px", "fm-in fm-face");
      const FIELDS = [
        [196.514, 293.061, 179.656, 18.585, pic("art-thumb-home.png", "width:44.742px;height:44.742px;border-radius:5.434px", "fm-in"), "Релиз", "HOME"],
        [530.455, 394.247, 307.686, 12.39, face("art-face-mark.png"), "Менеджер проекта", "Марк Новиков"],
        [177.929, 511.948, 268.451, 12.39, face("art-face-petr.png"), "Ответственный", "Петр Кузнецов"],
        [379.267, 683.344, 242.638, 18.585, pic("art-icon-calendar.svg", "width:53.69px;height:53.69px", "fm-in"), "Дата релиза", "17 сентября"],
        [464.965, 197.038, 261.224, 12.39, '<i style="width:28.635px;height:28.635px;border-radius:50%;background:#16d947"></i>', "Статус", "Готов к релизу"]
      ];
      const pill = ([x, y, w, pad, icon, label, value]) =>
        '<div class="fm-pill" style="' + at(x, y) + ";padding-left:" + pad + 'px"><i>' + icon + '</i><span><span class="fm-dim">' + label + "</span><span>" + value + "</span></span></div>";
      const angles = FIELDS.map(([x, y, w]) => Math.atan2(y + 39.235 - CY, x + w / 2 - CX));   // where every field sits on the ring, seen from its centre
      let canvas = null, ctx = null, fields = [];

      // animation: the main ring wobbles, and waves run along its outline, pushing it out and in; on every beat a ring leaves it,
      // outwards and inwards in turn, fading from 50% to 0% while its stroke turns into that of the distant rings.
      // The fields float: each one rides the outline of the ring where it sits, and drifts a little by itself.
      // The rings are drawn on a canvas: redrawing them there takes far less work than rewriting SVG lines 60 times a second.
      function tick(time, dt, px) {                          // px: how long one Figma px is on the page right now
        if (!ctx) return;
        for (let k = 0; k < N; k++) bend[k] = drift((k / N) * TAU, time);
        if (!STILL) fields.forEach((el, i) => {
          const out = drift(angles[i], time);
          const dx = out * Math.cos(angles[i]) + FLOAT * Math.sin(time * 0.9 + i * 2.1), dy = out * Math.sin(angles[i]) + FLOAT * Math.cos(time * 0.7 + i * 1.3);
          el.style.transform = "translate(" + (dx * px).toFixed(2) + "px," + (dy * px).toFixed(2) + "px)";
        });
        const beat = time / BEAT + 1.3, phase = beat % 1;
        const hit = HIT * (phase < 0.12 ? phase / 0.12 : Math.exp(-(phase - 0.12) * 3.2));
        const z = time * DRIFT;
        const draw = (s) => {
          const alpha = opacity(s);
          if (alpha <= 0.003) return;
          ctx.globalAlpha = alpha;
          drawRing(s, z + Math.abs(s) * 0.9, 1 + hit * (1 - clamp01(Math.abs(s))));
        };
        ctx.clearRect(0, 0, SIZE, SIZE);
        draw(0);
        for (let born = Math.floor(beat / 2) * 2; born > beat - OUT_BEATS; born -= 2) {          // outwards: on even beats
          const age = (beat - born) / OUT_BEATS;
          draw(OUT * (1 - (1 - age) * (1 - age)));                                               // fast at first, then slower
        }
        for (let born = Math.floor((beat - 1) / 2) * 2 + 1; born > beat - IN_BEATS; born -= 2) {  // inwards: on the beats between
          const age = (beat - born) / IN_BEATS;
          draw(IN * (1 - (1 - age) * (1 - age)));
        }
      }

      return { html:
        '<canvas class="fm-rings"></canvas>' + FIELDS.map(pill).join(""),
        init(stage) { canvas = stage.querySelector(".fm-rings"); fields = Array.from(stage.querySelectorAll(".fm-pill")); },
        // called when the drawing gets its size on screen, and again whenever that size changes
        resize(pixels) { ctx = stageCanvas(canvas, pixels); ctx.strokeStyle = "#fff"; ctx.lineWidth = LINE; ctx.lineJoin = "round"; },
        tick
      };
    },

    // S1 · 3 — activity feed
    "s1-3"() {
      // an empty line: a row as wide as the feed, with the visible bar centred in it. The animation changes only the width of that bar,
      // as a share of the feed's 500px (w / 5 is that share in %)
      const bar = (w, h, alpha, z) => '<i class="fm-bar" style="height:' + h + "px;z-index:" + z + '"><b style="width:' + (w / 5).toFixed(3) + "%;background:rgba(255,255,255," + alpha + ')"></b></i>';
      const chip = (inner, style) => '<span class="fm-chip" style="' + style + '">' + inner + "</span>";
      const status = (color, text) => chip('<i style="background:' + color + '"></i>' + text, "gap:7.762px;padding:6.579px 12.5px 6.579px 9.868px;border-radius:1000px");
      // a photo: it moves up and down (see fm-hover in the styles); "behind" is how many seconds it is behind the others
      const face = (name, x, y, behind) => pic(name, at(x, y) + ";animation-delay:" + (behind - 8) + "s", "fm-ava fm-face");
      // a message: width, layer, gap between its two lines, the lines, the photo
      const msg = (w, z, gap, line1, line2, photo) =>
        '<span class="fm-msg" style="width:' + w + "px;z-index:" + z + ";gap:" + gap + 'px"><span>' + line1 + "</span><span>" + line2 + "</span>" + photo + "</span>";
      const who = (name, did, alpha) => '<span class="fm-med">' + name + '&nbsp;</span><span style="color:rgba(0,0,0,' + alpha + ')">' + did + "</span>";
      const date = (text, pad, z) => '<span class="fm-date" style="padding:0 ' + pad + "px;z-index:" + z + '">' + text + "</span>";
      let bars = [];
      return { html: '<div class="fm-feed">'
        + bar(296.053, 6.579, 0.1, 17) + bar(197.368, 9.868, 0.2, 16) + bar(98.684, 13.158, 0.4, 15)
        + bar(197.368, 19.737, 0.5, 14) + bar(394.737, 23.026, 0.6, 13) + bar(263.158, 26.316, 0.8, 12)
        + msg(476.974, 11, 6.579, who("Анна Смирнова", "создала проект:", 0.7),
            chip("<b>" + pic("art-thumb-lastseen.png", "width:26.316px;height:26.316px;border-radius:4.934px", "fm-in") + "</b>Last Seen Leaving", "gap:4.934px;padding:3.289px 9.868px 3.289px 3.289px;border-radius:9.868px"),
            face("art-face-anna.png", 437.63, -45.92, 0))
        + date("8 авг", 39.474, 10)
        + msg(532.895, 9, 6.579, who("Марк Новиков", "изменил статус:", 0.6),
            '<span style="display:flex;align-items:center;gap:3.289px">' + status("#ffbf00", "Входящие") + ARROW + status("#e366ff", "Согласование") + "</span>",
            face("art-face-mark.png", -88.69, -24.54, 1.7))
        + date("Сегодня", 52.632, 8)
        + msg(394.737, 7, 3.456, '<span class="fm-med">Эльвира Краснова:</span>', '<span style="color:rgba(0,0,0,.6)">Вот новая обложка...</span>', face("art-face-elvira.png", 347.3, 20.06, 3.3))
        + bar(100, 26.316, 0.8, 6) + bar(197.368, 23.026, 0.6, 5) + bar(394.737, 19.737, 0.5, 4)
        + bar(263.158, 13.158, 0.4, 3) + bar(131.579, 9.868, 0.2, 2) + bar(197.368, 6.579, 0.1, 1)
        + "</div>",
        init(stage) { bars = Array.from(stage.querySelectorAll(".fm-bar > b")); },
        // animation: the empty lines change width together, as one sound wave running down the feed
        // (the photos are moved up and down by the styles)
        tick(time) {
          const loud = 0.75 + 0.25 * Math.sin(time * 0.9);                  // the whole wave gets louder and quieter
          bars.forEach((bar, i) => {
            const row = i < 6 ? i : i + 5;                                  // the messages sit between the two groups of lines
            const wave = 0.62 * Math.sin(row * 0.8 - time * 3.4) + 0.38 * Math.sin(row * 1.9 - time * 6.1 + 1);
            bar.style.width = (48.75 + 31.25 * loud * wave).toFixed(2) + "%";   // 17.5…80% of the feed's width
          });
        }
      };
    },

    // S2 · 1 — stack of documents, from request to signed
    "s2-1"() {
      const id = "fm" + (++uid);
      const status = (x, y, bg, dot, text) => '<div class="fm-status" style="' + at(x, y) + ";background:" + bg + '"><i style="background:' + dot + '"></i>' + text + "</div>";
      const lines = (count, lastShort) => {
        let s = "";
        for (let i = 0; i < count; i++) s += "<i" + (lastShort && i === count - 1 ? ' style="width:153.158px"' : "") + "></i>";
        return count ? '<span class="fm-lines">' + s + "</span>" : "";
      };
      // a document: position, strength of the light on it, its tint, title, number of text lines, and what only the front one has
      const doc = (x, y, glow, tint, title, lineCount, extra, front) =>
        '<div class="fm-doc' + (front ? " fm-doc-front" : "") + '" style="' + at(x, y) + ";background:linear-gradient(143.13deg,rgba(255,255,255," + glow + "),rgba(255,255,255,0)),linear-gradient(90deg," + tint + ',#f56e00)">'
        + '<b class="fm-num">' + title + "</b>" + lines(lineCount, !!extra) + (extra || "") + "</div>";
      const fade = (x, y) => '<canvas class="fm-fade" style="' + at(x - FADE.pad, y - FADE.pad) + '"></canvas>';   // fades the document behind into the background
      // Every document in Figma has a folded corner. Only the front one can be seen: the corner of every other document
      // stays behind the next one, also while they move (neighbours never get further than about 17px from their places
      // next to each other). So only the front one is built: its corner is cut away in the styles (.fm-doc-front),
      // and here are the signature, the soft shadow of the flap and the flap itself.
      const fold = pic("art-icon-signature.svg", "width:33.996px;height:31.579px", "fm-in")
        + '<div style="left:225.6px;top:15.13px;width:124.8px;height:172.03px;filter:blur(23.4px)"><i style="height:100%;clip-path:polygon(0 0,99.78% 0,100% 100%,0 27.42%);background:linear-gradient(180deg,rgba(245,110,0,.6) 27.69%,rgba(245,110,0,.2) 63.73%)"></i></div>'
        + '<svg width="62.4" height="62.4" viewBox="0 0 62.4 62.4" style="right:0;top:0"><defs><linearGradient id="' + id + '" x1="0" y1="62.4" x2="44.48" y2="44.02" gradientUnits="userSpaceOnUse">'
        + '<stop stop-color="#f56e00" stop-opacity=".1"/><stop offset="1" stop-color="#f56e00" stop-opacity=".7"/></linearGradient></defs>'
        + '<path d="M0 0l62.4 62.4H0Z" fill="#fff"/><path d="M0 0l62.4 62.4H0Z" fill="url(#' + id + ')"/></svg>';
      // A status, and its document (with the fade under it). They are moved by the styles (see fm-sway and fm-bob there):
      // the front status leads, and every other one repeats its path a little later, like a tail. A document follows its own status
      // with a small delay (the class fm-late), as if it were pulled by it. i: 0 for the last document … 4 for the front one.
      const moved = (i, late, inner) => '<div class="fm-step' + (late ? " fm-late" : "") + '" style="left:0;top:0;--i:' + i + '"><div class="fm-lift" style="left:0;top:0">' + inner + "</div></div>";
      const step = (i, label, sheet) => moved(i, false, label) + moved(i, true, sheet);
      return { html: '<div style="left:159.2px;top:125.6px;width:681.6px;height:748.8px">'
        + step(0, status(0, 307.2, "#fcd6b7", "#ff8019", "Заявка"),
          doc(0, 364.8, 0.6, "#f8994d", "Лицензионный<br>договор<br>№ К-025", 0))
        + step(1, status(98.4, 230.4, "#fde9d8", "#ffbf00", "В разработке"),
          fade(97.64, 514.65) + doc(98.4, 288, 0.7, "#fab680", "Акт к Договору<br>оказания услуг<br>№ У-067", 2))
        + step(2, status(196.8, 153.6, "#fef6ef", "#e366ff", "Согласование с контрагентом"),
          fade(197.12, 437.28) + doc(196.8, 211.2, 0.8, "#fcd3b2", "Договор<br>оказания услуг<br>№ У-086", 4))
        + step(3, status(295.2, 76.8, "#fffdfc", "#33a0ff", "Контрагент думает"),
          fade(295.01, 361.49) + doc(295.2, 134.4, 0.9, "#fef0e5", "ДС к Лиценз.<br>договору<br>№ Л-216", 6))
        + step(4, status(393.6, 0, "#fff", "#16d947", "Подписан"),
          fade(392.9, 284.12) + doc(393.6, 58.35, 1, "#fff", "Лицензионный<br>договор<br>№ К-011", 8, fold, true))
        + "</div>",
        init(stage) {
          const picture = fadePicture();
          stage.querySelectorAll(".fm-fade").forEach((copy) => { copy.width = picture.width; copy.height = picture.height; copy.getContext("2d").drawImage(picture, 0, 0); });
        }
      };
    },

    // S2 · 2 — six documents tied together by one button
    "s2-2"() {
      const lines = '<span class="fm-lines">' + "<i></i>".repeat(9) + '<i style="width:116.431px"></i></span>';
      const sheet = (x, y, title) => '<div class="fm-sheet" style="' + at(x, y) + '"><b class="fm-num">' + title + "</b>" + lines + "</div>";
      // The lines around the documents: position, path, and where the colour runs.
      // Each path starts at the edge of a document. The six big ones end under the button, and their colour runs from the
      // button outwards (true = the colour starts at the end of the path). The four small ones go from one edge of the
      // documents to another, and their colour runs clockwise around the documents.
      const loops = [
        [335.6, 161.6, "M1.2 49.03C1.2 25.12 7.2 1.2 28.2 1.2 49.2 1.2 55.2 25.12 55.2 49.03V288", true],
        [608, 161.6, "M55.2 49.2C55.2 25.2 49.2 1.2 28.2 1.2 7.2 1.2 1.2 25.2 1.2 49.2V292", true],
        [335.6, 551.4, "M1.2 237.8C1.2 261.8 7.2 285.8 28.2 285.8 49.2 285.8 55.2 261.8 55.2 237.8V0", true],
        [608, 551.4, "M55.2 237.8C55.2 261.8 49.2 285.8 28.2 285.8 7.2 285.8 1.2 261.8 1.2 237.8V0", true],
        [124.4, 444.8, "M49.2 1.2C25.2 1.2 1.2 7.2 1.2 28.2 1.2 49.2 25.2 55.2 49.2 55.2H196.8", true],
        [680, 444.8, "M146.4 1.2C170.4 1.2 194.4 7.2 194.4 28.2 194.4 49.2 170.4 55.2 146.4 55.2H0", true],
        [153.95, 191.99, "M19.64 118.82C-52.35 118.82 109.65-53.18 109.65 18.81", false],   // top left: from the left edge up to the top edge
        [735.2, 191.99, "M91.2 118.82C163.2 118.82 1.2-53.18 1.2 18.81", true],             // top right: from the top edge down to the right edge
        [153.95, 687.98, "M19.64 1.2C-52.35 1.2 109.65 173.2 109.65 101.2", true],          // bottom left: from the bottom edge up to the left edge
        [735.2, 687.98, "M91.2 1.2C163.2 1.2 1.2 173.2 1.2 101.2", false]                   // bottom right: from the right edge down to the bottom edge
      ];
      // animation: light runs along the lines: they are white, turn light orange and come back.
      // A line cannot have a colour that changes along its length, so every line is cut into short pieces;
      // each piece goes white → light orange → white, a little later than the piece nearer to where the light starts.
      // All the pieces are drawn on one canvas. (As ~300 separately animated SVG lines they kept phones busy on every frame.)
      const PIECE = 9.12;      // length of a piece, px
      const WAVE = 364.8;      // distance between two white crests, px
      const PERIOD = 2.6;      // seconds for a crest to travel that distance
      const FROM = [255, 255, 255], TO = [248, 153, 77];   // white, and the colour at the dimmest point: #F8994D (what 30% white looks like on the orange of the card)
      // the "ease-in-out" curve of CSS, so the colour changes exactly as it did when the styles animated it
      const easeInOut = (x) => {
        let lo = 0, hi = 1;
        for (let i = 0; i < 20; i++) {
          const t = (lo + hi) / 2, r = 1 - t;
          if (3 * r * r * t * 0.42 + 3 * r * t * t * 0.58 + t * t * t < x) lo = t; else hi = t;
        }
        const t = (lo + hi) / 2;
        return 3 * (1 - t) * t * t + t * t * t;
      };
      const TONES = 128;       // the colours of one full white → light orange → white change, prepared once
      const tones = Array.from({ length: TONES }, (unused, i) => {
        const p = (i + 0.5) / TONES, fade = easeInOut(p < 0.5 ? p * 2 : (1 - p) * 2);
        return "rgb(" + FROM.map((c, j) => Math.round(c + (TO[j] - c) * fade)).join(",") + ")";
      });
      const pieces = [];       // every piece: its shape, and how far it is from where the colour starts on its line (in waves)
      loops.forEach(([x, y, d, fromEnd]) => {
        const pts = flatten(d, x, y), cuts = [];
        let piece = [pts[0]], run = 0;
        for (let i = 1; i < pts.length; i++) {
          let a = pts[i - 1], length = Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]);
          while (run + length > PIECE) {                                   // the piece is full: end it here and start the next one
            const f = (PIECE - run) / length, c = [a[0] + (pts[i][0] - a[0]) * f, a[1] + (pts[i][1] - a[1]) * f];
            piece.push(c); cuts.push(piece);
            piece = [c]; run = 0; a = c; length = Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]);
          }
          piece.push(pts[i]); run += length;
        }
        if (run > 0.25) cuts.push(piece); else run = PIECE;
        const total = (cuts.length - 1) * PIECE + run;                     // length of the whole line
        cuts.forEach((points, n) => {
          const path = new Path2D();
          path.moveTo(points[0][0], points[0][1]);
          for (let i = 1; i < points.length; i++) path.lineTo(points[i][0], points[i][1]);
          pieces.push({ path, at: (fromEnd ? total - n * PIECE : n * PIECE) / WAVE });
        });
      });
      let canvas = null, ctx = null;
      function tick(time) {
        if (!ctx) return;
        const turn = time / PERIOD;
        ctx.clearRect(0, 0, SIZE, SIZE);
        for (let i = 0; i < pieces.length; i++) {
          const p = turn - pieces[i].at;
          ctx.strokeStyle = STILL ? "#fff" : tones[((p - Math.floor(p)) * TONES) & (TONES - 1)];   // with "reduce motion" the lines stay white
          ctx.stroke(pieces[i].path);
        }
      }
      return { html:
        '<div style="left:173.513px;top:210.723px;width:652.974px;height:578.554px;background:linear-gradient(153.509deg,rgba(255,255,255,.9),rgba(255,255,255,.1)),#f56e00"></div>'
        + sheet(173.513, 210.723, "Приложение №3<br>к лицензионному<br>договору<br>№ ФМ-011")
        + sheet(173.513, 501.2, "Лицензионный<br>договор<br>№ ФМ-012")
        + sheet(610.429, 210.723, "Договор об<br>отчуждении<br>исключительных<br>прав № ИП-045")
        + sheet(610.429, 501.2, "Приложение № 2<br>к Лицензионному<br>договору<br>№ ФМ-012")
        + sheet(391.971, 210.723, "Лицензионный<br>договор<br>№ ФМ-011")
        + sheet(391.971, 501.2, "Договор об<br>отчуждении<br>исключительных<br>прав № ФЗ-102")
        + '<canvas class="fm-flow"></canvas>'                    // the lines lie over the documents and under the button
        + '<div class="fm-cta">Оформить права</div>',
        init(stage) { canvas = stage.querySelector(".fm-flow"); },
        // The ends of the lines are cut straight, so they stop exactly at the edge of a document.
        // "lighter": where two pieces meet, their colours are added up exactly, so the joint shows neither a gap nor a bead.
        resize(pixels) { ctx = stageCanvas(canvas, pixels); ctx.lineWidth = 2.4; ctx.lineCap = "butt"; ctx.globalCompositeOperation = "lighter"; },
        tick
      };
    },

    // S3 · 1 — income nested by level: label › artist › album › track
    "s3-1"() {
      // ── the animated bars of the smallest bubble ──
      // They move exactly like the bars of the stat cards next to the logos (same tempo, same waves, same rise and fall);
      // only their number and their lowest and highest points belong to this drawing.
      const BARS = 48, LOW = 0.36, HIGH = 0.68;   // number of bars; the lowest and highest a bar can be, as a share of the bubble's height
      const BPM = 116;                           // tempo of the beat pulse
      const SEED = 111.9;                        // which "track" is playing: another number gives another pattern
      const PX = 680;                            // the canvas has two pixels for every px of the bubble
      const levels = new Float32Array(BARS);
      let ctx = null;
      const goal = (i, time) => {                // where each bar "wants" to be
        const beat = Math.exp(-((time * BPM / 60) % 1) * 5);                           // kick: jumps up on each beat, then fades
        const broad = noise1(i * 0.12 + SEED + time * 0.35);                            // slow wave across the bars
        const sharp = noise1(i * 1.7 + SEED * 2 + time * 2.4);                          // fast jitter per bar
        const level = -0.18 + broad * 0.5 + sharp * 0.7 + beat * 0.3 * noise1(i * 0.3 + time + SEED);
        return LOW + (HIGH - LOW) * clamp01(level);
      };
      function tick(time, dt) {
        const up = dt ? 1 - Math.pow(0.65, dt * 60) : 1, down = dt ? 1 - Math.pow(0.85, dt * 60) : 1;   // bars jump up quickly and fall back slower
        ctx.clearRect(0, 0, PX, PX);
        ctx.beginPath();
        ctx.moveTo(0, PX);
        for (let i = 0; i < BARS; i++) {
          const to = goal(i, time);
          levels[i] += (to - levels[i]) * (to > levels[i] ? up : down);
          const y = Math.round(PX * (1 - levels[i]));
          ctx.lineTo(Math.round((i * PX) / BARS), y);
          ctx.lineTo(Math.round(((i + 1) * PX) / BARS), y);
        }
        ctx.lineTo(PX, PX);
        ctx.closePath();
        ctx.fill();
      }
      // A bubble and its label. i: 0 for the biggest … 3 for the smallest; then size, top, what is inside, where the light starts,
      // seconds for the light to go round once (negative = the other way), the light itself, background, label, sum.
      // The bubbles swell and shrink a little, one after another from the smallest outwards (see fm-swell in the styles).
      // A bubble grows from its lowest point, where all four touch. Its label is not inside it: it is a block of its own
      // that rides up and down with the bubble's top edge, so the text keeps its size and its distance from the edge.
      const bubble = (i, d, y, inside, turn, round, glare, fill, name, sum) =>
        '<div class="fm-bubble" style="' + at(500 - d / 2, y) + ";width:" + d + "px;height:" + d + "px;--i:" + i + (fill ? ";background:#009929" : "") + '">'
        + inside
        + '<div class="fm-glare" style="--turn:' + turn + "deg;animation-duration:" + Math.abs(round) + "s" + (round < 0 ? ";animation-direction:reverse" : "") + ";box-shadow:" + glare + '"></div>'
        + '<div style="border-radius:50%;box-shadow:inset 0 0 56.667px rgba(255,255,255,.15)"></div></div>'
        + '<div class="fm-label fm-num" style="' + at(500 - d / 2, y) + ";width:" + d + "px;--i:" + i + ";--d:" + d + 'px"><b>' + name + "</b>" + sum + "</div>";
      return { html:
        bubble(0, 680, 160, "", 90, 32, "inset 0 0 43.067px rgba(255,255,255,.8)", false, "Лейбл", "+ 11 680 000 ₽")
        + bubble(1, 566.667, 273.333, "", 60, -26, "inset 0 0 21.25px rgba(255,255,255,.2),inset 0 0 43.067px rgba(255,255,255,.8)", true, "Артист", "+ 2 415 700 ₽")
        + bubble(2, 453.333, 386.667, "", 30, 22, "inset 0 0 21.25px rgba(255,255,255,.3),inset 0 0 43.067px rgba(255,255,255,.9)", true, "Альбом", "+ 843 200 ₽")
        // a soft green spot on the edge of the smallest bubble; it grows with that bubble, from the same point
        + '<div class="fm-shade" style="left:592.08px;top:514.03px;width:70.833px;height:70.833px;transform-origin:-92.08px 325.97px;--i:3"></div>'
        + bubble(3, 340, 500, '<canvas class="fm-bars" width="' + PX + '" height="' + PX + '"></canvas>', 0, -17, "inset 0 0 7.083px #fff,inset 0 0 21.25px rgba(255,255,255,.8),inset 0 0 43.067px #fff", true, "Трек", "+ 128 640 ₽"),
        init(stage) { ctx = stage.querySelector(".fm-bars").getContext("2d"); ctx.fillStyle = "#fff"; tick(0, 0); },
        // animation: the bars of the smallest bubble move to the beat (the light on the bubbles and their swelling are done by the styles)
        tick
      };
    },

    // S3 · 2 — payments flying in with comet tails
    "s3-2"() {
      // distance from the right edge, vertical centre, where the tail starts in Figma, icon colour, icon file, sum, label — bottom layer first
      const rows = [
        [206.55, 599.47, 77.79, "#ff8019", "art-icon-brush.svg", "− 35 000 ₽", "Обложка релиза"],
        [271.49, 500, -5.11, "#e366ff", "art-icon-star.svg", "+ 4 160 000 ₸", "Сборы с концерта"],
        [148.53, 400.52, 63.97, "#8861ff", "art-icon-copyright.svg", "+ $6 000", "Лицензия для сериала"],
        [341.95, 301.05, -32.74, "#33a0ff", "art-icon-video.svg", "− 180 000 ₽", "Аванс на клип"],
        [380.63, 698.95, -88, "#ffbf00", "art-icon-tshirt.svg", "+ 210 000 ₽", "Продажа мерча"]
      ];
      // Every tail and every payment sits in an empty wrapper of its own (.fm-fly: a line across the stage at the row's centre),
      // and the animation moves the wrappers. That is much less work for the browser than moving the pills themselves.
      const T = TAIL, J = TAIL_JOIN, DRAWN = 635.526;        // DRAWN: the tail's length in Figma; a tail of another length keeps its right end where that one ends
      const fly = (cy, inner) => '<div class="fm-fly" style="top:' + (cy / 10).toFixed(4) + '%">' + inner + "</div>";   // cy / 10: the centre as a share of the stage's 1000px, in %
      const row = ([right, cy, tailX, color, icon, sum, label]) => {
        const start = tailX + DRAWN - T.length;              // where the tail's tip is, px from the left of the stage
        // The payment's own white starts only where the fine picture of the tail is already sharp. The two stops are counted
        // from the payment's right edge, so they sit at the same places of the tail whatever the width of the payment.
        const white = 1000 - right - (start + T.length * J.solid), clear = 1000 - right - (start + T.length * J.crisp);
        return fly(cy, '<canvas class="fm-tail" style="' + at(+(start - TAIL_PAD).toFixed(3), +(-T.thick / 2 - TAIL_PAD).toFixed(3)) + '"></canvas>')
          + fly(cy, '<canvas class="fm-fine" data-start="' + start.toFixed(3) + '"></canvas>'
            + '<div class="fm-pay" style="right:' + right + "px;top:-44.21px;background:linear-gradient(to left,#fff " + white.toFixed(2) + "px,rgba(255,255,255,0) " + clear.toFixed(2) + 'px)"><span>' + sum + '<br><span class="fm-dim">' + label + '</span></span><i style="background:' + color + '">' + pic(icon, "width:100%;height:100%", "fm-in") + "</i></div>");
      };
      const EVERY = Math.max(1, Math.round(T.every));
      const SLACK = 1 - T.follow / 100;                      // the part of the shake that the tail does not repeat
      let flying = [], frames = 0, pivot = 1;
      // animation: every payment drifts a little ahead and back; its shaking grows and dies down in waves ("bursts"),
      // and during a burst the streaks in its tail get stronger. A tail is repainted only on some frames (TAIL.every), which is enough for the eye.
      function tick(time, dt, px) {                          // px: how long one Figma px is on the page right now
        frames++;
        flying.forEach((one, i) => {
          const sway = T.sway * Math.sin(time * (0.8 + i * 0.13) * T.swaySpeed + i * 1.7);
          const burst = Math.pow(0.5 - 0.5 * Math.cos((time * TAU) / (T.burstEvery + i * 0.7) + i * 2.1), T.burstSharp);
          const dx = (noise1(time * 13 * T.shakeRate + i * 31) - 0.5) * 2 * T.shake * burst, dy = (noise1(time * 15 * T.shakeRate + i * 57 + 9) - 0.5) * 2 * T.shake * burst;
          one.pill.style.transform = "translate(" + ((sway + dx) * px).toFixed(2) + "px," + (dy * px).toFixed(2) + "px)";
          one.tail.style.transform = "translate(" + (sway * px).toFixed(2) + "px," + (dy * T.follow / 100 * px).toFixed(2) + "px)";
          // The fine picture rides with the payment. When the tail repeats only a part of the shake, the picture leans a little,
          // so that its left end stays on the tail while the end under the payment stays on the payment. (Not for less than 0.2px: it is not free.)
          const apart = dy * SLACK, lean = Math.abs(apart) > 0.2 ? "skewY(" + Math.atan2(apart, pivot).toFixed(4) + "rad)" : "";
          if (lean !== one.lean) one.fine.style.transform = one.lean = lean;
          if ((frames + i) % EVERY === 0) one.paint(time, burst);
        });
      }
      return {
        html: rows.map(row).join("") + '<div style="left:-115.26px;top:0;width:210.526px;height:1000px;background:#009929;filter:blur(52.632px)"></div>',
        init(stage) {
          const flies = stage.querySelectorAll(".fm-fly");    // in pairs: the wrapper of a tail, then the wrapper of its payment
          const fines = stage.querySelectorAll(".fm-fine");
          flying = Array.from(stage.querySelectorAll(".fm-tail")).map((canvas, i) => {
            const paint = makeTail(canvas, 101 + i * 13);
            paint(0, 0);
            return { tail: flies[i * 2], pill: flies[i * 2 + 1], fine: fines[i], lean: "", paint };
          });
        },
        // The fine picture is drawn for the size of the drawing on screen, one canvas pixel per screen pixel, and copied under every payment.
        resize(pixels) {
          const picture = finePicture(pixels / SIZE);
          pivot = picture.pivot;
          flying.forEach((one) => {
            const copy = one.fine;
            copy.width = picture.canvas.width; copy.height = picture.canvas.height;
            copy.getContext("2d").drawImage(picture.canvas, 0, 0);
            copy.style.cssText = "left:" + unit(+copy.dataset.start + picture.left) + ";top:" + unit(picture.top) + ";width:" + unit(picture.width) + ";height:" + unit(picture.height)
              + ";transform-origin:" + (picture.pivot / picture.width * 100).toFixed(2) + "% 50%";
            one.lean = "";
          });
        },
        tick
      };
    },

    // S3 · 3 — budget split into rings around the cube
    "s3-3"() {
      const id = "fm" + (++uid), MID = 499.84, HALF = 102.9485, C = TAU * 96.853;   // centre of the drawing; half a ring's box; length of a ring's line
      const dots = (r, gap, turn) => '<circle cx="' + HALF + '" cy="' + HALF + '" r="' + r + '" stroke-opacity=".5" stroke-width="2.709" stroke-dasharray="0.01 ' + gap + '"' + (turn ? ' transform="rotate(' + turn + " " + HALF + " " + HALF + ')"' : "") + "/>";
      const ring = (x, y, share, value, label) =>
        '<div class="fm-ring" style="' + at(x, y) + '"><svg width="205.897" height="205.897" viewBox="0 0 205.897 205.897" fill="none" stroke="#fff" stroke-linecap="round">'
        + dots(100.917, 7.11) + dots(96.853, 6.82, 2) + dots(92.789, 6.53)
        + '<circle cx="' + HALF + '" cy="' + HALF + '" r="96.853" stroke-width="12.19" stroke-dasharray="' + (share * C).toFixed(2) + " " + C.toFixed(2) + '" transform="rotate(-90 ' + HALF + " " + HALF + ')"/></svg>'
        + "<b>" + value + "</b><span>" + label + "</span></div>";
      // a spoke: a line from the centre that is visible only at its outer end. The six of them are one line, turned.
      const spokes = [0, 60, 120, 180, 240, 300].map((turn) => '<path d="M' + MID + " " + MID + 'V372.51" transform="rotate(' + turn + " " + MID + " " + MID + ')"/>').join("");
      return { html:
        pic("art-cube-bg.png", "left:350.99px;top:350.99px;width:298.009px;height:298.009px")
        // soft frame that melts the photo's edges into the background
        + '<div style="left:350.99px;top:350.99px;width:298.009px;height:298.009px;overflow:hidden"><div style="left:-27.092px;top:-27.092px;right:-27.092px;bottom:-27.092px;border:54.183px solid #009929;filter:blur(40.638px)"></div></div>'
        // animation: the spokes and the six rings travel around the cube together; each ring is turned back by the same angle, so it stays upright (see .fm-orbit in the styles)
        + '<svg class="fm-orbit" viewBox="0 0 1000 1000" fill="none" stroke="url(#' + id + ')" stroke-width="2.709" stroke-linecap="round"><defs>'
        + '<linearGradient id="' + id + '" x1="0" y1="' + MID + '" x2="0" y2="372.51" gradientUnits="userSpaceOnUse"><stop offset=".78" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>'
        + spokes + "</svg>"
        + pic("art-cube.png", "left:350.99px;top:350.99px;width:298.009px;height:298.009px")
        + '<div class="fm-orbit">'
        + ring(397.05, 634.36, 0.4, "600 тыс", "Резерв")
        + ring(397.05, 160.26, 0.4, "2.4 млн", "A&amp;R")
        + ring(602.11, 278.66, 0.8, "1.4 млн", "Запись")
        + ring(191.99, 515.43, 0.6, "2.6 млн", "Продвижение")
        + ring(602.11, 515.43, 0.7, "950 тыс", "Офис")
        + ring(191.99, 278.65, 0.7, "1.2 млн", "Продакшн")
        + "</div>"
      };
    },

    // Royalty · 1 — one sum split into three shares
    "royalty-1"() {
      const FRAME = 506;                                   // this drawing's Figma frame is 506×506 (the card at its full size), not 1000×1000
      const BOX = [117, 40, 272];                          // the square the ring is drawn in: left, top, side
      const CX = 253, CY = 176;                            // centre of the ring
      const LINE = 40, R = 116;                            // width of the ring's line, and the radius of its middle
      const SUM = 865947;                                  // the sum in the middle, in roubles
      // The shares, in the order they lie on the ring: clockwise from the top. (That is also their order as layers, bottom first.)
      //   part:    the share in percent. It is used for both things: the number in the label, and the length of its piece of
      //            the ring (30 = 30% of the circle), so the two can never disagree. The three add up to 100.
      //   turn:    its turn in the animation: 0 appears first, then 1, then 2. Its label follows it.
      //   name:    the text of its label; numberFirst: is the number in front of the name?
      //   place:   where the label is fixed ("left:…" or "right:…", then "top:…")
      //   middle:  the middle of the label in Figma (the animation turns the label around the ring's centre from there)
      const SHARES = [
        { part: 30, turn: 1, name: "Артист 2", numberFirst: true,  place: "right:40px;top:60.668px", middle: [382.5, 85.7] },
        { part: 25, turn: 2, name: "Лейбл",    numberFirst: true,  place: "right:70px;top:262px",    middle: [364, 287] },
        { part: 45, turn: 0, name: "Артист 1", numberFirst: false, place: "left:51px;top:89px",      middle: [134.5, 114] }
      ];
      if (!window.CanvasRenderingContext2D || !CanvasRenderingContext2D.prototype.createConicGradient)
        throw new Error("this browser cannot paint a gradient that goes round a circle");   // a very old browser: the PNG stays

      // Places on the ring are parts of the full circle: 0 is the top, 0.25 the right, 0.5 the bottom, and so on clockwise.
      // A share is a piece of the ring with round ends, from the end of the share behind it (from) to its own end (to).
      // It is white at its own end. Towards its start the white fades, and it is gone completely a little before the white
      // end of the share behind it is reached (how far before: "clear" in the settings). The round end of that share
      // reaches CAP into this one.
      const CAP = Math.asin(LINE / 2 / R) / TAU;
      let reached = 0;
      SHARES.forEach((share) => { share.from = reached / 100; share.to = (reached += share.part) / 100; });

      const S = ROYALTY;                                   // the settings of the animation: see the top of this part of the file
      const angle = (place) => place * TAU - Math.PI / 2;  // a place on the ring as an angle for the canvas
      let ease = {}, labelTime = 0, end = 1;               // the eases as functions, how long a label takes, and when the last part has arrived
      let canvas = null, ctx = null, labels = [], sum = null, sumText = "";
      function setup() {
        ease = { share: easing(S.shareEase), shareFade: easing(S.shareFadeEase), label: easing(S.labelEase), labelFade: easing(S.labelFadeEase), sum: easing(S.sumEase) };
        labelTime = Math.max(0.02, 1 - S.shareGap * (SHARES.length - 1) - S.labelAfter);
        end = Math.max(1, S.shareGap * (SHARES.length - 1) + Math.max(S.shareTime, S.labelAfter + labelTime));
      }

      // Draws the moment `now` of the animation: 0 = nothing is there yet, 1 = the time is over (at `end`, which is 1 or a
      // little later, everything has arrived).
      function pose(now) {
        if (ctx) {
          ctx.clearRect(BOX[0], BOX[1], BOX[2], BOX[2]);
          SHARES.forEach((share, i) => {
            const way = clamp01((now - share.turn * S.shareGap) / S.shareTime), done = way >= 1 ? 1 : ease.share(way);
            if (way <= 0) return;
            const head = share.to - S.shareTurn * (1 - done);                         // where its white end is right now
            const grown = S.shareGrow + (1 - S.shareGrow) * done;                     // how much of its length it has
            const on = (place) => head - (share.to - place) * grown;                  // a place of the finished share, on the share as it is right now
            const faded = S.whiteGrow + (1 - S.whiteGrow) * done;                     // how much of its length the fade from clear to white has
            const clear = Math.min(head - (share.to - share.from - CAP - S.clear) * faded, head - 0.002);   // from here on (clockwise) the white comes in
            const white = Math.min(0.9, head - clear);                                // …and it is full this far further on, at the share's end
            const paint = ctx.createConicGradient(angle(clear), CX, CY);
            paint.addColorStop(0, "rgba(255,255,255,0)");
            paint.addColorStop(white, "#fff");
            paint.addColorStop(Math.min(0.97, white + CAP * 1.4), "#fff");            // the round end is white all over…
            paint.addColorStop(Math.min(0.98, white + CAP * 1.4 + 0.003), "rgba(255,255,255,0)");   // …and behind the start there is nothing
            ctx.globalAlpha = way >= 1 ? 1 : clamp01(ease.shareFade(clamp01(way / S.shareFade)));
            ctx.strokeStyle = paint;
            ctx.beginPath();
            ctx.arc(CX, CY, R, angle(on(share.from)), angle(head));
            ctx.stroke();
          });
          ctx.globalAlpha = 1;
        }
        labels.forEach((label, i) => {
          const way = clamp01((now - SHARES[i].turn * S.shareGap - S.labelAfter) / labelTime);
          const back = way >= 1 ? 0 : -S.labelTurn * TAU * (1 - ease.label(way)), cos = Math.cos(back), sin = Math.sin(back);   // how far it still has to go round the ring
          const x = SHARES[i].middle[0] - CX, y = SHARES[i].middle[1] - CY;                                // its place, seen from the centre of the ring
          label.style.opacity = way >= 1 ? "" : way <= 0 ? "0" : clamp01(ease.labelFade(clamp01(way / S.labelFade))).toFixed(3);
          label.style.transform = back ? "translate(" + unit((x * cos - y * sin - x).toFixed(2)) + "," + unit((x * sin + y * cos - y).toFixed(2)) + ")" : "";
        });
        if (sum) {
          const counted = now >= 1 ? SUM : Math.max(0, Math.round(SUM * ease.sum(now)));
          const text = counted.toString().replace(/\B(?=(\d{3})+$)/g, " ") + " ₽";                         // 865947 → "865 947 ₽"
          if (text !== sumText) sum.textContent = sumText = text;
          sum.style.opacity = now >= 1 ? "" : clamp01(now / S.sumShows).toFixed(3);
        }
      }

      const number = (text) => "<b>" + text + "</b>", name = (text) => '<span class="fm-num">' + text + "</span>";
      setup();
      return { size: FRAME, once: true, setup, html:
        '<canvas class="fm-split"></canvas>'
        + SHARES.map((share) => '<div class="fm-share" style="' + share.place + '">'
          + (share.numberFirst ? number(share.part + "%") + name(share.name) : name(share.name) + number(share.part + "%")) + "</div>").join("")
        + '<div class="fm-total fm-num"></div>',
        init(stage) {
          canvas = stage.querySelector(".fm-split"); labels = Array.from(stage.querySelectorAll(".fm-share")); sum = stage.querySelector(".fm-total");
          pose(STILL ? end : 0);                                 // nothing is shown until the animation starts (with "reduce motion": the finished drawing at once)
        },
        // The canvas gets as many pixels as the ring has on screen, and is drawn on in the px of the Figma frame.
        // (pixels: the side of the whole drawing in screen pixels.)
        resize(pixels) {
          const k = pixels / FRAME;
          canvas.width = canvas.height = Math.round(BOX[2] * k);
          ctx = canvas.getContext("2d");
          ctx.setTransform(k, 0, 0, k, -BOX[0] * k, -BOX[1] * k);
          ctx.lineWidth = LINE; ctx.lineCap = "round";
        },
        // time: seconds since the animation started. When it is over, the drawing asks not to be called any more (false).
        tick(time) {
          const now = STILL ? end : Math.min(end, Math.max(0, time / S.play));
          pose(now);
          return now < end;
        }
      };
    },

    // Royalty · 2 — four reports, one from each platform
    "royalty-2"() {
      const FRAME = 506;                                   // this drawing's Figma frame is 506×506 as well
      // how see-through the rows of a report are, from the top row down: the last ones fade away
      const FULL = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05];
      const SHORT = FULL.slice(6);                         // the six rows of the report in front: they lie on the same lines as the last six rows of the others
      const turns = [], lines = [];                        // filled while the drawing is put together: the turn of every report, and the line and look of every row
      const rows = (list) => "<span>" + list.map((alpha, i) => {
        lines.push({ line: FULL.length - list.length + i, alpha });          // which line it lies on: 0 = the top one. Rows on one line appear together
        return '<i style="opacity:' + alpha + '"></i>';
      }).join("") + "</span>";
      // a report: its turn in the animation (0 = first), position, the logo file, the rows, and the gap between the logo and the rows.
      // A logo file is the whole 168×32 line of the report: the logo sits in it where it sits in Figma, so no sizes are needed here.
      const report = (turn, x, y, logo, list, gap) => {
        turns.push(turn);
        return '<div class="fm-report" style="' + at(x, y) + (gap ? ";gap:" + gap + "px" : "") + '">' + pic(logo, "width:168px;height:32px", "fm-in")
          + (list ? rows(list) : "") + "</div>";
      };
      // bottom layer first: the report at the back has no rows (they would be hidden by the others anyway)
      const html = report(0, 153, 40, "art-logo-spotify.svg")
        + report(2, 266, 108, "art-logo-apple-music.svg", FULL)
        + report(1, 40, 108, "art-logo-vk-music.svg", FULL)
        + report(3, 153, 176, "art-logo-yandex-music.svg", SHORT, 24);

      const S = ROYALTY;                                   // the settings of the animation: see the top of this part of the file
      let ease = {}, lineGap = 0, end = 1;                 // the eases as functions, how long after the line above a line starts, and when the last part has arrived
      let sheets = [], bars = [], shown = [];              // the reports, the rows, and what was last written to each of them
      function setup() {
        ease = { sheet: easing(S.sheetEase), sheetFade: easing(S.sheetFadeEase), row: easing(S.rowEase), rowFade: easing(S.rowFadeEase) };
        lineGap = Math.max(0, 1 - S.rowsAt - S.rowTime) / (FULL.length - 1);
        end = Math.max(1, Math.max.apply(null, turns) * S.sheetGap + S.sheetTime, S.rowsAt + (FULL.length - 1) * lineGap + S.rowTime);
      }
      // moves one part: how see-through it is ("" = as in the finished drawing) and how far below its place it is, in Figma px
      function put(el, n, opacity, below) {
        const state = opacity + "|" + below;
        if (shown[n] === state) return;                      // nothing new for this part: leave it alone
        shown[n] = state;
        el.style.opacity = opacity;
        el.style.transform = below ? "translateY(" + unit(below) + ")" : "";
      }
      // Shows the moment `now` of the animation: 0 = nothing is there yet, 1 = the time is over (at `end`, which is 1 or a
      // little later, everything has arrived).
      function pose(now) {
        sheets.forEach((sheet, i) => {
          const way = clamp01((now - turns[i] * S.sheetGap) / S.sheetTime);
          if (way >= 1) put(sheet, i, "", 0);
          else if (way <= 0) put(sheet, i, "0", 0);
          else put(sheet, i, clamp01(ease.sheetFade(clamp01(way / S.sheetFade))).toFixed(3), +(S.sheetRise * (1 - ease.sheet(way))).toFixed(2));
        });
        bars.forEach((bar, i) => {
          const way = clamp01((now - S.rowsAt - lines[i].line * lineGap) / S.rowTime), n = sheets.length + i;
          if (way >= 1) put(bar, n, lines[i].alpha, 0);
          else if (way <= 0) put(bar, n, "0", 0);
          else put(bar, n, (lines[i].alpha * clamp01(ease.rowFade(way))).toFixed(3), +(S.rowRise * (1 - ease.row(way))).toFixed(2));
        });
      }

      setup();
      return { size: FRAME, once: true, setup, html,
        init(stage) {
          sheets = Array.from(stage.querySelectorAll(".fm-report")); bars = Array.from(stage.querySelectorAll(".fm-report > span > i"));
          pose(STILL ? end : 0);                                 // nothing is shown until the animation starts (with "reduce motion": the finished drawing at once)
        },
        // time: seconds since the animation started. When it is over, the drawing asks not to be called any more (false).
        tick(time) {
          const now = STILL ? end : Math.min(end, Math.max(0, time / S.play));
          pose(now);
          return now < end;
        }
      };
    }
  };

  // ── putting them on the page ──
  const TURNS = !!window.MutationObserver;                  // false only in very old browsers: the Taptop fade then stays as it is
  const DETAIL = 3;                                         // see fit()
  const mounted = [];
  const resize = window.ResizeObserver ? new ResizeObserver((entries) => entries.forEach((e) => fit(e.target))) : null;
  window.addEventListener("resize", () => mounted.forEach(fit));   // also catches a change of the screen's pixel density (browser zoom, another monitor)
  const observe = (margin, change) => window.IntersectionObserver
    ? new IntersectionObserver((entries) => entries.forEach((e) => change(e.target, e.isIntersecting)), { rootMargin: margin }) : null;
  // A drawing moves only while its block is on screen (or about to be)…
  const watch = observe("100px 0px", (host, seen) => { host.fmArt.seen = seen; setLive(host); });
  // …and it is kept ready only while its block is within one screen of the visible part of the page.
  // Further away it is hidden (the class "is-away"), so the browser can let go of the memory it holds for it,
  // and its big canvases give their memory back (up to about 5 MB each on a phone). They are made again, with the
  // current moment drawn on them, when the block comes near.
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
  // The lighter mode for weak devices (see "pace" at the top) gives the canvases fewer pixels: size them again
  fmPace.onChange(() => mounted.forEach(fit));

  // Sizes a drawing for its block. On screen it is always as big as "background-size: contain" made the PNG.
  // Where the screen is dense enough (phones, tablets, retina) the stage is laid out at exactly that size, so nothing in it
  // takes more memory than it shows. On a coarser screen it is laid out up to DETAIL times bigger and scaled down,
  // which keeps thin lines and small text even there.
  // The canvases get one pixel per screen pixel (at most 3 per CSS px; 2 in the lighter mode for weak devices),
  // and none at all while the block is far from the screen (see release above).
  function fit(host) {
    const fm = host.fmArt, shown = Math.min(host.clientWidth, host.clientHeight);   // side of the drawing on screen
    if (!(shown > 0)) return;
    const density = window.devicePixelRatio || 1;
    const side = Math.min(LIMIT, shown * Math.max(1, DETAIL / density));            // side of the stage in the layout
    const pixels = Math.min(LIMIT, Math.round(shown * Math.min(density, fmPace.slow ? 2 : 3)));   // side of the drawing in screen pixels: the size of its canvases
    if (side !== fm.side || shown !== fm.shown) {
      fm.side = side; fm.shown = shown;
      fm.px = side / fm.size;                                 // how long one Figma px is in this drawing
      fm.stage.style.setProperty("--fm-px", fm.px.toFixed(5) + "px");
      fm.stage.style.setProperty("--fm-scale", (shown / side).toFixed(5));
    }
    if (pixels !== fm.pixels && fm.art.resize && !fm.away) {
      fm.pixels = pixels;
      fm.art.resize(pixels);                                  // this empties the canvas: draw the current moment again
      if (fm.art.tick) try { fm.art.tick(fm.clock, 0, fm.px); } catch (err) { console.warn("fm-art: " + fm.key + " was not redrawn", err); }
    }
  }

  // later: true when several drawings are put on the page together (see mountCard): they are measured afterwards, all at once
  function mount(host, key, later) {
    if (host.fmArt) return;
    const art = ART[key]();
    const size = art.size || SIZE;                           // side of the drawing's Figma frame
    const stage = document.createElement("div");
    stage.className = "fm-stage fm-" + key;
    if (size !== SIZE) stage.style.setProperty("--fm-size", size);
    stage.setAttribute("aria-hidden", "true");               // decorative: screen readers skip it
    stage.innerHTML = toUnits(art.html);
    stage.querySelectorAll("svg[width]").forEach((svg) => {  // icons: their width="…" and height="…" are Figma px too
      svg.style.width = unit(svg.getAttribute("width"));
      svg.style.height = unit(svg.getAttribute("height"));
    });
    const was = host.fmWas || getComputedStyle(host);        // read before anything was changed on the page (see mountCard)
    const base = parseFloat(was.opacity) || 0;               // the block's own opacity, before the classes below change it
    if (was.position === "static") host.style.position = "relative";
    host.classList.add("fm-art");
    if (TURNS) host.classList.add("fm-turns");               // the drawing starts hidden and waits for its turn (see takeTurns)
    if (keep) stage.classList.add("is-away");                // until the browser reports that the block is near the screen
    host.appendChild(stage);
    host.fmArt = { key, stage, base, art, size, clock: 0, live: false, on: !TURNS, seen: !watch, held: false, over: false, away: !!keep, side: 0, shown: 0, pixels: 0, px: 1 };
    if (art.init) art.init(stage);
    if (!later) finish(host);
  }
  function finish(host) {
    if (host.fmArt.art.once && !STILL) holdBack(host);       // a drawing that plays once waits for its card (see below)
    // Measured by the ResizeObserver, which reports the block's size right after the browser's next layout. Measuring it
    // here instead would make the browser lay out the whole page at once, for every drawing.
    if (!resize) fit(host);
    mounted.push(host);
    if (resize) resize.observe(host);
    if (keep) keep.observe(host);
    if (watch) watch.observe(host); else setLive(host);
  }

  // ── animation ──
  // A drawing moves only while it is the one shown in its card and its block is on screen: then its stage has the class
  // "is-live" (the CSS animations run only under that class) and its tick(time, dt, px) is called on every frame.
  // Each drawing has its own clock that stops while it is not live, so it carries on where it left off.
  // A drawing whose animation has an end (the royalty ones) returns false from tick when it is over, and is not called again.
  // Visitors who turned on "reduce motion" get the still drawings.
  const STILL = !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const moving = [];
  let raf = 0, before = 0;

  function frame(now) {
    raf = moving.length ? requestAnimationFrame(frame) : 0;
    fmPace.frame(now);
    if (!fmPace.due(before, now)) return;                   // the lighter mode for weak devices: every second frame only
    const dt = before ? Math.min((now - before) / 1000, 0.1) : 0.016;
    before = now;
    moving.slice().forEach((fm) => {
      fm.clock += dt;
      try {
        if (fm.art.tick(fm.clock, dt, fm.px) === false) { fm.over = true; moving.splice(moving.indexOf(fm), 1); }   // it has played to its end
      } catch (err) {
        moving.splice(moving.indexOf(fm), 1);
        console.warn("fm-art: the animation of " + fm.key + " was stopped", err);
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
  // The two royalty drawings (they say "once: true") build themselves up one time. Until then nothing of them is shown.
  // Such a drawing is held back until
  //   · its card has appeared: the "cards" script above has made the card visible (it writes the card's opacity, which is read here), and
  //   · enough of the drawing's block is on screen ("seen" in the settings), so the animation is not spent where nobody sees it.
  // A moment later ("wait" in the settings) it starts. From then on it is like any other drawing: it moves while it is on
  // screen and stops while it is not, so an animation that was scrolled away half-way carries on when it comes back.
  function holdBack(host) {
    const fm = host.fmArt, card = host.closest(".reveal-card");
    const cardIsThere = () => card.classList.contains("fm-shown") || (card.style.opacity !== "" ? parseFloat(card.style.opacity) : parseFloat(getComputedStyle(card).opacity)) >= 0.99;
    let there = !card || !window.MutationObserver || cardIsThere(), inView = !window.IntersectionObserver, timer = 0, look = null;
    fm.held = true;
    const start = () => {
      if (!there || !inView || timer) return;
      timer = setTimeout(() => { fm.held = false; if (look) look.disconnect(); setLive(host); }, ROYALTY.wait * 1000);
    };
    if (!there) {
      const wait = new MutationObserver(() => { if (cardIsThere()) { there = true; wait.disconnect(); start(); } });
      wait.observe(card, { attributes: true, attributeFilter: ["style"] });
    }
    if (window.IntersectionObserver) {
      look = new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1], screen = e.rootBounds ? e.rootBounds.height : window.innerHeight;
        inView = e.isIntersecting && (e.intersectionRatio >= ROYALTY.seen || e.intersectionRect.height >= screen * 0.5);   // or half the screen, for a block taller than the screen
        start();
      }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].concat(ROYALTY.seen) });
      look.observe(host);
    }
    start();
  }

  // For the royalty lab page, and for quick experiments in the console: fmRoyalty.settings is the list of settings above.
  // Change a value there and call fmRoyalty.replay(): the two drawings build themselves up again, with the new value.
  window.fmRoyalty = {
    settings: ROYALTY,
    // how the text of an ease is read: { text: the name or curve that is left of it, ok: does GSAP know it? }
    checkEase(text) { const t = easeText(text); return { text: t, ok: !!t && easing(t) !== plainEase }; },
    replay() {
      mounted.forEach((host) => {
        const fm = host.fmArt;
        if (!fm.art.once) return;
        if (fm.art.setup) fm.art.setup();                    // the eases and timings are read from the settings again
        fm.clock = 0; fm.over = false;
        try { fm.art.tick(0, 0, fm.px); } catch (err) { console.warn("fm-art: " + fm.key + " could not be started again", err); }
        if (fm.live && moving.indexOf(fm) < 0) {
          moving.push(fm);
          if (!raf) { before = 0; raf = requestAnimationFrame(frame); }
        }
      });
    }
  };

  // ── appearing and disappearing on scroll ──
  // The drawings of one card take turns: at a trigger point the one on screen fades out,
  // and only then the next one fades in, so two drawings are never visible together.
  // The fades run on a timer, not with the scroll (their length is set in the styles: --fm-out, --fm-in).
  //
  // Whose turn it is:
  //   · in the card stack («Управление», «Документы», «Финансы»): the block the "card stack" script has given the class
  //     fm-turn (it does that by the steps of the card, see SET there). No class: no drawing of that card is shown;
  //   · anywhere else: a block whose scroll animation in Taptop has started. That animation keeps running and writes an
  //     opacity of 0…1 into the block's style; it is no longer shown (the styles hold the block fully visible) and only
  //     read here as "this drawing's turn has come". A block with no scroll animation is simply shown.
  function takeTurns(hosts) {
    if (!TURNS) return;
    const turnHasCome = (host) => host.closest(".fm-cards-on")
      ? host.classList.contains("fm-turn")
      : (host.style.opacity !== "" ? parseFloat(host.style.opacity) : host.fmArt.base) >= 0.5;   // base: for a block with no scroll animation
    let current = null;                                      // index of the drawing on screen, -1 for none

    const sync = () => {
      let next = -1;
      hosts.forEach((host, i) => { if (turnHasCome(host)) next = i; });   // the furthest block that has started wins
      if (next === current) return;
      current = next;
      // is another drawing still (partly) visible? then the new one waits until it has faded out
      const busy = hosts.some((host, i) => i !== next && parseFloat(getComputedStyle(host.fmArt.stage).opacity) > 0.01);
      hosts.forEach((host, i) => {
        const stage = host.fmArt.stage;
        stage.style.setProperty("--fm-wait", i === next && busy ? "var(--fm-out)" : "0s");
        stage.classList.toggle("is-on", i === next);
        host.fmArt.on = i === next;
        setLive(host);                                         // only the drawing on screen keeps moving
      });
    };

    hosts.forEach((host) => new MutationObserver(sync).observe(host, { attributes: true, attributeFilter: ["style", "class"] }));
    sync();
  }

  // ── when the drawings are built ──
  // Building all ten at once, as the page opened, kept weak phones busy for more than a second. Now the drawings of one card
  // are built together (they take turns there) when the card comes within one and a half screens of the visible part of the page,
  // and the cards that are still far away are built one by one after the page has loaded, whenever the browser has nothing else to do.
  // Until then a block is simply empty: it is far from the screen anyway.
  function mountCard(card) {
    if (card.done) return;
    card.done = true;
    card.hosts.forEach(([host]) => { const css = getComputedStyle(host); host.fmWas = { opacity: css.opacity, position: css.position }; });   // read everything first…
    const built = [];
    card.hosts.forEach(([host, key]) => {                    // …then change the page
      try { mount(host, key, true); built.push(host); } catch (err) {
        host.classList.add("fm-failed");                     // the styles then show the block's PNG from Taptop again
        console.warn("fm-art: " + key + " was not drawn, the PNG stays", err);
      }
    });
    built.forEach(finish);
    if (built.length) takeTurns(built);
  }

  function boot() {
    const cards = new Map();                                 // drawings that share a card (the same parent block), in page order
    Object.keys(TARGETS).forEach((key) => {
      document.querySelectorAll(TARGETS[key]).forEach((host) => {
        if (host.fmArt) return;
        const card = cards.get(host.parentElement) || { hosts: [], done: false };
        card.hosts.push([host, key]);
        cards.set(host.parentElement, card);
      });
    });
    const list = [...cards.values()];
    list.forEach((card) => card.hosts.sort((a, b) => (a[0].compareDocumentPosition(b[0]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)));
    if (!window.IntersectionObserver) { list.forEach(mountCard); return; }

    const near = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const card = list.find((one) => one.hosts.some(([host]) => host === e.target));
      if (!card) return;
      card.hosts.forEach(([host]) => near.unobserve(host));
      setTimeout(() => mountCard(card), 0);                  // in a task of its own, not together with the other work of this moment
    }), { rootMargin: "150% 0px" });
    list.forEach((card) => card.hosts.forEach(([host]) => near.observe(host)));

    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    const next = () => {
      const card = list.find((one) => !one.done);
      if (!card) return;
      card.hosts.forEach(([host]) => near.unobserve(host));
      mountCard(card);
      idle(next, { timeout: 3000 });
    };
    const later = () => idle(next, { timeout: 3000 });
    if (document.readyState === "complete") later(); else window.addEventListener("load", later);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
