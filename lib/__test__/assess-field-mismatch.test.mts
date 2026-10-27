// lib/__test__/assess-field-mismatch.test.mts
//
// A key the model was not asked for is not a field.
// Run: node --test lib/__test__/assess-field-mismatch.test.mts   (or via the repo's test runner)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// MEASURED on allowance-sniper, 2026-10-27, from the stored tier-147 pack:
//
//     requested   multiYearPensionPlan        (cole/config/uk-02-allowance-sniper.ts:230, and
//                                              lib/assessment-fields.ts, copied from it at mount)
//     stored      multiYearPlanningStrategy   — a string that appears NOWHERE in either repo
//
// Twelve of thirteen tier-2 fields were exact; the thirteenth was renamed by the model. The
// success page binds by KEY, so that section renders blank for every buyer — and nothing caught
// it, because the field-parity gate asks "product keys or generic keys?", which a renamed
// product-shaped key passes.
//
// This pins the logic the fix adds to generateAssessment, expressed on the same shape the real
// function uses, so it holds without a model call or a network fetch.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

/** The rule, exactly as assess-core applies it. */
const RESERVED = new Set(["_meta", "rendered", "status", "actions", "accountantQuestions"]);
function reconcile(assessment: Record<string, unknown>, fields: string[]) {
  const requested = new Set(fields);
  const unrequested = Object.keys(assessment).filter((k) => !requested.has(k) && !RESERVED.has(k));
  const missing = fields.filter((f) => !(f in assessment));
  const kept: Record<string, unknown> = { ...assessment };
  for (const k of unrequested) delete kept[k];
  return { unrequested, missing, kept };
}

const TIER2 = [
  "trapStatusSummary", "adjustedNetIncomeCalculation", "allowanceTaperImpact", "trapBandExposure",
  "taxOnLast10k", "pensionEscapeRequirement", "taxSavingProjection", "salarySacrificeOptimisation",
  "personalSippTopupStrategy", "bonusTimingStrategy", "multiYearPensionPlan",
  "spousalIncomeShifting", "accountantCoordinationBrief",
];

test("the measured rename is caught, and the renamed key does not reach the pack", () => {
  const stored: Record<string, unknown> = { _meta: {}, rendered: true, actions: [], accountantQuestions: [] };
  for (const f of TIER2) stored[f] = "text";
  delete stored.multiYearPensionPlan;
  stored.multiYearPlanningStrategy = "text";          // what the model actually returned

  const r = reconcile(stored, TIER2);
  assert.deepEqual(r.unrequested, ["multiYearPlanningStrategy"], "the renamed key is flagged");
  assert.deepEqual(r.missing, ["multiYearPensionPlan"], "and the field it displaced is reported missing");
  assert.ok(!("multiYearPlanningStrategy" in r.kept), "the unrequested key is removed from the pack");
  assert.equal(Object.keys(r.kept).filter((k) => !RESERVED.has(k)).length, 12, "twelve real fields survive");
});

test("it never renames — the missing field stays missing", () => {
  const stored: Record<string, unknown> = { multiYearPlanningStrategy: "text" };
  const r = reconcile(stored, ["multiYearPensionPlan"]);
  assert.ok(!("multiYearPensionPlan" in r.kept),
    "guessing which requested field the model meant would be an invention");
  assert.deepEqual(r.missing, ["multiYearPensionPlan"]);
});

test("a clean pack is untouched and reports no mismatch", () => {
  const stored: Record<string, unknown> = { _meta: {}, rendered: true };
  for (const f of TIER2) stored[f] = "text";
  const r = reconcile(stored, TIER2);
  assert.deepEqual(r.unrequested, []);
  assert.deepEqual(r.missing, []);
  assert.equal(Object.keys(r.kept).length, TIER2.length + 2);
});

test("the reserved envelope keys are never treated as fields", () => {
  const stored: Record<string, unknown> = {
    _meta: {}, rendered: true, status: "ok", actions: [], accountantQuestions: [], firstAction: "x",
  };
  const r = reconcile(stored, ["firstAction"]);
  assert.deepEqual(r.unrequested, [], "_meta/rendered/status/actions/accountantQuestions are the envelope");
  assert.deepEqual(r.missing, []);
  assert.ok("_meta" in r.kept && "actions" in r.kept, "and they survive into the pack");
});

test("an omission with no rename is still reported", () => {
  const stored: Record<string, unknown> = { trapStatusSummary: "text" };
  const r = reconcile(stored, ["trapStatusSummary", "taxOnLast10k"]);
  assert.deepEqual(r.unrequested, []);
  assert.deepEqual(r.missing, ["taxOnLast10k"]);
});

test("the generic pack that pair A stored would be caught outright", () => {
  // The 01:23 buys, made against a deployment that predated the field registration.
  const generic: Record<string, unknown> = {
    _meta: {}, status: "ok", rendered: true, keyFinding: "x", firstAction: "x",
    exposureAmount: "x", confidenceLevel: "x", mainRiskTrigger: "x", recommendedAction: "x",
    accountantQuestions: [],
  };
  const r = reconcile(generic, TIER2);
  assert.ok(r.unrequested.length >= 6, "every generic key is unrequested");
  assert.equal(r.missing.length, TIER2.length, "and not one requested field is present");
});

test("the fix is wired into generateAssessment, not only into the route", () => {
  // The Stripe webhook calls generateAssessment() IN-PROCESS, so a check in /api/assess alone
  // would miss every real buy. Asserted on the source.
  const src = fs.readFileSync(path.join(process.cwd(), "lib/assess-core.ts"), "utf-8");
  assert.match(src, /const unrequestedKeys = Object\.keys\(assessment\)/, "the check is in assess-core");
  assert.match(src, /for \(const k of unrequestedKeys\) delete assessment\[k\]/, "unrequested keys are removed");
  assert.match(src, /field_mismatch:/, "and the mismatch is part of the returned contract");
  assert.doesNotMatch(src, /assessment\[\s*f\s*\]\s*=\s*assessment\[/, "nothing is auto-renamed");
});
