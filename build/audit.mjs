// The page checked in a real browser at the screen sizes that matter, after `npm run build`:   npm run audit
//
// At each size the whole page is scrolled through (so every block has come in and every pinned part has moved), then
// every section is looked at on screen. It fails (exit code 1) on:
//   · sideways scroll: the page wider than the screen, at any point of the scroll;
//   · text cut off: a line of text reaching outside a block that clips it, or outside the screen (the drawings, the
//     hero's chips and the sliding strip of logos are left out: they are cut off on purpose);
//   · text under 12px as it is drawn (scaling included), outside the drawings;
//   · a link or button smaller than 24×24px to tap (WCAG 2.2, 2.5.8);
//   · axe-core rules (accessibility), at a phone and a computer size;
//   · all of the above but axe with the browser's text made bigger (24px), at a phone and a short laptop;
//   · text drawn over a canvas (the dots of the stats and the CTA card), which axe cannot see: its contrast is measured
//     from the pixels behind it (the text hidden for a moment), at the axe sizes.
// Decisions taken on purpose are in design/decisions.json, each with who, when and why: an exception listed there is
// not a failure, but it is measured and printed under "Kept as designed" on every run, so it stays in sight.
//
// Browser: Playwright's Chromium (`npx playwright install chromium` once), or the one in PLAYWRIGHT_CHROMIUM.
// Other engines: FM_ENGINE=firefox or FM_ENGINE=webkit (`npx playwright install firefox webkit`). They have no phone
// emulation of Chromium's kind (Firefox none at all), so there the phone sizes are plain windows of that size. The
// bigger text is set in Chromium through DevTools and in Firefox through its settings; WebKit leaves those sizes out.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { resolve, extname, join } from "node:path";
import { createRequire } from "node:module";
import * as playwright from "playwright";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const AXE = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const SIZES = [
  { w: 320, h: 568, touch: true, axe: true }, { w: 390, h: 844, touch: true }, { w: 768, h: 1024, touch: true },
  { w: 844, h: 390, touch: true }, { w: 1024, h: 768, touch: true }, { w: 1366, h: 650 }, { w: 1920, h: 1080, axe: true },
  // the browser's text made bigger (Settings → Appearance → Font size: "Very large" is 24px): the rem sizes grow, and
  // the em steps of media.css give the layout of a narrower screen. Nothing may then scroll sideways or be cut off.
  { w: 390, h: 844, touch: true, font: 24 }, { w: 1366, h: 650, font: 24 }
];
// decided on purpose (design/decisions.json): not failures, but measured and shown on every run
const DECISIONS = JSON.parse(readFileSync(join(root, "design/decisions.json"), "utf8")).decisions;
const EXCEPTIONS = DECISIONS.filter((d) => d.kind === "exception");
const ACCEPTED = EXCEPTIONS.filter((d) => d.audit?.axe).map((d) => ({ rule: d.audit.axe, target: new RegExp(d.audit.target), id: d.id }));
const PIXELS = [...new Set(EXCEPTIONS.flatMap((d) => d.audit?.pixels || []).concat([".stat__number", ".stat__label", ".cta__title", ".cta__lead"]))];
const kept = new Map();                               // decision id → what was measured on this run

// ── a tiny static server for dist/ ──
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".avif": "image/avif", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json", ".ico": "image/x-icon" };
if (!existsSync(join(dist, "index.html"))) { console.error("audit: no dist/index.html — run `npm run build` first"); process.exit(2); }
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = join(dist, path.endsWith("/") ? path + "index.html" : path);
  try { const body = await readFile(file); res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

// ── what is measured in the page ──
function measure() {
  const vw = document.documentElement.clientWidth;
  const name = (e) => e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/)[0] : "");
  const path = (e) => { const p = []; for (let x = e; x && x !== document.body && p.length < 3; x = x.parentElement) p.unshift(name(x)); return p.join(" > "); };
  const shown = (e) => { for (let x = e; x; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false; } const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const skip = (e) => e.closest(".fm-stage, .hero-chips, .sprite, .logos__track, .access__cards, .stack, .nav, .menu");
  const out = { clipped: [], small: [], targets: [] };
  for (const e of document.querySelectorAll("h1, h2, h3, p, a, button, dt, dd, span")) {
    if (skip(e) || !e.textContent.trim() || !shown(e) || e.children.length > 3) continue;
    const r = document.createRange(); r.selectNodeContents(e); const t = r.getBoundingClientRect();
    if (t.right > vw + 1 || t.left < -1) out.clipped.push(`${path(e)} past the screen by ${Math.round(Math.max(t.right - vw, -t.left))}px`);
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (!/(hidden|clip)/.test(s.overflowX + s.overflowY)) continue;
      const q = a.getBoundingClientRect(), over = Math.max(q.left - t.left, t.right - q.right, q.top - t.top, t.bottom - q.bottom);
      if (over > 1.5) out.clipped.push(`${path(e)} cut by ${name(a)} by ${Math.round(over)}px`);
      break;
    }
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode()); ) {
    const e = n.parentElement;
    if (!e || !n.textContent.trim() || e.closest(".fm-stage, .hero-chips, .sprite, script, style") || !shown(e)) continue;
    const k = e.offsetHeight ? e.getBoundingClientRect().height / e.offsetHeight : 1;
    const px = parseFloat(getComputedStyle(e).fontSize) * (k > 0.05 && k < 1.01 ? k : 1);
    if (px < 11.95) out.small.push(`${path(e)} «${n.textContent.trim().slice(0, 24)}» ${px.toFixed(1)}px`);
  }
  for (const e of document.querySelectorAll("a[href], button")) {
    if (!shown(e) || e.closest(".skip")) continue;
    const r = e.getBoundingClientRect(), a = getComputedStyle(e, "::after"), extra = a.content !== "none" && a.position === "absolute" ? Math.max(0, -parseFloat(a.top) || 0) * 2 : 0;
    if (Math.min(r.width, r.height) + extra < 24) out.targets.push(`${path(e)} ${Math.round(r.width)}×${Math.round(r.height)}px`);
  }
  return out;
}

function note(id, line) { if (!kept.has(id)) kept.set(id, []); if (kept.get(id).length < 6) kept.get(id).push(line); }

// The contrast of a text drawn over a canvas: the text is made transparent for a moment, the box behind it is taken
// from a screenshot, and every pixel is compared with the text's colour. The median is what is reported (the dots move).
const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
async function canvasContrast(page, sel) {
  const out = [], n = await page.locator(sel).count();
  for (let i = 0; i < n; i++) {
    const el = page.locator(sel).nth(i);
    await el.evaluate((e) => e.scrollIntoView({ block: "center" })); await page.waitForTimeout(400);
    const info = await el.evaluate((e) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      for (let a = e.parentElement; a; a = a.parentElement) {           // cut off by a window (the sliding strip of logos)?
        const s = getComputedStyle(a); if (!/(hidden|clip)/.test(s.overflowX)) continue;
        const q = a.getBoundingClientRect(); if (r.left < q.left - 1 || r.right > q.right + 1) return null;
      }
      if (r.width < 4 || r.height < 4 || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) return null;
      const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10), color = cs.color;   // read before hiding it
      e.style.setProperty("color", "transparent", "important");
      return { x: r.left, y: r.top, w: r.width, h: r.height, color, large: size >= 24 || (size >= 18.66 && weight >= 700), text: e.textContent.trim().slice(0, 24) };
    });
    if (!info) continue;
    await page.waitForTimeout(60);
    const png = await page.screenshot({ clip: { x: info.x, y: info.y, width: info.w, height: info.h } });
    await el.evaluate((e) => e.style.removeProperty("color"));
    const { data, info: m } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const [tr, tg, tb] = info.color.match(/[\d.]+/g).map(Number), lt = lum(tr, tg, tb), ratios = [];
    for (let p = 0; p < data.length; p += m.channels) { const lb = lum(data[p], data[p + 1], data[p + 2]); ratios.push((Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05)); }
    ratios.sort((a, b) => a - b);
    out.push({ text: info.text, median: ratios[ratios.length >> 1], need: info.large ? 3 : 4.5 });
  }
  return out;
}

const ENGINE = process.env.FM_ENGINE || "chromium";
if (!["chromium", "firefox", "webkit"].includes(ENGINE)) { console.error(`audit: unknown FM_ENGINE ${ENGINE}`); process.exit(2); }
const chrome = ENGINE === "chromium";
const executablePath = chrome ? process.env.PLAYWRIGHT_CHROMIUM || (existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined) : undefined;
const browser = await playwright[ENGINE].launch(chrome ? { executablePath, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] } : {});
console.log(`engine: ${ENGINE} ${browser.version()}`);
const failures = [];
// Firefox: its text size is a setting of the browser, so a second browser is started with it
const big = ENGINE === "firefox" && SIZES.some((s) => s.font)
  ? await playwright.firefox.launch({ firefoxUserPrefs: { "font.size.variable.x-cyrillic": 24, "font.size.variable.x-western": 24 } }) : null;
for (const s of SIZES) {
  if (s.font && !chrome && !big) continue;            // WebKit: no way to set the text size
  const ctx = await (s.font && big ? big : browser).newContext({ viewport: { width: s.w, height: s.h }, hasTouch: !!s.touch, isMobile: !!s.touch && ENGINE !== "firefox", bypassCSP: true });
  const page = await ctx.newPage();
  if (s.font) { const cdp = await ctx.newCDPSession(page); await cdp.send("Page.enable"); await cdp.send("Page.setFontSizes", { fontSizes: { standard: s.font, fixed: Math.round(s.font * 13 / 16) } }); }
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  let overflow = 0;
  for (let y = 0, H = 1; y < H; y += Math.round(s.h / 2)) {
    H = await page.evaluate((y) => { scrollTo(0, y); return document.documentElement.scrollHeight; }, y);
    await page.waitForTimeout(90);
    overflow = Math.max(overflow, await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  }
  await page.waitForTimeout(1200);
  const found = { clipped: new Set(), small: new Set(), targets: new Set() };
  for (const sel of ["main > section:not(.stack)", "body > footer"]) {
    const n = await page.locator(sel).count();
    for (let i = 0; i < n; i++) {
      await page.locator(sel).nth(i).evaluate((e) => scrollTo(0, e.getBoundingClientRect().top + scrollY - 64));
      await page.waitForTimeout(900);
      const m = await page.evaluate(measure);
      for (const k of Object.keys(found)) m[k].forEach((x) => found[k].add(x));
    }
  }
  const tag = `${s.w}×${s.h}` + (s.font ? ` (text ${s.font}px)` : "");
  if (overflow > 0) failures.push(`${tag}: the page scrolls sideways by ${overflow}px`);
  for (const [k, label] of [["clipped", "text cut off"], ["small", "text under 12px"], ["targets", "target under 24px"]]) found[k].forEach((x) => failures.push(`${tag}: ${label}: ${x}`));
  errors.forEach((e) => failures.push(`${tag}: script error: ${e}`));
  if (s.axe) {
    await page.evaluate(() => scrollTo(0, 0));
    // the sand above the top of the page (body::before, base.css) is decoration outside the page; while it is there,
    // axe cannot work out any background and checks the contrast of no text at all, so it is hidden for the check
    await page.addStyleTag({ content: "body::before { display: none !important; }" });
    await page.addScriptTag({ content: AXE });
    const res = await page.evaluate(async () => { const r = await axe.run(document, { resultTypes: ["violations"] }); return { v: r.violations.map((x) => ({ id: x.id, nodes: x.nodes.map((n) => n.target.join(" ")) })), contrast: r.passes.some((x) => x.id === "color-contrast") || r.violations.some((x) => x.id === "color-contrast") }; });
    const v = res.v;
    if (!res.contrast) failures.push(`${tag}: axe could not check the contrast of any text (a layer it cannot see through?)`);
    for (const x of v) for (const t of x.nodes) {
      const a = ACCEPTED.find((a) => a.rule === x.id && a.target.test(t));
      if (!a) failures.push(`${tag}: axe ${x.id}: ${t}`);
      else note(a.id, `${tag}: axe ${x.id} on ${t.split(" ").pop()}`);
    }
  }
  if (s.axe) for (const sel of PIXELS) for (const r of await canvasContrast(page, sel)) {
    const owner = EXCEPTIONS.find((d) => d.audit?.pixels?.includes(sel));
    const line = `${tag}: ${sel} «${r.text}» ${r.median.toFixed(2)} : 1 over the canvas (needs ${r.need})`;
    if (r.median >= r.need) continue;
    if (owner) note(owner.id, line); else failures.push(`text over a canvas: ${line}`);
  }
  console.log(`${tag}: ${overflow ? "sideways scroll" : "ok"}; ${found.clipped.size} cut, ${found.small.size} small, ${found.targets.size} targets`);
  await ctx.close();
}
await browser.close();
if (big) await big.close();
server.close();
console.log(`\nKept as designed (design/decisions.json): ${EXCEPTIONS.length} exception(s), not counted as problems`);
for (const d of EXCEPTIONS) {
  console.log(`  · ${d.id}: ${d.what}\n      ${d.rule} — ${d.decided}; why: ${d.why}${d.fix ? `; fix if reconsidered: ${d.fix}` : ""}`);
  const seen = kept.get(d.id);
  if (seen) seen.forEach((l) => console.log(`      this run: ${l}`)); else if (d.audit) console.log("      this run: not met at the sizes checked");
}
if (failures.length) { console.log(`\n${failures.length} problem(s):`); failures.forEach((f) => console.log("  " + f)); process.exitCode = 1; }
else console.log("\nAll checks passed.");
