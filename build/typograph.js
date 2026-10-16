// Non-breaking spaces for Russian text, put into the HTML when the site is built (it used to run in every visitor's
// browser). A short word stays on the line of the word after it, a dash and a particle stay with the word before them,
// a number stays with its unit, and so on. Applied to the text of <body>, not to scripts, styles and SVG.
const NBSP = " ";
const L = "а-яёА-ЯЁa-zA-Z";
const PARTICLES = "же|ли|бы|ж|б";                                   // stay with the word BEFORE them
const SHORT3 = "без|для|над|под|при|про|обо|изо|ото|что|как|или|меж"; // three-letter words that stay with the word AFTER them

const RULES = [
  // particles: «сделал бы», «он же», «так ли»
  [new RegExp("\\s+(" + PARTICLES + ")(?=[\\s\\u00A0.,!?;:…)»\"]|$)", "g"), NBSP + "$1"],
  // a space before a dash
  [/\s+([—–])/g, NBSP + "$1"],
  [/\s+-(?=\s)/g, NBSP + "-"],
  // prepositions, conjunctions and any word of 1–2 letters: «в доме», «и он», «на столе»
  [new RegExp("(^|[\\s\\u00A0(«„\"'—–])(?!(?:" + PARTICLES + ")[\\s\\u00A0])([" + L + "]{1,2}|" + SHORT3 + ")\\s+", "gi"), "$1$2" + NBSP],
  // a number and its word or unit: «10 км», «2026 год», «5 %», «100 ₽»
  [new RegExp("(\\d)\\s+(?=[" + L + "%‰₽$€°])", "g"), "$1" + NBSP],
  // groups of digits: «10 000», «1 500 000»
  [/(\d)\s+(?=\d{3}(?!\d))/g, "$1" + NBSP],
  // signs before a number: «№ 5», «§ 3»
  [/([№§])\s+(?=\d)/g, "$1" + NBSP],
  // initials: «А. С. Пушкин»
  [/([А-ЯЁ]\.)\s+(?=[А-ЯЁ])/g, "$1" + NBSP],
  // «т. е.», «т. д.», «т. п.»
  [/(т\.)\s+([дпе]\.)/g, "$1" + NBSP + "$2"]
];

export function typograph(text) {
  let prev, n = 0;
  do {                                                               // several passes, for chains like «и в том»
    prev = text;
    for (const [re, to] of RULES) text = text.replace(re, to);
  } while (text !== prev && ++n < 4);
  return text;
}

const decode = (s) => s.replace(/&nbsp;/g, NBSP).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const encode = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The text between the tags of the body of an HTML page, run through typograph()
export function typographHtml(html) {
  const start = html.search(/<body[\s>]/);
  if (start < 0) return html;
  const head = html.slice(0, start), body = html.slice(start);
  let skip = 0;                                                      // inside <script>, <style> or <svg>
  return head + body.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith("<")) {
      const m = /^<(\/?)(script|style|svg|textarea|pre|code)\b/i.exec(part);
      if (m) skip += m[1] ? -1 : part.endsWith("/>") ? 0 : 1;
      return part;
    }
    // a text node: only where there is real text (the whitespace between tags stays as it is)
    if (skip > 0 || !/\S/.test(part)) return part;
    const lead = part.match(/^\s*/)[0], trail = part.match(/\s*$/)[0];
    return lead + encode(typograph(decode(part.trim()))) + trail;
  }).join("");
}
