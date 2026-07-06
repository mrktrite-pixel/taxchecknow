"use client";

// MACHINE PRODUCT — mounts the generic EngineCalculator against the Bee D engine
// (engine.json) + verified figure pool (figures.json). Tier map is operator-set data;
// escapes/quasi-escapes are unmapped (CTA-less). Stripe checkout handoff is wired to
// the real /api/create-checkout-session so the popup Pay button completes end-to-end.

import EngineCalculator, { type Engine, type EngineCheckout } from "@/app/_components/EngineCalculator";
import type { EngineConfig } from "@/app/_components/engine-config";
import type { EngineFigure } from "@/app/_components/engine-terms";
import engine from "./engine.json";
import figures from "./figures.json";

const SLUG = "superannuation-tax-leaving-australia-confusion-2026";

const ENGINE_CONFIG: EngineConfig = {
  productSlug: SLUG,
  sourcePath: `/au/check/${SLUG}`,
  country: "AU",
  currency: "AUD",
  site: "taxchecknow",
  defaultTier: 67,
  // REAL engine ids. Escapes/quasi-escapes unmapped → forced $67 "closer look".
  tierMap: {
    "dasp-eligibility-check": 67,
    "dasp-tax-whm-visa": 67,
    "dasp-tax-ordinary-visa": 67,
    "dasp-payment-timeline": 67,
    "dasp-id-requirements-high-balance": 67,
    "dasp-unclaimed-super-ato-transfer": 147,
    // named-complexity 147 dishes (PQ-MAZE-1 phase 2)
    "dasp-mixed-visa-apportionment": 147,
    "dasp-multi-fund-or-former-pr": 147,
  },
  // Operator-APPROVED severity classes (judgment gate) → traffic-light banner colour.
  severity: {
    "dasp-eligibility-check": "warning",
    "dasp-tax-ordinary-visa": "warning",
    "dasp-tax-whm-visa": "urgent",
    "dasp-id-requirements-high-balance": "warning",
    "dasp-payment-timeline": "clear",
    "dasp-unclaimed-super-ato-transfer": "urgent",
    "dasp-mixed-visa-apportionment": "urgent",
    "dasp-multi-fund-or-former-pr": "urgent",
  },
  tierNames: {
    "67": "DASP & Departure Super Plan",
    "147": "Departure Tax & Super Optimisation System",
  },
  qualification: [
    {
      key: "situation",
      label: "What is your main situation?",
      options: [
        { value: "leaving_permanently", label: "Leaving permanently" },
        { value: "leaving_temporarily", label: "Leaving temporarily" },
        { value: "already_left", label: "Already left" },
        { value: "helping_someone", label: "Helping someone else" },
      ],
    },
    {
      key: "urgency",
      label: "How urgent is this?",
      options: [
        { value: "within_a_month", label: "Leaving within a month" },
        { value: "within_6_months", label: "Within 6 months" },
        { value: "already_gone", label: "Already gone" },
        { value: "just_planning", label: "Just planning" },
      ],
    },
    {
      key: "accountant",
      label: "Do you have an accountant?",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        { value: "considering", label: "Considering one" },
      ],
    },
  ],
  copy: {
    ctaLabel: "Get my DASP & departure super plan — {price} →",
    popupHeading: "Your DASP & departure super plan",
    popupSubhead: "A few quick questions, then checkout",
    payLabel: "Pay {price} →",
    dismissLabel: "Not now — keep reading",
    // ── result-panel parity (DASP-flavoured) ──
    resultLabel: "Your DASP position",
    bridgeCopy:
      "Most people leaving Australia either leave super sitting unclaimed or get the visa-class tax wrong — and only find out later. This shows your exact DASP position and what to do about it.",
    planChecklist: [
      "Your DASP tax position by visa class — taxed and untaxed elements",
      "The 28-day payment window and what to prepare before you claim",
      "What happens to unclaimed super after 6 months (ATO transfer)",
      "Questions to take to your accountant or adviser",
    ],
    secondaryTierLabel: "Want the full departure tax & super optimisation system? — {price}",
    saveHeading: "Save your DASP result to show your adviser.",
    saveSubcopy: "Get a copy of your position by email — free.",
    // ── escape / quasi-escape (a "closer look", never a confirmed position) ──
    escapeLabel: "A closer look at your super",
    escapeBody:
      "Your answers don't point to a single clear DASP path — which usually means your situation needs a closer look. A short personalised review shows what applies to your circumstances after leaving Australia, and the steps to take next.",
    escapeCtaLabel: "Get my personalised super review — {price} →",
  },
};

async function handleCheckout(c: EngineCheckout): Promise<void> {
  const productKey = `au_${c.tier}_superannuation_tax_leaving_australia_confusion_2026`;
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
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  } catch {
    /* non-blocking — surfaced by the checkout endpoint */
  }
}

export default function SuperannuationTaxLeavingAustraliaConfusion2026Calculator() {
  return (
    <EngineCalculator
      engine={engine as Engine}
      figures={figures as EngineFigure[]}
      config={ENGINE_CONFIG}
      onCheckout={handleCheckout}
    />
  );
}
