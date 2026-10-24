// The typesetter's rules, on plain text. No dependencies: the same code can run at build time (html.js), in the
// browser (texts made by scripts) and in Figma (use_figma), so a text breaks into lines the same way everywhere.
//
// How it works. A text is cut into tokens (words, numbers, spaces, punctuation, dashes, links…). Every space is then a
// question with one answer: may a line break here, or not? The rules answer it one space at a time, looking at the
// words on both sides, so there are no passes and no chains to miss. A «no» is a no-break space; where two parts touch
// without a space (a hyphen, a dash between numbers) a «no» is a word joiner, U+2060, which is invisible and keeps the
// real hyphen (copying and searching still find «e-mail»). There is no length limit on what is held together (Tim,
// Oct 24, 2026): a hold is never let go because the piece it makes is long.
//
// The rules are written down in README.md, with the sources they come from.
import { RU, EN, FUNCTION } from "./words.js";

export const NBSP = "\u00A0", WJ = "\u2060", ZWSP = "\u200B";
const STRENGTH = { author: 9, must: 3, should: 2, nice: 1 };

// ── tokens ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// w word · n number · s space · p punctuation · d dash · h hyphen inside a word · x sign · a link, e-mail or phone
// (one piece) · o an object between the words (a picture, an icon: OBJ in the text) · z an invisible mark already there
export const OBJ = "\uFFFC";
const ATOMS = [
  /\b(?:https?:\/\/|www\.)[^\s\u00A0<>«»"“”]*[^\s\u00A0<>«»"“”.,;:!?)\]]/gu,
  /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu,
  /(?:\+\d{1,3}|\b8)[\s ]?\(?\d{3,4}\)?[\s ]?\d{2,3}[-‑\s ]\d{2}[-‑\s ]\d{2}\b/gu,
  /(?:\+1[\s ]?)?\(\d{3}\)[\s ]?\d{3}-\d{4}\b|\b\d{3}-\d{3}-\d{4}\b/gu,
];
const TOKEN = /([\p{L}\p{M}]+(?:['\u2019][\p{L}\p{M}]+)*)|(\d+(?:[.,]\d+)*)|([\s\u00A0\u202F]+)|([\u2014\u2013])|(-)|([\u2060\u200B\u00AD\uE000]+)|(\uFFFC)|([.,:;!?\u2026()[\]{}\u00AB\u00BB\u201E\u201C\u201D\u2018\u2019"'\/])|([\s\S])/gu;

export function tokenize(text) {
  const atoms = [];
  for (const re of ATOMS) for (const m of text.matchAll(re)) {
    const i = m.index, j = i + m[0].length;
    if (!atoms.some((a) => i < a.j && j > a.i)) atoms.push({ i, j, kind: re === ATOMS[0] ? "url" : re === ATOMS[1] ? "email" : "phone" });
  }
  atoms.sort((a, b) => a.i - b.i);
  const toks = [];
  let at = 0;
  const lex = (end) => {
    TOKEN.lastIndex = at;
    let m;
    while (at < end && (m = TOKEN.exec(text)) && m.index < end) {
      let s = m[0], t;
      if (m.index + s.length > end) s = s.slice(0, end - m.index);
      if (m[1]) t = "w"; else if (m[2]) t = "n"; else if (m[3]) t = "s"; else if (m[4]) t = "d";
      else if (m[5]) t = "h"; else if (m[6]) t = "z"; else if (m[7]) t = "o"; else if (m[8]) t = "p"; else t = "x";
      toks.push({ t, s, i: m.index, j: m.index + s.length });
      at = m.index + s.length;
      TOKEN.lastIndex = at;
    }
  };
  for (const a of atoms) { lex(a.i); toks.push({ t: "a", s: text.slice(a.i, a.j), i: a.i, j: a.j, kind: a.kind }); at = a.j; }
  lex(text.length);
  // a hyphen with spaces round it (or at the start, before a space) is a dash: «слово - слово»
  toks.forEach((k, n) => {
    if (k.t !== "h") return;
    const before = toks[n - 1], after = toks[n + 1];
    if ((!before || before.t === "s") && (!after || after.t === "s")) k.t = "d";
  });
  return toks;
}

// ── helpers the rules read the tokens with ──────────────────────────────────────────────────────────────────────────
const CYR = /\p{Script=Cyrillic}/u, LAT = /\p{Script=Latin}/u;
const isWord = (k) => k?.t === "w", isNum = (k) => k?.t === "n";
const low = (k) => k.s.toLowerCase();
const isCap = (k) => isWord(k) && k.s[0] !== k.s[0].toLowerCase();
const isCaps = (k) => isWord(k) && k.s.length > 1 && k.s === k.s.toUpperCase() && k.s !== k.s.toLowerCase();
const cyr = (k) => isWord(k) && CYR.test(k.s) && !LAT.test(k.s);
const lat = (k) => isWord(k) && LAT.test(k.s) && !CYR.test(k.s);
const letters = (k) => [...k.s].length;
const opens = (k) => isWord(k) || isNum(k) || (k?.t === "p" && "(«„“‘\"'[".includes(k.s)) || k?.t === "x" && "№§¶#$€£₽".includes(k.s);
// the word a dot after it makes an abbreviation of: «т.», «Dr.», «Fig.» (the token before the space is the dot)
const abbr = (toks, k) => (toks[k - 1]?.s === "." && isWord(toks[k - 2]) && toks[k - 3]?.t !== "w" ? toks[k - 2] : null);
// the number at k + 1 already belongs to a label before it («части⍽1 статьи»: the 1 is the part's, not the article's)
const labelled = (toks, k, labels) => {
  const before = toks[k - 1];
  if (!before || before.t !== "s") return false;
  const w = labelWord(toks, k - 1);
  return !!w && labels.has(low(w));
};
// a label before a number: an abbreviation with its dot («ст.⍽6»), or a whole word («глава⍽3»); one letter only with
// the dot, since «с», «т», «д» are also words («с 1 января» is not a page)
const labelWord = (toks, k) => abbr(toks, k) || (isWord(toks[k - 1]) && letters(toks[k - 1]) > 1 ? toks[k - 1] : null);
// a unit after a number: one letter only with its dot («2006⍽г.», «XX⍽в.»), since «в», «с», «т» are also words
const unitAt = (toks, k, units) => units.has(low(toks[k])) && (letters(toks[k]) > 1 || toks[k + 1]?.s === ".");
// a word that is the first part of a hyphenated word is not a word of its own: «кто-то из» (the «то»)
const inCompound = (toks, k) => toks[k - 2]?.t === "h" || toks[k - 2]?.s === "'" || toks[k - 2]?.s === "’";
const compoundPrep = (toks, k) => toks[k - 2]?.t === "h" && isWord(toks[k - 3]) && RU.compoundPreps.has(low(toks[k - 3]) + "-" + low(toks[k - 1]));

// ── the rules: one space at a time ──────────────────────────────────────────────────────────────────────────────────
// g = { toks, k (the space), L, R (the tokens on each side), lang, heading, last (R is the block's last word), words }
// A rule returns a strength (hold the two together), "break" (let it break, ask no further rules) or anything else (no
// view: the next rule is asked).
export const RULES = [
  // never hold a word to a link or an e-mail: they are long, the pair would not fit a phone (even a no-break space
  // typed there is let go: «по адресу:&nbsp;https://…» came from the old site's editor)
  { name: "link-free", lang: "*", test: (g) => (g.L?.t === "a" && g.L.kind !== "phone") || (g.R?.t === "a" && g.R.kind !== "phone") ? "break" : 0 },
  // the space is already a no-break one: the author put it there
  { name: "author", lang: "*", test: (g) => /[\u00A0\u202F]/.test(g.toks[g.k].s) && STRENGTH.author },
  { name: "object-free", lang: "*", test: (g) => (g.L?.t === "o" || g.R?.t === "o" ? "break" : 0) },
  // «© 2026», «℗ Flow Medium»
  { name: "copyright", lang: "*", test: (g) => "©℗®".includes(g.L?.s) && g.L.t === "x" && (isNum(g.R) || isWord(g.R)) && STRENGTH.must },
  // «№ 5», «§ 3», «¶ 49», «# 12»
  { name: "sign-number", lang: "*", test: (g) => g.L?.t === "x" && "№§¶#".includes(g.L.s) && isNum(g.R) && STRENGTH.must },
  // «10 000», «1 500 000»: the groups of a number
  { name: "digit-groups", lang: "*", test: (g) => isNum(g.L) && /^\d{1,3}$/.test(g.L.s) && isNum(g.R) && /^\d{3}(?:[.,]\d+)?$/.test(g.R.s) && STRENGTH.must },
  // «5 %», «100 ₽», «20 °C»
  { name: "number-sign", lang: "*", test: (g) => isNum(g.L) && g.R?.t === "x" && "%‰°₽$€£¥₸′″".includes(g.R.s) && STRENGTH.must },
  // «$ 100», «€ 5»
  { name: "currency-number", lang: "*", test: (g) => g.L?.t === "x" && "$€£¥₽₸".includes(g.L.s) && isNum(g.R) && STRENGTH.must },
  // a dash never starts a line: «лейбл — на одной волне», «2022 – 2025»
  { name: "dash", lang: "*", test: (g) => g.R?.t === "d" && STRENGTH.should },
  // «А. С. Пушкин», «J. R. R. Tolkien», «М. К. Поплавский»
  // (a single capital and a dot may also end a sentence, «план Б. Затем»: then the hold is only a should, and a
  // capital after it must be followed by a dot or be a name-like word, not «It» or «В»)
  { name: "initials", lang: "*", test: (g) => {
    const a = abbr(g.toks, g.k);
    if (!a || letters(a) !== 1 || !isCap(a) || !isCap(g.R)) return;
    const initial = (w) => w && letters(w) === 1 && isCap(w);
    // a chain: another initial follows («А. С.»), or one came before («А. С. Пушкин», the gap after «С.»)
    const chain = (letters(g.R) === 1 && g.toks[g.k + 2]?.s === ".") || (g.toks[g.k - 3]?.t === "s" && initial(abbr(g.toks, g.k - 3)));
    if (chain) return STRENGTH.must;
    return letters(g.R) > 2 && !FUNCTION.has(low(g.R)) && STRENGTH.should;
  } },

  // ── Russian ──
  // «сделал бы», «так ли», «он же»
  { name: "particle", lang: "ru", test: (g) => cyr(g.R) && RU.particles.has(g.R.s) && g.toks[g.k + 2]?.t !== "h" && (isWord(g.L) || isNum(g.L)) && STRENGTH.should },
  // «ООО «Ромашка»», «ИП Поплавский»
  { name: "org", lang: "ru", test: (g) => cyr(g.L) && isCaps(g.L) && RU.orgs.has(low(g.L)) && opens(g.R) && STRENGTH.must },
  // «т. е.», «т. д.», «т. п.», «в т. ч.»
  { name: "abbr-pair", lang: "ru", test: (g) => { const a = abbr(g.toks, g.k); return a && RU.pairs[low(a)]?.has(low(g.R)) && g.toks[g.k + 2]?.s === "." && STRENGTH.must; } },
  // «ст. 6», «п. 5», «глава 3», «параграфе 3»
  { name: "label-number", lang: "ru", test: (g) => {
    // «ИНН: 7701…»: a label with a colon
    const w = labelWord(g.toks, g.k) || (g.L?.s === ":" && isWord(g.toks[g.k - 2]) ? g.toks[g.k - 2] : null);
    return w && cyr(w) && RU.labels.has(low(w)) && isNum(g.R) && STRENGTH.must;
  } },
  // «г. Москва», «ул. Тверская», «пр. Мира» (not «2006 г. В том году»: after a number the «г.» is a year)
  { name: "place", lang: "ru", test: (g) => { const a = abbr(g.toks, g.k); return a && RU.places.has(low(a)) && !isNum(g.toks[g.k - 4]) && isCap(g.R) && STRENGTH.should; } },
  // «XX в.», «XIX вв.»: a century in Roman numerals
  { name: "century", lang: "ru", test: (g) => isWord(g.L) && /^[IVXLC]+$/.test(g.L.s) && cyr(g.R) && /^(в|вв)$/.test(g.R.s) && g.toks[g.k + 2]?.s === "." && STRENGTH.must },
  // «5 млн руб.», «10 тыс. ₽»
  { name: "amount-currency", lang: "ru", test: (g) => { const w = abbr(g.toks, g.k) || (isWord(g.L) ? g.L : null); return w && /^(тыс|млн|млрд|трлн)$/.test(low(w)) && (cyr(g.R) && /^(руб|р|долл|евро|коп)$/.test(low(g.R)) || g.R?.t === "x" && "₽$€".includes(g.R.s)) && STRENGTH.must; } },
  // «см. раздел», «ср. выше», «напр. так»
  { name: "pointer", lang: "ru", test: (g) => { const a = abbr(g.toks, g.k); return a && RU.pointers.has(low(a)) && opens(g.R) && STRENGTH.should; } },
  // «Поплавский М. К.», «Пушкин А. С.»
  { name: "name-initials", lang: "ru", test: (g) => cyr(g.L) && isCap(g.L) && !isCaps(g.L) && cyr(g.R) && letters(g.R) === 1 && isCap(g.R) && g.toks[g.k + 2]?.s === "." && STRENGTH.should },
  // a number and what it counts: «10 км», «27 июля», «2006 г.», «20 000 договоров»
  { name: "number-word", lang: "ru", test: (g) => isNum(g.L) && cyr(g.R) && !labelled(g.toks, g.k - 1, RU.labels) && !isCap(g.R) && (unitAt(g.toks, g.k + 1, RU.units) ? STRENGTH.must : letters(g.R) > 2 && !FUNCTION.has(low(g.R)) && STRENGTH.should) },
  // prepositions, conjunctions, any word of one or two letters: «в доме», «и он», «на столе», «без уточнений»
  { name: "short-word", lang: "ru", test: (g) => cyr(g.L) && (letters(g.L) <= 2 || RU.short3.has(low(g.L))) && !(letters(g.L) > 1 && isCaps(g.L)) && !RU.particles.has(low(g.L)) && (!inCompound(g.toks, g.k) || compoundPrep(g.toks, g.k)) && opens(g.R) && STRENGTH.should },

  // ── English ──
  // «Dr. Smith», «Mr Smith»
  { name: "honorific", lang: "en", test: (g) => { const w = abbr(g.toks, g.k) || (isWord(g.L) ? g.L : null); return w && isCap(w) && EN.honorifics.has(low(w)) && isCap(g.R) && STRENGTH.must; } },
  // «Smith, Jr.», «Smith Jr.»
  { name: "name-suffix", lang: "en", test: (g) => lat(g.R) && EN.suffixes.has(low(g.R)) && isCap(g.R) && (g.L?.s === "," || isCap(g.L)) && STRENGTH.must },
  // «Fig. 3», «page 12», «No. 5», «Chapter 2»
  // (a short label in lower case needs its dot: «there are no 5-star…» is not «No. 5»)
  { name: "label-number", lang: "en", test: (g) => {
    const w = abbr(g.toks, g.k) || (isWord(g.L) && (letters(g.L) > 3 || isCap(g.L)) ? g.L : null);
    return w && lat(w) && EN.labels.has(low(w)) && isNum(g.R) && STRENGTH.must;
  } },
  // «October 19», «Oct. 19», «19 October»
  { name: "month-day", lang: "en", test: (g) => {
    const w = abbr(g.toks, g.k) || (isWord(g.L) ? g.L : null);
    if (w && isCap(w) && EN.months.has(low(w)) && isNum(g.R)) return STRENGTH.must;
    return isNum(g.L) && g.L.s.length <= 2 && isCap(g.R) && EN.months.has(low(g.R)) && STRENGTH.must;
  } },
  // a number and its unit, or what it counts: «10 km», «9 am», «5 GB», «20,000 contracts» (not «in 2026 the…»)
  { name: "number-word", lang: "en", test: (g) => isNum(g.L) && lat(g.R) && !labelled(g.toks, g.k - 1, EN.labels) && (unitAt(g.toks, g.k + 1, EN.units) || /^[ap]$/i.test(g.R.s) && g.toks[g.k + 2]?.s === "." && /^m$/i.test(g.toks[g.k + 3]?.s ?? "") ? STRENGTH.must : !isCap(g.R) && !FUNCTION.has(low(g.R)) && STRENGTH.should) },
  // «a song», «the label», «I am»; in headings also «of the», «to it»…
  { name: "short-word", lang: "en", test: (g) => {
    if (!lat(g.L) || inCompound(g.toks, g.k) || !opens(g.R)) return;
    if (EN.short.has(low(g.L)) || g.L.s === "I") return STRENGTH.should;
    return g.heading && EN.headingShort.has(low(g.L)) && STRENGTH.nice;
  } },

  // ── any language ──
  // a short last word does not stand alone on the last line: «…и как изменилась цена» stays, «…what it is» → «it⍽is»
  { name: "last-word", lang: "*", test: (g) => g.last && g.words >= 4 && isWord(g.R) && letters(g.R) <= 3 && (isWord(g.L) || isNum(g.L) || (g.L.t === "p" && ",;:".includes(g.L.s))) && STRENGTH.nice },
];

// where two parts touch with no space, a line may still break after a hyphen or a dash: these joins forbid it
export const JOINS = [
  // «2022–2025», «10–12», «9-5»: a range of numbers
  { name: "range", test: (L, R) => isNum(L) && isNum(R) && STRENGTH.must },
  // «COVID-19», «1-й», «5-летний», «e-mail», «из-за», «кто-то», «кое-как»
  { name: "short-part", test: (L, R, lang) => (isWord(L) || isNum(L)) && (isWord(R) || isNum(R)) &&
      (isNum(L) || isNum(R) || letters(L) <= 2 || letters(R) <= 2 || (lang === "ru" && (RU.hyphenParts.has(low(R)) || low(L) === "кое"))) && STRENGTH.should },
];

// ── deciding ────────────────────────────────────────────────────────────────────────────────────────────────────────
// options: lang ("ru", "en", …; other languages get only the rules for any language), heading (a heading: shorter
// lines, a few more holds), off (names of rules to leave out: { off: ["last-word"] }).
export function decide(text, { lang = "ru", heading = false, off = [] } = {}) {
  const base = String(lang).toLowerCase().split("-")[0];
  // the rules read the visible tokens: invisible marks (a word joiner, the edge of an inline tag) are left out
  const toks = [];
  for (const k of tokenize(text)) {
    if (k.t === "z") continue;
    const prev = toks.at(-1);
    // «в </b> доме»: the spaces on both sides of a tag edge are one space
    if (k.t === "s" && prev?.t === "s") { prev.j = k.j; prev.s = text.slice(prev.i, k.j); continue; }
    toks.push(k);
  }
  const wordIdx = toks.map((k, n) => (isWord(k) ? n : -1)).filter((n) => n >= 0);
  // the last word counts only if nothing but punctuation comes after it («…what it is.»)
  const lastWord = toks.slice(wordIdx.at(-1) + 1).every((k) => k.t === "p" || k.t === "s" || k.t === "z") ? wordIdx.at(-1) : -1;
  const words = wordIdx.length;
  const rules = RULES.filter((r) => (r.lang === "*" || r.lang === base) && !off.includes(r.name));
  const holds = [];                                                  // { k, kind: "nbsp" | "join", rule, strength }
  toks.forEach((tok, k) => {
    if (tok.t === "s") {
      const g = { toks, k, L: toks[k - 1], R: toks[k + 1], lang: base, heading, last: k + 1 === lastWord, words };
      if (!g.L || !g.R) return;                                      // the space at the start or the end of a text
      for (const r of rules) {
        const v = r.test(g);
        if (v === "break") { if (/[\u00A0\u202F]/.test(tok.s)) holds.push({ k, kind: "free", rule: r.name, strength: 0, released: true }); return; }
        if (typeof v === "number" && v > 0) { holds.push({ k, kind: "nbsp", rule: r.name, strength: v }); return; }
      }
    } else if ((tok.t === "h" || tok.t === "d") && toks[k + 1] && toks[k + 1].t !== "s" && toks[k + 1].i === tok.j) {
      for (const j of JOINS) {
        if (off.includes(j.name)) continue;
        const v = j.test(toks[k - 1], toks[k + 1], base);
        if (v) { holds.push({ k, kind: "join", rule: j.name, strength: v }); return; }
      }
    }
  });
  return { toks, holds: holds.filter((h) => !h.released), released: holds.filter((h) => h.released) };
}

// the pieces a line cannot break inside, given the holds: [{ from, to (token indexes), length (letters) }]
export function pieces(toks, holds) {
  const held = new Set(holds.filter((h) => !h.released).map((h) => h.k));
  const out = [];
  let from = 0, length = 0;
  const cut = (to) => { if (length) out.push({ from, to, length }); from = to + 1; length = 0; };
  toks.forEach((tok, k) => {
    if (tok.t === "s") {
      if (held.has(k)) length += 1; else cut(k);
      return;
    }
    // a long link breaks inside itself (linkBreaks): it counts as its longest part
    length += tok.t === "a" && tok.kind !== "phone" ? longestPart(tok.s) : [...tok.s].length;
    const next = toks[k + 1];
    const breakable = (tok.t === "h" || tok.t === "d" || tok.s === "/") && next && next.t !== "s" && !held.has(k);
    if (breakable) { out.push({ from, to: k, length }); from = k + 1; length = 0; }
  });
  cut(toks.length);
  return out;
}

const longestPart = (atom) => {
  const at = [0, ...linkBreaks(atom), atom.length];
  return Math.max(...at.slice(1).map((j, n) => j - at[n]));
};

// where a long link or e-mail may break: after «//», «@», before «.», «?», «#», «&», after «/» (offsets in the atom)
export function linkBreaks(atom) {
  if ([...atom].length < 16) return [];
  const at = [];
  const scheme = atom.match(/^[a-z]+:\/\//i)?.[0].length || 0;
  for (let i = Math.max(scheme, 1); i < atom.length - 1; i++) {
    const c = atom[i];
    if (c === "@" || c === "/") at.push(i + 1);
    else if (".?#&=_".includes(c) && atom[i - 1] !== ".") at.push(i);
  }
  if (scheme) at.unshift(scheme);
  return [...new Set(at)].filter((i) => i > 0 && i < atom.length);
}

// ── the text with its holds ─────────────────────────────────────────────────────────────────────────────────────────
// edits on the text: [{ i, j, to }] (replace i..j with `to`); the HTML side (html.js) maps them onto the source
export function edits(text, opts = {}) {
  const { toks, holds, released } = decide(text, opts);
  const out = [];
  for (const h of released) if (h.kind === "free" || /[\u00A0\u202F]/.test(toks[h.k].s)) out.push({ i: toks[h.k].i, j: toks[h.k].j, to: " ", rule: h.rule });
  for (const h of holds) {
    const tok = toks[h.k];
    if (h.kind === "nbsp" && h.rule !== "author") out.push({ i: tok.i, j: tok.j, to: NBSP, rule: h.rule });
    if (h.kind === "join" && text[tok.j] !== WJ) out.push({ i: tok.j, j: tok.j, to: WJ, rule: h.rule });
  }
  for (const tok of toks) {
    if (tok.t !== "a") continue;
    if (tok.kind === "phone") {
      for (const m of tok.s.matchAll(/[\s]+|-/g)) {
        if (m[0] === "-") out.push({ i: tok.i + m.index + 1, j: tok.i + m.index + 1, to: WJ, rule: "phone" });
        else out.push({ i: tok.i + m.index, j: tok.i + m.index + m[0].length, to: NBSP, rule: "phone" });
      }
    } else for (const at of linkBreaks(tok.s)) if (tok.s[at] !== ZWSP && tok.s[at - 1] !== ZWSP) out.push({ i: tok.i + at, j: tok.i + at, to: "", wbr: true, rule: "link-breaks" });
  }
  return out.sort((a, b) => a.i - b.i || a.j - b.j);
}

// the plain-text version (for texts made by scripts, Figma, the command line): link breaks become U+200B
export function typeset(text, opts = {}) {
  let out = "", at = 0;
  for (const e of edits(text, opts)) { out += text.slice(at, e.i) + (e.wbr ? ZWSP : e.to); at = e.j; }
  return out + text.slice(at);
}
