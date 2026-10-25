// Keeps this run's record and state on the report-data branch (made on the first run), so every number has a history:
//   latest/                     main's last deploy: state.json, record-chromium.json (record-webkit.json)
//   history/<date>-<sha7>/      each deploy of main: state.json, record-chromium.json.gz
//   history/index.json          one line per deploy of main: commit, date, summary, the main numbers (for trends)
//   pr/<n>/                     a pull request's last run (replaced on every push; compared with main's latest)
// node design/checks/keep.mjs [--pr <n>]      (CI: deploy.yml; it needs push rights to the repository)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(import.meta.dirname, "../..");
const OUT = join(ROOT, "design/checks/out");
const BRANCH = "report-data";
const args = process.argv.slice(2);
const pr = args.includes("--pr") ? args[args.indexOf("--pr") + 1] : null;
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const state = JSON.parse(readFileSync(join(OUT, "state.json"), "utf8"));
const sha = (state.commit || "unknown").slice(0, 7), day = (state.generated || new Date().toISOString()).slice(0, 10);

const dir = mkdtempSync(join(tmpdir(), "report-data-"));
const has = (() => { try { git(ROOT, "ls-remote", "--exit-code", "--heads", "origin", BRANCH); return true; } catch { return false; } })();
if (has) { git(ROOT, "fetch", "--depth=1", "origin", `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`); git(ROOT, "worktree", "add", "--detach", dir, `origin/${BRANCH}`); }
else { git(ROOT, "worktree", "add", "--detach", dir); git(dir, "checkout", "--orphan", BRANCH); git(dir, "rm", "-rf", "--quiet", "."); writeFileSync(join(dir, "README.md"), "# report-data\n\nWritten by the deploy (design/checks/keep.mjs): the measured state of the site's design system on every deploy of main (history/, latest/) and the last run of each pull request (pr/). Not code: do not merge into main.\n"); }

const put = (to, from, gz = false) => { mkdirSync(join(dir, to, ".."), { recursive: true }); if (gz) writeFileSync(join(dir, to), gzipSync(readFileSync(from))); else copyFileSync(from, join(dir, to)); };
const records = ["record-chromium.json", "record-webkit.json"].filter((f) => existsSync(join(OUT, f)));
if (pr) {
  put(`pr/${pr}/state.json`, join(OUT, "state.json"));
  for (const f of records) put(`pr/${pr}/${f}`, join(OUT, f));
} else {
  put("latest/state.json", join(OUT, "state.json"));
  for (const f of records) put(`latest/${f}`, join(OUT, f));
  const h = `history/${day}-${sha}`;
  put(`${h}/state.json`, join(OUT, "state.json"));
  for (const f of records) put(`${h}/${f}.gz`, join(OUT, f), true);
  // the index: the numbers worth a trend line
  const idxFile = join(dir, "history/index.json");
  const idx = existsSync(idxFile) ? JSON.parse(readFileSync(idxFile, "utf8")) : [];
  const rec = JSON.parse(readFileSync(join(OUT, "record-chromium.json"), "utf8"));
  const line = { commit: state.commit, sha, day, when: state.generated, summary: state.summary,
    weight: rec.weight ? { total: rec.weight.total, js: rec.weight.by?.js?.sent || 0, images: rec.weight.by?.images?.sent || 0 } : null,
    rules: Object.fromEntries(state.rules.filter((r) => r.kind !== "inventory").map((r) => [r.id, [r.status, r.value ?? null]])) };
  const at = idx.findIndex((x) => x.commit === state.commit);
  if (at >= 0) idx[at] = line; else idx.push(line);
  writeFileSync(idxFile, JSON.stringify(idx.slice(-500)));
}
git(dir, "add", "-A");
try { git(dir, "diff", "--cached", "--quiet"); console.log("keep: nothing new"); }
catch {
  git(dir, "-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "commit", "--quiet", "-m", `Checks of ${sha} (${pr ? "PR #" + pr : "main"})`);
  // other runs push too (pull requests, a merge): fetch, put this commit on top, try again
  for (let i = 0; ; i++) {
    try { git(dir, "push", "origin", `HEAD:refs/heads/${BRANCH}`); break; }
    catch (e) {
      if (i >= 4) throw e;
      git(dir, "fetch", "--depth=20", "origin", `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`);
      git(dir, "rebase", `origin/${BRANCH}`);
    }
  }
  console.log(`keep: ${pr ? `pr/${pr}` : `latest/ and history/${day}-${sha}`} on ${BRANCH}`);
}
git(ROOT, "worktree", "remove", "--force", dir);
rmSync(dir, { recursive: true, force: true });
