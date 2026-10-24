// npm run typeset -- [options] <file.html…>   shows what the typesetter does to each text of a page
//   --text "…"     a text instead of a file (with --lang ru|en, --heading)
//   --lint         only the visible-character findings (quotes, dashes, look-alike letters…)
//   --fix          puts the findings' fixes into the files (asks nothing: commit first, review with git diff)
//   --json         everything as JSON
// Marks: ⍽ no-break space · ⁀ word joiner · ¦ where a link may break · [n] the longest unbreakable piece, in letters
import { readFileSync, writeFileSync } from "node:fs";
import { typeset, decide, pieces } from "./core.js";
import { typesetHtml } from "./html.js";
import { lint } from "./lint.js";

const args = process.argv.slice(2);
const flag = (name) => args.includes("--" + name);
const value = (name) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : undefined; };
const files = args.filter((a, i) => !a.startsWith("--") && !["--text", "--lang"].includes(args[i - 1]));
const show = (s) => s.replace(/\u00A0/g, "⍽").replace(/\u2060/g, "⁀").replace(/\u200B/g, "¦").replace(/<wbr>/g, "¦").replace(/\uFFFC/g, "▪").replace(/\uE000/g, "");

if (value("text") !== undefined) {
  const text = value("text"), opts = { lang: value("lang") || "ru", heading: flag("heading") };
  const { toks, holds, released } = decide(text, opts);
  console.log(show(typeset(text, opts)));
  console.log("holds:", holds.map((h) => h.rule).join(", ") || "none", released.length ? "· let go: " + released.map((h) => h.rule).join(", ") : "");
  console.log("longest piece:", Math.max(0, ...pieces(toks, holds).map((p) => p.length)), "letters");
  for (const f of lint(text, opts)) console.log(`  ${f.check}: «${text.slice(f.i, f.j)}» → «${f.fix ?? "?"}» (${f.message})`);
  process.exit(0);
}

let total = 0;
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const { report } = typesetHtml(src);
  if (flag("json")) { console.log(JSON.stringify({ file, report }, null, 2)); continue; }
  if (flag("fix")) {
    // the fixes, from the end of the file so the offsets stay right (the report gives each finding's source offsets)
    const fixes = report.flatMap((r) => r.findings).filter((f) => f.fix !== null && f.src).sort((a, b) => b.src.s - a.src.s);
    let out = src;
    for (const f of fixes) out = out.slice(0, f.src.s) + f.fix + out.slice(f.src.e);
    writeFileSync(file, out);
    console.log(`${file}: ${fixes.length} fixes`);
    continue;
  }
  console.log("\n" + file);
  for (const r of report) {
    if (!flag("lint") && /[\p{L}\p{N}]/u.test(r.text)) {
      const { html } = typesetHtml(`<!doctype html><html lang="${r.lang}"><body>${r.heading ? "<h2>" : "<p>"}${escape(r.text)}</body></html>`);
      const text = html.replace(/^.*<body><(h2|p)>|<\/body>.*$/gs, "");
      console.log(`${String(r.at?.line ?? "").padStart(5)}  ${r.heading ? "H" : " "} [${r.longestLength}] ${show(text)}`);
    }
    for (const f of r.findings) {
      total++;
      console.log(`${String(f.at?.line ?? "").padStart(5)}:${f.at?.col ?? ""}  ${f.check}: «${show(f.text)}» → «${show(f.fix ?? "?")}»  (${f.message})`);
    }
  }
}
if (flag("lint")) console.log(`\n${total} findings`);

function escape(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
