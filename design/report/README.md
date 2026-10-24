# Review page

The review page of the whole size and motion system, built from `data.json` by the Design Report Engine. Every round
covers the whole system at full detail (findings or changes first, then the system, the areas, every size at every
width and height, the map, motion, grammar, checks, next), re-measured on both builds; earlier rounds' change sections
stay at the end.

- Published (private until shared): https://claude.ai/artifact/BUzrUiZTCEmd5KBW232jEA — the same link is updated every round.
- Latest: round 6, the design-system analysis of main on Oct 24, 2026 (bd0566f vs edeb745, the build of round 5).
- **Always commit the source with the publish.** Round 5 (Oct 23) was published without it; its data was recovered from
  the published page (`measure/published-oct23.json`).
- Build: `python3 -I design/report/build_report.py design/report/data.json <out.html>`, then publish `<out.html>` with
  the Artifact tool, passing the link above as `url` (read it first from a new session).
- `data.json`: `meta` and `sections` of typed blocks (the block types are in the `full-system-report` skill; every one
  is shown at https://claude.ai/artifact/LTgVbAdke7CTedoUuKqp2t). Round 6's is written by `tools/round6.py`.
- `measure/`: round 6's raw measurements (sweeps and areas of both builds, the rules' output, the audit's output, the
  independent review), so the page can be rebuilt without measuring again.
- `shots/`: the before/after pictures (JPEG, about 1000px wide); `r3-*` round 3's, `r5a-*` round 5's, `r6-*` round 6's, the rest round 4's.
- `engine.js`, `report-template.html`, `build_report.py`: the engine, copied from the Design Report Engine artifact.
- `tools/`: the measuring scripts (README there).

The built HTML is not committed: it repeats every picture as base64.
