#!/usr/bin/env node
// Builds the review page's data: design/report/site/ is the page (index.html, report.css, report.js written by hand);
// this script writes what it reads into it, so the page opens straight from the folder (file://) and from any host:
//
//   site/data.js      window.REPORT: the rounds (from data.json) and the system as it is now, read from the repo's own
//                     sources (design/scale.json, design/tokens.json, design/decisions.json, the stylesheets' shadows
//                     and layout steps), each item marked new or changed against the baseline commit
//   site/typeset.js   build/typeset/core.js + lint.js bundled for the browser (window.Typeset): the page's demo runs
//                     the real typesetter
//   site/fonts/       the site's fonts (the type specimens are drawn in them)
//
//   node design/report/build-site.mjs [--since <commit>]      (default: meta.since in data.json, round 5's build)
//
// The pictures the rounds show are in site/shots/ (data.json points to them as "shots/…").
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const SITE = path.join(HERE, "site");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
const atBase = (p) => { if (typeof NO_BASE !== "undefined" && NO_BASE) return null; try { return git("show", `${SINCE}:${p}`); } catch { return null; } };
// a shallow clone (GitHub's checkout) has no baseline commit: fetch that one commit, or nothing can be marked new
const haveBase = () => { try { git("cat-file", "-e", `${SINCE}^{commit}`); return true; } catch { return false; } };

const data = JSON.parse(read("design/report/data.json"));
const args = process.argv.slice(2);
const SINCE = args.includes("--since") ? args[args.indexOf("--since") + 1] : data.meta.since || "edeb7451a61f14972f8fda6ea73dc630701349e6";
const SINCE_LABEL = data.meta.sinceLabel || "round 5 (Oct 23)";
if (!haveBase()) { try { git("fetch", "--depth=1", "origin", SINCE); } catch {} }
const NO_BASE = !haveBase();
if (NO_BASE) console.warn(`build-site: commit ${SINCE} is not here and could not be fetched: the page is built without "new" marks`);
const sec = Object.fromEntries(data.sections.map((s) => [s.id, s]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// the system shows only what is now: old values and relative dates out of the measured texts
const nowOnly = (html) => typeof html !== "string" ? html : html
  .replace(/<span class='was'>[^<]*<\/span>\s*/g, "")
  .replace(/\s*\((?:was|before:?) [^()]*\)/g, "")                     // «(was 0.8s / 18%)»
  .replace(/,\s*was [\d.]+(?:px)?(?=[,;.)]|$)/g, "")                    // «31 at 390, was 36»
  .replace(/\s*\((?:today|since today)\)/g, "")
  .replace(/;\s*[^;()]*\bbefore\)/g, ")")                               // «(…; Pragmatica 700, 24 → 32 before)»
  .replace(/\s+since today(?=[.,;)])/g, "")
  .replace(/\btoday's\b/g, "the")
  .replace(/\b[Ss]ince today,?\s*/g, "");
const cleanAll = (o) => { if (Array.isArray(o)) return o.map(cleanAll); if (o && typeof o === "object") { for (const k of Object.keys(o)) if (k !== "sweep") o[k] = cleanAll(o[k]); return o; } return nowOnly(o); };

// with no baseline nothing is marked (rather than everything)
const unmark = (o) => { if (NO_BASE && o) { o.isNew = false; o.was = null; o.changed = false; } return o; };

// ── the rounds: each a page of its own ──────────────────────────────────────────────────────────────────────────────
const rounds = (data.meta.rounds || []).map((r) => ({ ...r, sections: r.sections.map((id) => clone(sec[id])).filter(Boolean) }));

// ── colour ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const tokens = JSON.parse(read("design/tokens.json"));
const tokensThen = JSON.parse(atBase("design/tokens.json") || "{}");
const colThen = tokensThen.tokens?.Color || {};
const GROUPS = [
  ["ink", "Ink", "One ink (black) in alpha steps: text, lines, shadows."],
  ["surface", "Surfaces", "The page, the two grounds (sand: the hero; mist: tools and footer) and the tints of cards on white."],
  ["brand", "Brand", "Purple for actions; one colour per subject (blue, orange, green, magenta, teal)."],
  ["white", "Paper in alpha", "White over colour and over pictures."],
  ["glass", "Glass", "The navbar's ground."],
  ["idcard", "ID cards", "The three shades of the ID card object."],
  ["status", "Status dots", "The hero chips' dots (hero.js): a part of the picture."],
];
const colour = GROUPS.map(([key, label, about]) => ({
  key, label, about,
  tokens: Object.entries(tokens.tokens.Color).filter(([n]) => n.split("/")[0] === key).map(([name, t]) => {
    const was = colThen[name];
    return { name, value: t.value, web: t.web || null, description: t.description || "",
      isNew: !was, was: was && was.value !== t.value ? was.value : null };
  }),
})).filter((g) => g.tokens.length);

// ── type and space: design/scale.json ────────────────────────────────────────────────────────────────────────────────
const scale = JSON.parse(read("design/scale.json"));
const scaleThen = JSON.parse(atBase("design/scale.json") || "{}");
const roleDiff = (kind, name, r) => {
  const was = scaleThen[kind]?.roles?.[name];
  if (!was) return { isNew: true, was: null };
  const pick = (x) => ({ px: x.px, per: x.per || null, by: x.by || null });
  return { isNew: false, was: same(pick(was), pick(r)) ? null : pick(was) };
};
// how each text role is drawn on the site: font, weight, line height, a text from the page, where
const SPEC = {
  "type/hero": { font: "display", weight: 700, lh: "display", text: "Весь лейбл — на одной волне", where: ".hero__title (capped by fit: the width / 7.2)" },
  "type/h2": { font: "display", weight: 700, lh: "display", text: "Роялти без споров о цифрах", where: ".head, .cta__title, stack card titles (capped by the card: its width / 9.8)" },
  "type/card-heading": { font: "text", weight: 600, lh: "heading", text: "Как разобраться в отчетах по роялти", where: ".tool__title, .pub__title, royalty titles, the 404 title" },
  "type/doc-title": { font: "text", weight: 600, lh: "heading", text: "Политика обработки персональных данных", where: ".doc-title (the legal pages)" },
  "type/lead": { font: "text", weight: 400, lh: "text", text: "Порядок в релизах и проектах, правах и документах, роялти и платежах", where: ".hero__lead, .cta__lead, .doc-h2", color: "ink-60" },
  "type/card-tag": { font: "text", weight: 500, lh: 1.2, text: "Управление", upper: true, track: "0.05em", where: ".card__tag (a label: case, weight and its pill set it apart)" },
  "type/body-m": { font: "text", weight: 400, lh: "text", text: "Убедитесь в соответствии закону до того, как это станет проблемой", where: ".tool__desc", color: "ink-60" },
  "type/body": { font: "text", weight: 400, lh: "text", text: "Что должно быть в роялти-отчетах, как проверить их корректность", where: "body, .pub__desc, buttons, the footer, the legal pages' text" },
  "type/body-s": { font: "text", weight: 500, lh: "compact", text: "Планируйте наперёд, чтобы релизы не накладывались", where: ".feature__title, .feature__desc, bylines" },
  "type/ui": { font: "text", weight: 400, lh: "text", text: "Продукт · Клиенты · Публикации · © 2026, Все права защищены", where: "navbar links, menu, skip link, footer notes", color: "ink-60" },
  "type/note": { font: "text", weight: 400, lh: "text", text: "Используем куки, чтобы делать сайт лучше", where: ".cookies__text", color: "ink-70" },
};
const typeRoles = Object.entries(scale.type.roles).map(([name, r]) => ({ name, ...r, ...(SPEC[name] || {}), ...roleDiff("type", name, r) }));
const spaceRoles = Object.entries(scale.space.roles).map(([name, r]) => ({ name, ...r, ...roleDiff("space", name, r) }));
const removedRoles = (kind) => Object.keys(scaleThen[kind]?.roles || {}).filter((n) => !scale[kind].roles[n]);

// ── the stylesheets: shadows and layout steps (now and at the baseline) ─────────────────────────────────────────────
const cssFilesNow = () => git("ls-files", "src/styles").split("\n").filter((f) => f.endsWith(".css") && !f.endsWith(".gen.css"));
const cssFilesThen = () => { try { return git("ls-tree", "-r", "--name-only", SINCE, "src/styles").split("\n").filter((f) => f.endsWith(".css") && !f.endsWith(".gen.css")); } catch { return []; } };
// walks a stylesheet, keeping the selector each declaration is in (nesting included) and its line
function walk(file, text, onDecl, onAt) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  const stack = [], recs = [];                                            // recs: what onAt returned for each level
  let buf = "", bufLine = 1, line = 1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\n") line++;
    if (c === "{") {
      const head = buf.trim().replace(/\s+/g, " ");
      let rec = null;
      if (head.startsWith("@")) rec = onAt ? onAt({ file, line: bufLine, head, inside: stack.filter((s) => !s.startsWith("@")).at(-1) || "" }) || null : null;
      else if (recs.at(-1) && !recs.at(-1).first) recs.at(-1).first = head;   // the first rule inside an at-rule
      stack.push(head); recs.push(rec); buf = ""; bufLine = line;
    } else if (c === "}") {
      if (buf.trim()) onDecl(buf.trim(), stack, bufLine);
      stack.pop(); recs.pop(); buf = ""; bufLine = line;
    } else if (c === ";") {
      onDecl(buf.trim(), stack, bufLine); buf = ""; bufLine = line;
    } else {
      if (!buf.trim() && c.trim()) bufLine = line;
      buf += c;
    }
  }
}
const selectorOf = (stack) => {
  const sels = stack.filter((s) => !s.startsWith("@"));
  return sels.reduce((acc, s) => (acc ? s.replace(/&/g, acc.split(",")[0].trim()) : s), "") || ":root";
};
const media = (stack) => stack.filter((s) => s.startsWith("@")).join(" ");
function shadowsOf(files, get) {
  const out = [];
  for (const f of files) {
    const text = get(f);
    if (!text) continue;
    walk(f, text, (decl, stack, line) => {
      const m = decl.match(/^(box-shadow|text-shadow|filter)\s*:\s*([\s\S]+)$/);
      if (!m) return;
      if (m[1] === "filter" && !/drop-shadow/.test(m[2])) return;
      const value = m[2].replace(/\s+/g, " ").trim();
      if (/^none$/.test(value)) return;
      out.push({ prop: m[1], value, sel: selectorOf(stack), media: media(stack), file: f.replace("src/styles/", ""), line });
    });
  }
  return out;
}
const shNow = shadowsOf(cssFilesNow(), (f) => read(f));
const shThen = shadowsOf(cssFilesThen(), (f) => atBase(f));
const shadows = [];
for (const s of shNow) {
  let g = shadows.find((x) => x.prop === s.prop && x.value === s.value);
  if (!g) shadows.push((g = { prop: s.prop, value: s.value, uses: [], isNew: !shThen.some((t) => t.value === s.value) }));
  g.uses.push({ sel: s.sel, media: s.media, file: s.file, line: s.line, isNew: !shThen.some((t) => t.value === s.value && t.sel === s.sel) });
}
// what each shadow is for (by what it looks like); a "painter" is a box-shadow used to paint, not a shadow
shadows.forEach((s) => {
  s.painter = /calc\(|var\(--stack-page/.test(s.value) && !/rgb|ink/.test(s.value.split(",")[0]);
  s.name = s.value === "0 4px 16px var(--ink-10)" ? "Floating" : /0 24px 56px/.test(s.value) ? "Object (ID cards)" : /90 60 30/.test(s.value) ? "Chip (warm)" : s.painter ? "Painter (the stack's strips)" : s.uses[0].sel;
  s.ground = s.painter ? "paper" : /chip|hero/.test(s.uses.map((u) => u.sel).join()) ? "sand" : "paper";
});

function stepsOf(files, get) {
  const out = [];
  for (const f of files) {
    const text = get(f);
    if (!text) continue;
    walk(f, text, () => {}, (at) => {
      if (!at.head.startsWith("@container")) return;
      const m = at.head.match(/^@container\s+([\w-]+\s+)?(.+)$/);
      const rec = { container: (m[1] || "").trim() || "(nearest)", cond: m[2].trim(), file: f.replace("src/styles/", ""), line: at.line, inside: at.inside, first: "" };
      out.push(rec);
      return rec;
    });
  }
  return out;
}
const SHARED = { "22rem": "S", "43rem": "M", "58rem": "L" };
const stepsNow = stepsOf(cssFilesNow(), (f) => read(f));
const stepsThen = stepsOf(cssFilesThen(), (f) => atBase(f));
const taken = new Set();                                                    // a step it replaced is named once
const containers = stepsNow.map((s) => {
  const v = (s.cond.match(/([\d.]+(?:rem|em|px))/) || [])[1] || "";
  const isNew = !stepsThen.some((t) => t.cond === s.cond && t.container === s.container);
  // a step that replaced one: the baseline had another condition for the same container there, gone now
  const was = isNew ? stepsThen.find((t) => t.file === s.file && t.container === s.container && t.first === s.first &&
    !taken.has(t) && !stepsNow.some((n) => n.cond === t.cond && n.container === t.container)) : null;
  if (was) taken.add(was);
  return { ...s, value: v, px: /rem$/.test(v) ? parseFloat(v) * 16 : /px$/.test(v) ? parseFloat(v) : null, em: /\dem$/.test(v), step: SHARED[v] || "own",
    isNew, was: was ? was.cond : null };
});
// the page's own steps (media.css), with the comment after each
const mediaOf = (text) => [...(text || "").matchAll(/@custom-media\s+(--[\w-]+)\s+([^;]+);\s*(?:\/\*\s*([^*]*?)\s*\*\/)?/g)]
  .map((m) => ({ name: m[1], cond: m[2].trim(), note: (m[3] || "").trim() }));
const mediaThen = mediaOf(atBase("src/styles/base/media.css"));
const pageSteps = mediaOf(read("src/styles/base/media.css")).map((m) => ({ ...m, isNew: !mediaThen.some((t) => t.name === m.name), was: (mediaThen.find((t) => t.name === m.name && t.cond !== m.cond) || {}).cond || null }));

// ── decisions ───────────────────────────────────────────────────────────────────────────────────────────────────────
const decisions = JSON.parse(read("design/decisions.json")).decisions;
const decThen = (JSON.parse(atBase("design/decisions.json") || "{\"decisions\":[]}").decisions) || [];
decisions.forEach((d) => {
  const was = decThen.find((t) => t.id === d.id);
  d.isNew = !was;
  d.changed = !!was && !same({ ...was, audit: 0 }, { ...d, audit: 0, isNew: undefined, changed: undefined }) && (was.what !== d.what || was.decided !== d.decided || was.measured !== d.measured);
});

// ── motion: the curves and durations of the latest round (read from the code then), marked against the round before ─
const prevData = (() => { try { return JSON.parse(read("design/report/measure/published-oct23.json")); } catch { return { sections: [] }; } })();
const prevMotion = prevData.sections.find((s) => s.id === "motion") || { blocks: [] };
const motion = clone(sec.motion);
const blockOf = (s, type) => s.blocks.find((b) => b.type === type);
const prevCurves = blockOf(prevMotion, "curves")?.items || [];
const curvePart = (c) => ({ bez: c.bez, path: c.path, linear: c.linear, wave: c.wave, fn: c.fn });
blockOf(motion, "curves").items.forEach((c) => {
  const was = prevCurves.find((p) => p.name === c.name);
  c.isNew = !was; c.changed = !!was && !same(curvePart(was), curvePart(c));
});
// durations: their names and notes were rewritten between rounds, so no text comparison can tell a real change from a
// new wording; the round lists what changed (meta.motionChanged: name → what)
const MOTION_CHANGED = data.meta.motionChanged || {};
blockOf(motion, "durations").rows.forEach((r) => { if (MOTION_CHANGED[r.name]) { r.changed = true; r.what = MOTION_CHANGED[r.name]; } });
motion.blocks = motion.blocks.filter((b) => b.type !== "cards");
cleanAll(motion.blocks);
const motionCards = cleanAll(clone(blockOf(sec.motion, "cards")));

// ── measured: the whole responsive picture and the map, now only ───────────────────────────────────────────────────
const picture = clone(blockOf(sec.picture, "picture"));
delete picture.sweep.before;
const map = clone(blockOf(sec.map, "map"));
map.rows.forEach((r) => delete r.before);
const SUBS = {
  hero: "Least and greatest sizes for each part, measured at real screen sizes.",
  stack: "How the card stack is built and moves.",
  tools: "Padding by the card's own width, the picture under the text, side by side from their own step.",
  tiles: "Features, logo and stat tiles take radius/s with the padding = radius; the ID cards are a 240×345 object scaled as a whole.",
  footer: "The footer's notes, and the legal pages.",
  navbar: "How the navbar behaves on sideways phones and in apps' browsers.",
};
const blocks = ["hero", "stack", "tools", "tiles", "footer", "navbar"].map((id) => {
  const s = clone(sec[id]);
  s.sub = SUBS[id];
  cleanAll(s.blocks);
  s.blocks.forEach((b) => { if (b.title === "At real screen sizes") b.sub = (b.sub || "").replace(/\s*Old values struck through\.?/i, ""); });
  return s;
});

// ── the typesetter: its rules as the README writes them (one table per language) ────────────────────────────────────
const readme = read("build/typeset/README.md");
const rulesBy = {};
let lang = null;
for (const ln of readme.split("\n")) {
  const h = ln.match(/^### (.+)/);
  if (h) { lang = /Any/.test(h[1]) ? "*" : /Russian/.test(h[1]) ? "ru" : /English/.test(h[1]) ? "en" : null; continue; }
  if (/^## /.test(ln)) lang = null;
  const m = lang && ln.match(/^\| ([\w-]+(?: \(join\))?) \| ([^|]+) \| (.+) \|$/);
  if (m && m[1] !== "rule") (rulesBy[lang] ||= []).push({ name: m[1].replace(" (join)", ""), join: / \(join\)/.test(m[1]), strength: m[2].trim(), example: m[3].trim() });
}
const typesetDecision = decisions.find((d) => d.id === "typeset") || null;

[...colour.flatMap((g) => g.tokens), ...typeRoles, ...spaceRoles, ...containers, ...pageSteps, ...shadows, ...shadows.flatMap((x) => x.uses), ...decisions, ...blockOf(motion, "curves").items].forEach(unmark);

// the colours the stylesheets name (the shadow tiles are drawn with them)
const cssVars = { face: "var(--idcard-face-1)" };
for (const f of ["src/styles/base/tokens.gen.css", "src/styles/base/tokens.css"])
  for (const m of read(f).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\s*;/g)) cssVars[m[1]] ??= m[2];

// ── write ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const head = (process.env.FM_HEAD_SHA || git("rev-parse", "HEAD").trim()).slice(0, 7);
const built = git("log", "-1", "--format=%cs").trim();
// the branch it was built from (GitHub's checkout of a pull request has no branch of its own)
const ref = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || git("rev-parse", "--abbrev-ref", "HEAD").trim();
const REPORT = {
  meta: { ...data.meta, built, head, ref, noBase: NO_BASE, since: SINCE, sinceLabel: SINCE_LABEL },
  rounds,
  system: {
    colour, colourWhere: clone(sec.system.blocks.find((b) => b.title === "Colour")),
    scale: { range: scale.range, ladder: scale.ladder, relations: scale.type.relations, lineHeight: scale.type.lineHeight, tracking: scale.type.tracking, aliases: scale.type.aliases },
    type: typeRoles, space: spaceRoles, removed: { type: removedRoles("type"), space: removedRoles("space") },
    heightLine: clone(sec.system.blocks.find((b) => b.type === "grid")?.blocks?.find((b) => b.title === "The screen's size")),
    containers, pageSteps, map, shadows, cssVars, motion, motionCards, picture, blocks,
    grammar: cleanAll(clone(sec.grammar)), decisions,
  },
  typeset: { rules: rulesBy, decision: typesetDecision },
};
fs.mkdirSync(SITE, { recursive: true });
const json = JSON.stringify(REPORT).replace(/<\/(script)/gi, "<\\/$1");
fs.writeFileSync(path.join(SITE, "data.js"), "/* generated by design/report/build-site.mjs: do not edit */\nwindow.REPORT = " + json + ";\n");

// the typesetter for the browser
const entry = path.join(SITE, ".typeset-entry.mjs");
fs.writeFileSync(entry, `export * from "../../../build/typeset/core.js";\nexport { lint, CHECKS } from "../../../build/typeset/lint.js";\n`);
try {
  execFileSync(path.join(ROOT, "node_modules/.bin/rolldown"), [entry, "--format", "iife", "--name", "Typeset", "--file", path.join(SITE, "typeset.js")], { cwd: ROOT, stdio: "pipe" });
} finally { fs.rmSync(entry, { force: true }); }
const ts = fs.readFileSync(path.join(SITE, "typeset.js"), "utf8");
fs.writeFileSync(path.join(SITE, "typeset.js"), "/* generated by design/report/build-site.mjs from build/typeset/core.js and lint.js: do not edit */\n" + ts);

// the fonts
fs.mkdirSync(path.join(SITE, "fonts"), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, "src/assets/fonts"))) if (f.endsWith(".woff2")) fs.copyFileSync(path.join(ROOT, "src/assets/fonts", f), path.join(SITE, "fonts", f));

const kb = (f) => Math.round(fs.statSync(path.join(SITE, f)).size / 1024) + " KB";
console.log(`site/data.js ${kb("data.js")} · typeset.js ${kb("typeset.js")} · since ${SINCE.slice(0, 7)}`);
console.log(`  new since ${SINCE.slice(0, 7)}: colours ${colour.flatMap((g) => g.tokens).filter((t) => t.isNew || t.was).length}, type ${typeRoles.filter((r) => r.isNew || r.was).length}, space ${spaceRoles.filter((r) => r.isNew || r.was).length}, steps ${containers.filter((c) => c.isNew).length + pageSteps.filter((p) => p.isNew).length}, shadows ${shadows.filter((s) => s.isNew).length}, decisions ${decisions.filter((d) => d.isNew).length} new / ${decisions.filter((d) => d.changed).length} changed, curves ${blockOf(motion, "curves").items.filter((c) => c.isNew || c.changed).length}`);
