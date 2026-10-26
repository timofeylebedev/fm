// Keeps this run's record and state on the report-data branch (made on the first run), so every number has a history:
//   latest/                     main's last deploy: state.json, record-chromium.json (record-webkit.json)
//   history/<date>-<sha7>/      each deploy of main: state.json, record-chromium.json.gz
//   history/index.json          one line per deploy of main: commit, date, summary, the main numbers (for trends)
//   pr/<n>/                     a pull request's last run (replaced on every push; compared with main's latest)
//   branch/<name>/              a manual run on another branch (never main's baseline)
// node design/checks/keep.mjs [--pr <n>]      (CI: deploy.yml; it needs push rights to the repository)
// node design/checks/keep.mjs --forget <n>    a closed pull request: its pr/<n>/ is removed
// latest/ and history/ are written only from main (GITHUB_REF refs/heads/main), and never from a run whose measuring
// failed: a broken run must not become the baseline the next ones are compared with.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(import.meta.dirname, "../..");
const OUT = join(ROOT, "design/checks/out");
const BRANCH = "report-data";
const args = process.argv.slice(2);
const pr = args.includes("--pr") ? args[args.indexOf("--pr") + 1] : null;
const forget = args.includes("--forget") ? args[args.indexOf("--forget") + 1] : null;
// the bot's name on the commits (and on a rebase when another run pushed first)
Object.assign(process.env, { GIT_AUTHOR_NAME: "github-actions[bot]", GIT_AUTHOR_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com", GIT_COMMITTER_NAME: "github-actions[bot]", GIT_COMMITTER_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com" });
const ref = process.env.GITHUB_REF || "";
const onMain = ref === "refs/heads/main";
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const state = forget ? null : JSON.parse(readFileSync(join(OUT, "state.json"), "utf8"));
const sha = state ? (state.commit || "unknown").slice(0, 7) : "", day = state ? (state.generated || new Date().toISOString()).slice(0, 10) : "";
const broken = state && ((state.errors || []).length || state.summary?.errors);

const dir = mkdtempSync(join(tmpdir(), "report-data-"));
try {
const has = (() => { try { git(ROOT, "ls-remote", "--exit-code", "--heads", "origin", BRANCH); return true; } catch { return false; } })();
if (has) { git(ROOT, "fetch", "--depth=1", "origin", `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`); git(ROOT, "worktree", "add", "--detach", dir, `origin/${BRANCH}`); }
else { git(ROOT, "worktree", "add", "--detach", dir); git(dir, "checkout", "--orphan", BRANCH); git(dir, "rm", "-rf", "--quiet", "."); writeFileSync(join(dir, "README.md"), "# report-data\n\nWritten by the deploy (design/checks/keep.mjs): the measured state of the site's design system on every deploy of main (history/, latest/) and the last run of each pull request (pr/). Not code: do not merge into main.\n"); }

const put = (to, from, gz = false) => { mkdirSync(join(dir, to, ".."), { recursive: true }); if (gz) writeFileSync(join(dir, to), gzipSync(readFileSync(from))); else copyFileSync(from, join(dir, to)); };
const records = ["record-chromium.json", "record-webkit.json"].filter((f) => existsSync(join(OUT, f)));
let what;
if (forget) { rmSync(join(dir, "pr", String(forget)), { recursive: true, force: true }); what = `pr/${forget} removed`; }
else if (pr || !onMain || broken) {
  // a pull request, a run on another branch, or a broken run of main: kept apart, never main's baseline
  const to = pr ? `pr/${pr}` : !onMain ? `branch/${(process.env.GITHUB_REF_NAME || "local").replace(/[^\w.-]+/g, "-")}` : `broken/${day}-${sha}`;
  put(`${to}/state.json`, join(OUT, "state.json"));
  for (const f of records) put(`${to}/${f}`, join(OUT, f));
  what = to + (broken ? " (the measuring failed: main's baseline left as it was)" : "");
  if (broken) console.log(`::warning title=Checks::the measuring failed (${(state.errors || []).join("; ")}): latest/ and history/ not updated`);
} else {
  put("latest/state.json", join(OUT, "state.json"));
  for (const f of records) put(`latest/${f}`, join(OUT, f));
  if (!records.includes("record-webkit.json")) rmSync(join(dir, "latest/record-webkit.json"), { force: true });
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
  // the full records of the last 200 deploys are kept; older ones live on in the index (and in git history)
  const dirs = readdirSync(join(dir, "history")).filter((d) => /^\d{4}-\d\d-\d\d-/.test(d)).sort();
  for (const d of dirs.slice(0, Math.max(0, dirs.length - 200))) rmSync(join(dir, "history", d), { recursive: true, force: true });
  what = `latest/ and ${h}`;
}
git(dir, "add", "-A");
try { git(dir, "diff", "--cached", "--quiet"); console.log("keep: nothing new"); }
catch {
  git(dir, "commit", "--quiet", "-m", forget ? `Forget PR #${forget} (closed)` : `Checks of ${sha} (${pr ? "PR #" + pr : onMain ? "main" : ref || "local"})`);
  // other runs push too (pull requests, a merge): fetch, put this commit on top, try again
  for (let i = 0; ; i++) {
    try { git(dir, "push", "origin", `HEAD:refs/heads/${BRANCH}`); break; }
    catch (e) {
      if (i >= 4) throw e;
      git(dir, "fetch", "--depth=20", "origin", `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`);
      git(dir, "rebase", `origin/${BRANCH}`);
    }
  }
  console.log(`keep: ${what} on ${BRANCH}`);
}
} finally {
  try { git(ROOT, "worktree", "remove", "--force", dir); } catch {}
  rmSync(dir, { recursive: true, force: true });
}
