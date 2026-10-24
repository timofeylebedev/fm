# Measuring scripts

Python Playwright (and one Node script), run from this folder. Serve the old build on http://127.0.0.1:8001/ and the
new one on :8002 first (`python3 -m http.server 8001 --bind 127.0.0.1` in a copy of each `dist/`). `lib.py` finds
Playwright's Chromium under `/opt/pw-browsers` by itself (the folder name changes with its version), or takes
`PLAYWRIGHT_CHROMIUM`.

**The scrollbar gutter.** Since the booking window (Oct 20) main's `html` has `scrollbar-gutter: stable` (book.css).
Overlay scrollbars (a Mac, phones) ignore it, but headless Chromium fills it like a classic 15px scrollbar even with
`--hide-scrollbars`, so a page measured at 390 is 375 wide and every layout step shows up 15–20px late. `lib.prep(ctx)`
takes it out of the served CSS (all scripts here use it); `FM_GUTTER=1` keeps it (to measure as with a classic scrollbar).

## Round 6 (Oct 24, the design-system analysis of main)

- `fullsweep.py url out.json` — the whole responsive picture: every size of the page (type, spacing, radii, paddings,
  blocks, the hero's parts) and every block's layout state (keys starting with `@`: navbar, hero title lines, stack
  card, royalty, ID cards, features, logos, tools, publications, footer) at every 10px of width (1100 tall) and every
  25px of height (1440 wide). Run on both builds; the page's picture block and responsive map use the two files.
- `areas.py url out.json` — the hero, the tools, the tiles, the ID cards and the footer at 24 real screen sizes.
- `sections.py url prefix W H [mobile] [dpr]` — one screenshot per section (reduced motion), for looking.
- `pair.py out.jpg W H mobile dpr "<js: scrollY>" [crop] [wait]` — a before/after picture; `FM_CALM=1` reduced motion,
  `FM_PATH=privacy_policy_ru.html` another page, `FM_OLD` / `FM_NEW` other servers.
- `rules.mjs` (Node, from the repository root) — the system's implicit rules as a lint over scale.json, tokens,
  decisions.json, CLAUDE.md and the stylesheets: ladder, relations, no CSS in comments, colours from tokens, type from
  the scale, no own fluid values, every var defined / token used, layout steps, screen steps, one table of curves,
  decisions complete. A prototype for `npm run rules` (not in CI until Tim says so). `--json out.json` for the report.
- `round6.py` + `round6_changes.py` + `round6_findings.py` — write `../data.json` from the measurements in
  `../measure/`, round 5's published page (`../measure/published-oct23.json`) and round 4's data.json from git:
  `python3 -I round6.py ../measure/r6-sweep-before.json ../measure/r6-sweep-now.json ../measure/r6-areas-before.json ../measure/r6-areas-now.json ../measure/r6-rules.json ../measure/r6-audit.txt ../measure/r6-review.json`
  (before = main at edeb745, the build round 5 measured, served on :8001; now = bd0566f on :8002).
- Round 5 (Oct 23, another chat) published its page without committing its source; its data and pictures were taken
  out of the published page this round (`../measure/published-oct23.json`, `../shots/r5a-*`). Its rules.mjs is lost;
  this folder's `rules.mjs` is a new one.
- The DOM extraction of the `analyzing-design-systems` skill (`extract_dom.cjs` + `analyze.py`) was run from a scratch
  copy with three edits (Chromium path and swiftshader flags, `bypassCSP`, a time limit on `document.fonts.ready` and a
  top-to-bottom scroll). Its "76 text styles" and "off-grid spacing" findings are artefacts of fluid sizing.

## Round 4 (Oct 19)

- `grid.py W H mobile url out.png [n] [wait]` — a frame grid through the card stack.
- `hand.py W H mobile url out.png [k]` — frames through the hand-off of card k → k+1 (the pinned pill, now removed).
- `edge.py W H dpr url out.png` — high-DPR frames where two cards meet (the hairlines).
- `seams.py W H dpr url` — counts hairlines of card colour in the strips across the stack.
- `herom.py url out.json` — the hero's parts at 22 screen sizes (areas.py now covers it).
- `sweep.py` — the hero across widths and heights (fullsweep.py now covers it).
- `navt.py url` — the sideways navbar: stays with the hero, follows, settles.
- `errs.py` — scrolls down and up in normal, reduced-motion and debug modes and prints console errors.
- `jsy.py` — a stack position as JS for pair.py; `ovf.py` — sideways scroll at 101 widths.
