// The rules measured on the rendered page: what the browser drew (a record of measure.mjs) against the system
// (design/scale.json, design/tokens.json). Each rule says what it measures, how strict it is and why.
//
// Kinds of rule (how a result becomes pass / warn / fail):
//   hard        any item fails the rule                                   (sideways scroll, a missing alt, a broken link)
//   share       a share of the uses must follow the rule; below `pass` it warns, below `warn` it fails
//   tolerance   each item must stay inside a band; outside it warns (soft) or fails (`fail` set)
//   convention  a count (distinct values) should stay small; above it warns
//   trend       a number compared with the record before (the last deploy of main); worse by more than `by` warns
//   scenario    a row of the logic table, played in a browser
//   inventory   no verdict: what there is, so it can be looked at
// A rule never decides intent: an item a decision covers (design/decisions.json, `checks`) is "accepted", printed with
// its value on every run, and comes back to "what needs you" when that value leaves the decision's band.
export const KINDS = {
  hard: "any item is a failure",
  share: "a share of the uses must follow the rule",
  tolerance: "each item inside a band",
  convention: "a count that should stay small",
  trend: "compared with the last deploy",
  scenario: "played in a browser",
  inventory: "what there is, no verdict",
};

const r2 = (v) => Math.round(v * 100) / 100;
const pct = (v) => Math.round(v * 1000) / 10;
const sizeKey = (k) => { const [w, h] = k.split("x").map(Number); return { w, h }; };
const hexRgba = (v) => { const m = String(v).match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i); if (!m) return null; const n = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)); return [...n, m[2] ? r2(parseInt(m[2], 16) / 255) : 1]; };
const sameColour = (a, b) => a.slice(0, 3).every((x, i) => Math.abs(x - b[i]) <= 1.5) && Math.abs(a[3] - b[3]) <= 0.015;

// a role's size on a screen (as build/tokens.mjs writes it): a line between the ends at 320 and 1440 over the screen's
// size, which is min(width, what its height allows); `by: "width"` follows the width alone; `per` follows a block
export function roleAt(scale, role, w, h) {
  const R = scale.range, H = R.height;
  const vp = role.by === "width" ? w : Math.min(w, R.from + (h - H.from) * (R.to - R.from) / (H.to - H.from));
  const k = Math.max(0, Math.min(1, (vp - R.from) / (R.to - R.from)));
  return role.px[0] + (role.px[1] - role.px[0]) * k;
}

// the step of measure.mjs each rule's input comes from (a rule whose step failed or did not run cannot say anything)
export const STEP_OF = (id) => /^(type|colour|fills|shape|effects|layers|align|ratios|icons|images|states|components)\./.test(id) ? "sizes"
  : /^fallback\./.test(id) ? "modes" : /^privacy\./.test(id) ? "privacy" : /^logic\./.test(id) ? "scenarios" : /^weight\./.test(id) ? "weight" : /^health\./.test(id) ? "pages" : null;

export function measuredRules({ rec, prev, scale, tokens, cfg }) {
  const out = [];
  const rule = (o) => { out.push(o); return o; };
  const sizes = Object.keys(rec.at || {});
  const each = (fn) => sizes.flatMap((k) => fn(rec.at[k], k));

  // ── Type ──────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const roles = Object.entries(scale.type.roles);
    let on = 0, all = 0; const items = [];
    for (const k of sizes) {
      const { w, h } = sizeKey(k), m = rec.at[k];
      const values = roles.map(([n, r]) => [n, roleAt(scale, r, w, h)]);
      for (const t of m.text) {
        if (t.object) continue;
        all += t.n;
        const hit = values.find(([, v]) => Math.abs(v - t.px) <= 0.6);
        if (hit) { on += t.n; continue; }
        const nearest = values.slice().sort((a, b) => Math.abs(a[1] - t.px) - Math.abs(b[1] - t.px))[0];
        items.push({ key: `${t.where[0]}|${t.px}`, where: t.where.slice(0, 3).join(", "), what: `${t.px}px ${t.family} ${t.weight}`, value: t.px, n: t.n, at: k, note: `nearest role ${nearest[0]} = ${r2(nearest[1])}px` });
      }
    }
    const share = all ? on / all : 1;
    rule({ id: "type.roles", area: "Type", kind: "share", title: "Text is set in the roles of the scale",
      how: "Every text holder at every measured size: its size against each role of design/scale.json at that screen (±0.6px). Objects sized as a whole or fitted to their box (hero, CTA and stack titles, ID cards, tiles) are left out.",
      value: pct(share), unit: "% of text holders", on, total: all, pass: 97, warn: 90, status: share * 100 >= 97 ? "pass" : share * 100 >= 90 ? "warn" : "fail", items: dedupe(items) });
  }
  {
    const items = [], long = [];
    for (const k of sizes) for (const p of rec.at[k].typo) {
      const med = p.cpl.slice().sort((a, b) => a - b)[p.cpl.length >> 1];
      if (p.lines >= 3 && med > 90) long.push({ key: p.sel, where: p.sel, what: `${med} characters a line over ${p.lines} lines`, value: med, at: k });
      // a last line of one short word (a widow): the typesetter holds short words to the next; this checks its result
      if (p.last.words === 1 && p.last.chars <= 4) items.push({ key: p.sel + "|" + p.last.text, where: p.sel, what: `last line «${p.last.text}» alone`, value: p.last.chars, at: k });
    }
    rule({ id: "type.widows", area: "Type", kind: "tolerance", title: "No paragraph ends on one short word", how: "Every paragraph of 2+ lines at every measured size: its last line, word by word as drawn. A long word alone is fine; one of 4 letters or fewer is a widow.", value: dedupe(items).length, unit: "widows", status: items.length ? "warn" : "pass", items: dedupe(items) });
    rule({ id: "type.measure", area: "Type", kind: "tolerance", title: "Lines of running text are not too long", how: "Paragraphs of 3+ lines: the median characters a line, at most 90 (45–75 is the classic range; headings and short texts left out).", value: long.length, unit: "too long", status: long.length ? "warn" : "pass", items: dedupe(long) });
  }

  // ── Colour and fills ──────────────────────────────────────────────────────────────────────────────────────────
  {
    const palette = Object.entries(tokens.tokens.Color).map(([n, t]) => [n, hexRgba(t.value)]).filter(([, c]) => c);
    let on = 0, all = 0; const items = [];
    for (const k of sizes) for (const c of rec.at[k].colours) {
      all += c.n;
      const hit = palette.find(([, p]) => sameColour(c.rgba, p));
      if (hit) { on += c.n; continue; }
      items.push({ key: c.rgba.join(","), where: c.where.slice(0, 3).join(", "), what: `rgba(${c.rgba.join(", ")}) as ${Object.keys(c.props).join(", ")}`, value: c.n, n: c.n, at: k });
    }
    const share = all ? on / all : 1;
    rule({ id: "colour.palette", area: "Colour", kind: "share", title: "Every colour drawn is a token", how: "Every text, background, border and icon colour the browser drew (drawings and canvases left out) against the colours of design/tokens.json (±1.5 a channel, ±1.5% alpha).", value: pct(share), unit: "% of colour uses", on, total: all, pass: 99, warn: 95, status: share * 100 >= 99 ? "pass" : share * 100 >= 95 ? "warn" : "fail", items: dedupe(items) });
  }
  {
    const kinds = {};
    for (const k of sizes) for (const f of rec.at[k].fills) { const x = (kinds[f.kind] ||= { n: 0, where: new Set() }); x.n = Math.max(x.n, f.n); f.where.forEach((w) => x.where.add(w)); }
    rule({ id: "fills.kinds", area: "Fills", kind: "inventory", title: "Kinds of fill", how: "Backgrounds the browser drew, by kind: solid, see-through (alpha), gradient, picture.", items: Object.entries(kinds).map(([k, v]) => ({ key: k, where: [...v.where].slice(0, 6).join(", "), what: k, value: v.n })) });
  }

  // ── Shape ─────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const radiusRoles = Object.entries(scale.space.roles).filter(([n]) => n.startsWith("radius/"));
    const objects = cfg.objectRadii || [];
    let on = 0, all = 0; const items = [];
    for (const k of sizes) {
      const { w, h } = sizeKey(k), values = radiusRoles.map(([n, r]) => [n, roleAt(scale, r, w, h)]);
      for (const r of rec.at[k].radii) {
        all += r.n;
        if (r.pill || values.some(([, v]) => Math.abs(v - r.px) <= 0.6) || objects.some((o) => r.sel.includes(o))) { on += r.n; continue; }
        items.push({ key: r.sel + "|" + r.px, where: r.sel, what: `radius ${r.px}px on a ${Math.round(r.w)}×${Math.round(r.h)} box`, value: r.px, n: r.n, at: k, note: `roles here: ${values.map(([n, v]) => n.slice(7) + " " + r2(v)).join(", ")}` });
      }
    }
    const share = all ? on / all : 1;
    rule({ id: "shape.radii", area: "Shape", kind: "share", title: "Corners are radius roles (or pills)", how: "Every rounded box: its corner against radius/s, m, l at that screen (±0.6px), a pill (half its height), or a listed object. Inner corners (outer − inset) show up here as their own values.", value: pct(share), unit: "% of rounded boxes", on, total: all, pass: 90, warn: 75, status: share * 100 >= 90 ? "pass" : share * 100 >= 75 ? "warn" : "fail", items: dedupe(items) });
    const widths = new Map();
    for (const k of sizes) for (const b of rec.at[k].borders) { const x = widths.get(b.px) || { n: 0, where: new Set() }; x.n = Math.max(x.n, b.n); b.where.forEach((w) => x.where.add(w)); widths.set(b.px, x); }
    rule({ id: "shape.borders", area: "Shape", kind: "convention", title: "Few border widths", how: "Distinct border widths drawn at all sizes; more than 2 warns.", value: widths.size, unit: "widths", warn: 2, status: widths.size > 2 ? "warn" : "pass",
      items: [...widths].map(([px, v]) => ({ key: String(px), where: [...v.where].slice(0, 6).join(", "), what: `${px}px`, value: v.n })) });
  }

  // ── Effects and layers ────────────────────────────────────────────────────────────────────────────────────────
  {
    const sh = new Map();
    for (const k of sizes) for (const s of rec.at[k].shadows) { const x = sh.get(s.value) || { ...s, where: new Set() }; s.where.forEach((w) => x.where.add(w)); sh.set(s.value, x); }
    rule({ id: "effects.shadows", area: "Effects", kind: "convention", title: "Few shadows", how: "Distinct shadows drawn (box and text); more than 6 warns. There are no shadow tokens yet: each is written in its stylesheet.", value: sh.size, unit: "shadows", warn: 6, status: sh.size > 6 ? "warn" : "pass",
      items: [...sh.values()].map((s) => ({ key: s.value, where: [...s.where].slice(0, 5).join(", "), what: `${s.prop}: ${s.value}` })) });
    const fx = new Map();
    for (const k of sizes) for (const e of rec.at[k].effects) { if (e.prop === "opacity") continue; const key = e.prop + "|" + e.sel; const x = fx.get(key) || { ...e, at: new Set() }; x.at.add(k); fx.set(key, x); }
    rule({ id: "effects.cost", area: "Effects", kind: "inventory", title: "Effects that cost the graphics card", how: "Blur and glass (backdrop-filter), filters, blend modes, canvases and video, by element. What each costs on a phone needs a real device (the checks here have no GPU).",
      items: [...fx.values()].map((e) => ({ key: e.prop + e.sel, where: e.sel, what: `${e.prop}: ${e.value}`, at: [...e.at].join(" ") })) });
    const z = new Map();
    for (const k of sizes) for (const x of rec.at[k].z) { const y = z.get(x.z) || { z: x.z, where: new Set() }; x.where.forEach((w) => y.where.add(w)); z.set(x.z, y); }
    rule({ id: "layers.z", area: "Layers", kind: "convention", title: "A short ladder of layers", how: "Distinct z-index values of positioned elements (drawings and chips left out); more than 6 warns. The order: page (−1…2), cookie notice, navbar, skip link.", value: z.size, unit: "values", warn: 6, status: z.size > 6 ? "warn" : "pass",
      items: [...z.values()].sort((a, b) => a.z - b.z).map((x) => ({ key: String(x.z), where: [...x.where].slice(0, 6).join(", "), what: `z-index ${x.z}`, value: x.z })) });
    const fixed = new Map();
    for (const k of sizes) for (const l of rec.at[k].layers) { const x = fixed.get(l.sel) || { ...l, at: new Set() }; x.at.add(k); fixed.set(l.sel, x); }
    rule({ id: "layers.fixed", area: "Layers", kind: "inventory", title: "What stays on the screen", how: "Fixed and sticky elements, by the sizes they are found at.", items: [...fixed.values()].map((l) => ({ key: l.sel, where: l.sel, what: `${l.pos}${l.z !== "auto" ? ", z " + l.z : ""}`, at: [...l.at].join(" ") })) });
  }

  // ── Alignment and ratios ──────────────────────────────────────────────────────────────────────────────────────
  {
    const items = each((m, k) => m.edges.near.map((x) => ({ key: `${x.sel}|${x.side}|${Math.round(x.line)}`, where: x.sel, what: `${x.side} edge ${x.d > 0 ? "+" : ""}${x.d}px off the line at ${x.line} (${x.shared} blocks on it)`, value: Math.abs(x.d), at: k })));
    rule({ id: "align.edges", area: "Alignment", kind: "tolerance", title: "Edges line up", how: "The left and right edges of headings, texts, buttons and cards at every measured size, grouped into lines (3+ edges within 0.5px). An edge 0.5–3px from a line is a near miss: it looks aligned and is not.", value: dedupe(items).length, unit: "near misses", status: items.length ? "warn" : "pass", items: dedupe(items) });
    const icons = each((m, k) => m.icons.filter((i) => i.off != null && Math.abs(i.off) > 1).map((i) => ({ key: i.sel, where: i.sel, what: `${i.off > 0 ? "lower" : "higher"} than its text's line by ${Math.abs(i.off)}px`, value: Math.abs(i.off), at: k })));
    rule({ id: "align.icons", area: "Icons", kind: "tolerance", title: "Icons sit on their text's line", how: "An icon next to a label (a button, a link): the centre of the icon against the centre of the label's first line, at most 1px apart.", value: dedupe(icons).length, unit: "off", status: icons.length ? "warn" : "pass", items: dedupe(icons) });
  }
  {
    const fam = cfg.ratioFamilies || [[1, 1], [4, 3], [3, 4], [3, 2], [2, 3], [16, 9], [9, 16], [4, 5], [5, 4], [2, 1], [21, 9]];
    const near = (k) => fam.find(([a, b]) => Math.abs(k / (a / b) - 1) <= 0.015);
    const by = new Map();
    for (const k of sizes) for (const r of rec.at[k].ratios) { const x = by.get(r.sel) || { sel: r.sel, ks: new Set(), css: r.css, at: [] }; x.ks.add(r.k); x.at.push(`${k}: ${r.k}`); by.set(r.sel, x); }
    rule({ id: "ratios.inventory", area: "Ratios", kind: "inventory", title: "Aspect ratios of pictures and cards", how: "Width ÷ height of every picture, canvas and card at each size, matched to a family (1:1, 4:3, 3:2, 16:9, 4:5…) within 1.5%; a CSS aspect-ratio is shown when one is set.",
      items: [...by.values()].map((x) => { const ks = [...x.ks].sort((a, b) => a - b), f = ks.map(near).filter(Boolean); return { key: x.sel, where: x.sel, what: `${ks.length === 1 ? ks[0] : ks[0] + " – " + ks.at(-1)}${x.css ? " · css " + x.css : ""}${f.length === ks.length && f.every((v) => v === f[0]) ? " · " + f[0].join(":") : ks.length > 1 ? " · changes with the screen" : ""}`, value: ks.length }; }) });
  }

  // ── Icons ─────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const sizesSeen = new Map(), notInherit = [];
    for (const k of sizes) for (const i of rec.at[k].icons) {
      const s = `${Math.round(i.w)}×${Math.round(i.h)}`; const x = sizesSeen.get(s) || new Set(); x.add(i.sel); sizesSeen.set(s, x);
      if (!i.inherits) notInherit.push({ key: i.sel, where: i.sel, what: "drawn in its own colour, not the text's (currentColor)", at: k });
    }
    rule({ id: "icons.colour", area: "Icons", kind: "tolerance", title: "Icons take the colour of their text", how: "Inline icons outside the drawings: every fill and stroke equals the icon's own color (currentColor), so an icon follows its button's state.", value: dedupe(notInherit).length, unit: "in their own colour", status: notInherit.length ? "warn" : "pass", items: dedupe(notInherit) });
    rule({ id: "icons.sizes", area: "Icons", kind: "convention", title: "Few icon sizes", how: "Distinct sizes the inline icons are drawn at; more than 5 warns.", value: sizesSeen.size, unit: "sizes", warn: 5, status: sizesSeen.size > 5 ? "warn" : "pass", items: [...sizesSeen].map(([s, v]) => ({ key: s, where: [...v].slice(0, 5).join(", "), what: s })) });
  }

  // ── Images ────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const blur = [], heavy = [], format = [], alt = [], first = [];
    const plain = (src) => src.replace(/-[\w-]{8}(?=\.\w+$)/, "");      // the file's name without the build's hash
    for (const k of sizes) for (const i of rec.at[k].images) {
      if (i.alt === null) alt.push({ key: plain(i.src), where: i.sel, what: `${i.src}: no alt attribute`, at: k });
      if (i.art || i.k == null || !i.shown) continue;
      if (i.k < 0.95) blur.push({ key: plain(i.src), where: i.sel, what: `${i.src}: ${i.file[0]}px wide for ${Math.round(i.w * rec.at[k].dpr)} device px (×${rec.at[k].dpr})`, value: i.k, at: k });
      if (i.k > 2.5) heavy.push({ key: plain(i.src), where: i.sel, what: `${i.src}: ${i.file[0]}px wide for ${Math.round(i.w * rec.at[k].dpr)} device px`, value: i.k, at: k });
      if (!/avif|webp|svg/.test(i.format)) format.push({ key: plain(i.src), where: i.sel, what: `${i.src} (${i.format})`, at: k });
      if (i.first && i.loading === "lazy") first.push({ key: plain(i.src), where: i.sel, what: `${i.src} is on the first screen but waits (loading=lazy)`, at: k });
    }
    rule({ id: "images.sharp", area: "Images", kind: "tolerance", title: "Pictures are sharp", how: "Every picture outside the drawings: the file's width against the device pixels it covers (its drawn width × the screen's pixel ratio: 3 on phones, 2 on tablets and the 1440 laptop). Below 0.95 it is upscaled.", value: dedupe(blur).length, unit: "upscaled", status: blur.length ? "warn" : "pass", items: dedupe(blur) });
    rule({ id: "images.weight", area: "Images", kind: "tolerance", title: "Pictures are not much bigger than drawn", how: "The same ratio above 2.5: the file is far bigger than the screen can show (bytes for nothing).", value: dedupe(heavy).length, unit: "too big", status: heavy.length ? "warn" : "pass", items: dedupe(heavy) });
    rule({ id: "images.format", area: "Images", kind: "hard", title: "Pictures in a modern format", how: "AVIF, WebP or SVG (drawings left out).", value: dedupe(format).length, unit: "old formats", status: format.length ? "fail" : "pass", items: dedupe(format) });
    rule({ id: "images.alt", area: "Images", kind: "hard", title: "Every picture has an alt", how: "An alt attribute on every <img> (empty for decoration).", value: dedupe(alt).length, unit: "without alt", status: alt.length ? "fail" : "pass", items: dedupe(alt) });
    rule({ id: "images.first", area: "Images", kind: "hard", title: "The first screen does not wait", how: "Pictures on the first screen at any size are not lazy.", value: dedupe(first).length, unit: "lazy on the first screen", status: first.length ? "fail" : "pass", items: dedupe(first) });
  }

  // ── States and components ─────────────────────────────────────────────────────────────────────────────────────
  {
    const t = new Map();
    for (const k of sizes) for (const x of rec.at[k].interact) { const y = t.get(x.ms) || { ms: x.ms, n: 0, where: new Set() }; y.n += x.n; x.where.forEach((w) => y.where.add(w)); t.set(x.ms, y); }
    const moving = [...t.values()].filter((x) => x.ms > 0), main = moving.sort((a, b) => b.n - a.n)[0], total = moving.reduce((a, b) => a + b.n, 0);
    const share = total ? main.n / total : 1;
    rule({ id: "states.timing", area: "States", kind: "share", title: "One hover timing", how: "Links and buttons that change on hover: the length of their colour/background transition. The grammar says one timing everywhere.", value: pct(share), unit: `% at ${main ? main.ms : 0}ms`, pass: 95, warn: 85, status: share * 100 >= 95 ? "pass" : share * 100 >= 85 ? "warn" : "fail",
      items: [...t.values()].filter((x) => !main || x.ms !== main.ms).map((x) => ({ key: String(x.ms), where: [...x.where].slice(0, 6).join(", "), what: x.ms ? `${x.ms}ms` : "no transition", value: x.ms })) });
    const comp = new Map(), odd = [];
    for (const k of sizes) for (const c of rec.at[k].components) {
      const x = comp.get(c.name) || { name: c.name, n: 0, variants: new Set() }; x.n = Math.max(x.n, c.n); c.variants.forEach((v) => x.variants.add(v.mods)); comp.set(c.name, x);
      for (const v of c.variants) if (v.looks > 1) odd.push({ key: c.name + v.mods, where: `.${c.name}${v.mods !== "—" ? " " + v.mods : ""}`, what: `${v.n} copies with ${v.looks} different looks (padding, corner, background, size)`, at: k });
    }
    rule({ id: "components.copies", area: "Components", kind: "tolerance", title: "Copies of a component look alike", how: "Each component (a class with __parts) and each of its variants (--modifiers): its copies on the page should share padding, corner, background, text size and display. A difference no modifier explains is a near-duplicate.", value: dedupe(odd).length, unit: "variants that differ", status: odd.length ? "warn" : "pass", items: dedupe(odd) });
    rule({ id: "components.inventory", area: "Components", kind: "inventory", title: "Components on the page", how: "Classes with __parts, the most copies seen at one size, and their variants.", items: [...comp.values()].sort((a, b) => b.n - a.n).map((c) => ({ key: c.name, where: "." + c.name, what: `${c.n} on the page${c.variants.size > 1 || ![...c.variants].includes("—") ? " · variants: " + [...c.variants].join(", ") : ""}`, value: c.n })) });
  }

  // ── Behaviour: logic, fallbacks, privacy ──────────────────────────────────────────────────────────────────────
  for (const sc of cfg.scenarios) {
    const r = (rec.scenarios || []).find((x) => x.id === sc.id);
    if (!r) continue;
    rule({ id: "logic." + sc.id, area: "Logic", kind: "scenario", title: `${sc.area}: ${sc.when}`, how: `Given ${sc.given}; when ${sc.when}; then ${sc.then}. At ${r.size}.`, status: r.ok && !r.errors.length ? "pass" : "fail",
      items: [...(r.ok ? [] : [{ key: "fail", where: sc.area, what: r.note }]), ...r.errors.map((e) => ({ key: e, where: "script", what: e }))], scenario: { given: sc.given, when: sc.when, then: sc.then } });
  }
  if (rec.modes) {
    const items = { nojs: [], nowebgl: [], forced: [], calm: [], fonts: [] };
    for (const [k, m] of Object.entries(rec.modes)) {
      const n = m.normal;
      if (m.nojs) { const share = m.nojs.chars ? m.nojs.shown / m.nojs.chars : 0; if (share < 0.9 || !m.nojs.h1 || m.nojs.headingsShown < m.nojs.headings) items.nojs.push({ key: k, where: k, what: `${pct(share)}% of the text shown, ${m.nojs.headingsShown} of ${m.nojs.headings} headings, h1 ${m.nojs.h1 ? "shown" : "hidden"}`, value: pct(share), at: k }); }
      for (const [mode, list] of [["nowebgl", items.nowebgl], ["forced", items.forced]]) {
        const x = m[mode]; if (!x) continue;
        if (x.errors.length) list.push({ key: k + "err", where: k, what: "script errors: " + x.errors.slice(0, 2).join("; "), at: k });
        if (n && x.shown < n.shown * 0.97) list.push({ key: k, where: k, what: `${x.shown} characters shown against ${n.shown} normally`, at: k });
        if (!x.h1) list.push({ key: k + "h1", where: k, what: "the h1 is hidden", at: k });
      }
      if (m.calm) for (const a of m.calm.running) items.calm.push({ key: a.target + a.name, where: a.target, what: `${a.name}${a.infinite ? " (loops)" : ""} still runs with reduced motion`, at: k });
      if (m.fonts && n?.boxes && m.fonts.boxes) n.boxes.forEach((b, i) => { const f = m.fonts.boxes[i]; if (!f || f.text !== b.text) return; const dw = b.w ? Math.abs(f.w - b.w) / b.w : 0; if (f.lines !== b.lines || dw > 0.06) items.fonts.push({ key: b.sel + b.text, where: b.sel, what: `«${b.text}» ${b.lines} → ${f.lines} lines, ${b.w} → ${f.w}px wide with the fallback font`, value: r2(dw * 100), at: k }); });
    }
    rule({ id: "fallback.nojs", area: "Fallbacks", kind: "hard", title: "The page reads without scripts", how: "Scripts turned off: at least 90% of the main text shown, every heading and the h1 visible (at 390×844 and 1440×900).", status: items.nojs.length ? "fail" : "pass", items: items.nojs });
    rule({ id: "fallback.nowebgl", area: "Fallbacks", kind: "hard", title: "The page works without WebGL", how: "WebGL turned off (old devices, blocked GPUs): no script errors, the same text shown.", status: items.nowebgl.length ? "fail" : "pass", items: items.nowebgl });
    rule({ id: "fallback.forced", area: "Fallbacks", kind: "hard", title: "The page works in forced colours", how: "Windows High Contrast and the like (forced-colors: active): no script errors, the same text shown.", status: items.forced.length ? "fail" : "pass", items: items.forced });
    rule({ id: "fallback.calm", area: "Fallbacks", kind: "hard", title: "Reduced motion stops the motion", how: "With reduce motion: after the load and a scroll top to bottom, no CSS or Web Animations still running (GSAP's own motion is not seen by this check).", status: items.calm.length ? "fail" : "pass", items: dedupe(items.calm) });
    rule({ id: "fallback.fonts", area: "Fallbacks", kind: "tolerance", title: "The fallback font keeps the layout", how: "The web fonts never arrive (blocked): every heading, text and button against the normal page; a change of line count or more than 6% of width warns (the text would jump when the font comes).", value: dedupe(items.fonts).length, unit: "texts that jump", status: items.fonts.length ? "warn" : "pass", items: dedupe(items.fonts) });
  }
  if (rec.privacy) {
    const p = rec.privacy, allowed = cfg.consent.allowedBefore || [];
    const items = [
      ...p.before.requests.map((u) => ({ key: u, where: new URL(u).host, what: `a request to ${u.slice(0, 90)}` })),
      ...p.before.cookies.map((c) => ({ key: "cookie " + c, where: "cookies", what: `cookie ${c}` })),
      ...p.before.storage.filter((s) => !allowed.includes(s)).map((s) => ({ key: "storage " + s, where: "localStorage", what: `stores ${s}` })),
    ];
    rule({ id: "privacy.before", area: "Privacy", kind: "hard", title: "Nothing optional before «ОК»", how: "A first visit: the page, a scroll, a pointer over a demo button and 3.5 s of waiting. Nothing may go to another host, set a cookie or store anything until the cookie notice's «ОК» is pressed (152-ФЗ; CLAUDE.md).", status: items.length ? "fail" : "pass", items });
    rule({ id: "privacy.after", area: "Privacy", kind: "inventory", title: "Who is called after «ОК»", how: "The same visit after «ОК»: the other hosts the page called.", items: [...new Set(p.after.requests)].map((h) => ({ key: h, where: h, what: "called after consent" })) });
  }

  // ── Page health ───────────────────────────────────────────────────────────────────────────────────────────────
  if (rec.pages) {
    const head = [], over = [], errs = [], status = [];
    for (const p of rec.pages) {
      const at = p.size, where = "/" + p.path;
      if (p.overflow > 0) over.push({ key: where + at, where, what: `scrolls sideways by ${p.overflow}px`, at });
      p.errors.forEach((e) => errs.push({ key: where + e, where, what: e, at }));
      if (p.status !== p.want) status.push({ key: where, where, what: `answers ${p.status}, should be ${p.want}` });
      const h = p.head; if (!h) continue;
      const t = (h.title || "").length, d = (h.description || "").length, h1 = h.headings.filter((x) => x.level === 1).length;
      if (!h.lang) head.push({ key: where + "lang", where, what: "no lang on <html>", severity: "fail" });
      if (!h.viewport) head.push({ key: where + "vp", where, what: "no viewport meta", severity: "fail" });
      if (h1 !== 1) head.push({ key: where + "h1", where, what: `${h1} h1 headings (one wanted)`, severity: "fail" });
      if (t < 10 || t > 65) head.push({ key: where + "title", where, what: `title of ${t} characters (10–65)` });
      if (p.want === 200 && (d < 50 || d > 170)) head.push({ key: where + "desc", where, what: `description of ${d} characters (50–170)` });
      let last = 0; for (const x of h.headings) { if (last && x.level > last + 1) { head.push({ key: where + "skip" + x.text, where, what: `h${last} → h${x.level} «${x.text}» skips a level` }); } last = x.level; }
      h.anchors.filter((a) => !a.ok && !/^#top$/i.test(a.href)).forEach((a) => head.push({ key: where + a.href, where, what: `a link to ${a.href}, which names nothing on the page` }));
      if (p.path === "" && !h.og.image) head.push({ key: "og", where, what: "no og:image" });
      if (p.path === "" && !h.manifest) head.push({ key: "manifest", where, what: "no web manifest" });
    }
    rule({ id: "health.head", area: "Page health", kind: "tolerance", title: "Titles, descriptions, outline", how: "Every page: lang and viewport (fail), one h1 (fail), a title of 10–65 characters, a description of 50–170, headings that do not skip a level, in-page links that name an id, og:image and a manifest on the home page.", value: head.length, unit: "notes", status: head.some((x) => x.severity === "fail") ? "fail" : head.length ? "warn" : "pass", items: dedupe(head) });
    rule({ id: "health.overflow", area: "Page health", kind: "hard", title: "No page scrolls sideways", how: "Every page at 390×844 and 1440×900, and the home page at every measured size and every 10px of width.", status: over.length || each((m, k) => m.overflow ? [1] : []).length || (rec.sweep?.width || []).some((r) => r.overflow) ? "fail" : "pass",
      items: [...over, ...each((m, k) => m.overflow ? [{ key: "home" + k, where: "/", what: `scrolls sideways by ${m.overflow}px`, at: k }] : []), ...(rec.sweep?.width || []).filter((r) => r.overflow).map((r) => ({ key: "w" + r.w, where: "/", what: `${r.overflow}px sideways`, at: `${r.w} wide` }))] });
    const errAll = [...errs, ...each((m, k) => m.errors.map((e) => ({ key: "home" + e, where: "/", what: e, at: k })))];
    rule({ id: "health.errors", area: "Page health", kind: "hard", title: "No script errors", how: "Errors thrown on every page and size measured.", status: errAll.length ? "fail" : "pass", items: dedupe(errAll) });
    rule({ id: "health.status", area: "Page health", kind: "hard", title: "Pages answer as they should", how: "Every page 200; an address that is not there 404 with the not-found page.", status: status.length ? "fail" : "pass", items: status });
    const bad = (rec.links || []).filter((l) => !l.ok);
    rule({ id: "health.links", area: "Page health", kind: "hard", title: "Links on the site lead somewhere", how: `Every link that stays on the site (${(rec.links || []).length}), from every page, opened; one with #id must find it.`, status: bad.length ? "fail" : "pass", items: bad.map((l) => ({ key: l.from + l.href, where: l.from, what: `${l.href}: ${l.why}` })) });
    const files = (rec.files || []).filter((f) => f.status !== 200);
    rule({ id: "health.files", area: "Page health", kind: "hard", title: "robots.txt, sitemap, manifest, icons", how: "The files a browser or a search engine asks for, all there.", status: files.length ? "fail" : "pass", items: files.map((f) => ({ key: f.path, where: f.path, what: `answers ${f.status}` })),
      note: (rec.files || []).find((f) => f.path === "robots.txt")?.body?.includes("Disallow: /") ? "robots.txt keeps every search engine out (until the launch; open item)." : "" });
  }

  // ── Weight (trend) ────────────────────────────────────────────────────────────────────────────────────────────
  if (rec.weight) {
    const kb = (b) => Math.round(b / 1024), w = rec.weight, p = prev?.weight;
    const rows = Object.entries(w.by).map(([k, v]) => ({ key: k, where: k, what: `${v.files} files, ${kb(v.sent)} KB sent${p?.by?.[k] ? ` (was ${kb(p.by[k].sent)} KB)` : ""}`, value: kb(v.sent) }));
    const grew = p ? (w.total - p.total) / p.total : 0, jsGrew = p?.by?.js ? (w.by.js.sent - p.by.js.sent) / p.by.js.sent : 0;
    rule({ id: "weight.total", area: "Weight", kind: "trend", title: "A first visit does not get heavier", how: "The bytes of a first visit scrolled top to bottom at 1440×900 (×2), as sent (Brotli for text), against the last deploy of main: more than 10% more warns (scripts alone: 5%).", value: kb(w.total), unit: "KB", was: p ? kb(p.total) : null,
      status: grew > 0.1 || jsGrew > 0.05 ? "warn" : "pass", items: rows });
  }
  return out;
}

// one item per key (the same thing seen at several sizes): the sizes are joined
function dedupe(items) {
  const by = new Map();
  for (const x of items) { const y = by.get(x.key); if (!y) by.set(x.key, { ...x, at: x.at ? [x.at] : [] }); else { if (x.at && !y.at.includes(x.at)) y.at.push(x.at); if (x.n != null) y.n = (y.n || 0) + x.n; } }
  return [...by.values()].map((x) => ({ ...x, at: x.at.join(" ") }));
}
