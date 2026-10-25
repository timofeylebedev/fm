# The design system's checks

Every rule of the system as a check, measured in a browser on every deploy, so the review page
(https://timofeylebedev.github.io/fm/report/) always shows the site as it is, and says what needs Tim.

- A **finding** is a failing check. A **decision** (`design/decisions.json`) can cover what a check finds: the item is then
  *accepted*, shown with its value on every run, and comes back when that value leaves the decision's band, when the
  decision covers nothing any more, or after its date. **Fixed** is a finding that is gone: it closes itself.
- What a check cannot answer (a look on the iPhone, a choice) is a **question** (`design/questions.json`). An answer is
  stored with the fingerprints of the files it is about; when one changes, the question opens again.
- Everything comes together in one file, `state.json`: the report draws from it, and AI agents read it at the start of
  a session (published at https://timofeylebedev.github.io/fm/report/state.json; history on the `report-data` branch).

## Files

| File | What it is |
|---|---|
| `collect.js` | The collector: plain browser script, measures a page as drawn (type, colours, fills, radii, borders, shadows, effects, layers, icons, pictures, ratios, edges, lines of text, components, hover timings) and its head (titles, outline, anchors, links). Same file in CI and, later, on a real device. |
| `site.config.mjs` | The adapter for this site: its pages, sizes, what to leave out, the probes of the responsive picture, the logic scenarios (given / when / then). Another site gets its own copy; the rest stays as is. |
| `measure.mjs` | The runner: serves `dist/` as GitHub Pages does and records the sweep (every 10px of width, every 25px of height), the 8 full sizes, the modes (no scripts, no WebGL, forced colours, fonts that never come, reduced motion), privacy before and after «ОК», the scenarios, every page and link, the weight. |
| `checks.mjs` | The measured rules, each with its kind and bands. |
| `source.mjs` | The rules read from the code (ladder, relations, no CSS in comments, colours and curves from one place, steps, tokens wired, decisions complete). |
| `state.mjs` | Joins the record(s), the code's rules, the decisions and the questions into `state.json`, with «what needs you» ranked, and what is new or fixed since the last deploy of main. |
| `keep.mjs` | CI: keeps the record and the state on the `report-data` branch (`latest/`, `history/<day>-<sha>/`, `history/index.json`, `pr/<n>/`). |
| `answer.mjs` | Records Tim's answer to a question (with the files' fingerprints). |

## Kinds of rule

| Kind | Verdict |
|---|---|
| hard | any item fails (sideways scroll, no alt, a broken link, something loaded before consent) |
| share | a share of the uses must follow the rule: under `pass` it warns, under `warn` it fails (text on a role, colours from tokens, corners on a role) |
| tolerance | each item inside a band; outside it warns (near-miss edges, upscaled pictures, widows) |
| convention | a count that should stay small (border widths, shadows, z-index values, icon sizes) |
| trend | against the last deploy of main (the weight of a first visit) |
| scenario | a row of the logic table, played in a browser |
| inventory | no verdict, what there is (effects that cost the GPU, ratios, components, who is called after consent) |

## Commands

```sh
npm run build
npm run checks                   # measure (~5–7 min; Chromium) + state → design/checks/out/
node design/checks/measure.mjs --engine webkit --quick     # WebKit too (npx playwright install webkit)
node design/checks/measure.mjs --only scenarios            # one step while working on the checks
npm run checks:state             # the state again from the last record
node design/report/build-site.mjs                          # the review page with them
node design/checks/answer.mjs <id> "<answer>" ["note"]     # record Tim's answer
```

Locally (the cloud workspace, Claude Code on the Mac) the measurements run in headless Chromium without a GPU: frame
timings and the cost of effects are not measured there (the device runs, a later step, will). `scrollbar-gutter: stable`
is taken out of the served CSS, so the page is measured as on a Mac or a phone (overlay scrollbars).

## In CI

`.github/workflows/deploy.yml`, job `checks`, after the site is published: build, measure (Chromium, then WebKit sizes
only), state against `report-data`'s `latest/`, keep the record, rebuild the review page with it, publish `/report/`
again (main) or the preview (a pull request). It never fails the site's deploy.

## A new rule

Add it to `checks.mjs` (from the record) or `source.mjs` (from the code), with: an id `area.name`, its `area` (the tab
of the report it shows on: `AREA_TAB` in `design/report/site/report.js`), its `kind`, a `how` that says what is measured
in plain words, and items `{ key, where, what, value, at }` (the key keeps the item the same thing from run to run). If
it needs a new measurement, add it to `collect.js` (generic) or the config's probes (this site only).
