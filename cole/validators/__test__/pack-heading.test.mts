// cole/validators/__test__/pack-heading.test.mts
//
// F44. Run: npx tsx cole/validators/__test__/pack-heading.test.mts
// Pure. Lives beside the gate test because both guard the same thing: what a buyer reads.
//
// WHY THIS IS PINNED. packHeading() output is STORED inside every frozen pack, so a regression here
// does not just render wrongly once — it is written into the buyer's document and stays there until
// somebody re-renders it. Two of the six sections on every us-expat-tax pack sold read
// "Feie Eligibility" and "Ftc Calculation" until this was fixed.

import { packHeading, PACK_HEADING_ACRONYMS } from "../../../lib/render-pack.js";
import { getAssessmentFields } from "../../../lib/assessment-fields.js";

let failed = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
}

console.log("\n-- the acronyms that were being lower-cased -----------------------------------");
for (const [key, want] of [
  ["feieEligibility", "FEIE Eligibility"],
  ["ftcCalculation", "FTC Calculation"],
  ["fbarFatcaRequirements", "FBAR FATCA Requirements"],
  ["irsPosition", "IRS Position"],
  ["atoPosition", "ATO Position"],
  ["hmrcPosition", "HMRC Position"],
  ["cgtExposure", "CGT Exposure"],
  ["smsfStatus", "SMSF Status"],
  ["fatcaFbarAtoCgt", "FATCA FBAR ATO CGT"],
] as Array<[string, string]>) check(key, packHeading(key), want);

console.log("\n-- ordinary words must NOT be shouted ----------------------------------------");
// Every one of these would have been caught by a "short words are acronyms" rule.
for (const [key, want] of [
  ["keyFinding", "Key Finding"],
  ["taxYearPlan", "Tax Year Plan"],
  ["annualTaxSaving", "Annual Tax Saving"],
  ["status", "Status"],
  ["firstAction", "First Action"],
  ["preSettlementExecutionPlan", "Pre Settlement Execution Plan"],
  ["multiYearCreditOptimisation", "Multi Year Credit Optimisation"],
  ["snake_case_key", "Snake case key"],
] as Array<[string, string]>) check(key, packHeading(key), want);

console.log("\n-- every registered key renders without a lower-cased acronym -----------------");
const lowered = ["Feie", "Ftc", "Fbar", "Fatca", "Irs", "Ato", "Hmrc", "Cgt", "Smsf"];
for (const id of ["us-expat-tax", "frcgw-clearance-certificate"]) {
  for (const tier of [67, 147]) {
    for (const k of getAssessmentFields(id, tier)) {
      const h = packHeading(k);
      const bad = lowered.filter((w) => new RegExp(`\\b${w}\\b`).test(h));
      if (bad.length) { failed++; console.log(`FAIL  ${id} ${tier} ${k} -> "${h}" (${bad.join(",")})`); }
    }
  }
}
console.log(`      checked both products, both tiers — ${failed === 0 ? "none lower-cased" : "see failures above"}`);
check(`acronym list has ${PACK_HEADING_ACRONYMS.length} entries`, PACK_HEADING_ACRONYMS.length, 9);

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}\n`);
process.exitCode = failed === 0 ? 0 : 1;
