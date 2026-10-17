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

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const at = (p) => resolve(root, p);
const TOKENS = at("design/tokens.json"), LOCK = at("design/tokens.lock.json"), MAP = at("design/figma-map.json");
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
    }
  }
  return flat;
}
function unflatten(flat, collections, order) {
  const doc = { collections, tokens: {} };
  const keys = [...flat.keys()].sort((a, b) => (order.get(a.split(SEP).slice(0, 2).join(SEP)) ?? 1e9) - (order.get(b.split(SEP).slice(0, 2).join(SEP)) ?? 1e9));
  for (const key of keys) {
    const [col, name, field, mode] = key.split(SEP);
    const t = ((doc.tokens[col] ??= {})[name] ??= { type: undefined });
    if (field === "value" && mode !== undefined) (t.value ??= {})[mode] = flat.get(key);
    else t[field] = flat.get(key);
  }
  return doc;
}

// tokens.json is written one variable per line, so a change shows up in git as one line
function format(doc) {
  const lines = ["{", `  "collections": ${JSON.stringify(doc.collections)},`, `  "tokens": {`];
  const cols = Object.entries(doc.tokens);
  cols.forEach(([col, vars], i) => {
    lines.push(`    ${JSON.stringify(col)}: {`);
    const entries = Object.entries(vars);
    entries.forEach(([name, t], j) => {
      const { type, value, web, description } = t;                    // fixed field order
      const o = { type, value, ...(web !== undefined && { web }), ...(description && { description }) };
      lines.push(`      ${JSON.stringify(name)}: ${JSON.stringify(o)}${j < entries.length - 1 ? "," : ""}`);
    });
    lines.push(`    }${i < cols.length - 1 ? "," : ""}`);
  });
  lines.push("  }", "}", "");
  return lines.join("\n");
}

// ── CSS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function cssValue(type, v) {
  if (type === "number") return v === 0 ? "0" : `${v}px`;
  const h = normColor(v).slice(1);
  if (h.length === 6) return "#" + h;
  const [r, g, b, a] = [0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${r} ${g} ${b} / ${Math.round((a / 255) * 100) / 100})`;
}
export function generate(doc = read(TOKENS), map = read(MAP)) {
  const rootDecls = [], layers = new Map(), skipped = [];
  for (const [col, vars] of Object.entries(doc.tokens)) {
    const modes = doc.collections[col]?.modes || [];
    const cfg = map.modes[col];
    for (const [name, t] of Object.entries(vars)) {
      const m = /^var\((--[\w-]+)\)$/.exec(t.web || "");
      if (!m) continue;
      if (t.type !== "color" && t.type !== "number") { skipped.push(`${col}/${name}`); continue; }
      const prop = m[1];
      if (modes.length <= 1) { rootDecls.push(`  ${prop}: ${cssValue(t.type, t.value)};`); continue; }
      if (!cfg) throw new Error(`design/figma-map.json has no screen widths for the modes of "${col}"`);
      rootDecls.push(`  ${prop}: ${cssValue(t.type, t.value[cfg.base])};`);
      for (const l of cfg.layers) {
        if (same(t.value[l.mode], t.value[l.parent])) continue;
        if (!layers.has(l.media)) layers.set(l.media, []);
        layers.get(l.media).push(`    ${prop}: ${cssValue(t.type, t.value[l.mode])};`);
      }
    }
  }
  const order = Object.entries(map.modes).filter(([k]) => !k.startsWith("$")).map(([, c]) => c).flatMap((c) => c.layers.map((l) => l.media));
  const out = [
    "/* GENERATED by build/tokens.mjs from design/tokens.json: do not edit here. Change design/tokens.json (or the variable",
    "   in Figma and sync), then `npm run tokens`. The build runs it too. Variables reach this file when their Web code",
    "   syntax is var(--name). */",
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
  const merged = new Map(), lock = new Map(B), report = { pulled: [], pushed: [], conflicts: [] };
  const keys = new Set([...C.keys(), ...F.keys(), ...B.keys()]);
  for (const k of keys) {
    const c = C.get(k), f = F.get(k), b = B.get(k);
    const put = (m, v) => (v === undefined ? m.delete(k) : m.set(k, v));
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
  writeFileSync(TOKENS, format(unflatten(merged, collections, order)));
  writeFileSync(LOCK, format(unflatten(lock, { ...base.collections, ...collections }, order)));
  const gen = generate();

  // the push script: only what changed in the code
  const changes = report.pushed.map(([k, , v]) => {
    const [collection, name, field, mode] = k.split(SEP);
    const type = merged.get([collection, name, "type"].join(SEP));
    return { collection, name, field, mode, type, value: v === undefined ? null : v };
  });
  if (changes.length) writeFileSync(PUSH, readFileSync(PUSH_TPL, "utf8").replace("/*CHANGES*/[]", JSON.stringify(changes, null, 1)));
  else if (existsSync(PUSH)) writeFileSync(PUSH, "// nothing to push: Figma already holds every value of design/tokens.json\nreturn { changed: 0 };\n");

  const show = (k) => k.split(SEP).filter((x, i) => i !== 2 || x !== "value").join(" › ").replace(/ › (\d+)$/, " @$1");
  const val = (v) => (v === undefined ? "—" : JSON.stringify(v));
  console.log(`Figma → code: ${report.pulled.length} value(s)`);
  for (const [k, a, b] of report.pulled) console.log(`  ${show(k)}: ${val(a)} → ${val(b)}`);
  console.log(`Code → Figma: ${report.pushed.length} value(s)${changes.length ? "  → run design/figma/push.gen.js with use_figma, then pull and sync again" : ""}`);
  for (const [k, a, b] of report.pushed) console.log(`  ${show(k)}: ${val(a)} → ${val(b)}`);
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
  sync(resolve(file), flag === "--prefer" ? prefer : undefined);
} else if (!cmd || cmd === "css") {
  const r = generate();
  console.log(`tokens: ${r.vars} CSS variables → src/styles/base/tokens.gen.css`);
} else throw new Error(`unknown command "${cmd}"`);
