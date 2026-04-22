"use client";

/**
 * AU-12 — Super Death Tax Trap Engine
 * Pattern: D (GateTest — dependant check) + G (ThresholdTest — Div 296 $3M)
 *
 * Core question: How much of my super actually reaches my family, given:
 *   1. Dependant status of beneficiaries (spouse 0% vs adult kids 17%)
 *   2. Taxable component % (typically 70-90%)
 *   3. Total Super Balance vs $3M Division 296 threshold
 *
 * Key facts (ATO confirmed April 2026):
 *   Death benefit tax: 17% (15% + 2% Medicare) on taxable component to non-dependants
 *   Legal anchor: ITAA 1997 Division 302 (s302-60, s302-145, s302-195, s302-200)
 *   Div 296: 15% additional tax on realised earnings above $3M TSB from 1 July 2026
 *   Proportioning rule: s307-125 — no cherry-picking components
 *   Law in force since 1 July 2007 (death benefit tax); Div 296 new for 2026-27
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;

interface TaxResult {
  deathTaxApplies: boolean;
  deathTaxAmount: number;
  div296Applies: boolean;
  div296Annual: number;
  div296FiveYear: number;
  totalBalance: number;
  taxableAmount: number;
  taxFreeAmount: number;
  familyReceives: number;
  leakagePercent: number;
}

interface VerdictResult {
  status: string;
  statusClass: string;
  panelClass: string;
  headline: string;
  stats: Array<{ label: string; value: string; highlight?: boolean }>;
  consequences: string[];
  confidence: ConfidenceLevel;
  confidenceNote: string;
  tier: Tier;
  ctaLabel: string;
  altTierLabel: string;
  productKey67: string;
  productKey147: string;
  tax: TaxResult;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — ATO confirmed April 2026
// ─────────────────────────────────────────────────────────────────────────────

const DEATH_TAX_RATE = 0.17;           // 15% + 2% Medicare levy
const DIV296_THRESHOLD = 3_000_000;    // $3M TSB (Subdiv 296-B)
const DIV296_RATE = 0.15;              // 15% additional on attributable earnings
const ASSUMED_EARNINGS_RATE = 0.045;   // 4.5% realised earnings assumption for Div 296 modelling

const BALANCE_MAP: Record<string, number> = {
  under_1m:   750_000,
  "1m_to_3m": 2_000_000,
  "3m_to_5m": 4_000_000,
  over_5m:    6_500_000,
};

const TAXABLE_MAP: Record<string, number> = {
  under_50:   0.40,
  "50_to_70": 0.60,
  "70_to_90": 0.80,
  over_90:    0.95,
};

const PRODUCT_KEYS = {
  p67:  "au_67_super_death_tax_trap",
  p147: "au_147_super_death_tax_trap",
};

function formatAUD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-AU");
}

function formatAUDShort(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "k";
  return "$" + Math.round(n).toLocaleString("en-AU");
}

// ─────────────────────────────────────────────────────────────────────────────
// TAX CALCULATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcTax(answers: AnswerMap): TaxResult {
  const beneficiaries = String(answers.beneficiaries || "adult_kids");
  const tsbBand       = String(answers.tsb_band || "1m_to_3m");
  const taxablePct    = String(answers.taxable_percent || "70_to_90");
  const partnerDies   = answers.partner_dies_first === true;

  const totalBalance = BALANCE_MAP[tsbBand] ?? 2_000_000;
  const taxablePercent = TAXABLE_MAP[taxablePct] ?? 0.80;
  const taxableAmount = totalBalance * taxablePercent;
  const taxFreeAmount = totalBalance - taxableAmount;

  // ── Death Benefit Tax ─────────────────────────────────────────────────────
  // Spouse only = 0%. Adult kids = 17% on full taxable. Mixed = 50/50 approximation.
  let deathTaxRate = 0;
  if (beneficiaries === "adult_kids") deathTaxRate = DEATH_TAX_RATE;
  else if (beneficiaries === "mixed") deathTaxRate = DEATH_TAX_RATE * 0.5;  // assume 50% to non-dependant
  else if (beneficiaries === "other") deathTaxRate = DEATH_TAX_RATE;        // grandkids/other non-dependants
  // spouse = 0

  const deathTaxApplies = deathTaxRate > 0;
  const deathTaxAmount = taxableAmount * deathTaxRate;

  // ── Division 296 (annual, forward-looking from 1 July 2026) ──────────────
  let div296Applies = false;
  let div296Annual = 0;
  let effectiveBalance = totalBalance;
  if (partnerDies) effectiveBalance = totalBalance;  // partner death can push survivor above threshold via reversionary — messaging driver

  if (effectiveBalance > DIV296_THRESHOLD) {
    div296Applies = true;
    const attributableProp = (effectiveBalance - DIV296_THRESHOLD) / effectiveBalance;
    const realisedEarnings = effectiveBalance * ASSUMED_EARNINGS_RATE;
    div296Annual = realisedEarnings * attributableProp * DIV296_RATE;
  }
  const div296FiveYear = div296Annual * 5;

  // ── Family Receives ───────────────────────────────────────────────────────
  const familyReceives = totalBalance - deathTaxAmount;
  const leakagePercent = totalBalance > 0 ? (deathTaxAmount / totalBalance) * 100 : 0;

  return {
    deathTaxApplies,
    deathTaxAmount,
    div296Applies,
    div296Annual,
    div296FiveYear,
    totalBalance,
    taxableAmount,
    taxFreeAmount,
    familyReceives,
    leakagePercent,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const tax = calcTax(answers);
  const beneficiaries = String(answers.beneficiaries || "adult_kids");

  // ── Spouse-only + under $3M: clear path ───────────────────────────────────
  if (beneficiaries === "spouse" && !tax.div296Applies) {
    return {
      status: "CLEAR — SPOUSE ROUTE, NO DIV 296",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your spouse is a 'death benefits dependant' under ITAA 1997 s302-195 — no death benefit tax applies. TSB is under $3M so Division 296 does not apply either. ${formatAUD(tax.totalBalance)} passes tax-free.`,
      stats: [
        { label: "Death tax", value: "$0 ✓" },
        { label: "Div 296", value: "$0 ✓" },
        { label: "Family receives", value: formatAUD(tax.familyReceives), highlight: true },
      ],
      consequences: [
        "Your spouse qualifies as a 'death benefits dependant' under ITAA 1997 s302-195 — the super death benefit passes tax-free",
        "This is the only beneficiary category with automatic tax-free treatment regardless of component split",
        "Your TSB is under $3M so Division 296 does not apply from 1 July 2026",
        "Risk to watch: if your spouse dies first, the super may re-route to adult children and become taxable. Check your binding nomination annually.",
        "If your spouse's own TSB puts the COMBINED household super above $3M, Division 296 may apply to either spouse individually based on their own balance.",
      ],
      confidence: "HIGH",
      confidenceNote: "Spouse route is straightforward under ITAA 1997. Annual review of nominations recommended.",
      tier: 67,
      ctaLabel: "Show What My Family Actually Receives — $67 →",
      altTierLabel: "Want the full execution plan? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      tax,
    };
  }

  // ── Spouse + Div 296 applies: Div 296 only, no death tax ─────────────────
  if (beneficiaries === "spouse" && tax.div296Applies) {
    return {
      status: "DIVISION 296 APPLIES — SPOUSE ROUTE",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your spouse route avoids the death benefit tax — but your TSB exceeds $3M, so Division 296 applies from 1 July 2026. Approximately ${formatAUD(tax.div296Annual)} per year compounds every year above threshold.`,
      stats: [
        { label: "Death tax", value: "$0 ✓" },
        { label: "Div 296 annual", value: formatAUD(tax.div296Annual), highlight: true },
        { label: "5-year Div 296", value: formatAUD(tax.div296FiveYear), highlight: true },
      ],
      consequences: [
        "🔒 Division 296 applies from 1 July 2026 — additional 15% tax on realised earnings attributable to the portion of TSB above $3M (Subdiv 296-B)",
        `At your TSB, approximately ${formatAUD(tax.div296Annual)} of additional tax per year — compounding every year balance stays above $3M`,
        "Death benefit tax = $0 (spouse dependant under ITAA 1997 s302-195)",
        "If your spouse dies first, super re-routes to remaining beneficiaries — usually adult kids = 17% death tax suddenly applies",
        "Primary lever: keep TSB under $3M at each 30 June via withdrawals. 2026-27 transitional uses 30 June 2027 balance only.",
        "Spouse balance equalisation: if both partners have super, each has own $3M threshold. Rebalancing may eliminate Div 296 entirely.",
      ],
      confidence: "HIGH",
      confidenceNote: "Div 296 commences 1 July 2026. TSB projection and spouse equalisation are the primary mitigation levers.",
      tier: 147,
      ctaLabel: "Get My Reduction Plan — $147 →",
      altTierLabel: "Just want the decision pack? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      tax,
    };
  }

  // ── Adult kids + Div 296 applies: double tax trap (the hero verdict) ─────
  if (tax.deathTaxApplies && tax.div296Applies) {
    return {
      status: "DOUBLE TAX TRAP — DEATH TAX + DIV 296 STACKED",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Your ${formatAUDShort(tax.totalBalance)} super is exposed to BOTH taxes. Death benefit tax of ${formatAUD(tax.deathTaxAmount)} (adult children pay 17% on taxable component) AND Division 296 of approximately ${formatAUD(tax.div296Annual)} per year while alive.`,
      stats: [
        { label: "Death tax", value: formatAUD(tax.deathTaxAmount), highlight: true },
        { label: "Div 296 annual", value: formatAUD(tax.div296Annual), highlight: true },
        { label: "Family receives", value: formatAUD(tax.familyReceives), highlight: true },
      ],
      consequences: [
        `🔒 DEATH BENEFIT TAX is IRREVERSIBLE once you die. Adult children pay 17% on ${formatAUD(tax.taxableAmount)} taxable component = ${formatAUD(tax.deathTaxAmount)} to the ATO before they inherit. Law since 2007 (ITAA 1997 Div 302).`,
        `🔒 DIVISION 296 is ANNUAL and COMPOUNDING from 1 July 2026. Approximately ${formatAUD(tax.div296Annual)} per year while balance stays above $3M. Over 5 years that's ~${formatAUD(tax.div296FiveYear)}.`,
        "Reduction lever 1: Recontribution strategy — withdraw + recontribute to reset taxable component to tax-free. Age 60+ typically tax-free to withdraw. Subject to NCC caps. Can reduce death tax by tens of thousands.",
        "Reduction lever 2: Division 296 management — withdraw to stay under $3M at 30 June 2027 (transitional) and each subsequent 30 June. Spouse balance equalisation for couples.",
        "Reduction lever 3: Estate routing with testamentary trust allowing streaming — tax-free component to non-dependants (adult kids), taxable component to dependants (spouse, minor children).",
        "All levers require action BEFORE DEATH. Once death happens, the tax is locked in. Once Div 296 starts, the annual drain begins.",
      ],
      confidence: "HIGH",
      confidenceNote: "Both taxes confirmed under ITAA 1997 Div 302 and Subdiv 296-B. Reduction requires pre-death planning and pre-30-June-2026 action.",
      tier: 147,
      ctaLabel: "Get My Reduction Plan — $147 →",
      altTierLabel: "Just want the diagnostic? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      tax,
    };
  }

  // ── Adult kids, no Div 296 (balance under $3M) ───────────────────────────
  if (tax.deathTaxApplies && !tax.div296Applies) {
    return {
      status: "DEATH BENEFIT TAX APPLIES — NO DIV 296",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Adult children are NOT 'death benefits dependants' under ITAA 1997 s302-195. They pay 17% on the taxable component — ${formatAUD(tax.deathTaxAmount)} to the ATO before they inherit. Your TSB is under $3M so Division 296 does not apply yet.`,
      stats: [
        { label: "Death tax", value: formatAUD(tax.deathTaxAmount), highlight: true },
        { label: "Div 296", value: "$0 (under $3M)" },
        { label: "Family receives", value: formatAUD(tax.familyReceives), highlight: true },
      ],
      consequences: [
        `🔒 Death benefit tax is IRREVERSIBLE once you die. ${formatAUD(tax.taxableAmount)} taxable component × 17% = ${formatAUD(tax.deathTaxAmount)} paid to the ATO before kids inherit.`,
        "Your Will does NOT cover super. Super sits outside your estate unless directed there. A Binding Nomination controls WHO receives — not HOW it's taxed.",
        `Your family receives ${formatAUD(tax.familyReceives)} instead of ${formatAUD(tax.totalBalance)} — leakage of ${tax.leakagePercent.toFixed(1)}% permanently.`,
        "Primary reduction lever: Recontribution strategy — withdraw from super (tax-free if 60+ and retired) and recontribute as non-concessional contribution. Converts taxable component to tax-free component. Subject to NCC caps and bring-forward rules.",
        "Secondary lever: Streaming via testamentary trust — tax-free component to adult kids (0% impact), taxable component to dependants if you have any.",
        "Watch Div 296: if TSB grows above $3M (likely for balances approaching it), additional 15% annual tax kicks in from 1 July 2026.",
      ],
      confidence: "HIGH",
      confidenceNote: "Death benefit tax is 17% on taxable component under ITAA 1997 Division 302. Law since 1 July 2007.",
      tier: 147,
      ctaLabel: "Get My Reduction Plan — $147 →",
      altTierLabel: "Just want the diagnostic? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      tax,
    };
  }

  // ── Mixed beneficiaries (reduced death tax) ──────────────────────────────
  return {
    status: tax.div296Applies ? "MIXED BENEFICIARIES — PARTIAL DEATH TAX + DIV 296" : "MIXED BENEFICIARIES — PARTIAL DEATH TAX",
    statusClass: "text-amber-700",
    panelClass: "border-amber-200 bg-amber-50",
    headline: `Mixed beneficiary split reduces death benefit tax to approximately ${formatAUD(tax.deathTaxAmount)} (assumes 50% to non-dependants, 50% to dependants)${tax.div296Applies ? `, plus Division 296 of ~${formatAUD(tax.div296Annual)}/year while alive.` : '.'} Proper streaming via testamentary trust can reduce this further.`,
    stats: [
      { label: "Death tax", value: formatAUD(tax.deathTaxAmount), highlight: true },
      { label: "Div 296 annual", value: tax.div296Applies ? formatAUD(tax.div296Annual) : "$0" },
      { label: "Family receives", value: formatAUD(tax.familyReceives), highlight: true },
    ],
    consequences: [
      "Mixed beneficiary split (spouse + adult kids) means the taxable component can be streamed via testamentary trust to the dependant (0% tax) while the tax-free component goes to non-dependants (no tax either way)",
      "Without streaming structure: tax applies pro-rata by the proportioning rule (ITAA 1997 s307-125) — you cannot cherry-pick components to individual beneficiaries",
      "Proper structure can reduce death tax to near $0 by routing taxable component to spouse and tax-free component to adult kids",
      tax.div296Applies ? `Division 296 applies from 1 July 2026 at approximately ${formatAUD(tax.div296Annual)}/year while TSB stays above $3M` : "Division 296 does not apply at this TSB level",
      "Requires testamentary trust in Will + SMSF deed provisions allowing streaming — cannot be added after death",
    ],
    confidence: "MEDIUM",
    confidenceNote: "Actual mixed split depends on your beneficiary percentages and any streaming structure. 50/50 assumed for this estimate.",
    tier: 147,
    ctaLabel: "Get My Reduction Plan — $147 →",
    altTierLabel: "Just want the diagnostic? — $67 instead",
    productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
    tax,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

type Q = {
  id: string;
  step: number;
  type: "button_group" | "two_button";
  label: string;
  subLabel?: string;
  options: { label: string; value: string | boolean; subLabel?: string }[];
  showIf?: (a: AnswerMap) => boolean;
  required?: boolean;
};

const QUESTIONS: Q[] = [
  {
    id: "beneficiaries", step: 1, type: "button_group",
    label: "Who will primarily receive your super when you die?",
    subLabel: "Dependant status determines whether the 17% death benefit tax applies under ITAA 1997 s302-195",
    options: [
      { label: "Spouse only", value: "spouse", subLabel: "Spouse is a 'death benefits dependant' — 0% tax" },
      { label: "Adult children (18+, independent)", value: "adult_kids", subLabel: "Not dependants — 17% tax on taxable component" },
      { label: "Mix of spouse + adult kids", value: "mixed", subLabel: "Partial tax unless properly structured" },
      { label: "Grandchildren / other non-dependants", value: "other", subLabel: "17% tax unless financial dependency proven" },
    ],
    required: true,
  },
  {
    id: "tsb_band", step: 2, type: "button_group",
    label: "What is your current Total Super Balance?",
    subLabel: "Determines death tax quantum and Division 296 exposure from 1 July 2026",
    options: [
      { label: "Under $1M", value: "under_1m", subLabel: "Modest leakage, Div 296 N/A" },
      { label: "$1M–$3M", value: "1m_to_3m", subLabel: "Meaningful death tax, no Div 296 yet" },
      { label: "$3M–$5M", value: "3m_to_5m", subLabel: "Both taxes apply — double tax trap" },
      { label: "Over $5M", value: "over_5m", subLabel: "Full double tax + compounding Div 296" },
    ],
    required: true,
  },
  {
    id: "taxable_percent", step: 3, type: "button_group",
    label: "What portion of your super is the taxable component?",
    subLabel: "Most SMSFs are 70-90% taxable. Check your super statement for tax-free vs taxable split.",
    options: [
      { label: "Under 50%", value: "under_50", subLabel: "Strong tax-free base (heavy NCC history)" },
      { label: "50%–70%", value: "50_to_70", subLabel: "Moderate — some prior recontribution" },
      { label: "70%–90%", value: "70_to_90", subLabel: "Typical for concessional-heavy balance" },
      { label: "Over 90% / unsure", value: "over_90", subLabel: "Maximum exposure — no recontribution history" },
    ],
    required: true,
  },
  {
    id: "partner_dies_first", step: 4, type: "two_button",
    label: "Have you modelled what happens if your partner dies before you?",
    subLabel: "A partner's death can reroute their super to you, pushing your TSB above $3M and triggering Division 296",
    options: [
      { label: "Yes — partner balance tracked", value: true },
      { label: "No — hadn't thought about it", value: false },
    ],
    showIf: (a) => a.beneficiaries === "spouse" || a.beneficiaries === "mixed",
  },
  {
    id: "age_band", step: 5, type: "button_group",
    label: "What is your current age?",
    subLabel: "Age determines recontribution eligibility and urgency of action",
    options: [
      { label: "Under 60", value: "under_60", subLabel: "Recontribution limited — withdrawal taxable" },
      { label: "60–66", value: "60_to_66", subLabel: "Best window — tax-free withdrawal, full NCC access" },
      { label: "67–74", value: "67_to_74", subLabel: "Work test required for contributions" },
      { label: "75 or over", value: "75_plus", subLabel: "NCC cap closed — estate routing only lever" },
    ],
    required: true,
  },
  {
    id: "accountant_aware", step: 6, type: "two_button",
    label: "Has your accountant modelled your actual death benefit tax exposure?",
    subLabel: "Most accountants focus on annual tax, not estate outcomes. Most SMSF trustees have never seen their own number.",
    options: [
      { label: "Yes — modelled and planned", value: true },
      { label: "No — never been discussed", value: false },
    ],
  },
];

const TOTAL_STEPS = 6;

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT BLOCK
// ─────────────────────────────────────────────────────────────────────────────

function VerdictBlock({ verdict, onCheckout, loading }: {
  verdict: VerdictResult;
  onCheckout: (t: Tier) => void;
  loading: boolean;
}) {
  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>{verdict.status}</p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tax breakdown panel */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your family's true inheritance</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Your super balance</span>
            <span className="font-mono font-bold text-neutral-950">{formatAUD(verdict.tax.totalBalance)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Tax-free component ({Math.round((verdict.tax.taxFreeAmount / verdict.tax.totalBalance) * 100)}%)</span>
            <span className="font-mono text-emerald-700">{formatAUD(verdict.tax.taxFreeAmount)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Taxable component ({Math.round((verdict.tax.taxableAmount / verdict.tax.totalBalance) * 100)}%)</span>
            <span className="font-mono text-red-700">{formatAUD(verdict.tax.taxableAmount)}</span>
          </div>
          {verdict.tax.deathTaxApplies && (
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Death benefit tax (17%)</span>
              <span className="font-mono font-bold text-red-700">− {formatAUD(verdict.tax.deathTaxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1">
            <span className="font-semibold text-neutral-800">Family actually receives</span>
            <span className="font-mono font-bold text-neutral-950">{formatAUD(verdict.tax.familyReceives)}</span>
          </div>
          {verdict.tax.div296Applies && (
            <div className="mt-2 pt-2 border-t border-neutral-200 flex justify-between">
              <span className="text-neutral-600">Plus Division 296 (5 years, while alive)</span>
              <span className="font-mono text-red-700">~ {formatAUD(verdict.tax.div296FiveYear)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Active loss framing (GOAT audit requirement) */}
      {verdict.tax.deathTaxApplies && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ What leaves your family instead of your kids</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-1">
            {formatAUD(verdict.tax.deathTaxAmount)} goes to the ATO before your family receives a cent.
          </p>
          <p className="text-xs text-red-800 leading-relaxed">
            This is irreversible once you die. All reduction levers (recontribution, streaming, estate routing) require action while alive.
          </p>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
        <strong className="text-neutral-950">What this means:</strong>
        <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
          {verdict.consequences.map((c, i) => <li key={i}>→ {c}</li>)}
        </ul>
      </div>

      <div className={`mb-4 rounded-xl border px-4 py-2 text-xs ${
        verdict.confidence === "HIGH" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : verdict.confidence === "MEDIUM" ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800"
      }`}>
        <strong>Confidence: {verdict.confidence}</strong> — {verdict.confidenceNote}
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-sm text-neutral-800 leading-relaxed">
          <strong className="text-neutral-950">This is not about rules or caps.</strong> It is about what actually leaves your family instead of going to your kids. Law since 2007 — but most SMSF trustees have never seen their own number.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What's in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your exact death benefit tax — per beneficiary, broken down</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Division 296 projection across 5 years at your TSB trajectory</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Recontribution eligibility + specific reduction amount</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Estate routing vs direct payment comparison</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>4 accountant questions written for YOUR exact family and balance</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your family and your balance</p>
      <p className="mt-2 text-center">
        <button onClick={() => onCheckout(verdict.tier === 67 ? 147 : 67)} disabled={loading}
          className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
          {verdict.altTierLabel}
        </button>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION BLOCK
// ─────────────────────────────────────────────────────────────────────────────

function QuestionBlock({ q, value, onAnswer }: {
  q: Q;
  value: AnswerMap[string];
  onAnswer: (id: string, v: string | boolean) => void;
}) {
  const sel = (v: string | boolean) => value === v;
  const base = "rounded-xl border px-4 py-3 text-left transition";
  const active = "border-neutral-950 bg-neutral-950 text-white";
  const inactive = "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400";

  return (
    <div>
      <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">{q.label}</h2>
      {q.subLabel && <p className="mb-4 text-sm text-neutral-500">{q.subLabel}</p>}

      {q.type === "two_button" ? (
        <div className="grid grid-cols-2 gap-3">
          {q.options.map(opt => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as string | boolean)}
              className={`rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${sel(opt.value as string | boolean) ? active : inactive}`}>
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map(opt => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as string)}
              className={`${base} ${sel(opt.value as string) ? active : inactive}`}>
              <span className="block text-sm font-medium">{opt.label}</span>
              {opt.subLabel && <span className={`mt-0.5 block text-xs ${sel(opt.value as string) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function SuperDeathTaxTrapCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ entity_type: "", urgency: "", accountant: "" });
  const [email, setEmail]           = useState("");
  const [emailSent, setEmailSent]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const verdictRef                  = useRef<HTMLDivElement>(null);

  const verdict = useMemo(() => showVerdict ? calcVerdict(answers) : null, [showVerdict, answers]);
  const visibleQs = QUESTIONS.filter(q => q.step === step && (!q.showIf || q.showIf(answers)));
  const stepComplete = !visibleQs.length || visibleQs.filter(q => q.required !== false).every(q => answers[q.id] !== undefined && answers[q.id] !== "");
  const popupComplete = Object.values(popupAnswers).every(v => v !== "");
  const maxStep = TOTAL_STEPS;

  useEffect(() => {
    if (!stepComplete) return;
    const t = setTimeout(() => {
      const next = step + 1;
      if (next <= TOTAL_STEPS) setStep(next);
      else setVerdict(true);
    }, visibleQs.length ? 300 : 0);
    return () => clearTimeout(t);
  }, [stepComplete, step, visibleQs.length]);

  useEffect(() => {
    if (showVerdict && verdictRef.current)
      setTimeout(() => verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [showVerdict]);

  useEffect(() => {
    document.body.style.overflow = showPopup ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showPopup]);

  useEffect(() => {
    if (!showVerdict || !verdict) return;
    fetch("/api/decision-sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_slug: "super-death-tax-trap",
        source_path: "/au/check/super-death-tax-trap",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          death_tax: verdict.tax.deathTaxAmount,
          div296_applies: verdict.tax.div296Applies,
          div296_annual: verdict.tax.div296Annual,
          family_receives: verdict.tax.familyReceives,
          tier: verdict.tier,
        },
        recommended_tier: verdict.tier,
      }),
    }).then(r => r.json()).then(d => { if (d.id) setSessionId(d.id); }).catch(() => {});
  }, [showVerdict]);

  function answer(id: string, v: string | boolean) {
    setAnswers(p => ({ ...p, [id]: v }));
  }

  function back() {
    if (showVerdict) { setVerdict(false); return; }
    if (step > 1) setStep(s => s - 1);
  }

  async function handleSaveEmail() {
    if (!email) return;
    await fetch("/api/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "super_death_tax_trap", country_code: "AU", site: "taxchecknow" }),
    }).catch(() => {});
    setEmailSent(true);
  }

  function openPopup(tier: Tier) {
    setPopupTier(tier);
    setShowQ(false);
    setShowPopup(true);
    setError("");
  }

  async function handleCheckout() {
    if (loading || !verdict) return;
    setLoading(true); setError("");
    const sid = sessionId || `sdtt_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    // sessionStorage keys MUST match config successPromptFields exactly
    sessionStorage.setItem("super-death-tax-trap_beneficiaries", String(answers.beneficiaries || ""));
    sessionStorage.setItem("super-death-tax-trap_tsb_band", String(answers.tsb_band || ""));
    sessionStorage.setItem("super-death-tax-trap_taxable_percent", String(answers.taxable_percent || ""));
    sessionStorage.setItem("super-death-tax-trap_death_tax_estimate", String(Math.round(verdict.tax.deathTaxAmount)));
    sessionStorage.setItem("super-death-tax-trap_div296_applies", String(verdict.tax.div296Applies));
    sessionStorage.setItem("super-death-tax-trap_div296_annual", String(Math.round(verdict.tax.div296Annual)));
    sessionStorage.setItem("super-death-tax-trap_status", verdict.status);
    sessionStorage.setItem("super-death-tax-trap_tier", String(popupTier));

    if (sessionId) {
      fetch("/api/decision-sessions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, tier_intended: popupTier, product_key: key, questionnaire_payload: popupAnswers, email: email || undefined }),
      }).catch(() => {});
    }

    try {
      const successPath = popupTier === 67 ? "assess" : "plan";
      const res = await fetch("/api/create-checkout-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision_session_id: sid, tier: popupTier, product_key: key,
          success_url: `${window.location.origin}/au/check/super-death-tax-trap/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/super-death-tax-trap`,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setError(data.error || "Checkout failed."); setLoading(false); }
    } catch {
      setError("Checkout failed — please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        {!showVerdict && visibleQs.length > 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">Step {step} of {maxStep}</p>
              {step > 1 && <button onClick={back} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← Back</button>}
            </div>
            <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full bg-neutral-950 transition-all duration-300" style={{ width: `${((step - 1) / maxStep) * 100}%` }} />
            </div>
            <div className="space-y-6">
              {visibleQs.map(q => <QuestionBlock key={q.id} q={q} value={answers[q.id] as string | boolean} onAnswer={answer} />)}
            </div>
          </div>
        )}

        {showVerdict && verdict && (
          <div ref={verdictRef} className="space-y-4">
            <button onClick={back} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← Change my answers</button>
            <VerdictBlock verdict={verdict} onCheckout={openPopup} loading={loading} />
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your result to show your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your family's true inheritance number by email — free.</p>
              {!emailSent ? (
                <div className="flex gap-2">
                  <input type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                  <button onClick={handleSaveEmail} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">Save</button>
                </div>
              ) : <p className="text-sm font-semibold text-emerald-700">✓ Saved — check your inbox.</p>}
            </div>
          </div>
        )}
      </div>

      {/* Purchase popup */}
      {showPopup && verdict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl my-auto">
            <div className="rounded-t-2xl bg-neutral-950 px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass.replace("700","400")}`}>{verdict.status}</p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">
                    {verdict.tax.deathTaxApplies ? "Reduce the tax before it becomes permanent" : "Know your family's true inheritance"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">ATO-referenced · ITAA 1997 Div 302 · April 2026</p>
                </div>
                <button onClick={() => { setShowPopup(false); setShowQ(false); }}
                  className="rounded-lg bg-white/10 px-2 py-1 font-mono text-xs text-neutral-300 hover:bg-white/20 transition">✕ close</button>
              </div>
            </div>
            <div className="px-6 pt-5">
              {!showQuestions ? (
                <>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">What you get</p>
                    <p className="text-sm font-bold text-neutral-950 mb-2">
                      {popupTier === 67 ? "Know Your Family's True Inheritance™" : "Reduce the Tax Before It Becomes Permanent™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your exact death benefit tax, per-child breakdown, Division 296 exposure, recontribution eligibility, and fixability assessment — built for your exact family and balance."
                        : "Full recontribution execution plan, contribution sequencing across 30 June, Division 296 mitigation strategy, estate routing plan, and accountant-ready implementation documents."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic super guide. A plan for your exact family and super balance.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show What My Family Actually Receives →" : "Get My Reduction Plan →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the diagnostic? — $67 instead" : "Want the full reduction plan? — $147 instead"}
                    </button>
                  </p>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">3 quick questions then pay</p>
                    <p className="font-serif text-lg font-bold text-neutral-950">${popupTier}</p>
                  </div>
                  {[
                    { label: "Fund structure", key: "entity_type", options: [["smsf","SMSF — self-managed"],["apra","Industry / retail fund"],["both","Both SMSF and APRA fund"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["acting_now","Acting this financial year"],["planning","Planning ahead"],["just_checking","Just checking my position"]] },
                    { label: "Do you have an accountant or financial adviser?", key: "accountant", options: [["accountant","Yes — accountant"],["adviser","Yes — financial adviser"],["both","Both"],["no","No — managing myself"]] },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">{field.label}</label>
                      <select value={popupAnswers[field.key as keyof PopupAnswers]}
                        onChange={e => setPopupA(p => ({ ...p, [field.key]: e.target.value }))}
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400">
                        <option value="">Select…</option>
                        {field.options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                      </select>
                    </div>
                  ))}
                  <button onClick={handleCheckout} disabled={!popupComplete || loading}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50">
                    {loading ? "Redirecting to Stripe…" : `Pay $${popupTier} →`}
                  </button>
                  {error && <p className="text-sm font-medium text-red-700">{error}</p>}
                </div>
              )}
              <button onClick={() => { setShowPopup(false); setShowQ(false); }}
                className="mt-3 w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-500 hover:bg-neutral-50 transition">
                Not now — keep reading
              </button>
            </div>
            <div className="px-6 pb-5 pt-2">
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · ATO-sourced content</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile sticky bar */}
      {showVerdict && verdict && (verdict.tax.deathTaxApplies || verdict.tax.div296Applies) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Family loses</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatAUD(verdict.tax.deathTaxAmount + verdict.tax.div296FiveYear)} to ATO
              </p>
            </div>
            <button onClick={() => openPopup(verdict.tier)}
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white whitespace-nowrap">
              From $67 →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
