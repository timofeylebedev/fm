# Review page

The review page of the whole size and motion system, with the latest round first, built from `data.json` by the Design Report Engine. Each round keeps the whole system (system, picture, map, motion, grammar, checks) up to date and adds its own changes section; earlier rounds' change sections stay at the end.

- Published (private until shared): https://claude.ai/artifact/BUzrUiZTCEmd5KBW232jEA — the same link is updated every round.
- Build: `python3 -I design/report/build_report.py design/report/data.json <out.html>`, then publish `<out.html>` with the Artifact tool, passing the link above as `url` (read it first from a new session).
- `data.json`: `meta` and `sections` of typed blocks (the block types are listed in the `design-system-report` skill, and every one is shown at https://claude.ai/artifact/LTgVbAdke7CTedoUuKqp2t).
- `shots/`: the before/after pictures the data points to (JPEG, about 1000px wide); `r3-*` are round 3's, `r5-*` round 5's (round 4 on the left, main on the right).
- `engine.js`, `report-template.html`, `build_report.py`: the engine, copied from the Design Report Engine artifact.
- `tools/`: the measuring scripts (Python Playwright; Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` in Claude's workspace), see `tools/README.md`. Serve the old build on :8001 and the new one on :8002 first.
- `tools/rules.mjs`: the system's rules as one check (`node design/report/tools/rules.mjs`, `--json`): a prototype of `npm run rules`, not in CI yet.
- Round 5 (Oct 23, 2026) was an audit with no comments: `tools/r5_data.py <measurements> tools/r5_review.json` rebuilt `data.json` from round 4's and the round's measurements; `r5_review.json` holds the findings after the independent review.

Every round covers the whole system at full detail (the full-system-report skill): the new round first, every section re-measured on both builds, earlier rounds' changes kept at the end.

The built HTML is not committed: it repeats every picture as base64.
