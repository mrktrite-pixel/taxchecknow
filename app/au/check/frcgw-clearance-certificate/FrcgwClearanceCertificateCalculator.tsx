"use client";

// MACHINE PRODUCT (FRCGW PANELBEAT migration) — mounts the generic EngineCalculator against the Bee-D
// engine (engine.json) + verified figure pool (figures.json), replacing the legacy bespoke calculator.
// Tier + severity live PER-TERMINAL in engine.json (the operator overlay). Commerce is UNCHANGED: the
// productKey (au_<tier>_frcgw_clearance_certificate) and success paths are exactly the live product's —
// checkout still routes through the real /api/create-checkout-session and the same Stripe env vars.

import EngineCalculator, { type Engine, type EngineCheckout } from "@/app/_components/EngineCalculator";
import type { EngineConfig } from "@/app/_components/engine-config";
import type { EngineFigure } from "@/app/_components/engine-terms";
import engine from "./engine.json";
import figures from "./figures.json";

const SLUG = "frcgw-clearance-certificate";

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
    "67": "Your FRCGW Clearance Pack",
    "147": "Your FRCGW Execution Pack",
  },
  // Fact-first maze — asks facts about the sale, never "what do you want to know".
  heroCopy:
    "This check asks a few quick questions about your property sale — whether you have a clearance certificate, your residency for tax, and how close settlement is. Your answers together work out exactly where you stand with the 15% Foreign Resident Capital Gains Withholding before your sale settles.",
  qualification: [
    {
      key: "situation",
      label: "What is your situation?",
      options: [
        { value: "selling_now", label: "Selling an Australian property now" },
        { value: "sold_pending_settlement", label: "Sold — waiting on settlement" },
        { value: "planning_to_sell", label: "Planning to sell soon" },
        { value: "helping_someone", label: "Helping someone else" },
      ],
    },
    {
      key: "urgency",
      label: "How close is settlement?",
      options: [
        { value: "within_a_month", label: "Within a month" },
        { value: "within_3_months", label: "Within 3 months" },
        { value: "not_scheduled", label: "Not scheduled yet" },
        { value: "already_settled", label: "Already settled" },
      ],
    },
    {
      key: "accountant",
      label: "Do you have a conveyancer or accountant?",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        { value: "considering", label: "Considering one" },
      ],
    },
  ],
  copy: {
    ctaLabel: "Get my FRCGW clearance pack — {price} →",
    popupHeading: "Your FRCGW clearance position",
    popupSubhead: "A few quick questions, then checkout",
    payLabel: "Pay {price} →",
    dismissLabel: "Not now — keep reading",
    resultLabel: "Your FRCGW position",
    bridgeCopy:
      "Most sellers either don't realise a clearance certificate is now required on every Australian property sale, or leave it too late and lose 15% at settlement. This shows your exact withholding position and what to do before settlement.",
    planChecklist: [
      "Your exact 15% withholding exposure on your sale price",
      "Whether you need a clearance certificate and when to lodge (the 28-day lead time)",
      "What happens at settlement if the certificate isn't issued in time",
      "Questions to take to your conveyancer or accountant",
    ],
    secondaryTierLabel: "Want the full FRCGW execution pack? — {price}",
    saveHeading: "Save your FRCGW result to show your conveyancer.",
    saveSubcopy: "Get a copy of your position by email — free.",
    escapeLabel: "A closer look at your FRCGW position",
    escapeBody:
      "Your answers don't point to a single clear FRCGW path — which usually means your situation needs a closer look. A short personalised review shows what applies to your property sale and the exact steps to take before settlement.",
    escapeCtaLabel: "Get my personalised FRCGW review — {price} →",
    reviewGuideTitle: "FRCGW Review Guide",
  },
};

async function handleCheckout(c: EngineCheckout): Promise<boolean> {
  const productKey = `au_${c.tier}_frcgw_clearance_certificate`;
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

export default function FrcgwClearanceCertificateCalculator() {
  return (
    <EngineCalculator
      engine={engine as Engine}
      figures={figures as EngineFigure[]}
      config={ENGINE_CONFIG}
      onCheckout={handleCheckout}
    />
  );
}
