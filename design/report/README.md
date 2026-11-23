# Review page

The review page of the whole system is site-kit's (`node_modules/site-kit/report/`, README there): `npm run report`
(`site-kit report`) builds it into `site/` here (not committed: a build output, like `dist/`); open `site/index.html`
in a browser straight from the clone (no server needed). Online at https://timofeylebedev.github.io/fm/report/ (every
push to `main` builds and publishes it with the site; a pull request's preview has it at
`…/pr-preview/pr-<number>/report/`).

A sidebar with these pages:

- **What needs you** (the first page) — from the design system's checks (`npm run checks`, measured on every deploy):
  rules that fail, decisions whose measured value moved, questions for Tim (a look on a device, a choice) with answer
  buttons that copy a line for a chat with Claude, warnings, and what fixed itself since the last deploy of main.
- **The system** — the system as it is now, in tabs, each with the checks of its areas at the top: colour, type, space,
  layout, shadows, motion, icons & pictures, components, behaviour, page health, responsive, blocks, grammar,
  decisions. Only the current state; what is new or changed since the baseline round (`meta.since` in `data.json`) is
  marked new.
- **Blocks** — each block of the page live in a frame at a width you pick, with its latest pictures.
- **The typesetter** — how `site-kit typeset` decides where lines may break, with a demo running the real code.
- **History** — every deploy of main, measured: failures, the shares of the rules, the weight of a first visit.
- **Rounds** — one page per review round (6, 5, 4, 3): its findings, its changes, its pictures.

What the page reads from Flow Medium (its palette, type roles, steps, shadows, blocks, notes) is in
`site-kit.config.mjs`, key `report`. A change to the page itself goes into site-kit (a pull request there).

## What this folder keeps

The rounds of review, which only Flow Medium has:

- `data.json`: `meta` (with `rounds`: which sections make each round's page, and `since`) and `sections` of typed
  blocks (the block types are in the `full-system-report` skill). Round 6's is written by `tools/round6.py`. The
  system page's measured parts (the responsive picture, the map, the blocks, motion) come from the latest round here
  when the checks have not measured them.
- `shots/`: the rounds' before/after pictures (JPEG, about 1000px wide; `data.json` points to them as `shots/…`);
  `r3-*` round 3's, `r5a-*` round 5's, `r6-*` round 6's, the rest round 4's. `npm run report` copies them into
  `site/shots/`.
- `measure/`: round 6's raw measurements (sweeps and areas of both builds, the rules' output, the audit's output, the
  independent review), so the page can be rebuilt without measuring again.
- `tools/`: the measuring scripts of the rounds (README there).

## A new round

Measure (tools/, or `npm run checks`), write its sections into `data.json`, add it at the top of `meta.rounds`, set
`meta.since` to the commit the round measured (so the system page marks what came after it), add its pictures to
`shots/`, run `npm run report` to look at it, and commit everything with the round (round 5 was once published without
its source; its data was recovered from the published page, `measure/published-oct23.json`).

## The old one-file page

Until Oct 25, 2026 the page was a claude.ai artifact (https://claude.ai/artifact/BUzrUiZTCEmd5KBW232jEA, round 6 is
the last published there). `python3 -I design/report/build_report.py design/report/data.json <out.html>` still builds
that one-file version (pictures inlined as base64) with `engine.js` and `report-template.html`.
