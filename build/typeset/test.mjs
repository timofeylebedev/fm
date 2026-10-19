// The typesetter's examples (npm run test:typeset). ⍽ is a no-break space, ⁀ a word joiner, ¦ a place a link may break.
import { test } from "node:test";
import assert from "node:assert/strict";
import { typeset } from "./core.js";
import { typesetHtml } from "./html.js";
import { lint } from "./lint.js";

const show = (s) => s.replace(/\u00A0/g, "⍽").replace(/\u2060/g, "⁀").replace(/\u200B/g, "¦");
const check = (lang, cases, opts = {}) => {
  for (const [input, want] of cases) assert.equal(show(typeset(input, { lang, ...opts })), want, input);
};

test("Russian: short words, chains, particles, dashes", () => check("ru", [
  ["Порядок в релизах и проектах", "Порядок в⍽релизах и⍽проектах"],
  ["а не в последний момент", "а⍽не⍽в⍽последний момент"],                 // the old typograph stopped after «а⍽не»
  ["Что готово, что в работе, что горит — на одном экране", "Что⍽готово, что⍽в⍽работе, что⍽горит⍽— на⍽одном экране"],
  ["Будьте в курсе без уточнений — история под рукой", "Будьте в⍽курсе без⍽уточнений⍽— история под⍽рукой"],
  ["сделал бы так, так ли это было", "сделал⍽бы так, так⍽ли это было"],
  ["кто-то из них", "кто-⁀то из⍽них"],
  ["из-за этого", "из-⁀за⍽этого"],
  ["Telegram-бот и роялти-отчеты", "Telegram-бот и⍽роялти-отчеты"],      // long parts may break at the hyphen
  ["изменения законодательства РФ о персональных данных", "изменения законодательства РФ о⍽персональных данных"],
  ["слово - слово", "слово⍽- слово"],
]));

test("Russian: numbers, labels, initials, abbreviations", () => check("ru", [
  ["в параграфе 3 Политики", "в⍽параграфе⍽3 Политики"],                   // the old one held «3⍽Политики»
  ["в пунктах 2-11 части 1 статьи 6", "в⍽пунктах 2-⁀11⍽части⍽1 статьи⍽6"],
  ["от 27 июля 2006 г. в силе", "от⍽27⍽июля 2006⍽г. в⍽силе"],
  ["за 2022–2025 годы", "за⍽2022–⁀2025⍽годы"],
  ["более 10 000 000 стримов", "более 10⍽000⍽000⍽стримов"],
  ["рост на 5 % и 100 ₽", "рост на⍽5⍽% и⍽100⍽₽"],
  ["№ 5 и § 3", "№⍽5 и⍽§⍽3"],
  ["т. е. и т. д. и т. п.", "т.⍽е. и⍽т.⍽д. и⍽т.⍽п."],
  ["А. С. Пушкин и Поплавский М. К. пишут", "А.⍽С.⍽Пушкин и⍽Поплавский⍽М.⍽К. пишут"],
  ["ООО «Ромашка» и ИП Поплавский", "ООО⍽«Ромашка» и⍽ИП⍽Поплавский"],
  ["© 2026, Все права защищены", "©⍽2026, Все права защищены"],
  ["в 2026 и далее", "в⍽2026 и⍽далее"],
  ["(см. раздел 3)", "(см.⍽раздел⍽3)"],
]));

test("Russian: links, phones, the last word", () => check("ru", [
  ["Напишите на hello@flowmedium.pro сегодня", "Напишите на hello@¦flowmedium¦.pro сегодня"],
  ["по адресу\u00A0https://yandex.ru/legal/confidential/ сегодня", "по⍽адресу https://¦yandex¦.ru/¦legal/¦confidential/ сегодня"],
  ["Тел.: +7 (904) 512-51-50", "Тел.: +7⍽(904)⍽512-⁀51-⁀50"],
  ["Остались вопросы? Напишите нам", "Остались вопросы? Напишите⍽нам"],
  ["Роялти без споров о цифрах", "Роялти без⍽споров о⍽цифрах"],
]));

test("English: articles, names, references, numbers", () => check("en", [
  ["Go to the page of a release", "Go to the⍽page of a⍽release"],
  ["I think it is the label", "I⍽think it is the⍽label"],
  ["Dr. Smith met J. R. R. Tolkien", "Dr.⍽Smith met J.⍽R.⍽R.⍽Tolkien"],
  ["Mr Smith and John Smith, Jr. came", "Mr⍽Smith and John Smith,⍽Jr. came"],
  ["See Fig. 3 on page 12 and § 5", "See Fig.⍽3 on page⍽12 and §⍽5"],
  ["It opens on October 19, 2026 at 9 am", "It opens on October⍽19, 2026 at 9⍽am"],
  ["on 19 October we ship", "on 19⍽October we ship"],
  ["In 2026 the market grew", "In 2026 the⍽market grew"],
  ["20,000 contracts and 5 GB of data", "20,000⍽contracts and 5⍽GB of data"],
  ["2022–2025, COVID-19, e-mail, re-entry, well-known", "2022–⁀2025, COVID-⁀19, e-⁀mail, re-⁀entry, well-known"],
  ["the label — all in one place", "the⍽label⍽— all in one place"],
  ["the label—all in one place", "the⍽label—all in one place"],
  ["Contact us at hello@flowmedium.pro today", "Contact us at hello@¦flowmedium¦.pro today"],
  ["This is what it is", "This is what it⍽is"],
]));

test("English headings hold the small words too", () => check("en", [
  ["The whole label on one wave", "The⍽whole label on⍽one wave"],
  ["Order in releases and projects", "Order in⍽releases and⍽projects"],
], { heading: true }));

test("a phone never gets more than it can fit: the weakest holds go first", () => {
  const long = "а не в и на по за от до из у о без для над под при про последний";
  const out = typeset(long, { lang: "ru", cap: 12 });
  const longest = Math.max(...out.split(/ /).map((p) => p.length));
  assert.ok(longest <= 12, show(out));
});

test("a language without its own rules gets the rules for every language", () => check("de", [
  ["Das ist die Seite — 10 % von 2022–2025", "Das ist die Seite⍽— 10⍽% von 2022–⁀2025"],
]));

test("twice is the same as once", () => {
  for (const [lang, s] of [["ru", "а не в последний момент, Тел.: +7 (904) 512-51-50, hello@flowmedium.pro"], ["en", "Dr. Smith and the e-mail on page 12"]]) {
    const once = typeset(s, { lang });
    assert.equal(typeset(once, { lang }).replace(/\u200B/g, ""), once.replace(/\u200B/g, ""));
  }
});

// ── HTML ──
const page = (body, lang = "ru") => `<!doctype html><html lang="${lang}"><head><title>в доме</title></head><body>${body}</body></html>`;
const html = (body, lang) => show(typesetHtml(page(body, lang)).html).replace(/^.*<body>|<\/body>.*$/gs, "");

test("HTML: words join across inline tags, not across blocks", () => {
  assert.equal(html("<p>в <a href=x>доме</a> и <b>на</b> столе</p>"), "<p>в⍽<a href=x>доме</a> и⍽<b>на</b>⍽столе</p>");
  assert.equal(html("<p>в</p><p>доме</p>"), "<p>в</p><p>доме</p>");
  assert.equal(html("<p>в<br>доме</p>"), "<p>в<br>доме</p>");
  // the hero: two variants side by side, the edges of the spans are word edges
  assert.equal(html('<h1><span>Весь лейбл —</span><span>Весь лейбл.</span><br><span>на одной волне</span><span>На одной<br>волне</span></h1>'),
    '<h1><span>Весь лейбл⍽—</span><span>Весь лейбл.</span><br><span>на⍽одной волне</span><span>На⍽одной<br>волне</span></h1>');
});

test("HTML: the language of each block, things left alone, the source kept as it was", () => {
  assert.equal(html('<p>в доме <span lang="en">go to the page</span></p><p lang="en">a page</p>'),
    '<p>в⍽доме <span lang="en">go to the⍽page</span></p><p lang="en">a⍽page</p>');
  assert.equal(html("<p>в <code>a b</code></p><pre>в доме</pre><script>в доме</script><p data-typeset=off>в доме</p>"),
    "<p>в <code>a b</code></p><pre>в доме</pre><script>в доме</script><p data-typeset=off>в доме</p>");
  assert.equal(html("<p>R&amp;D и&nbsp;Ко &laquo;в доме&raquo; &#8209;</p>"), "<p>R&amp;D и&nbsp;Ко⍽&laquo;в⍽доме&raquo; &#8209;</p>");
  assert.equal(html("<template><p>в доме</p></template>"), "<template><p>в⍽доме</p></template>");
  assert.equal(html('<p>пишите на <a href="mailto:x">hello@flowmedium.pro</a></p>'), '<p>пишите на <a href="mailto:x">hello@<wbr>flowmedium<wbr>.pro</a></p>');
  assert.equal(html('<p title="в доме" class="a b">в доме</p>'), '<p title="в доме" class="a b">в⍽доме</p>');
  assert.equal(html("<p>в <img src=x alt=y> доме</p>"), "<p>в <img src=x alt=y> доме</p>");
});

test("HTML: the head is not touched", () => {
  const out = typesetHtml(page("<p>в доме</p>")).html;
  assert.ok(out.includes("<title>в доме</title>"));
});

// ── visible characters: reported, not changed ──
test("lint finds what a proofreader would", () => {
  const f = (s, lang = "ru") => lint(s, { lang }).map((x) => x.check + ":" + x.fix);
  assert.deepEqual(f('файлы сookie и "кавычки"'), ["mixed-script:null", "quotes:«", "quotes:»"]);
  assert.deepEqual(f('He said "it\'s fine..."', "en"), ["quotes:“", "apostrophe:it’s", "ellipsis:…", "quotes:”"]);
  assert.deepEqual(f("в 2022-2025 годы, 1920x1080, №152 ,слово - слово"), ["range:–", "times:×", "number-sign:\u00A0", "space-before:", "hyphen-as-dash:—"]);
  assert.deepEqual(f("дата 2026-10-19 и код 512-51-50"), []);
});
