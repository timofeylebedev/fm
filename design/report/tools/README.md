# Measuring scripts (round 4)

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
