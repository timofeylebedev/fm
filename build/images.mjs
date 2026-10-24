// Turns the original images in assets-src/img into the files the site uses, in src/assets/img.
//   npm run images            convert what is new or changed (the output is newer than its source: skipped)
//   npm run images -- --force convert everything again
// After replacing an original, run it and commit the new files. The list below says what is made from each original.
// Widths are in image pixels; each one is made in every format listed. Files are named <name>-<width>.<format>,
// or <name>.<format> when there is only one width.

import { readdir, readFile, writeFile, stat, mkdir } from "node:fs/promises";
import { join, parse } from "node:path";
import sharp from "sharp";
import { optimize } from "svgo";

const SRC = new URL("../assets-src/img/", import.meta.url).pathname;
const OUT = new URL("../src/assets/img/", import.meta.url).pathname;
const PUBLIC = new URL("../public/", import.meta.url).pathname;
const FORCE = process.argv.includes("--force");

// quality per format: AVIF and WebP at about the same look as the originals
const QUALITY = { avif: { quality: 55, effort: 9 }, webp: { quality: 80, effort: 6 }, png: { compressionLevel: 9, palette: true } };

const RASTER = [
  // the hero: a wide picture whose width follows the screen's height (see hero.css); 1800 is for phones
  { src: "hero-table.webp", widths: [900, 1400, 1800, 2600, 3531], formats: ["avif", "webp"] },
  // the two tool cards: shown at most 462 CSS px wide
  { src: "fm-litmus.png", widths: [480, 820], formats: ["avif", "webp"] },
  { src: "fm-lens.png", widths: [480, 820], formats: ["avif", "webp"] },
  // photos on the ID cards (80 CSS px) and the author of the publications (24 CSS px): 2× and 3×
  ...["petr", "nazar", "maria"].map((n) => ({ src: n + ".png", name: "face-" + n, widths: [160, 240], formats: ["webp"] })),
  { src: "maxim-poplavsky.png", name: "author", widths: [48, 72], formats: ["webp"] },
  // the logo of the Institute of Music Initiatives on the publications (154×24 and 76×24 CSS px)
  { src: "institute-logo.png", widths: [411], formats: ["webp"], lossless: true },
  { src: "institute-mark.png", widths: [152], formats: ["webp"], lossless: true },
  { src: "vk-video.png", widths: [64], formats: ["webp"], lossless: true },
  { src: "youtube.png", widths: [64], formats: ["webp"], lossless: true },
  // the strip of 12 icons of the hero chips (made from the covers of the ring and the icons of the drawings, Oct 24, 2026).
  // Settings as for the covers below: the lowest at SSIMULACRA2 90 or more. Lossy WebP never gets there (it halves the
  // colour), so the WebP for browsers without AVIF is near-lossless.
  { src: "hero-chips.png", widths: [1152], formats: ["avif", "webp"], options: { avif: { quality: 96 }, webp: { nearLossless: true, quality: 60 } } },
  // the covers of the ring (shown at about 300 CSS px at most; the ring's texture is 640 at most). Each cover at the
  // lowest setting whose SSIMULACRA2 against the 640 px original is 90 or more (no visible loss at 1:1), measured
  // Oct 23, 2026. AVIF first; the WebP is for browsers without AVIF. First steps is flat colour: near-lossless WebP is
  // smaller than any AVIF that keeps its letters (14 KB at 92.8 against 31 KB at 91.3), so it has no AVIF.
  ...Object.entries({ "home": 88, "last-seen": 91, "reminiscence": 58, "love": 75, "rebirth": 87, "m": 64, "lazy-friday": 63 })
    .map(([n, q]) => ({ src: `cover-${n}.png`, widths: [640], formats: ["avif", "webp"], options: { avif: { quality: q } } })),
  { src: "cover-first-steps.png", widths: [640], formats: ["webp"], options: { webp: { nearLossless: true, quality: 40 } } },
  // pictures used inside the drawings (art/*.js), at the size they are drawn at 2×
  ...["face-anna", "face-elvira", "face-mark", "face-petr", "cube", "cube-bg"].map((n) => ({ src: `art-${n}.png`, widths: [null], formats: ["webp"], quality: 88 })),
  // the photos of the tiles of s1-1 and the covers in s1-2 and s1-3 (from the ring's covers). A tile is 160 px of the
  // drawing's 1000, about 180 CSS px on a 1440×900 screen and up to about 200 on big ones: 400 px is 2× of that; the covers
  // are 3× of their 45 and 26 px. Each at the lowest AVIF setting with SSIMULACRA2 90 or more against the original at that
  // size (Oct 24, 2026); the WebP next to it, at the usual setting, is for browsers without AVIF (art/shared.js offers
  // both). The Last Seen cover is so small that no AVIF gets there: near-lossless WebP only.
  ...Object.entries({ video: 86, hoodie: 76, cap: 88, concert: 90 })
    .map(([n, q]) => ({ src: `art-card-${n}.png`, widths: [400], formats: ["avif", "webp"], options: { avif: { quality: q } } })),
  { src: "cover-home.png", name: "art-card-home", widths: [400], formats: ["avif", "webp"], options: { avif: { quality: 88 } } },
  { src: "cover-home.png", name: "art-thumb-home", widths: [134], formats: ["avif", "webp"], options: { avif: { quality: 92 } } },
  { src: "cover-last-seen.png", name: "art-thumb-lastseen", widths: [79], formats: ["webp"], options: { webp: { nearLossless: true, quality: 80 } } },
  // shown only if a royalty drawing cannot be drawn (very old browsers)
  { src: "royalty-1.png", widths: [1012], formats: ["webp"] },
  { src: "royalty-2.png", widths: [1012], formats: ["webp"] }
];

// SVG files: cleaned up and minified. Their size and viewBox are kept (they are used as pictures).
const SVG = (name) => /^(logo-|art-icon-|art-logo-)/.test(name);

// The site's icons and the picture for links shared in messengers (Tim's files, Oct 24, 2026). They keep fixed
// addresses: public/ for the PNGs and the ICO, src/assets/icons/favicon.svg for the SVG (linked from every page).
//   icon.png         512 × 512, the mark on a full white square: the iPhone and Android icons and og.png
//   favicon-32.png   32 × 32, drawn for that size (more air than icon.png): favicon.ico, cut to a circle (Tim)
//   fm-logo.svg      the mark alone: favicon.svg, which turns white in dark mode
// Every PNG is lossless: the smallest of an exact palette and full colour whose pixels are identical to the resized
// picture (checked on every run; the build stops otherwise).
const ICON = "icon.png", FAVICON_32 = "favicon-32.png", LOGO = "fm-logo.svg";
const APP_ICONS = [
  { out: "apple-touch-icon.png", width: 180 },   // iPhone and iPad home screen: opaque, iOS rounds the corners itself
  { out: "icon-192.png", width: 192 },           // site.webmanifest
  { out: "icon-512.png", width: 512 }            // site.webmanifest
];
const OG = { out: "og.png", width: 1200, height: 630 };   // icon.png at 1:1 in the middle of a white 1200 × 630
const ICO = { out: "favicon.ico", sizes: [16, 32] };      // favicon-32.png in a circle; 16 made from it

const newer = async (out, src) => {
  if (FORCE) return false;
  try { return (await stat(out)).mtimeMs >= (await stat(src)).mtimeMs; } catch { return false; }
};

let made = 0, skipped = 0, bytesIn = 0, bytesOut = 0;
async function write(out, data, src) {
  await writeFile(out, data);
  made++;
  bytesOut += data.length;
  bytesIn += (await stat(src)).size;
}

await mkdir(OUT, { recursive: true });
await mkdir(PUBLIC, { recursive: true });

for (const job of RASTER) {
  const src = join(SRC, job.src), name = job.name || parse(job.src).name;
  const meta = await sharp(src).metadata();
  for (const w of job.widths) {
    const width = w || meta.width;
    for (const format of job.formats) {
      const file = job.widths.length > 1 ? `${name}-${width}.${format}` : `${name}.${format}`;
      const out = join(OUT, file);
      if (await newer(out, src)) { skipped++; continue; }
      const options = job.lossless ? { lossless: true, effort: 6 } : Object.assign({}, QUALITY[format], job.quality ? { quality: job.quality } : {}, job.options?.[format]);
      const data = await sharp(src).resize({ width, withoutEnlargement: true })[format](options).toBuffer();
      await write(out, data, src);
    }
  }
}

for (const file of (await readdir(SRC)).filter((f) => f.endsWith(".svg") && SVG(f))) {
  const src = join(SRC, file), out = join(OUT, file);
  if (await newer(out, src)) { skipped++; continue; }
  const { data } = optimize(await readFile(src, "utf8"), {
    multipass: true, floatPrecision: 2,
    plugins: ["preset-default", { name: "removeAttrs", params: { attrs: ["data-name"] } }]
  });
  await write(out, Buffer.from(data), src);
}

// --- the icons and og.png ---

// The smallest lossless PNG of a picture: an exact palette if the picture has 256 colours or fewer, else full colour.
// Each candidate is decoded and compared with the picture pixel by pixel; one that differs is never used.
// { rgba: true } skips the palette (the PNGs inside favicon.ico: some ICO readers only take 32-bit RGBA there).
async function exactPng(pipeline, name, { rgba = false } = {}) {
  const ref = await pipeline.clone().ensureAlpha().raw().toBuffer();
  const tries = [
    ...(rgba ? [] : [pipeline.clone().png({ palette: true, colours: 256, dither: 0, effort: 10, compressionLevel: 9 })]),
    pipeline.clone().png({ palette: false, compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
  ];
  // identical, except that a fully transparent pixel may carry any colour
  const same = (a, b) => {
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] !== b[i + 3]) return false;
      if (a[i + 3] && (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2])) return false;
    }
    return a.length === b.length;
  };
  let best = null;
  for (const t of tries) {
    const data = await t.toBuffer();
    const back = await sharp(data).ensureAlpha().raw().toBuffer();
    if (same(back, ref) && (!best || data.length < best.length)) best = data;
  }
  if (!best) throw new Error(`images: no lossless PNG for ${name}`);
  return best;
}

// favicon.ico with PNG entries (every browser since IE 11 / Windows Vista reads them)
function icoFile(entries) {
  const head = Buffer.alloc(6 + 16 * entries.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(entries.length, 4);
  let offset = head.length;
  entries.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size % 256, e); head.writeUInt8(size % 256, e + 1);   // 0 means 256
    head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...entries.map((x) => x.data)]);
}

// a smooth circle filling the square, as an alpha mask
const circle = (s) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></svg>`);

{
  const src = join(SRC, ICON);
  const opaque = () => sharp(src).flatten({ background: "#ffffff" });
  for (const job of APP_ICONS) {
    const out = join(PUBLIC, job.out);
    if (await newer(out, src)) { skipped++; continue; }
    const pic = sharp(await opaque().resize({ width: job.width, kernel: "lanczos3" }).png().toBuffer()).removeAlpha();
    await write(out, await exactPng(pic, job.out), src);
  }
  const og = join(PUBLIC, OG.out);
  if (await newer(og, src)) skipped++;
  else {
    const icon = await opaque().png().toBuffer();
    const { width, height } = await sharp(icon).metadata();
    const pic = sharp({ create: { width: OG.width, height: OG.height, channels: 3, background: "#ffffff" } })
      .composite([{ input: icon, left: Math.round((OG.width - width) / 2), top: Math.round((OG.height - height) / 2) }]);
    await write(og, await exactPng(sharp(await pic.png().toBuffer()).removeAlpha(), OG.out), src);
  }
}

{
  const src = join(SRC, FAVICON_32), out = join(PUBLIC, ICO.out);
  if (await newer(out, src)) skipped++;
  else {
    const entries = [];
    for (const size of ICO.sizes) {
      const square = await sharp(src).flatten({ background: "#ffffff" }).resize({ width: size, kernel: "lanczos3" }).removeAlpha().toBuffer();
      const round = await sharp(square).joinChannel(await sharp(circle(size)).extractChannel("alpha").toBuffer()).png().toBuffer();
      entries.push({ size, data: await exactPng(sharp(round), `${ICO.out} ${size}`, { rgba: true }) });
    }
    await write(out, icoFile(entries), src);
  }
}

{
  // favicon.svg: the mark, square viewBox (centred), black, white when the browser is dark
  const src = join(SRC, LOGO), out = new URL("../src/assets/icons/favicon.svg", import.meta.url).pathname;
  if (await newer(out, src)) skipped++;
  else {
    const svg = await readFile(src, "utf8");
    const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    const side = Math.max(w, h);
    const square = svg
      .replace(/<svg[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(w - side) / 2} ${(h - side) / 2} ${side} ${side}"><style>path{fill:#000}@media (prefers-color-scheme:dark){path{fill:#fff}}</style>`)
      .replace(/\s*fill="[^"]*"/g, "");
    const { data } = optimize(square, { multipass: true, floatPrecision: 3, plugins: [{ name: "preset-default", params: { overrides: { inlineStyles: false, minifyStyles: false } } }] });
    await write(out, Buffer.from(data), src);
  }
}

const kb = (b) => (b / 1024).toFixed(0) + " KB";
console.log(`images: ${made} made (${kb(bytesIn)} of originals → ${kb(bytesOut)}), ${skipped} up to date`);
