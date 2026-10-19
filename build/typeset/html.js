// The typesetter on an HTML page: finds the page's texts with a real HTML parser (parse5), joins the words of a block
// across its inline tags («в <a>доме</a>» is one text), takes each block's language from its lang attribute, and
// changes only the characters the rules decide on, in place, so the rest of the file stays exactly as it was written.
import { parse } from "parse5";
import { decodeHTML } from "entities";
import { edits as textEdits, decide, pieces, OBJ, NBSP } from "./core.js";
import { lint } from "./lint.js";

// tags whose text is inline (part of the block around them); every other element starts a block of its own
const INLINE = new Set("a abbr b bdi bdo cite data del dfn em font i ins mark q s small span strong sub sup time u".split(" "));
// things that sit between words like a letter: a picture, an icon, a field
const OBJECTS = new Set("img svg picture video audio canvas iframe input select object embed math meter progress".split(" "));
// never touched: code, scripts, preformatted text
const SKIP = new Set("script style pre code kbd samp var textarea noscript".split(" "));

const attr = (el, name) => el.attrs?.find((a) => a.name === name)?.value;

// the decoded text of a text node, and for each of its characters where it is in the source
function mapText(node, src) {
  const { startOffset: s0, endOffset: s1 } = node.sourceCodeLocation;
  const value = node.value, map = [];
  let p = s0;
  for (let c = 0; c < value.length;) {
    if (src[p] === "&") {
      const m = /^&(?:#\d+;?|#x[0-9a-f]+;?|[a-z][a-z0-9]*;?)/i.exec(src.slice(p, Math.min(s1, p + 40)));
      if (m) {
        // the shortest entity that gives the next character(s)
        let len = m[0].length, dec = decodeHTML(m[0]);
        while (len > 2 && !value.startsWith(dec, c)) { len--; dec = decodeHTML(src.slice(p, p + len)); }
        if (dec && value.startsWith(dec, c)) {
          for (let k = 0; k < dec.length; k++) map.push({ s: p, e: p + len, whole: k === 0 });
          c += dec.length; p += len; continue;
        }
      }
    }
    if (src[p] === "\r" && src[p + 1] === "\n" && value[c] === "\n") { map.push({ s: p, e: p + 2, whole: true }); c++; p += 2; continue; }
    map.push({ s: p, e: p + 1, whole: true }); c++; p++;
  }
  return map;
}

// every block of text on the page: { lang, heading, text, map (per character: source offsets, or null for OBJ) }
function blocks(doc, src) {
  const out = [];
  const walk = (node, ctx, run) => {
    for (const child of node.childNodes || []) {
      if (child.nodeName === "#text") {
        if (!child.sourceCodeLocation) continue;
        const map = mapText(child, src);
        run.text += child.value; run.map.push(...map);
        continue;
      }
      if (child.nodeName === "#comment" || !child.tagName) continue;
      const tag = child.tagName;
      const off = SKIP.has(tag) || attr(child, "data-typeset") === "off" || attr(child, "contenteditable") !== undefined;
      if (OBJECTS.has(tag)) { run.text += OBJ; run.map.push(null); continue; }
      if (tag === "br" || tag === "wbr") {
        if (tag === "br") { flush(run, ctx); run.text = ""; run.map = []; }
        else { run.text += "\u200B"; run.map.push(null); }
        continue;
      }
      if (off) { run.text += OBJ; run.map.push(null); continue; }
      const lang = attr(child, "lang") ?? ctx.lang;
      const heading = ctx.heading || /^h[1-6]$/.test(tag) || attr(child, "role") === "heading";
      const inner = { lang, heading };
      const content = tag === "template" ? child.content : child;
      // the edges of an inline tag are marked (U+E000, invisible to the rules): «лейбл.</span><span>На одной» is two
      // words, not «лейбл.На»
      if (INLINE.has(tag) && lang === ctx.lang) { mark(run); walk(content, ctx, run); mark(run); continue; }
      // an inline element in another language is a text of its own, a word-like object in the text around it
      if (INLINE.has(tag)) { run.text += OBJ; run.map.push(null); }
      // a block: what came before it is a text of its own
      else { flush(run, ctx); run.text = ""; run.map = []; }
      const own = { text: "", map: [] };
      walk(content, inner, own);
      flush(own, inner);
    }
  };
  const mark = (run) => { run.text += "\uE000"; run.map.push(null); };
  const flush = (run, ctx) => {
    if (/\S/.test(run.text)) out.push({ lang: ctx.lang, heading: ctx.heading, text: run.text, map: run.map.slice() });
  };
  const html = doc.childNodes.find((n) => n.tagName === "html");
  const body = html?.childNodes.find((n) => n.tagName === "body");
  if (!body) return out;
  const ctx = { lang: attr(html, "lang") ?? attr(body, "lang") ?? "", heading: false };
  const run = { text: "", map: [] };
  walk(body, ctx, run);
  flush(run, ctx);
  return out;
}

const lineCol = (src, at) => {
  const before = src.slice(0, at), line = before.split("\n").length;
  return { line, col: at - before.lastIndexOf("\n") };
};

// options as in core.js (cap, off) + headingCap. Returns { html, report }.
export function typesetHtml(src, opts = {}) {
  const doc = parse(src, { sourceCodeLocationInfo: true });
  const changes = [], report = [];
  for (const b of blocks(doc, src)) {
    const o = { ...opts, lang: b.lang || opts.lang || "", heading: b.heading, cap: b.heading ? opts.headingCap ?? 16 : opts.cap ?? 28 };
    // the text's own leading and trailing spaces are not between words
    for (const e of textEdits(b.text, o)) {
      if (e.i === e.j) {
        const at = b.map[e.i - 1];
        if (at) changes.push({ s: at.e, e: at.e, to: e.wbr ? "<wbr>" : e.to });
        continue;
      }
      // a space may span several text nodes («в </b> дом»): the first part becomes the no-break space, the rest goes
      let first = true;
      for (let c = e.i; c < e.j; c++) {
        const at = b.map[c];
        if (!at || !at.whole) continue;
        changes.push({ s: at.s, e: at.e, to: first ? e.to : "" });
        first = false;
      }
    }
    const { toks, holds, released } = decide(b.text, o);
    const longest = pieces(toks, holds).reduce((m, p) => (p.length > m.length ? p : m), { length: 0 });
    const findings = lint(b.text, o).map((f) => {
      // where the finding is in the source (for --fix): an insertion goes after the character before it
      const from = f.i === f.j ? b.map[f.i - 1] && { s: b.map[f.i - 1].e, e: b.map[f.i - 1].e } : b.map[f.i] && b.map[f.j - 1] && { s: b.map[f.i].s, e: b.map[f.j - 1].e };
      return { ...f, src: from || null, at: from ? lineCol(src, from.s) : null, text: b.text.slice(f.i === f.j ? f.i - 1 : f.i, f.i === f.j ? f.j + 2 : f.j) };
    });
    report.push({
      lang: o.lang, heading: b.heading, text: b.text.replace(/\s+/g, " ").trim(),
      at: b.map.find(Boolean) ? lineCol(src, b.map.find(Boolean).s) : null,
      holds: holds.filter((h) => h.rule !== "author").map((h) => h.rule), released: released.map((h) => h.rule),
      longest: toks.slice(longest.from, longest.to + 1).map((t) => (t.t === "s" ? NBSP : t.s)).join("").trim(), longestLength: longest.length,
      findings,
    });
  }
  // merge the changes into the source, from the end so the offsets stay right
  changes.sort((a, b) => b.s - a.s || b.e - a.e);
  let html = src, last = Infinity;
  for (const c of changes) {
    if (c.e > last) continue;                                        // never two changes on one character
    html = html.slice(0, c.s) + c.to + html.slice(c.e);
    last = c.s;
  }
  return { html, report };
}
