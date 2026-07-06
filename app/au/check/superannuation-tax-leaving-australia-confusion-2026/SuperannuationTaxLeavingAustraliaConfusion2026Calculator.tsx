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
  // REAL engine ids. dasp-eligibility-check is a quasi-escape → unmapped (CTA-less); escapes unmapped.
  tierMap: {
    "dasp-tax-whm-visa": 67,
    "dasp-tax-ordinary-visa": 67,
    "dasp-payment-timeline": 67,
    "dasp-id-requirements-high-balance": 67,
    "dasp-unclaimed-super-ato-transfer": 147,
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
