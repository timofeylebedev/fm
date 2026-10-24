/* The dust that moves to the music: the stat cards under «Три года музыки» and the purple card «От тихой рутины…».
   Each card is filled with its own colour, and white dust lives on it: tens of thousands of specks, each one moved by a
   small physics model on the graphics chip. They rest in a body along the card's dense side (the bottom of a stat card,
   the middle of the purple card); a simulated track beats under them, and on each beat gusts of air (a small fluid
   simulation) throw the dust up from where the music is loudest. Thrown up, a grain slows, hangs and falls back into its
   layer. The pointer stirs the air, a press throws the dust out.
   When a card first comes into view, its dust is pushed in: up from the bottom of a stat card, out of the middle of the
   purple card, in uneven lumps, and falls back into place.
   The look was tuned in the Card Dust Lab (Oct 19, 2026, «Push in 2 · 19 Oct»; the purple card again on Oct 25, with
   its dimmed middle); the settings below are its values and keep its names and units, so a block from the lab's
   «Copy settings» can be pasted over them (the purple card's own unit, `unit`, is the site's: see STIPPLE_CTA).
   Without WebGL2 a card simply keeps its colour. With "reduce motion" the dust is shown at rest and nothing moves. */
import { pace } from "./pace.js";
import { ioRoot, onScroll } from "./scroller.js";
import { calm } from "./motion.js";

// ── settings ──
// Lengths are in stat-card heights ("units") on both kinds of card, speeds in units per second, so a value means the
// same on the stat cards and on the purple card. The amount is per 100×100 CSS px of stat card (a stretch of the dense
// side as long as 100 px and as deep as a stat card), so a bigger card gets more dust, as dense.

// The three stat cards. Their colour is --dots in the styles (.stat--orange, .stat--blue, .stat--green).
/* STIPPLE:START */
const STIPPLE = {
  // the air (Billow)
  puff: 580,          // strength of the gusts the beat blows up from the edge
  puffs: 2,           // gusts per beat across a stat card's width, where the music is loudest
  puffW: 5,           // width of a gust, % of a unit
  curl: 5,            // how much the air rolls up into eddies
  calm: 195,          // how fast the air comes to rest
  follow: 470,        // how firmly the dust follows the air
  whip: 400,          // a fast gust grips a grain harder (whips it up at once)
  gravity: 1500,      // how fast thrown-up dust falls back
  fallDrag: 80,       // air resistance on falling dust
  fallVar: 100,       // % lighter and heavier grains (they fall at different speeds)
  cushion: 4,         // % of a unit over which a falling grain lands softly
  settle: 210,        // how firmly a grain is held in its layer
  thermals: 99,       // % small gusts between the beats
  // the body of dust
  amount: 14000,      // specks per 100×100 px of stat card (before invAmount)
  core: 48,           // % of a unit: depth of the dense layer
  coreShare: 100,     // % of the specks in the dense layer
  reach: 60,          // % of a unit: how far the body reaches
  falloff: 900,       // how fast the body thins out towards its reach
  clumps: 40,         // % the dust gathers into clouds
  clumpScale: 670,    // size of the clouds (higher = smaller)
  ragged: 102,        // % fine spikes on the top of the body
  ragScale: 100,      // size of the spikes
  ragKick: 400,       // % how much the spikes flare after a beat
  wave: 35,           // % height of the slow wave along the body
  waveScale: 240,     // length of the wave (higher = shorter)
  waveSpeed: 200,     // how fast the wave changes
  waveTravel: 12,     // how fast it travels along
  waveIrreg: 100,     // % irregular (no repeating shape)
  sway: 0,            // % the body sways on slow currents
  swayScale: 100,
  churn: 13,          // how fast the clouds change
  life: 2,            // s a speck lives before it is renewed somewhere else
  // a speck
  sizeMin: 0.6,       // device px
  sizeMax: 1,
  skew: 260,          // % mostly small specks
  sizeEdge: 120,      // % bigger deep in the body
  stars: 0,           // % big bright specks
  starSize: 260,
  streak: 16,         // ms of motion a speck is stretched over
  thin: 500,          // fast specks and specks far out thin out
  opacity: 100,       // %
  twinkle: 10,        // %
  flash: 0,           // % fast specks light up
  glint: 0,           // % specks glint now and then
  lens: 100,          // % perspective (depth towards the eye)
  dof: 0,             // % out of focus off the card's plane
  // the music
  bpm: 83,            // tempo of the beat
  bar: 4,             // beats in a bar (the first one is the big one)
  accent: 245,        // % strength of the first beat of a bar
  groove: 83,         // % beats differ in strength
  bands: 50,          // columns of the track across a stat card
  lift: 30,           // % how far the loud columns raise the body
  attack: 80,         // % how fast a column rises…
  release: 64,        // % …and falls back
  cascade: 28,        // % of a beat between one card and the next
  // the arrival: the dust is pushed in from the dense side when the card first comes into view
  arrH: 30,           // % of a unit: how far above its place the dust is thrown
  arrSpeed: 100,      // % how fast the throw rises
  arrSpread: 0,       // ms over which the dust leaves (the lumps first)
  arrLump: 170,       // % how uneven the push is (past 100: the low parts barely move, thin spikes shoot out)
  arrLumpSize: 100,   // % width of the lumps (100 ≈ half a stat card)
  // the pointer
  touch: 1,           // 1 = the dust reacts to the pointer
  touchR: 100,        // % of a unit: the size of the air the pointer moves
  sweep: 10,          // % how much the moving pointer carries the air along
  tap: 800,           // how hard a press throws the dust out
  // colour: the card is filled with its colour, the dust is white
  invAmount: 50,      // % of the amount above
  invOpacity: 45,     // % opacity of the dust
  invClear: 100,      // % the dust fades out low down, behind the text (up to the dense layer's height)
  dust: "var(--paper)",
  maxDpr: 2           // render resolution cap
};
/* STIPPLE:END */

// The purple card. Its dust is one body in the middle of the card (behind the title), thrown outwards on the beat and
// falling back into the middle; the middle is dimmed back towards the card's colour, so the text keeps its ground.
// Settings that differ from the stat cards' or are its own (the lab's CTA «Copy settings» of Oct 25, 2026):
/* STIPPLE_CTA:START */
const STIPPLE_CTA = Object.assign({}, STIPPLE, {
  // its unit is its own: a share of the card's height (in the lab, where it was tuned, a stat card was 36.5% of the
  // purple card's height). So the body and everything else measured in units keep the same share of the card on
  // every screen, whatever the stat cards do: the body's width follows the card's width, its height the card's height
  unit: 36.5,         // % of the card's height
  core: 70, reach: 150,
  bands: 4,
  spin: 6,            // degrees per second the columns of the track travel round the body
  srcW: 40,           // % the body's proportions: its width…
  srcH: 30,           // % …against its height, as shares of the card
  taper: 0,           // % 0 = an oval body, 100 = a lens with pointed ends
  srcY: 0,            // % moves the centre up or down
  arrLump: 100,
  invAmount: 100,
  invOpacity: 25,
  invClear: 75,       // % the dust thins out round each text line and the button…
  quietPad: 60,       // % of a unit: …this far round them
  // the dimmed middle: the card's colour laid over the dust, strongest in the middle and fading out to the oval's edge
  dim: 1,             // 1 = on
  dimColor: "var(--purple)",
  dimAmount: 89,      // % in the very middle
  dimW: 80,           // % of the card's width the oval reaches across…
  dimH: 80,           // % …and of its height
  dimSoft: 100,       // % 0 = a hard-edged oval, 100 = it fades all the way from the middle
  dimY: 0,            // % moves it up or down
  background: "var(--purple)"
});
delete STIPPLE_CTA.cascade;
/* STIPPLE_CTA:END */

// ── where each set goes ──
// shape "bottom": the body lies along the bottom; shape "middle": one body in the middle of the card
const SETS = {
  cards: { settings: STIPPLE, shape: "bottom", hosts: "[data-dots='cards']" },
  cta:   { settings: STIPPLE_CTA, shape: "middle", hosts: "[data-dots='cta']" }
};

/* ═════════ the engine's ladder ═════════
   Measured in the lab on a MacBook Pro, an iPhone Air and an iPad (9th generation): 0 = exact; 1 = at most one step of
   the simulation per frame (the same at a steady 60 fps); 2 = coarser air (cells ×1.6) and 12 pressure steps instead of
   20 (every measured statistic within 0.4% of level 0, which varies 1–9% by itself); 3 = draw a random 75% of the
   specks (fewer on a card with very many: at most 120 000, at least 40%), each as much stronger, and only those move;
   4 = render scale 0.75 (never under one device px per CSS px); 5 = 30 frames a second.
   It starts at 2 on phones and tablets, 1 elsewhere, and moves only when frames are really dropped (a step down that
   does not help is undone) or when there is room again. Frames while the page scrolls or is touched do not count. */
const touchDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ""));
const engine = { level: touchDevice ? 2 : 1, auto: true, scale4: 0.75, keep3: 0.75, budget3: 120000, stepAt: 0, lastWork: 0 };
const MAX_COLS = 1024, STEP = 1 / 60;
// at most this many specks on a card (past it each is that much stronger). Without a graphics chip (software WebGL, as
// in the audit's headless browser; Chrome itself no longer offers WebGL that way to visitors) a card gets a few
// thousand, so the page stays usable
let MAX_SPECKS = 300000;

/* ═════════ shaders ═════════ */
const COMMON = `
precision highp float;
precision highp int;
precision highp sampler2D;
uniform vec2 uRes;
uniform float uTime, uShape, uRadius, uRef, uEdgeLen, uSeed, uPx;
uniform vec4 uInner;   // the middle body (uShape 1): centre x, y (px), width / height, pointedness (2 = oval, 1 = lens)
uniform float uColPx, uCols, uSpin;
uniform sampler2D uLevelTex;
uniform float uReach, uFalloff, uClumps, uClumpScale, uChurn;
uniform float uWave, uWaveScale, uWaveSpeed, uWaveTravel, uWaveIrreg, uLift, uCore, uCoreShare;
uniform float uRagged, uRagScale, uRagKick, uBeatT, uBeatN, uLens;

// PCG hash (Jarzynski & Olano, JCGT 2020, MIT): bit-exact on every GPU
uvec4 pcg4d(uvec4 v){
  v = v*1664525u + 1013904223u;
  v.x += v.y*v.w; v.y += v.z*v.x; v.z += v.x*v.y; v.w += v.y*v.z;
  v ^= v >> 16u;
  v.x += v.y*v.w; v.y += v.z*v.x; v.z += v.x*v.y; v.w += v.y*v.z;
  return v;
}
vec4 rand4(float id, float gen, float salt){
  return vec4(pcg4d(uvec4(uint(id), uint(max(gen, 0.0)), uint(salt), uint(uSeed))) >> 8u)*(1.0/16777216.0);
}

// 3D simplex noise: Ashima Arts / Stefan Gustavson (MIT)
vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4 mod289(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0) + 1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_*D.wyz - D.xzx;
  vec4 j = p - 49.0*floor(p*ns.z*ns.z);
  vec4 x_ = floor(j*ns.z);
  vec4 y_ = floor(j - 7.0*x_);
  vec4 x = x_*ns.x + ns.yyyy;
  vec4 y = y_*ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m*m;
  return 42.0*dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float sdRoundBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
// px from the card's rounded border, inwards
float insideAt(vec2 p){ vec2 c = uRes*0.5; return -sdRoundBox(p - c, c, min(uRadius, min(c.x, c.y))); }
// from the middle: how far the body reaches in the direction d, compared with straight up (1)
float shapeS(vec2 d){
  float p = uInner.w;
  return 1.0/pow(pow(abs(d.x)/uInner.z, p) + pow(abs(d.y), p), 1.0/p);
}
// a speck's own place on the dense side (u: px along it): the point b it rises from and the way d it rises
void homeAt(float u, out vec2 b, out vec2 d){
  if (uShape < 0.5) { b = vec2(u, 0.0); d = vec2(0.0, 1.0); }
  else { float th = u/uEdgeLen*6.2831853; b = uInner.xy; d = vec2(cos(th), sin(th)); }   // from the middle, outwards
}
// the music: columns of a fixed width along the dense side (all the way round the middle body)
float colAt(float i){ i = uShape > 0.5 ? mod(i, uCols) : clamp(i, 0.0, uCols - 1.0); return texelFetch(uLevelTex, ivec2(int(i), 0), 0).r; }
float levelAt(float u){
  float f = u/uColPx + (uShape > 0.5 ? uSpin*uCols : 0.0);
  float g = f - 0.5, i0 = floor(g);
  return mix(colAt(i0), colAt(i0 + 1.0), smoothstep(0.0, 1.0, g - i0));
}
// a noise along the dense side: round the middle body sampled on a circle, so it closes without a seam
float edgeNoise(float u, float scale, float travel, float t, float salt){
  if (uShape < 0.5) {
    float x = u/uRef*scale - travel;
    return 0.65*snoise(vec3(x, salt, t)) + 0.35*snoise(vec3(x*2.3, salt + 5.1, t*1.4));
  }
  float R = uEdgeLen/uRef*scale/6.2831853;
  float th = u/uEdgeLen*6.2831853 - travel/max(R, 0.01);
  vec2 c = vec2(cos(th), sin(th))*R;
  return 0.65*snoise(vec3(c + salt, t)) + 0.35*snoise(vec3(c*2.3 + salt + 5.1, t*1.4));
}
// one octave along the edge; shift moves it sideways (in its own noise units)
float edge1(float u, float scale, float shift, float t, float salt){
  if (uShape < 0.5) return snoise(vec3(u/uRef*scale - shift, salt, t));
  float R = uEdgeLen/uRef*scale/6.2831853;
  float th = u/uEdgeLen*6.2831853 - shift/max(R, 0.01);
  return snoise(vec3(vec2(cos(th), sin(th))*R + salt, t));
}
// the slow wave. Irregular: three octaves at uneven ratios, each travelling at its own speed (one against the others),
// a slow warp that stretches and squeezes them, a slow envelope that leaves calm stretches between tall ones, and
// crests sharper than the troughs, so the shape never visibly repeats
float waveNoise(float u){
  float t = uTime*uWaveSpeed, tr = uTime*uWaveTravel, q = uWaveIrreg;
  float warp = edge1(u, uWaveScale*0.31, tr*0.4, t*0.35, 31.0)*1.4*q;
  float a = edge1(u, uWaveScale, tr + warp, t, 1.7);
  float b = edge1(u, uWaveScale*2.37, -tr*0.55 + warp*1.6, t*1.41, 9.1);
  float c = edge1(u, uWaveScale*5.13, tr*1.7, t*2.03, 17.3);
  float n = 0.62*a + mix(0.3, 0.38, q)*b + mix(0.0, 0.17, q)*c;
  float env = 0.5 + 0.5*edge1(u, uWaveScale*0.17, tr*0.2, t*0.21, 44.0);
  n *= mix(1.0, 0.2 + 1.6*env, q);
  return n > 0.0 ? n*(1.0 + 0.7*q*n) : n*(1.0 - 0.35*q);
}
// the ragged top of the body: fine spikes that flicker and flare up after each beat
float erosionNoise(float u){ return edgeNoise(u, uRagScale, 0.0, uTime*0.45 + uBeatN*0.23, 13.3); }
// both are baked once per step along the edge (uEdgeTex), so a speck reads them instead of working them out
uniform sampler2D uEdgeTex;
vec2 edgeAt(float u){ return texture(uEdgeTex, vec2(u/uEdgeLen, 0.5)).rg*2.0 - 1.0; }
float clumpAt(vec2 p){
  vec2 q = p/uRef*uClumpScale; float t = uTime*uChurn*0.6;
  return 0.5 + 0.5*(0.65*snoise(vec3(q, t)) + 0.35*snoise(vec3(q*2.3 + 7.7, t*1.3)));
}
// the height (units) at which a speck of the layer hH rests right now
float restH(float u, float hH){
  float f = clamp(hH/max(uReach, 1e-3), 0.0, 1.0);
  vec2 e = edgeAt(u);                                   // wave and spikes, one texture read
  float sh = max(1.0 + uWave*e.x, 0.05);
  float k = 1.0 + uLift*levelAt(u)*1.5;
  float rag = 1.0 + uRagged*e.y*(0.45 + uRagKick*exp(-uBeatT*5.0))*f*f;
  float tap = 1.0;
  if (uShape > 0.5) { vec2 bb, dd; homeAt(u, bb, dd); tap = shapeS(dd); }
  return hH*sh*k*max(rag, 0.08)*tap;
}
// a new home: three candidates from the density profile, the one deepest in a cloud wins
void spawn(float id, float gen, out float u, out float h){
  float best = -1.0; u = 0.0; h = 0.0;
  for (int k = 0; k < 3; k++) {
    vec4 r = rand4(id, gen, 20.0 + float(k));
    float uk = r.x*uEdgeLen;
    // (from the middle the rays spread apart, so the spread is evened out over the area: denser centre, no hot spot)
    float ry = uShape > 0.5 ? pow(r.y, 0.62) : r.y;
    float hk = r.w < uCoreShare ? uCore*ry*(0.8 + 0.4*r.z) : pow(r.y, uFalloff)*uReach;
    vec2 b, d; homeAt(uk, b, d);
    float s = mix(r.z, clumpAt(b + d*hk*uRef), uClumps);
    if (s > best) { best = s; u = uk; h = hk; }
  }
}
vec2 curl2(vec2 q, float t){
  float e = 0.05;
  float n1 = snoise(vec3(q + vec2(0.0, e), t)), n2 = snoise(vec3(q - vec2(0.0, e), t));
  float n3 = snoise(vec3(q + vec2(e, 0.0), t)), n4 = snoise(vec3(q - vec2(e, 0.0), t));
  return vec2(n1 - n2, n4 - n3)/(2.0*e);
}
`;

// the wave and the spikes along the edge, one texel per stretch of it
const FRAG_EDGE = `#version 300 es
${COMMON}
uniform float uEdgeW;
out vec4 o;
void main(){
  float u = (gl_FragCoord.x - 0.5)/(uEdgeW - 1.0)*uEdgeLen;
  if (uShape > 0.5) u = gl_FragCoord.x/uEdgeW*uEdgeLen;   // round the middle body the texture repeats
  o = vec4(clamp(vec2(waveNoise(u), erosionNoise(u))*0.5 + 0.5, 0.0, 1.0), 0.0, 1.0);
}`;
const VERT_FULL = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p*2.0 - 1.0, 0.0, 1.0); }`;

// how a speck is drawn, worked out once per step (in the update), so the drawing only reads it: a soft disc stretched
// into a streak along its motion; nearer = bigger (perspective)
const DRAWP = `
uniform float uSizeMin, uSizeMax, uSkew, uSizeEdge, uStars, uStarSize, uStreak, uTwinkle, uGlint, uThin, uDof, uLife, uFlash, uClear;
uniform vec4 uQuiet[16]; uniform float uQuietN, uQuietPad;
vec2 projP(vec3 P, out float s){ s = uLens/max(uLens - P.z, 0.05); return uRes*0.5 + (P.xy - uRes*0.5)*s; }
void drawParams(vec4 A, vec4 B, vec4 C, float id, out vec4 D1, out vec4 D2){
  D1 = vec4(0.0); D2 = vec4(0.0);
  if (B.w < 0.0) return;
  vec4 r = rand4(id, B.w, 3.0), r2 = rand4(id, B.w, 5.0);
  float s, s2;
  vec2 head = projP(A.xyz, s);
  vec2 tail = projP(A.xyz - vec3(B.xy, B.z)*uStreak, s2);
  vec2 ax = head - tail; float len = length(ax);
  float maxLen = 0.6*uRef;
  if (len > maxLen) { ax *= maxLen/len; len = maxLen; }
  tail = head - ax;

  float u = C.x, f = clamp(C.y/max(uReach, 1e-3), 0.0, 1.0);
  vec2 b, d; homeAt(u, b, d);
  float star = step(1.0 - uStars, r2.y);
  float sz = mix(uSizeMin, uSizeMax, pow(r2.x, uSkew))*mix(uSizeEdge, 1.0, f)*mix(1.0, uStarSize, star);
  float rad = 0.5*sz*uPx*s;
  float coc = abs(A.z)*uDof*uPx*3.0;                    // out of focus: the disc grows and its light spreads
  float a = (rad*rad + 0.25*uPx*uPx)/((rad + coc)*(rad + coc) + 0.25*uPx*uPx);
  rad += coc;
  float L = uLife*(0.6 + 0.8*r.w);
  a *= smoothstep(0.0, 0.5, A.w)*(1.0 - smoothstep(L - 0.7, L, A.w));
  a *= 1.0 - uTwinkle*(0.5 + 0.5*sin(uTime*(1.3 + 2.0*r2.z) + r2.w*40.0));
  float he = dot(A.xy - b, d)/uRef;                      // dust flying far from the body thins out
  if (uShape > 0.5) he /= shapeS(d);
  a *= exp(-max(he - uReach*1.15, 0.0)*uThin);
  if (uShape > 0.5) {
    // the middle body: the dust thins out round each text line (uQuiet) when uClear is set
    float q = 1e9;
    for (int i = 0; i < 16; i++) {
      if (float(i) >= uQuietN) break;
      vec4 R = uQuiet[i]; vec2 c = 0.5*(R.xy + R.zw), hb = 0.5*(R.zw - R.xy);
      vec2 o = abs(head - c) - hb;
      q = min(q, length(max(o, 0.0)) + min(max(o.x, o.y), 0.0));
    }
    a *= 1.0 - uClear*(1.0 - smoothstep(0.0, uQuietPad, q));
    if (insideAt(head) < 0.0) a = 0.0;
  } else a *= 1.0 - uClear*(1.0 - smoothstep(0.0, max(uCore, 0.15)*1.1, he));   // the stat cards: clear low down, behind the text
  a *= 1.0 - smoothstep(uLens*0.55, uLens*0.85, A.z);    // nothing hits the eye
  if (rad < 0.5*uPx) { a *= rad/(0.5*uPx); rad = 0.5*uPx; }
  a *= (2.0*rad + uPx)/(2.0*rad + uPx + len*0.55);
  float gl = uGlint*pow(0.5 + 0.5*sin(uTime*(1.2 + 2.0*r2.z) + r2.w*60.0), 12.0)*(0.3 + 0.7*star) + star*0.35
      + uFlash*smoothstep(0.4, 2.5, length(vec3(B.xy/uRef, B.z)));
  D1 = vec4(tail, ax); D2 = vec4(rad, 0.6*uPx + coc*0.8, a, gl);
}
`;

/* The specks. Their state lives in two buffers used in turn (transform feedback), per speck five vec4:
   A = position x, y (device px), depth z (units, towards the eye), age (s)
   B = velocity x, y (px/s), z (units/s), generation (a new one each time it is renewed)
   C = u (px along the dense side where it lives), its layer in the body (units), arriving (1 while pushed in), -
   D1, D2 = how it is drawn (from drawParams above) */
const UPDATE = `#version 300 es
${COMMON}
uniform float uArrive, uArrT, uArrH, uArrG, uArrSpread, uArrLump, uArrSeed, uArrLumpSize;
uniform float uDt, uSway, uSwayScale, uOmega, uRescale;
uniform float uFollow, uHasFluid, uGrav, uFallDrag, uFallVar, uCushion, uWhip; uniform vec2 uCell; uniform sampler2D uVel;
layout(location = 0) in vec4 aA;
layout(location = 1) in vec4 aB;
layout(location = 2) in vec4 aC;
out vec4 vA; out vec4 vB; out vec4 vC;
out vec4 vD1; out vec4 vD2;
${DRAWP}

float lifeOf(vec4 r){ return uLife*(0.6 + 0.8*r.w); }
// where a speck waits before it is pushed in (units from its point, along its way in): just under the bottom edge of a
// stat card (unseen), or in the middle of the purple card
float arrStartH(float id, vec2 d){
  vec4 ra = rand4(id, 0.0, 43.0);
  return uShape > 0.5 ? 0.06*ra.y*shapeS(d) : -0.015 - 0.025*ra.y;
}
void born(float id, float gen, float age){
  float u, h; spawn(id, gen, u, h);
  vec2 b, d; homeAt(u, b, d);
  vec3 P = vec3(b + d*restH(u, h)*uRef, 0.0);
  float flag = 0.0;
  if (uArrive < 1.0 && gen < 0.5) { P = vec3(b + d*arrStartH(id, d)*uRef, 0.0); flag = 1.0; }
  vA = vec4(P, age); vB = vec4(0.0, 0.0, 0.0, gen); vC = vec4(u, h, flag, 0.0);
}
void sim(){
  vec4 A = aA, B = aB, C = aC;
  if (uRescale != 1.0) { A.xy *= uRescale; B.xy *= uRescale; C.x *= uRescale; }   // the canvas changed resolution
  float id = float(gl_VertexID);
  float gen = B.w;
  if (gen < 0.0) { vec4 r0 = rand4(id, 0.0, 3.0); born(id, 0.0, r0.x*lifeOf(r0)); return; }
  vec4 r = rand4(id, gen, 3.0);
  float age = A.w + uDt;
  if (age > lifeOf(r)) { born(id, gen + 1.0, 0.0); return; }

  float u = C.x, hH = C.y;
  vec2 b, d; homeAt(u, b, d);
  vec3 P = vec3(A.xy/uRef, A.z), V = vec3(B.xy/uRef, B.z);
  float f = clamp(hH/max(uReach, 1e-3), 0.0, 1.0);
  float hr = restH(u, hH);
  // ARRIVING: pushed from its start along its way in, slowing like a throw (against uArrG, units/s²) to a stop above its
  // place; there the physics below takes over and it falls back in. Every speck leaves at once (unless uArrSpread);
  // the lumps of a noise along the edge are thrown highest and fastest, the low parts slower (past 100% of uArrLump
  // up to 2.4 times slower, and not above their place at all)
  if (C.z > 0.5) {
    vec4 ra = rand4(id, 0.0, 43.0);
    float ls = 1.7/max(uArrLumpSize, 0.05);
    float lump = clamp(0.5 + 0.42*edge1(u, ls, 0.0, uArrSeed, 5.3) + 0.24*edge1(u, ls*2.9, 0.0, uArrSeed*1.3, 8.9), 0.0, 1.0);
    float lk = max(1.0 + 1.4*uArrLump*(lump - 0.5), 0.0);
    float spike = max(uArrLump - 1.0, 0.0)*1.6*pow(ra.y, 7.0)*smoothstep(0.35, 0.8, lump);
    float tl = uArrSpread*(0.55*ra.x + 0.45*(1.0 - lump*min(uArrLump, 1.0)));
    float h0 = arrStartH(id, d);
    float over = uArrH*((0.35 + 0.65*ra.z)*lk + spike)*(uShape > 0.5 ? shapeS(d) : 1.0);
    float Hh = max(hr + over - h0, 0.01);
    float Tr = sqrt(2.0*Hh/max(uArrG, 0.1))*(1.0 + 1.4*max(uArrLump - 1.0, 0.0)*pow(1.0 - lump, 1.5)*(0.7 + 0.6*ra.x));
    float sa = (uArrT - tl)/Tr;
    vec2 tg = vec2(-d.y, d.x);
    float lat = (ra.w - 0.5)*0.3*over;
    if (uArrive >= 1.0) sa = 1.0;
    if (sa < 1.0) {
      vec3 Pa, Va;
      if (sa < 0.0) { Pa = vec3(b/uRef + d*h0, 0.0); Va = vec3(0.0); }
      else {
        float e = 1.0 - (1.0 - sa)*(1.0 - sa);
        Pa = vec3(b/uRef + d*(h0 + Hh*e) + tg*lat*sa, 0.0);
        Va = vec3(d*(2.0*Hh*(1.0 - sa)/Tr) + tg*lat/Tr, 0.0);
      }
      // (in flight fully shown; in the middle of the purple card it fades in over the first 0.1 s)
      vA = vec4(Pa.xy*uRef, 0.0, uShape > 0.5 ? clamp(uArrT*5.0, 0.0, 0.5) : 0.5); vB = vec4(Va.xy*uRef, 0.0, gen); vC = vec4(u, hH, 1.0, 0.0);
      return;
    }
    P = vec3(b/uRef + d*(hr + over) + tg*lat, 0.0); V = vec3(tg*lat/Tr, 0.0);   // at its peak: the physics from here
    age = 0.5 + ra.y*max(lifeOf(r) - 1.2, 0.0);                                 // ages spread out, so they renew unevenly
  }
  float t = uTime*uChurn;
  // its place in the body, swaying on slow air currents (further out sways more)
  vec3 T = vec3(b/uRef + d*hr, 0.0);
  if (uSway > 0.0) T.xy += curl2(T.xy*uSwayScale, t)*uSway*(0.25 + f);
  vec3 acc = vec3(0.0);
  vec4 rb = rand4(id, gen, 100.0 + mod(uBeatN, 4096.0));
  // carried by the air (the fluid simulation) and sinking back into its layer
  vec2 air = uHasFluid > 0.5 ? texture(uVel, A.xy/uRes).xy*uCell/uRef : curl2(P.xy*uSwayScale, t)*0.15;
  // the air grips a grain harder the faster it moves past it: a gust whips grains up at once, calm air barely holds
  // them, so they fall freely again. The deep, packed dust is heavier: it lags the air
  vec2 slip = air - V.xy;
  float held = uCore > 1e-3 ? smoothstep(uCore*0.55, uCore + 0.12, hH) : 1.0;   // the dense layer behind the text stays put
  acc.xy += slip*uFollow*mix(0.35, 1.0, f)*mix(0.08, 1.0, held)*(1.0 + uWhip*length(slip)*held);
  vec2 tg = vec2(-d.y, d.x);
  vec2 rel = P.xy - b/uRef, relT = T.xy - b/uRef;
  float hn = dot(rel, d) - dot(relT, d), ot = dot(rel, tg) - dot(relT, tg);
  float vn = dot(V.xy, d);
  // above its layer a grain falls: gravity, slowed by the air to a steady speed (lighter grains fall slower), easing
  // off in the last stretch so it lands softly. Thrown up, it slows down, hangs and falls faster and faster.
  // Inside its layer it is held up firmly without bouncing, so a rising layer lifts it at once.
  float grain = 1.0 + uFallVar*(r.y - 0.5)*1.4;
  float above = smoothstep(0.0, uCushion + 1e-3, hn);
  float an = -uGrav*above/grain - uFallDrag*vn*grain*mix(0.15, 1.0, above);
  float k = uOmega*uOmega;
  if (hn < 0.0) an += -k*hn - 2.0*uOmega*vn;
  else an += -2.0*uOmega*vn*(1.0 - above);
  acc.xy += d*an - tg*(k*0.06*ot + 1.5*dot(V.xy - air, tg)*(1.0 - above));
  acc.z += -k*P.z - 4.0*V.z;
  V += acc*uDt;
  V = clamp(V, vec3(-60.0), vec3(60.0));
  P += V*uDt;
  P.z = min(P.z, uLens*0.92);
  // never through the bottom edge of a stat card: mirrored back in, bouncing a little (not onto the line, or the edge
  // draws an outline). In the middle of the purple card there is no wall: the layer's spring brings it back
  if (uShape < 0.5) {
    float he = dot(P.xy - b/uRef, d);
    if (he < 0.0) { P.xy -= d*he*(1.0 + rb.w); float vn2 = dot(V.xy, d); if (vn2 < 0.0) V.xy -= d*vn2*1.4; }
  }
  if (any(isnan(P)) || any(isnan(V))) { born(id, gen + 1.0, 0.0); return; }
  vA = vec4(P.xy*uRef, P.z, age); vB = vec4(V.xy*uRef, V.z, gen); vC = vec4(u, hH, 0.0, 0.0);
}
void main(){
  sim();
  drawParams(vA, vB, vC, float(gl_VertexID), vD1, vD2);
}`;

const FRAG_NULL = `#version 300 es
precision highp float; out vec4 o; void main(){ o = vec4(0.0); }`;

// drawing a speck: only its quad, as tight as the dot itself. uShift moves it on along its own streak (= its velocity ×
// «streak») for the time since the last step: on a 120 Hz screen the frames between two steps still move
const VERT_DRAW = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uOpacity, uShift;
layout(location = 0) in vec4 aD1;
layout(location = 1) in vec4 aD2;
out vec2 vL; out float vLen; out float vRad; out float vSoft; out float vA; out float vGl;
void main(){
  float a = aD2.z*uOpacity;
  if (a <= 0.003) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 tail = aD1.xy + aD1.zw*uShift, ax = aD1.zw; float len = length(ax);
  vec2 dir = len > 1e-3 ? ax/len : vec2(1.0, 0.0), nrm = vec2(-dir.y, dir.x);
  vec2 cuv = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  float rad = aD2.x, soft = aD2.y, pad = rad + soft;
  float x = mix(-pad, len + pad, cuv.x), y = mix(-pad, pad, cuv.y);
  vec2 Q = tail + dir*x + nrm*y;
  vL = vec2(x, y); vLen = len; vRad = rad; vSoft = soft; vA = a; vGl = aD2.w;
  gl_Position = vec4(Q/uRes*2.0 - 1.0, 0.0, 1.0);
}`;
const FRAG_DRAW = `#version 300 es
precision highp float;
uniform vec3 uCol, uAcc;
in vec2 vL; in float vLen; in float vRad; in float vSoft; in float vA; in float vGl;
out vec4 o;
void main(){
  float x = clamp(vL.x, 0.0, vLen);
  float dd = length(vec2(vL.x - x, vL.y));
  float a = (1.0 - smoothstep(vRad - vSoft, vRad + vSoft, dd))*vA;
  o = vec4(mix(uCol, uAcc, clamp(vGl, 0.0, 1.0)), a);
}`;
// the dimmed middle of the purple card: its colour over everything drawn, at uAmt in the middle, fading out to nothing
// at the edge of the oval (centre uC, half size uHalf, px)
const FRAG_DIM = `#version 300 es
precision highp float;
uniform vec2 uC, uHalf; uniform float uSoft, uAmt; uniform vec3 uCol;
out vec4 o;
void main(){
  float r = length((gl_FragCoord.xy - uC)/max(uHalf, vec2(1.0)));
  o = vec4(uCol, uAmt*(1.0 - smoothstep(1.0 - max(uSoft, 0.002), 1.0, r)));
}`;

/* the air: a small stable-fluids grid (Stam 1999; GPU Gems ch. 38). Velocity in grid cells per second */
const FL = (body) => `#version 300 es
precision highp float;
precision highp sampler2D;
uniform vec2 uTexel;
out vec4 o;
${body}`;
const FL_ADVECT = FL(`uniform sampler2D uV; uniform float uDt, uDiss;
void main(){ vec2 uv = gl_FragCoord.xy*uTexel; vec2 v = texture(uV, uv).xy;
  o = vec4(texture(uV, uv - uDt*v*uTexel).xy/(1.0 + uDiss*uDt), 0.0, 1.0); }`);
const FL_SPLAT = FL(`uniform sampler2D uV; uniform vec4 uSp[8]; uniform float uSr[8]; uniform int uN; uniform vec2 uCellPx;
void main(){ vec2 p = gl_FragCoord.xy*uCellPx; vec2 v = texture(uV, gl_FragCoord.xy*uTexel).xy;
  for (int i = 0; i < 8; i++) { if (i >= uN) break; vec2 q = p - uSp[i].xy; v += exp(-dot(q, q)/(uSr[i]*uSr[i]))*uSp[i].zw; }
  o = vec4(v, 0.0, 1.0); }`);
const FL_CURL = FL(`uniform sampler2D uV;
void main(){ vec2 uv = gl_FragCoord.xy*uTexel;
  float c = 0.5*(texture(uV, uv + vec2(uTexel.x, 0.0)).y - texture(uV, uv - vec2(uTexel.x, 0.0)).y
               - texture(uV, uv + vec2(0.0, uTexel.y)).x + texture(uV, uv - vec2(0.0, uTexel.y)).x);
  o = vec4(c, 0.0, 0.0, 1.0); }`);
const FL_VORT = FL(`uniform sampler2D uV; uniform sampler2D uC; uniform float uCurl, uDt;
void main(){ vec2 uv = gl_FragCoord.xy*uTexel;
  float L = texture(uC, uv - vec2(uTexel.x, 0.0)).x, R = texture(uC, uv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uC, uv + vec2(0.0, uTexel.y)).x, B = texture(uC, uv - vec2(0.0, uTexel.y)).x, C = texture(uC, uv).x;
  vec2 force = 0.5*vec2(abs(T) - abs(B), abs(R) - abs(L));
  force = force/(length(force) + 1e-4)*uCurl*C; force.y = -force.y;
  o = vec4(clamp(texture(uV, uv).xy + force*uDt, -2000.0, 2000.0), 0.0, 1.0); }`);
const FL_DIV = FL(`uniform sampler2D uV;
void main(){ vec2 uv = gl_FragCoord.xy*uTexel;
  vec2 vl = uv - vec2(uTexel.x, 0.0), vr = uv + vec2(uTexel.x, 0.0), vt = uv + vec2(0.0, uTexel.y), vb = uv - vec2(0.0, uTexel.y);
  float L = texture(uV, vl).x, R = texture(uV, vr).x, T = texture(uV, vt).y, B = texture(uV, vb).y;
  vec2 C = texture(uV, uv).xy;
  if (vl.x < 0.0) L = -C.x; if (vr.x > 1.0) R = -C.x; if (vt.y > 1.0) T = -C.y; if (vb.y < 0.0) B = -C.y;
  o = vec4(0.5*(R - L + T - B), 0.0, 0.0, 1.0); }`);
const FL_JACOBI = FL(`uniform sampler2D uP; uniform sampler2D uD; uniform float uKeep;
void main(){ vec2 uv = gl_FragCoord.xy*uTexel;
  float p = (texture(uP, uv - vec2(uTexel.x, 0.0)).x + texture(uP, uv + vec2(uTexel.x, 0.0)).x
           + texture(uP, uv + vec2(0.0, uTexel.y)).x + texture(uP, uv - vec2(0.0, uTexel.y)).x)*uKeep - texture(uD, uv).x;
  o = vec4(p*0.25, 0.0, 0.0, 1.0); }`);
const FL_GRAD = FL(`uniform sampler2D uP; uniform sampler2D uV;
void main(){ vec2 uv = gl_FragCoord.xy*uTexel;
  vec2 g = 0.5*vec2(texture(uP, uv + vec2(uTexel.x, 0.0)).x - texture(uP, uv - vec2(uTexel.x, 0.0)).x,
                    texture(uP, uv + vec2(0.0, uTexel.y)).x - texture(uP, uv - vec2(0.0, uTexel.y)).x);
  o = vec4(texture(uV, uv).xy - g, 0.0, 1.0); }`);

/* ═════════ small helpers ═════════ */
const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const vnoise = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return rnd(i) * (1 - u) + rnd(i + 1) * u; };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// the simulated track: where column i of the level meter wants to be at time t (0…1)
function goal(bpm, bands, seed, i, t) {
  const beat = Math.exp(-((t * bpm / 60) % 1) * 5);
  const broad = vnoise(i * 0.12 * 128 / bands + seed + t * 0.35);
  const sharp = vnoise(i * 1.7 + seed * 2 + t * 2.4);
  return clamp(-0.18 + broad * 0.5 + sharp * 0.7 + beat * 0.3 * vnoise(i * 0.3 + t + seed), 0, 1);
}
// a small seeded random (mulberry32), so the gusts of a card follow its own sequence
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// a colour of the site by its name, "var(--purple)", read from the styles, or a #hex / rgb() value
function color(s, fallback) {
  s = (s || "").trim();
  const v = /^var\((--[\w-]+)\)$/.exec(s);
  if (v) s = getComputedStyle(document.documentElement).getPropertyValue(v[1]).trim();
  let m = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(s);
  if (m) {
    let h = m[1]; if (h.length === 3) h = h.replace(/./g, "$&$&");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) { const p = m[1].split(/[\s,/]+/).map(parseFloat); if (p.length >= 3) return p.slice(0, 3).map((x) => clamp(x / 255, 0, 1)); }
  return fallback;
}
// the middle body of the purple card, px: centre, proportions and pointedness, and the length of its outline at the
// dense layer's depth (the specks are counted along it)
function innerBox(v, W, H, unit) {
  const asp = Math.max(0.2, (v.srcW * W) / Math.max(1, v.srcH * H)), p = 2 - v.taper / 100;
  const a = asp * v.core / 100 * unit, b = v.core / 100 * unit;
  const len = Math.max(unit, Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))));
  return { cx: W / 2, cy: H / 2 + v.srcY / 100 * H / 2, asp, p, len };
}

// the unit: a stat card's height (and its width, for the counts per card width), CSS px
const metrics = { unit: 150, statW: 307 };
const firstStat = document.querySelector(".stat");
const measureStat = () => { if (firstStat && firstStat.clientHeight > 0) { metrics.unit = firstStat.clientHeight; metrics.statW = firstStat.clientWidth; } };
measureStat();

/* ═════════ one card ═════════ */
const instances = [];
const songs = { cards: 0, cta: 0 };     // the track's clock of each set: runs while one of its cards is on screen
let statIdx = 0;

class Card {
  constructor(host, name, set) {
    this.host = host; this.name = name; this.set = set; this.middle = set.shape === "middle";
    this.idx = this.middle ? 3 : statIdx++;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "dots";
    this.canvas.setAttribute("aria-hidden", "true");
    host.prepend(this.canvas);
    this.seed = 11 + this.idx * 37; this.rng = mulberry(this.seed * 977);
    this.levels = new Float32Array(MAX_COLS);
    this.visible = false; this.shown = false; this.waiting = !calm; this.arrive = 1;
    this.beatN = -1; this.impulse = 0; this.splats = []; this.spin = 0; this.simN = 0; this.drawnN = -1; this.dirty = true;
    this.ptr = { x: 0, y: 0, vx: 0, vy: 0, on: 0, target: 0, burst: 0, t: 0 };
    this.canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.failed = true; this.host.classList.add("no-dots"); });
    this.canvas.addEventListener("webglcontextrestored", () => {
      this.failed = false; this.init();
      if (this.failed) return;
      this.host.classList.remove("no-dots");
      if (this.arrived) { this.arrive = 1; this.waiting = false; }   // (no second arrival: the dust is simply there again)
      if (calm) this.still(); else wake();
    });
    this.init();
    if (this.failed) return;
    new ResizeObserver(() => {
      if (!this.resize()) return;
      wake();
      // reduce motion: the still frame again once the size has stopped changing (and only on screen)
      if (calm) { this.stillDue = true; clearTimeout(this.stillT); this.stillT = setTimeout(() => { if (this.visible) this.still(); }, 200); }
    }).observe(host);
    // on screen at all: it runs; a third of it on screen for the first time: its dust is pushed in
    new IntersectionObserver((es) => {
      const e = es[es.length - 1];
      this.visible = e.isIntersecting;
      if (this.waiting && e.intersectionRatio >= 0.33) { this.waiting = false; this.arrived = true; this.reset(); this.arrive = 0; }
      if (calm && this.visible && this.stillDue) this.still();
      wake();
    }, { root: ioRoot, threshold: [0, 0.33] }).observe(host);
    if (!calm) this.bindPointer();
  }
  init() {
    const gl = this.canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, premultipliedAlpha: false, powerPreference: "high-performance" });
    if (!gl) { this.failed = true; this.host.classList.add("no-dots"); return; }
    this.gl = gl;
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    // (?fmdust=full keeps every speck there too, for tests of the look)
    if (/SwiftShader|llvmpipe|softpipe|Software/i.test(String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER))) && !/[?&]fmdust=full/.test(location.search)) { MAX_SPECKS = 6000; engine.auto = false; engine.level = 2; }
    try {
      this.progs = { edge: this.link(VERT_FULL, FRAG_EDGE), upd: this.link(UPDATE, FRAG_NULL, ["vA", "vB", "vC", "vD1", "vD2"]), draw: this.link(VERT_DRAW, FRAG_DRAW),
        dim: this.middle ? this.link(VERT_FULL, FRAG_DIM) : null };
    } catch (err) { console.warn("stipple:", err); this.failed = true; this.host.classList.add("no-dots"); return; }
    this.vao0 = gl.createVertexArray();
    this.levelTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.levelTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, MAX_COLS, 1, 0, gl.RED, gl.FLOAT, null);
    this.edgeW = this.middle ? 1024 : 512;
    this.edgeTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.edgeTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.middle ? gl.REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.edgeW, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.edgeFb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgeFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.edgeTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fbuf = null; this.flowKey = null; this.fluid = null; this.restart = false;
    this.fluidOk = !!(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));
    const v = this.set.settings;
    for (let i = 0; i < MAX_COLS; i++) this.levels[i] = goal(v.bpm, v.bands, this.seed, i, 0);
    this.colors();
    this.resize();
  }
  link(vs, fs, varyings) {
    const gl = this.gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    if (varyings) gl.transformFeedbackVaryings(p, varyings, gl.INTERLEAVED_ATTRIBS);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const cache = {};
    return { p, loc: (n) => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(p, n))) };
  }
  // the card's colour (the stat cards' --dots, the purple card's own) and the dust's
  colors() {
    const v = this.set.settings;
    this.bg = color(v.background || getComputedStyle(this.host).getPropertyValue("--dots"), [0.53, 0.3, 1]);
    this.dust = color(v.dust, [1, 1, 1]);
    this.dimCol = color(v.dimColor, this.bg);
    this.dirty = true;
  }
  // the ruler, CSS px: a stat card's height (unit) and width; on the purple card its own, a share of its height
  // (a stat card's proportions kept for the width, 2.05 : 1 as in the lab)
  ruler() {
    const v = this.set.settings;
    if (!v.unit) return metrics;
    const unit = Math.max(1, this.host.clientHeight * v.unit / 100);
    return { unit, statW: unit * 2.05 };
  }
  // (true when the canvas changed size)
  resize() {
    if (this.failed) return false;
    const full = Math.min(window.devicePixelRatio || 1, this.set.settings.maxDpr || 2);
    this.dpr = engine.level >= 4 ? Math.max(Math.min(full, 1), full * engine.scale4) : full;
    const w = Math.max(1, Math.round(this.host.clientWidth * this.dpr)), h = Math.max(1, Math.round(this.host.clientHeight * this.dpr));
    const changed = this.canvas.width !== w || this.canvas.height !== h;
    if (changed) { this.canvas.width = w; this.canvas.height = h; }
    this.radius = (parseFloat(getComputedStyle(this.host).borderTopLeftRadius) || 0) * this.dpr;
    this.quietAt = 0; this.dirty = true;
    // a new size clears the canvas (black, until the next frame): drawn again at once, the dust as it was
    if (changed && this.progs) this.refresh();
    return changed;
  }
  // the boxes of the text lines and the button (canvas px, y up), for the dust to keep clear of them (invClear)
  measureText() {
    const r0 = this.host.getBoundingClientRect(), out = [], k = this.dpr, H = this.canvas.height;
    const add = (r) => { if (r.width > 1 && r.height > 1 && out.length < 16) out.push([(r.left - r0.left) * k, H - (r.bottom - r0.top) * k, (r.right - r0.left) * k, H - (r.top - r0.top) * k]); };
    this.host.querySelectorAll(".btn").forEach((e) => add(e.getBoundingClientRect()));
    // the texts line by line: a split heading gives a box per letter, so the boxes are joined into one per line
    this.host.querySelectorAll(".cta__title, .cta__lead").forEach((e) => {
      const rg = document.createRange(); rg.selectNodeContents(e);
      const lines = [];
      for (const r of rg.getClientRects()) {
        if (r.width <= 1 || r.height <= 1) continue;
        const l = lines.find((q) => Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top) > 0.5 * Math.min(q.bottom - q.top, r.height));
        if (l) { l.left = Math.min(l.left, r.left); l.right = Math.max(l.right, r.right); l.top = Math.min(l.top, r.top); l.bottom = Math.max(l.bottom, r.bottom); }
        else lines.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
      }
      lines.forEach((l) => add({ left: l.left, right: l.right, top: l.top, bottom: l.bottom, width: l.right - l.left, height: l.bottom - l.top }));
    });
    this.quiet = out; this.quietAt = performance.now();
  }
  geom(v) {
    const W = this.canvas.width, H = this.canvas.height, r = this.ruler(), unit = r.unit * this.dpr, statW = r.statW * this.dpr;
    const inner = this.middle ? innerBox(v, W, H, unit) : null;
    const len = inner ? inner.len : W;
    const bands = Math.max(1, Math.round(v.bands));
    const cols = this.middle ? Math.max(1, Math.min(MAX_COLS, Math.round(len / (statW / bands)))) : Math.min(MAX_COLS, bands);
    return { W, H, len, cols, colPx: len / cols, unit, statW, inner };
  }
  // the two buffers of speck states, sized for the amount
  ensureFlow(v, g) {
    const gl = this.gl;
    const want = v.amount * v.invAmount / 100 * (g.len / this.dpr) * (g.unit / this.dpr) / 10000;
    const n = Math.max(1, Math.min(MAX_SPECKS, Math.round(want)));
    this.boost = Math.max(1, want / n);                 // past the most specks a card may have, each is that much stronger
    const key = n + "/" + g.W + "x" + g.H + "/" + Math.round(g.unit / this.dpr);
    if (key === this.flowKey) return;
    // the same card at another resolution (render scale, browser zoom): keep the specks, scale their positions once
    if (this.fbuf && Math.abs(this.N - n) <= Math.max(2, this.N * 0.005) && this.flowW && Math.abs(g.W / g.H - this.flowW / this.flowH) < 0.01 && !this.restart) {
      this.rescale = (this.rescale || 1) * g.W / this.flowW; this.flowW = g.W; this.flowH = g.H; this.flowKey = key; return;
    }
    this.restart = false; this.keptN = null;
    this.flowKey = key; this.N = n; this.cur = 0; this.flowW = g.W; this.flowH = g.H; this.rescale = 1;
    if (!this.fbuf) {
      this.fbuf = [gl.createBuffer(), gl.createBuffer()];
      this.uvao = [gl.createVertexArray(), gl.createVertexArray()];
      this.dvao = [gl.createVertexArray(), gl.createVertexArray()];
      this.tf = gl.createTransformFeedback();
      for (let i = 0; i < 2; i++) for (const [vao, div] of [[this.uvao[i], 0], [this.dvao[i], 1]]) {
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.fbuf[i]);
        // the update reads the state (A, B, C); the drawing reads only how each speck is drawn (D1, D2)
        if (!div) for (let a = 0; a < 3; a++) { gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 4, gl.FLOAT, false, 80, a * 16); gl.vertexAttribDivisor(a, 0); }
        else for (let a = 0; a < 2; a++) { gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 4, gl.FLOAT, false, 80, 48 + a * 16); gl.vertexAttribDivisor(a, 1); }
      }
      gl.bindVertexArray(null);
    }
    const data = new Float32Array(n * 20).fill(-1);       // generation -1: not born yet
    for (let i = 0; i < 2; i++) { gl.bindBuffer(gl.ARRAY_BUFFER, this.fbuf[i]); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_COPY); }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  // all the dust is born again (where it waits to be pushed in, while arriving), the air is still
  // the share of the specks that move and are drawn (level 3 and up)
  keep() { return engine.level >= 3 ? clamp(engine.budget3 / (this.N || 1), 0.4, engine.keep3) : 1; }
  reset() { this.arrSeed = Math.random() * 50; this.arrGust = 1; this.restart = true; this.flowKey = null; this.fluid && this.fluid.clear(); this.rng = mulberry(this.seed * 977); this.splats = []; this.dirty = true; }

  /* ── the air ── */
  makeFluid(g) {
    const gl = this.gl;
    const cell = Math.max(g.statW / 160,Math.max(g.W, g.H) / 512) * (engine.level >= 2 ? 1.6 : 1);
    const gw = Math.max(8, Math.round(g.W / cell)), gh = Math.max(8, Math.round(g.H / cell));
    const key = gw + "x" + gh;
    // (the same grid for another canvas size, e.g. level 4: its cells change size)
    if (this.fluid && this.fluid.key === key) { this.fluid.cellX = g.W / gw; this.fluid.cellY = g.H / gh; return this.fluid; }
    if (this.fluid) this.fluid.free();
    if (!this.fluidOk) return (this.fluid = null);
    const tex = (ifmt, fmt) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, gw, gh, 0, fmt, gl.HALF_FLOAT, null);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { t, fb, ok };
    };
    const F = { key, gw, gh, cellX: g.W / gw, cellY: g.H / gh,
      vel: [tex(gl.RG16F, gl.RG), tex(gl.RG16F, gl.RG)], prs: [tex(gl.R16F, gl.RED), tex(gl.R16F, gl.RED)],
      div: tex(gl.R16F, gl.RED), curl: tex(gl.R16F, gl.RED), v: 0, p: 0 };
    const all = [...F.vel, ...F.prs, F.div, F.curl];
    if (all.some((x) => !x.ok)) { all.forEach((x) => { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.fb); }); this.fluidOk = false; return (this.fluid = null); }
    if (!this.progs.fl) {
      try {
        this.progs.fl = { adv: this.link(VERT_FULL, FL_ADVECT), splat: this.link(VERT_FULL, FL_SPLAT), curl: this.link(VERT_FULL, FL_CURL),
          vort: this.link(VERT_FULL, FL_VORT), div: this.link(VERT_FULL, FL_DIV), jac: this.link(VERT_FULL, FL_JACOBI), grad: this.link(VERT_FULL, FL_GRAD) };
      } catch (err) { console.warn("stipple: no air", err); all.forEach((x) => { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.fb); }); this.fluidOk = false; return (this.fluid = null); }
    }
    F.free = () => all.forEach((x) => { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.fb); });
    F.clear = () => { gl.clearColor(0, 0, 0, 1); all.forEach((x) => { gl.bindFramebuffer(gl.FRAMEBUFFER, x.fb); gl.clear(gl.COLOR_BUFFER_BIT); }); gl.bindFramebuffer(gl.FRAMEBUFFER, null); };
    F.clear();
    return (this.fluid = F);
  }
  stepFluid(F, v, dt) {
    const gl = this.gl, P = this.progs.fl;
    gl.viewport(0, 0, F.gw, F.gh);
    gl.bindVertexArray(this.vao0);
    const run = (prog, out, uniforms, texs) => {
      gl.useProgram(prog.p);
      gl.uniform2f(prog.loc("uTexel"), 1 / F.gw, 1 / F.gh);
      let unit = 0;
      for (const [name, t] of Object.entries(texs)) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(prog.loc(name), unit++); }
      for (const [name, val] of Object.entries(uniforms)) { const l = prog.loc(name); if (l !== null) gl.uniform1f(l, val); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const V = () => F.vel[F.v], V2 = () => F.vel[1 - F.v], swapV = () => { F.v = 1 - F.v; };
    while (this.splats.length) {
      gl.useProgram(P.splat.p);
      const n = Math.min(8, this.splats.length), sp = new Float32Array(32), sr = new Float32Array(8);
      for (let i = 0; i < n; i++) { const s = this.splats[i]; sp.set([s.x, s.y, s.vx / F.cellX, s.vy / F.cellY], i * 4); sr[i] = s.r; }
      gl.uniform4fv(P.splat.loc("uSp[0]"), sp); gl.uniform1fv(P.splat.loc("uSr[0]"), sr); gl.uniform1i(P.splat.loc("uN"), n);
      gl.uniform2f(P.splat.loc("uCellPx"), F.cellX, F.cellY);
      run(P.splat, V2(), {}, { uV: V().t }); swapV();
      this.splats = this.splats.slice(n);
    }
    run(P.curl, F.curl, {}, { uV: V().t });
    run(P.vort, V2(), { uCurl: v.curl, uDt: dt }, { uV: V().t, uC: F.curl.t }); swapV();
    run(P.div, F.div, {}, { uV: V().t });
    const iters = engine.level >= 2 ? 12 : 20;
    for (let i = 0; i < iters; i++) { run(P.jac, F.prs[1 - F.p], { uKeep: i === 0 ? 0.8 : 1 }, { uP: F.prs[F.p].t, uD: F.div.t }); F.p = 1 - F.p; }
    run(P.grad, V2(), {}, { uP: F.prs[F.p].t, uV: V().t }); swapV();
    run(P.adv, V2(), { uDt: dt, uDiss: v.calm / 100 }, { uV: V().t }); swapV();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  // the gusts: on a beat a few jets from the dense side where the music is loudest, small ones in between, one wide
  // stir with the arrival, and the pointer's own (it moves the air; a press blows it out in six jets)
  gusts(v, g, dt, beat) {
    const at = (u01, power, tilt) => {
      let x, y, nx, ny;
      if (g.inner) { const a = u01 * Math.PI * 2; nx = Math.cos(a); ny = Math.sin(a); x = g.inner.cx; y = g.inner.cy; }   // out of the middle
      else { x = u01 * g.W; y = 0; nx = 0; ny = 1; }
      const c = Math.cos(tilt), s = Math.sin(tilt), dx = nx * c - ny * s, dy = nx * s + ny * c;
      const sp = power * g.unit;
      this.splats.push({ x: x + nx * g.unit * 0.05, y: y + ny * g.unit * 0.05, vx: dx * sp, vy: dy * sp, r: v.puffW / 100 * g.unit });
    };
    // counts are per stat-card width of edge: the purple card's body is longer and gets as many per length
    const per = g.len / g.statW;
    const count = (x) => { const n = Math.floor(x); return n + (this.rng() < x - n ? 1 : 0); };
    if (this.arrGust && this.arrive < 1 && this.arrive * 2.2 > v.arrSpread / 2000) {
      this.arrGust = 0;
      const n = Math.max(3, Math.round(4 * per));
      for (let i = 0; i < n; i++) at((i + 0.3 + this.rng() * 0.4) / n, v.puff / 100 * 0.9 * (0.6 + 0.8 * this.rng()), (this.rng() - 0.5) * 0.6);
    }
    if (beat) {
      const n = count(v.puffs * per);
      for (let i = 0; i < n; i++) {
        let best = 0, bl = -1;
        for (let k = 0; k < 4; k++) { const u = this.rng(), l = this.levels[Math.min(g.cols - 1, Math.floor(u * g.cols))]; if (l > bl) { bl = l; best = u; } }
        at(best, v.puff / 100 * beat * (0.45 + bl), (this.rng() - 0.5) * 0.7);
      }
    }
    for (let i = count(v.thermals / 100 * dt * 4 * per); i > 0; i--) at(this.rng(), v.puff / 100 * 0.25, (this.rng() - 0.5) * 1.2);
    const p = this.ptr;
    if (p.on > 0.05 && v.touch && Math.hypot(p.vx, p.vy) > 1) this.splats.push({ x: p.x, y: p.y, vx: p.vx * v.sweep / 100 * 0.8, vy: p.vy * v.sweep / 100 * 0.8, r: v.touchR / 100 * g.unit * 0.6 });
    if (p.burst > 0 && v.touch) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const sp = v.tap / 100 * g.unit * 1.5; this.splats.push({ x: p.x + Math.cos(a) * g.unit * 0.08, y: p.y + Math.sin(a) * g.unit * 0.08, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: v.touchR / 100 * g.unit * 0.4 }); }
    if (this.splats.length > 96) this.splats.splice(0, this.splats.length - 96);
  }
  bindPointer() {
    const el = this.host, p = this.ptr;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) * this.dpr, y = (r.bottom - e.clientY) * this.dpr, now = performance.now();
      if (p.t && now > p.t) {
        const k = 1 - Math.exp(-(now - p.t) / 40);
        p.vx += (((x - p.x) / ((now - p.t) / 1000)) - p.vx) * k;
        p.vy += (((y - p.y) / ((now - p.t) / 1000)) - p.vy) * k;
      }
      p.x = x; p.y = y; p.t = now; p.target = 1;
    };
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerenter", (e) => { p.t = 0; move(e); p.vx = p.vy = 0; }, { passive: true });
    el.addEventListener("pointerleave", () => { p.target = 0; p.t = 0; }, { passive: true });
    el.addEventListener("pointerdown", (e) => { move(e); p.burst = 1; }, { passive: true });
  }

  // one step of the card: the music, the air, the dust
  step(dt, song) {
    if (this.failed) return;
    const v = this.set.settings, g = this.geom(v);
    this.g = g;
    // the music: this card's own moment of the track (the stat cards a fraction of a beat apart)
    const period = 60 / v.bpm;
    const tc = song - (this.middle ? 0 : this.idx * (v.cascade || 0) / 100 * period) + 4 * period;
    this.music = tc;
    const bn = Math.floor(tc / period);
    this.impulse = 0;
    if (this.beatN >= 0 && bn !== this.beatN) {
      const bar = Math.max(1, Math.round(v.bar)), down = ((bn % bar) + bar) % bar === 0;
      this.impulse = (down ? v.accent / 100 : 1) * (1 - v.groove / 100 * 0.5 + v.groove / 100 * rnd(bn * 1.31 + this.seed));
    }
    this.beatN = bn;
    this.beatT = tc - bn * period;
    const up = 1 - Math.pow(1 - v.attack / 100, dt * 60), down = 1 - Math.pow(1 - v.release / 100, dt * 60);
    for (let i = 0; i < g.cols; i++) {
      const t = goal(v.bpm, v.bands, this.seed, i, tc);
      this.levels[i] += (t - this.levels[i]) * (t > this.levels[i] ? up : down);
    }
    this.spin = (this.spin + dt * (this.middle ? v.spin || 0 : 0) / 360 + 1) % 1;
    // the pointer fades in and out softly; its speed calms when it stops
    const p = this.ptr;
    p.on += ((v.touch ? p.target : 0) - p.on) * (1 - Math.exp(-dt * 10));
    if (performance.now() - p.t > 60) { p.vx *= Math.exp(-dt * 12); p.vy *= Math.exp(-dt * 12); }
    if (this.arrive < 1) this.arrive = Math.min(1, this.arrive + dt / 2.2);
    this.simulate(v, g, dt);
    p.burst = 0;
  }
  apply(prog, U) {
    const gl = this.gl;
    gl.useProgram(prog.p);
    for (const k in U) {
      const l = prog.loc(k); if (l === null) continue;
      const x = U[k];
      if (typeof x === "number") gl.uniform1f(l, x);
      else if (x.length === 2) gl.uniform2fv(l, x);
      else if (x.length === 3) gl.uniform3fv(l, x);
      else if (x.length === 4) gl.uniform4fv(l, x);
    }
    const lt = prog.loc("uLevelTex"); if (lt !== null) gl.uniform1i(lt, 0);
    const et = prog.loc("uEdgeTex"); if (et !== null) gl.uniform1i(et, 2);
  }
  simulate(v, g, dt) {
    const gl = this.gl;
    this.ensureFlow(v, g);
    let F = this.fluid;
    if (dt > 0) {
      F = this.makeFluid(g);
      if (!this.calmRun) this.gusts(v, g, dt, this.impulse);
      if (F) this.stepFluid(F, v, dt);
    }
    // (after the air: its passes leave their own textures on the units)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.levelTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, g.cols, 1, gl.RED, gl.FLOAT, this.levels);
    const U = {
      uRes: [g.W, g.H], uTime: (this.music || 0) % 3600, uShape: this.middle ? 1 : 0, uRadius: this.radius,
      uInner: g.inner ? [g.inner.cx, g.inner.cy, g.inner.asp, g.inner.p] : [0, 0, 1, 2], uRef: g.unit, uEdgeLen: g.len, uSeed: this.seed, uPx: this.dpr,
      uColPx: g.colPx, uCols: g.cols, uSpin: this.spin,
      uReach: v.reach / 100, uFalloff: v.falloff / 100, uClumps: v.clumps / 100, uClumpScale: v.clumpScale / 100, uChurn: v.churn / 100,
      uWave: v.wave / 100, uWaveScale: v.waveScale / 100, uWaveSpeed: v.waveSpeed / 100, uWaveTravel: v.waveTravel / 100, uWaveIrreg: v.waveIrreg / 100, uLift: v.lift / 100,
      uCore: v.core / 100, uCoreShare: v.coreShare / 100,
      uRagged: v.ragged / 100, uRagScale: v.ragScale / 100, uRagKick: v.ragKick / 100, uBeatT: this.beatT || 0, uBeatN: this.beatN, uLens: v.lens / 100
    };
    // the wave and the spikes along the edge, for this moment
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgeFb);
    gl.viewport(0, 0, this.edgeW, 1);
    gl.bindVertexArray(this.vao0);
    this.apply(this.progs.edge, Object.assign({}, U, { uEdgeW: this.edgeW }));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.edgeTex);
    if (this.middle && v.invClear > 0 && (!this.quietAt || performance.now() - this.quietAt > 500)) this.measureText();
    Object.assign(U, {
      uDt: dt, uArrive: this.arrive, uLife: v.life,
      uArrT: this.arrive * 2.2, uArrH: v.arrH / 100, uArrG: 10 * v.arrSpeed / 100, uArrSpread: v.arrSpread / 1000, uArrLump: v.arrLump / 100, uArrLumpSize: v.arrLumpSize / 100, uArrSeed: this.arrSeed || 0,
      uSway: v.sway / 100, uSwayScale: v.swayScale / 100, uOmega: 2 * Math.PI * v.settle / 100,
      uFollow: v.follow / 100, uHasFluid: F ? 1 : 0, uGrav: v.gravity / 100, uFallDrag: v.fallDrag / 100, uFallVar: v.fallVar / 100, uCushion: v.cushion / 100, uWhip: v.whip / 100, uCell: F ? [F.cellX, F.cellY] : [1, 1],
      uRescale: this.rescale || 1,
      uSizeMin: v.sizeMin, uSizeMax: Math.max(v.sizeMax, v.sizeMin), uSkew: v.skew / 100, uSizeEdge: v.sizeEdge / 100, uStars: v.stars / 100, uStarSize: v.starSize / 100,
      uStreak: v.streak / 1000, uTwinkle: v.twinkle / 100, uGlint: v.glint / 100, uThin: v.thin / 100, uDof: v.dof / 100, uFlash: v.flash / 100, uClear: v.invClear / 100,
      uQuietN: this.middle && this.quiet ? this.quiet.length : 0, uQuietPad: (v.quietPad || 0) / 100 * g.unit
    });
    this.rescale = 1;
    const prog = this.progs.upd;
    this.apply(prog, U);
    if (this.middle && this.quiet && this.quiet.length) { const l = prog.loc("uQuiet[0]"); if (l !== null) gl.uniform4fv(l, new Float32Array(this.quiet.flat())); }
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, F ? F.vel[F.v].t : this.levelTex); gl.uniform1i(prog.loc("uVel"), 1);
    // the specks that waited (level 3 and up) are out of date when they are used again: born again, at rest
    const m = Math.max(1, Math.round(this.N * this.keep()));
    if (this.keptN != null && m > this.keptN) {
      const fresh = new Float32Array((m - this.keptN) * 20).fill(-1);
      for (let i = 0; i < 2; i++) { gl.bindBuffer(gl.ARRAY_BUFFER, this.fbuf[i]); gl.bufferSubData(gl.ARRAY_BUFFER, this.keptN * 80, fresh); }
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    this.keptN = m;
    gl.bindVertexArray(this.uvao[this.cur]);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tf);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.fbuf[1 - this.cur]);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    // (from level 3 only the specks that are drawn move; the others wait where they are)
    gl.drawArrays(gl.POINTS, 0, m);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindVertexArray(null);
    this.cur = 1 - this.cur;
    this.impulse = 0;
    this.simN++;
  }
  // the dust worked out again for the canvas as it is now, without moving it on, and drawn
  refresh() {
    if (this.failed) return;
    if (this.fbuf && this.g && !this.waiting) { const n = this.simN, v = this.set.settings; this.simulate(v, this.g = this.geom(v), 0); this.simN = n; }
    this.draw();
  }
  // the card filled with its colour, and the dust (none yet while it waits to arrive)
  draw(shift = 0) {
    if (this.failed) return;
    const gl = this.gl, bg = this.bg;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
    this.dirty = false; this.drawnN = this.simN;
    if (!this.fbuf || !this.g || this.waiting) return;
    const v = this.set.settings, keep = this.keep();
    this.apply(this.progs.draw, { uShift: shift, uRes: [this.canvas.width, this.canvas.height], uOpacity: v.invOpacity / 100 * v.opacity / 100 * (this.boost || 1) / keep,
      uCol: this.dust, uAcc: this.dust });
    gl.bindVertexArray(this.dvao[this.cur]);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, Math.max(1, Math.round(this.N * keep)));
    // the dimmed middle (purple card): the card's colour laid over the dust behind the text
    if (this.progs.dim && v.dim && v.dimAmount > 0) {
      const W = this.canvas.width, H = this.canvas.height;
      gl.bindVertexArray(this.vao0);
      this.apply(this.progs.dim, { uC: [W / 2, H / 2 * (1 + (v.dimY || 0) / 100)], uHalf: [v.dimW / 100 * W / 2, v.dimH / 100 * H / 2],
        uSoft: v.dimSoft / 100, uAmt: v.dimAmount / 100, uCol: this.dimCol });
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }
  // reduce motion: the dust at rest, drawn once (again after a resize)
  still() {
    if (this.failed) return;
    clearTimeout(this.stillT); this.stillDue = false;
    this.arrive = 1; this.waiting = false;
    this.reset(); this.beatN = -1; this.calmRun = true;
    // one second of it without gusts, ending three quarters of a beat after a beat (the spikes calm again), so it is at rest
    const v = this.set.settings, period = 60 / v.bpm, off = this.middle ? 0 : this.idx * (v.cascade || 0) / 100 * period;
    const end = off + (Math.ceil((1.5 - off) / period) + 0.75) * period;          // (step() adds 4 beats: same phase)
    for (let i = 59; i >= 0; i--) this.step(STEP, end - i * STEP);
    this.calmRun = false;
    this.draw();
  }
}

/* ═════════ one loop for all cards ═════════ */
let raf = 0, last = 0, acc = 0;
const times = [];
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const running = (c) => c.visible && !c.failed && !c.waiting;

function setLevel(l) {
  l = clamp(Math.round(l), 0, 5);
  if (l === engine.level) return;
  const old = engine.level; engine.level = l;
  if ((old >= 4) !== (l >= 4)) instances.forEach((c) => c.resize());
  times.length = 0;
}
// the tuner: steps down only after frames were really dropped for a while (and undoes a step that did not help), up
// after a quiet stretch with room; frames while the page scrolls or is touched, and the first second after a change,
// do not count
const tune = { start: 0, since: 0, good: 0, hold: 3000, probe: 0, busy: 0, settle: 0, down: null, noDown: 0, bad: 0 };
const busy = () => { tune.busy = performance.now(); tune.since = 0; };
onScroll(busy);
["touchstart", "touchmove", "wheel"].forEach((e) => addEventListener(e, busy, { passive: true, capture: true }));
function tuneTo(l, now) { setLevel(l); tune.settle = now + 1000; tune.since = 0; tune.bad = 0; }
function autoTune(now) {
  if (!engine.auto || document.hidden) { tune.since = 0; return; }
  if (!tune.start) tune.start = now;
  if (now - tune.start < 5000) return;                           // the first 5 s (compiling, the dust arriving) do not count
  if (now - tune.busy < 1000 || now < tune.settle) { tune.since = 0; return; }
  if (!tune.since) { tune.since = now; times.length = 0; return; }
  if (now - tune.since < 750 || times.length < 30) return;
  tune.since = now;
  const f = median(times.slice(-45)) * 1000, target = engine.level >= 5 ? 1000 / 30 : 1000 / 60;
  const over = f > target * 1.2, roomy = f < target * 1.08;
  tune.bad = over ? tune.bad + 1 : 0;
  if (tune.down && tune.bad >= 2 && f > tune.down.f * 0.9) {        // the last step down did not help: back up, and wait
    const back = tune.down.level; tune.down = null; tune.noDown = now + 20000; tune.good = 0;
    tuneTo(back, now); return;
  }
  if (tune.down && !over) tune.down = null;
  if (over && tune.bad >= 2 && engine.level < 5 && now > tune.noDown) {
    if (tune.probe && now - tune.probe < 2500) tune.hold = Math.min(tune.hold * 2, 30000);
    tune.probe = 0; tune.good = 0; tune.down = { level: engine.level, f };
    tuneTo(engine.level + 1, now);
  } else if (roomy && engine.level > 1) {
    if (!tune.good) tune.good = now;
    if (now - tune.good > tune.hold) { tune.good = 0; tune.probe = now; tuneTo(engine.level - 1, now); }
  } else tune.good = 0;
}

function stepAll(d) {
  const live = instances.filter(running);
  ["cards", "cta"].forEach((n) => { if (live.some((c) => c.name === n)) songs[n] += d; });
  live.forEach((c) => c.step(d, songs[c.name]));
  engine.stepAt = performance.now();
}
// the simulation moves in steps of about 1/60 s: from level 1 at most one per frame (a step is taken once 65% of 1/60 s
// has gathered, with the real time as its length), at level 0 as many as the time asks for (up to 4)
function advance(dt) {
  if (engine.level >= 1) {
    acc = Math.min(acc + dt, 1 / 30);
    if (acc >= STEP * 0.65) { const d = acc; acc = 0; stepAll(d); }
    return;
  }
  acc = Math.min(acc + dt, STEP * 4);
  while (acc >= STEP - 1e-6) { acc -= STEP; stepAll(STEP); }
}
function frame(now) {
  raf = 0;
  pace.frame(now);
  const real = last ? Math.min((now - last) / 1000, 0.1) : STEP;
  last = now;
  if (engine.level >= 5 && engine.lastWork && now - engine.lastWork < 1000 / 30 - 4) { raf = requestAnimationFrame(frame); return; }
  const work = engine.lastWork ? Math.min((now - engine.lastWork) / 1000, 0.1) : real;
  engine.lastWork = now;
  times.push(work); if (times.length > 120) times.shift();
  advance(work);
  instances.forEach((c) => {
    if (!c.visible || c.failed) return;
    if (c.simN !== c.drawnN || c.dirty) c.draw();
    else if (engine.level <= 1 && running(c) && engine.stepAt) {
      // a frame between two steps (120 Hz screens): the dust drawn moved on along its velocity
      const since = Math.min((performance.now() - engine.stepAt) / 1000, 1 / 30);
      if (c.set.settings.streak > 0 && since > 0.002) c.draw(since / (c.set.settings.streak / 1000));
    }
  });
  autoTune(now);
  wake();
}
function wake() {
  if (raf || calm || document.hidden) return;
  // only while a card on screen has something to show: its dust moving, or its colour after a change
  if (!instances.some((c) => c.visible && !c.failed && (running(c) || c.dirty))) { last = 0; engine.lastWork = 0; return; }
  raf = requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", () => { last = 0; engine.lastWork = 0; wake(); });

// Set up the cards of one set (main.js loads this file and calls this when one of them comes within a screen of the
// visible part of the page)
export function initDots(name) {
  measureStat();
  if (firstStat && !initDots.watching) { initDots.watching = true; new ResizeObserver(measureStat).observe(firstStat); }
  document.querySelectorAll(SETS[name].hosts).forEach((host) => {
    if (host.fmStipple) return;
    try {
      const c = new Card(host, name, SETS[name]);
      host.fmStipple = c;
      if (c.failed) return;
      instances.push(c);
      if (calm) c.still(); else c.draw();             // the card's colour at once; its dust when it comes into view
    } catch (err) { console.warn("stipple:", err); host.classList.add("no-dots"); }
  });
  wake();
}
// For quick experiments in the console: change fmStipple.settings (the stat cards) or fmStipple.cta (the purple card),
// then fmStipple.update(); fmStipple.replay() pushes the dust in again; fmStipple.level(n | "auto") sets the ladder
window.fmStipple = {
  settings: STIPPLE,
  cta: STIPPLE_CTA,
  sets: SETS,
  engine,
  instances,
  update() { instances.forEach((c) => { c.colors(); c.flowKey = null; c.resize(); if (calm) c.still(); }); wake(); },
  replay() { if (calm) return; instances.forEach((c) => { c.waiting = false; c.reset(); c.arrive = 0; }); wake(); },
  // (for tests) moves the cards on screen on by sec seconds at once, and draws them
  advance(sec) { for (let i = Math.round(sec / STEP); i > 0; i--) stepAll(STEP); instances.forEach((c) => { if (c.visible && !c.failed) c.draw(); }); },
  level(l) { engine.auto = l === "auto"; if (!engine.auto) setLevel(+l); return engine.level; }
};
