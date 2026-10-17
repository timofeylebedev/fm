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

A variable reaches the CSS when its **Web code syntax** in Figma (the `web` field) is `var(--name)`. Then it is written
as `--name` in `tokens.gen.css`: the 1024 mode in `:root`, the other modes inside the custom media of `media.css`
(`--lg`, `--xl`, `--tablet`, `--phone`, `--narrow`), only where they differ. Variables without it stay Figma-only.

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

- Values the site computes (fluid sizes): `stat/*`, `logos/*`, `hero/table-*`, `card/height`, `ring/height` and the like
  are measurements of the page at each width. They have no Web code syntax; the code does not read them.
- Font stacks: Figma has the family names, `tokens.css` keeps them with their size-matched fallbacks.
- Curves, timings and motion: code only (`tokens.css`, `scripts/motion.js`).

## Wired so far

| Section | Variables the CSS reads | Figma component |
|---|---|---|
| Colours (whole site) | the 22 colours with a Web code syntax | — |
| Footer | `footer/contact-y`, `footer/legal-y`, `type/footer`, `type/footer-note` | Footer `22:106` |
| Buttons (whole site) | `button/height`, `button/pad-x`, `button/pad-x-alt`, `type/button` | Button |

Next sections to wire, in order of value: nav, section paddings (`section/*`), headings (`type/h2*`, `type/hero`),
cards. For each: replace the hard-coded px with the variables, give them a Web code syntax, add the section to
`figma-map.json`, and check that the page is pixel-identical at the six widths.
