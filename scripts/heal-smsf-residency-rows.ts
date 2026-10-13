// scripts/heal-smsf-residency-rows.ts — re-store two TEST assessments against the fixed registry.
//
// Run: npx tsx scripts/heal-smsf-residency-rows.ts                     (dry run — writes nothing)
//      npx tsx scripts/heal-smsf-residency-rows.ts --write --force
//      npx tsx scripts/heal-smsf-residency-rows.ts --write --rerender  (headings only, no model call)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// WHY THIS EXISTS, AND WHY IT IS AN ALLOW-LIST RATHER THAN A BACKFILL
//
// F42: "australia-smsf-residency" was missing from PRODUCT_ASSESSMENT_FIELDS, so the webhook stored
// GENERIC_FIELDS while both success pages POST and render this product's own keys. MEASURED on the
// two step-4 rows, 2026-09-28:
//
//   tier 67  (cs_test_a1Nq2M…, assessment 6c4de325)  status, keyFinding, firstAction,
//                                                    exposureAmount, confidenceLevel,
//                                                    mainRiskTrigger, recommendedAction
//   tier 147 (cs_test_a14Pk9…, assessment 41885800)  the tier-2 generic ten, plus actions
//   the pages' own keys                              cmcTestOutcome, activeMemberTestOutcome,
//                                                    establishmentTestOutcome, … (8 / 13)
//   overlap                                          ZERO
//
// The registry is fixed, but a stored row is not re-derived on view, so these two stay broken until
// something rewrites them. /api/freeze-pack cannot: it is WRITE-ONCE and both rows already carry a
// `rendered` pack, so it answers "already frozen". That refusal is correct — a bought document must
// not be rewritable from a browser — which is exactly why this is a named server-side script.
//
// ── THE GUARDS, AND WHY EACH ONE ──
// 1. AN EXPLICIT ALLOW-LIST of two session ids. Not a slug filter, not "all rows with generic
//    keys": a backfill that rewrites bought documents is a different decision with a different
//    blast radius, and nobody authorised it.
// 2. TEST MODE ONLY. Every id must start with cs_test_. A live buyer's document is never touched.
// 3. THE ROW MUST ALREADY BE GENERIC, unless --force. A second run is then a no-op rather than a
//    second model bill and a different document.
// 4. DRY BY DEFAULT.
//
// ── IT REPRODUCES THE WEBHOOK, IT DOES NOT INVENT ──
// inputs come from the decision_sessions row via buildComposerInputs — the same call the webhook
// makes (route.ts:186). market and authority are PARSED OUT OF THE WEBHOOK'S OWN DELIVERY_MAP
// rather than retyped here: the webhook passes delivery.market / delivery.authority (route.ts:208),
// and for this product those are "Australia" and "ATO" — not the config's longer
// "Australian Taxation Office (ATO)". Hardcoding the long form would ground the model against a
// different prompt than a real purchase does, which is the kind of near-miss that makes a healed
// row look right and read differently. (The us-expat heal script does hardcode it; noted there.)
//
// ── THE CORPUS ──
// generateAssessment fetches the product's corpus over HTTP, defaulting to production. VERIFIED
// before writing, not assumed: app/api/rules/australia-smsf-residency/route.ts is BYTE-IDENTICAL on
// this branch and on origin/main (blob d7dfc420e6376eb4cf9e122d6a14197b6844313e), and production
// serves last_verified "April 2026", which is what the config declares. So production's corpus IS
// this branch's corpus for this product — unlike us-expat-tax, where regenerating against
// production would have written a two-year-stale FEIE limit. The origin is printed on every run.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generateAssessment } from "@/lib/assess-core";
import { renderPack } from "@/lib/render-pack";
import { getAssessmentFields } from "@/lib/assessment-fields";
import { buildComposerInputs } from "@/lib/composer-inputs";

const ALLOWED: ReadonlyArray<{ tier: number; sessionId: string }> = [
  { tier: 67, sessionId: "cs_test_a1Nq2Mr8I3FeS47gSU2dqFSzVK4gSSuTL5P770am7u88rA4MyOpPMwM5Sg" },
  { tier: 147, sessionId: "cs_test_a14Pk9q0Y9atz4weHkcEGzM9x4fMFGwRQgvLh7uOx9u7tlnMSKUnHayeXc" },
];

const PRODUCT_ID = "australia-smsf-residency";
/** The price key whose DELIVERY_MAP row the webhook would have used for tier 1. */
const TIER1_PRICE_KEY = "nomad_67_au_smsf";

const WRITE = process.argv.includes("--write");
/** --rerender: rebuild `rendered` from the values ALREADY in the row. No model call, no text change. */
const RERENDER = process.argv.includes("--rerender");
/** --force: regenerate a row that already carries product keys. Relaxes NOTHING else. */
const FORCE = process.argv.includes("--force");

/**
 * market and authority exactly as the webhook would pass them — read from its own table.
 *
 * Parsed rather than imported so this script never pulls a route module (and its Stripe client)
 * into a CLI process, and never becomes a reason to edit that file.
 */
function deliveryIdentity(priceKey: string): { market: string; authority: string; productId: string } {
  const file = path.join(process.cwd(), "app", "api", "stripe", "webhook", "route.ts");
  const src = fs.readFileSync(file, "utf8");
  const row = new RegExp(`"${priceKey}":\\s*\\{([^}]*)\\}`).exec(src);
  if (!row) throw new Error(`[heal] no DELIVERY_MAP entry for "${priceKey}" — refusing to guess market/authority`);
  const field = (k: string): string => {
    const m = new RegExp(`${k}:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(row[1]);
    if (!m) throw new Error(`[heal] DELIVERY_MAP["${priceKey}"] has no ${k}`);
    return m[1];
  };
  return { market: field("market"), authority: field("authority"), productId: field("productId") };
}

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
  // Not in GENERIC_FIELDS, but injected by assess-core for every product, so their presence says
  // nothing about whether the per-product list was used.
  "actions", "accountantQuestions",
]);

async function main(): Promise<void> {
  console.log(`\nheal-smsf-residency-rows — ${WRITE ? "WRITE" : "DRY RUN (pass --write to apply)"}${FORCE ? " --force" : ""}${RERENDER ? " --rerender" : ""}`);
  const identity = deliveryIdentity(TIER1_PRICE_KEY);
  if (identity.productId !== PRODUCT_ID) {
    throw new Error(`[heal] DELIVERY_MAP says productId "${identity.productId}" but this script targets "${PRODUCT_ID}" — refusing`);
  }
  console.log(`   product         : ${PRODUCT_ID}`);
  console.log(`   webhook identity: market="${identity.market}" authority="${identity.authority}"  (read from DELIVERY_MAP, not retyped)`);
  console.log(`   corpus origin   : ${process.env.NEXT_PUBLIC_SITE_URL || "https://taxchecknow.com (DEFAULT — production/main)"}\n`);

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
    const row = ar.data as { id: string; customer_name: string | null; assessment_json: Record<string, unknown> };

    const existing = Object.keys(row.assessment_json)
      .filter((k) => k !== "_meta" && k !== "rendered" && typeof row.assessment_json[k] === "string");
    const allGeneric = existing.length > 0 && existing.every((k) => GENERIC.has(k));

    // ── --rerender: presentation only ─────────────────────────────────────────────────────────
    if (RERENDER) {
      const fields = getAssessmentFields(PRODUCT_ID, purchase.tier);
      const name = row.customer_name ?? "this taxpayer";
      const before = ((row.assessment_json.rendered ?? {}) as { sections?: Array<{ heading?: string; text?: string }> }).sections ?? [];
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
      const beforeText = before.map((x) => String(x.text ?? ""));
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

    if (!allGeneric && !FORCE) {
      console.log(`${label}: SKIPPED — already carries product keys (${existing.join(", ")}). --force to regenerate anyway.`);
      continue;
    }
    if (!allGeneric && FORCE) {
      console.log(`${label}: FORCED — row already carries product keys, regenerating anyway (${existing.length} keys)`);
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

    console.log(`${label}: purchase ${purchase.id} · assessment ${row.id}`);
    console.log(`   stored keys now : ${existing.join(", ")}`);
    console.log(`   field list      : ${fields.length} keys — ${fields.join(", ")}`);
    console.log(`   inputs          : ${Object.keys(inputs).length} answered`);

    const result = await generateAssessment({
      product_id: PRODUCT_ID, market: identity.market, authority: identity.authority,
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
