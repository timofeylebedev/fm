/* The dots that move to the music: the stat cards under «Три года музыки» and the purple card «От тихой рутины…».
   A WebGL version of Originkit's "Tidal Stipple". A block is filled with tiny dots that thin out in one direction: on
   the stat cards they are dense at the bottom (where the white text sits) and sparse at the top; on the purple card
   they are dense along its rounded border and thin out towards the middle. A slow tide rolls through the dots, and a
   simulated track pushes them on, column by column, like a level meter. Each kind of block has its own settings below
   (data-dots="cards" or data-dots="cta" in the HTML). Without WebGL2 a stat card fades into its colour instead and the
   purple card stays purple. */
import { pace } from "./pace.js";
import { calm } from "./motion.js";

// ── settings ──
// Most names and units are those of the Originkit panel, so values tried out there can be copied here as they are.
// The "Stipple tuner" page has sliders for all of them and a button that copies a whole set, ready to paste here.

// The three stat cards. The colour of their dots is --dots in the styles (.stat--orange, .stat--blue, .stat--green).
/* STIPPLE:START */
const STIPPLE = {
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
const STIPPLE_CTA = {
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
  cards: { settings: STIPPLE, shape: "bottom", hosts: "[data-dots='cards']" },
  cta:   { settings: STIPPLE_CTA, shape: "edge", hosts: "[data-dots='cta']" }
};

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
  canvas.className = "dots";
  canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, premultipliedAlpha: false });
  const fail = (err) => { if (err) console.warn("stipple:", err); canvas.remove(); host.classList.add("no-dots"); };
  if (!gl) return fail();                            // no WebGL2: the block keeps its plain look

  const css = getComputedStyle(host);
  const c0 = set.settings;
  const cssBase = color(css.getPropertyValue("--dots"), null);
  const me = {
    host, canvas, gl, set,
    // the colour of the dots: the set's own "color", or else --dots of the block
    base: color(c0.color, cssBase || [0.96, 0.43, 0]),
    accent: color(c0.accent, lighter(cssBase || [0.96, 0.43, 0])),
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
  // back, the block shows its plain look (the class no-dots, see the styles) instead of a black or frozen canvas.
  // When it is back, everything is made again and the dots carry on.
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); me.lost = true; host.classList.add("no-dots"); });
  canvas.addEventListener("webglcontextrestored", () => {
    try { me.g = makeGL(gl); } catch (err) { console.warn("stipple:", err); return; }
    me.lost = false;
    host.classList.remove("no-dots");
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
  pace.frame(now);
  if (!pace.due(last, now)) { raf = requestAnimationFrame(frame); return; }   // the lighter mode for weak devices: every second frame only
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
  if (raf || calm || document.hidden || api.paused) return;
  if (!instances.some((me) => me.visible && !me.lost)) return;
  last = 0;
  raf = requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", wake);

// Set up the blocks of one set (main.js loads this file and calls this when one of them comes within one screen of
// the visible part of the page: all blocks of a set together, as the stat cards slide in from the side).
export function initDots(name) {
  document.querySelectorAll(SETS[name].hosts).forEach((host) => {
    try { mount(host, SETS[name]); } catch (err) { console.warn("stipple:", err); }
  });
}

// For the tuner page and for quick experiments in the console: change fmStipple.settings (the stat cards)
// or fmStipple.cta (the CTA card), then call fmStipple.update()
window.fmStipple = Object.assign(api, {
  settings: STIPPLE,
  cta: STIPPLE_CTA,
  sets: SETS,
  update() { instances.forEach((me) => me.redraw()); wake(); },
  instances
});
