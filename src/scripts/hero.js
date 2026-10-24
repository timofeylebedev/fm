/* The hero: the chips that float over the table («Весь лейбл — на одной волне»). The table picture is in the HTML
   (see hero.css, where the look of the chips is too). The chips travel over the table from right to left, each at its
   own depth, floating a little. The hero's way in: the team at the table fades in together with the letters of the
   heading; then come its text and the button, and last the chips rise from the table one after another, like the
   letters. (The first card of the stack comes after them: cards.js.) */
import { pace } from "./pace.js";
import { M, calm, cue } from "./motion.js";

// ── the chips ──
// icon: the cell of hero-chips (src/assets/img) (0 … 11, from the left); shape: "cover" (rounded square), "round" or "" (the icon has its own shape)
// dot: the colour of the status dot, or "" for a line without a dot (a sum)
// Their order here is their order on the table, from right to left.
const CHIPS = [
  { icon: 0,  shape: "cover", title: "Альбом «Home»",          dot: "#16d947", text: "Готов к релизу" },
  { icon: 2,  shape: "round", title: "Сборы с концерта",       dot: "",        text: "+ 4 160 000 ₸" },
  { icon: 1,  shape: "",      title: "Лиц. договор № К-011",   dot: "#16d947", text: "Подписан" },
  { icon: 7,  shape: "round", title: "Аванс на клип",          dot: "#16d947", text: "Согласован" },
  { icon: 3,  shape: "cover", title: "Last Seen at 8 AM",      dot: "#ffbf00", text: "На модерации" },
  { icon: 4,  shape: "round", title: "Роялти за сентябрь",     dot: "",        text: "+ 865 947 ₽" },
  { icon: 5,  shape: "round", title: "Лицензия для сериала",   dot: "#e366ff", text: "Согласование" },
  { icon: 6,  shape: "cover", title: "Сингл «Любовь»",         dot: "#ffbf00", text: "Сведение" },
  { icon: 9,  shape: "",      title: "Акт № У-067",            dot: "#ffbf00", text: "В разработке" },
  { icon: 10, shape: "round", title: "Продажа мерча",          dot: "",        text: "+ 210 000 ₽" },
  { icon: 8,  shape: "cover", title: "EP «lazy friday»",       dot: "#33a0ff", text: "Отгружен на площадки" },
  { icon: 11, shape: "round", title: "Обложка релиза",         dot: "#33a0ff", text: "На проверке" }
];

// ── settings ──
// Places on the table are given as shares of the picture's height (0 = its top, 1 = its bottom edge),
// so they fit the picture at every screen width. The table's far edge is at about 0.47.
// Lengths in px are for the chips at their full size (1440px screens); on smaller screens they shrink with the chips.
/* HERO:START */
const HERO = {
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
  enterDelay: 0.1,    // seconds after their turn has come (right after the button's: see "motion" below)
  enterTime: 1.1,     // seconds for one chip (the same as the letters of a heading: fmMotion.M.chars.time)
  enterStagger: 0.08, // seconds between two chips, from left to right
  // the team fades in once its picture has kept its size this long (seconds), at most this much after its turn
  still: 0.12,
  stillMax: 0.6
};
/* HERO:END */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (e0, e1, v) => { const t = clamp01((v - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

// The way in follows the curve of the heading's letters (M.chars.wave in motion.js):
// up from 25% of its height below its place, past it by 10%, back by 4%, past by 1%, and in place;
// fully visible at 40% of the time. Each step eases in and out.
const ENTER = M.chars.wave.map(([t, y]) => [t, y / 100]);
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
  picture.parentElement.appendChild(layer);              // into the picture's stage (hero.css): as tall as the picture, along its bottom

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
    pace.frame(now);
    if (!pace.due(last, now)) return;                 // the lighter mode for weak devices: every second frame only
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    clock += dt;
    travel += (HERO.speed * k * dt) / round;
    draw(clock);
  }
  const start = () => { if (!raf && visible && started && !calm) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  // the lighter mode for weak devices also takes away the frosted glass (see .is-light in the styles)
  const light = () => layer.classList.toggle("is-light", pace.slow);
  light(); pace.onChange(light);

  // The way in (see "motion" at the top). Both parts take their turn in the hero's group of motion.js: the team (the
  // picture fades in: the class hero-in on <html>, see the styles) at the heading's turn, so it starts with its
  // letters; the chips at their own place, after the button. Neither waits for the picture: a turn that comes before
  // it has loaded is played once it has (so the heading never waits for a picture).
  let loaded = false;
  const onLoad = [];
  function begin() {                                     // the picture has loaded
    if (loaded) return;
    loaded = true;
    document.documentElement.classList.add("hero-loaded");
    measure();
    onLoad.splice(0).forEach((fn) => fn());
  }
  // The team fades in at its turn, but only once its picture has kept the same size for a moment (HERO.still): in
  // Safari, on a first visit (a private window), the picture was laid out about 4% too big for a few frames and took
  // its size during the fade, as a jump (Tim's video, Oct 22; never seen in Chromium). Its box is read every frame from
  // its turn on, so a late change of the layout happens under the cover, not in sight.
  function people() {
    const t0 = performance.now();
    let size = "", since = t0;
    const look = (now) => {
      const b = picture.getBoundingClientRect(), k = Math.round(b.width) + "×" + Math.round(b.height);
      if (k !== size) { size = k; since = now; }
      if (now - since >= HERO.still * 1000 || now - t0 >= HERO.stillMax * 1000) document.documentElement.classList.add("hero-in");
      else requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }
  function rise(instant) {                               // the chips rise
    if (started) return;
    started = true;
    measure();
    // the chips that are on screen now rise in one after another, from left to right; the others are simply there
    items.map((it) => [xOf(it), it])
      .filter(([sx, it]) => !instant && !calm && sx + it.w / 2 > 0 && sx - it.w / 2 < W)
      .sort((a, b) => a[0] - b[0])
      .forEach(([, it], i) => { it.enter = clock + HERO.enterDelay + i * HERO.enterStagger; });
    draw(clock);
    start();
  }
  const whenLoaded = (fn) => (loaded ? fn() : onLoad.push(fn));
  const now = (done) => done();
  const title = section.querySelector("h1");
  const timed = cue(picture, { at: title, whenReady: now, play: () => whenLoaded(people) })
    && cue(layer, { lead: HERO.enterTime * 0.7, whenReady: now, play: (instant) => whenLoaded(() => rise(instant)) });
  if (!timed) whenLoaded(() => { people(); rise(false); });
  const img = picture.querySelector("img");
  const loadedNow = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(begin);
  if (img.complete) loadedNow(); else { img.addEventListener("load", loadedNow); img.addEventListener("error", begin); }
  setTimeout(begin, 4000);                               // never wait longer than this

  new ResizeObserver(measure).observe(section);
  document.fonts.ready.then(measure);   // the chips change width when their font arrives
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    visible ? start() : stop();
  }).observe(section);
  measure();

  // ?fmhero=debug: every change of the hero's layout in its first 5 seconds, in the console (fmHero.log)
  if (/[?&]fmhero=debug\b/.test(location.search)) watchLayout(section, picture);

  // For quick experiments in the console: change a value in fmHero.settings, then call fmHero.update()
  window.fmHero = { settings: HERO, update() { sized = ""; measure(); }, state: () => ({ clock, travel, round, W, H, k, section: Math.round(section.getBoundingClientRect().height) }), log: debugLog };
}

// ?fmhero=debug: the sizes that decide the picture's, written down each time one of them changes (ms from the start of
// the page, the boxes in CSS px, the classes on <html>, the fonts that have arrived), so a jump seen in one browser
// can be traced to what moved
const debugLog = [];
function watchLayout(section, picture) {
  const parts = { hero: section, stage: picture.parentElement, picture, text: section.querySelector(".hero__text"),
    title: section.querySelector("h1"), lead: section.querySelector(".hero__lead") };
  let last = "";
  const look = () => {
    const row = { ms: Math.round(performance.now()) };
    for (const [name, el] of Object.entries(parts)) {
      const b = el && el.getBoundingClientRect();
      if (b) row[name] = Math.round(b.top) + "+" + Math.round(b.height) + (name === "picture" ? " w" + Math.round(b.width) : "");
    }
    row.vh = innerHeight + "/" + document.documentElement.clientWidth;
    row.html = document.documentElement.className;
    row.fonts = [...document.fonts].filter((f) => f.status === "loaded").length;
    const key = JSON.stringify(Object.assign({}, row, { ms: 0 }));
    if (key !== last) { last = key; debugLog.push(row); console.log("fmhero", row); }
    if (performance.now() < 5000) requestAnimationFrame(look);
    else console.table(debugLog);
  };
  look();
}

export function initHero() {
  const picture = document.querySelector("[data-hero-table]");
  if (!picture) return;
  try { init(picture.closest("section"), picture); } catch (err) {
    document.documentElement.classList.add("hero-loaded", "hero-in");   // the picture is shown in any case
    console.warn("hero: the chips were not added", err);
  }
}
