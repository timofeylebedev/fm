// The visible part of typesetting: characters a text should probably have, reported instead of changed (the build
// never changes a letter you can see; `npm run typeset -- --fix <file>` makes the changes in the source if you agree).
// Each finding: { i, j (in the text), check, message, fix (the text to put there) }.
import { tokenize } from "./core.js";

const CYR = /\p{Script=Cyrillic}/u, LAT = /\p{Script=Latin}/u;

export const CHECKS = {
  "mixed-script": "a word with both Cyrillic and Latin letters (a look-alike letter typed in the other layout)",
  "quotes": "straight quotes",
  "apostrophe": "a straight apostrophe",
  "ellipsis": "three dots instead of an ellipsis",
  "hyphen-as-dash": "a hyphen used as a dash",
  "double-hyphen": "two hyphens instead of a dash",
  "range": "a hyphen between numbers (a range takes an en dash)",
  "times": "an «x» between numbers (dimensions take ×)",
  "number-sign": "№ without a space before its number",
  "space-before": "a space before punctuation",
};

export function lint(text, { lang = "ru" } = {}) {
  const base = String(lang).toLowerCase().split("-")[0];
  const toks = tokenize(text).filter((k) => k.t !== "z");
  const out = [];
  const add = (i, j, check, fix) => out.push({ i, j, check, message: CHECKS[check], fix });
  // quotes: an opening one after a space or the start, a closing one otherwise; «» „“ in Russian, “” ‘’ in English
  let depth = 0;
  toks.forEach((k, n) => {
    const L = toks[n - 1], R = toks[n + 1];
    if (k.t === "w" && CYR.test(k.s) && LAT.test(k.s)) add(k.i, k.j, "mixed-script", null);
    if (k.t === "w" && k.s.includes("'")) add(k.i, k.j, "apostrophe", k.s.replace(/'/g, "’"));
    if (k.s === '"') {
      // opening: a word comes next and a space (or the start, a bracket, a dash) before; «cookies "» with a space typed
      // before the closing one is still closing, because a comma or a space follows it
      const next = R && R.t !== "s" && !(R.t === "p" && ",.;:!?)]".includes(R.s));
      const open = next && (!L || L.t === "s" || (L.t === "p" && "([«„“".includes(L.s)) || L.t === "d");
      depth += open ? 1 : -1;
      const ru = base === "ru";
      const fix = open ? (ru ? (depth > 1 ? "„" : "«") : depth > 1 ? "‘" : "“") : ru ? (depth > 0 ? "“" : "»") : depth > 0 ? "’" : "”";
      add(k.i, k.j, "quotes", fix);
    }
    if (k.s === "." && toks[n + 1]?.s === "." && toks[n + 2]?.s === "." && L?.s !== ".") add(k.i, k.i + 3, "ellipsis", "…");
    if (k.t === "d" && k.s === "-") add(k.i, k.j, "hyphen-as-dash", "—");
    if (k.t === "h" && R?.t === "h") add(k.i, R.j, "double-hyphen", "—");
    // a hyphen between two numbers, but not in a chain of them (a date «2026-10-19», a code «512-51-50»)
    if (k.t === "h" && L?.t === "n" && R?.t === "n" && toks[n - 2]?.t !== "h" && toks[n + 2]?.t !== "h") add(k.i, k.j, "range", "–");
    if (k.t === "w" && /^[xх]$/i.test(k.s) && L?.t === "n" && R?.t === "n") add(k.i, k.j, "times", "×");
    if (base === "ru" && k.s === "№" && R?.t === "n") add(k.j, k.j, "number-sign", "\u00A0");
    if (k.t === "s" && L && R?.t === "p" && ",.;:!?)»”".includes(R.s) && !/[\u00A0]/.test(k.s)) add(k.i, k.j, "space-before", "");
  });
  return out.filter((f) => !inLink(toks, f));
}

// nothing inside a link, an e-mail or a phone is a finding
const inLink = (toks, f) => toks.some((k) => k.t === "a" && f.i >= k.i && f.j <= k.j);
