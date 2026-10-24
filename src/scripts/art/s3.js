/* The drawings of «Финансы»: income nested by level (s3-1), payments flying in with comet tails (s3-2) and the budget
   split into rings around the cube (s3-3). See art/mount.js for how a drawing is put on the page and moved. */
import { SIZE, at, pic, unit, TAU, clamp01, noise1, hash3, seeded, erf, smooth, nextId } from "./shared.js";

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
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
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

export default {
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
      [206.55, 599.47, 77.79, "#f74a5e", "art-icon-brush.svg", "− 35 000 ₽", "Обложка релиза"],
      [271.49, 500, -5.11, "#c34bdb", "art-icon-star.svg", "+ 4 160 000 ₸", "Сборы с концерта"],
      [148.53, 400.52, 63.97, "#007deb", "art-icon-copyright.svg", "+ $6 000", "Лицензия для сериала"],
      [341.95, 301.05, -32.74, "#0095b2", "art-icon-video.svg", "− 180 000 ₽", "Аванс на клип"],
      [380.63, 698.95, -88, "#ffa100", "art-icon-tshirt.svg", "+ 210 000 ₽", "Продажа мерча"]
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
    const id = nextId(), MID = 499.84, HALF = 102.9485, C = TAU * 96.853;   // centre of the drawing; half a ring's box; length of a ring's line
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
  }
};
