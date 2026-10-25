// The design system's rules read from the code: design/scale.json, design/tokens.json, design/decisions.json, CLAUDE.md
// and src/styles, src/scripts. Each rule lists what breaks it with the file and line. Used by design/checks/state.mjs
// (the checks of every deploy) and by design/report/tools/rules.mjs (prints them).
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const AREA = {"ladder": "Type", "relations": "Type", "no-swallowed-css": "Code", "colour-tokens": "Colour", "type-from-scale": "Type", "fluid-from-scale": "Space", "tokens-wired": "Code", "layout-steps": "Layout", "media-steps": "Layout", "curves": "Motion", "decisions": "Decisions"};

export function sourceRules() {
  const here = process.cwd();
  process.chdir(ROOT);
  try {
    const read = (p) => readFileSync(p, "utf8");
    const scale = JSON.parse(read("design/scale.json"));
    const decisions = JSON.parse(read("design/decisions.json")).decisions;
    const claude = read("CLAUDE.md");
    const files = readdirSync("src/styles").filter((f) => f.endsWith(".css")).map((f) => join("src/styles", f));
    for (const dir of ["base", "components", "sections", "art"])
      for (const f of readdirSync(join("src/styles", dir))) if (f.endsWith(".css")) files.push(join("src/styles", dir, f));
    const css = Object.fromEntries(files.map((f) => [f, read(f)]));
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));   // keep line numbers
    const lineOf = (s, i) => s.slice(0, i).split("\n").length;
    const own = (f) => !f.endsWith("tokens.gen.css");
    const art = (f) => f.includes("/art/");   // the drawings: pictures with their own px unit (--fm-px), not page UI

    const results = [];
    const rule = (id, title, how, fails, note = "") => results.push({ id, title, how, ok: fails.length === 0, n: fails.length, fails, note });

    // 1. ladder: both ends of every role on the ladder (block sizes excepted)
    const ladder = [0];
    for (const [step, to] of scale.ladder.steps) while (ladder.at(-1) < to) ladder.push(ladder.at(-1) + step);
    const roles = { ...scale.type.roles, ...scale.space.roles };
    const off = [];
    for (const [k, r] of Object.entries(roles)) if (!r.size) for (const v of r.px) if (!ladder.includes(v)) off.push(`${k}: ${v}`);
    rule("ladder", "Every size ends on the ladder", `${Object.keys(roles).length} roles of scale.json, both ends, against 0 2 … 24 28 … 64 72 … 128`, off);

    // 2. relations at both ends
    const min = scale.type.relations.min, close = [];
    const rel = scale.type.relations.pairs.map(([a, b]) => {
      const A = scale.type.roles[a].px, B = scale.type.roles[b].px, k0 = A[0] / B[0], k1 = A[1] / B[1];
      if (k0 < min - 1e-9 || k1 < min - 1e-9) close.push(`${a}/${b}: ×${k0.toFixed(3)} at 320, ×${k1.toFixed(3)} at 1440`);
      return { label: `${a.slice(5)} / ${b.slice(5)}`, k0, k1 };
    });
    rule("relations", "Neighbouring text levels at least ×" + min + " apart", `${rel.length} pairs of type.relations at 320 and 1440 (a ratio of two lines moves only between its two ends)`, close);

    // 3. no CSS inside a comment: an unclosed /* swallows everything to the next */
    const swallowed = [];
    for (const [f, s] of Object.entries(css)) {
      for (const m of s.matchAll(/\/\*([\s\S]*?)\*\//g)) if (/[{};]\s*\n\s*[.#:@a-z-][^\n]*\{/i.test(m[1]) && /\}\s*$/m.test(m[1])) swallowed.push(`${f}:${lineOf(s, m.index)}`);
      const left = strip(s);   // comments do not nest: what is left after taking them out must hold no comment marks
      for (const m of left.matchAll(/\/\*|\*\//g)) swallowed.push(`${f}:${lineOf(left, m.index)} a comment mark outside a comment (unclosed or stray)`);
    }
    rule("no-swallowed-css", "No CSS hidden inside a comment", "every comment of " + files.length + " stylesheets: rules inside, unbalanced marks", swallowed);

    // 4. colours from tokens only (the drawings excepted: they are pictures with their own palettes)
    const lit = [];
    for (const [f, s0] of Object.entries(css)) {
      if (!own(f) || art(f)) continue;
      const s = strip(s0);
      for (const m of s.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/gi)) {
        const line = s.split("\n")[lineOf(s, m.index) - 1];
        if (/^\s*--[\w-]+\s*:/.test(line) && f.endsWith("tokens.css")) continue;   // token definitions
        lit.push(`${f}:${lineOf(s, m.index)} ${m[0]}`);
      }
    }
    rule("colour-tokens", "Colours from the tokens only", "literal #hex / rgb() / hsl() / oklch() in the page's stylesheets (tokens.css definitions and the drawings' art.css left out)", lit);

    // 5. type from the scale: every font-size is a type role, an em/% of one, or a listed object/fit size
    const OBJECT_TYPE = ["--hero-title", "--cta-title", "--card-title", "--u", "--fm-px"];
    const badType = [];
    for (const [f, s0] of Object.entries(css)) {
      if (!own(f) || art(f)) continue;
      const s = strip(s0);
      for (const m of s.matchAll(/font-size\s*:\s*([^;}]+)/g)) {
        const v = m[1].trim();
        if (/var\(--type-|^\d*\.?\d+(em|%)$|^inherit$|^1em$/.test(v) || OBJECT_TYPE.some((o) => v.includes(`var(${o}`))) continue;
        badType.push(`${f}:${lineOf(s, m.index)} ${v}`);
      }
    }
    rule("type-from-scale", "Text sizes from the scale", "every font-size: a --type-* role, em or %, the fit sizes (" + OBJECT_TYPE.slice(0, 3).join(", ") + ") or an object's own unit (--u, --fm-px)", badType,
      "Objects scaled as a whole (the ID cards' 24/13px, the tiles' --u, the hero chips' --u, the drawings' --fm-px) are pictures of UI, not page text.");

    // 6. no own fluid values for spacing, radii and type (vw / cq / clamp only in the generated tokens or in block measures)
    const SPACE_PROPS = /^(margin|padding|gap|row-gap|column-gap|border-radius|font-size|letter-spacing|inset)/;
    const fluid = [];
    for (const [f, s0] of Object.entries(css)) {
      if (!own(f) || art(f)) continue;
      const s = strip(s0);
      for (const m of s.matchAll(/(^|[;{\s])([a-z-]+)\s*:\s*([^;}]+)/g)) {
        const [, , prop, v] = m;
        if (!SPACE_PROPS.test(prop)) continue;
        if (/\d(vw|vh|svh|dvh|cqw|cqi|cqh|vmin|vmax)\b|clamp\(/.test(v)) fluid.push(`${f}:${lineOf(s, m.index)} ${prop}: ${v.trim().slice(0, 70)}`);
      }
    }
    rule("fluid-from-scale", "Spacing, radii and type never own vw/cq/clamp()", "margin, padding, gaps, radii, font-size and inset declarations in every stylesheet", fluid);

    // 7. every var() used is defined, every token defined is used
    const defined = new Set(), used = new Map();
    const pageCss = Object.entries(css).map(([f, s]) => [f, strip(s)]);
    for (const [, s] of pageCss) for (const m of s.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);
    const js = readdirSync("src/scripts").filter((f) => f.endsWith(".js")).map((f) => read(join("src/scripts", f))).join("\n")
      + readdirSync("src/scripts/art").filter((f) => f.endsWith(".js")).map((f) => read(join("src/scripts/art", f))).join("\n");
    const html = readdirSync("src").filter((f) => f.endsWith(".html")).map((f) => read(join("src", f))).join("\n");
    for (const m of js.matchAll(/["'`](--[\w-]+)["'`]|setProperty\(\s*["'`](--[\w-]+)/g)) defined.add(m[1] || m[2]);
    for (const m of html.matchAll(/style="[^"]*?(--[\w-]+)\s*:/g)) defined.add(m[1]);
    for (const [f, s] of pageCss) for (const m of s.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
      if (!used.has(m[1])) used.set(m[1], []);
      used.get(m[1]).push({ f, fallback: m[2] === "," });
    }
    for (const m of (js + html).matchAll(/var\(\s*(--[\w-]+)/g)) if (!used.has(m[1])) used.set(m[1], [{ f: "js/html", fallback: true }]);
    const undef = [...used].filter(([k, u]) => !defined.has(k) && !u.every((x) => x.fallback)).map(([k, u]) => `${k} (${[...new Set(u.map((x) => x.f))].join(", ")})`);
    const gen = strip(css["src/styles/base/tokens.gen.css"]), tokensCss = strip(css["src/styles/base/tokens.css"]);
    const tokenNames = [...new Set([...gen.matchAll(/(--[\w-]+)\s*:/g), ...tokensCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))];
    const usedAnywhere = (k) => used.has(k) || js.includes(k) || html.includes(k);
    const unused = tokenNames.filter((k) => !usedAnywhere(k));
    rule("tokens-wired", "Every var() defined, every token used", `${used.size} custom properties used, ${tokenNames.length} tokens in tokens.css + tokens.gen.css`,
      [...undef.map((x) => "used, never defined: " + x), ...unused.map((x) => "defined, never used: " + x)]);

    // 8. layout steps: container queries only at S/M/L or a written own step
    const own_ = [...claude.matchAll(/\(([^)]*own step[^)]*)\)/g)].map((m) => m[1]).join(" ") + " " + (claude.match(/any other step must be a written\s*"own step" \(([^)]*)\)/) || [, ""])[1];
    const ownSteps = new Set([...own_.matchAll(/(\d+(?:\.\d+)?(?:rem|px|em))/g)].map((m) => m[1]));
    const shared = new Set(["22rem", "43rem", "58rem"]);
    const steps = [], strays = [];
    for (const [f, s0] of Object.entries(css)) {
      const s = strip(s0);
      for (const m of s.matchAll(/@container\s*([\w-]*)\s*\(([^)]*)\)/g)) {
        const v = (m[2].match(/(\d+(?:\.\d+)?(?:rem|px|em))/) || [])[1];
        if (!v) continue;   // a style or aspect query
        steps.push({ f, at: lineOf(s, m.index), name: m[1], v });
        if (!shared.has(v) && !ownSteps.has(v)) strays.push(`${f}:${lineOf(s, m.index)} @container ${m[1]} (${m[2].trim()})`);
      }
    }
    rule("layout-steps", "Layouts change only at S, M, L or a written own step", `${steps.length} width container queries against S 22rem, M 43rem, L 58rem and the own steps written in CLAUDE.md (${[...ownSteps].join(", ")})`, strays);

    // 9. page-level media steps (screen widths): the em steps of media.css only
    const media = strip(css["src/styles/base/media.css"]);
    const customMedia = [...media.matchAll(/@custom-media\s+(--[\w-]+)\s+([^;]+);/g)].map((m) => ({ name: m[1], q: m[2].trim() }));
    const rawMedia = [];
    for (const [f, s0] of Object.entries(css)) {
      const s = strip(s0);
      for (const m of s.matchAll(/@media\s*([^{]+)\{/g)) if (/\d+(px|em|rem)/.test(m[1]) && !f.endsWith("media.css")) rawMedia.push(`${f}:${lineOf(s, m.index)} @media ${m[1].trim()}`);
    }
    rule("media-steps", "Screen steps only from media.css", `${customMedia.length} custom media (${customMedia.map((c) => c.name).join(", ")}); raw width queries elsewhere`, rawMedia);

    // 10. one table of curves: no literal cubic-bezier outside motion.js / tokens.css
    const curves = [];
    for (const [f, s0] of Object.entries(css)) {
      if (art(f)) continue;
      const s = strip(s0);
      for (const m of s.matchAll(/cubic-bezier\([^)]*\)|(?<![-\w])(ease-in-out|ease-in|ease-out|ease|linear)(?![-\w(])/g)) {
        const line = s.split("\n")[lineOf(s, m.index) - 1];
        if (f.endsWith("tokens.css") && /^\s*--ease/.test(line)) continue;
        if (/transition-timing-function:\s*linear|animation[^;]*linear/.test(line) && m[0] === "linear") continue;   // loops at an even speed
        curves.push(`${f}:${lineOf(s, m.index)} ${m[0]}`);
      }
    }
    const jsFiles = readdirSync("src/scripts").filter((f) => f.endsWith(".js") && f !== "motion.js");
    const stripJs = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
    for (const f of jsFiles) {
      const s = stripJs(read(join("src/scripts", f)));
      // literal curves, GSAP eases by name (ease: "…" or ease = "…"; "none" is the even scrub of scroll-linked motion), own CustomEases
      for (const m of s.matchAll(/cubic-bezier\(\s*[\d.]+[^)]*\)|ease\s*[:=]\s*["'](power\d|sine|expo|circ|back|elastic)[^"']*["']|CustomEase\.create\(\s*["'][^"']+["']\s*,\s*["'][\d.,\s]+["']/g))
        curves.push(`scripts/${f}:${lineOf(s, m.index)} ${m[0]}`);
    }
    rule("curves", "Curves from one table (motion.js)", "cubic-bezier() and named eases in the page's stylesheets and scripts, outside motion.js and the --ease tokens", curves);

    // 11. decisions complete
    const need = ["id", "kind", "what", "decided", "why"], incomplete = [];
    for (const d of decisions) {
      for (const k of need) if (!d[k]) incomplete.push(`${d.id || "?"}: no ${k}`);
      if (d.kind === "exception" && !d.rule) incomplete.push(`${d.id}: an exception without the rule it departs from`);
      if (d.kind === "exception" && !d.fix) incomplete.push(`${d.id}: an exception without a fix`);
    }
    const ids = decisions.map((d) => d.id), dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    rule("decisions", "Every decision complete", `${decisions.length} entries: ${need.join(", ")}; the rule and a fix for each exception; ids unique`, [...incomplete, ...dup.map((d) => "duplicate id " + d)]);


    return { results: results.map((r) => ({ ...r, area: AREA[r.id] || "Code" })), relations: rel, steps, customMedia, ladder };
  } finally { process.chdir(here); }
}
