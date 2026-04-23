"use client";

/**
 * UK-02 — 60% Tax Trap Engine (formerly Allowance Sniper)
 * Pattern: F (CashflowModel — £ saved / £ lost) + G (ThresholdTest — £100k/£125,140 bands)
 *
 * Core question: How much is the 60% personal allowance taper costing this taxpayer,
 * and what pension contribution restores the allowance?
 *
 * Key facts (HMRC confirmed April 2026):
 *   Personal allowance 2025-26: £12,570
 *   Allowance taper starts at £100,000 adjusted net income
 *   Taper rate: £1 allowance withdrawn for every £2 earned above £100,000
 *   Allowance fully gone at £125,140 (= £100,000 + 2 × £12,570)
 *   Effective marginal tax rate in trap band: 60%
 *     (40% higher-rate income tax + 20% effective allowance withdrawal cost)
 *   Pension / salary sacrifice reduces adjusted net income → restores allowance £1 for every £2
 *   Legal anchor: Income Tax Act 2007 section 35
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;

interface TrapResult {
  grossIncome: number;
  currentPension: number;
  adjustedNetIncome: number;
  inTrap: boolean;
  pastTrap: boolean;
  allowanceLost: number;
  trapBandIncome: number;
  trapTax: number;
  trapKeep: number;
  taxOnLast10k: number;
  keepOfLast10k: number;
  pensionNeededToEscape: number;
  pensionTaxSaving: number;
  pensionNetCost: number;
  annualTrapSurcharge: number;
  hasSalarySacrifice: boolean;
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
  result: TrapResult;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — HMRC 2025-26, Income Tax Act 2007 s35
// ─────────────────────────────────────────────────────────────────────────────

const PERSONAL_ALLOWANCE = 12570;
const TRAP_START = 100000;
const TRAP_END = 125140;
const HIGHER_RATE_TAX = 0.40;
const PENSION_RELIEF_RATE = 0.40;
const TRAP_MARGINAL_RATE = 0.60;

const INCOME_MAP: Record<string, number> = {
  under_100k:  85000,
  "100k_110k": 105000,
  "110k_120k": 115000,
  "120k_125k": 122500,
  over_125k:   145000,
};

const PENSION_MAP: Record<string, number> = {
  none:        0,
  under_5k:    2500,
  "5k_10k":    7500,
  over_10k:    15000,
};

const PRODUCT_KEYS = {
  p67:  "uk_67_allowance_sniper",
  p147: "uk_147_allowance_sniper",
};

function formatGBP(n: number): string {
  return "£" + Math.round(n).toLocaleString("en-GB");
}

// ─────────────────────────────────────────────────────────────────────────────
// CALC ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcTrap(answers: AnswerMap): TrapResult {
  const grossIncome        = INCOME_MAP[String(answers.income_band || "110k_120k")] ?? 115000;
  const currentPension     = PENSION_MAP[String(answers.pension_contributions || "none")] ?? 0;
  const hasSalarySacrifice = answers.salary_sacrifice === "yes";

  const adjustedNetIncome = grossIncome - currentPension;
  const inTrap = adjustedNetIncome > TRAP_START && adjustedNetIncome <= TRAP_END;
  const pastTrap = adjustedNetIncome > TRAP_END;

  const allowanceLost = inTrap
    ? (adjustedNetIncome - TRAP_START) / 2
    : pastTrap
    ? PERSONAL_ALLOWANCE
    : 0;

  const trapBandIncome = Math.max(0, Math.min(adjustedNetIncome, TRAP_END) - TRAP_START);
  const trapTax  = trapBandIncome * TRAP_MARGINAL_RATE;
  const trapKeep = trapBandIncome * (1 - TRAP_MARGINAL_RATE);

  let taxOnLast10k = 0;
  if (pastTrap) {
    taxOnLast10k = 10000 * 0.45;
  } else if (inTrap && adjustedNetIncome - 10000 >= TRAP_START) {
    taxOnLast10k = 10000 * TRAP_MARGINAL_RATE;
  } else if (inTrap) {
    const portionInTrap = adjustedNetIncome - TRAP_START;
    taxOnLast10k = portionInTrap * TRAP_MARGINAL_RATE + (10000 - portionInTrap) * HIGHER_RATE_TAX;
  } else {
    taxOnLast10k = 10000 * HIGHER_RATE_TAX;
  }
  const keepOfLast10k = 10000 - taxOnLast10k;

  const pensionNeededToEscape = Math.max(0, adjustedNetIncome - TRAP_START);
  const pensionTaxSaving = pensionNeededToEscape * PENSION_RELIEF_RATE;
  const pensionNetCost = pensionNeededToEscape - pensionTaxSaving;

  const annualTrapSurcharge = trapBandIncome * (TRAP_MARGINAL_RATE - HIGHER_RATE_TAX);

  return {
    grossIncome,
    currentPension,
    adjustedNetIncome,
    inTrap,
    pastTrap,
    allowanceLost,
    trapBandIncome,
    trapTax,
    trapKeep,
    taxOnLast10k,
    keepOfLast10k,
    pensionNeededToEscape,
    pensionTaxSaving,
    pensionNetCost,
    annualTrapSurcharge,
    hasSalarySacrifice,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcTrap(answers);

  // NOT IN TRAP
  if (!result.inTrap && !result.pastTrap) {
    return {
      status: "NOT IN THE 60% TRAP — BUT WORTH UNDERSTANDING",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your adjusted net income of ${formatGBP(result.adjustedNetIncome)} is below the £100,000 threshold, so the personal allowance taper does not currently apply to you. The 60% effective marginal rate hits anyone earning between £100,000 and £125,140 — bonuses and side-income growth can push you into it fast.`,
      stats: [
        { label: "Your band", value: "Under £100k" },
        { label: "Your effective rate", value: "Up to 40%" },
        { label: "Trap risk", value: result.grossIncome > 90000 ? "Close to threshold" : "Low" },
      ],
      consequences: [
        `Your adjusted net income is ${formatGBP(result.adjustedNetIncome)} — below the £100,000 allowance taper threshold.`,
        "You currently receive the full £12,570 personal allowance and face a standard marginal rate of 20% (basic rate) or 40% (higher rate) depending on your band.",
        "Risk to watch: bonus, consulting income, rental, or salary raises that push you across £100,000. A £5,000 bonus at £98,000 income adds you partially into the 60% trap. Track your full-year income, not just base salary.",
        "If you anticipate crossing £100,000 this year: a pension contribution or salary sacrifice in the final quarter can keep adjusted net income below the threshold and preserve the full allowance.",
      ],
      confidence: "HIGH",
      confidenceNote: "Personal allowance taper confirmed under Income Tax Act 2007 section 35. Threshold of £100,000 is statutory.",
      tier: 67,
      ctaLabel: "Show My Tax Position — £67 →",
      altTierLabel: "Want the full trap playbook too? — £147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // PAST TRAP — over £125,140
  if (result.pastTrap) {
    return {
      status: "PAST THE TRAP — ALLOWANCE FULLY LOST",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Your adjusted net income of ${formatGBP(result.adjustedNetIncome)} is above £125,140 — your personal allowance is fully withdrawn. You are now in the additional rate band (45%), but a pension contribution of ${formatGBP(result.pensionNeededToEscape)} could bring you back to £100,000 and restore the full £12,570 allowance.`,
      stats: [
        { label: "Adjusted net income", value: formatGBP(result.adjustedNetIncome), highlight: true },
        { label: "Allowance lost", value: formatGBP(result.allowanceLost), highlight: true },
        { label: "Pension to fully restore", value: formatGBP(result.pensionNeededToEscape), highlight: true },
      ],
      consequences: [
        `🔒 Your personal allowance is fully gone. You pay income tax from the first £1 earned. On a £${Math.round(result.adjustedNetIncome / 1000)}k income, that's ~${formatGBP(result.allowanceLost * HIGHER_RATE_TAX)} of tax you would not pay if your allowance were restored.`,
        `Above £125,140 your marginal rate is 45% (additional rate), not 60%. The trap itself is £100,000–£125,140 — you've cleared it but paid full price.`,
        `To restore the full personal allowance: pension contribution of ${formatGBP(result.pensionNeededToEscape)} reduces adjusted net income to £100,000. Tax relief on contribution: approximately ${formatGBP(result.pensionTaxSaving)}. Plus allowance restoration saves additional tax. Total saving on a £${Math.round(result.pensionNeededToEscape / 1000)}k contribution is typically meaningful — run your exact number with a pension specialist.`,
        `Salary sacrifice through employer (if offered) is even more efficient: reduces gross income, saves NI as well as income tax. Combined effective saving often exceeds 60% on contributions.`,
        `⚠ This window closes 5 April 2027 for the 2026-27 tax year. Missed contributions cannot be carried back — the allowance is lost for that year permanently.`,
      ],
      beforeAfter: {
        beforeLabel: `Without action at ${formatGBP(result.adjustedNetIncome)}`,
        beforeRows: [
          { label: "Allowance lost", value: formatGBP(PERSONAL_ALLOWANCE) + " (full)" },
          { label: "Extra tax from allowance withdrawal", value: formatGBP(PERSONAL_ALLOWANCE * HIGHER_RATE_TAX) },
          { label: "Effective rate on next £1 earned", value: "45% (additional rate)" },
        ],
        afterLabel: `With ${formatGBP(result.pensionNeededToEscape)} pension contribution`,
        afterRows: [
          { label: "Adjusted net income", value: formatGBP(TRAP_START) },
          { label: "Personal allowance", value: "£12,570 (fully restored)" },
          { label: "Pension tax relief", value: "~" + formatGBP(result.pensionTaxSaving) },
          { label: "Net cost of contribution", value: "~" + formatGBP(result.pensionNetCost) },
        ],
      },
      confidence: "HIGH",
      confidenceNote: "Personal allowance full withdrawal at £125,140 is statutory. Additional rate of 45% above £125,140 applies from 2023-24 onwards.",
      tier: 147,
      ctaLabel: "Get My 60% Escape Plan — £147 →",
      altTierLabel: "Just want the audit? — £67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // IN TRAP — early zone £100k-£110k
  if (result.adjustedNetIncome < 110000) {
    return {
      status: "IN THE 60% TRAP — EARLY ZONE (£100k-£110k)",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `You are paying 60% effective tax on every £1 of adjusted net income above £100,000 — currently about ${formatGBP(result.trapBandIncome)} exposed. A pension contribution of ${formatGBP(result.pensionNeededToEscape)} brings you back to £100,000 and restores the full personal allowance, saving approximately ${formatGBP(result.pensionTaxSaving)} in tax.`,
      stats: [
        { label: "In trap band", value: formatGBP(result.trapBandIncome), highlight: true },
        { label: "Tax on trap band (60%)", value: formatGBP(result.trapTax), highlight: true },
        { label: "You keep", value: formatGBP(result.trapKeep), highlight: true },
      ],
      consequences: [
        `🔒 On ${formatGBP(result.trapBandIncome)} of your income above £100,000, HMRC effectively takes 60%. That's ${formatGBP(result.trapTax)} in tax, leaving you with ${formatGBP(result.trapKeep)} from earnings that cost you significant effort and opportunity cost to generate.`,
        `Your personal allowance has been reduced from £12,570 to ${formatGBP(PERSONAL_ALLOWANCE - result.allowanceLost)} — that's ${formatGBP(result.allowanceLost)} of tax-free income forfeited. At 40% effective value, that's ~${formatGBP(result.allowanceLost * HIGHER_RATE_TAX)} of extra tax you pay for being in the trap.`,
        `The fix is simple: pension contribution of ${formatGBP(result.pensionNeededToEscape)} reduces adjusted net income to £100,000. Personal allowance is fully restored. Tax relief on contribution: approximately ${formatGBP(result.pensionTaxSaving)}. The allowance restoration adds more on top.`,
        `Salary sacrifice (if your employer offers it) is even better — saves NI as well as income tax. Combined effective saving often beats 60% on contributions.`,
        `Early-zone means you're close to the threshold — a modest contribution gets you out entirely. Don't wait until tax year end — spread the contribution across remaining pay periods.`,
      ],
      beforeAfter: {
        beforeLabel: `Without action at ${formatGBP(result.adjustedNetIncome)}`,
        beforeRows: [
          { label: "Income in 60% trap band", value: formatGBP(result.trapBandIncome) },
          { label: "Tax on trap band", value: formatGBP(result.trapTax) },
          { label: "Effective rate", value: "60% on trap band" },
        ],
        afterLabel: `With ${formatGBP(result.pensionNeededToEscape)} pension contribution`,
        afterRows: [
          { label: "Adjusted net income", value: formatGBP(TRAP_START) },
          { label: "Personal allowance", value: "£12,570 (fully restored)" },
          { label: "Tax relief on contribution", value: "~" + formatGBP(result.pensionTaxSaving) },
          { label: "Net cost of contribution", value: "~" + formatGBP(result.pensionNetCost) },
        ],
      },
      confidence: "HIGH",
      confidenceNote: "60% effective marginal rate in £100k-£125,140 band is arithmetic — 40% income tax plus 20% allowance withdrawal cost.",
      tier: result.hasSalarySacrifice ? 67 : 147,
      ctaLabel: result.hasSalarySacrifice ? "Get My Tax Escape Pack — £67 →" : "Get My 60% Escape Plan — £147 →",
      altTierLabel: result.hasSalarySacrifice ? "Want the full plan too? — £147" : "Just want the audit? — £67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // IN TRAP — deep zone £110k-£120k
  if (result.adjustedNetIncome < 120000) {
    return {
      status: "IN THE 60% TRAP — DEEP ZONE (£110k-£120k)",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `You are squarely in the 60% tax trap with ${formatGBP(result.trapBandIncome)} of income in the penalty zone. Tax on this band: ${formatGBP(result.trapTax)}. You keep only ${formatGBP(result.trapKeep)}. A pension contribution of ${formatGBP(result.pensionNeededToEscape)} restores the full allowance — saving approximately ${formatGBP(result.pensionTaxSaving)} in tax.`,
      stats: [
        { label: "In trap band", value: formatGBP(result.trapBandIncome), highlight: true },
        { label: "60% trap tax", value: formatGBP(result.trapTax), highlight: true },
        { label: "Pension to escape", value: formatGBP(result.pensionNeededToEscape), highlight: true },
      ],
      consequences: [
        `🔒 Deep in the trap: ${formatGBP(result.trapBandIncome)} of income taxed at 60% effective rate. ${formatGBP(result.trapTax)} paid in tax on that band — you keep ${formatGBP(result.trapKeep)}.`,
        `Personal allowance reduced by ${formatGBP(result.allowanceLost)} (half your income above £100k). That's ${formatGBP(result.allowanceLost)} of tax-free income you no longer get — costing you ~${formatGBP(result.allowanceLost * HIGHER_RATE_TAX)} additionally.`,
        `On the last £10,000 of income you earned: ${formatGBP(result.taxOnLast10k)} paid in tax, ${formatGBP(result.keepOfLast10k)} kept. 60p lost for every £1.`,
        `🔓 FIX: Pension contribution of ${formatGBP(result.pensionNeededToEscape)} brings adjusted net income back to £100,000. Tax saving on contribution (pension relief): ~${formatGBP(result.pensionTaxSaving)}. Additional saving from restored allowance: ~${formatGBP(result.allowanceLost * HIGHER_RATE_TAX)}. Combined effective saving often exceeds 60% of the contribution.`,
        `Salary sacrifice (employer-facilitated) beats personal pension contribution by adding NI savings: ~8-13% employee NI saved + employer NI often reinvested into the pot. Ask HR about the "pension exchange" option.`,
        result.currentPension > 0 ? `You're already contributing ${formatGBP(result.currentPension)} — a good start. Top up by ${formatGBP(Math.max(0, result.pensionNeededToEscape - result.currentPension))} more to fully escape the trap.` : `You're not contributing to pension currently — this is the single biggest tax lever available at your income level.`,
      ],
      beforeAfter: {
        beforeLabel: `Without action at ${formatGBP(result.adjustedNetIncome)}`,
        beforeRows: [
          { label: "Income in 60% trap band", value: formatGBP(result.trapBandIncome) },
          { label: "Tax on trap band", value: formatGBP(result.trapTax) },
          { label: "Allowance lost", value: formatGBP(result.allowanceLost) },
          { label: "Effective rate on last £10k", value: "60% — " + formatGBP(result.taxOnLast10k) + " tax" },
        ],
        afterLabel: `With ${formatGBP(result.pensionNeededToEscape)} pension contribution`,
        afterRows: [
          { label: "Adjusted net income", value: formatGBP(TRAP_START) },
          { label: "Personal allowance", value: "£12,570 (fully restored)" },
          { label: "Pension tax relief", value: "~" + formatGBP(result.pensionTaxSaving) },
          { label: "Additional allowance saving", value: "~" + formatGBP(result.allowanceLost * HIGHER_RATE_TAX) },
          { label: "Net cost of contribution", value: "~" + formatGBP(result.pensionNetCost) },
        ],
      },
      confidence: "HIGH",
      confidenceNote: "Personal allowance taper under Income Tax Act 2007 s35. 60% effective rate arises from 40% income tax + 20% allowance withdrawal cost.",
      tier: 147,
      ctaLabel: "Get My 60% Escape Plan — £147 →",
      altTierLabel: "Just want the audit? — £67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // IN TRAP — edge zone £120k-£125.14k
  return {
    status: "IN THE 60% TRAP — EDGE ZONE (£120k-£125,140)",
    statusClass: "text-red-700",
    panelClass: "border-red-200 bg-red-50",
    headline: `You're in the final stretch of the 60% trap — adjusted net income ${formatGBP(result.adjustedNetIncome)}, allowance reduced to ${formatGBP(PERSONAL_ALLOWANCE - result.allowanceLost)}. Contribution of ${formatGBP(result.pensionNeededToEscape)} restores the full allowance and avoids crossing into the additional rate band at £125,140.`,
    stats: [
      { label: "Adjusted net income", value: formatGBP(result.adjustedNetIncome), highlight: true },
      { label: "Allowance remaining", value: formatGBP(PERSONAL_ALLOWANCE - result.allowanceLost), highlight: true },
      { label: "Pension to fully restore", value: formatGBP(result.pensionNeededToEscape), highlight: true },
    ],
    consequences: [
      `🔒 You're at the top edge of the 60% trap — almost all of your £12,570 personal allowance has been withdrawn (${formatGBP(result.allowanceLost)} gone). Remaining allowance: ${formatGBP(PERSONAL_ALLOWANCE - result.allowanceLost)}.`,
      `${formatGBP(result.trapBandIncome)} of your income sits in the 60% effective rate band. Tax on that: ${formatGBP(result.trapTax)}.`,
      `⚠ Every additional £1 earned now takes you closer to the additional rate threshold (£125,140). Above £125,140 the allowance is fully gone and the marginal rate drops to 45% — but that's a worse overall position because you've fully lost the £12,570 tax-free band.`,
      `🔓 Pension contribution of ${formatGBP(result.pensionNeededToEscape)} brings adjusted net income back to £100,000. Full allowance restored (£12,570). Total tax saving typically ~${formatGBP(result.pensionTaxSaving)} in pension relief plus ~${formatGBP(result.allowanceLost * HIGHER_RATE_TAX)} from restored allowance.`,
      `At this income level, maximising pension contributions is near-certainly the best available UK tax lever. Consider increasing employer salary sacrifice to its maximum before using personal contributions.`,
      `Bonus timing matters: if a bonus would push you over £125,140, ask about deferring or sacrificing part of it into pension pre-payment.`,
    ],
    beforeAfter: {
      beforeLabel: `Without action at ${formatGBP(result.adjustedNetIncome)}`,
      beforeRows: [
        { label: "Income in 60% trap band", value: formatGBP(result.trapBandIncome) },
        { label: "Tax on trap band", value: formatGBP(result.trapTax) },
        { label: "Allowance remaining", value: formatGBP(PERSONAL_ALLOWANCE - result.allowanceLost) },
      ],
      afterLabel: `With ${formatGBP(result.pensionNeededToEscape)} pension contribution`,
      afterRows: [
        { label: "Adjusted net income", value: formatGBP(TRAP_START) },
        { label: "Personal allowance", value: "£12,570 (fully restored)" },
        { label: "Pension tax relief", value: "~" + formatGBP(result.pensionTaxSaving) },
        { label: "Allowance restoration saving", value: "~" + formatGBP(result.allowanceLost * HIGHER_RATE_TAX) },
        { label: "Net cost of contribution", value: "~" + formatGBP(result.pensionNetCost) },
      ],
    },
    confidence: "HIGH",
    confidenceNote: "60% marginal rate is the highest marginal rate in the UK income tax system (higher than the 45% additional rate above £125,140).",
    tier: 147,
    ctaLabel: "Get My 60% Escape Plan — £147 →",
    altTierLabel: "Just want the audit? — £67 instead",
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
    id: "income_band", step: 1, type: "button_group",
    label: "What is your total income this year (employment + self-employment + rental)?",
    subLabel: "The 60% trap applies to adjusted net income between £100,000 and £125,140 — total income matters, not just salary.",
    options: [
      { label: "Under £100,000",       value: "under_100k",  subLabel: "Not in trap — full allowance intact" },
      { label: "£100,000–£110,000",    value: "100k_110k",   subLabel: "Early trap zone — allowance tapering" },
      { label: "£110,000–£120,000",    value: "110k_120k",   subLabel: "Deep trap zone — 60% effective rate" },
      { label: "£120,000–£125,140",    value: "120k_125k",   subLabel: "Edge zone — allowance nearly gone" },
      { label: "Over £125,140",        value: "over_125k",   subLabel: "Past trap — allowance fully withdrawn" },
    ],
    required: true,
  },
  {
    id: "pension_contributions", step: 2, type: "button_group",
    label: "How much are you contributing to pension this tax year (incl. employer contributions)?",
    subLabel: "Pension contributions reduce adjusted net income — every £2 contributed restores £1 of personal allowance.",
    options: [
      { label: "None",              value: "none",      subLabel: "Maximum trap exposure" },
      { label: "Under £5,000",      value: "under_5k",  subLabel: "Some reduction, likely not enough" },
      { label: "£5,000–£10,000",    value: "5k_10k",    subLabel: "Meaningful reduction" },
      { label: "Over £10,000",      value: "over_10k",  subLabel: "Substantial — may already escape trap" },
    ],
    required: true,
  },
  {
    id: "salary_sacrifice", step: 3, type: "button_group",
    label: "Does your employer offer salary sacrifice for pension contributions?",
    subLabel: "Salary sacrifice saves NI as well as income tax — more efficient than personal pension contributions at this income level.",
    options: [
      { label: "Yes — available and I can use it",    value: "yes",     subLabel: "Best-case lever" },
      { label: "No — not offered by employer",         value: "no",      subLabel: "Personal contribution only" },
      { label: "Not sure / self-employed",             value: "not_sure", subLabel: "Worth asking HR or accountant" },
    ],
    required: true,
  },
];

const TOTAL_STEPS = 3;

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

      {/* Trap math breakdown */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">The 60% trap math for your income</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Gross income (employment + SE + rental)</span>
            <span className="font-mono font-bold text-neutral-950">{formatGBP(verdict.result.grossIncome)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Current pension contribution</span>
            <span className="font-mono text-neutral-950">− {formatGBP(verdict.result.currentPension)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Adjusted net income (for allowance taper)</span>
            <span className="font-mono font-bold text-neutral-950">{formatGBP(verdict.result.adjustedNetIncome)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Personal allowance (full £12,570)</span>
            <span className="font-mono text-neutral-950">£12,570</span>
          </div>
          {verdict.result.allowanceLost > 0 && (
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Allowance lost to taper</span>
              <span className="font-mono font-bold text-red-700">− {formatGBP(verdict.result.allowanceLost)}</span>
            </div>
          )}
          {verdict.result.trapBandIncome > 0 && (
            <>
              <div className="flex justify-between border-b border-neutral-100 pb-1">
                <span className="text-neutral-600">Income in 60% trap band</span>
                <span className="font-mono text-red-700">{formatGBP(verdict.result.trapBandIncome)}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-100 pb-1">
                <span className="text-neutral-600">Tax on trap band (60%)</span>
                <span className="font-mono font-bold text-red-700">{formatGBP(verdict.result.trapTax)}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-100 pb-1">
                <span className="text-neutral-600">You keep from trap band (40%)</span>
                <span className="font-mono text-neutral-950">{formatGBP(verdict.result.trapKeep)}</span>
              </div>
            </>
          )}
          {(verdict.result.inTrap || verdict.result.pastTrap) && (
            <>
              <div className="flex justify-between border-b border-neutral-100 pb-1">
                <span className="text-neutral-600">Tax on your last £10,000 earned</span>
                <span className="font-mono text-red-700">{formatGBP(verdict.result.taxOnLast10k)}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-100 pb-1">
                <span className="text-neutral-600">Kept from last £10,000</span>
                <span className="font-mono text-neutral-950">{formatGBP(verdict.result.keepOfLast10k)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-semibold text-neutral-800">Pension contribution to escape trap</span>
                <span className="font-mono font-bold text-emerald-700">{formatGBP(verdict.result.pensionNeededToEscape)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-neutral-800">Tax saved by that contribution</span>
                <span className="font-mono font-bold text-emerald-700">~{formatGBP(verdict.result.pensionTaxSaving)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Before / After block */}
      {verdict.beforeAfter && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-red-700">Before — the 60% trap</p>
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
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">After — pension contribution</p>
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
      {verdict.result.trapBandIncome > 0 && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ What 60% effective rate actually means</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-1">
            60p lost to tax for every £1 you earn above £100,000 — until £125,140.
          </p>
          <p className="text-xs text-red-800 leading-relaxed">
            On your {formatGBP(verdict.result.trapBandIncome)} of trap-band income: {formatGBP(verdict.result.trapTax)} goes to HMRC, {formatGBP(verdict.result.trapKeep)} reaches you. This is not a penalty — it is arithmetic. Income Tax Act 2007 section 35. Your payslip does not show it.
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
          <strong className="text-neutral-950">HMRC does not flag the 60% trap.</strong> It&apos;s not on your tax code. It&apos;s not shown on your payslip. Most people discover it only on their tax return — by which point the year is gone and the allowance cannot be restored retrospectively.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your exact 60% trap exposure at your income level</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Pension contribution needed to escape — with salary sacrifice vs personal contribution comparison</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Annual tax saving projection and net cost of contribution</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Bonus timing strategy if you&apos;re near the £125,140 cliff</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 accountant questions written for YOUR income band and pension setup</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">£{verdict.tier} · One-time · Built around your income, pension, and salary sacrifice</p>
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

export default function AllowanceSniperCalculator() {
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
        product_slug: "allowance-sniper",
        source_path: "/uk/check/allowance-sniper",
        country_code: "UK", currency_code: "GBP", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          in_trap: verdict.result.inTrap,
          past_trap: verdict.result.pastTrap,
          adjusted_net_income: verdict.result.adjustedNetIncome,
          trap_band_income: verdict.result.trapBandIncome,
          trap_tax: verdict.result.trapTax,
          pension_needed: verdict.result.pensionNeededToEscape,
          pension_tax_saving: verdict.result.pensionTaxSaving,
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
      body: JSON.stringify({ email, source: "allowance_sniper", country_code: "UK", site: "taxchecknow" }),
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
    const sid = sessionId || `allow_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("allowance-sniper_income_band", String(answers.income_band || ""));
    sessionStorage.setItem("allowance-sniper_pension_contributions", String(answers.pension_contributions || ""));
    sessionStorage.setItem("allowance-sniper_salary_sacrifice", String(answers.salary_sacrifice || ""));
    sessionStorage.setItem("allowance-sniper_adjusted_net_income", String(Math.round(verdict.result.adjustedNetIncome)));
    sessionStorage.setItem("allowance-sniper_trap_band_income", String(Math.round(verdict.result.trapBandIncome)));
    sessionStorage.setItem("allowance-sniper_trap_tax", String(Math.round(verdict.result.trapTax)));
    sessionStorage.setItem("allowance-sniper_pension_needed", String(Math.round(verdict.result.pensionNeededToEscape)));
    sessionStorage.setItem("allowance-sniper_pension_tax_saving", String(Math.round(verdict.result.pensionTaxSaving)));
    sessionStorage.setItem("allowance-sniper_status", verdict.status);
    sessionStorage.setItem("allowance-sniper_tier", String(popupTier));

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
          success_url: `${window.location.origin}/uk/check/allowance-sniper/success/${successPath}`,
          cancel_url: `${window.location.origin}/uk/check/allowance-sniper`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your 60% trap exposure and pension escape number.</p>
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
                    {popupTier === 67 ? "Your Allowance Audit Pack" : "Your 60% Tax Escape Plan"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">HMRC-referenced · Income Tax Act 2007 s35 · April 2026</p>
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
                      {popupTier === 67 ? "Allowance Audit Pack™" : "60% Tax Escape Plan™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your exact 60% trap exposure, pension contribution needed to escape, tax saving calculation, and 5 accountant questions — built for your income band and pension setup."
                        : "Full escape plan: pension contribution optimisation, salary sacrifice vs personal contribution comparison, bonus timing strategy, multi-year pension planning, and accountant coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">£{popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic 60% trap article. Your exact escape math at your income band.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Trap Audit →" : "Get My Escape Plan →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the audit? — £67 instead" : "Want the full escape plan? — £147 instead"}
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
                    { label: "Employment type", key: "entity_type", options: [["employee","Employee (PAYE)"],["director","Company director"],["self_employed","Self-employed / sole trader"],["mixed","Mixed — employment + self-employment"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["acting_now","Acting before 5 April 2027 year-end"],["planning","Planning 6+ months out"],["just_checking","Just checking my position"]] },
                    { label: "Do you have an accountant or IFA?", key: "accountant", options: [["accountant","Yes — accountant"],["ifa","Yes — independent financial adviser"],["both","Both"],["no","No — managing myself"]] },
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
      {showVerdict && verdict && verdict.result.trapBandIncome > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">60% trap tax</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatGBP(verdict.result.trapTax)} lost on trap band
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
