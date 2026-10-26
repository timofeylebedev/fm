# AGENTS.md

The rules for working on this site are in [CLAUDE.md](CLAUDE.md): read it first (it is written for Claude, and holds for
any agent).

The design system's measured state is not written here, so it never goes stale: it is generated on every deploy.

- Latest state (rules, findings, decisions, open questions for Tim, «what needs you»):
  https://timofeylebedev.github.io/fm/report/state.json — or `git fetch origin report-data` and read `latest/state.json`.
  A pull request's own: `pr/<number>/state.json` on that branch.
- How it is made, and how to run it locally: [design/checks/README.md](design/checks/README.md) (`npm run checks`).
- Never edit the `report-data` branch by hand; change `design/decisions.json` (a decision) or `design/questions.json`
  (`node design/checks/answer.mjs`) in a pull request instead.
