# The design system's checks

Every rule of the system as a check, measured in a browser on every deploy, so the review page
(https://timofeylebedev.github.io/fm/report/) always shows the site as it is, and says what needs Tim.

The checks are site-kit's (`node_modules/site-kit/checks/`, README there: findings, decisions, questions, the kinds of
rule, the lessons). What is particular to Flow Medium (its pages, sizes, probes, scenarios, consent, code rules) is in
its adapter, `site-kit.config.mjs` at the root of the repo, key `checks` (and `rules`).

```sh
npm run build
npm run checks                    # site-kit checks: measure (~6–8 min; Chromium) + state → design/checks/out/
npx site-kit checks measure --engine webkit --quick     # WebKit too (npx playwright install webkit)
npx site-kit checks measure --only scenarios            # one step while working on the checks
npm run checks:state              # the state again from the last record
npm run rules                     # the rules read from the code only (seconds)
npm run report                    # the review page with them (design/report/site/)
npx site-kit checks answer <id> "<answer>" ["note"]     # record Tim's answer (or the line the report's button copied)
```

`out/` (this folder, not committed) is where a local run writes its records (`record-<engine>.json`), `state.json`
and pictures. In CI they are kept on the `report-data` branch (`latest/`, `history/`, `pr/<n>/`), never edited by hand;
the live state is https://timofeylebedev.github.io/fm/report/state.json.

A new rule for every site goes into site-kit (a pull request there); a rule only Flow Medium has goes into
`rules.code` or `checks.scenarios` of `site-kit.config.mjs`.
