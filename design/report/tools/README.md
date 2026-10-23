# Measuring scripts (rounds 4 and 5)

Python Playwright, run from this folder. Old build on http://localhost:8001/, new one on :8002.

- `lib.py` — browser setup (swiftshader flags, CSP bypass) and the top-to-bottom warm-up scroll.
- `grid.py W H mobile url out.png [n] [wait]` — a frame grid through the card stack.
- `hand.py W H mobile url out.png [k]` — frames through the hand-off of card k → k+1, down and back up (the pinned pill).
- `edge.py W H dpr url out.png` — high-DPR frames where two cards meet (the hairlines).
- `seams.py W H dpr url` — counts hairlines of card colour in the strips across the stack (card content made transparent).
- `herom.py url out.json` — the hero's parts at 22 screen sizes.
- `sweep.py` — the hero across widths (320–1920 at 1100 tall) and heights (400–1440 at 1440 wide), before and after, for the review page.
- `pair.py out.jpg W H mobile dpr "<js: scrollY>" [crop] [wait]` — a before/after picture at one scroll position; `jsy.py` turns a stack position into JS.
- `navt.py url` — the sideways navbar: stays with the hero, follows, settles.
- `errs.py` — scrolls down and up in normal, reduced-motion and debug modes and prints console errors.
- `fullsweep.py url out.json` — the whole responsive picture: every key of the page's picture block (type, spacing, radii, paddings, blocks, the hero's parts) at every 10px of width (1100 tall) and every 25px of height (1440 wide). Run it on both builds; the review page uses the two files as before/now.
- `ovf.py` — sideways scroll at 101 widths.

Round 5 (the audit of Oct 23):

- `fullsweep.py` now also records `section-air-l`, the multiplied paddings, the ID cards' text as drawn and every block's layout state (`st`: columns, deck or row, burger, …) for the responsive map. It switches off main's stable scrollbar gutter (book.css): headless Chromium keeps those 15px even with hidden scrollbars, which phones and overlay scrollbars never do.
- `areas.py url out.json` — the parts that moved since round 4 at the 22 sizes of `herom.py` (hero, ID cards as drawn, feature tiles, royalty lines, the tools' air).
- `lines.py url` — lines and characters per line of the texts measured in their own letters, every 40px.
- `look.py W H mobile url outdir` — one screenshot per section, reduced motion.
- `probe.py`, `probe2.py`, `roy.py` — one-off checks: column widths with and without the gutter, the box mode with classic scrollbars, the royalty card's wide layout.
- `r5pairs.sh shotsdir` — round 5's picture pairs (`FM_PAIR="Round 4|Now"` labels them).
- `rules.mjs` — the rules check (see the report's README).
- The element dump and the system inference came from the analyzing-design-systems skill (`extract_dom.cjs`, `analyze.py`), not kept here: run with `--sweep 320:1920:10 --detail 320,390,768,1024,1440,1920 --states`, after a warm-up scroll and with `.art, canvas, .dots` hidden.
