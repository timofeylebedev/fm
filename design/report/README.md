# Review page

The review page of the whole system, as a small static site in `site/`: open `site/index.html` in a browser straight
from the clone (no server needed), or online at https://timofeylebedev.github.io/fm/report/ (every push to `main`
publishes it with the site; a pull request's preview has it at `…/pr-preview/pr-<number>/report/`).

A sidebar with these pages:

- **What needs you** (the first page) — from the design system's checks (`design/checks/`, measured on every deploy):
  rules that fail, decisions whose measured value moved, questions for Tim (a look on a device, a choice) with answer
  buttons that copy a line for a chat with Claude, warnings, and what fixed itself since the last deploy of main.
- **History** — every deploy of main, measured: failures, the shares of the rules, the weight of a first visit.

- **The system** — the system as it is now, in tabs, each with the checks of its areas at the top (icons & pictures,
  components, behaviour and page health are tabs of the checks): colour (tiles), type (each role on the ladder, a text drawn at its
  size, a screen width and height slider from the range's least to its greatest), space, layout (every container query
  and page step), shadows, motion (curves you can play, durations), responsive (every measured size at every width and
  height, zoomable, each line named with its least and greatest value), blocks, grammar, decisions. Only the current
  state; what is new or changed since the baseline round (`meta.since` in `data.json`, round 5's build) is marked new.
- **The typesetter** — how `build/typeset` decides where lines may break, with a demo running the real code.
- **Rounds** — one page per review round (6, 5, 4, 3): its findings, its changes, its pictures.

## How it is made

- `site/index.html`, `site/report.css`, `site/report.js` are written by hand: the page, its look, every block and tab.
- `node design/report/build-site.mjs` writes the rest of `site/` from the repo (run it after changing any of these;
  the deploy runs it again on every build, so the published page is always the commit's own):
  - `site/data.js` (`window.REPORT`): the rounds from `data.json`, and the system read now from `design/scale.json`,
    `design/tokens.json`, `design/decisions.json` and the stylesheets (shadows, `@container` steps, `media.css`), each
    item compared with the baseline commit (fetched by itself in a shallow clone). Measured parts (the responsive
    picture, the map, the blocks, motion) come from the latest round in `data.json`.
  - `site/typeset.js` (`window.Typeset`): `build/typeset/core.js` and `lint.js` bundled for the browser (rolldown).
  - `site/fonts/`: the site's fonts, for the specimens.
  - the checks: `design/checks/out/state.json` when they were just run (`npm run checks`), else the last deploy of
    main's from the `report-data` branch (fetched by itself); the responsive picture and map come from the same record's
    sweep. `site/state.json` and `site/history.json` are written for agents and not committed. In CI the job `checks`
    of deploy.yml measures, then builds and publishes this page again.
- `site/shots/`: the rounds' before/after pictures (JPEG, about 1000px wide); `r3-*` round 3's, `r5a-*` round 5's,
  `r6-*` round 6's, the rest round 4's.
- `data.json`: `meta` (with `rounds`: which sections make each round's page, and `since`) and `sections` of typed blocks
  (the block types are in the `full-system-report` skill). Round 6's is written by `tools/round6.py`.
- `measure/`: round 6's raw measurements (sweeps and areas of both builds, the rules' output, the audit's output, the
  independent review), so the page can be rebuilt without measuring again.
- `tools/`: the measuring scripts (README there).

## A new round

Measure (tools/), write its sections into `data.json`, add it at the top of `meta.rounds`, set `meta.since` to the
commit the round measured (so the system page marks what came after it), add its pictures to `site/shots/`, run
`node design/report/build-site.mjs`, and commit everything with the round (round 5 was once published without its source;
its data was recovered from the published page, `measure/published-oct23.json`).

## The old one-file page

Until Oct 25, 2026 the page was a claude.ai artifact (https://claude.ai/artifact/BUzrUiZTCEmd5KBW232jEA, round 6 is
the last published there). `python3 -I design/report/build_report.py design/report/data.json <out.html>` still builds
that one-file version (pictures inlined as base64) with `engine.js` and `report-template.html`.
