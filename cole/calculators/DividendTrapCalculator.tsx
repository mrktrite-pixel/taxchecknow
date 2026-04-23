"use client";

/**
 * UK-05 — Salary + Dividend Tax Trap Engine (formerly Dividend Trap)
 * Pattern: F (CashflowModel — exact tax by band) + G (ThresholdTest — £50,270 / £125,140)
 *
 * Core question: How much tax does this director's dividend actually attract,
 * and what restructure reduces it?
 *
 * Key facts (HMRC confirmed April 2026, 2025-26 tax year):
 *   Personal allowance: £12,570
 *   Basic rate band: £12,570 to £50,270 (width £37,700)
 *   Higher rate threshold: £50,270
 *   Additional rate threshold: £125,140
 *   Dividend allowance: £500 (2024-25 onwards, down from £5,000 in 2017-18)
 *   Dividend tax rates: 8.75% basic / 33.75% higher / 39.35% additional
 *   Dividends stack at the TOP of total income — they do NOT have their own band
 *   Legal anchor: Income Tax Act 2007, ITTOIA 2005 s383-385
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;

interface DividendResult {
  salary: number;
  dividends: number;
  otherIncome: number;
  totalIncome: number;
  nonDividendIncome: number;

  // Band allocations for dividends (before allowance)
  dividendInAllowanceZone: number;    // dividend £ that falls within personal allowance
  dividendInBasic: number;
  dividendInHigher: number;
  dividendInAdditional: number;

  // After £500 dividend allowance
  basicAfterAllowance: number;
  higherAfterAllowance: number;
  additionalAfterAllowance: number;

  // Tax on each band
  taxBasic: number;
  taxHigher: number;
  taxAdditional: number;
  totalDividendTax: number;
  effectiveDividendRate: number;

  // Status
  crossesHigherRate: boolean;
  crossesAdditionalRate: boolean;

  // Optimisation — saving if dividends restructured to stay in basic rate
  excessAboveHigher: number;         // £ of dividend above £50,270
  higherRateSaving: number;          // rate differential tax saving if reduced to basic
  totalHigherRateTax: number;        // current tax on higher-rate portion (this year)

  // Allowance history context
  dividendAllowanceCurrent: number;
  dividendAllowancePrior: number;    // 2017-18 figure
}

interface VerdictResult {
  status: string;
  statusClass: string;
  panelClass: string;
  headline: string;
  stats: Array<{ label: string; value: string; highlight?: boolean }>;
  consequences: string[];
  beforeAfter?: {
    beforeLabel: string;
    beforeRows: Array<{ label: string; value: string }>;
    afterLabel: string;
    afterRows: Array<{ label: string; value: string }>;
  };
  confidence: ConfidenceLevel;
  confidenceNote: string;
  tier: Tier;
  ctaLabel: string;
  altTierLabel: string;
  productKey67: string;
  productKey147: string;
  result: DividendResult;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — HMRC 2025-26, ITA 2007 / ITTOIA 2005
// ─────────────────────────────────────────────────────────────────────────────

const PERSONAL_ALLOWANCE = 12570;
const BASIC_RATE_UPPER = 50270;
const ADDITIONAL_RATE_THRESHOLD = 125140;
const DIVIDEND_ALLOWANCE_CURRENT = 500;
const DIVIDEND_ALLOWANCE_2017 = 5000;

const DIV_RATE_BASIC = 0.0875;
const DIV_RATE_HIGHER = 0.3375;
const DIV_RATE_ADDITIONAL = 0.3935;

const SALARY_MAP: Record<string, number> = {
  under_12570:     10000,
  "12570_to_25k":  16000,
  "25k_to_50270":  35000,
  over_50270:      60000,
};

const DIVIDENDS_MAP: Record<string, number> = {
  under_500:        250,
  "500_to_5k":      2500,
  "5k_to_25k":      15000,
  over_25k:         40000,
};

const OTHER_INCOME_MAP: Record<string, number> = {
  none:      0,
  under_5k:  2500,
  over_5k:   8000,
};

const PRODUCT_KEYS = {
  p67:  "uk_67_dividend_trap",
  p147: "uk_147_dividend_trap",
};

function formatGBP(n: number): string {
  return "£" + Math.round(n).toLocaleString("en-GB");
}

// ─────────────────────────────────────────────────────────────────────────────
// CALC ENGINE — UK dividend tax stacking
// ─────────────────────────────────────────────────────────────────────────────

function calcDividend(answers: AnswerMap): DividendResult {
  const salary       = SALARY_MAP[String(answers.salary_band || "12570_to_25k")] ?? 16000;
  const dividends    = DIVIDENDS_MAP[String(answers.dividends_band || "5k_to_25k")] ?? 15000;
  const otherIncome  = OTHER_INCOME_MAP[String(answers.other_income || "none")] ?? 0;

  const totalIncome = salary + dividends + otherIncome;
  const nonDividendIncome = salary + otherIncome;

  // Dividends stack on top — their "position" on the income scale starts where non-dividend ends
  const dividendStartsAt = nonDividendIncome;
  const dividendEndsAt = totalIncome;

  // Band boundaries on total-income scale: PA £12,570, basic £50,270, additional £125,140
  // Portion of dividend in each zone:
  const dividendInAllowanceZone = Math.max(0, Math.min(dividendEndsAt, PERSONAL_ALLOWANCE) - dividendStartsAt);
  const dividendInBasic        = Math.max(0, Math.min(dividendEndsAt, BASIC_RATE_UPPER) - Math.max(dividendStartsAt, PERSONAL_ALLOWANCE));
  const dividendInHigher       = Math.max(0, Math.min(dividendEndsAt, ADDITIONAL_RATE_THRESHOLD) - Math.max(dividendStartsAt, BASIC_RATE_UPPER));
  const dividendInAdditional   = Math.max(0, dividendEndsAt - Math.max(dividendStartsAt, ADDITIONAL_RATE_THRESHOLD));

  // Dividend allowance (£500) applied to lowest taxable band first (basic, then higher, then additional)
  let remainingAllowance = DIVIDEND_ALLOWANCE_CURRENT;
  const basicAfterAllowance = Math.max(0, dividendInBasic - Math.min(remainingAllowance, dividendInBasic));
  remainingAllowance = Math.max(0, remainingAllowance - dividendInBasic);
  const higherAfterAllowance = Math.max(0, dividendInHigher - Math.min(remainingAllowance, dividendInHigher));
  remainingAllowance = Math.max(0, remainingAllowance - dividendInHigher);
  const additionalAfterAllowance = Math.max(0, dividendInAdditional - Math.min(remainingAllowance, dividendInAdditional));

  const taxBasic      = basicAfterAllowance      * DIV_RATE_BASIC;
  const taxHigher     = higherAfterAllowance     * DIV_RATE_HIGHER;
  const taxAdditional = additionalAfterAllowance * DIV_RATE_ADDITIONAL;
  const totalDividendTax = taxBasic + taxHigher + taxAdditional;

  const effectiveDividendRate = dividends > 0 ? totalDividendTax / dividends : 0;

  const crossesHigherRate = dividendInHigher > 0 || dividendInAdditional > 0;
  const crossesAdditionalRate = dividendInAdditional > 0;

  // Excess above higher rate — what would move from 33.75% to 8.75% if deferred
  const excessAboveHigher = dividendInHigher + dividendInAdditional;
  // Saving "this year" if that amount was deferred (full higher rate tax not incurred)
  // Rate differential for permanent saving analysis
  const higherRateSaving = dividendInHigher * (DIV_RATE_HIGHER - DIV_RATE_BASIC) +
                           dividendInAdditional * (DIV_RATE_ADDITIONAL - DIV_RATE_BASIC);
  const totalHigherRateTax = taxHigher + taxAdditional;

  return {
    salary,
    dividends,
    otherIncome,
    totalIncome,
    nonDividendIncome,
    dividendInAllowanceZone,
    dividendInBasic,
    dividendInHigher,
    dividendInAdditional,
    basicAfterAllowance,
    higherAfterAllowance,
    additionalAfterAllowance,
    taxBasic,
    taxHigher,
    taxAdditional,
    totalDividendTax,
    effectiveDividendRate,
    crossesHigherRate,
    crossesAdditionalRate,
    excessAboveHigher,
    higherRateSaving,
    totalHigherRateTax,
    dividendAllowanceCurrent: DIVIDEND_ALLOWANCE_CURRENT,
    dividendAllowancePrior: DIVIDEND_ALLOWANCE_2017,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcDividend(answers);

  // ── BELOW ALLOWANCE — £500 or less, no tax ────────────────────────────────
  if (result.dividends <= DIVIDEND_ALLOWANCE_CURRENT) {
    return {
      status: "WITHIN DIVIDEND ALLOWANCE — NO DIVIDEND TAX",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your ${formatGBP(result.dividends)} of dividends is within the £500 dividend allowance, so no dividend tax applies this year. Worth knowing: the allowance has been cut from £5,000 (2017-18) to £500 (2024-25 onwards), so if your dividends grow, the tax hits fast.`,
      stats: [
        { label: "Dividends", value: formatGBP(result.dividends) },
        { label: "Dividend allowance", value: formatGBP(DIVIDEND_ALLOWANCE_CURRENT) },
        { label: "Dividend tax", value: "£0" },
      ],
      consequences: [
        `Your ${formatGBP(result.dividends)} of dividends sits entirely within the £500 dividend allowance (2024-25). No dividend tax owed.`,
        "Worth noting: the dividend allowance was £5,000 in 2017-18. It has been cut progressively — £2,000 (2018-22), £1,000 (2023-24), £500 (2024-25 onwards). A shareholder taking £5,000 of dividends today pays tax on £4,500 of it, when in 2017-18 the same dividend was fully tax-free.",
        "If your dividends grow above £500: at basic rate (8.75%) the tax is modest. At higher rate (33.75% once total income crosses £50,270) it is substantial. Model the full picture before increasing dividend draws.",
        "For company directors: if your salary is under the personal allowance (£12,570), there is headroom to take more salary or dividends before triggering income tax. Don't leave the basic rate band empty if cash flow permits.",
        "Still declare the dividend on your Self Assessment return if you file one — the allowance covers the tax, not the disclosure obligation.",
      ],
      confidence: "HIGH",
      confidenceNote: "Dividend allowance of £500 is confirmed for 2024-25 onwards under Finance Act 2024. Below allowance = no tax liability.",
      tier: 67,
      ctaLabel: "Show My Position — £67 →",
      altTierLabel: "Want the full salary/dividend plan? — £147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── ADDITIONAL RATE — total over £125,140 ─────────────────────────────────
  if (result.crossesAdditionalRate) {
    return {
      status: "ADDITIONAL RATE EXPOSURE — DIVIDENDS AT 39.35%",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Your total income of ${formatGBP(result.totalIncome)} crosses into additional rate (£125,140). ${formatGBP(result.dividendInAdditional)} of dividends is taxed at 39.35%. Total dividend tax across all bands: ${formatGBP(result.totalDividendTax)} — an effective rate of ${(result.effectiveDividendRate * 100).toFixed(1)}% on your ${formatGBP(result.dividends)} of dividends.`,
      stats: [
        { label: "Total income", value: formatGBP(result.totalIncome), highlight: true },
        { label: "Dividend tax (all bands)", value: formatGBP(result.totalDividendTax), highlight: true },
        { label: "Effective rate", value: `${(result.effectiveDividendRate * 100).toFixed(1)}%`, highlight: true },
      ],
      consequences: [
        `🔒 Additional rate territory: ${formatGBP(result.dividendInAdditional)} of dividends taxed at 39.35% = ${formatGBP(result.taxAdditional)}.`,
        `🔒 Higher rate portion: ${formatGBP(result.dividendInHigher)} at 33.75% = ${formatGBP(result.taxHigher)}.`,
        `Basic rate portion: ${formatGBP(result.basicAfterAllowance)} at 8.75% = ${formatGBP(result.taxBasic)} (after £500 allowance applied to lowest band).`,
        `⚠ The £100k–£125,140 personal allowance trap also applies — your allowance is fully withdrawn. Check our separate 60% Tax Trap Engine for that specific exposure.`,
        `Optimisation for your level: pension contributions to bring adjusted net income below £100,000 (restores allowance + reduces dividend tax). Multi-year dividend sequencing. Spousal dividend splitting if available.`,
        `Restructure saving estimate (rate differential if excess ${formatGBP(result.excessAboveHigher)} deferred or avoided): ${formatGBP(result.higherRateSaving)} per year of permanent saving.`,
      ],
      beforeAfter: {
        beforeLabel: `Without optimisation — ${formatGBP(result.salary)} salary + ${formatGBP(result.dividends)} dividends`,
        beforeRows: [
          { label: "Total income", value: formatGBP(result.totalIncome) },
          { label: "Dividend in basic rate", value: formatGBP(result.basicAfterAllowance) + " @ 8.75%" },
          { label: "Dividend in higher rate", value: formatGBP(result.higherAfterAllowance) + " @ 33.75%" },
          { label: "Dividend in additional rate", value: formatGBP(result.additionalAfterAllowance) + " @ 39.35%" },
          { label: "Total dividend tax", value: formatGBP(result.totalDividendTax) },
        ],
        afterLabel: `With restructure — defer ${formatGBP(result.excessAboveHigher)} to basic rate`,
        afterRows: [
          { label: "New total income", value: formatGBP(result.totalIncome - result.excessAboveHigher) },
          { label: "All dividends in basic rate", value: "8.75% on " + formatGBP(result.dividends - result.excessAboveHigher - DIVIDEND_ALLOWANCE_CURRENT) },
          { label: "New total dividend tax", value: formatGBP((result.dividends - result.excessAboveHigher - DIVIDEND_ALLOWANCE_CURRENT) * DIV_RATE_BASIC) },
          { label: "Permanent rate-differential saving", value: formatGBP(result.higherRateSaving) + " / year" },
        ],
      },
      confidence: "HIGH",
      confidenceNote: "Dividend tax rates and band thresholds are statutory under ITA 2007 and ITTOIA 2005. Confirmed for 2025-26 tax year.",
      tier: 147,
      ctaLabel: "Get My Full Dividend Optimisation Plan — £147 →",
      altTierLabel: "Just want the audit? — £67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── HIGHER RATE — total between £50,270 and £125,140 ──────────────────────
  if (result.crossesHigherRate) {
    return {
      status: "HIGHER RATE EXPOSURE — DIVIDENDS AT 33.75%",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Your total income of ${formatGBP(result.totalIncome)} crosses the higher rate threshold (£50,270). ${formatGBP(result.dividendInHigher)} of dividends is taxed at 33.75% — approximately ${formatGBP(result.taxHigher)}. Restructuring to keep dividends within the basic rate band saves ${formatGBP(result.higherRateSaving)} per year in rate differential.`,
      stats: [
        { label: "Total income", value: formatGBP(result.totalIncome), highlight: true },
        { label: "Dividend tax total", value: formatGBP(result.totalDividendTax), highlight: true },
        { label: "Higher rate tax on dividends", value: formatGBP(result.taxHigher), highlight: true },
      ],
      consequences: [
        `🔒 ${formatGBP(result.dividendInHigher)} of your dividends sits in the higher rate band (above £50,270 total income). Tax on that portion: ${formatGBP(result.taxHigher)} at 33.75% — an extra ${formatGBP(result.higherRateSaving)} compared to if the same amount were in basic rate.`,
        `Basic rate portion: ${formatGBP(result.basicAfterAllowance)} taxed at 8.75% = ${formatGBP(result.taxBasic)} (after £500 allowance).`,
        `On the ${formatGBP(result.excessAboveHigher)} of dividends above the higher rate threshold: 33.75p lost to tax for every £1, vs 8.75p if kept in basic rate. A 25 percentage-point difference.`,
        `🔓 FIX: restructure the split so all dividends stay within the basic rate band. Techniques: (a) defer the excess ${formatGBP(result.excessAboveHigher)} to next tax year if you can afford the cashflow, (b) pension contribution reducing adjusted net income, (c) spousal dividend splitting if your spouse has basic rate band capacity, (d) retained earnings inside the company at corporation tax (~25%) instead of distributing.`,
        `The £500 dividend allowance is applied to the lowest band first (basic rate here) — its value is only £44 (£500 × 8.75%) at basic rate vs £169 (£500 × 33.75%) at higher rate. So it's helping least where you need it most.`,
        `Annual review matters: the dividend allowance was £5,000 in 2017-18. It's £500 now. If your accountant set up your split in 2017, it's almost certainly out of date.`,
      ],
      beforeAfter: {
        beforeLabel: `Current split — ${formatGBP(result.salary)} salary + ${formatGBP(result.dividends)} dividends`,
        beforeRows: [
          { label: "Total income", value: formatGBP(result.totalIncome) },
          { label: "Dividend in basic rate", value: formatGBP(result.basicAfterAllowance) + " @ 8.75%" },
          { label: "Tax on basic rate portion", value: formatGBP(result.taxBasic) },
          { label: "Dividend in higher rate", value: formatGBP(result.higherAfterAllowance) + " @ 33.75%" },
          { label: "Tax on higher rate portion", value: formatGBP(result.taxHigher) },
          { label: "Total dividend tax", value: formatGBP(result.totalDividendTax) },
        ],
        afterLabel: `Restructure — defer ${formatGBP(result.excessAboveHigher)} to next year`,
        afterRows: [
          { label: "This year's total income", value: formatGBP(result.totalIncome - result.excessAboveHigher) },
          { label: "All dividends in basic rate", value: "8.75% on " + formatGBP(result.dividends - result.excessAboveHigher - DIVIDEND_ALLOWANCE_CURRENT) },
          { label: "This year's dividend tax", value: formatGBP((result.dividends - result.excessAboveHigher - DIVIDEND_ALLOWANCE_CURRENT) * DIV_RATE_BASIC) },
          { label: "Higher rate tax avoided this year", value: formatGBP(result.totalHigherRateTax) },
          { label: "Permanent rate-differential saving", value: formatGBP(result.higherRateSaving) + " / year" },
        ],
      },
      confidence: "HIGH",
      confidenceNote: "Dividend tax rates and £50,270 higher rate threshold are statutory for 2025-26. Dividends stack at the top of total income.",
      tier: 147,
      ctaLabel: "Get My Restructure Plan — £147 →",
      altTierLabel: "Just want the audit? — £67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── BASIC RATE — all dividends within basic rate band ────────────────────
  return {
    status: "ALL DIVIDENDS IN BASIC RATE — OPTIMISATION AVAILABLE",
    statusClass: "text-emerald-700",
    panelClass: "border-emerald-200 bg-emerald-50",
    headline: `Your ${formatGBP(result.dividends)} of dividends sits entirely within the basic rate band. Tax at 8.75%: ${formatGBP(result.taxBasic)} on the taxable portion (after £500 allowance). Total income ${formatGBP(result.totalIncome)} — comfortably under the £50,270 higher rate threshold.`,
    stats: [
      { label: "Total income", value: formatGBP(result.totalIncome) },
      { label: "Dividend tax", value: formatGBP(result.totalDividendTax) },
      { label: "Effective rate", value: `${(result.effectiveDividendRate * 100).toFixed(1)}%` },
    ],
    consequences: [
      `All ${formatGBP(result.dividends)} of your dividends sits within the basic rate band (under £50,270 total income). Tax at 8.75% on the taxable portion (£${Math.round(result.basicAfterAllowance).toLocaleString("en-GB")}) = ${formatGBP(result.taxBasic)}.`,
      `The £500 dividend allowance absorbed the first £500 at 0%. Taxable dividend: ${formatGBP(result.basicAfterAllowance)}.`,
      `Room to take MORE dividends before hitting the higher rate: ${formatGBP(BASIC_RATE_UPPER - result.totalIncome)}. At 8.75% these would be taxed meaningfully less than if deferred and taken in a future higher-rate year.`,
      `If salary is under £12,570: you're using the personal allowance efficiently. Some directors deliberately take salary to the NI threshold (~£9,100) to save employer NI, then dividends for everything else. Check if your salary structure is optimal.`,
      `Annual allowance reminder: the £500 dividend allowance was £5,000 in 2017-18. If your overall income strategy was set then, review it now — the tax landscape has shifted.`,
      `Optimisation opportunity: if you expect dividends to grow into higher rate territory in future years, consider taking more NOW at 8.75% rather than next year at 33.75% (subject to company cashflow and reserves).`,
    ],
    confidence: "HIGH",
    confidenceNote: "Dividend tax rates and band thresholds confirmed for 2025-26 under ITA 2007.",
    tier: 67,
    ctaLabel: "Show My Optimisation Review — £67 →",
    altTierLabel: "Want the full restructure plan too? — £147",
    productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
    result,
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
    id: "salary_band", step: 1, type: "button_group",
    label: "What is your annual salary (PAYE from your company)?",
    subLabel: "The salary determines how much of the personal allowance and basic rate band is used before dividends stack on top.",
    options: [
      { label: "Under £12,570",       value: "under_12570",   subLabel: "Below personal allowance — no income tax on salary" },
      { label: "£12,570–£25,000",      value: "12570_to_25k", subLabel: "Personal allowance used + some basic rate" },
      { label: "£25,000–£50,270",      value: "25k_to_50270", subLabel: "Fills most of basic rate band" },
      { label: "Over £50,270",         value: "over_50270",   subLabel: "Salary alone already in higher rate" },
    ],
    required: true,
  },
  {
    id: "dividends_band", step: 2, type: "button_group",
    label: "Total dividends taken this tax year (including any drawn from your company)?",
    subLabel: "Dividends stack ON TOP of salary + other income. Each £ above £50,270 total is taxed at 33.75%, not 8.75%.",
    options: [
      { label: "Under £500",             value: "under_500",   subLabel: "Within dividend allowance — no tax" },
      { label: "£500–£5,000",             value: "500_to_5k",  subLabel: "Typical small director dividend" },
      { label: "£5,000–£25,000",           value: "5k_to_25k", subLabel: "Substantial — rate depends on total" },
      { label: "Over £25,000",             value: "over_25k",   subLabel: "Likely crossing higher rate threshold" },
    ],
    required: true,
  },
  {
    id: "other_income", step: 3, type: "button_group",
    label: "Any other income this year (rental, freelance, savings interest)?",
    subLabel: "Other income adds to the stack — pushes dividends into higher bands faster.",
    options: [
      { label: "None",          value: "none",     subLabel: "Clean salary + dividend structure" },
      { label: "Under £5,000",  value: "under_5k", subLabel: "Modest — small impact on band position" },
      { label: "Over £5,000",   value: "over_5k",  subLabel: "Meaningful — pushes dividends up bands" },
    ],
    required: true,
  },
  {
    id: "modelling_status", step: 4, type: "button_group",
    label: "Do you know which tax band your dividends fall into?",
    subLabel: "Most directors assume dividends are taxed separately from salary. They are not — they stack.",
    options: [
      { label: "Yes — I have modelled this",                               value: "yes_modelled",        subLabel: "You're ahead of most directors" },
      { label: "No — I assumed they are taxed separately from salary",      value: "no_assumed_separate",  subLabel: "Most common misconception" },
      { label: "My accountant handles it — I am not sure",                  value: "accountant_unknown",   subLabel: "Review the split annually" },
    ],
    required: true,
  },
];

const TOTAL_STEPS = 4;

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

      {/* Dividend stacking breakdown */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">The stacking math — your dividends by tax band</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Salary</span>
            <span className="font-mono font-bold text-neutral-950">{formatGBP(verdict.result.salary)}</span>
          </div>
          {verdict.result.otherIncome > 0 && (
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Other income (rental, freelance, interest)</span>
              <span className="font-mono text-neutral-950">{formatGBP(verdict.result.otherIncome)}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Dividends</span>
            <span className="font-mono text-neutral-950">{formatGBP(verdict.result.dividends)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Total income</span>
            <span className="font-mono font-bold text-neutral-950">{formatGBP(verdict.result.totalIncome)}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-neutral-200">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Dividend portions by band</p>
          </div>
          {verdict.result.dividendInAllowanceZone > 0 && (
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">In personal allowance zone (0%)</span>
              <span className="font-mono text-emerald-700">{formatGBP(verdict.result.dividendInAllowanceZone)}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Dividend allowance (£500 @ 0%)</span>
            <span className="font-mono text-emerald-700">{formatGBP(Math.min(verdict.result.dividends, DIVIDEND_ALLOWANCE_CURRENT))}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Basic rate band (8.75%)</span>
            <span className="font-mono text-neutral-950">{formatGBP(verdict.result.basicAfterAllowance)} → {formatGBP(verdict.result.taxBasic)}</span>
          </div>
          {verdict.result.higherAfterAllowance > 0 && (
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Higher rate band (33.75%)</span>
              <span className="font-mono font-bold text-red-700">{formatGBP(verdict.result.higherAfterAllowance)} → {formatGBP(verdict.result.taxHigher)}</span>
            </div>
          )}
          {verdict.result.additionalAfterAllowance > 0 && (
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Additional rate band (39.35%)</span>
              <span className="font-mono font-bold text-red-700">{formatGBP(verdict.result.additionalAfterAllowance)} → {formatGBP(verdict.result.taxAdditional)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1">
            <span className="font-semibold text-neutral-800">Total dividend tax</span>
            <span className="font-mono font-bold text-red-700">{formatGBP(verdict.result.totalDividendTax)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-neutral-800">Effective rate on dividends</span>
            <span className="font-mono font-bold text-neutral-950">{(verdict.result.effectiveDividendRate * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Before / After block */}
      {verdict.beforeAfter && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-red-700">Before — current split</p>
            <p className="mb-2 text-sm font-bold text-red-900">{verdict.beforeAfter.beforeLabel}</p>
            <div className="space-y-1 text-xs">
              {verdict.beforeAfter.beforeRows.map(r => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-red-800">{r.label}</span>
                  <span className="font-mono font-bold text-red-900">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">After — restructure</p>
            <p className="mb-2 text-sm font-bold text-emerald-900">{verdict.beforeAfter.afterLabel}</p>
            <div className="space-y-1 text-xs">
              {verdict.beforeAfter.afterRows.map(r => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-emerald-800">{r.label}</span>
                  <span className="font-mono font-bold text-emerald-900">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fear framing */}
      {verdict.result.crossesHigherRate && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ The cost of dividends crossing into higher rate</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-1">
            33.75p lost to tax for every £1 of dividend above £50,270 — vs 8.75p if kept in basic rate.
          </p>
          <p className="text-xs text-red-800 leading-relaxed">
            On your {formatGBP(verdict.result.excessAboveHigher)} of dividends above the higher rate threshold: {formatGBP(verdict.result.totalHigherRateTax)} in tax this year at higher rate. Rate-differential saving if restructured to stay in basic rate: {formatGBP(verdict.result.higherRateSaving)}/year. The dividend allowance has dropped from £5,000 (2017-18) to £500 (2024-25). Most directors haven&apos;t recalculated.
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
          <strong className="text-neutral-950">Dividends stack — they do not have their own tax band.</strong> They sit at the top of your income. Every £ above £50,270 total is taxed at 33.75%, not 8.75%. And the dividend allowance was £5,000 in 2017-18 — it&apos;s £500 now. If your split was set up years ago, it&apos;s almost certainly out of date.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your exact tax by band — dividend portion in basic, higher, additional</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Optimal salary / dividend split for your situation</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Restructure options: deferral, pension, spousal splitting, retained earnings</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Multi-year dividend sequencing plan</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 accountant questions written for your income band and structure</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">£{verdict.tier} · One-time · Built around your salary + dividend + other income stack</p>
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

export default function DividendTrapCalculator() {
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
        product_slug: "dividend-trap",
        source_path: "/uk/check/dividend-trap",
        country_code: "UK", currency_code: "GBP", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          total_income: verdict.result.totalIncome,
          dividend_tax_total: verdict.result.totalDividendTax,
          effective_rate: verdict.result.effectiveDividendRate,
          crosses_higher: verdict.result.crossesHigherRate,
          excess_above_higher: verdict.result.excessAboveHigher,
          higher_rate_saving: verdict.result.higherRateSaving,
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
      body: JSON.stringify({ email, source: "dividend_trap", country_code: "UK", site: "taxchecknow" }),
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
    const sid = sessionId || `div_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("dividend-trap_salary_band", String(answers.salary_band || ""));
    sessionStorage.setItem("dividend-trap_dividends_band", String(answers.dividends_band || ""));
    sessionStorage.setItem("dividend-trap_other_income", String(answers.other_income || ""));
    sessionStorage.setItem("dividend-trap_modelling_status", String(answers.modelling_status || ""));
    sessionStorage.setItem("dividend-trap_total_income", String(Math.round(verdict.result.totalIncome)));
    sessionStorage.setItem("dividend-trap_dividend_tax_total", String(Math.round(verdict.result.totalDividendTax)));
    sessionStorage.setItem("dividend-trap_excess_above_higher", String(Math.round(verdict.result.excessAboveHigher)));
    sessionStorage.setItem("dividend-trap_higher_rate_saving", String(Math.round(verdict.result.higherRateSaving)));
    sessionStorage.setItem("dividend-trap_status", verdict.status);
    sessionStorage.setItem("dividend-trap_tier", String(popupTier));

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
          success_url: `${window.location.origin}/uk/check/dividend-trap/success/${successPath}`,
          cancel_url: `${window.location.origin}/uk/check/dividend-trap`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your dividend tax breakdown and restructure options.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your position by email — free.</p>
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
                    {popupTier === 67 ? "Your Dividend Audit Pack" : "Your Dividend Restructure Plan"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">HMRC-referenced · ITTOIA 2005 · ITA 2007 · April 2026</p>
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
                      {popupTier === 67 ? "Dividend Audit Pack™" : "Dividend Restructure Plan™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your exact dividend tax by band, optimal salary/dividend split recommendation, restructure options, and 5 accountant questions — built for your salary + dividend + other income position."
                        : "Full restructure plan: multi-year dividend sequencing, spousal splitting analysis, pension contribution modelling, retained earnings vs distribution trade-off, and accountant coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">£{popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic dividend advice. Your specific stack and restructure math.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Audit →" : "Get My Restructure Plan →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the audit? — £67 instead" : "Want the full restructure plan? — £147 instead"}
                    </button>
                  </p>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">3 quick questions then pay</p>
                    <p className="font-serif text-lg font-bold text-neutral-950">£{popupTier}</p>
                  </div>
                  {[
                    { label: "Business type", key: "entity_type", options: [["single_director","Single-director limited company"],["family_company","Family-owned company (multiple shareholders)"],["partner","Partner in LLP"],["other","Other company structure"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["acting_now","Acting before 5 April 2027 year-end"],["planning","Planning 6+ months out"],["just_checking","Just checking my position"]] },
                    { label: "Do you have an accountant?", key: "accountant", options: [["accountant","Yes — accountant"],["adviser","Yes — financial adviser"],["both","Both"],["no","No — managing myself"]] },
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
                    {loading ? "Redirecting to Stripe…" : `Pay £${popupTier} →`}
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · HMRC-sourced content</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile sticky bar */}
      {showVerdict && verdict && verdict.result.crossesHigherRate && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Higher rate tax on dividends</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatGBP(verdict.result.totalHigherRateTax)} — restructure saves {formatGBP(verdict.result.higherRateSaving)}/yr
              </p>
            </div>
            <button onClick={() => openPopup(verdict.tier)}
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white whitespace-nowrap">
              From £67 →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
