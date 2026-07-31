"use client";

// MACHINE PRODUCT (rental-property-deduction-audit PANELBEAT migration) — mounts the generic
// EngineCalculator against the Bee-D engine (engine.json) + verified figure pool (figures.json),
// replacing the legacy bespoke calculator. Tier + severity live PER-TERMINAL in engine.json (the
// operator overlay). Commerce is UNCHANGED: the productKey
// (au_<tier>_rental_property_deduction_audit) and success paths are exactly the live product's —
// checkout still routes through the real /api/create-checkout-session and the same Stripe env vars.
//
// SCOPE — RULED 2026-07-30, option (a). The engine CLASSIFIES an expense: it asks what the expense
// was, whether the property was genuinely available for rent, and how the property was used, then
// names the deduction class. It does NOT audit a lodged return for missed depreciation, and no copy
// authored here claims that it does. The product's surrounding copy (h1, tier names, taglines, file
// titles) still promises a missed-deduction audit — that copy is the operator's and is reported in
// the Step F report, not rewritten here.
//
// The three qualification fields below are the LIVE bespoke calculator's popup questions, carried
// over verbatim (same keys, same labels, same option values), so questionnaire_payload keeps its
// existing shape across the migration.

import EngineCalculator, { type Engine, type EngineCheckout } from "@/app/_components/EngineCalculator";
import type { EngineConfig } from "@/app/_components/engine-config";
import type { EngineFigure } from "@/app/_components/engine-terms";
import engine from "./engine.json";
import figures from "./figures.json";

const SLUG = "rental-property-deduction-audit";

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
    "67": "Your Rental Deduction Audit Pack",
    "147": "Your Property Tax Optimisation System",
  },
  // Fact-first maze — asks facts about the expense and the property, never "what do you want to know".
  heroCopy:
    "This check asks a few quick questions about the expense you incurred on your rental property — what the expense was for, whether the property was genuinely available for rent at the time, and how much private use it had. Your answers together work out which deduction class the expense falls into: claimable in full this year, claimed over several years, or not deductible at all.",
  qualification: [
    {
      key: "situation",
      label: "Property ownership",
      options: [
        { value: "individual", label: "Individual owner" },
        { value: "joint", label: "Joint / co-ownership" },
        { value: "trust", label: "Trust or SMSF" },
        { value: "company", label: "Company" },
      ],
    },
    {
      key: "urgency",
      label: "How urgent is this?",
      options: [
        { value: "before_return", label: "Before lodging my return" },
        { value: "amend", label: "Want to amend prior year" },
        { value: "planning", label: "Planning ahead" },
      ],
    },
    {
      key: "accountant",
      label: "Do you have an accountant?",
      options: [
        { value: "yes_active", label: "Yes — meeting them soon" },
        { value: "yes_inactive", label: "Yes — not spoken recently" },
        { value: "no", label: "No — managing myself" },
      ],
    },
  ],
  copy: {
    ctaLabel: "Get my rental deduction pack — {price} →",
    popupHeading: "Your rental deduction position",
    popupSubhead: "A few quick questions, then checkout",
    payLabel: "Pay {price} →",
    dismissLabel: "Not now — keep reading",
    resultLabel: "Your rental deduction position",
    bridgeCopy:
      "Most rental deduction adjustments come down to one thing: an expense claimed in the wrong class or the wrong year — an improvement claimed as a repair, or a full year claimed on a property that was only part-year available. This shows which class your expense falls into and what that means for your return.",
    planChecklist: [
      "Which deduction class your expense falls into — immediate, over several years, or not deductible at all",
      "How the claim must be apportioned if the property was only part-year available or partly private",
      "What the ATO expects you to hold as evidence if it asks",
      "Questions to take to your accountant or tax agent",
    ],
    secondaryTierLabel: "Want the full property tax optimisation system? — {price}",
    saveHeading: "Save your rental deduction result to show your accountant.",
    saveSubcopy: "Get a copy of your deduction classification by email — free.",
    escapeLabel: "A closer look at your rental deduction position",
    escapeBody:
      "Your answers don't point to a single clear deduction class — which usually means the expense spans more than one, or the property's availability is not settled. A short personalised review shows which parts are deductible now, which are claimed over several years, and which are not deductible at all.",
    escapeCtaLabel: "Get my personalised rental deduction review — {price} →",
    reviewGuideTitle: "Rental Deduction Review Guide",
  },
};

async function handleCheckout(c: EngineCheckout): Promise<boolean> {
  const productKey = `au_${c.tier}_rental_property_deduction_audit`;
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

export default function RentalPropertyDeductionAuditCalculator() {
  return (
    <EngineCalculator
      engine={engine as Engine}
      figures={figures as EngineFigure[]}
      config={ENGINE_CONFIG}
      onCheckout={handleCheckout}
    />
  );
}
