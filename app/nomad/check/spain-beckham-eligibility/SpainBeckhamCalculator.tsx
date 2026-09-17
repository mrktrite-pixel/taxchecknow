"use client";

// MACHINE PRODUCT (spain-beckham-eligibility PANELBEAT migration) — mounts the generic
// EngineCalculator against the Bee-D engine (engine.json) + verified figure pool (figures.json),
// replacing the legacy bespoke calculator. Tier + severity live PER-TERMINAL in engine.json, from
// the operator overlay ruled 2026-09-11 ("all 13 states accepted as drafted — no flips"). Commerce
// is UNCHANGED: the productKeys and success paths below are byte-for-byte the live product's, and
// checkout still routes through the real /api/create-checkout-session and the same Stripe env vars
// (STRIPE_NOMAD_BECK_67 / STRIPE_NOMAD_BECK_147, resolved storefront-side).
//
// ⚠️ PRODUCTKEY IS A LITERAL MAP HERE, NOT A SLUG TEMPLATE — AND THAT IS DELIBERATE.
// The FRCGW and 183-day wrappers build their key from the slug (`au_${tier}_frcgw_clearance_
// certificate`, `nomad_${tier}_183_day_rule`) because for those two the slug tail and the live key
// tail are the same string. THEY ARE NOT THE SAME HERE. This product's slug tail is
// "spain-beckham-eligibility" but its live key tail is "spain_beckham" — TRUNCATED. A slug-derived
// template would emit nomad_67_spain_beckham_eligibility, which no getPriceId branch and no
// historical session row has ever seen, silently breaking checkout on a live selling product. The
// map below is copied verbatim from the bespoke it replaces (:91-94). Do not "tidy" it into a
// template.
//
// SCOPE: the engine is scoped to Artículo 93 IRPF (BOE-A-2006-20764, bloque a93 — the consolidated
// vigente text, so 47% is current and the superseded 45% is absent). The bespoke additionally
// computed an estimated euro saving from an income band; the engine does not, because the corpus
// grounds the RATES and the CONDITIONS, not a projected saving. That arithmetic was never grounded
// in this build's evidence and is not carried over.

import EngineCalculator, { type Engine, type EngineCheckout } from "@/app/_components/EngineCalculator";
import type { EngineConfig } from "@/app/_components/engine-config";
import type { EngineFigure } from "@/app/_components/engine-terms";
import engine from "./engine.json";
import figures from "./figures.json";

const SLUG = "spain-beckham-eligibility";

// VERBATIM from the bespoke SpainBeckhamCalculator.tsx:91-94. See the productKey note above.
const PRODUCT_KEYS = {
  p67:  "nomad_67_spain_beckham",
  p147: "nomad_147_spain_beckham",
};

const ENGINE_CONFIG: EngineConfig = {
  productSlug: SLUG,
  sourcePath: `/nomad/check/${SLUG}`,
  country: "ES",
  currency: "EUR",
  site: "taxchecknow",
  defaultTier: 67,
  monetizeEveryResolved: true,
  tierNames: {
    "67": "Your Beckham Eligibility Fix Kit",
    "147": "Your Beckham Approval System",
  },
  heroCopy:
    "This check asks a few short questions about how and when you moved to Spain. The Beckham regime is not one test but several stacked conditions, and each one can decide the answer on its own: you must not have been a Spanish tax resident in the cinco períodos impositivos before your move, your move must be attributable to a qualifying work reason, and the election itself must be made through Modelo 149 inside the statutory window. Your answers work out which condition your position actually turns on.",
  qualification: [
    {
      key: "situation",
      label: "What is your main situation?",
      options: [
        { value: "moving_soon", label: "Planning a move to Spain" },
        { value: "recently_moved", label: "Recently arrived in Spain" },
        { value: "already_applied", label: "Already applied or elected" },
        { value: "other", label: "Something else" },
      ],
    },
    {
      key: "urgency",
      label: "How urgently do you need this?",
      options: [
        { value: "before_modelo", label: "Before I submit Modelo 149" },
        { value: "before_move", label: "Before I commit to the move" },
        { value: "general", label: "Just understanding my position" },
      ],
    },
    {
      key: "accountant",
      label: "Do you have a Spanish adviser?",
      options: [
        { value: "yes_active", label: "Yes — a gestor or asesor fiscal" },
        { value: "yes_inactive", label: "Yes — but not engaged yet" },
        { value: "no", label: "No — managing myself" },
      ],
    },
  ],
  copy: {
    ctaLabel: "Get my Beckham eligibility position — {price} →",
    popupHeading: "Your Beckham eligibility position",
    popupSubhead: "A few quick questions, then checkout",
    payLabel: "Pay {price} →",
    dismissLabel: "Not now — keep reading",
    resultLabel: "Your Beckham eligibility position",
    bridgeCopy:
      "Most Beckham applications fail on structure rather than on income. The two conditions people most often get wrong are the prior-residency count — which turns on days present, the centre of your economic interests and your habitual residence, not on whether you felt settled — and the election deadline, which runs from Spanish social-security registration rather than from arrival. This sets out which condition your own position turns on.",
    planChecklist: [
      "Which Artículo 93 condition your position actually turns on, and why",
      "The qualifying work-reason pathway your move falls under — or why none applies",
      "What the prior-residency condition requires you to evidence for the cinco períodos impositivos",
      "The Modelo 149 election window, and what starts the clock",
      "What to take to your Spanish gestor before the election is made",
    ],
    secondaryTierLabel: "Want the full approval system? — {price}",
    saveHeading: "Save your Beckham result to show your gestor.",
    saveSubcopy: "Get a copy of your eligibility position by email — free.",
    escapeLabel: "A closer look at your Beckham position",
    escapeBody:
      "Your answers don't yet establish whether the regime is available to you — usually because the prior-residency position or the qualifying work reason is unconfirmed. A short personalised review sets out which condition is in doubt, what evidence resolves it, and what the election window requires.",
    escapeCtaLabel: "Get my personalised Beckham review — {price} →",
    reviewGuideTitle: "Beckham Regime Review Guide",
  },
};

async function handleCheckout(c: EngineCheckout): Promise<boolean> {
  const productKey = c.tier === 147 ? PRODUCT_KEYS.p147 : PRODUCT_KEYS.p67;
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

export default function SpainBeckhamCalculator() {
  return (
    <EngineCalculator
      engine={engine as Engine}
      figures={figures as EngineFigure[]}
      config={ENGINE_CONFIG}
      onCheckout={handleCheckout}
    />
  );
}
