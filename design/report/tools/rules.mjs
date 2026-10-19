// Prototype of `npm run rules`: the design system's rules as checks on the source (no browser). Read-only.
//   node rules2.mjs /path/to/repo [--json]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2], JSON_OUT = process.argv.includes("--json");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const sc = JSON.parse(read("design/scale.json"));
const tokens = JSON.parse(read("design/tokens.json"));
const decisions = existsSync(join(ROOT, "design/decisions.json")) ? JSON.parse(read("design/decisions.json")).decisions : [];
const results = [];
const rule = (id, title, how, items, { warn = false } = {}) => results.push({ id, title, how, items, ok: items.filter((i) => !i.ok).length === 0, warn });

// ── the scale ──
const { from: W0, to: W1 } = sc.range;
const LADDER = (() => { const out = [0]; for (const [step, upTo] of sc.ladder.steps) for (let v = out[out.length - 1] + step; v <= upTo; v += step) out.push(v); return out; })();

// R1 the ladder: both ends of every role, type and space, are on it (sizes of blocks excepted)
{
  const L = new Set(LADDER), items = [];
  for (const [name, r] of [...Object.entries(sc.type.roles), ...Object.entries(sc.space.roles)]) {
    if (r.size) continue;
    const off = r.px.filter((v) => !L.has(v));
    items.push({ ok: off.length === 0, text: `${name} ${r.px[0]} → ${r.px[1]}${off.length ? `: ${off.join(", ")} not on the ladder` : ""}` });
  }
  rule("ladder", "Every size ends on the ladder", `both ends of each type and space role are on the ladder (steps ${sc.ladder.steps.map(([s, u]) => `${s} to ${u}`).join(", ")}: ${LADDER.join(" ")})`, items);
}
// R2 the type levels keep their distance: every pair of type.relations at least relations.min apart at both ends
// (so at every size in between); the closest pair of all levels is shown too
{
  const R = sc.type.roles, rel = sc.type.relations, items = [];
  for (const [a, b] of rel.pairs) for (const [i, w] of [[0, W0], [1, W1]]) {
    const k = R[a].px[i] / R[b].px[i];
    items.push({ ok: k >= rel.min - 1e-9, text: `${a} / ${b} at ${w}: ${R[a].px[i]} / ${R[b].px[i]} = ×${k.toFixed(3)}` });
  }
  rule("type-relations", "Text levels keep their distance", `each pair in type.relations is at least ×${rel.min} apart at ${W0} and at ${W1}`, items);
}

// ── the CSS ──
const files = []; const walk = (d) => { for (const f of readdirSync(join(ROOT, d))) { const p = join(d, f); statSync(join(ROOT, p)).isDirectory() ? walk(p) : p.endsWith(".css") && files.push(p); } };
walk("src/styles");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));   // keep line numbers
const css = Object.fromEntries(files.map((f) => [f, strip(read(f))]));
const own = Object.entries(css).filter(([f]) => !/tokens(\.gen)?\.css$|media\.css$/.test(f));
const at = (src, idx) => src.slice(0, idx).split("\n").length;
const scan = (re, filter = () => true) => own.flatMap(([f, s]) => [...s.matchAll(re)].filter((m) => filter(m, f, s)).map((m) => ({ file: f.replace("src/styles/", ""), line: at(s, m.index), text: m[0].trim().slice(0, 90) })));
// blocks sized by the screen or by their own box (geometry), and the drawings
const GEOMETRY = /^(art\/)|hero\.css|stack\.css/;
const lineOf = (f, n) => (css["src/styles/" + f] || "").split("\n")[n - 1] || "";

// R3 spacing, radii and type come from the scale; only block sizes may follow the screen or the block (geometry)
{
  const PROPS = /^(padding|margin|gap|row-gap|column-gap|border-radius|font-size|letter-spacing|line-height)(-[a-z-]+)?$/;
  const items = [];
  for (const [f, s] of own) for (const m of s.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/g)) {
    if (!PROPS.test(m[1])) continue;
    const v = m[2];
    const raw = /\d*\.?\d+(vw|vh|svh|dvh|cqw|cqh|cqi)/.test(v) || /clamp\(/.test(v);
    if (!raw) continue;
    const capOfToken = /^(min|max)\(var\(--[\w-]+\),\s*\d+vh\)$/.test(v.trim());   // a scale size capped so a pinned block fits the screen
    items.push({ ok: capOfToken, text: `${f.replace("src/styles/", "")}:${at(s, m.index)}  ${m[1]}: ${v.trim().slice(0, 70)}${capOfToken ? "   (capped by the screen: the pinned logos must fit it)" : ""}` });
  }
  rule("fluid-from-scale", "Spacing, radii and type come from the scale", "padding, margin, gap, radius, font-size, tracking and line-height never use vw / vh / cqw or a clamp() of their own (block sizes may: that is geometry, a block sized by the screen or by its own box)", items.length ? items : [{ ok: true, text: "none found" }]);
}
// R4 colours from tokens
{
  const hits = scan(/#[0-9a-f]{3,8}\b|rgba?\([\d\s,./%]+\)/gi, (m, f) => !/art\//.test(f));
  const items = hits.map((h) => { const l = lineOf(h.file, h.line); return { ok: /box-shadow|shadow|gradient\(|mask|transparent/.test(l), text: `${h.file}:${h.line}  ${l.trim().slice(0, 100)}` }; });
  rule("colour-tokens", "Colours come from tokens", "no literal colour outside the drawings; shadows and gradients may use literal greys", items);
}
// R5 type from the scale
{
  const hits = scan(/font-size:\s*[^;]+/g);
  const items = hits.map((h) => ({ ok: /var\(--type-|em\b|var\(--u\)|--hero-title|--cta-title|--card-title|inherit|1em|\* var\(--u\)|calc\(\d+ \* var\(--u\)\)/.test(h.text) || GEOMETRY.test(h.file) && /--u|var\(/.test(h.text), text: `${h.file}:${h.line}  ${h.text}` }));
  const fixedOk = items.filter((i) => !i.ok && /sections\.css/.test(i.text) && /24px|13px/.test(i.text));
  fixedOk.forEach((i) => { i.ok = true; i.text += "   (the ID card: an object of a fixed size, design/decisions.json)"; });
  rule("type-from-scale", "Text sizes come from the type scale", "every font-size is a type/* role, em, or relative to its tile (--u) / drawing", items);
}
// R6 every var() is defined, every token is used
{
  const all = Object.values(css).join("\n") + read("src/index.html") + readdirSync(join(ROOT, "src/scripts"), { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => read(join("src/scripts", f))).join("\n");
  const defined = new Set([...all.matchAll(/(--[a-z][\w-]*)\s*:/g)].map((m) => m[1]));
  ["--fm-vh", "--fm-svh", "--rest", "--d", "--deck", "--steps", "--cap-max", "--rc-angle", "--rc-radius", "--rc-corner", "--rc-fade", "--rc-fade-color", "--stack-step", "--stack-page", "--btn-hover"].forEach((v) => defined.add(v));
  const used = [...all.matchAll(/var\((--[\w-]+)(\s*,)?/g)];
  const undefinedRefs = [...new Set(used.filter((m) => !m[2] && !defined.has(m[1])).map((m) => m[1]))];
  const gen = read("src/styles/base/tokens.gen.css") + read("src/styles/base/tokens.css");
  const tokensDeclared = [...new Set([...strip(gen).matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]))];
  const unused = tokensDeclared.filter((t) => !new RegExp(`var\\(${t}[,)\\s]`).test(all.replace(/^\s*--[\w-]+:/gm, "")) && t !== "--vp");
  rule("tokens-wired", "Every token is used, every var() exists", "a var(--x) without a fallback must be defined somewhere; a token nobody reads is dead weight", [
    ...undefinedRefs.map((v) => ({ ok: false, text: `var(${v}) is never defined` })),
    // a step of the ink / paper ladders (Figma colour variables) may stay unused: the ladder is the token
    ...unused.map((v) => /^--(ink|paper)-\d+$/.test(v) ? { ok: true, text: `${v}: a step of a colour ladder, unused for now` } : { ok: false, text: `${v} is declared but never used` }),
    { ok: true, text: `${tokensDeclared.length} tokens declared, ${used.length} var() references` }]);
}
// R7 one value per decision: no copies of a derived value
{
  const copies = [["navbar height", /var\(--nav-pad-y\)\s*\*\s*2/g], ["32px controls", /\b32px\b/g]];
  const items = [];
  for (const [label, re] of copies) for (const h of scan(re)) items.push({ ok: label === "32px controls" ? !/nav\.css|button\.css|404\.css/.test(h.file) || /--nav-control/.test(h.text) : false, text: `${label}: ${h.file}:${h.line}` });
  rule("single-source", "A derived value is written once", "the navbar height is --nav-h, its controls --nav-control: no copy of the formula or of 32px in navbar parts", items.length ? items : [{ ok: true, text: "no copies" }]);
}
// R9 no rule swallowed by a comment (an unclosed /* runs on to the next */ and silently drops everything between)
{
  const items = [];
  for (const f of files) { const raw = read(f); for (const m of raw.matchAll(/\/\*[\s\S]*?\*\//g)) if (/\n\s*[.#:\w&@][^\n{]*\{[^}]*:[^}]*;/.test(m[0])) items.push({ ok: false, text: `${f.replace("src/styles/", "")}:${raw.slice(0, m.index).split("\n").length}  a comment contains CSS rules (is a */ missing?)` }); }
  rule("no-swallowed-css", "No CSS hidden inside a comment", "a comment that contains rules usually means an earlier */ is missing: the rules in it never reach the page", items.length ? items : [{ ok: true, text: "none" }]);
}
// R9 layout steps: a block changes its layout by its column's width only at the shared steps (S, M, L); a step of its
// own is an exception written in design/decisions.json, or a component that switches by fit (in em, or a small part)
{
  const STEPS = { "22rem": "S", "43rem": "M", "58rem": "L" };
  const OWN = { "35rem": "the ID cards' deck (decisions: id-card-object)", "10em": "the hero title: two lines or three, by fit", "400px": "the video card's logo: full or short mark, by fit", "32rem": "a royalty card by its own shape (decisions: royalty-by-shape)" };
  const hits = scan(/@container\s*([\w-]*)\s*\(width\s*[<>]=?\s*([\d.]+(?:rem|em|px))\)/g);
  const items = hits.map((h) => { const v = h.text.match(/([\d.]+(?:rem|em|px))\)/)[1]; const step = STEPS[v], own = OWN[v];
    return { ok: !!(step || own), text: `${h.file}:${h.line}  ${h.text}${step ? `   (step ${step})` : own ? `   (${own})` : "   — not a shared step"}` }; });
  rule("layout-steps", "Layouts change at the shared steps", "container width conditions use S 22rem, M 43rem or L 58rem; any other is written down", items);
}
// R8 decisions are complete
{
  const items = decisions.map((d) => { const miss = ["what", "decided", "why"].filter((k) => !d[k]).concat(d.kind === "exception" && !d.rule ? ["rule"] : []); return { ok: miss.length === 0, text: `${d.kind} ${d.id}${miss.length ? ": missing " + miss.join(", ") : ""}` }; });
  rule("decisions", "Every departure is written down", "each entry of design/decisions.json says what, which rule, who decided when, and why", items);
}

if (JSON_OUT) { console.log(JSON.stringify(results, null, 1)); process.exit(0); }
let failed = 0;
for (const r of results) {
  const bad = r.items.filter((i) => !i.ok);
  console.log(`${bad.length ? "✗" : "✓"} ${r.title}  (${r.id})`);
  console.log(`    ${r.how}`);
  for (const i of bad.slice(0, 12)) console.log(`    ✗ ${i.text}`);
  if (bad.length > 12) console.log(`    … ${bad.length - 12} more`);
  if (!bad.length) console.log(`    ${r.items.length} checked`);
  failed += bad.length;
}
console.log(failed ? `\n${failed} problem(s)` : "\nAll rules hold.");
process.exitCode = failed ? 1 : 0;
