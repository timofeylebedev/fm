// Design tokens: one file (design/tokens.json) shared by the code and the Figma file.
//
//   node build/tokens.mjs            → writes src/styles/base/tokens.gen.css from design/tokens.json (npm run tokens)
//   node build/tokens.mjs sync FILE  → three-way merge of the code (design/tokens.json), Figma (FILE, the output of
//                                      design/figma/pull.js) and the last sync (design/tokens.lock.json)   (npm run tokens:sync)
//   node build/tokens.mjs sync FILE --prefer figma|code   → settle conflicts one way
//
// The merge works value by value (one variable, one field, one mode): what changed on one side only is taken from that
// side; the same change on both sides is fine; different changes on both sides are conflicts and are left alone.
// Changes from Figma are written into tokens.json (and the CSS). Changes from the code are written into
// design/figma/push.gen.js, a script for the Figma MCP tool `use_figma` that touches only those values.
// The lock records a value only once both sides hold it, so a push that never ran is pushed again next time.
//
// A variable is used by the code when its "web" (Figma: code syntax → Web) is var(--name): then it is written into the
// CSS as --name. Colours and numbers only; font names stay in tokens.css with their fallbacks.
//
// Sizes come from design/scale.json (the size system: one range, a type ladder, a space ladder). `npm run tokens` first
// writes every size of the scale into tokens.json, at each Breakpoint mode (its value on a screen of that width), so
// Figma holds the same numbers; then it writes the CSS, where each size is one formula: its value on a 320px screen,
// its value on a 1440px one, a straight line in between, on the screen's size (--vp: the width, or twice the height
// minus 400px if that is smaller). Those variables carry "scale": true in tokens.json (a field of the code only): Figma
// does not change them — a different value there is reported by the sync and the scale's value is kept.
// Type sizes (type/*) are written in rem, so they follow the size the visitor chose for text in the browser.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const at = (p) => resolve(root, p);
const SCALE = at("design/scale.json"), TOKENS = at("design/tokens.json"), LOCK = at("design/tokens.lock.json"), MAP = at("design/figma-map.json");
const CSS = at("src/styles/base/tokens.gen.css"), PUSH = at("design/figma/push.gen.js"), PUSH_TPL = at("design/figma/push.js");

const read = (f) => JSON.parse(readFileSync(f, "utf8"));

// ── values ────────────────────────────────────────────────────────────────────────────────────────────────────────
// colours as lower-case #rrggbb or #rrggbbaa (no "ff" alpha), so the same colour is always written the same way
function normColor(v) {
  if (typeof v !== "string" || !v.startsWith("#")) return v;
  let h = v.slice(1).toLowerCase();
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  if (h.length === 8 && h.endsWith("ff")) h = h.slice(0, 6);
  return "#" + h;
}
const norm = (type, v) => (type === "color" ? normColor(v) : type === "number" && typeof v === "number" ? Math.round(v * 100) / 100 : v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── flat form: "Collection␟name␟field[␟mode]" → value ─────────────────────────────────────────────────────────────
const SEP = "␟";
function flatten(doc) {
  const flat = new Map();
  for (const [col, vars] of Object.entries(doc.tokens || {})) {
    const modes = doc.collections?.[col]?.modes || [];
    for (const [name, t] of Object.entries(vars)) {
      const k = (...p) => [col, name, ...p].join(SEP);
      flat.set(k("type"), t.type);
      if (modes.length > 1 && t.value && typeof t.value === "object" && !("alias" in t.value)) {
        for (const [m, v] of Object.entries(t.value)) flat.set(k("value", m), norm(t.type, v));
      } else flat.set(k("value"), norm(t.type, t.value));
      if (t.web !== undefined) flat.set(k("web"), t.web);
      if (t.description) flat.set(k("description"), t.description);
      // "fluid" and "scale" are the code's own business (how the CSS reads the value): they are not merged with Figma
    }
  }
  return flat;
}
// code: the code's tokens.json, whose code-only fields ("fluid") are put back on the variables that are still there
function unflatten(flat, collections, order, code) {
  const doc = { collections, tokens: {} };
  const keys = [...flat.keys()].sort((a, b) => (order.get(a.split(SEP).slice(0, 2).join(SEP)) ?? 1e9) - (order.get(b.split(SEP).slice(0, 2).join(SEP)) ?? 1e9));
  for (const key of keys) {
    const [col, name, field, mode] = key.split(SEP);
    const t = ((doc.tokens[col] ??= {})[name] ??= { type: undefined });
    if (field === "value" && mode !== undefined) (t.value ??= {})[mode] = flat.get(key);
    else t[field] = flat.get(key);
  }
  if (code) for (const [col, vars] of Object.entries(doc.tokens)) for (const [name, t] of Object.entries(vars)) {
    if (code.tokens?.[col]?.[name]?.fluid) t.fluid = true;
    if (code.tokens?.[col]?.[name]?.scale) t.scale = true;
  }
  return doc;
}

// tokens.json is written one variable per line, so a change shows up in git as one line
export function format(doc) {
  const lines = ["{", `  "collections": ${JSON.stringify(doc.collections)},`, `  "tokens": {`];
  const cols = Object.entries(doc.tokens);
  cols.forEach(([col, vars], i) => {
    lines.push(`    ${JSON.stringify(col)}: {`);
    const entries = Object.entries(vars);
    entries.forEach(([name, t], j) => {
      const { type, value, web, fluid, scale, description } = t;      // fixed field order
      const o = { type, value, ...(web !== undefined && { web }), ...(fluid && { fluid }), ...(scale && { scale }), ...(description && { description }) };
      lines.push(`      ${JSON.stringify(name)}: ${JSON.stringify(o)}${j < entries.length - 1 ? "," : ""}`);
    });
    lines.push(`    }${i < cols.length - 1 ? "," : ""}`);
  });
  lines.push("  }", "}", "");
  return lines.join("\n");
}

// ── CSS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const r4 = (n) => Math.round(n * 10000) / 10000;
const len = (v, rem) => (v === 0 ? "0px" : rem ? `${r4(v / 16)}rem` : `${v}px`);
// a fluid number between two screen widths: v0 at w0, v1 at w1, a straight line in between, constant outside
function fluidValue(v0, w0, v1, w1, rem) {
  if (v1 === undefined || v0 === v1) return len(v0, rem);
  const slope = r4((v1 - v0) / (w1 - w0));
  // the screen width it starts from in rem, as the steps of media.css are in em: the same at the usual 16px, and with
  // bigger text the line starts where its step does, so sizes still do not jump from one step to the next
  return `clamp(${len(Math.min(v0, v1), rem)}, calc(${len(v0, rem)} + (100vw - ${r4(w0 / 16)}rem) * ${slope}), ${len(Math.max(v0, v1), rem)})`;
}
function cssValue(type, v, rem) {
  if (type === "number") return v === 0 ? "0" : rem ? len(v, true) : `${v}px`;
  const h = normColor(v).slice(1);
  if (h.length === 6) return "#" + h;
  const [r, g, b, a] = [0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${r} ${g} ${b} / ${Math.round((a / 255) * 100) / 100})`;
}

// ── the scale (design/scale.json) ─────────────────────────────────────────────────────────────────────────────────
// Every role of the scale as two numbers: its value on a screen of range.from and on one of range.to (px).
export function scaleRoles(sc = read(SCALE)) {
  const roles = [];
  const { base, ratio } = sc.type;
  for (const [name, r] of Object.entries(sc.type.roles)) {
    const [s0, s1] = r.steps;
    roles.push({ name, kind: "type", steps: r.steps, from: base * ratio.from ** s0, to: base * ratio.to ** s1,
      css: r.css || "--" + name.replace("/", "-"), use: r.use });
  }
  for (const [name, r] of Object.entries(sc.space.roles)) {
    roles.push({ name, kind: r.size ? "size" : "space", from: r.px[0], to: r.px[1], css: r.css, use: r.use });
  }
  return roles;
}
// a role's value on a screen of size vp (px): a straight line between the two ends, constant outside
export const scaleAt = (role, vp, range) => {
  const k = Math.min(1, Math.max(0, (vp - range.from) / (range.to - range.from)));
  return role.from + (role.to - role.from) * k;
};
// the CSS: clamp(least, value at the start + (screen size − start) × slope, most); the range in rem (see media.css)
function scaleCss(role, range) {
  const rem = role.kind === "type";
  const v0 = role.from, v1 = role.to;
  if (Math.abs(v1 - v0) < 1e-6) return len(r4(v0), rem);
  const slope = r4((v1 - v0) / (range.to - range.from));
  const L = (v) => len(rem ? v : r4(v), rem);
  return `clamp(${L(Math.min(v0, v1))}, calc(${L(v0)} + (var(--vp) - ${r4(range.from / 16)}rem) * ${slope}), ${L(Math.max(v0, v1))})`;
}
// writes the scale into tokens.json (Breakpoint: the value at each mode's width); returns true when it changed
export function applyScale(doc = read(TOKENS), sc = read(SCALE)) {
  const col = "Breakpoint", vars = doc.tokens[col], modes = doc.collections[col].modes;
  const before = format(doc);
  for (const role of scaleRoles(sc)) {
    const old = vars[role.name] || {};
    const value = Object.fromEntries(modes.map((m) => [m, Math.round(scaleAt(role, Number(m), sc.range) * 100) / 100]));
    const description = role.use ? role.use + (role.kind === "type" ? ` (scale steps ${role.steps[0]} → ${role.steps[1]})` : ` (${role.from} → ${role.to})`) : old.description;
    vars[role.name] = { type: "number", value, web: `var(${role.css})`, scale: true, ...(description && { description }) };
  }
  for (const [alias, target] of Object.entries(sc.type.aliases || {})) {
    if (alias.startsWith("$")) continue;
    vars[alias] = { type: "number", value: { alias: target }, description: `the same as ${target} (kept for the Figma text styles; the site uses ${target})` };
  }
  const changed = format(doc) !== before;
  if (changed) writeFileSync(TOKENS, format(doc));
  return changed;
}

export function generate(doc = read(TOKENS), map = read(MAP), sc = read(SCALE)) {
  const rootDecls = [], layers = new Map(), skipped = [];
  const roles = new Map(scaleRoles(sc).map((r) => [r.name, r]));
  const { times, minus } = sc.range.height;
  rootDecls.push(`  /* the screen's size for every size below: its width, or ${times} × its height − ${minus}px if that is smaller (design/scale.json) */`);
  rootDecls.push(`  --vp: min(100vw, var(--screen) * ${times} - ${r4(minus / 16)}rem);`);
  for (const [k, v] of Object.entries(sc.type.lineHeight)) rootDecls.push(`  --lh-${k}: ${v};`);
  for (const [k, v] of Object.entries(sc.type.tracking)) rootDecls.push(`  --tracking-${k}: ${v};`);
  for (const [col, vars] of Object.entries(doc.tokens)) {
    const modes = doc.collections[col]?.modes || [];
    const cfg = map.modes[col];
    for (const [name, t] of Object.entries(vars)) {
      const m = /^var\((--[\w-]+)\)$/.exec(t.web || "");
      if (!m) continue;
      if (t.type !== "color" && t.type !== "number") { skipped.push(`${col}/${name}`); continue; }
      if (t.value && typeof t.value === "object" && "alias" in t.value) { skipped.push(`${col}/${name}`); continue; }   // an alias: Figma only
      const prop = m[1], rem = t.type === "number" && name.startsWith("type/");
      if (t.scale && roles.has(name)) { rootDecls.push(`  ${prop}: ${scaleCss(roles.get(name), sc.range)};`); continue; }
      if (modes.length <= 1) { rootDecls.push(`  ${prop}: ${cssValue(t.type, t.value, rem)};`); continue; }
      if (!cfg) throw new Error(`design/figma-map.json has no screen widths for the modes of "${col}"`);
      // what a mode's media holds: its value, or (fluid) the line from its width to the next wider mode's width
      const widths = modes.map(Number).sort((a, b) => a - b);
      const at = (mode) => {
        if (!(t.fluid && t.type === "number")) return cssValue(t.type, t.value[mode], rem);
        const w0 = Number(mode), w1 = widths.find((w) => w > w0);
        return fluidValue(t.value[mode], w0, w1 === undefined ? undefined : t.value[String(w1)], w1, rem);
      };
      rootDecls.push(`  ${prop}: ${at(cfg.base)};`);
      for (const l of cfg.layers) {
        if (at(l.mode) === at(l.parent)) continue;
        if (!layers.has(l.media)) layers.set(l.media, []);
        layers.get(l.media).push(`    ${prop}: ${at(l.mode)};`);
      }
    }
  }
  const order = Object.entries(map.modes).filter(([k]) => !k.startsWith("$")).map(([, c]) => c).flatMap((c) => c.layers.map((l) => l.media));
  const out = [
    "/* GENERATED by build/tokens.mjs from design/scale.json (sizes) and design/tokens.json (colours): do not edit here.",
    "   Change those files (colours also in Figma, then sync), then `npm run tokens`; the build runs it too.",
    "   Every size: clamp(least, its value at 320 + (screen size − 320) × slope, most), the screen size being --vp. */",
    "", ":root {", ...rootDecls, "}",
  ];
  for (const media of order) if (layers.has(media)) out.push("", `@media (${media}) {`, "  :root {", ...layers.get(media), "  }", "}");
  out.push("");
  writeFileSync(CSS, out.join("\n"));
  return { vars: rootDecls.length, skipped };
}

// ── sync ──────────────────────────────────────────────────────────────────────────────────────────────────────────
function sync(figmaFile, prefer) {
  const code = read(TOKENS), figmaDoc = read(figmaFile);
  const base = existsSync(LOCK) ? read(LOCK) : { collections: {}, tokens: {} };
  const C = flatten(code), F = flatten(figmaDoc), B = flatten(base);
  const ALIASES = new Set(Object.keys(read(SCALE).type.aliases || {}).filter((n) => !n.startsWith("$")));
  const merged = new Map(), lock = new Map(B), report = { pulled: [], pushed: [], conflicts: [] };
  const keys = new Set([...C.keys(), ...F.keys(), ...B.keys()]);
  for (const k of keys) {
    const c = C.get(k), f = F.get(k), b = B.get(k);
    const put = (m, v) => (v === undefined ? m.delete(k) : m.set(k, v));
    const [kc, kn, kf] = k.split(SEP);
    // a size of the scale, or an alias the scale keeps for the Figma text styles: written by design/scale.json, so the
    // code decides every field of it. A value Figma has for a mode the code holds as one alias is dropped (the alias
    // is pushed for every mode instead)
    if ((code.tokens?.[kc]?.[kn]?.scale || ALIASES.has(kn)) && !same(c, f)) {
      put(merged, c); if (c !== undefined) report.pushed.push([k, f, c]); (report.scaleKept ??= []).push([k, f, c]); continue;
    }
    if (same(c, f)) { put(merged, c); put(lock, c); }
    else if (same(c, b)) { put(merged, f); put(lock, f); report.pulled.push([k, c, f]); }
    else if (same(f, b)) { put(merged, c); report.pushed.push([k, f, c]); }
    else if (prefer === "figma") { put(merged, f); put(lock, f); report.pulled.push([k, c, f]); }
    else if (prefer === "code") { put(merged, c); report.pushed.push([k, f, c]); }
    else { put(merged, c); report.conflicts.push([k, b, c, f]); }
  }
  // keep the order of tokens.json; new variables from Figma go where Figma has them, at the end
  const order = new Map();
  for (const d of [code, figmaDoc]) for (const [col, vars] of Object.entries(d.tokens)) for (const n of Object.keys(vars)) {
    const id = col + SEP + n; if (!order.has(id)) order.set(id, order.size);
  }
  const collections = { ...figmaDoc.collections, ...code.collections };
  writeFileSync(TOKENS, format(unflatten(merged, collections, order, code)));
  // the lock records the modes Figma holds: once a push has made Figma's modes match the code's, they are recorded too
  const lockCollections = { ...base.collections, ...figmaDoc.collections };
  writeFileSync(LOCK, format(unflatten(lock, lockCollections, order)));
  const gen = generate();

  // modes the code has and Figma does not (or the other way): the push adds them, renames them (design/figma-map.json
  // "renamed": old name → new name, so frames that use a mode keep it under its new name) and removes the old ones
  const map = read(MAP), modes = {};
  for (const [col, c] of Object.entries(code.collections)) {
    const f = figmaDoc.collections?.[col]?.modes || [];
    if (!same(c.modes, f)) modes[col] = { modes: c.modes, rename: map.modes?.[col]?.renamed || {} };
  }

  // the push script: only what changed in the code
  const changes = report.pushed.map(([k, , v]) => {
    const [collection, name, field, mode] = k.split(SEP);
    const type = merged.get([collection, name, "type"].join(SEP));
    return { collection, name, field, mode, type, value: v === undefined ? null : v };
  });
  if (changes.length || Object.keys(modes).length) writeFileSync(PUSH, readFileSync(PUSH_TPL, "utf8")
    .replace("/*MODES*/{}", JSON.stringify(modes, null, 1)).replace("/*CHANGES*/[]", JSON.stringify(changes, null, 1)));
  else if (existsSync(PUSH)) writeFileSync(PUSH, "// nothing to push: Figma already holds every value of design/tokens.json\nreturn { changed: 0 };\n");

  const show = (k) => k.split(SEP).filter((x, i) => i !== 2 || x !== "value").join(" › ").replace(/ › (\d+)$/, " @$1");
  const val = (v) => (v === undefined ? "—" : JSON.stringify(v));
  console.log(`Figma → code: ${report.pulled.length} value(s)`);
  for (const [k, a, b] of report.pulled) console.log(`  ${show(k)}: ${val(a)} → ${val(b)}`);
  for (const [col, m] of Object.entries(modes)) console.log(`Modes of ${col}: Figma ${JSON.stringify(figmaDoc.collections?.[col]?.modes || [])} → code ${JSON.stringify(m.modes)} (the push changes them)`);
  console.log(`Code → Figma: ${report.pushed.length} value(s)${changes.length ? "  → run design/figma/push.gen.js with use_figma, then pull and sync again" : ""}`);
  for (const [k, a, b] of report.pushed) console.log(`  ${show(k)}: ${val(a)} → ${val(b)}`);
  if (report.scaleKept?.length) console.log(`Sizes of the scale (design/scale.json) that differ in Figma: ${report.scaleKept.length}. The scale's value is kept and pushed; to change a size, change design/scale.json.`);
  if (report.conflicts.length) {
    console.log(`CONFLICTS: ${report.conflicts.length} (changed on both sides; tokens.json keeps the code's value, nothing pushed). Settle with --prefer figma|code, or edit tokens.json and sync again.`);
    for (const [k, b, c, f] of report.conflicts) console.log(`  ${show(k)}: was ${val(b)}, code ${val(c)}, Figma ${val(f)}`);
  }
  console.log(`CSS: ${gen.vars} variables in src/styles/base/tokens.gen.css`);
  if (report.conflicts.length) process.exitCode = 2;
}

const [cmd, file, flag, prefer] = process.argv.slice(2);
if (cmd === "sync") {
  if (!file) throw new Error("usage: node build/tokens.mjs sync design/figma/export.json [--prefer figma|code]");
  applyScale();
  sync(resolve(file), flag === "--prefer" ? prefer : undefined);
} else if (!cmd || cmd === "css") {
  const changed = applyScale();
  const r = generate();
  console.log(`tokens: ${r.vars} CSS variables → src/styles/base/tokens.gen.css${changed ? " (design/tokens.json updated from design/scale.json)" : ""}`);
} else throw new Error(`unknown command "${cmd}"`);
