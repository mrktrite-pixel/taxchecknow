"use client";

// MACHINE PRODUCT (183-day-rule PANELBEAT migration) — mounts the generic EngineCalculator against
// the Bee-D engine (engine.json) + verified figure pool (figures.json), replacing the legacy bespoke
// calculator. Tier + severity live PER-TERMINAL in engine.json (the operator overlay ruled
// 2026-08-01). Commerce is UNCHANGED: the productKey (nomad_<tier>_183_day_rule) and success paths
// are exactly the live product's — checkout still routes through the real
// /api/create-checkout-session and the same Stripe env vars.
//
// SCOPE — THIS IS A NARROWING, AND IT IS DELIBERATE. The bespoke answered five jurisdictions (UK
// SRT :357, AU domicile :387, NZ permanent place of abode :417, Canada factual residence :447, US
// :477) on a corpus that grounds ONE: the IRS Substantial Presence Test page. The engine is
// correctly scoped to the US test, and the config copy has been narrowed to match rather than
// leaving a five-jurisdiction page over a one-jurisdiction calculator. What the bespoke asserted
// about UK/AU/NZ/CA/Singapore/OECD was never grounded in this build's evidence.
//
// KNOWN SCOPE GAP, recorded not hidden: q1_scope:citizen_or_pr routes U.S. citizens and green card
// holders — the population the bespoke tiered at 147 (:477/:494, worldwide taxation regardless of
// days) — to the none_fit ESCAPE, and translate-to-terminals forces escape tier to 67 regardless of
// overlay. No overlay value can reach them. That is an engine-scope decision, not a copy one.

import EngineCalculator, { type Engine, type EngineCheckout } from "@/app/_components/EngineCalculator";
import type { EngineConfig } from "@/app/_components/engine-config";
import type { EngineFigure } from "@/app/_components/engine-terms";
import engine from "./engine.json";
import figures from "./figures.json";

const SLUG = "183-day-rule";

const ENGINE_CONFIG: EngineConfig = {
  productSlug: SLUG,
  sourcePath: `/nomad/check/${SLUG}`,
  country: "US",
  currency: "USD",
  site: "taxchecknow",
  defaultTier: 67,
  monetizeEveryResolved: true,
  tierNames: {
    "67": "Your U.S. Substantial Presence Check",
    "147": "Your U.S. Presence Documentation System",
  },
  heroCopy:
    "This check asks a few quick questions about your days of physical presence in the United States. The Substantial Presence Test does not look at one year: it needs at least 31 days in the current year and at least 183 across three years, counting all of this year's days, one third of last year's, and one sixth of the year before. Some days do not count at all. Your answers work out where you land.",
  qualification: [
    {
      key: "situation",
      label: "What is your main situation?",
      options: [
        { value: "working", label: "Working in the U.S. on a visa" },
        { value: "student", label: "Student, teacher or trainee" },
        { value: "business", label: "Business travel / commuting" },
        { value: "other", label: "Something else" },
      ],
    },
    {
      key: "urgency",
      label: "How urgently do you need this?",
      options: [
        { value: "before_return", label: "Before filing my U.S. return" },
        { value: "next_year", label: "Planning next year's travel" },
        { value: "general", label: "Just understanding my position" },
      ],
    },
    {
      key: "accountant",
      label: "Do you have a tax adviser?",
      options: [
        { value: "yes_active", label: "Yes — speaking to them soon" },
        { value: "yes_inactive", label: "Yes — but not recently" },
        { value: "no", label: "No — managing myself" },
      ],
    },
  ],
  copy: {
    ctaLabel: "Get my U.S. presence position — {price} →",
    popupHeading: "Your U.S. substantial presence position",
    popupSubhead: "A few quick questions, then checkout",
    payLabel: "Pay {price} →",
    dismissLabel: "Not now — keep reading",
    resultLabel: "Your U.S. substantial presence position",
    bridgeCopy:
      "Most surprises on this test come from two places: people count one year instead of three, or they assume a day of presence always counts when several categories of day do not. This shows how your own days weight up and which exclusions may apply to you.",
    planChecklist: [
      "How your days weight across the three-year count, and where that leaves you",
      "Which of your days may not count — transit, crew, commuting, medical, exempt individual",
      "Where Form 8843 is required to claim an exclusion, and what filing late costs you",
      "What to take to your U.S. tax adviser before you file",
    ],
    secondaryTierLabel: "Want the full presence documentation system? — {price}",
    saveHeading: "Save your U.S. presence result to show your adviser.",
    saveSubcopy: "Get a copy of your day-count position by email — free.",
    escapeLabel: "A closer look at your U.S. presence position",
    escapeBody:
      "Your answers don't yet establish your position — usually because the day count or the scope of the test is unconfirmed. A short personalised review sets out your weighted three-year count, the exclusions you may be entitled to, and what each one requires.",
    escapeCtaLabel: "Get my personalised U.S. presence review — {price} →",
    reviewGuideTitle: "U.S. Substantial Presence Review Guide",
  },
};

async function handleCheckout(c: EngineCheckout): Promise<boolean> {
  const productKey = `nomad_${c.tier}_183_day_rule`;
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
        success_url: `${origin}/nomad/check/${SLUG}/success/${successPath}`,
        cancel_url: `${origin}/nomad/check/${SLUG}`,
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

export default function Day183RuleCalculator() {
  return (
    <EngineCalculator
      engine={engine as Engine}
      figures={figures as EngineFigure[]}
      config={ENGINE_CONFIG}
      onCheckout={handleCheckout}
    />
  );
}
