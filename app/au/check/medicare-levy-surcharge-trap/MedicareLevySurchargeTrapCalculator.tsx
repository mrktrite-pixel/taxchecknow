"use client";

// MACHINE PRODUCT (medicare-levy-surcharge-trap PANELBEAT migration) — mounts the generic
// EngineCalculator against the Bee-D engine (engine.json) + verified figure pool (figures.json),
// replacing the legacy bespoke calculator. Tier + severity live PER-TERMINAL in engine.json (the
// operator overlay ruled 2026-07-31). Commerce is UNCHANGED: the productKey
// (au_<tier>_medicare_levy_surcharge_trap) and success paths are exactly the live product's —
// checkout still routes through the real /api/create-checkout-session and the same Stripe env vars.
//
// WHAT THIS RETIRES, and why it matters more than a normal migration. The bespoke ran 2023-24
// constants that the 2026-07-31 config correction did NOT reach: INCOME_MIDPOINTS (under_93k 80000
// · band_93_108 100000 · band_108_144 125000 · over_144k 170000), calcMLSRate banding on
// 93001/108000/144000, the $186,000 family branch, and coverCostLow/High 1200/1800 single ·
// 3000/5000 family with a COMPUTED net saving. Live, that combination told a single filer who
// selected "$93,001 – $108,000" they owed $1,000 and pushed them to $147, while the corrected page
// copy directly above said the threshold was $101,001. The engine asks against $101,000 / $202,000
// and asserts no premium figure at all, so this mount is what actually closes that contradiction.
//
// SCOPE — what the engine does NOT reproduce is recorded in the Step F/G report, not papered over
// here. The bespoke's extras-only (:163) and high-excess (:194) verdict paths have no engine
// terminal to attach to (overlay ambiguity F), so those two populations now reach the general
// private-cover terminal rather than a dedicated red/amber verdict of their own.
//
// The three qualification fields below are the LIVE bespoke calculator's popup questions, carried
// over verbatim (same keys, same option values, same labels), so questionnaire_payload keeps its
// existing shape across the migration.

import EngineCalculator, { type Engine, type EngineCheckout } from "@/app/_components/EngineCalculator";
import type { EngineConfig } from "@/app/_components/engine-config";
import type { EngineFigure } from "@/app/_components/engine-terms";
import engine from "./engine.json";
import figures from "./figures.json";

const SLUG = "medicare-levy-surcharge-trap";

const ENGINE_CONFIG: EngineConfig = {
  productSlug: SLUG,
  sourcePath: `/au/check/${SLUG}`,
  country: "AU",
  currency: "AUD",
  site: "taxchecknow",
  defaultTier: 67,
  monetizeEveryResolved: true,
  // tier + severity are PER-TERMINAL in engine.json; the config supplies the commercial/presentation layer.
  tierNames: {
    "67": "Your MLS Avoidance Plan",
    "147": "Your Income and Insurance Optimisation System",
  },
  // Fact-first maze — asks facts about the household, the income and the cover, never "what do you
  // want to know". Thresholds named here are 2025-26 per ATO QC49961.
  heroCopy:
    "This check asks a few quick questions about your household, your income for Medicare levy surcharge purposes, and the private hospital cover you hold. Your answers together work out whether the surcharge applies to you for 2025–26 — the singles threshold is $101,000 and the family threshold is $202,000 — and, if it does, what that means before you lodge.",
  qualification: [
    {
      key: "situation",
      label: "What is your main situation?",
      options: [
        { value: "salary", label: "Salary / employment income" },
        { value: "smsf", label: "SMSF or investment income" },
        { value: "business", label: "Business or self-employed" },
        { value: "mixed", label: "Mixed income sources" },
      ],
    },
    {
      key: "urgency",
      label: "How urgently do you need this?",
      options: [
        { value: "before_return", label: "Before lodging my tax return" },
        { value: "next_year", label: "Planning for next financial year" },
        { value: "general", label: "Just understanding my position" },
      ],
    },
    {
      key: "accountant",
      label: "Do you have an accountant?",
      options: [
        { value: "yes_active", label: "Yes — meeting them soon" },
        { value: "yes_inactive", label: "Yes — but haven't spoken recently" },
        { value: "no", label: "No — managing myself" },
      ],
    },
  ],
  copy: {
    ctaLabel: "Get my MLS position — {price} →",
    popupHeading: "Your Medicare levy surcharge position",
    popupSubhead: "A few quick questions, then checkout",
    payLabel: "Pay {price} →",
    dismissLabel: "Not now — keep reading",
    resultLabel: "Your Medicare levy surcharge position",
    bridgeCopy:
      "Most surcharge surprises come down to one of two things: income for MLS purposes being higher than the taxable income people have in mind, or cover that does not qualify — extras-only, or a policy that lapsed part-way through the year. This shows which side of the threshold you are on and what the surcharge would mean before you lodge.",
    planChecklist: [
      "Whether the surcharge applies to you for 2025–26, and how the rate tiers work",
      "What counts in your income for MLS purposes — including net rental property losses, which raise it",
      "Whether the cover you hold actually exempts you, and what happens for any uncovered days",
      "Questions to take to your accountant or tax agent before you lodge",
    ],
    secondaryTierLabel: "Want the full income and insurance optimisation system? — {price}",
    saveHeading: "Save your MLS result to show your accountant.",
    saveSubcopy: "Get a copy of your surcharge position by email — free.",
    escapeLabel: "A closer look at your Medicare levy surcharge position",
    escapeBody:
      "Your answers don't yet point to a single clear surcharge position — usually because a key figure, your household status, or the cover you hold is unconfirmed. A short personalised review confirms which threshold applies to you, whether your cover exempts you, and what the surcharge would cost if it does not.",
    escapeCtaLabel: "Get my personalised MLS review — {price} →",
    reviewGuideTitle: "Medicare Levy Surcharge Review Guide",
  },
};

async function handleCheckout(c: EngineCheckout): Promise<boolean> {
  const productKey = `au_${c.tier}_medicare_levy_surcharge_trap`;
  const origin = window.location.origin;
  const successPath = c.tier === 147 ? "plan" : "assess";
  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision_session_id: c.sessionId || `fallback_${c.tier}`,
        tier: c.tier,
        product_key: productKey,
        success_url: `${origin}/au/check/${SLUG}/success/${successPath}`,
        cancel_url: `${origin}/au/check/${SLUG}`,
      }),
    });
    if (!res.ok) return false; // API 500/4xx — the pay button surfaces the failure instead of no-oping
    const data = await res.json();
    if (data.url) { window.location.href = data.url; return true; }
    return false;
  } catch {
    return false;
  }
}

export default function MedicareLevySurchargeTrapCalculator() {
  return (
    <EngineCalculator
      engine={engine as Engine}
      figures={figures as EngineFigure[]}
      config={ENGINE_CONFIG}
      onCheckout={handleCheckout}
    />
  );
}
