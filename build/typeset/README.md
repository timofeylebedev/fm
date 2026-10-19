# Typeset: where the lines of a text may break

The browser breaks a line at any space and after any hyphen or dash. Typesetting decides which of those places a
reader should never see a line end at: «в | доме», «10 | км», «Dr. | Smith», «— » at the start of a line, «e- | mail».
This folder does that for the site's pages when they are built, for Russian and English, and the same code can run
anywhere a text is (a script's message, a Figma layer, a file on the command line).

It replaced `build/typograph.js` (Oct 19, 2026). What changed, measured: see the decision `typeset` in
`design/decisions.json`.

## Files

| file | what it is |
|---|---|
| `core.js` | the rules, on plain text, no dependencies (runs in Node, the browser, Figma's plugin code) |
| `words.js` | the word lists the rules read (prepositions, units, labels, honorifics…) |
| `html.js` | the rules on an HTML page: a real parser (parse5), texts joined across inline tags, the language of each block |
| `lint.js` | the visible characters a proofreader would change: reported, never changed by the build |
| `cli.mjs` | `npm run typeset -- …` |
| `test.mjs` | `npm run test:typeset`: every rule as examples |

## How it works

1. **Blocks.** `html.js` reads the page with parse5 and collects the text of every block (a `p`, `h1`–`h6`, `li`, `td`,
   `div`…). Inline tags (`a`, `span`, `b`, `em`…) are part of the block: «в <a>доме</a>» is one text. A `<br>` ends a
   text. `<template>` content is included (the cookie notice). Left alone: `script`, `style`, `svg`, `pre`, `code`,
   `kbd`, `samp`, `var`, `textarea`, `noscript`, anything with `data-typeset="off"` or `contenteditable`, the `<head>`,
   and every attribute.
2. **Language.** Each block takes the nearest `lang` attribute (`<html lang="ru">`, a `<span lang="en">` inside it).
   `ru` and `en` have their own rules; any other language gets the rules for every language.
3. **Tokens.** The text is cut into words, numbers, spaces, punctuation, dashes, hyphens, signs, and whole pieces for
   links, e-mails and phones.
4. **One answer per space.** For every space the rules are asked in order; the first that has a view answers: *hold*
   (with a strength), *break*, or no view (the next rule is asked). Nothing is done in passes, so a chain like «а не в
   последний» is held word by word (the old typograph missed every second word of a chain).
5. **Joins.** Where two parts touch with no space but a browser may still break (after a hyphen or a dash), a hold is a
   word joiner (U+2060): invisible, and the real hyphen stays, so copying and searching still find «e-mail».
6. **A limit.** Holds make longer pieces a line cannot break inside. When a piece grows past **28 letters** in text or
   **16 in a heading**, the weakest holds in it are let go (of equal ones, the one nearest the middle), until it fits or
   only *must* holds are left. So a phone never gets a piece wider than its column.
7. **In place.** Only the characters the rules decide on change, at their place in the source; entities (`&nbsp;`,
   `&laquo;`, `&#8209;`) and everything else stay exactly as written.

Strengths: *author* 9 (a no-break space you typed: kept, except next to a link) · *must* 3 (never let go) · *should* 2
· *nice* 1.

## The rules

Marks: `⍽` no-break space, `⁀` word joiner, `¦` a place a long link may break (`<wbr>`).

### Any language

| rule | strength | example |
|---|---|---|
| link-free | — | a word is never held to a link or an e-mail (they are long); a typed `&nbsp;` there is let go |
| author | 9 | a no-break space already in the text stays |
| copyright | must | `©⍽2026` |
| sign-number | must | `№⍽5`, `§⍽3`, `¶⍽49` |
| digit-groups | must | `10⍽000⍽000` |
| number-sign | must | `5⍽%`, `100⍽₽`, `20⍽°C` |
| currency-number | must | `$⍽100` |
| dash | should | `лейбл⍽— на одной волне`: a spaced dash never starts a line (a closed `word—word` is left as it is) |
| initials | must | `А.⍽С.⍽Пушкин`, `J.⍽R.⍽R.⍽Tolkien` |
| last-word | nice | the last word of a text of 4+ words, if it has 3 letters or fewer, does not stand alone: `Напишите⍽нам`, `CEO`|
| range (join) | must | `2022–⁀2025`, `2-⁀11` |
| short-part (join) | should | `COVID-⁀19`, `1-⁀й`, `e-⁀mail`, `из-⁀за`, `кто-⁀то`, `кое-⁀как`; long parts still break: `Telegram-бот` |
| link breaks | — | `hello@¦flowmedium¦.pro`, `https://¦yandex¦.ru/¦legal/` (links of 16+ characters) |
| phone | must | `+7⍽(904)⍽512-⁀51-⁀50` is one piece |

### Russian (`lang="ru"`)

| rule | strength | example |
|---|---|---|
| particle | should | `сделал⍽бы`, `так⍽ли`, `он⍽же` |
| org | must | `ООО⍽«Ромашка»`, `ИП⍽Поплавский` |
| abbr-pair | must | `т.⍽е.`, `и⍽т.⍽д.`, `в⍽т.⍽ч.` |
| label-number | must | `ст.⍽6`, `п.⍽5`, `глава⍽3`, `в параграфе⍽3` (the number goes with its label, not with the next word: `3 Политики` breaks) |
| pointer | should | `см.⍽раздел`, `напр.⍽так` |
| name-initials | should | `Поплавский⍽М.⍽К.` |
| number-word | must / should | units, years, months: `10⍽км`, `27⍽июля`, `2006⍽г.` (must); what a number counts: `20⍽000⍽договоров` (should); never a capitalised word (`3 Политики`), a short word (`2026 и`) or after a label (`части⍽1 статьи`) |
| short-word | should | one- and two-letter words and `без для над под при про обо изо ото что как или меж ибо`: `в⍽доме`, `без⍽уточнений`, `а⍽не⍽в⍽последний`; not abbreviations in capitals (`РФ о`, `ПД (п. 1`), not particles, not the end of a hyphenated word (`кто-то из`); hyphenated prepositions count (`из-за⍽этого`) |

Sources: А. Э. Мильчин, Л. К. Чельцова, «Справочник издателя и автора» (no-break spaces after prepositions and
conjunctions, with numbers and units, initials, abbreviations); the rules of [Typograf](https://github.com/typograf/typograf)
(compared below).

### English (`lang="en"`)

| rule | strength | example |
|---|---|---|
| honorific | must | `Dr.⍽Smith`, `Mr⍽Smith`, `Prof.⍽Lee` |
| name-suffix | must | `Smith,⍽Jr.` |
| label-number | must | `Fig.⍽3`, `page⍽12`, `No.⍽5`, `Chapter⍽2`, `Art.⍽6` |
| month-day | must | `October⍽19`, `Oct.⍽19`, `19⍽October` |
| number-word | must / should | units: `9⍽am`, `5⍽GB`, `10⍽km`, `30⍽min` (must); what is counted: `20,000⍽contracts` (should); not `2026 the`, not capitalised words |
| short-word | should / nice | `a`, `an`, `the`, `I` stay with the next word (`the⍽label`, `I⍽think`); in headings also `of to in on at by for and or nor but as if is it so up via per vs am are was be my our its` (nice) |

English is lighter than Russian on purpose: English typesetting does not forbid a line ending in «of» or «to» in
running text, and holding every small word makes lines more ragged. Sources: Matthew Butterick, *Practical Typography*,
«Nonbreaking spaces» (§ and ¶ references, «Fig. 23», honorifics, © and ™); *The Chicago Manual of Style* (numbers with
units, dates, initials); Robert Bringhurst, *The Elements of Typographic Style* (no line ending with a single-letter
word in display type).

## What the build reports instead of changing

`npm run typeset -- --lint src/*.html` lists, with line and column:

| check | example | the fix it suggests |
|---|---|---|
| mixed-script | `сookie` (a Cyrillic с) | — (retype the word) |
| quotes | `"кавычки"` | `«кавычки»` in Russian (`„…“` inside), `“…”` in English (`‘…’` inside) |
| apostrophe | `it's` | `it’s` |
| ellipsis | `...` | `…` |
| hyphen-as-dash | `слово - слово` | `—` |
| double-hyphen | `--` | `—` |
| range | `2022-2025` | `2022–2025` (not dates `2026-10-19` or codes `512-51-50`) |
| times | `1920x1080` | `1920×1080` |
| number-sign | `№152` | `№⍽152` (Russian) |
| space-before | `слово ,` | `слово,` |

`--fix` writes the suggested fixes into the files (commit first; review with `git diff`).

## Command line

```
npm run typeset -- src/index.html                  every text of the page with its holds and [its longest piece]
npm run typeset -- --lint src/*.html               only the findings
npm run typeset -- --text "Dr. Smith on page 12" --lang en [--heading]
npm run typeset -- --json src/index.html           everything as JSON
npm run test:typeset                               the examples
```

## In other places

- **A script's text** (`book.js`, `cookies.js`): `import { typeset } from "../../build/typeset/core.js"` and
  `el.textContent = typeset("Открыть запись на сайте Планёрки", { lang: "ru" })` (≈ 5 KB gzipped with the word lists).
  Not done yet: the site's few script texts are short.
- **Figma**: `core.js` has no imports but `words.js`; pasted into `use_figma` together, `typeset(node.characters)`
  gives the layer the same breaks as the site.
- **Another project**: copy the folder (parse5 and entities are the only packages `html.js` needs).

## Fonts

Only U+00A0 (no-break space), U+2060 (word joiner, drawn as nothing) and `<wbr>` are written into pages. The site's
fonts have U+00A0; U+2060 is a default-ignorable character that browsers never draw, so it needs no glyph. The narrow
no-break space (U+202F), which Russian rules use between digit groups, is not in Golos or Pragmatica Ext, so digit
groups get the ordinary no-break space.
