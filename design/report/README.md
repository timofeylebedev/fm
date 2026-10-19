# Design report

The review page of the size system: what changed, the system, the whole responsive picture, the responsive map, motion, the grammar and the checks.

The latest version is published at https://claude.ai/artifact/BUzrUiZTCEmd5KBW232jEA. Claude can read it from any session with the Artifact tool's read action. This folder holds its source, so the page can be rebuilt and updated from any session.

## Files

- `data.json` — everything the page shows: `meta` (name, eyebrow, title, lede, footer), then `sections`, each a list of typed blocks. Pictures are relative paths into `shots/`.
- `shots/` — before/after pictures (JPEG, about 1000px wide, "Before" and "After" labels drawn in).
- `engine.js` — renders the page from the data. It is generic: nothing in it is about this site.
- `report-template.html` — the page shell and styles: one dark look, Inter, the sticky section bar, the picture viewer.
- `build_report.py` — joins the three into one self-contained HTML file and embeds the pictures.
- `tools/` — the measuring scripts used for the round-3 report. They need Playwright, and Chromium in `CHROME` if Playwright has no browser of its own. They expect the old build served on port 8781 and the new one on 8782 (`URL_8781` / `URL_8782` override that). Several are specific to this page (stack, navbar cap, ring, logo columns). `rules.mjs` is the rules prototype: `node design/report/tools/rules.mjs . [--json]`.

## Build and publish

```bash
python3 -I design/report/build_report.py design/report/data.json /tmp/report.html
```

Then publish `/tmp/report.html` with the Artifact tool. Pass the URL above as `url` to keep the same link; read it first from a new session. The built HTML is not committed: it repeats the pictures as base64.

## Block types

`stats`, `shots`, `changes`, `list`, `html`, `table`, `ladder`, `relations`, `heightLine`, `grid`, `box`, `picture`, `map`, `curves`, `durations`, `cards`, `rules`, `decisions`, `pre`. Their fields are described at the top of `engine.js` and in the `design-system-report` skill.
