"use client";

/**
 * AU-05 — Negative Gearing Illusion Engine
 * Pattern: Module F (CashflowModel) — real after-tax position not just tax benefit
 * Brief: property profile → income band → cashflow inputs → vacancy → repair risk → growth belief → opportunity cost
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;

interface CashflowResult {
  annualRent: number;
  annualInterest: number;
  holdingCosts: number;
  vacancyDrag: number;
  effectiveRent: number;
  grossLoss: number;
  taxBenefit: number;
  realAfterTaxCost: number;
  illusionGap: number;   // difference between tax benefit perception and real cost
  breakEvenRent: number;
  taxRate: number;
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
  cashflow: CashflowResult;
  illusionType: "severe" | "moderate" | "mild" | "positive";
}

interface PopupAnswers {
  property_intent: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAX RATE LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

const TAX_RATES: Record<string, number> = {
  "under_45k": 0.19,
  "45k_120k":  0.325,
  "120k_180k": 0.37,
  "over_180k": 0.45,
};

const INCOME_LABELS: Record<string, string> = {
  "under_45k": "Under $45k (19%)",
  "45k_120k":  "$45k–$120k (32.5%)",
  "120k_180k": "$120k–$180k (37%)",
  "over_180k": "Over $180k (45%)",
};

function formatAUD(n: number): string {
  const abs = Math.abs(Math.round(n));
  const str = "$" + abs.toLocaleString("en-AU");
  return n < 0 ? `-${str}` : str;
}

// ─────────────────────────────────────────────────────────────────────────────
// CASHFLOW ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const RENT_MAP: Record<string, number> = {
  "under_20k": 15000, "20k_30k": 25000, "30k_40k": 35000, "over_40k": 50000,
};
const INTEREST_MAP: Record<string, number> = {
  "under_15k": 12000, "15k_30k": 22000, "30k_50k": 40000, "over_50k": 65000,
};
const HOLDING_MAP: Record<string, number> = {
  "low": 3000, "medium": 6000, "high": 12000,
};
const VACANCY_MAP: Record<string, number> = {
  "none": 0, "low": 0.03, "moderate": 0.07, "high": 0.12,
};

function calcCashflow(answers: AnswerMap): CashflowResult {
  const incomeBand    = String(answers.income_band || "45k_120k");
  const rentBand      = String(answers.rent_band || "20k_30k");
  const interestBand  = String(answers.interest_band || "15k_30k");
  const holdingLevel  = String(answers.holding_costs || "medium");
  const vacancyLevel  = String(answers.vacancy || "low");

  const taxRate       = TAX_RATES[incomeBand] ?? 0.325;
  const annualRent    = RENT_MAP[rentBand] ?? 25000;
  const annualInterest = INTEREST_MAP[interestBand] ?? 22000;
  const holdingCosts  = HOLDING_MAP[holdingLevel] ?? 6000;
  const vacancyRate   = VACANCY_MAP[vacancyLevel] ?? 0.03;

  const vacancyDrag   = Math.round(annualRent * vacancyRate);
  const effectiveRent = annualRent - vacancyDrag;
  const grossLoss     = effectiveRent - annualInterest - holdingCosts;
  const taxBenefit    = grossLoss < 0 ? Math.abs(grossLoss) * taxRate : 0;
  const realAfterTaxCost = grossLoss < 0 ? Math.abs(grossLoss) - taxBenefit : 0;

  // Illusion gap: how much more you're actually losing vs the tax benefit you're getting
  const illusionGap = grossLoss < 0 ? realAfterTaxCost : 0;

  // Break-even rent: what rent would make after-tax cost = 0
  const breakEvenRent = Math.round((annualInterest + holdingCosts) / (1 - taxRate));

  return {
    annualRent, annualInterest, holdingCosts, vacancyDrag,
    effectiveRent, grossLoss, taxBenefit, realAfterTaxCost,
    illusionGap, breakEvenRent, taxRate,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const cf             = calcCashflow(answers);
  const propertyProfile = String(answers.property_profile || "existing");
  const growthBelief   = String(answers.growth_belief || "");
  const repairRisk     = answers.repair_risk;
  const altCash        = String(answers.alt_cash || "");
  const incomeBand     = String(answers.income_band || "45k_120k");

  const KEYS = {
    p67:  "au_67_negative_gearing_illusion",
    p147: "au_147_negative_gearing_illusion",
  };

  // ── Determine illusion severity ───────────────────────────────────────────
  let illusionType: "severe" | "moderate" | "mild" | "positive" = "mild";
  if (cf.grossLoss >= 0) {
    illusionType = "positive"; // positively geared
  } else if (cf.realAfterTaxCost > 15000) {
    illusionType = "severe";
  } else if (cf.realAfterTaxCost > 7000) {
    illusionType = "moderate";
  } else {
    illusionType = "mild";
  }

  const repairNote = repairRisk ? ` One-off repairs would add directly to your cash loss — there is no tax relief timing benefit when repairs reduce cash before the year-end.` : "";
  const growthNote = growthBelief === "yes"
    ? " You are relying on capital growth to justify the cash loss — confirm your break-even growth rate before continuing to hold."
    : growthBelief === "no"
      ? " You are not relying on capital growth — consider whether the property is still the best use of this capital."
      : "";
  const altNote = altCash === "debt_reduction"
    ? " The same cash applied to mortgage debt reduction or an offset account would save interest at your full loan rate — typically more than the after-tax rental benefit."
    : altCash === "offset"
      ? " Every dollar in an offset account saves interest at your full loan rate — compare this directly to your after-tax rental return."
      : "";

  // ── Positively geared ─────────────────────────────────────────────────────
  if (illusionType === "positive") {
    return {
      status: "POSITIVELY GEARED — INCOME EXCEEDS COSTS",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your rental income appears to exceed your costs — you are positively geared. This is taxable income, not a deduction.`,
      stats: [
        { label: "Effective rent", value: formatAUD(cf.effectiveRent) },
        { label: "Total costs", value: formatAUD(cf.annualInterest + cf.holdingCosts) },
        { label: "Net position", value: formatAUD(cf.grossLoss), highlight: false },
      ],
      consequences: [
        "Positively geared properties generate taxable income — you pay tax on the surplus at your marginal rate",
        `At your ${INCOME_LABELS[incomeBand]} marginal rate, tax on the surplus applies`,
        "Review your depreciation schedule — a QS report may convert some surplus into allowable deductions",
        repairNote,
      ].filter(Boolean),
      confidence: "MEDIUM",
      confidenceNote: "Based on estimated inputs — actual position depends on exact figures.",
      tier: 67,
      ctaLabel: "Get My Property Cashflow Reality Plan — $67 →",
      altTierLabel: "Want debt structure and portfolio analysis? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      cashflow: cf,
      illusionType,
    };
  }

  // ── Severe illusion ───────────────────────────────────────────────────────
  if (illusionType === "severe") {
    return {
      status: "SEVERE CASH DRAIN — TAX SAVING DOES NOT COVER YOUR LOSS",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Your tax saving is ${formatAUD(cf.taxBenefit)} per year — but your real after-tax cash loss is ${formatAUD(cf.realAfterTaxCost)}. The "negative gearing benefit" only covers ${Math.round((cf.taxBenefit / Math.abs(cf.grossLoss)) * 100)}% of your actual loss.`,
      stats: [
        { label: "Tax benefit", value: formatAUD(cf.taxBenefit) },
        { label: "Real cash loss", value: formatAUD(cf.realAfterTaxCost), highlight: true },
        { label: "Break-even rent", value: formatAUD(cf.breakEvenRent) + "/yr", highlight: true },
      ],
      consequences: [
        `You are losing ${formatAUD(cf.realAfterTaxCost)} per year in real cash — after your tax benefit is applied`,
        `To break even after tax, your rent would need to be ${formatAUD(cf.breakEvenRent)} per year`,
        `${cf.vacancyDrag > 0 ? `Vacancy is costing you ${formatAUD(cf.vacancyDrag)} in lost rent before any other costs are applied` : ""}`,
        growthNote,
        altNote,
        repairNote,
      ].filter(Boolean),
      confidence: "MEDIUM",
      confidenceNote: "Severe position — confirm exact rent, interest, and costs with your accountant.",
      tier: 147,
      ctaLabel: "Get My Property Cashflow Control System — $147 →",
      altTierLabel: "Just want the reality plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      cashflow: cf,
      illusionType,
    };
  }

  // ── Moderate illusion ─────────────────────────────────────────────────────
  if (illusionType === "moderate") {
    return {
      status: "NEGATIVE GEARING ILLUSION — REAL COST HIGHER THAN TAX SAVING",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your tax saving is ${formatAUD(cf.taxBenefit)} — but your real after-tax cash loss is ${formatAUD(cf.realAfterTaxCost)} per year. Negative gearing is working, but the illusion gap is significant.`,
      stats: [
        { label: "Tax benefit", value: formatAUD(cf.taxBenefit) },
        { label: "Real cash loss", value: formatAUD(cf.realAfterTaxCost), highlight: true },
        { label: "Illusion gap", value: formatAUD(cf.illusionGap), highlight: true },
      ],
      consequences: [
        `The tax benefit reduces your cash loss but does not eliminate it — you are still ${formatAUD(cf.realAfterTaxCost)} out of pocket per year`,
        `To break even after tax, your rent would need to be ${formatAUD(cf.breakEvenRent)} per year`,
        growthNote || "Capital growth must outpace your cumulative real after-tax loss for this to be a net positive strategy",
        altNote,
        repairNote,
      ].filter(Boolean),
      confidence: "MEDIUM",
      confidenceNote: "Based on estimated inputs — actual position may vary by $2,000–$5,000 depending on exact figures.",
      tier: 147,
      ctaLabel: "Get My Property Cashflow Control System — $147 →",
      altTierLabel: "Just want the reality plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      cashflow: cf,
      illusionType,
    };
  }

  // ── Mild illusion ─────────────────────────────────────────────────────────
  return {
    status: "MILD NEGATIVE GEARING — MANAGEABLE REAL COST",
    statusClass: "text-amber-700",
    panelClass: "border-amber-200 bg-amber-50",
    headline: `Your real after-tax cash loss is ${formatAUD(cf.realAfterTaxCost)} per year — modest, but you are still out of pocket beyond the tax saving.`,
    stats: [
      { label: "Tax benefit", value: formatAUD(cf.taxBenefit) },
      { label: "Real cash loss", value: formatAUD(cf.realAfterTaxCost) },
      { label: "Break-even rent", value: formatAUD(cf.breakEvenRent) + "/yr" },
    ],
    consequences: [
      `Your negative gearing tax benefit is ${formatAUD(cf.taxBenefit)} — but your real net cost is ${formatAUD(cf.realAfterTaxCost)} after tax`,
      "This position is manageable — but stress test it against a rate rise, vacancy, or repair event",
      repairNote || "A significant repair event could materially change this position",
      growthNote || "Confirm that expected capital growth justifies the ongoing cash cost",
    ].filter(Boolean),
    confidence: "MEDIUM",
    confidenceNote: "Mild position — small changes in rent or costs can shift this significantly.",
    tier: 67,
    ctaLabel: "Get My Negative Gearing Reality Plan — $67 →",
    altTierLabel: "Want debt structure and portfolio analysis? — $147",
    productKey67: KEYS.p67, productKey147: KEYS.p147,
    cashflow: cf,
    illusionType,
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
    id: "property_profile", step: 1, type: "button_group",
    label: "What are you assessing?",
    subLabel: "Sets the output tone and model assumptions",
    options: [
      { label: "Existing rental property", value: "existing", subLabel: "Already own and renting out" },
      { label: "Considering a purchase", value: "considering", subLabel: "Evaluating whether to buy" },
      { label: "Portfolio review", value: "portfolio", subLabel: "Reviewing multiple properties" },
    ],
    required: true,
  },
  {
    id: "income_band", step: 2, type: "button_group",
    label: "What is your approximate marginal tax rate?",
    subLabel: "Your tax saving from negative gearing equals your rental loss × your marginal rate — higher income = larger tax benefit",
    options: [
      { label: "Under $45,000 — 19%", value: "under_45k", subLabel: "Lower tax benefit from negative gearing" },
      { label: "$45,000–$120,000 — 32.5%", value: "45k_120k", subLabel: "Standard benefit range" },
      { label: "$120,000–$180,000 — 37%", value: "120k_180k", subLabel: "Strong tax benefit" },
      { label: "Over $180,000 — 45%", value: "over_180k", subLabel: "Maximum tax benefit" },
    ],
    required: true,
  },
  {
    id: "rent_band", step: 3, type: "button_group",
    label: "What is your expected annual rental income?",
    subLabel: "Before vacancy — gross rent at full occupancy",
    options: [
      { label: "Under $20,000", value: "under_20k" },
      { label: "$20,000–$30,000", value: "20k_30k" },
      { label: "$30,000–$40,000", value: "30k_40k" },
      { label: "Over $40,000", value: "over_40k" },
    ],
    required: true,
  },
  {
    id: "interest_band", step: 4, type: "button_group",
    label: "What is your annual loan interest cost?",
    subLabel: "Interest is the largest deductible expense for most rental properties",
    options: [
      { label: "Under $15,000", value: "under_15k", subLabel: "Smaller loan or well-paid-down" },
      { label: "$15,000–$30,000", value: "15k_30k", subLabel: "Typical mid-range investment" },
      { label: "$30,000–$50,000", value: "30k_50k", subLabel: "Larger or higher-rate loan" },
      { label: "Over $50,000", value: "over_50k", subLabel: "High-value property or high rate" },
    ],
    required: true,
  },
  {
    id: "holding_costs", step: 5, type: "button_group",
    label: "What is your annual holding cost level (rates, insurance, management, maintenance)?",
    subLabel: "Excluding loan interest — all other deductible running costs",
    options: [
      { label: "Low — around $3,000", value: "low", subLabel: "Minimal costs, well-maintained" },
      { label: "Medium — around $6,000", value: "medium", subLabel: "Typical for most rental properties" },
      { label: "High — around $12,000+", value: "high", subLabel: "Older property, high management costs" },
    ],
    required: true,
  },
  {
    id: "vacancy", step: 6, type: "button_group",
    label: "What vacancy or rental downtime do you expect?",
    subLabel: "Vacancy directly reduces rental income — the tax benefit only applies to actual income lost, not deferred",
    options: [
      { label: "None — fully tenanted", value: "none" },
      { label: "Low — 1–2 weeks per year", value: "low", subLabel: "~3% vacancy drag" },
      { label: "Moderate — 3–5 weeks", value: "moderate", subLabel: "~7% vacancy drag" },
      { label: "High — 6+ weeks or seasonal", value: "high", subLabel: "~12% vacancy drag" },
    ],
    required: true,
  },
  {
    id: "repair_risk", step: 7, type: "two_button",
    label: "Do you expect significant one-off repairs or capital works soon?",
    subLabel: "Capital improvements are not immediately deductible — they add to your cash loss without immediate tax relief",
    options: [
      { label: "No — property in good condition", value: false },
      { label: "Yes — repairs or works likely", value: true },
    ],
  },
  {
    id: "growth_belief", step: 8, type: "button_group",
    label: "Are you relying on capital growth to justify the ongoing cash loss?",
    subLabel: "Capital growth is not guaranteed — your after-tax cash loss is real and certain whether or not growth occurs",
    options: [
      { label: "Yes — growth will justify the cost", value: "yes" },
      { label: "No — cash flow is the focus", value: "no" },
      { label: "Unsure — want to model this", value: "unsure" },
    ],
  },
  {
    id: "alt_cash", step: 9, type: "button_group",
    label: "What would the same cash otherwise go toward?",
    subLabel: "This is the real opportunity cost — the comparison that makes negative gearing a genuine decision, not just a tax strategy",
    options: [
      { label: "Mortgage debt reduction", value: "debt_reduction", subLabel: "Saves interest at full loan rate" },
      { label: "Offset account", value: "offset", subLabel: "Same effect as debt reduction" },
      { label: "Other investment", value: "other_investment", subLabel: "Shares, super, or other assets" },
      { label: "Living expenses / lifestyle", value: "lifestyle" },
    ],
  },
];

const TOTAL_STEPS = 9;

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT BLOCK
// ─────────────────────────────────────────────────────────────────────────────

function VerdictBlock({ verdict, onCheckout, loading }: {
  verdict: VerdictResult;
  onCheckout: (t: Tier) => void;
  loading: boolean;
}) {
  const cf = verdict.cashflow;

  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>{verdict.status}</p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

      {/* 3-stat grid */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Cashflow breakdown */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
          Your after-tax cashflow breakdown
        </p>
        <div className="space-y-2 text-sm">
          {[
            { label: "Annual rental income (gross)", value: formatAUD(cf.annualRent), color: "text-emerald-700" },
            { label: `Vacancy drag (${cf.vacancyDrag > 0 ? "–" + formatAUD(cf.vacancyDrag) : "none"})`, value: formatAUD(cf.effectiveRent), color: "text-neutral-700" },
            { label: "Less: annual interest", value: "–" + formatAUD(cf.annualInterest), color: "text-red-600" },
            { label: "Less: holding costs", value: "–" + formatAUD(cf.holdingCosts), color: "text-red-600" },
            { label: "Gross rental loss / income", value: formatAUD(cf.grossLoss), color: cf.grossLoss < 0 ? "text-red-700 font-bold" : "text-emerald-700 font-bold" },
            { label: `Tax benefit (loss × ${Math.round(cf.taxRate * 100)}%)`, value: cf.taxBenefit > 0 ? "+" + formatAUD(cf.taxBenefit) : "$0", color: "text-emerald-600" },
            { label: "Real after-tax cost per year", value: cf.realAfterTaxCost > 0 ? "–" + formatAUD(cf.realAfterTaxCost) : formatAUD(0), color: cf.realAfterTaxCost > 0 ? "text-red-700 font-bold" : "text-emerald-700 font-bold" },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between border-b border-neutral-100 pb-1 last:border-0 last:pb-0">
              <span className="text-neutral-600 text-xs">{row.label}</span>
              <span className={`font-mono text-sm font-semibold ${row.color}`}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Illusion gap callout */}
      {verdict.illusionType !== "positive" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700 mb-1">The negative gearing illusion</p>
          <p className="text-xs text-amber-900">
            → The tax benefit covers {Math.round((cf.taxBenefit / Math.abs(cf.grossLoss)) * 100)}% of your loss — not 100%.
            You are still {formatAUD(cf.realAfterTaxCost)} out of pocket per year in real cash.
            Break-even rent would be {formatAUD(cf.breakEvenRent)}/year.
          </p>
        </div>
      )}

      {/* Consequences */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <strong className="text-sm text-neutral-950">What this means:</strong>
        <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
          {verdict.consequences.map((c, i) => <li key={i}>→ {c}</li>)}
        </ul>
      </div>

      {/* Confidence */}
      <div className={`mb-4 rounded-xl border px-4 py-2 text-xs ${
        verdict.confidence === "HIGH" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : verdict.confidence === "MEDIUM" ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800"
      }`}>
        <strong>Confidence: {verdict.confidence}</strong> — {verdict.confidenceNote}
      </div>

      {/* Conversion line */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-sm text-neutral-700 leading-relaxed">
          Most property investors overestimate the tax saving and underestimate the real cash drain.
          <strong className="text-neutral-950"> This check shows your actual after-tax position — not the headline number.</strong>
        </p>
      </div>

      {/* What you get */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What's in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Personalised after-tax cashflow memo built around your exact inputs</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Break-even rent calculation — what rent makes this property cash neutral</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Sensitivity table — impact of rate rise, vacancy, or repair event</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Depreciation note — whether a QS report could improve your position</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>3 accountant questions written for your cashflow profile</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your answers above</p>
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
  const sel = (v: string | boolean) => value === v || String(value) === String(v);
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
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition text-center ${sel(opt.value as string | boolean) ? active : inactive}`}>
              <span className="block">{opt.label}</span>
              {opt.subLabel && <span className={`mt-0.5 block text-xs ${sel(opt.value as string | boolean) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>}
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

export default function NegativeGearingIllusionCalculator() {
  const [answers, setAnswers]     = useState<AnswerMap>({});
  const [step, setStep]           = useState(1);
  const [showVerdict, setVerdict] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showQuestions, setShowQ] = useState(false);
  const [popupTier, setPopupTier] = useState<Tier>(147);
  const [popupAnswers, setPopupA] = useState<PopupAnswers>({ property_intent: "", urgency: "", accountant: "" });
  const [email, setEmail]         = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const verdictRef                = useRef<HTMLDivElement>(null);

  const verdict   = useMemo(() => showVerdict ? calcVerdict(answers) : null, [showVerdict, answers]);
  const visibleQs = QUESTIONS.filter(q => q.step === step && (!q.showIf || q.showIf(answers)));
  const stepComplete = !visibleQs.length || visibleQs.filter(q => q.required !== false).every(q => {
    const v = answers[q.id];
    return v !== undefined && v !== "" && v !== null;
  });

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
        product_slug: "negative-gearing-illusion",
        source_path: "/au/check/negative-gearing-illusion",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          illusion_type: verdict.illusionType,
          real_cost: verdict.cashflow.realAfterTaxCost,
          tax_benefit: verdict.cashflow.taxBenefit,
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
      body: JSON.stringify({ email, source: "negative_gearing_illusion", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `ng_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;
    const cf  = verdict.cashflow;

    sessionStorage.setItem("negative-gearing-illusion_income_band", String(answers.income_band || ""));
    sessionStorage.setItem("negative-gearing-illusion_illusion_type", verdict.illusionType);
    sessionStorage.setItem("negative-gearing-illusion_real_cost", String(cf.realAfterTaxCost));
    sessionStorage.setItem("negative-gearing-illusion_tax_benefit", String(cf.taxBenefit));
    sessionStorage.setItem("negative-gearing-illusion_break_even_rent", String(cf.breakEvenRent));
    sessionStorage.setItem("negative-gearing-illusion_status", verdict.status);
    sessionStorage.setItem("negative-gearing-illusion_tier", String(popupTier));

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
          success_url: `${window.location.origin}/au/check/negative-gearing-illusion/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/negative-gearing-illusion`,
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

  const maxStep     = QUESTIONS.reduce((acc, q) => (!q.showIf || q.showIf(answers)) ? Math.max(acc, q.step) : acc, 1);
  const popupComplete = Object.values(popupAnswers).every(v => v !== "");

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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Get your cashflow breakdown by email.</p>
              <p className="mb-2 text-xs text-neutral-500">Free — send this to your accountant or broker.</p>
              {!emailSent ? (
                <div className="flex gap-2">
                  <input type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                  <button onClick={handleSaveEmail} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">Send</button>
                </div>
              ) : <p className="text-sm font-semibold text-emerald-700">✓ Sent — check your inbox.</p>}
            </div>
          </div>
        )}
      </div>

      {showPopup && verdict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl my-auto">
            <div className="rounded-t-2xl bg-neutral-950 px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass.replace("700","400")}`}>Negative Gearing Reality</p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">
                    {verdict.cashflow.realAfterTaxCost > 0
                      ? `Real cost: ${formatAUD(verdict.cashflow.realAfterTaxCost)}/year`
                      : "Positively geared position"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">ATO-referenced · April 2026</p>
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
                      {popupTier === 67 ? "Your Negative Gearing Reality Plan™" : "Your Property Cashflow Control System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Personalised after-tax cashflow memo, break-even rent calculation, sensitivity table for rate/vacancy changes, and accountant questions built around your property profile."
                        : "Debt structure options, offset-vs-invest scenario map, hold/sell/reprice framework, and a portfolio discussion pack to take to your accountant or broker."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic negative gearing guide. Built around your numbers.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Get My Reality Plan →" : "Get My Cashflow System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the reality plan? — $67 instead" : "Want debt structure and portfolio analysis? — $147 instead"}
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
                    { label: "What are you trying to do?", key: "property_intent", options: [["review","Review existing property position"],["decide","Deciding whether to buy"],["sell","Considering selling or repricing"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["asap","Urgent — need to act now"],["this_year","Planning for this financial year"],["exploring","Just exploring my options"]] },
                    { label: "Do you have an accountant or broker?", key: "accountant", options: [["accountant","Yes — accountant"],["broker","Yes — mortgage broker"],["both","Both"],["no","No — managing myself"]] },
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

      {showVerdict && verdict && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Negative Gearing Reality</p>
              <p className="text-sm font-bold text-neutral-950">
                {verdict.cashflow.realAfterTaxCost > 0
                  ? `Real cost: ${formatAUD(verdict.cashflow.realAfterTaxCost)}/yr — get your plan`
                  : "Positively geared — confirm your position"}
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
