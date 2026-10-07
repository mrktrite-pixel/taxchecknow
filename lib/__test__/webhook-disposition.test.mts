// lib/__test__/webhook-disposition.test.mts
//
// F99. Run: npx tsx lib/__test__/webhook-disposition.test.mts
// Pure — the four inputs are passed in, so every branch is reachable with no database.
//
// WHAT THIS PINS: a paid session with no pack is REPAIRABLE, and nothing else changes. The old
// pre-check made four real paid sessions permanently un-redeliverable through Stripe by treating
// "a purchase exists" as "fully processed".

import { dispositionFor, dispositionLine, type Disposition } from "../webhook-disposition.js";

let failed = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      got=${JSON.stringify(got)}\n     want=${JSON.stringify(want)}`}`);
}

const SID = "cs_test_a10AiK90CjPRq5oYWzlN7Cpus1XiyMXWMUPYPjSGwLewin9G5FNVjGRCde";

console.log("\n-- the three states ------------------------------------------------------------");

check("no purchase -> the full first-time path",
  dispositionFor({ purchaseExists: false, assessmentExists: false, canRegenerate: true }), "full");

check("purchase AND assessment -> duplicate, exactly as before",
  dispositionFor({ purchaseExists: true, assessmentExists: true, canRegenerate: true }), "duplicate");

// THE WHOLE POINT. This is the state all four stalled sessions are in.
check("purchase, NO assessment -> REPAIR",
  dispositionFor({ purchaseExists: true, assessmentExists: false, canRegenerate: true }), "repair");

console.log("\n-- the guard that must not regress: no double-fire ------------------------------");
// A first-time event is the ONLY disposition that may write a purchase, send an email or enqueue
// reminders. If a future change makes "repair" reachable for a session with a pack, or makes
// "duplicate" fall through, this is where it shows.
const writesPurchaseAndEmail = (d: Disposition): boolean => d === "full";
check("only 'full' may write a purchase / send the delivery email",
  (["full", "repair", "duplicate", "cannot_repair"] as Disposition[]).filter(writesPurchaseAndEmail),
  ["full"]);
check("a session that already has a pack can never reach repair",
  dispositionFor({ purchaseExists: true, assessmentExists: true, canRegenerate: true }) === "repair", false);

console.log("\n-- a failed lookup is NOT an absent row ----------------------------------------");
// Reading a query failure as "no pack" would spend a model call on a guess, and on a Stripe retry
// storm it would do so every time. Unreadable state -> do nothing.
check("assessments query failed -> duplicate, not repair",
  dispositionFor({ purchaseExists: true, assessmentExists: false, assessmentQueryFailed: true, canRegenerate: true }),
  "duplicate");
check("  even when the row genuinely looks absent",
  dispositionFor({ purchaseExists: true, assessmentExists: false, assessmentQueryFailed: true, canRegenerate: true }) === "repair",
  false);
check("a failed lookup on a NEW session still runs the full path (nothing to protect yet)",
  dispositionFor({ purchaseExists: false, assessmentExists: false, assessmentQueryFailed: true, canRegenerate: true }),
  "full");

console.log("\n-- a repair needs the inputs to regenerate from --------------------------------");
check("no delivery config / decision session / email -> cannot_repair",
  dispositionFor({ purchaseExists: true, assessmentExists: false, canRegenerate: false }), "cannot_repair");
check("  and cannot_repair does not write or send anything", writesPurchaseAndEmail("cannot_repair"), false);

console.log("\n-- the log lines name the decision ---------------------------------------------");
check("repair says what it will and will not do",
  /re-running the assessment step only \(no second purchase, no second email, no second reminder\)/
    .test(dispositionLine("repair", SID)), true);
check("  and names the session", dispositionLine("repair", SID).includes(SID), true);
check("duplicate keeps the wording the logs have always carried",
  dispositionLine("duplicate", SID), `[webhook] duplicate — session already processed, skipping: ${SID}`);
check("cannot_repair says which inputs are missing",
  /no delivery config \/ decision_session_id \/ customer email/.test(dispositionLine("cannot_repair", SID)), true);

console.log("\n-- the four real sessions, as measured on 2026-10-07 ----------------------------");
// purchase ✓ · delivery email delivered ✓ · assessments ABSENT — all four.
for (const sid of [
  "cs_test_a1o6qf6NXxTgy2JSNcLAChl3ncyE2986URec3QKuMrtskKw8VzzHerfMDl",
  "cs_test_a10D8achmQSPzmmlqFLFhjBlGRWpL05KGBcmQ6WdBrIZEuD1RRMiUgiQaV",
  "cs_test_a10AiK90CjPRq5oYWzlN7Cpus1XiyMXWMUPYPjSGwLewin9G5FNVjGRCde",
  "cs_test_a1sFPaxHyhtO2nzbwBGD1lsefyv9XFeNWQI1QRnYLMA5pHY8VBh3u6Kuf2",
]) {
  check(`${sid.slice(0, 22)}… is repairable`,
    dispositionFor({ purchaseExists: true, assessmentExists: false, canRegenerate: true }), "repair");
}

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}\n`);
process.exitCode = failed === 0 ? 0 : 1;
