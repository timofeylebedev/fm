// The state of the design system: every rule's result, the decisions and questions, and «what needs you», in one file
// that the report and the AI agents both read.
//   node design/checks/state.mjs [--record out/record-chromium.json] [--webkit out/record-webkit.json] [--prev prev-state.json]
//                                [--out design/checks/out/state.json]
// Inputs: a record of measure.mjs (Chromium; WebKit's too if given), the code's rules (source.mjs), design/scale.json,
// design/tokens.json, design/decisions.json, design/questions.json; and the state of the last deploy of main (--prev),
// so it can say what is new and what fixed itself since.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { measuredRules, KINDS } from "./checks.mjs";
import { sourceRules } from "./source.mjs";
import cfg from "./site.config.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i < 0 ? d : args[i + 1]; };
const readJson = (p) => (p && existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
const OUT = resolve(opt("out", join(ROOT, "design/checks/out/state.json")));
const rec = readJson(resolve(opt("record", join(ROOT, "design/checks/out/record-chromium.json"))));
const webkit = readJson(opt("webkit") && resolve(opt("webkit")));
const prev = readJson(opt("prev") && resolve(opt("prev")));
const prevRec = readJson(opt("prev-record") && resolve(opt("prev-record")));
if (!rec) { console.error("state: no record — run `node design/checks/measure.mjs` first"); process.exit(2); }
const scale = readJson(join(ROOT, "design/scale.json")), tokens = readJson(join(ROOT, "design/tokens.json"));
const decisions = readJson(join(ROOT, "design/decisions.json")).decisions;
const questions = readJson(join(ROOT, "design/questions.json")).questions;
const git = (...a) => { try { return execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim(); } catch { return null; } };
const fingerprint = (f) => git("hash-object", join(ROOT, f)) || "missing";

// ── rules ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const SEV = { fail: 3, warn: 2, pass: 0, info: 0 };
const rules = measuredRules({ rec, prev: prevRec, scale, tokens, cfg });
for (const r of sourceRules().results)
  rules.push({ id: "code." + r.id, area: r.area, kind: "hard", title: r.title, how: `${r.how} (read from the code).`, status: r.ok ? "pass" : "fail", value: r.n, unit: "places",
    items: r.fails.map((f) => { const m = f.match(/^(\S+:\d+)\s+(.*)$/); return { key: f, where: m ? m[1] : r.area, what: m ? m[2] : f }; }), note: r.note });
for (const r of rules) { if (r.kind === "inventory") r.status = "info"; r.items ||= []; }

// WebKit (Playwright's build, the engine of Safari): its result beside Chromium's, and its own failures added
if (webkit) {
  const wk = measuredRules({ rec: webkit, prev: null, scale, tokens, cfg });
  for (const w of wk) {
    const r = rules.find((x) => x.id === w.id); if (!r) continue;
    r.webkit = { status: w.kind === "inventory" ? "info" : w.status, value: w.value };
    if (SEV[r.webkit.status] > SEV[r.status]) {
      const known = new Set(r.items.map((i) => i.key));
      for (const i of w.items) if (!known.has(i.key)) r.items.push({ ...i, engine: "webkit" });
      r.status = r.webkit.status;
    }
  }
}

// ── decisions: an item a decision covers is accepted; a decision whose items are gone or out of its band needs a look ─
const decisionState = decisions.map((d) => {
  const binds = d.checks || [];
  if (!binds.length) return { id: d.id, kind: d.kind, state: "unbound", what: d.what, decided: d.decided };
  let covered = 0, out = [], expired = d.until && d.until < new Date().toISOString().slice(0, 10);
  for (const b of binds) {
    const r = rules.find((x) => x.id === b.rule); if (!r) { out.push(`no rule ${b.rule}`); continue; }
    const re = new RegExp(b.match || ".");
    for (const i of r.items) {
      if (!re.test(`${i.where} ${i.what}`)) continue;
      i.accepted = d.id; covered++;
      if (b.band && i.value != null && (i.value < b.band[0] || i.value > b.band[1])) out.push(`${i.where}: ${i.value} is outside ${b.band[0]}–${b.band[1]}`);
    }
  }
  const state = expired ? "expired" : out.length ? "moved" : covered ? "holding" : "unused";
  return { id: d.id, kind: d.kind, state, covered, notes: out, what: d.what, decided: d.decided, until: d.until || null };
});
// a rule whose only failures are accepted holds; its status says so
for (const r of rules) {
  const open = r.items.filter((i) => !i.accepted);
  r.accepted = r.items.length - open.length;
  if (r.accepted && (r.status === "fail" || r.status === "warn") && !open.length && r.kind !== "share") r.status = "pass";
}

// ── findings: open items of failing or warning rules, with stable keys, new or not since the last deploy ───────────
const keyOf = (r, i) => `${r.id}::${i.key}`;
const findings = [];
for (const r of rules) if (r.status === "fail" || r.status === "warn") for (const i of r.items) if (!i.accepted) findings.push({ key: keyOf(r, i), rule: r.id, status: r.status, where: i.where, what: i.what, at: i.at || "" });
const before = new Set((prev?.findings || []).map((f) => f.key));
findings.forEach((f) => { f.new = prev ? !before.has(f.key) : false; });
const now = new Set(findings.map((f) => f.key));
const fixed = (prev?.findings || []).filter((f) => !now.has(f.key)).map((f) => ({ key: f.key, rule: f.rule, where: f.where, what: f.what }));
for (const r of rules) { const p = prev?.rules?.find((x) => x.id === r.id); if (p) r.was = { status: p.status, value: p.value }; }

// ── questions: open, answered, or opened again because what they are about has changed ────────────────────────────
const questionState = questions.map((q) => {
  if (q.status === "dropped") return { ...q, state: "dropped" };
  if (q.status !== "answered" || !q.answer) return { ...q, state: "open" };
  const changed = (q.about || []).filter((f) => (q.answer.hashes || {})[f] !== fingerprint(f));
  return { ...q, state: changed.length ? "reopened" : "answered", changed };
});

// ── what needs you: ranked, one card per rule (not per item), then decisions, then questions ─────────────────────
const needs = [];
const ranked = rules.filter((r) => r.status === "fail" || r.status === "warn").map((r) => {
  const open = r.items.filter((i) => !i.accepted), fresh = open.filter((i) => findings.find((f) => f.key === keyOf(r, i))?.new).length;
  return { r, open, fresh };
}).filter((x) => x.open.length || x.r.kind === "share");
for (const { r, open, fresh } of ranked)
  needs.push({ type: "rule", id: r.id, severity: r.status, area: r.area, title: r.title, kind: r.kind,
    why: r.kind === "share" ? `${r.value}${r.unit.startsWith("%") ? "" : " "}${r.unit} (wanted ${r.pass}${r.unit.startsWith("%") ? "%" : ""})` : `${open.length} ${open.length === 1 ? "place" : "places"}${r.value != null && r.unit && r.value !== open.length ? ` · ${r.value} ${r.unit}` : ""}`,
    fresh, sample: open.slice(0, 3).map((i) => `${i.where}: ${i.what}${i.at ? ` (${i.at})` : ""}`),
    rank: (r.status === "fail" ? 300 : 100) + (fresh ? 50 : 0) + Math.min(open.length, 40) + (r.area === "Page health" ? -20 : 0) });
for (const d of decisionState.filter((d) => ["moved", "expired", "unused"].includes(d.state)))
  needs.push({ type: "decision", id: d.id, severity: d.state === "moved" ? "warn" : "info", area: "Decisions", title: d.state === "unused" ? `Decision «${d.id}» covers nothing now` : d.state === "expired" ? `Decision «${d.id}» has expired` : `Decision «${d.id}»: the value moved`,
    why: d.state === "unused" ? "the checks it is bound to find nothing it covers: the exception may no longer be needed" : d.notes.join("; ") || `until ${d.until}`, rank: d.state === "moved" ? 250 : 120 });
for (const q of questionState.filter((q) => q.state === "open" || q.state === "reopened"))
  needs.push({ type: "question", id: q.id, severity: "ask", area: "Questions", title: q.ask, needs: q.needs, link: q.link, options: q.options, since: q.since, from: q.from,
    why: q.state === "reopened" ? `changed since your answer (${q.changed.join(", ")})` : `open since ${q.since}${q.from ? ` (${q.from})` : ""}`, rank: (q.state === "reopened" ? 230 : 200) + Math.min(30, Math.round((Date.now() - Date.parse(q.since)) / 864e5)) });
needs.sort((a, b) => b.rank - a.rank);

// ── write ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const count = (s) => rules.filter((r) => r.status === s).length;
const state = {
  schema: 1, site: cfg.name, generated: new Date().toISOString(), commit: rec.commit, ref: rec.ref, pr: rec.pr || null,
  engines: Object.fromEntries([rec, webkit].filter(Boolean).map((x) => [x.engine, { version: x.version, when: x.when, quick: !!x.quick, seconds: x.seconds, errors: x.errors || [] }])),
  base: prev ? { commit: prev.commit, generated: prev.generated } : null,
  kinds: KINDS,
  summary: { rules: rules.length, pass: count("pass"), warn: count("warn"), fail: count("fail"), info: count("info"), findings: findings.length, new: findings.filter((f) => f.new).length, fixed: fixed.length, accepted: rules.reduce((a, r) => a + (r.accepted || 0), 0), questions: questionState.filter((q) => q.state === "open" || q.state === "reopened").length },
  needs, rules, findings, fixed, decisions: decisionState, questions: questionState,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(state, null, 1));
const s = state.summary;
console.log(`state: ${s.rules} rules · ${s.pass} pass · ${s.warn} warn · ${s.fail} fail · ${s.info} inventory · ${s.findings} findings (${s.new} new, ${s.fixed} fixed since the last deploy) · ${s.accepted} accepted · ${s.questions} questions open`);
for (const n of needs.slice(0, 12)) console.log(`  ${n.severity.padEnd(4)} ${n.title.slice(0, 90)} — ${n.why}`);
