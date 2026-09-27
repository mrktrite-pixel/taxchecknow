// scripts/heal-us-expat-tax-rows.ts — re-store two TEST assessments against the fixed registry.
//
// Run: npx tsx scripts/heal-us-expat-tax-rows.ts            (dry run — prints, writes nothing)
//      npx tsx scripts/heal-us-expat-tax-rows.ts --write     (writes the two rows)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// WHY THIS EXISTS, AND WHY IT IS AN ALLOW-LIST RATHER THAN A BACKFILL
//
// F42: "us-expat-tax" was missing from PRODUCT_ASSESSMENT_FIELDS, so the webhook stored
// GENERIC_FIELDS while both success pages render this product's own keys. Measured on these two
// rows: of the six keys success/assess/page.tsx:327 renders, ZERO were present — the body rendered
// EMPTY. The registry is fixed, but a stored row is not re-derived on view, so these two stay broken
// until something rewrites them.
//
// /api/freeze-pack cannot do it: it is WRITE-ONCE and both rows already carry a `rendered` pack, so
// it answers "already frozen" and writes nothing. That refusal is correct — a bought document must
// not be rewritable from a browser. Which is exactly why this is a deliberate, named, server-side
// script instead.
//
// ── THE GUARDS, AND WHY EACH ONE ──
// 1. AN EXPLICIT ALLOW-LIST of two session ids. Not a slug filter, not "all rows with generic
//    keys": a backfill that rewrites bought documents is a different decision, with a different
//    blast radius, and nobody authorised it.
// 2. TEST MODE ONLY. Every id must start with cs_test_. A live buyer's document is never touched by
//    this script, no matter what is added to the list.
// 3. THE ROW MUST ALREADY BE GENERIC. If a row already carries the product's keys there is nothing
//    to heal and it is skipped — so a second run is a no-op rather than a second LLM bill and a
//    different document.
// 4. DRY BY DEFAULT. Nothing is written without --write.
//
// ── IT REPRODUCES THE WEBHOOK, IT DOES NOT INVENT ──
// inputs come from the decision_sessions row via buildComposerInputs — the same call the webhook
// makes (route.ts:186) — so the healed document answers the questions the buyer actually answered.
// The name is carried over from the existing row so the greeting does not change. fields come from
// getAssessmentFields, which is the thing that was wrong and is now right.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import { generateAssessment } from "@/lib/assess-core";
import { renderPack } from "@/lib/render-pack";
import { getAssessmentFields } from "@/lib/assessment-fields";
import { buildComposerInputs } from "@/lib/composer-inputs";

const ALLOWED: ReadonlyArray<{ tier: number; sessionId: string }> = [
  { tier: 67, sessionId: "cs_test_a16k1lTvft81mIjDtZwyyltRu5XneNl9FMnZgFBnQolNKDkYbsUY3gDxGa" },
  { tier: 147, sessionId: "cs_test_a1t9eURb9FfQ4jzNPbsH0zpE7ARKv2hWKg3BFDKUCr8HtXaY74hW7fZ5ZE" },
];

const PRODUCT_ID = "us-expat-tax";
const MARKET = "United States";
const AUTHORITY = "Internal Revenue Service (IRS)";
const WRITE = process.argv.includes("--write");
/**
 * --rerender: rebuild `rendered` from the field values ALREADY IN THE ROW. No model call.
 *
 * STEP8. F44 changed what packHeading() produces — `feieEligibility` now renders as
 * "FEIE Eligibility" instead of "Feie Eligibility" — and a frozen pack stores its headings, so the
 * two rows sold before that change would have kept showing the misspelling forever while every new
 * pack showed it correctly. Two truths for one product, which is the thing freezing exists to stop.
 *
 * DELIBERATELY NOT A REGENERATION. The heal path re-runs the model and replaces every field; this
 * touches only the presentation layer, so no sentence a buyer has already read changes. It is also
 * free and deterministic, which a model call is neither.
 *
 * It therefore does NOT fix the first-person text in `annualTaxSaving` / `ftcCalculation` — that
 * lives in the field VALUES. See the report: this script cannot rewrite one field, and rewriting
 * all of them is a content decision on a delivered document.
 */
const RERENDER = process.argv.includes("--rerender");

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** The generic fallback keys. A row made only of these is the defect being healed. */
const GENERIC = new Set([
  "status", "keyFinding", "exposureAmount", "mainRiskTrigger", "recommendedAction",
  "confidenceLevel", "firstAction", "implementationPlan", "scenarioAnalysis",
  "evidenceRequired", "timelineStrategy",
]);

async function main(): Promise<void> {
  console.log(`\nheal-us-expat-tax-rows — ${WRITE ? "WRITE" : "DRY RUN (pass --write to apply)"}\n`);
  const sb = db();
  let healed = 0;

  for (const { tier, sessionId } of ALLOWED) {
    const label = `tier ${tier}`;
    if (!sessionId.startsWith("cs_test_")) {
      console.error(`${label}: REFUSED — ${sessionId.slice(0, 12)}… is not a test session`);
      process.exitCode = 3;
      continue;
    }

    const pr = await sb.from("purchases")
      .select("id, decision_session_id, product_key, tier")
      .eq("stripe_session_id", sessionId).maybeSingle();
    if (pr.error || !pr.data) { console.error(`${label}: no purchase row (${pr.error?.message ?? "not found"})`); continue; }
    const purchase = pr.data as { id: string; decision_session_id: string | null; product_key: string; tier: number };

    const ar = await sb.from("assessments")
      .select("id, customer_name, customer_email, assessment_json")
      .eq("stripe_session_id", sessionId).maybeSingle();
    if (ar.error || !ar.data) { console.error(`${label}: no assessment row (${ar.error?.message ?? "not found"})`); continue; }
    const row = ar.data as { id: string; customer_name: string | null; customer_email: string | null; assessment_json: Record<string, unknown> };

    const existing = Object.keys(row.assessment_json)
      .filter((k) => k !== "_meta" && k !== "rendered" && typeof row.assessment_json[k] === "string");
    const allGeneric = existing.length > 0 && existing.every((k) => GENERIC.has(k));

    // ── --rerender: presentation only ─────────────────────────────────────────────────────────
    if (RERENDER) {
      const fields = getAssessmentFields(PRODUCT_ID, purchase.tier);
      const name = row.customer_name ?? "this taxpayer";
      const before = ((row.assessment_json.rendered ?? {}) as { sections?: Array<{ heading?: string }> }).sections ?? [];
      const rendered = renderPack(row.assessment_json, {
        productId: PRODUCT_ID, tier: purchase.tier, customerName: name, fieldList: fields,
      });
      const beforeHeads = before.map((x) => String(x.heading));
      const afterHeads = rendered.sections.map((x) => x.heading);
      const changed = JSON.stringify(beforeHeads) !== JSON.stringify(afterHeads);
      console.log(`${label}: purchase ${purchase.id}`);
      console.log(`   headings before : ${beforeHeads.join(" | ")}`);
      console.log(`   headings after  : ${afterHeads.join(" | ")}`);
      console.log(`   ${changed ? "CHANGED" : "identical — nothing to write"}`);
      // THE TEXT MUST BE UNTOUCHED. A re-render that altered a sentence would be a content edit
      // wearing a presentation edit's name, so it is asserted rather than assumed.
      const beforeText = before.map((x) => String((x as { text?: string }).text ?? ""));
      const afterText = rendered.sections.map((x) => x.text);
      if (beforeText.length === afterText.length && beforeText.some((t, i) => t !== afterText[i])) {
        console.error(`   REFUSED — a section's TEXT changed, which --rerender must never do`);
        process.exitCode = 4;
        continue;
      }
      if (changed && WRITE) {
        const assessment_json = { ...row.assessment_json, rendered };
        const up = await sb.from("assessments").update({ assessment_json }).eq("stripe_session_id", sessionId);
        if (up.error) { console.error(`   update FAILED: ${up.error.message}`); process.exitCode = 1; continue; }
        console.log(`   ✅ rendered rewritten (headings only)`);
        healed++;
      } else if (changed) {
        console.log(`   (dry run — pass --write to apply)`);
      }
      continue;
    }

    if (!allGeneric) {
      console.log(`${label}: SKIPPED — already carries product keys (${existing.join(", ")})`);
      continue;
    }

    if (!purchase.decision_session_id) { console.error(`${label}: no decision_session_id — cannot rebuild the buyer's inputs`); continue; }
    const ds = await sb.from("decision_sessions")
      .select("inputs, questionnaire_payload")
      .eq("id", purchase.decision_session_id).maybeSingle();
    if (ds.error || !ds.data) { console.error(`${label}: decision_sessions row missing`); continue; }
    const sess = ds.data as { inputs: Record<string, unknown>; questionnaire_payload: Record<string, unknown> };

    // The webhook's own call (route.ts:186) — maze flags authoritative, popup answers namespaced.
    const inputs = buildComposerInputs(sess.inputs ?? {}, sess.questionnaire_payload ?? {});
    const fields = getAssessmentFields(PRODUCT_ID, purchase.tier);
    const name = row.customer_name ?? "this taxpayer";

    console.log(`${label}: purchase ${purchase.id}`);
    console.log(`   stored keys now : ${existing.join(", ")}`);
    console.log(`   field list      : ${fields.length} keys — ${fields.join(", ")}`);
    console.log(`   inputs          : ${Object.keys(inputs).length} answered`);

    const result = await generateAssessment({
      product_id: PRODUCT_ID, market: MARKET, authority: AUTHORITY,
      tier: purchase.tier >= 147 ? 2 : 1, name, inputs, fields,
    });
    if (!result.ok) { console.error(`   generate FAILED ${result.status}: ${result.error} — row untouched`); process.exitCode = 1; continue; }

    const rendered = renderPack(result.assessment as Record<string, unknown>, {
      productId: PRODUCT_ID, tier: purchase.tier, customerName: name, fieldList: fields,
    });
    const assessment_json = {
      ...result.assessment,
      _meta: { grounded: true, corpus_source: result.corpus_source, corpus_verified: result.corpus_verified },
      rendered,
    };

    const newKeys = Object.keys(result.assessment as Record<string, unknown>);
    console.log(`   generated keys  : ${newKeys.join(", ")}`);
    console.log(`   rendered.sections (${rendered.sections.length}):`);
    for (const [i, s] of rendered.sections.entries()) {
      console.log(`       ${String(i + 1).padStart(2)}. ${s.heading}`);
    }

    if (!WRITE) { console.log(`   DRY RUN — not written\n`); continue; }
    const up = await sb.from("assessments").update({ assessment_json }).eq("stripe_session_id", sessionId);
    if (up.error) { console.error(`   WRITE FAILED: ${up.error.message}`); process.exitCode = 1; continue; }
    console.log(`   WRITTEN\n`);
    healed += 1;
  }

  console.log(WRITE ? `healed ${healed} row(s)\n` : "dry run complete — nothing written\n");
}

main().catch((e) => { console.error("[heal] fatal:", e instanceof Error ? e.message : String(e)); process.exitCode = 1; });
