# Code ↔ Figma sync

The site and the Figma file ([website-2.0](https://www.figma.com/design/JTfxQeW8liN3knCO3GWtns/website-2.0)) share
their values through one file, `design/tokens.json`. A change on either side moves only the values that changed — never
a rebuild of the page or of the Figma file.

## The three layers

| Layer | Example | Lives in | How it moves |
|---|---|---|---|
| **Values** | a colour, the footer's padding at 320 px, button height | `design/tokens.json` ↔ Figma variables | `npm run tokens:sync`: value by value, both ways, automatic |
| **Structure** | a new link in the footer, a different order, a new block | `src/index.html` + one CSS file ↔ one Figma component | Claude, one section at a time, via `design/figma-map.json` |
| **Content** | the email, the ИНН, the texts | `src/index.html` | the code; Figma copies it when a section is pushed |

Most "change the footer" requests are values. Once a section's sizes are variables, a designer's change in Figma
reaches the CSS without anyone touching the stylesheet.

## Files

- `design/tokens.json` — every Figma variable, one per line, values per breakpoint mode. **Edit values here** on the code side.
- `design/tokens.lock.json` — the values both sides held at the last sync (the base of the three-way merge). Don't edit.
- `design/figma-map.json` — the Figma file key, which screen widths each mode stands for, and which Figma component each section is.
- `design/figma/pull.js` — read-only Figma script: exports the variables. `design/figma/push.js` — template of the push script.
- `build/tokens.mjs` — writes `src/styles/base/tokens.gen.css` (runs before every `npm run dev` / `build`) and does the sync.
- `src/styles/base/tokens.gen.css` — generated, don't edit.

A variable reaches the CSS when its **Web code syntax** in Figma (the `web` field) is `var(--name)`. Colours are
written as they are; every size comes from the size system below. Variables without a Web code syntax stay Figma-only.

## The size system (`design/scale.json`)

Every fluid size of the site — type, spacing, radii, paddings — is defined in one file, `design/scale.json`, and
nowhere else. `npm run tokens` (and every `dev` / `build`) turns it into:

- `design/tokens.json`: each size's value at each Breakpoint mode (**320, 390, 768, 1024, 1440, 1920**), so the
  Figma frames show exactly what the site shows at those widths (these variables carry `"scale": true`);
- `src/styles/base/tokens.gen.css`: one formula per size. No breakpoints: nothing in the tokens jumps.

**One range.** A size has two numbers: its value on a 320px screen and on a 1440px screen. In between it goes in a
straight line; outside, it stays at the end value. In CSS:
`clamp(least, value at 320 + (screen size − 320) × slope, most)`, with the slope = (value at 1440 − value at 320) / 1120.
Example: `section/pad-y` is 40 → 80, so at 880px it is 40 + 560 × 0.0357 = 60px.

**The screen's size is not only its width.** A screen counts as only as big as its height allows (`range.height`
in `scale.json`): a screen 360px tall gets the sizes of a 320 screen, one 920px tall the sizes of a 1440 screen, in a
straight line in between. That is `--vp: min(100vw, 2 × screen height − 400px)`: every pixel of height a screen lacks
counts as two of width (the 2 and the 400 are worked out from the two heights). So a phone turned sideways
(844 × 390 → 380) gets the phone sizes, and a short laptop window (1366 × 650 → 900) the sizes of a narrower screen —
all of them together, so their ratios stay. Blocks that must fit a screen (the hero, the stack cards, the CTA card,
the pinned logos) are also sized by the height directly.

**One ladder for every size.** Type and space alike end on `0 2 4 … 24` (steps of 2), `28 32 … 64` (4), `72 80 … 128`
(8) — `ladder` in `scale.json`. `npm run tokens` stops if a role's end is off the ladder (sizes of blocks, marked
`size`, excepted). So no size ends on a value like 36.6 or 31.

**Type.** A text role is two sizes from the ladder, on a 320 and on a 1440 screen:

| Role | 320 → 1440 | Used by |
|---|---|---|
| `type/hero` | 36 → 60 | the hero title |
| `type/h2` | 28 → 52 | section headings, the CTA title, the card stack titles |
| `type/card-heading` | 24 → 32 | tool, publication and royalty titles |
| `type/lead` | 16 → 20 | under the hero and CTA titles |
| `type/card-tag` | 14 → 18 | the stack labels (a label: set apart by uppercase and weight) |
| `type/body-m` | 16 → 18 | the text of the tool cards |
| `type/body` | 16 | running text, buttons, the footer |
| `type/body-s` | 14 → 16 | the features, the bylines |
| `type/ui` | 14 | navbar, menu, footer notes |

The levels keep their order and their distance: every pair in `type.relations` (hero/h2, h2/card-heading,
card-heading/lead, card-heading/body-m, body/ui) is at least ×1.125 apart at both ends, and so at every size in between
(the ratio of two straight lines can only move from its value at one end to its value at the other). `npm run tokens`
stops otherwise. On phones some levels meet on purpose: lead = body = body-m = 16, body-s = ui = 14. Line heights
follow the size: 1 for display, 1.1 for headings, 1.2 for short text in small tiles, 1.3 for text (`--lh-*`); labels
are tracked 0.05em (`--tracking-label`).

**Space.** Every spacing and radius is two numbers from the ladder — `section/pad-y` 40 → 80, `space/gap-cards`
16 → 24, `radius/l` 32 → 56 and so on (the list is in `scale.json`, each with what it is for). Roles marked `size` are
measures of a block (the tool card's least height), not spacing. A role with `per` follows the width of its own block
instead of the screen: `tool/pad` is 28 → 64px over a card 288 → 600px wide (`100cqi` in the CSS), so a tool card on a
phone keeps a wide enough column of text.

**What is derived, not set** (written once, in `tokens.css` or the component): the navbar's height
(`--nav-h` = its padding × 2 + the 32px controls), a card's padding = its radius (concentric corners and text),
the ID card's table half a radius in with the other half as its radius, the stack card's radius = half its label +
its padding, the hero's height = the screen less twice the gap above the first stack card (on every screen).

**Layout steps.** Blocks change their layout by the width of their column (container queries), together, at three
shared steps: **S 22rem** (a 390 phone: features 1 → 2, logos 2 → 3), **M 43rem** (a 768 window: logos 3 → 4;
royalty, publications and tools 1 → 2), **L 58rem** (a 1024 window: features 2 → 4). M and L leave room for a classic
scrollbar (about 15px of the column), so a 768 or 1024 window gets its layout with one too. The ID cards' deck (35rem)
is the one exception: an object of a fixed size. Cards that arrange themselves by their own shape: the stack cards
(vertical below 1.3 : 1, and on screens 1440px tall), the royalty cards (side by side from 32rem inside the card).

**What follows a block, not the screen**: sizes inside a logo or stat tile (relative to the tile, `--u`), the hero's
chips (relative to the picture), the ID cards (a fixed-size object, scaled as a whole), the drawings.

**What changes in steps**: whole layouts — the navbar's links → burger, the footer's columns (`media.css`, where the
whole page changes), the number of columns of a grid (the layout steps above).

**Changing a size:** edit `design/scale.json`, run `npm run tokens`. A value changed in Figma for a scale variable is
reported by the sync and not taken: the scale decides (change it there).

**Decisions** that depart from a rule on purpose (a contrast kept as designed, the tool cards' extra air, the type
ladder, the layout steps…) are in
`design/decisions.json`, with who decided when and why. `npm run audit` prints them on every run with what it measured.

**Figma still has the old modes** until the next push. `npm run tokens:sync` notices the difference and the push
script it writes renames 480 → 390 (frames that use 480 keep their mode under the new name; `renamed` in
`figma-map.json`), adds 1920, writes the values, and removes 1280 last. Frames 1280 wide should be moved to 1440
or 1024 before that push.

## Recipes

**A designer changed variables in Figma → code.** Ask Claude: *"sync tokens from Figma"*. It runs `design/figma/pull.js`
with the Figma MCP tool, saves the result as `design/figma/export.json`, runs `npm run tokens:sync`, checks the pages at the
six widths and opens a PR with only the changed lines of `tokens.json` and `tokens.gen.css`.

**A developer changed values in code → Figma.** Edit `design/tokens.json`, then ask Claude: *"push tokens to Figma"*.
`npm run tokens:sync` writes `design/figma/push.gen.js` with only the changed values; Claude runs it in Figma, pulls
again and syncs, which records the values in the lock.

**Both sides changed the same value** → the sync reports a conflict (exit code 2), keeps the code's value and pushes
nothing for it. Settle it with `npm run tokens:sync -- --prefer figma` (or `code`), or by editing `tokens.json`.

**New variable.** Made in Figma → it appears in `tokens.json` on the next sync (add a Web code syntax to use it in CSS).
Added to `tokens.json` → the push creates it in Figma, in the same collection, with sensible scopes.

**Update one section from Figma (structure).** Ask Claude: *"pull the footer from Figma"*. It looks up the section in
`figma-map.json`, reads only that component's variants, compares them with the section's markup and CSS, and changes
only those files. Values bound to variables come through the token sync, not by hand.

**Push one section to Figma (structure).** Ask Claude: *"push the footer to Figma"*. It updates only that component's
variants (layers, text, bindings to variables) from the built page, and leaves the rest of the file alone.

## What is not synced, on purpose

- Values the site computes from a block: `stat/*`, `logos/*`, `hero/table-*`, `card/height`, `ring/height` and the like
  are measurements of the page at each width. They have no Web code syntax; the code does not read them.
- Font stacks: Figma has the family names, `tokens.css` keeps them with their size-matched fallbacks.
- Curves, timings and motion: code only (`tokens.css`, `scripts/motion.js`).

## Wired so far

| Section | Variables the CSS reads | Figma component |
|---|---|---|
| Colours (whole site) | the 22 colours with a Web code syntax | — |
| Footer | `footer/contact-y`, `footer/legal-y`, `type/body`, `type/ui` | Footer `22:106` |
| Buttons (whole site) | `button/height`, `button/pad-x`, `button/pad-x-alt`, `type/body` | Button |
| Type (whole site) | the eight roles of `design/scale.json`; `type/royalty`, `type/feature`, `type/body-m`, `type/body-s`, `type/button`, `type/footer`, `type/footer-note` are now Figma aliases of a role | — |
| Layout (whole site) | `section/pad-x` (the gutter), `section/pad-y`, `section/gap`, `stack/pad`, `space/gap-tiles`, `space/gap-cards`, `space/text-gap`, `space/action-gap`, `space/pad-l`, `radius/s`, `radius/m`, `radius/l` | — |
| Navbar | `nav/pad-y`, `nav/pad-left`, `nav/pad-right`, `nav/end-gap` | — |
| Card stack | `card/text-pad`, `card/tag-pad-y`, `card/tag-pad-x`, `type/card-tag` (the card's radius is derived: half the label's height + `card/text-pad`) | — |

The Figma-only measurements (`hero/*`, `card/height`, `logos/*`, `cta/height` and the like) still hold the values of
the old layout, mapped to the nearest new mode; they describe the page, the code does not read them.

Next: the Figma side of the new modes (see above), then the sections' structure (`figma-map.json`) one by one.
