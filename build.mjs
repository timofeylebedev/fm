// Builds the minified files the site loads from the readable sources in src/.
//   src/home.css → f/home-59min.css   (clean-css, then each font file embedded as base64, as the Taptop export did)
//   src/home.js  → f/home-64min.js    (terser, ES2020)
// Run: npm install (once), then npm run build. `npm run check` fails if a built file is not up to date.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import CleanCSS from "clean-css";
import { minify } from "terser";

const root = dirname(fileURLToPath(import.meta.url));
const at = (p) => join(root, p);
const checkOnly = process.argv.includes("--check");

const TARGETS = {
  css: { src: "src/home.css", out: "f/home-59min.css" },
  js: { src: "src/home.js", out: "f/home-64min.js" },
};

async function buildCss() {
  const { src, out } = TARGETS.css;
  const result = new CleanCSS({ level: 1 }).minify(readFileSync(at(src), "utf8"));
  if (result.errors.length) throw new Error(result.errors.join("\n"));
  // Embed each woff2 font, keeping the file url after it as a fallback. Paths in the CSS are relative to f/.
  const outDir = dirname(at(out));
  return result.styles.replace(/url\("([^"]+\.woff2)"\) format\("woff2"\)/g, (match, path) => {
    const data = readFileSync(resolve(outDir, path)).toString("base64");
    return `url("data:font/woff2;base64,${data}") format("woff2"),${match}`;
  });
}

async function buildJs() {
  const { src } = TARGETS.js;
  const result = await minify(readFileSync(at(src), "utf8"), { compress: true, mangle: true, ecma: 2020 });
  return result.code;
}

let stale = 0;
for (const [kind, build] of [["css", buildCss], ["js", buildJs]]) {
  const { src, out } = TARGETS[kind];
  const code = await build();
  let current = "";
  try { current = readFileSync(at(out), "utf8"); } catch {}
  if (code === current) { console.log(`${out}: up to date`); continue; }
  if (checkOnly) { console.log(`${out}: out of date with ${src}`); stale++; continue; }
  writeFileSync(at(out), code);
  console.log(`${out}: built from ${src} (${(code.length / 1024).toFixed(1)} KB)`);
}
if (stale) process.exit(1);
