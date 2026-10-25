// Records Tim's answer to a question of design/questions.json, with the fingerprints of the files it is about: when one
// of them changes, the question opens again by itself (design/checks/state.mjs).
//   node design/checks/answer.mjs <id> "<answer>" ["a note"]       answer it
//   node design/checks/answer.mjs <id> --drop "why"                 drop it (no longer a question)
//   node design/checks/answer.mjs <id> --reopen                     open it again
// The report's answer buttons copy a line «FM answer · <id>: <answer> — <note>» for Tim to paste into a chat; Claude
// runs this with it and commits the change with the work it leads to.
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "../..");
const FILE = join(ROOT, "design/questions.json");
const [id, answer, note] = process.argv.slice(2);
const data = JSON.parse(readFileSync(FILE, "utf8"));
const q = data.questions.find((x) => x.id === id);
if (!q) { console.error(`answer: no question «${id}». Open ones: ${data.questions.filter((x) => x.status === "open").map((x) => x.id).join(", ")}`); process.exit(2); }
const hash = (f) => { try { return execFileSync("git", ["hash-object", join(ROOT, f)], { encoding: "utf8" }).trim(); } catch { return "missing"; } };
const today = new Date().toISOString().slice(0, 10);
if (answer === "--reopen") { q.status = "open"; delete q.answer; }
else if (answer === "--drop") { q.status = "dropped"; q.dropped = { why: note || "", when: today }; }
else if (answer) {
  q.status = "answered";
  q.answer = { choice: answer, note: note || "", when: today, by: "Tim", hashes: Object.fromEntries((q.about || []).map((f) => [f, hash(f)])) };
} else { console.error('answer: give the answer: node design/checks/answer.mjs <id> "<answer>" ["note"]'); process.exit(2); }
writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
console.log(`${id}: ${q.status}${q.answer ? ` — ${q.answer.choice}` : ""}`);
