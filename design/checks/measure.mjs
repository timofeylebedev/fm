// Measures the built site (dist/) in a real browser and writes one record: every number the checks need.
//   node design/checks/measure.mjs [--engine chromium|webkit] [--quick] [--out design/checks/out/record.json]
// --quick: the full sizes and the page's health only (no width/height sweep, no modes, no scenarios), for a second
// engine. In CI it runs on every deploy (deploy.yml); here it runs after `npm run build`.
// What it does, in order:
//   sweep      every 10px of width (320–1920, 1100 tall) and every 25px of height (400–1100, 1440 wide): the probes of
//              site.config.mjs (the report's responsive picture and map)
//   sizes      at each size of site.config.mjs: the collector (collect.js) on the whole page, reduced motion, after a
//              scroll top to bottom (so every block has come in)
//   modes      at 390×844 and 1440×900: no scripts, no WebGL, forced colours, fonts that never arrive, reduced motion
//   privacy    a first visit: requests to other hosts, cookies and storage before «ОК», and after
//   scenarios  the logic table of site.config.mjs
//   pages      every page: head, outline, anchors, links, sideways scroll; robots.txt, sitemap.xml, the manifest
//   weight     the bytes of a first visit by kind (as sent: Brotli for text)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, extname, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { brotliCompressSync } from "node:zlib";
import * as playwright from "playwright";
import cfg from "./site.config.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const DIST = join(ROOT, "dist");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i < 0 ? d : args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true; };
const ENGINE = opt("engine", process.env.FM_ENGINE || "chromium");
const QUICK = !!opt("quick", false);
// --only sweep,sizes,…: only these steps (for working on the checks)
const ONLY = typeof opt("only", "") === "string" && opt("only", "") ? opt("only").split(",") : null;
const OUT = resolve(opt("out", join(ROOT, "design/checks/out", `record-${ENGINE}.json`)));
const COLLECT = readFileSync(join(import.meta.dirname, "collect.js"), "utf8");
// the version of the consent the site asks for now (a stored answer of an older version does not count)
const CONSENT_VERSION = +((readFileSync(join(ROOT, cfg.consent.source || "src/scripts/consent.js"), "utf8").match(/VERSION\s*=\s*(\d+)/) || [, 1])[1]);
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`, ...a);
if (!existsSync(join(DIST, "index.html"))) { console.error("measure: no dist/index.html — run `npm run build` first"); process.exit(2); }

// ── the built site, served as GitHub Pages serves it (addresses without .html; 404.html for anything missing) ──
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".avif": "image/avif",
  ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".json": "application/json", ".ico": "image/x-icon", ".txt": "text/plain", ".xml": "application/xml", ".webmanifest": "application/manifest+json" };
const isFile = async (f) => { try { return (await stat(f)).isFile(); } catch { return false; } };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = join(DIST, p), status = 200;
  if (p.endsWith("/")) file = join(file, "index.html");
  else if (!(await isFile(file)) && (await isFile(file + ".html"))) file += ".html";
  if (!(await isFile(file))) { file = join(DIST, "404.html"); status = 404; }
  const body = await readFile(file);
  res.writeHead(status, { "content-type": TYPES[extname(file)] || "application/octet-stream" }); res.end(body);
}).listen(0);
const URL0 = `http://localhost:${server.address().port}/`;

// ── the browser ──
const chromium = ENGINE === "chromium";
const exe = chromium ? process.env.PLAYWRIGHT_CHROMIUM || undefined : undefined;
const GL = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"];
const launch = (extra = []) => playwright[ENGINE].launch(chromium ? { executablePath: exe, args: [...GL, ...extra] } : {});
const browser = await launch();
const version = browser.version();
log(`engine ${ENGINE} ${version}${QUICK ? " (quick)" : ""}`);

// main's html has scrollbar-gutter: stable (book.css): headless Chromium fills it like a classic 15px scrollbar. The
// checks measure as on a Mac or a phone (overlay scrollbars): the rule is taken out of the served CSS, and out of the
// pages themselves (the home page's stylesheet is put inside its HTML by the build: inlineCss, PR #61).
const overlay = async (route) => {
  const t = route.request().resourceType();
  if (!route.request().url().startsWith(URL0) || (t !== "document" && t !== "stylesheet")) return route.fallback();
  try { const r = await route.fetch(); const body = (await r.text()).replace(/scrollbar-gutter:\s*stable/g, "scrollbar-gutter:auto"); await route.fulfill({ response: r, body }); } catch { await route.fallback().catch(() => {}); }
};
// Safari on a Mac scrolls the page in its own box (box.js): Playwright's WebKit says it is that Safari, and then the
// window never scrolls and nothing seems to overflow. The checks measure the page as the window scrolls it (?fmbox=0).
const Q = "?fmbox=0", PAGE = URL0 + Q;
// nothing leaves this machine: other hosts are answered with nothing, but every request is recorded
const offline = (ctx, seen) => ctx.route((u) => !u.href.startsWith(URL0), (route) => { seen?.push(route.request().url()); return route.fulfill({ status: 204, body: "" }); });
async function context(b, { w, h, dpr = 1, touch = false, ...more } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch && chromium, bypassCSP: true, ...more });
  await ctx.route("**/*", overlay);
  return ctx;
}
const wait = (page, ms) => page.waitForTimeout(ms);
async function warm(page) {
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 400) { await page.evaluate((y) => scrollTo(0, y), y); await wait(page, 50); }
  await page.evaluate(() => scrollTo(0, 0)); await wait(page, 700);
}
const withCollector = (page) => page.addScriptTag({ content: COLLECT });
const collectCfg = { skip: cfg.skip, align: cfg.align, cards: cfg.cards, typeObjects: cfg.typeObjects, paragraphs: cfg.paragraphs, notIcons: cfg.notIcons };
const git = (...a) => { try { return execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim(); } catch { return null; } };
const record = {
  schema: 1, site: cfg.name, engine: ENGINE, version, quick: QUICK, when: new Date().toISOString(),
  commit: (process.env.FM_HEAD_SHA || git("rev-parse", "HEAD") || "").slice(0, 40), ref: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || git("rev-parse", "--abbrev-ref", "HEAD"),
  pr: process.env.FM_PR || null, at: {}, timings: {},
};
const step = async (name, fn) => { if (ONLY && !ONLY.includes(name)) return; const s = Date.now(); try { await fn(); } catch (e) { record.errors = [...(record.errors || []), `${name}: ${String(e.message || e).split("\n")[0]}`]; log(`${name} FAILED: ${e.message}`); } record.timings[name] = Math.round((Date.now() - s) / 1000); log(`${name} done`); };

// ── sweep ──
if (!QUICK) await step("sweep", async () => {
  const probes = `(${cfg.probes.toString()})()`;
  const run = async (sizes, axis) => {
    const ctx = await context(browser, { w: sizes[0][0], h: sizes[0][1] }), page = await ctx.newPage();
    await offline(ctx); await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PAGE, { waitUntil: "load" });
    await page.addStyleTag({ content: ".art{visibility:hidden!important} canvas,.dots{display:none!important}" });
    await wait(page, 800); await warm(page);
    const out = [];
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h }); await wait(page, 420);
      const d = await page.evaluate(probes); d[axis] = axis === "w" ? w : h; out.push(d);
    }
    await ctx.close();
    return out;
  };
  const W = []; for (let w = 320; w <= 1920; w += 10) W.push([w, 1100]);
  const H = []; for (let h = 400; h <= 1100; h += 25) H.push([1440, h]);
  const [width, height] = await Promise.all([run(W, "w"), run(H, "h")]);
  record.sweep = { width, height };
});

// ── sizes ──
// snapshots of the collector at several scroll positions, joined: a thing counts once (by its key), with the most
// copies seen at one time and every place it was seen
function merge(shots) {
  const by = (list, key) => { const m = new Map(); for (const x of list) { const k = key(x), y = m.get(k); if (!y) m.set(k, { ...x, where: [...(x.where || [])] }); else { y.n = Math.max(y.n || 0, x.n || 0); for (const w of x.where || []) if (y.where.length < 6 && !y.where.includes(w)) y.where.push(w); if (x.props) for (const [p, v] of Object.entries(x.props)) y.props[p] = Math.max(y.props[p] || 0, v); } } return [...m.values()]; };
  const uniq = (list) => { const m = new Map(); for (const x of list) m.set(JSON.stringify(x), x); return [...m.values()]; };
  const all = (k) => shots.flatMap((s) => s[k] || []);
  const first = shots[0];
  const comps = new Map(); for (const c of all("components")) { const y = comps.get(c.name); if (!y || c.n > y.n) comps.set(c.name, c); }
  return {
    vw: first.vw, vh: first.vh, dpr: first.dpr, n: Math.max(...shots.map((s) => s.n)),
    text: by(all("text"), (t) => `${t.px}|${t.family}|${t.weight}|${t.lh}|${t.object}`), colours: by(all("colours"), (c) => c.rgba.join(",")), fills: by(all("fills"), (f) => f.kind),
    radii: by(all("radii"), (r) => `${r.sel}|${r.px}`), borders: by(all("borders"), (b) => String(b.px)), shadows: by(all("shadows"), (x) => x.prop + x.value),
    effects: uniq(all("effects")), layers: uniq(all("layers")), z: by(all("z"), (x) => String(x.z)), contexts: Math.max(...shots.map((s) => s.contexts)),
    icons: uniq(all("icons")), images: by(all("images").map((i) => ({ ...i, where: [i.sel] })), (i) => i.sel + i.src).map(({ where, ...i }) => i), ratios: uniq(all("ratios")),
    edges: { lines: first.edges.lines, near: uniq(all("edges").flatMap((e) => e.near)), n: Math.max(...shots.map((s) => s.edges.n)) },
    typo: uniq(all("typo")), components: [...comps.values()], interact: by(all("interact"), (x) => String(x.ms)), overflow: Math.max(...shots.map((s) => s.overflow)),
  };
}
await step("sizes", async () => {
  for (const s of cfg.sizes) {
    const ctx = await context(browser, s), page = await ctx.newPage(), errors = [];
    await offline(ctx); page.on("pageerror", (e) => errors.push(String(e.message || e).slice(0, 200)));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PAGE, { waitUntil: "load" }); await wait(page, 900); await warm(page);
    await withCollector(page);
    // what shows only in view (the stack's cards, pinned blocks) is measured where it shows: at the top of every
    // section, and a screen at a time through the ones taller than the screen; the snapshots are joined
    const stops = await page.evaluate((h) => { const ys = new Set([0]); for (const e of document.querySelectorAll("main > section, body > footer")) { const r = e.getBoundingClientRect(), top = r.top + scrollY; ys.add(Math.max(0, Math.round(top - 80))); for (let y = top + h; y < top + r.height - h / 2; y += h) ys.add(Math.round(y)); } return [...ys].sort((a, b) => a - b); }, s.h);
    const shots = [];
    for (const y of stops) { await page.evaluate((y) => scrollTo(0, y), y); await wait(page, 450); shots.push(await page.evaluate(async (c) => await window.__dsCollect(c), collectCfg)); }
    const m = merge(shots);
    m.errors = errors; m.stops = stops.length;
    record.at[`${s.w}x${s.h}`] = m;
    await ctx.close();
  }
});

// ── modes ──
const pageText = () => {
  const seen = (e) => { for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === "none" || s.visibility === "hidden" || +s.opacity < 0.05) return false; } return true; };
  const walker = document.createTreeWalker(document.querySelector("main") || document.body, NodeFilter.SHOW_TEXT); let all = 0, vis = 0;
  for (let n; (n = walker.nextNode()); ) { const t = n.textContent.trim().length; if (!t || !n.parentElement || n.parentElement.closest("template, script, style, [hidden]")) continue; all += t; if (seen(n.parentElement)) vis += t; }
  const heads = [...document.querySelectorAll("main h1, main h2")];
  return { chars: all, shown: vis, headings: heads.length, headingsShown: heads.filter(seen).length, h1: !!document.querySelector("h1") && seen(document.querySelector("h1")),
    running: (document.getAnimations?.() || []).filter((a) => a.playState === "running").map((a) => ({ name: a.animationName || a.constructor.name, target: a.effect?.target?.className?.toString?.().split(" ")[0] || a.effect?.target?.tagName || "?", infinite: a.effect?.getTiming?.().iterations === Infinity })).slice(0, 20) };
};
if (!QUICK) await step("modes", async () => {
  record.modes = {};
  const sizes = [{ w: 390, h: 844, dpr: 2, touch: true }, { w: 1440, h: 900, dpr: 1 }];
  const fontsCut = {};
  for (const s of sizes) {
    const key = `${s.w}x${s.h}`, out = (record.modes[key] = {});
    const one = async (name, b, opts, prep) => {
      const ctx = await context(b, { ...s, ...opts }), page = await ctx.newPage(), errors = [];
      await offline(ctx); page.on("pageerror", (e) => errors.push(String(e.message || e).slice(0, 200)));
      if (prep) await prep(ctx, page);
      await page.goto(PAGE, { waitUntil: "load" }); await wait(page, 1200); await warm(page); await wait(page, 1500);
      const r = await page.evaluate(pageText); r.errors = errors;
      if (name === "fonts" || name === "normal") {
        // the texts as drawn: their width and their lines (the line boxes of the text itself); fitted titles left out
        r.boxes = await page.evaluate((objects) => [...document.querySelectorAll("main h1, main h2, main h3, main p, .btn")].filter((e) => e.getClientRects().length && !e.closest(".art, .fm-stage, .hero-chips") && !e.closest(objects))
          .map((e) => { const b = e.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(e); const tops = new Set([...rg.getClientRects()].filter((r) => r.width > 1).map((r) => Math.round(r.top / 4))); return { sel: e.tagName.toLowerCase() + "." + (e.className.toString().split(" ")[0] || ""), w: Math.round(b.width), h: Math.round(b.height), lines: tops.size, text: (e.getAttribute("aria-label") || e.textContent).trim().replace(/\s+/g, " ").slice(0, 24) }; }), cfg.typeObjects);
      }
      out[name] = r; await ctx.close();
    };
    await one("normal", browser, {});
    await one("calm", browser, { reducedMotion: "reduce" });
    await one("nojs", browser, { javaScriptEnabled: false });
    if (chromium) await one("forced", browser, { forcedColors: "active" });
    await one("fonts", browser, {}, (ctx) => ctx.route("**/*.woff2", (r) => r.abort()));
    if (chromium) { const b2 = await launch(["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"]); await one("nowebgl", b2, {}); await b2.close(); }
  }
});

// ── privacy ──
if (!QUICK) await step("privacy", async () => {
  const ctx = await context(browser, { w: 1440, h: 900 }), page = await ctx.newPage();
  const before = [], after = [];
  let phase = before;
  await ctx.route((u) => !u.href.startsWith(URL0), (route) => { phase.push(route.request().url()); return route.fulfill({ status: 204, body: "" }); });
  await page.goto(PAGE, { waitUntil: "load" }); await wait(page, 1500);
  await page.mouse.move(400, 300); await page.mouse.move(700, 500); await warm(page);
  await page.hover("[data-demo]").catch(() => {}); await wait(page, 3500);
  const pre = { requests: [...new Set(before)], cookies: (await ctx.cookies()).map((c) => c.name), storage: await page.evaluate(() => Object.keys(localStorage)) };
  phase = after;
  const ok = await page.locator(cfg.consent.button).count();
  if (ok) { await page.click(cfg.consent.button).catch(() => {}); await wait(page, 1500); await page.mouse.move(500, 400); await page.hover("[data-demo]").catch(() => {}); await wait(page, 4000); }
  record.privacy = { before: pre, after: { requests: [...new Set(after)].map((u) => new URL(u).host), cookies: (await ctx.cookies()).map((c) => c.name), storage: await page.evaluate(() => Object.keys(localStorage)) }, consentButton: !!ok };
  await ctx.close();
});

// ── scenarios ──
if (!QUICK) await step("scenarios", async () => {
  record.scenarios = [];
  for (const sc of cfg.scenarios) {
    const [w, h] = sc.size || [1440, 900], ctx = await context(browser, { w, h, touch: w < 900, dpr: 1 }), page = await ctx.newPage(), errors = [];
    await offline(ctx); page.on("pageerror", (e) => errors.push(String(e.message || e).slice(0, 160)));
    if (sc.consent) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, JSON.stringify({ v, at: Date.now() })), [cfg.consent.storage, CONSENT_VERSION]);
    const helpers = { url: PAGE, wait: (ms) => wait(page, ms), vis: (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== "hidden" && +c.opacity > 0.05 && r.bottom > 0 && r.top < innerHeight; }, sel) };
    let res;
    try { res = await Promise.race([sc.run(page, helpers), new Promise((_, no) => setTimeout(() => no(new Error("timed out after 40 s")), 40000))]); } catch (e) { res = String(e.message || e).split("\n")[0]; }
    record.scenarios.push({ id: sc.id, ok: res === true, note: res === true ? "" : String(res), errors, size: `${w}×${h}` });
    await ctx.close();
  }
});

// ── pages, links, files ──
await step("pages", async () => {
  record.pages = [];
  const links = new Set();
  for (const p of cfg.pages) {
    for (const s of [{ w: 390, h: 844, touch: true, dpr: 2 }, { w: 1440, h: 900 }]) {
      const ctx = await context(browser, s), page = await ctx.newPage(), errors = [];
      await offline(ctx); page.on("pageerror", (e) => errors.push(String(e.message || e).slice(0, 160)));
      const res = await page.goto(URL0 + p.path + Q, { waitUntil: "load" }); await wait(page, 800);
      await withCollector(page);
      const head = s.w === 1440 ? await page.evaluate(() => window.__dsHead()) : null;
      const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
      if (head) head.links.forEach((l) => links.add(JSON.stringify([p.path, l])));
      record.pages.push({ path: p.path, title: p.title, size: `${s.w}x${s.h}`, status: res?.status(), want: p.status || 200, overflow, errors, ...(head ? { head } : {}) });
      await ctx.close();
    }
  }
  // every link that stays on the site must lead somewhere (the anchors of other pages too)
  const checked = [];
  for (const j of links) {
    const [from, href] = JSON.parse(j);
    if (/^(mailto:|tel:|javascript:|#)/.test(href)) continue;
    const u = new URL(href, URL0 + from);
    if (!u.href.startsWith(URL0)) continue;
    const r = await fetch(u.href.split("#")[0]); let ok = r.status === 200, why = r.status === 200 ? "" : String(r.status);
    if (ok && u.hash) { const html = await r.text(); ok = new RegExp(`id=["']?${u.hash.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\\s>]`).test(html); if (!ok) why = "no " + u.hash; }
    checked.push({ from: from || "/", href, ok, why });
  }
  record.links = checked;
  const file = async (p) => { const r = await fetch(URL0 + p); return { path: p, status: r.status, body: r.status === 200 ? (await r.text()).slice(0, 4000) : "" }; };
  record.files = await Promise.all(["robots.txt", "sitemap.xml", "site.webmanifest", "favicon.ico", "apple-touch-icon.png", "og.png"].map(file));
  record.files.forEach((f) => { if (/\.(ico|png)$/.test(f.path)) f.body = ""; });
});

// ── weight ──
if (!QUICK) await step("weight", async () => {
  const ctx = await context(browser, { w: 1440, h: 900, dpr: 2 }), page = await ctx.newPage(), got = [];
  await offline(ctx);
  page.on("response", async (r) => { if (!r.url().startsWith(URL0)) return; try { const b = await r.body(); got.push({ url: r.url().slice(URL0.length) || "index.html", type: r.request().resourceType(), raw: b.length, sent: /text|javascript|json|xml|svg|css|html/.test(r.headers()["content-type"] || "") ? brotliCompressSync(b).length : b.length }); } catch {} });
  await page.goto(PAGE, { waitUntil: "load" }); await wait(page, 1500); await warm(page); await wait(page, 1500);
  const by = {}; for (const g of got) { const k = g.type === "stylesheet" ? "css" : g.type === "script" ? "js" : g.type === "font" ? "fonts" : g.type === "image" ? "images" : g.type === "document" ? "html" : "other"; (by[k] ||= { files: 0, sent: 0, raw: 0 }); by[k].files++; by[k].sent += g.sent; by[k].raw += g.raw; }
  record.weight = { by, total: Object.values(by).reduce((a, b) => a + b.sent, 0), files: got.length, top: got.sort((a, b) => b.sent - a.sent).slice(0, 12) };
  await ctx.close();
});

await browser.close(); server.close();
record.seconds = Math.round((Date.now() - t0) / 1000);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(record));
log(`wrote ${OUT.replace(ROOT + "/", "")} (${Math.round(JSON.stringify(record).length / 1024)} KB)`);
