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

// The hero's settings: [AVIF quality, WebP quality] per width, in two sets (index.html picks one by the screen's density):
//   HERO_1X for screens under 2× (desktops, laptops at 1.25 and 1.5): the lowest setting at which the file scores
//     SSIMULACRA2 90 or more against the original at that width, on the hero's sand. Up to 2120 a 1× screen can get the
//     file, so it is held to that at 1:1; 2650 and 3200 are only ever asked for at 1.25× and 1.5× (a 1× screen needs at
//     most 2120), so they are scored as seen there (both pictures scaled down by the density), and 80 or more at 1:1.
//   HERO_2X for screens of 2× and more (phones, tablets, retina laptops): scored as seen at 2×, and 80 or more at 1:1.
//     No 1400 here: held to that it needs AVIF 79 (44 KB), more than the 1800 (39 KB), which those screens get instead.
// The files before scored 75–79 at 1:1. Measured Oct 24, 2026; scores of the AVIF: as seen / at 1:1.
const HERO_1X = {
  900: [86, 95],    // 90.3                  29 KB
  1200: [86, 96],   // 90.0                  45 KB (Oct 25: for 1.5–1.9× phones, which needed 1100–1200 and got the 1400)
  1400: [86, 96],   // 90.0                  55 KB
  1800: [86, 97],   // 90.0                  81 KB
  2120: [86, 97],   // 90.1                 104 KB
  2650: [80, 93],   // 1.25×: 90.2 / 88.3   115 KB
  3200: [75, 92]    // 1.5×: 90.2 / 86.9    126 KB
};
const HERO_2X = {
  1800: [62, 89],   // 90.0 / 81.7           39 KB
  2120: [62, 86],   // 90.1 / 82.2           49 KB
  2650: [63, 89],   // 90.1 / 83.0           69 KB
  3200: [63, 89],   // 90.1 / 83.4           88 KB
  4096: [64, 89]    // 90.0 / 83.3          135 KB
};
const heroQ = (set) => (w) => ({ avif: { quality: set[w][0], chromaSubsampling: "4:4:4" }, webp: { quality: set[w][1], smartSubsample: true } });

// an AVIF setting: a quality, or [quality, bit depth] (10-bit keeps fine grain at a smaller size than 8-bit)
const avif = (q) => Array.isArray(q) ? { quality: q[0], bitdepth: q[1] } : { quality: q };

const RASTER = [
  // the hero: a wide picture whose width follows the screen's height (see hero.css), shown at most
  // min(160vw, 2120px, max(196.2vh, 660px)) wide (the sizes in index.html). The original (Tim's, Oct 24, 2026) is
  // 4096 × 1141, cut at the bottom to the old frame 3.92333 : 1 (4096 × 1044, lossless): the edge of the table and the
  // people are where they were in the 3531 × 900 one, so hero.css and the chips' places stay. What screens got (browser
  // windows, Oct 24, 2026): under 2×: 1400 a 1366 × 768 laptop, an 800 px window · 1800 1536 × 864 @ 1.25 ·
  // 2120 1920 × 1080, 2560 × 1440, 1280 × 800 @ 1.5 · 2× and up: 1800 iPhone SE, Android 412 · 2120 iPhones 390–440 ·
  // 2650 iPad 820 · 3200 MacBook Air 1440 × 900 · 4096 MacBook Pro 1512 × 982.
  // Settings: HERO_1X and HERO_2X above.
  { src: "hero-table.webp", widths: [900, 1200, 1400, 1800, 2120, 2650, 3200], formats: ["avif", "webp"], options: heroQ(HERO_1X) },
  { src: "hero-table.webp", name: "hero-table-2x", widths: [1800, 2120, 2650, 3200, 4096], formats: ["avif", "webp"], options: heroQ(HERO_2X) },
  // the two tool cards (Tim's pictures of Oct 28, 2026, 1230 × 1344). Drawn at most 360 CSS px wide on phones and
  // tablets (about 88vw − 50px) and 383–410 when the cards stand side by side (the sizes in index.html); in device px
  // that is 381–410 at 1×, 464–720 at 2× phones and tablets, 815–820 on 2× laptops, 800–1007 on 3× phones. Each width at
  // the lowest setting whose SSIMULACRA2 against the original at that width (on the card's white) is 90 or more
  // (Oct 28, 2026). Both need full colour (4:4:4): halved colour never gets to 90 (the bot's teal and red marks, the
  // orange of Lens). The Lens scans are fine grain, so 10-bit (a little smaller there); Litmus is flat UI, 8-bit.
  // The WebP (browsers without AVIF): lossy at the lowest quality that gets to 90; Lens at 420 never does, so near-lossless.
  // Scores of the AVIF / sizes: Litmus 90.1 16 KB · 90.0 24 KB · 90.1 31 KB · 90.3 39 KB;
  //                             Lens   90.2 29 KB · 90.5 58 KB · 90.2 84 KB · 90.2 116 KB
  { src: "fm-litmus.png", widths: [420, 640, 820, 1024], formats: ["avif", "webp"], options: (w) => ({
    avif: { quality: { 420: 76, 640: 72, 820: 70, 1024: 70 }[w], bitdepth: 8, chromaSubsampling: "4:4:4" },
    webp: { quality: { 420: 94, 640: 93, 820: 92, 1024: 91 }[w], smartSubsample: true } }) },
  { src: "fm-lens.png", widths: [420, 640, 820, 1024], formats: ["avif", "webp"], options: (w) => ({
    avif: { quality: { 420: 78, 640: 78, 820: 76, 1024: 76 }[w], bitdepth: 10, chromaSubsampling: "4:4:4" },
    webp: w === 420 ? { nearLossless: true, quality: 40 } : { quality: { 640: 97, 820: 97, 1024: 100 }[w], smartSubsample: true } }) },
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
  // Oct 24, 2026, the new Home cover in the first cell: 10-bit AVIF at 92 (31 KB) instead of 8-bit at 96 (34 KB); every
  // cell scores the same or better than before, the worst 82.6 against 81.9 (cell by cell, at 1:1). Only the Home icon
  // is below 90 (83: the film grain at 96 px, 82 before with the old cover too); 90 would take 60 KB.
  { src: "hero-chips.png", widths: [1152], formats: ["avif", "webp"], options: { avif: { quality: 92, bitdepth: 10 }, webp: { nearLossless: true, quality: 60 } } },
  // the covers of the ring (shown at about 300 CSS px at most; the ring's texture is 640 at most). Each cover at the
  // lowest setting whose SSIMULACRA2 against the 640 px original is 90 or more (no visible loss at 1:1), measured
  // Oct 23, 2026. AVIF first; the WebP is for browsers without AVIF. First steps is flat colour: near-lossless WebP is
  // smaller than any AVIF that keeps its letters (14 KB at 92.8 against 31 KB at 91.3), so it has no AVIF.
  // The Home cover was replaced on Oct 24, 2026 (a photo with film grain): 10-bit AVIF keeps grain better for its size,
  // so it is 10-bit at 86 (100 KB, 90.6); the best 8-bit was 92 (136 KB, 90.5).
  ...Object.entries({ "home": [86, 10], "last-seen": 91, "reminiscence": 58, "love": 75, "rebirth": 87, "m": 64, "lazy-friday": 63 })
    .map(([n, q]) => ({ src: `cover-${n}.png`, widths: [640], formats: ["avif", "webp"], options: { avif: avif(q) } })),
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
  // the Home cover (new on Oct 24, 2026) in 10-bit, as in the ring: tile 86 (39 KB, 90.6; 8-bit needed 92, 53 KB),
  // thumbnail 88 (4.9 KB, 90.2; 8-bit 91, 5.0 KB)
  { src: "cover-home.png", name: "art-card-home", widths: [400], formats: ["avif", "webp"], options: { avif: avif([86, 10]) } },
  { src: "cover-home.png", name: "art-thumb-home", widths: [134], formats: ["avif", "webp"], options: { avif: avif([88, 10]) } },
  { src: "cover-last-seen.png", name: "art-thumb-lastseen", widths: [79], formats: ["webp"], options: { webp: { nearLossless: true, quality: 80 } } },
  // shown only if a royalty drawing cannot be drawn (very old browsers)
  { src: "royalty-1.png", widths: [1012], formats: ["webp"] },
  { src: "royalty-2.png", widths: [1012], formats: ["webp"] }
];

// SVG files: cleaned up and minified. Their size and viewBox are kept (they are used as pictures).
const SVG = (name) => /^(logo-|art-icon-|art-logo-)/.test(name);

// The site's icons and the picture for links shared in messengers (Tim's files, Oct 24, 2026). They keep fixed
// addresses: public/ for the PNGs and the ICO, src/assets/icons/favicon.svg for the SVG (linked from every page).
//   icon.png         512 × 512, the mark on a full white square: the iPhone and Android icons
//   og.png           1200 × 630, the picture for links shared in messengers: public/og.png at its own size
//   favicon-32.png   32 × 32, drawn for that size (more air than icon.png): favicon.ico, cut to a circle (Tim)
//   fm-logo.svg      the mark alone: favicon.svg, which turns white in dark mode
// Every PNG is lossless: the smallest of an exact palette and full colour whose pixels are identical to the resized
// picture (checked on every run; the build stops otherwise).
const ICON = "icon.png", OG_SRC = "og.png", FAVICON_32 = "favicon-32.png", LOGO = "fm-logo.svg";
const APP_ICONS = [
  { out: "apple-touch-icon.png", width: 180 },   // iPhone and iPad home screen: opaque, iOS rounds the corners itself
  { out: "icon-192.png", width: 192 },           // site.webmanifest
  { out: "icon-512.png", width: 512 }            // site.webmanifest
];
const OG = { out: "og.png", width: 1200, height: 630 };   // og:image width and height in the pages say the same
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
      const options = job.lossless ? { lossless: true, effort: 6 } : Object.assign({}, QUALITY[format], job.quality ? { quality: job.quality } : {}, (typeof job.options === "function" ? job.options(width) : job.options)?.[format]);
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
}

{
  const src = join(SRC, OG_SRC), out = join(PUBLIC, OG.out);
  if (await newer(out, src)) skipped++;
  else {
    const { width, height } = await sharp(src).metadata();
    if (width !== OG.width || height !== OG.height) throw new Error(`images: ${OG_SRC} is ${width} × ${height}, not ${OG.width} × ${OG.height}`);
    await write(out, await exactPng(sharp(src).flatten({ background: "#ffffff" }).removeAlpha(), OG.out), src);
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
