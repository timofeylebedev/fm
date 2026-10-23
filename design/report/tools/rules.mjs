// The system's rules as one check (a prototype of `npm run rules`, round 5): node design/report/tools/rules.mjs [--json]
// Reads the styles, the scripts, design/scale.json and design/decisions.json; prints every rule with what breaks it.
// It never changes a file. Exit code 1 when a rule marked "hard" breaks (the ones the build or CLAUDE.md already state).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const rel = (p) => relative(root, p);
const css = walk(join(root, "src/styles")).filter((p) => p.endsWith(".css"));
const js = walk(join(root, "src/scripts")).filter((p) => p.endsWith(".js"));
const scale = JSON.parse(readFileSync(join(root, "design/scale.json"), "utf8"));
const decisions = JSON.parse(readFileSync(join(root, "design/decisions.json"), "utf8")).decisions;

// comments out, line numbers kept
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
const lines = (p) => strip(readFileSync(p, "utf8")).split("\n");
const hits = [];                                    // every finding: rule, file:line, text
const hit = (rule, p, i, text) => hits.push({ rule, at: `${rel(p)}:${i + 1}`, text: text.trim().slice(0, 140) });

// ── the ladder and the type relations (what build/tokens.mjs enforces, counted again here) ──
const ladder = []; { let v = 0; for (const [step, to] of scale.ladder.steps) while (v < to) { v += step; ladder.push(v); } }
const onLadder = (v) => v === 0 || ladder.includes(v);
const roles = { ...scale.type.roles, ...scale.space.roles };
const offLadder = Object.entries(roles).filter(([, r]) => !r.size && !r.per && !(onLadder(r.px[0]) && onLadder(r.px[1])));
const rel2 = scale.type.relations.pairs.map(([a, b]) => {
  const [a0, a1] = scale.type.roles[a].px, [b0, b1] = scale.type.roles[b].px;
  return { pair: `${a} / ${b}`, at320: +(a0 / b0).toFixed(3), at1440: +(a1 / b1).toFixed(3) };
});
const close = rel2.filter((r) => Math.min(r.at320, r.at1440) < scale.type.relations.min);

// ── CSS rules ──
const SIZE_PROPS = /^\s*(padding|margin|gap|row-gap|column-gap|border-radius|font-size|letter-spacing|line-height)[\w-]*\s*:/;
const COLOUR = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|lab|lch)\(/i;
const defined = new Map(), used = new Map();
const containerSteps = [];
const SHARED = ["22rem", "43rem", "58rem"];
const ROLE_CSS = Object.values({ ...scale.space.roles }).map((r) => r.css && r.css.slice(2)).filter(Boolean).join("|");
const OWN = { "35rem": "ID deck", "32rem": "royalty card", "10em": "hero title", "400px": "video card" };
for (const p of css) {
  const name = rel(p), gen = name.endsWith("tokens.gen.css"), art = name.includes("/art/");
  const raw = readFileSync(p, "utf8");
  // an unclosed comment: a /* opened inside another comment, or never closed
  // a comment ends at the first */ after its /* (a "/*" inside a comment, like "button/*", is harmless text)
  const rest = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  if (rest.includes("/*")) hit("no-css-in-comments", p, raw.split("\n").length - 1, "a comment that is never closed: everything after it is lost");
  if (rest.includes("*/")) hit("no-css-in-comments", p, 0, "a */ without its /*");
  for (const m of raw.matchAll(/\/\*([\s\S]*?)\*\//g)) if (/[.#][\w-]+\s*\{[^}]*:[^}]*;/.test(m[1]))
    hit("no-css-in-comments", p, raw.slice(0, m.index).split("\n").length - 1, "a rule inside a comment: " + m[1].trim().slice(0, 80));
  lines(p).forEach((l, i) => {
    for (const m of l.matchAll(/--([\w-]+)\s*:/g)) if (!defined.has(m[1])) defined.set(m[1], `${name}:${i + 1}`);
    for (const m of l.matchAll(/var\(--([\w-]+)(\s*,)?/g)) { const u = used.get(m[1]) || { n: 0, fallback: true, at: `${name}:${i + 1}` }; u.n++; u.fallback &&= !!m[2]; used.set(m[1], u); }
    if (gen) return;
    // every declaration of the line on its own (one-line rules hold several)
    for (const d of l.split(/[;{}]/)) {
      if (!SIZE_PROPS.test(d)) continue;
      const v = d.slice(d.indexOf(":") + 1);
      if (/\bclamp\(|\d(vw|cqw|cqi|vmin|vmax)\b/.test(v)) hit("sizes-from-the-scale", p, i, d);
      const fs = d.match(/^\s*font-size\s*:\s*(.+)$/);
      if (fs && !/var\(--type-|^\s*\d*\.?\d+em\b|^1em|inherit|--u|--card-title|--cta-title|--hero-title|--fm-px/.test(fs[1])) hit("type-from-the-scale", p, i, d);
      // px in padding, gap and margin that are not roles; a number inside calc(), max() or min() is structure (a centring,
      // the height of a strip), and a padding undone by a negative margin is a larger hit area, not space
      if (/^\s*(padding|gap|margin|row-gap|column-gap)/.test(d) && !/-\d+px/.test(l)) {
        const bare = v.replace(/(calc|max|min|clamp)\((?:[^()]|\([^()]*\))*\)/g, "");
        if (/(?<![\w.-])[1-9]\d*(\.\d+)?px\b/.test(bare)) hit("spacing-literals", p, i, d);
      }
      if (new RegExp(`var\\(--(${ROLE_CSS})\\)\\s*\\*\\s*\\d|\\d\\s*\\*\\s*var\\(--(${ROLE_CSS})\\)`).test(v) && !/max\(/.test(v)) hit("multiplied-roles", p, i, d);
    }
    if (COLOUR.test(l) && !/^\s*--/.test(l) && !art && !/forced-colors/.test(l)) {
      const kind = /box-shadow|text-shadow|filter|gradient/.test(l) ? "shadow" : "colour";
      hit(kind === "shadow" ? "colours-from-tokens (shadows)" : "colours-from-tokens", p, i, l);
    }
    for (const m of l.matchAll(/@container[^{]*?\((?:width|inline-size)\s*[<>]=?\s*([\d.]+(?:rem|em|px))\)/g)) containerSteps.push({ step: m[1], at: `${name}:${i + 1}` });
    for (const m of l.matchAll(/cubic-bezier\(([^)]*)\)|\b(ease-in-out|ease-in|ease)\b(?![-\w])/g))
      if (/tokens\.css$/.test(name)) hit("curves-from-the-table", p, i, "a copy of M.curve's numbers (CSS cannot import them): " + l);
      else if (!/^\s*--/.test(l)) hit("curves-from-the-table", p, i, l);
  });
}
// var() in the HTML and scripts too (custom properties set or read there)
const html = readFileSync(join(root, "src/index.html"), "utf8");
const jsText = js.map((p) => readFileSync(p, "utf8")).join("\n");
for (const t of [html, jsText]) {
  for (const m of t.matchAll(/--([a-z][\w-]*)\s*:/g)) if (!defined.has(m[1])) defined.set(m[1], "html/js");
  for (const m of t.matchAll(/setProperty\(\s*["']--([\w-]+)/g)) if (!defined.has(m[1])) defined.set(m[1], "js");
  for (const m of t.matchAll(/var\(--([\w-]+)/g)) { const u = used.get(m[1]) || { n: 0, fallback: false }; u.n++; used.set(m[1], u); }
  for (const m of t.matchAll(/["'`]--([\w-]+)["'`]/g)) { const u = used.get(m[1]) || { n: 0, fallback: true }; u.n++; used.set(m[1], u); }
}
for (const [k, u] of used) if (!defined.has(k) && !u.fallback) hits.push({ rule: "every-var-defined", at: u.at || "?", text: `--${k} is read but never set` });
const tokensGen = readFileSync(join(root, "src/styles/base/tokens.gen.css"), "utf8");
for (const m of tokensGen.matchAll(/^\s*--([\w-]+)\s*:/gm)) if (!used.has(m[1])) hits.push({ rule: "every-token-used", at: "src/styles/base/tokens.gen.css", text: `--${m[1]} is set but nothing reads it` });
for (const s of containerSteps) if (!SHARED.includes(s.step) && !OWN[s.step]) hits.push({ rule: "layout-steps-shared", at: s.at, text: `container step ${s.step} is neither S/M/L nor a written own step` });

// ── scripts ──
for (const p of js) lines(p).forEach((l, i) => {
  if (rel(p).endsWith("scroller.js") || rel(p).endsWith("debug.js")) return;
  if (/^\s*import\b/.test(l) || rel(p).endsWith("boot.js")) return;   // boot.js runs before the scroller exists and reads the box itself
  if (/(^|[^.\w])(window\.)?scrollY\b(?!\s*\()|pageYOffset|(^|[^.\w])(window\.)?addEventListener\(\s*["']scroll/.test(l))
    hit("scroll-through-scroller", p, i, l);
  if (rel(p).includes("/art/")) return;                                  // the drawings keep their own curves and colours
  if ((/cubic-bezier\(\s*\d/.test(l) || /ease:\s*["'](power|sine|expo|circ|back|elastic|bounce)/.test(l)) && !rel(p).endsWith("motion.js")) hit("curves-from-the-table", p, i, l);
  if (/["'](#[0-9a-f]{3,8})["';]/i.test(l) && !/stipple|ring-gl/.test(rel(p))) hit("colours-in-scripts", p, i, l);
});
// the curve table itself: two names for one curve
const mot = readFileSync(join(root, "src/scripts/motion.js"), "utf8");
const table = [...mot.matchAll(/^\s{4}(\w+):\s*(\[[^\]]*\]|"[^"]*")/gm)].map((m) => ({ name: m[1], v: m[2].replace(/\s/g, "") }));
for (const a of table) for (const b of table) if (a.name < b.name && a.v === b.v) hits.push({ rule: "curves-from-the-table", at: "src/scripts/motion.js", text: `${a.name} and ${b.name} are the same curve ${a.v}` });

// ── the register ──
for (const d of decisions) {
  const need = d.kind === "exception" ? ["what", "rule", "decided", "why", "fix"] : ["what", "decided", "why"];
  const miss = need.filter((k) => !d[k]);
  if (miss.length) hits.push({ rule: "departures-written-down", at: `design/decisions.json#${d.id}`, text: `missing ${miss.join(", ")}` });
  if (d.kind === "exception" && !d.audit && !d.measured) hits.push({ rule: "departures-written-down", at: `design/decisions.json#${d.id}`, text: "an exception the audit does not measure" });
}

const RULES = [
  ["every-size-on-the-ladder", true, `both ends of every role on the ladder (${ladder.length} values)`, offLadder.map(([k, r]) => ({ at: "design/scale.json", text: `${k} ${r.px.join(" → ")}` }))],
  ["levels-apart", true, `type.relations ≥ ×${scale.type.relations.min} at 320 and 1440`, close.map((r) => ({ at: "design/scale.json", text: `${r.pair}: ×${r.at320} / ×${r.at1440}` }))],
  ["sizes-from-the-scale", true, "no vw / cqw / clamp() of its own in padding, margin, gap, radius or type"],
  ["colours-from-tokens", true, "no literal colour outside the drawings and tokens"],
  ["colours-in-scripts", false, "literal colours in the scripts (listed: content such as the chips' status dots is fine; a page colour is not)"],
  ["colours-from-tokens (shadows)", false, "shadows with literal greys (allowed so far; listed)"],
  ["type-from-the-scale", false, "every font-size a type role, em, or relative to its tile / card"],
  ["spacing-literals", false, "padding, gap and margin in px that are not roles (listed: candidates for roles)"],
  ["multiplied-roles", false, "a role times a factor (a hidden role: name it in scale.json)"],
  ["every-var-defined", true, "every var() without a fallback is set somewhere"],
  ["every-token-used", false, "every generated token is read somewhere"],
  ["layout-steps-shared", true, "container steps at S 22rem, M 43rem, L 58rem or a written own step"],
  ["no-css-in-comments", true, "no rules hidden in a comment; every comment closed"],
  ["curves-from-the-table", false, "every curve from M.curve / tokens.css; no two names for one curve"],
  ["scroll-through-scroller", true, "no window scroll / scrollY outside scroller.js (CLAUDE.md; boot.js, which runs before it and reads the box itself, is left out)"],
  ["departures-written-down", true, "every decision has what, who/when and why; every exception its rule, fix and a measure"],
];
const out = RULES.map(([id, hard, how, pre]) => { const h = pre || hits.filter((x) => x.rule === id); return { id, hard, how, ok: h.length === 0, n: h.length, hits: h }; });
if (process.argv.includes("--json")) { console.log(JSON.stringify({ rules: out, relations: rel2, containerSteps, decisions: decisions.length }, null, 1)); }
else {
  for (const r of out) {
    console.log(`${r.ok ? "✓" : r.hard ? "✗" : "·"} ${r.id} — ${r.how}${r.ok ? "" : ` (${r.n})`}`);
    for (const h of r.hits.slice(0, 12)) console.log(`    ${h.at}  ${h.text}`);
    if (r.hits.length > 12) console.log(`    … ${r.hits.length - 12} more`);
  }
}
process.exitCode = out.some((r) => r.hard && !r.ok) ? 1 : 0;
