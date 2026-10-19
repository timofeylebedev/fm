# Review page

The review page of the whole size and motion system, with the latest round first, built from `data.json` by the Design Report Engine. Each round keeps the whole system (system, picture, map, motion, grammar, checks) up to date and adds its own changes section; earlier rounds' change sections stay at the end.

- Published (private until shared): https://claude.ai/artifact/BUzrUiZTCEmd5KBW232jEA — the same link is updated every round.
- Build: `python3 -I design/report/build_report.py design/report/data.json <out.html>`, then publish `<out.html>` with the Artifact tool, passing the link above as `url` (read it first from a new session).
- `data.json`: `meta` and `sections` of typed blocks (the block types are listed in the `design-system-report` skill, and every one is shown at https://claude.ai/artifact/LTgVbAdke7CTedoUuKqp2t).
- `shots/`: the before/after pictures the data points to (JPEG, about 1000px wide); `r3-*` are round 3's.
- `engine.js`, `report-template.html`, `build_report.py`: the engine, copied from the Design Report Engine artifact.
- `tools/`: the measuring scripts of round 4 (Python Playwright; Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` in Claude's workspace). Serve the old build on :8001 and the new one on :8002 first.

The built HTML is not committed: it repeats every picture as base64.
