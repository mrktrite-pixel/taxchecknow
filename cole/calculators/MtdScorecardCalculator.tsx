"use client";

// MACHINE PRODUCT (mtd-scorecard PANELBEAT migration) — mounts the generic EngineCalculator against
// the Bee-D engine (engine.json) + verified figure pool (figures.json), replacing the legacy bespoke
// calculator. Tier + severity live PER-TERMINAL in engine.json (the operator overlay ruled
// 2026-08-04). Commerce is UNCHANGED: the productKey (uk_<tier>_mtd_scorecard) and success paths are
// exactly the live product's — checkout still routes through the real /api/create-checkout-session
// and the same Stripe env vars.
//
// WHAT CHANGES, AND IT IS A CHANGE OF KIND. The bespoke was a SCORECARD: it asked income and
// record-keeping state, derived a mandateWave (:158/:188/:218/:246) and an urgencyBoost
// (:134, softwareGap || unaware), and returned a personalised mandate date and penalty exposure.
// This engine is a ROUTER: its four questions capture ROLE and TOPIC only — never income, never
// software state, never awareness. It navigates you to the part of MTD you need. It cannot compute
// your wave, your date, or your penalty exposure, so the config copy has been aligned to what it
// actually does rather than left promising a verdict the router cannot produce.
//
// FIGURES: this build's authority capture yielded ZERO figures (figures.json is []). Any threshold
// or penalty number therefore has no grounding in this build, which is why the aligned copy keeps
// only general context a reader can verify on gov.uk and states no personalised figure.

import EngineCalculator, { type Engine, type EngineCheckout } from "@/app/_components/EngineCalculator";
import type { EngineConfig } from "@/app/_components/engine-config";
import type { EngineFigure } from "@/app/_components/engine-terms";
import engine from "./engine.json";
import figures from "./figures.json";

const SLUG = "mtd-scorecard";

const ENGINE_CONFIG: EngineConfig = {
  productSlug: SLUG,
  sourcePath: `/uk/check/${SLUG}`,
  country: "UK",
  currency: "GBP",
  site: "taxchecknow",
  defaultTier: 67,
  monetizeEveryResolved: true,
  tierNames: {
    "67": "Your MTD Orientation Pack",
    "147": "Your MTD Setup Guide",
  },
  heroCopy:
    "Making Tax Digital for Income Tax replaces one annual Self Assessment return with quarterly updates plus a final declaration. It covers several separate things — who it applies to and from when, the digital records you must keep, the quarterly updates themselves, getting compatible software authorised, and what happens at the end of the year. This check asks who you are and what you need, then takes you to the part that actually applies.",
  qualification: [
    {
      key: "situation",
      label: "What is your main situation?",
      options: [
        { value: "sole_trader", label: "Sole trader" },
        { value: "landlord", label: "Landlord" },
        { value: "both", label: "Both self-employed and letting property" },
        { value: "agent", label: "Agent acting for clients" },
      ],
    },
    {
      key: "urgency",
      label: "How urgently do you need this?",
      options: [
        { value: "already_mandated", label: "I think MTD already applies to me" },
        { value: "coming_soon", label: "Preparing before it applies" },
        { value: "general", label: "Just understanding what it is" },
      ],
    },
    {
      key: "accountant",
      label: "Do you have an accountant or agent?",
      options: [
        { value: "yes_active", label: "Yes — speaking to them soon" },
        { value: "yes_inactive", label: "Yes — but not recently" },
        { value: "no", label: "No — managing myself" },
      ],
    },
  ],
  copy: {
    ctaLabel: "Get my MTD orientation — {price} →",
    popupHeading: "Your Making Tax Digital position",
    popupSubhead: "A few quick questions, then checkout",
    payLabel: "Pay {price} →",
    dismissLabel: "Not now — keep reading",
    resultLabel: "Your Making Tax Digital position",
    bridgeCopy:
      "Most confusion about MTD comes from treating it as one change. It is several: when it starts for you, what records you keep, what you send each quarter, which software is authorised to send it, and what the end of the year looks like. This shows which of those you need to deal with, and in what order.",
    planChecklist: [
      "Which part of MTD for Income Tax your answers point to, and what it involves",
      "What HMRC requires you to keep digitally, and what counts as compatible software",
      "How the quarterly update cycle and the final declaration fit together",
      "Where HMRC publishes the thresholds and dates that decide when it starts for you",
    ],
    secondaryTierLabel: "Want the full setup guide? — {price}",
    saveHeading: "Save your MTD result to show your accountant.",
    saveSubcopy: "Get a copy of your MTD position by email — free.",
    escapeLabel: "A closer look at your MTD position",
    escapeBody:
      "Your answers don't yet identify which part of Making Tax Digital you need — which is common, because it covers several separate things. A short personalised review works out which of them actually affect you and in what order to deal with them.",
    escapeCtaLabel: "Get my personalised MTD review — {price} →",
    reviewGuideTitle: "Making Tax Digital Review Guide",
  },
};

async function handleCheckout(c: EngineCheckout): Promise<boolean> {
  const productKey = `uk_${c.tier}_mtd_scorecard`;
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
        success_url: `${origin}/uk/check/${SLUG}/success/${successPath}`,
        cancel_url: `${origin}/uk/check/${SLUG}`,
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

export default function MtdScorecardCalculator() {
  return (
    <EngineCalculator
      engine={engine as Engine}
      figures={figures as EngineFigure[]}
      config={ENGINE_CONFIG}
      onCheckout={handleCheckout}
    />
  );
}
