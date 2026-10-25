// The design system's rules read from the code (design/checks/source.mjs), printed.
// node design/report/tools/rules.mjs [--json out.json]   (since Oct 26, 2026 also run on every deploy: design/checks/)
import { writeFileSync } from "node:fs";
import { sourceRules } from "../../checks/source.mjs";

const out = { when: new Date().toISOString(), ...sourceRules() };
const i = process.argv.indexOf("--json");
if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify(out, null, 1));
for (const r of out.results) {
  console.log(`${r.ok ? "ok  " : "FAIL"} ${r.id}: ${r.title} (${r.n})`);
  for (const x of r.fails.slice(0, 40)) console.log("       " + x);
}
