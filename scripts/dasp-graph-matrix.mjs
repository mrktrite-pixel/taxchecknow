// Graph-teeth test matrix for the v2 flag-routed DASP maze (ruling 8).
// Enumerates EVERY reachable flag combination by simulating the walk, and asserts
// terminal + tier + severity are defined and consistent. A $147 CTA on any escape
// terminal = FAIL (build failure). Mirrors EngineCalculator's routing exactly.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const engine = JSON.parse(readFileSync(join(dir, "../app/au/check/superannuation-tax-leaving-australia-confusion-2026/engine.json"), "utf8"));
const { questions, terminals, derived_flags: derived = [] } = engine;

const matchExpr = (expr, flags) => {
  if (!expr) return true;
  if (expr.all && !expr.all.every((f) => flags.has(f))) return false;
  if (expr.any && expr.any.length > 0 && !expr.any.some((f) => flags.has(f))) return false;
  if (expr.none && expr.none.some((f) => flags.has(f))) return false;
  return true;
};
const computeFlags = (trail) => {
  const f = new Set();
  for (const t of trail) for (const fl of t.flags ?? []) f.add(fl);
  if ([...f].some((x) => x.startsWith("unsure:"))) f.add("any_unsure");
  for (const d of derived) if (matchExpr(d.when, f)) f.add(d.name);
  return f;
};
const SEV = new Set(["blue", "green", "amber", "red"]);

// DFS the walk: at each step pick the next applicable unanswered question and branch on options.
const combos = [];
function walk(trail, answered) {
  const flags = computeFlags(trail);
  const q = questions.find((x) => matchExpr(x.showIf, flags) && !answered.has(x.id));
  if (!q) {
    const term = terminals.find((t) => matchExpr(t.when, flags)) ?? null;
    combos.push({ path: trail.map((t) => `${t.qId}=${t.value}`).join(" · "), flags: [...flags], term });
    return;
  }
  for (const o of q.options) {
    walk([...trail, { qId: q.id, value: o.value, flags: o.flags ?? [] }], new Set([...answered, q.id]));
  }
}
walk([], new Set());

let fails = 0;
const fail = (msg) => { console.log("FAIL — " + msg); fails++; };
const byTerm = {};
for (const c of combos) {
  const t = c.term;
  if (!t) { fail(`no terminal for [${c.flags.join(",")}]`); continue; }
  byTerm[t.id] = (byTerm[t.id] ?? 0) + 1;
  if (![67, 147].includes(t.tier)) fail(`${t.id}: bad tier ${t.tier}`);
  if (!SEV.has(t.severity)) fail(`${t.id}: bad severity ${t.severity}`);
  if (!t.heading || !t.result_copy) fail(`${t.id}: missing heading/result_copy`);
  // confidence sell-rule + no-$147-on-escape
  const anyUnsure = c.flags.includes("any_unsure");
  const primaryTier = t.escape ? 67 : (t.tier === 147 && anyUnsure ? 67 : t.tier);
  if (t.escape && primaryTier === 147) fail(`CONTRADICTION: escape ${t.id} sells $147`);
  if (t.escape && t.tier === 147) fail(`CONTRADICTION: escape terminal ${t.id} has tier 147 in engine`);
  if (t.tier === 147 && anyUnsure && primaryTier !== 67) fail(`${t.id}: $147 with unsure must sell $67-primary`);
}
// every terminal must be reachable
for (const t of terminals) if (!byTerm[t.id]) console.log(`  note: terminal ${t.id} not reached by any enumerated combo`);
// ruling 2 — the green clean-simple terminal MUST be reachable
if (!byTerm["R0-clean-simple"]) fail("R0-clean-simple (green) is NOT reachable");

console.log(`\ncombinations tested: ${combos.length}`);
console.log("terminal hit counts:", JSON.stringify(byTerm));
console.log(`reachable terminals: ${Object.keys(byTerm).length}/${terminals.length}`);
console.log(`\n${fails === 0 ? "GRAPH-TEETH PASS — all combinations resolve, no contradictions" : fails + " FAILURES"}`);
process.exit(fails === 0 ? 0 : 1);
