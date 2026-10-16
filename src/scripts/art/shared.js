/* What every drawing uses: the stage and its units, pictures, and a few procedural helpers. */
import { calm } from "../motion.js";

// visitors who turned on "reduce motion" get the drawings still
export const STILL = calm;

// The pictures of the drawings (src/assets/img/art-*): a drawing names a file as it was uploaded ("art-face-mark.png"),
// and gets the address of its optimized copy (.webp, or the .svg itself). Small files come inlined.
const FILES = import.meta.glob("../../assets/img/art-*.{webp,svg}", { eager: true, query: "?url", import: "default" });
const file = (name) => FILES["../../assets/img/" + name.replace(/\.png$/, ".webp")];

export const SIZE = 1000;                       // an illustration is drawn on a 1000×1000 stage, in the px of the Figma frame
                                         // (a drawing made in a frame of another size says so itself: see "size" in royalty-1)
export const LIMIT = 2000;                      // …and is never laid out or painted with more than this many px a side
export const at = (x, y) => "left:" + x + "px;top:" + y + "px";
// a picture from the uploaded files. Extra classes: fm-in = flows inside its parent, fm-face = square photo cropped to a circle
export const pic = (name, style, classes) => '<img' + (classes ? ' class="' + classes + '"' : "") + ' src="' + file(name) + '" alt="" decoding="async" style="' + style + '">';

// On the page the stage is not as wide as in Figma. It is laid out at about the size it has on screen, and one Figma px
// is var(--fm-px) long there (the script sets --fm-px for every drawing, see fit() below).
// Why: a big stage that is only scaled down looks the same, but iPhones and iPads keep every moving part of it
// in memory at the full size (times the screen's pixel density). That took hundreds of MB and crashed the page.
// So all the numbers below stay as they are in Figma, and:
//   · every "…px" in a drawing's HTML is turned into calc(… * var(--fm-px)) when the drawing is put on the page (toUnits);
//   · wherever the script sets a length later on, it uses unit();
//   · the styles of the drawings are written with calc(… * var(--fm-px)) as well.
export const unit = (v) => "calc(" + v + "*var(--fm-px))";
export const toUnits = (html) => html.replace(/(-?\d*\.?\d+)px/g, "calc($1*var(--fm-px))");
// A canvas that covers the whole stage: it gets as many pixels as the stage has on screen, and is drawn on in Figma px
export function stageCanvas(canvas, pixels) {
  canvas.width = canvas.height = pixels;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(pixels / SIZE, 0, 0, pixels / SIZE, 0, 0);
  return ctx;
}
let uid = 0;
export const nextId = () => "fm" + (++uid);  // keeps SVG gradient ids unique on the page

// ── small shapes ──
export const ARROW = '<svg class="fm-in" width="32.5" height="32.5" viewBox="0 0 52 52"><path fill="#000" fill-opacity=".6" d="M27.4 12.23c.42-.42 1.11-.42 1.53 0l13 13c.43.43.43 1.11 0 1.54l-13 13c-.42.42-1.11.42-1.53 0-.42-.43-.42-1.11 0-1.54l11.15-11.15H10.83c-.6 0-1.08-.48-1.08-1.08s.49-1.08 1.08-1.08h27.72L27.4 13.77c-.42-.43-.42-1.11 0-1.54Z"/></svg>';

// ── procedural bits ──

// Deterministic random numbers, so the wobble looks the same on every visit
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TAU = Math.PI * 2;
export const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Smooth random values that drift instead of jumping: noise1 along a line, noise3 in space. Both return 0…1.
const hash1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const noise1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash1(i) * (1 - u) + hash1(i + 1) * u; };
export const hash3 = (x, y, z) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export function noise3(x, y, z) {
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
export function flatten(d, dx, dy) {
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

// the error function (for soft edges: the area under a bell curve)
export const erf = (x) => {
  const s = x < 0 ? -1 : 1, a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
};
export const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
