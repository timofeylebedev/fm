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
  // the strip of 12 icons of the hero chips
  { src: "hero-chips.webp", widths: [1152], formats: ["webp"] },
  // the covers of the ring (shown at about 300 CSS px at most)
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ src: `cover-${i}.webp`, widths: [640], formats: ["webp"] })),
  // pictures used inside the drawings (art/*.js), at the size they are drawn at 2×
  ...["card-cap", "card-concert", "card-home", "card-hoodie", "card-video", "face-anna", "face-elvira", "face-mark",
      "face-petr", "thumb-home", "thumb-lastseen", "cube", "cube-bg"].map((n) => ({ src: `art-${n}.png`, widths: [null], formats: ["webp"], quality: 88 })),
  // shown only if a royalty drawing cannot be drawn (very old browsers)
  { src: "royalty-1.png", widths: [1012], formats: ["webp"] },
  { src: "royalty-2.png", widths: [1012], formats: ["webp"] }
];

// SVG files: cleaned up and minified. Their size and viewBox are kept (they are used as pictures).
const SVG = (name) => /^(logo-|art-icon-|art-logo-)/.test(name);

// Files that keep a fixed address (public/): the picture for links shared in messengers, and the icons of the site
const PUBLIC_FILES = [
  { src: "og.png", out: "og.png", width: 1200, format: "png" },
  { src: "favicon.png", out: "apple-touch-icon.png", width: 180, format: "png" },
  { src: "favicon.png", out: "icon-192.png", width: 192, format: "png" },
  { src: "favicon.png", out: "icon-512.png", width: 512, format: "png" }
];

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
      const options = job.lossless ? { lossless: true, effort: 6 } : Object.assign({}, QUALITY[format], job.quality ? { quality: job.quality } : {});
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

for (const job of PUBLIC_FILES) {
  const src = join(SRC, job.src), out = join(PUBLIC, job.out);
  if (await newer(out, src)) { skipped++; continue; }
  const data = await sharp(src).resize({ width: job.width }).png(QUALITY.png).toBuffer();
  await write(out, data, src);
}

const kb = (b) => (b / 1024).toFixed(0) + " KB";
console.log(`images: ${made} made (${kb(bytesIn)} of originals → ${kb(bytesOut)}), ${skipped} up to date`);
