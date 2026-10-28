// lib/__test__/assess-retry-missing.test.mts
//
// A reported absence still DELIVERS. This is the retry, and the refusal when it does not work.
// Run: node --test lib/__test__/assess-retry-missing.test.mts
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// MEASURED on allowance-sniper's tier-2 test buy, 2026-10-27. The pack carried 13 keys, twelve
// exact and one RENAMED (multiYearPlanningStrategy for the requested multiYearPensionPlan), so
// `multiYearPensionPlan` was ABSENT and the buyer's success page rendered that section empty.
//
// The previous change reported the absence, and reporting was the right first step — it is how
// this was finally measured. But it returned ok:true, so the pack was still stored and still
// delivered. The two occasions before this one were both found by a human reading the PDF.
//
// So: ONE retry naming the exact keys, merged in; and if they are still absent, the delivery
// FAILS and nothing is stored.
//
// Pins the logic on the same shapes the real function uses, so it holds with no model call and no
// network, plus the wiring read off assess-core.ts itself — because a retry nobody calls looks
// exactly like a retry that always succeeds.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

/** The usability rule, exactly as assess-core applies it: present AND not blank. */
const usable = (v: unknown): boolean =>
  v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "");

function missingFrom(obj: Record<string, unknown>, fields: string[]): string[] {
  return fields.filter((f) => !(f in obj) || !usable(obj[f]));
}

/** The merge, exactly as assess-core applies it: only the asked-for gaps, only usable values. */
function mergeRetry(
  assessment: Record<string, unknown>,
  second: Record<string, unknown>,
  asked: string[],
): { filled: string[]; merged: Record<string, unknown> } {
  const merged = { ...assessment };
  const filled: string[] = [];
  for (const k of asked) {
    if (k in second && usable(second[k])) { merged[k] = second[k]; filled.push(k); }
  }
  return { filled, merged };
}

const TIER2 = [
  "trapStatusSummary", "adjustedNetIncomeCalculation", "allowanceTaperImpact", "trapBandExposure",
  "taxOnLast10k", "pensionEscapeRequirement", "taxSavingProjection", "salarySacrificeOptimisation",
  "personalSippTopupStrategy", "bonusTimingStrategy", "multiYearPensionPlan",
  "spousalIncomeShifting", "accountantCoordinationBrief",
];

/** The real pack: twelve exact, the thirteenth renamed. */
const RENAMED_PACK: Record<string, unknown> = Object.fromEntries(
  TIER2.map((k) => (k === "multiYearPensionPlan" ? ["multiYearPlanningStrategy", "text"] : [k, "text"])),
);

test("the measured case: one requested field is absent", () => {
  assert.deepEqual(missingFrom(RENAMED_PACK, TIER2), ["multiYearPensionPlan"]);
});

test("a BLANK value counts as missing, not as a field", () => {
  // The whole point is the section the buyer sees. An empty string renders the same blank as an
  // absent key, so it must be asked for again too.
  for (const blank of ["", "   ", "\n", null, undefined]) {
    const pack = { ...RENAMED_PACK, multiYearPensionPlan: blank };
    assert.deepEqual(missingFrom(pack, TIER2), ["multiYearPensionPlan"], `blank: ${JSON.stringify(blank)}`);
  }
});

test("a value of 0 or false is NOT missing — only absent or blank is", () => {
  for (const real of [0, false, "0"]) {
    const pack = { ...RENAMED_PACK, multiYearPensionPlan: real };
    assert.deepEqual(missingFrom(pack, TIER2), [], `value: ${JSON.stringify(real)}`);
  }
});

test("the retry merges only the keys it asked for", () => {
  const second = {
    multiYearPensionPlan: "the plan",
    trapStatusSummary: "REWRITTEN — must not land",   // already accepted; must be ignored
    someInvention: "also must not land",
  };
  const { filled, merged } = mergeRetry(RENAMED_PACK, second, ["multiYearPensionPlan"]);
  assert.deepEqual(filled, ["multiYearPensionPlan"]);
  assert.equal(merged.multiYearPensionPlan, "the plan");
  // THE REASON THE RETRY ASKS ONLY FOR THE GAPS: a full re-run could return different text for the
  // twelve fields that were already correct. Merging cannot regress one.
  assert.equal(merged.trapStatusSummary, "text", "an already-accepted field must not be overwritten");
  assert.ok(!("someInvention" in merged), "an invented key must not be merged in");
});

test("a retry that comes back blank fills nothing, and the absence stands", () => {
  const { filled, merged } = mergeRetry(RENAMED_PACK, { multiYearPensionPlan: "   " }, ["multiYearPensionPlan"]);
  assert.deepEqual(filled, []);
  assert.deepEqual(missingFrom(merged, TIER2), ["multiYearPensionPlan"]);
});

test("a retry that renames AGAIN fills nothing", () => {
  // The failure mode this retry exists to beat, tried twice.
  const { filled, merged } = mergeRetry(RENAMED_PACK, { multiYearPlanningStrategy: "same mistake" }, ["multiYearPensionPlan"]);
  assert.deepEqual(filled, []);
  assert.deepEqual(missingFrom(merged, TIER2), ["multiYearPensionPlan"]);
});

test("a successful retry leaves nothing missing", () => {
  const { merged } = mergeRetry(RENAMED_PACK, { multiYearPensionPlan: "the plan" }, ["multiYearPensionPlan"]);
  assert.deepEqual(missingFrom(merged, TIER2), []);
});

test("several absences are all named, in the requested order", () => {
  const thin: Record<string, unknown> = { trapStatusSummary: "text", taxOnLast10k: "text" };
  const miss = missingFrom(thin, TIER2);
  assert.equal(miss.length, 11);
  assert.equal(miss[0], "adjustedNetIncomeCalculation");
  assert.ok(miss.includes("multiYearPensionPlan"));
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// THE WIRING — read off assess-core.ts, because a retry nobody calls looks like one that works
// ════════════════════════════════════════════════════════════════════════════════════════════

const SRC = fs.readFileSync(path.join(process.cwd(), "lib", "assess-core.ts"), "utf-8");
const CODE = SRC.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");

test("the model call is expressed ONCE, so the retry cannot drift from the first pass", () => {
  assert.match(CODE, /const callModel = async \(promptText: string\)/);
  assert.equal(
    (CODE.match(/https:\/\/api\.anthropic\.com\/v1\/messages/g) ?? []).length, 1,
    "two longhand fetches is how the model, the version header and the token budget quietly diverge",
  );
});

test("the retry is attempted only when something is missing", () => {
  assert.match(CODE, /if \(missingKeys\.length > 0\) \{[\s\S]*?const second = await callModel\(retryPrompt\)/);
});

test("it is ONE retry, not a loop", () => {
  assert.equal((CODE.match(/await callModel\(/g) ?? []).length, 2, "exactly two calls: the pass and the retry");
  assert.ok(!/while\s*\([^)]*missing/i.test(CODE), "no loop on the missing set");
});

test("the retry prompt names the keys one per line and forbids renaming", () => {
  assert.match(CODE, /missingKeys\.map\(\(k\) => `  - \$\{k\}`\)\.join\("\\n"\)/);
  assert.match(SRC, /do not rename\s*\n?them/);
  assert.match(SRC, /spelled EXACTLY as listed above/);
});

test("still missing after the retry FAILS the delivery", () => {
  assert.match(CODE, /error: "assessment_incomplete"/);
  assert.match(CODE, /status: 502/);
  // and it names the keys, so the operator does not have to go and find them
  assert.match(SRC, /\$\{missingKeys\.join\(", "\)\}/);
});

test("the fail-closed return is NOT ok:true with a note", () => {
  const i = CODE.indexOf('error: "assessment_incomplete"');
  assert.ok(i > 0);
  const block = CODE.slice(Math.max(0, i - 400), i);
  assert.match(block, /return \{\s*\n?\s*ok: false/);
});

test("the retry is recorded on the success result, so a silent retry is impossible", () => {
  assert.match(SRC, /retry\?: \{ asked: string\[\]; filled: string\[\] \}/);
  assert.match(CODE, /\.\.\.\(retry \? \{ retry \} : \{\}\)/);
});

test("the unrequested-key removal still happens, and still never renames", () => {
  assert.match(CODE, /for \(const k of unrequestedKeys\) delete assessment\[k\]/);
  assert.ok(!/assessment\[\s*requested/.test(CODE), "no auto-rename of a near-miss key");
});
