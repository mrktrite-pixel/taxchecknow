"use client";

// MACHINE PRODUCT (us-expat-tax engine-native migration) — mounts the generic EngineCalculator
// against the Bee-D engine (engine.json) + verified figure pool (figures.json), replacing the
// 1,009-line legacy bespoke calculator. Tier + severity live PER-TERMINAL in engine.json
// (operator overlay, ruling B 2026-09-25).
//
// COMMERCE IS UNCHANGED, and that was checked against the file this replaces rather than assumed:
// the legacy PRODUCT_KEYS were { p67: "nomad_67_us_expat_tax", p147: "nomad_147_us_expat_tax" },
// success_url was /nomad/check/us-expat-tax/success/{assess|plan} and cancel_url was
// /nomad/check/us-expat-tax. All four are reproduced exactly below, so checkout still resolves
// through the same includes()-chain block in create-checkout-session (nomad_ + us_expat_tax →
// STRIPE_NOMAD_USET_67 / _147).
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// SCOPE — THIS IS A NARROWING, DELIBERATELY, AND IT DROPS A NUMERIC MODEL.
//
// The bespoke ran a cashflow comparison: it hard-coded FEIE_2026 = 126500, computed FEIE-only vs
// FTC-only vs hybrid totals, and printed an "annual saving" in dollars. This build's verified
// figure pool contains exactly TWO facts — fig_0 "2" month (the automatic overseas extension) and
// fig_1 "4868" (the form number for a further extension). The $126,500 exclusion limit, the
// 330-day physical presence threshold and every computed total were ungrounded in this build's
// evidence.
//
// So the engine answers what the corpus actually supports — the automatic 2-month extension and
// how to extend further, FEIE vs FTC as a STRATEGY question, FBAR/FATCA reporting triggers, common
// errors by income type, and state obligations — and asserts no figure it cannot cite. Losing a
// dollar estimate that was never grounded is the point of the migration, not a regression.
//
// WHAT ELSE GOES WITH IT, recorded rather than hidden: the bespoke emitted cross-links (FEIE Nomad
// Auditor, Tax Treaty Navigator, 183-Day Rule) from its computed status. The engine has no
// equivalent routing surface, so those links do not survive here. The gate page's own copy and
// crosslink block are untouched.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import EngineCalculator, { type Engine, type EngineCheckout } from "@/app/_components/EngineCalculator";
import type { EngineConfig } from "@/app/_components/engine-config";
import type { EngineFigure } from "@/app/_components/engine-terms";
import engine from "./engine.json";
import figures from "./figures.json";

const SLUG = "us-expat-tax";

const ENGINE_CONFIG: EngineConfig = {
  productSlug: SLUG,
  sourcePath: `/nomad/check/${SLUG}`,
  country: "US",
  currency: "USD",
  site: "taxchecknow",
  defaultTier: 67,
  monetizeEveryResolved: true,
  tierNames: {
    "67": "Your US Expat Filing Position",
    "147": "Your US Expat Filing & Extension Plan",
  },
  heroCopy:
    "This check asks a few quick questions about your situation as a US person living abroad. Being overseas on the regular due date gives you an automatic 2-month extension with no form to file — but interest still runs on anything you owe from the original due date, and going beyond that extension means filing Form 4868 before the 2-month date, not before April. Your answers work out which of those applies to you, and whether FEIE or FTC, FBAR/FATCA reporting, or a state claim is the part you actually need to deal with.",
  // The legacy popup's three qualifiers, preserved verbatim — they are the fields the paid
  // assessment already receives, so changing them would change the brief the buyer's report is
  // written from.
  qualification: [
    {
      key: "filing_role",
      label: "Your role",
      options: [
        { value: "employee_abroad", label: "US citizen employee abroad" },
        { value: "self_employed_abroad", label: "US citizen self-employed abroad" },
        { value: "business_owner", label: "US citizen business owner abroad" },
        { value: "returning_us", label: "Returning to US — prior-year cleanup" },
        { value: "advisor", label: "Tax advisor / EA / CPA" },
      ],
    },
    {
      key: "urgency",
      label: "How urgent is this?",
      options: [
        { value: "filing_deadline", label: "Filing deadline approaching" },
        { value: "strategy_review", label: "Strategy review / method switch" },
        { value: "first_year", label: "First year abroad" },
        { value: "audit_letter", label: "IRS letter / compliance enquiry" },
        { value: "planning", label: "General planning" },
      ],
    },
    {
      key: "accountant",
      label: "Do you have a US expat tax advisor?",
      options: [
        { value: "ea_cross_border", label: "Yes — EA/CPA with cross-border expertise" },
        { value: "general_us", label: "Yes — general US CPA" },
        { value: "diy", label: "Self-managed (TurboTax etc.)" },
        { value: "none", label: "No — need one" },
      ],
    },
  ],
  copy: {
    ctaLabel: "Get my US expat filing position — {price} →",
    popupHeading: "Your US expat filing position",
    popupSubhead: "A few quick questions, then checkout",
    payLabel: "Pay {price} →",
    dismissLabel: "Not now — keep reading",
    resultLabel: "Your US expat filing position",
    bridgeCopy:
      "Most of the trouble on expat returns comes from two assumptions: that the automatic extension covers you all the way to October, and that being abroad means no US state can still tax you. Neither is reliably true. This sets out which extension you actually have, what extending further requires and when, and which reporting obligations your accounts and income mix trigger.",
    planChecklist: [
      "Which extension you have automatically, and what it does not cover",
      "What a further extension to October requires, and the date it must be filed by",
      "Whether the Foreign Earned Income Exclusion or the Foreign Tax Credit fits your income",
      "When your foreign accounts cross into FBAR or FATCA reporting",
      "Whether a US state still has a claim on you, and what severed ties means",
      "What to take to a cross-border adviser before you file",
    ],
    secondaryTierLabel: "Want the full filing & extension plan? — {price}",
    secondaryTierLabelDown: "Just want the filing position? — {price}",
    saveHeading: "Save your US expat filing position to show your adviser.",
    saveSubcopy: "Get a copy of your result by email — free.",
    escapeLabel: "A closer look at your US expat filing position",
    escapeBody:
      "Your answers don't yet settle your position — usually because it is unconfirmed whether you were abroad on the regular due date, whether your foreign accounts crossed a reporting threshold, or whether you severed ties with your last US state. A short personalised review works through the missing detail and sets out where you stand.",
    escapeCtaLabel: "Get my personalised US expat review — {price} →",
    reviewGuideTitle: "US Expat Filing Review Guide",
  },
};

async function handleCheckout(c: EngineCheckout): Promise<boolean> {
  // EXACTLY the legacy key shape: nomad_67_us_expat_tax / nomad_147_us_expat_tax.
  const productKey = `nomad_${c.tier}_us_expat_tax`;
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

export default function UsExpatTaxCalculator() {
  return (
    <EngineCalculator
      engine={engine as Engine}
      figures={figures as EngineFigure[]}
      config={ENGINE_CONFIG}
      onCheckout={handleCheckout}
    />
  );
}
