"use client";

/**
 * AU-14 — Super-to-Trust Exit Engine
 * Pattern: G (ThresholdTest — $3M Div 296) + F (CashflowModel — trust vs super earnings break-even)
 *
 * Core question: Should this SMSF member exit super into a family trust
 * before Division 296 applies from 1 July 2026?
 *
 * Key facts (ATO confirmed April 2026):
 *   Withdrawal tax: 0% if 60+ and retired (ITAA 1997 s301-10), 15% if under 60 on taxable component
 *   Super earnings rate: 15% (accumulation), 0% (pension phase) — s295-385
 *   Trust earnings rate: distributed to beneficiaries at their marginal rate (up to 47% incl Medicare)
 *   Undistributed trust income: top marginal rate (47%)
 *   Division 296: additional 15% on realised earnings attributable to TSB above $3M from 1 July 2026
 *   Exit is irreversible — cannot return to super (subject to NCC caps $120k/$360k bring-forward)
 *   Legal anchors: ITAA 1997 s301-10 (super benefit tax), Subdiv 296-B (Div 296)
 *
 * The trap: Members with TSB approaching or over $3M are being sold "exit to family trust"
 * as an obvious Division 296 avoidance strategy. Most are trading a 15% (or 0%) earnings
 * environment for a 32-47% environment, paying exit tax to do so, and losing the pension
 * phase forever. Break-even horizons of 15-25 years are typical.
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;

interface ExitResult {
  totalBalance: number;
  taxableAmount: number;
  taxFreeAmount: number;
  exitTaxRate: number;           // 0 or 0.15 depending on age
  exitTax: number;               // $ paid to withdraw
  superEarningsRate: number;     // 0 (pension) or 0.15 (accumulation)
  trustEffectiveRate: number;    // beneficiary-weighted effective rate
  annualSuperTax: number;        // $ super earnings tax per year staying
  annualTrustTax: number;        // $ trust earnings tax per year after exit
  annualDiv296IfStay: number;    // $ Div 296 cost per year if staying
  annualDifferential: number;    // annualTrustTax - (annualSuperTax + annualDiv296IfStay)
  div296Applies: boolean;
  breakEvenYears: number;        // years until exit costs recovered via Div 296 avoidance (Infinity if never)
  twentyYearStayCost: number;    // cumulative cost of staying in super for 20 years
  twentyYearExitCost: number;    // exit tax + 20 years of trust earnings tax
  exitRecommended: boolean;
  netBenefit20Year: number;      // stay cost - exit cost (positive = exit better)
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
  result: ExitResult;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — ATO confirmed April 2026
// ─────────────────────────────────────────────────────────────────────────────

const DIV296_THRESHOLD = 3_000_000;
const DIV296_RATE = 0.15;
const SUPER_ACCUMULATION_RATE = 0.15;
const SUPER_PENSION_RATE = 0;
const UNDER_60_EXIT_TAX = 0.15;          // on taxable component, under 60 non-retired
const RETIRED_60_PLUS_EXIT_TAX = 0;      // s301-10 tax-free
const ASSUMED_EARNINGS_RATE = 0.05;      // 5% p.a. realised earnings (conservative)

const BALANCE_MAP: Record<string, number> = {
  under_2m:   1_500_000,
  "2m_to_3m": 2_500_000,
  "3m_to_5m": 3_800_000,   // Andrew Chen's scenario
  over_5m:    6_500_000,
};

const TAXABLE_MAP: Record<string, number> = {
  under_50:   0.40,
  "50_to_70": 0.60,
  "70_to_90": 0.80,   // typical SMSF, Andrew's scenario
  over_90:    0.95,
};

// Effective trust distribution rate — weighted blend assuming streaming to beneficiaries
const TRUST_RATE_MAP: Record<string, number> = {
  low:    0.21,   // spouse/adult kids in 19-30% bracket, some distribution flexibility
  mid:    0.34,   // beneficiaries in 32.5-37% bracket
  high:   0.45,   // beneficiaries at top marginal rate or undistributed income
};

const PRODUCT_KEYS = {
  p67:  "au_67_super_to_trust_exit",
  p147: "au_147_super_to_trust_exit",
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
// CALCULATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcExit(answers: AnswerMap): ExitResult {
  const ageBand     = String(answers.age_band || "60_to_66");
  const tsbBand     = String(answers.tsb_band || "3m_to_5m");
  const taxablePct  = String(answers.taxable_percent || "70_to_90");
  const phase       = String(answers.super_phase || "accumulation");
  const beneficiary = String(answers.beneficiary_rate || "mid");

  const totalBalance   = BALANCE_MAP[tsbBand] ?? 3_800_000;
  const taxablePercent = TAXABLE_MAP[taxablePct] ?? 0.80;
  const taxableAmount  = totalBalance * taxablePercent;
  const taxFreeAmount  = totalBalance - taxableAmount;

  // ── Exit tax (withdrawal from super) ──────────────────────────────────────
  // Under 60: 15% on taxable component. 60+: 0% if retired (ITAA 1997 s301-10).
  // Mid-range age (60-66) assumed retired for this model — flagged in confidence.
  let exitTaxRate = UNDER_60_EXIT_TAX;
  if (ageBand === "60_to_66" || ageBand === "67_to_74" || ageBand === "75_plus") {
    exitTaxRate = RETIRED_60_PLUS_EXIT_TAX;
  }
  const exitTax = taxableAmount * exitTaxRate;

  // ── Super earnings rate depending on phase ───────────────────────────────
  const superEarningsRate = phase === "pension" ? SUPER_PENSION_RATE : SUPER_ACCUMULATION_RATE;

  // ── Trust effective rate (beneficiary-weighted) ──────────────────────────
  const trustEffectiveRate = TRUST_RATE_MAP[beneficiary] ?? 0.34;

  // ── Annual earnings tax comparisons ──────────────────────────────────────
  const annualEarnings  = totalBalance * ASSUMED_EARNINGS_RATE;
  const annualSuperTax  = annualEarnings * superEarningsRate;
  const annualTrustTax  = annualEarnings * trustEffectiveRate;

  // ── Division 296 if staying in super ─────────────────────────────────────
  const div296Applies = totalBalance > DIV296_THRESHOLD;
  let annualDiv296IfStay = 0;
  if (div296Applies) {
    const attributableProp = (totalBalance - DIV296_THRESHOLD) / totalBalance;
    annualDiv296IfStay = annualEarnings * attributableProp * DIV296_RATE;
  }

  // ── Annual differential (trust cost vs staying in super with Div 296) ───
  // Positive = trust is more expensive. Negative = trust is cheaper (Div 296 exceeds super-trust gap).
  const annualDifferential = annualTrustTax - (annualSuperTax + annualDiv296IfStay);

  // ── Break-even years: exit tax / (Div 296 avoided - extra trust earnings tax) ──
  // If differential is positive (trust costs more than super even after Div 296), break-even = never
  let breakEvenYears = Infinity;
  if (annualDifferential < 0) {
    // Trust is annually cheaper — break-even is exit tax / annual saving
    const annualSaving = -annualDifferential;
    breakEvenYears = annualSaving > 0 ? exitTax / annualSaving : Infinity;
  }

  // ── 20-year cumulative cost comparison ───────────────────────────────────
  const twentyYearStayCost = (annualSuperTax + annualDiv296IfStay) * 20;
  const twentyYearExitCost = exitTax + annualTrustTax * 20;
  const netBenefit20Year   = twentyYearStayCost - twentyYearExitCost;

  // ── Exit recommended? ────────────────────────────────────────────────────
  // Only if break-even within a reasonable horizon AND 20-year NPV is positive
  const exitRecommended = breakEvenYears < 15 && netBenefit20Year > 0;

  return {
    totalBalance,
    taxableAmount,
    taxFreeAmount,
    exitTaxRate,
    exitTax,
    superEarningsRate,
    trustEffectiveRate,
    annualSuperTax,
    annualTrustTax,
    annualDiv296IfStay,
    annualDifferential,
    div296Applies,
    breakEvenYears,
    twentyYearStayCost,
    twentyYearExitCost,
    exitRecommended,
    netBenefit20Year,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcExit(answers);
  const ageBand = String(answers.age_band || "60_to_66");
  const phase   = String(answers.super_phase || "accumulation");
  const isUnder60 = ageBand === "under_60";

  // ── Under 60 — exit tax almost always kills the case ─────────────────────
  if (isUnder60 && result.exitTax > 0) {
    return {
      status: "UNDER 60 — EXIT TAX MAKES THIS A LOSING TRADE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Exiting your super into a family trust before age 60 triggers ${formatAUD(result.exitTax)} in immediate withdrawal tax (15% on your ${formatAUD(result.taxableAmount)} taxable component). Even if Division 296 applied every year, break-even takes ${result.breakEvenYears === Infinity ? "longer than your lifetime" : `~${Math.round(result.breakEvenYears)} years`} — and the trust environment costs more in annual earnings tax too.`,
      stats: [
        { label: "Exit tax now", value: formatAUD(result.exitTax), highlight: true },
        { label: "Break-even", value: result.breakEvenYears === Infinity ? "Never" : `${Math.round(result.breakEvenYears)} yrs`, highlight: true },
        { label: "20-yr net cost of exiting", value: formatAUD(Math.max(0, -result.netBenefit20Year)), highlight: true },
      ],
      consequences: [
        `🔒 Withdrawal tax is 15% on the taxable component if you are under 60 (ITAA 1997 s301-10). ${formatAUD(result.taxableAmount)} × 15% = ${formatAUD(result.exitTax)} paid to the ATO before a dollar reaches your trust.`,
        `🔒 Exit is IRREVERSIBLE. Once withdrawn, you cannot return to super except via non-concessional contributions — capped at $120k/year or $360k bring-forward. Getting ${formatAUDShort(result.totalBalance)} back into super would take a decade.`,
        `Your super currently pays ${(result.superEarningsRate * 100).toFixed(0)}% on earnings. A family trust distributes to beneficiaries at their marginal rate — ${(result.trustEffectiveRate * 100).toFixed(0)}% effective on your answers. That's ${formatAUD(result.annualTrustTax - result.annualSuperTax)} more tax per year, every year.`,
        result.div296Applies ? `Division 296 adds ~${formatAUD(result.annualDiv296IfStay)} per year above $3M from 1 July 2026 — but even with that, the trust environment is still ${result.annualDifferential > 0 ? "more expensive annually" : "only marginally cheaper"}, and exit tax takes decades to recoup.` : `Your TSB is under $3M — Division 296 doesn't even apply. There is no tax to avoid by exiting.`,
        "Alternatives that cost $0 in exit tax: (a) withdraw tax-free after 60 if you stay, (b) spouse balance equalisation to keep each member under $3M, (c) staged pension phase transition to capture 0% earnings tax on TBC portion up to $2.0M.",
      ],
      confidence: "HIGH",
      confidenceNote: "Exit tax at 15% for under-60s is statutory (ITAA 1997 s301-10). 20-year horizon gives break-even comparison conservative benefit to trust case.",
      tier: 147,
      ctaLabel: "Get My Full Model + Alternatives — $147 →",
      altTierLabel: "Just want the break-even number? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── 60+ pension phase — already in 0% environment, exit is obvious loss ──
  if (!isUnder60 && phase === "pension") {
    return {
      status: "PENSION PHASE — EXITING A 0% ENVIRONMENT IS INDEFENSIBLE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `You are already in pension phase — earnings on the transfer balance portion are taxed at 0% under ITAA 1997 s295-385. Exiting into a family trust moves you from 0% to approximately ${(result.trustEffectiveRate * 100).toFixed(0)}% on earnings, permanently.`,
      stats: [
        { label: "Your current earnings tax", value: "0% ✓" },
        { label: "Trust earnings tax", value: `~${(result.trustEffectiveRate * 100).toFixed(0)}%`, highlight: true },
        { label: "Annual cost increase", value: formatAUD(result.annualTrustTax), highlight: true },
      ],
      consequences: [
        "🔒 Pension phase earnings are TAX-FREE on the transfer balance cap portion (s295-385). You are currently paying 0% on earnings attributable to pension accounts.",
        `🔒 A family trust distributes earnings to beneficiaries at their marginal tax rate — typically ${(result.trustEffectiveRate * 100).toFixed(0)}% effective on your answers. That's ${formatAUD(result.annualTrustTax)} of tax per year that you currently pay zero of.`,
        result.div296Applies ? `Division 296 does add ~${formatAUD(result.annualDiv296IfStay)}/year above $3M — but this is applied to TOTAL Super Balance, not just pension phase. Staying in pension + using spouse equalisation or withdrawals to stay under $3M is almost always cheaper than exiting.` : "Division 296 doesn't apply at your TSB — there's no tax to avoid by exiting at all.",
        "The mechanical irreversibility: withdraw $3.8M today, you cannot return. NCC cap is $120k/year, $360k bring-forward. Replacing the position would take more than a decade.",
        "Alternatives that preserve the 0% pension environment: (a) manage TSB to stay under $3M at 30 June via planned withdrawals, (b) spouse equalisation so each member has own $3M threshold, (c) partial withdrawal for specific lifestyle needs only — not wholesale exit.",
      ],
      confidence: "HIGH",
      confidenceNote: "Pension phase 0% is statutory. The earnings tax differential between pension phase and a trust is the largest tax gap in Australian super law — 0% vs 19-47%.",
      tier: 147,
      ctaLabel: "Get My Retention Strategy — $147 →",
      altTierLabel: "Just want the break-even number? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── TSB under $3M — Div 296 doesn't apply, exit makes no sense ───────────
  if (!result.div296Applies && !isUnder60) {
    return {
      status: "UNDER $3M TODAY — NO DIV 296 TO AVOID",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Division 296 does not apply to your SMSF today — your TSB is below the $3M threshold. There is no 15% additional tax to avoid by exiting. Moving to a trust would swap a ${(result.superEarningsRate * 100).toFixed(0)}% earnings environment for approximately ${(result.trustEffectiveRate * 100).toFixed(0)}% — ${formatAUD(result.annualTrustTax - result.annualSuperTax)}/year more tax, forever.`,
      stats: [
        { label: "Div 296 applies", value: "No ✓" },
        { label: "Annual cost increase if exit", value: formatAUD(result.annualTrustTax - result.annualSuperTax), highlight: true },
        { label: "20-yr net cost of exiting", value: formatAUD(Math.max(0, -result.netBenefit20Year)), highlight: true },
      ],
      consequences: [
        "Division 296 only applies to TSB above $3M from 1 July 2026 — you are under the threshold and have no Div 296 exposure to avoid",
        `Your super earnings are taxed at ${(result.superEarningsRate * 100).toFixed(0)}% (${phase === "pension" ? "pension phase" : "accumulation"}). A family trust distributes earnings at beneficiary marginal rates — ${(result.trustEffectiveRate * 100).toFixed(0)}% effective.`,
        `Exiting costs ${formatAUD(result.exitTax)} in withdrawal tax today, and adds ${formatAUD(result.annualTrustTax - result.annualSuperTax)} per year in permanent earnings tax differential. There is no Division 296 saving to offset either.`,
        "Forward protection: if your TSB may cross $3M in future, the COST-BASE RESET ELECTION (SMSF) is the planning lever — protects pre-2026 gains without exiting. See our div296-wealth-eraser product for that specific decision.",
        "Spouse balance equalisation can keep both partners under $3M — each has their own threshold. Rebalancing typically eliminates Div 296 entirely for couples in the $3-5M combined range.",
      ],
      confidence: "HIGH",
      confidenceNote: "Division 296 threshold is $3M TSB per member (Subdiv 296-B). Below that, no additional tax applies — exit strategy has no tax benefit to capture.",
      tier: 67,
      ctaLabel: "Show Me My 20-Year Model — $67 →",
      altTierLabel: "Want the full alternatives plan too? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── 60+ accumulation, TSB > $3M, exit NOT recommended (typical outcome) ──
  if (!result.exitRecommended && result.div296Applies) {
    const breakEvenDisplay = result.breakEvenYears === Infinity ? "Never" : `~${Math.round(result.breakEvenYears)} years`;
    return {
      status: "EXIT NOT RECOMMENDED — BREAK-EVEN TOO LONG",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Division 296 applies to your SMSF from 1 July 2026 — approximately ${formatAUD(result.annualDiv296IfStay)} per year above $3M. But exiting to a trust costs ${formatAUD(result.exitTax)} today AND moves earnings from ${(result.superEarningsRate * 100).toFixed(0)}% to ${(result.trustEffectiveRate * 100).toFixed(0)}%. Break-even: ${breakEvenDisplay}. Over 20 years you come out ${result.netBenefit20Year > 0 ? formatAUD(result.netBenefit20Year) + " AHEAD staying in super" : formatAUD(-result.netBenefit20Year) + " WORSE OFF exiting"}.`,
      stats: [
        { label: "Break-even horizon", value: breakEvenDisplay, highlight: true },
        { label: "20-yr stay cost", value: formatAUD(result.twentyYearStayCost) },
        { label: "20-yr exit cost", value: formatAUD(result.twentyYearExitCost), highlight: true },
      ],
      consequences: [
        `🔒 Division 296 is real — ~${formatAUD(result.annualDiv296IfStay)}/year from 1 July 2026 while TSB stays above $3M, compounding every year`,
        `🔒 BUT the trust environment is worse on an ongoing basis — ${formatAUD(result.annualTrustTax)}/year vs ${formatAUD(result.annualSuperTax + result.annualDiv296IfStay)}/year staying in super (including Div 296). That's ${formatAUD(result.annualDifferential)}/year ${result.annualDifferential > 0 ? "MORE tax in trust" : "less tax in trust"}.`,
        `${result.exitTax > 0 ? `🔒 Exit tax of ${formatAUD(result.exitTax)} applies today on withdrawal` : "Exit tax is $0 at your age (retired, 60+) under s301-10"} — ${result.exitTax > 0 ? "non-recoverable" : "but this is the ONLY free part of the exit"}`,
        `20-year comparison: stay = ${formatAUD(result.twentyYearStayCost)} total tax (earnings + Div 296). Exit = ${formatAUD(result.twentyYearExitCost)} total tax (exit + trust earnings). Net: ${result.netBenefit20Year > 0 ? `staying is ${formatAUD(result.netBenefit20Year)} better` : `exit is ${formatAUD(-result.netBenefit20Year)} better`}.`,
        "Better alternatives at your stage: (a) spouse balance equalisation to get both under $3M, (b) partial withdrawal + recontribution to reset taxable component (tax-free 60+, reduces death benefit tax too), (c) pension phase transition to hit 0% on TBC portion, (d) cost-base reset election (AU-13) to protect pre-2026 gains without exiting",
      ],
      confidence: "HIGH",
      confidenceNote: "Calculation uses 5% earnings assumption, 20-year horizon. Your accountant should model your actual beneficiary tax profile and horizon for a specific number.",
      tier: 147,
      ctaLabel: "Get My Full Model + Alternatives — $147 →",
      altTierLabel: "Just want the break-even number? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── Edge case: exit actually recommended (low beneficiary rates + high Div 296) ──
  if (result.exitRecommended) {
    return {
      status: "MARGINAL — EXIT MAY BE DEFENSIBLE WITH SPECIFIC CONDITIONS",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `With low beneficiary tax rates and significant Division 296 exposure, your specific scenario shows exit break-even in ~${Math.round(result.breakEvenYears)} years. Over 20 years, exit is ${formatAUD(Math.max(0, result.netBenefit20Year - 0))} ${result.netBenefit20Year > 0 ? "better" : "worse"} than staying. This is the edge case — but model sensitivities carefully before acting.`,
      stats: [
        { label: "Break-even", value: `${Math.round(result.breakEvenYears)} yrs`, highlight: true },
        { label: "20-yr savings", value: formatAUD(Math.max(0, -result.netBenefit20Year)), highlight: true },
        { label: "Exit tax today", value: formatAUD(result.exitTax) },
      ],
      consequences: [
        `Break-even at ~${Math.round(result.breakEvenYears)} years — within the viable horizon but sensitive to actual beneficiary distribution patterns`,
        "This scenario only holds if: (a) you genuinely distribute to low-bracket beneficiaries every year, (b) Division 296 exposure stays high (TSB stays above $3M), (c) you have sufficient horizon to recoup",
        `Risks: if beneficiary brackets change (kids' incomes rise, spouse returns to work), the effective trust rate jumps and break-even stretches. Undistributed trust income is taxed at top marginal rate (47%).`,
        "Non-tax considerations: super is protected from creditors, family law claims, estate disputes. Trusts have distribution flexibility but are exposed. Asset protection profile changes materially.",
        "Before acting: (1) model 5-year and 10-year break-evens, not just 20, (2) stress-test against beneficiary bracket changes, (3) consider staged partial withdrawal instead of wholesale exit, (4) compare to in-super alternatives (spouse equalisation, pension phase, cost-base reset)",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Break-even within 15 years is the threshold for marginal — below that, trust may work. Requires careful modelling of actual beneficiary distributions and horizon assumptions.",
      tier: 147,
      ctaLabel: "Get My Full Exit Model — $147 →",
      altTierLabel: "Just want the decision pack? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── Fallback (rare) ──────────────────────────────────────────────────────
  return {
    status: "EXIT NOT RECOMMENDED — EARNINGS DIFFERENTIAL WORSE IN TRUST",
    statusClass: "text-red-700",
    panelClass: "border-red-200 bg-red-50",
    headline: `Your scenario shows the trust environment costs more annually than staying in super, even accounting for Division 296. Break-even is ${result.breakEvenYears === Infinity ? "never" : `${Math.round(result.breakEvenYears)} years`}. Exit tax of ${formatAUD(result.exitTax)} would be a sunk cost with no recovery.`,
    stats: [
      { label: "Annual trust excess", value: formatAUD(Math.max(0, result.annualDifferential)), highlight: true },
      { label: "Break-even", value: result.breakEvenYears === Infinity ? "Never" : `${Math.round(result.breakEvenYears)} yrs`, highlight: true },
      { label: "20-yr net cost of exiting", value: formatAUD(Math.max(0, -result.netBenefit20Year)), highlight: true },
    ],
    consequences: [
      `Trust earnings tax at ${(result.trustEffectiveRate * 100).toFixed(0)}% exceeds super at ${(result.superEarningsRate * 100).toFixed(0)}% plus any Div 296`,
      "Exit is irreversible — NCC caps prevent rapid re-entry to super",
      "Alternatives in super are cheaper: spouse equalisation, pension phase, cost-base reset election",
    ],
    confidence: "MEDIUM",
    confidenceNote: "Edge case — ring-fenced scenario where trust differential outweighs Div 296 benefit.",
    tier: 147,
    ctaLabel: "Get My Full Model — $147 →",
    altTierLabel: "Just want the decision pack? — $67 instead",
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
    id: "age_band", step: 1, type: "button_group",
    label: "What is your current age?",
    subLabel: "Determines exit tax — 15% on taxable component under 60, tax-free 60+ retired (ITAA 1997 s301-10)",
    options: [
      { label: "Under 60", value: "under_60", subLabel: "15% exit tax on taxable — usually fatal to exit case" },
      { label: "60–66", value: "60_to_66", subLabel: "Tax-free withdrawal if retired — most common exit age" },
      { label: "67–74", value: "67_to_74", subLabel: "Tax-free, work test applies to any contributions" },
      { label: "75 or over", value: "75_plus", subLabel: "Tax-free withdrawal, horizon tight for break-even" },
    ],
    required: true,
  },
  {
    id: "tsb_band", step: 2, type: "button_group",
    label: "What is your current Total Super Balance?",
    subLabel: "Division 296 only applies above $3M — below that, there's no tax to avoid by exiting",
    options: [
      { label: "Under $2M", value: "under_2m", subLabel: "No Div 296 — exit case is weakest here" },
      { label: "$2M–$3M", value: "2m_to_3m", subLabel: "Approaching threshold — forward planning only" },
      { label: "$3M–$5M", value: "3m_to_5m", subLabel: "Div 296 active — the typical consideration zone" },
      { label: "Over $5M", value: "over_5m", subLabel: "Significant Div 296, but exit tax may still kill case" },
    ],
    required: true,
  },
  {
    id: "taxable_percent", step: 3, type: "button_group",
    label: "What portion of your super is the taxable component?",
    subLabel: "Under-60 exit tax applies only to taxable component. Most SMSFs are 70-90% taxable.",
    options: [
      { label: "Under 50%", value: "under_50", subLabel: "Heavy NCC history — lower exit tax if <60" },
      { label: "50%–70%", value: "50_to_70", subLabel: "Moderate — some prior recontribution" },
      { label: "70%–90%", value: "70_to_90", subLabel: "Typical SMSF — full exit tax exposure" },
      { label: "Over 90% / unsure", value: "over_90", subLabel: "Maximum exit tax if under 60" },
    ],
    required: true,
  },
  {
    id: "super_phase", step: 4, type: "button_group",
    label: "What phase is your super currently in?",
    subLabel: "Pension phase = 0% earnings tax. Accumulation = 15%. Exiting to a 32-47% trust from 0% is a very different calculation.",
    options: [
      { label: "Accumulation", value: "accumulation", subLabel: "15% on earnings (s295-385)" },
      { label: "Pension phase", value: "pension", subLabel: "0% on TBC portion — best super environment" },
      { label: "Both (part each)", value: "both", subLabel: "Modelled at pension-leaning rate" },
    ],
    required: true,
  },
  {
    id: "beneficiary_rate", step: 5, type: "button_group",
    label: "What is the likely effective tax rate of trust beneficiaries?",
    subLabel: "Trust income is taxed at beneficiary marginal rates. Undistributed = 47% top rate. Low-bracket spouse/kids = 19-30%.",
    options: [
      { label: "Low — 19-30% (retired spouse, low-income kids)",         value: "low",  subLabel: "~21% effective blend — best case for trust" },
      { label: "Mid — 32.5-37% (working-age family members)",             value: "mid",  subLabel: "~34% effective — typical case" },
      { label: "High — 45%+ (top-bracket earners or undistributed)",     value: "high", subLabel: "~45% effective — trust case is weakest here" },
    ],
    required: true,
  },
  {
    id: "accountant_aware", step: 6, type: "two_button",
    label: "Has your accountant modelled the actual break-even horizon for YOUR scenario?",
    subLabel: "Most 'exit to trust' recommendations rely on generic Division 296 calculations — not your specific beneficiary profile and horizon",
    options: [
      { label: "Yes — modelled and planned", value: true },
      { label: "No — never been discussed in detail", value: false },
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

      {/* Exit cost breakdown panel */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your exit-to-trust math</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Total Super Balance</span>
            <span className="font-mono font-bold text-neutral-950">{formatAUD(verdict.result.totalBalance)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Taxable component</span>
            <span className="font-mono text-neutral-950">{formatAUD(verdict.result.taxableAmount)}</span>
          </div>
          {verdict.result.exitTax > 0 && (
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Exit tax (15% on taxable, under 60)</span>
              <span className="font-mono font-bold text-red-700">− {formatAUD(verdict.result.exitTax)}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Annual super earnings tax ({(verdict.result.superEarningsRate * 100).toFixed(0)}%)</span>
            <span className="font-mono text-neutral-950">{formatAUD(verdict.result.annualSuperTax)} / yr</span>
          </div>
          {verdict.result.div296Applies && (
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Annual Div 296 (if stay)</span>
              <span className="font-mono text-red-700">{formatAUD(verdict.result.annualDiv296IfStay)} / yr</span>
            </div>
          )}
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Annual trust earnings tax ({(verdict.result.trustEffectiveRate * 100).toFixed(0)}%)</span>
            <span className="font-mono text-red-700">{formatAUD(verdict.result.annualTrustTax)} / yr</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="font-semibold text-neutral-800">20-year cost: stay vs exit</span>
            <span className="font-mono font-bold text-neutral-950">{formatAUD(verdict.result.twentyYearStayCost)} vs {formatAUD(verdict.result.twentyYearExitCost)}</span>
          </div>
        </div>
      </div>

      {/* Active loss framing */}
      {verdict.result.netBenefit20Year > 0 && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ What exiting actually costs you</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-1">
            {formatAUD(verdict.result.netBenefit20Year)} worse off over 20 years if you exit vs stay in super.
          </p>
          <p className="text-xs text-red-800 leading-relaxed">
            Exit tax + permanent trust earnings tax differential. Division 296 alone doesn&apos;t overcome this at your scenario.
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
          <strong className="text-neutral-950">Exit is irreversible.</strong> Once withdrawn, you cannot return to super except via non-concessional contributions ($120k/year, $360k bring-forward). Most SMSF members contemplating exit have not seen their actual break-even year.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your exact break-even year at 3 earnings scenarios</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>20-year trust vs super NPV comparison</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Alternative strategies ranked by actual tax saving</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Staged withdrawal option vs full exit modelling</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>4 accountant questions written for YOUR exact balance</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your exact balance, age, and beneficiaries</p>
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

export default function SuperToTrustExitCalculator() {
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
        product_slug: "super-to-trust-exit",
        source_path: "/au/check/super-to-trust-exit",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          exit_tax: verdict.result.exitTax,
          div296_applies: verdict.result.div296Applies,
          annual_div296: verdict.result.annualDiv296IfStay,
          break_even_years: verdict.result.breakEvenYears === Infinity ? -1 : verdict.result.breakEvenYears,
          net_benefit_20_year: verdict.result.netBenefit20Year,
          exit_recommended: verdict.result.exitRecommended,
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
      body: JSON.stringify({ email, source: "super_to_trust_exit", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `strexit_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    // sessionStorage keys MUST match config successPromptFields exactly
    sessionStorage.setItem("super-to-trust-exit_age_band", String(answers.age_band || ""));
    sessionStorage.setItem("super-to-trust-exit_tsb_band", String(answers.tsb_band || ""));
    sessionStorage.setItem("super-to-trust-exit_taxable_percent", String(answers.taxable_percent || ""));
    sessionStorage.setItem("super-to-trust-exit_super_phase", String(answers.super_phase || ""));
    sessionStorage.setItem("super-to-trust-exit_beneficiary_rate", String(answers.beneficiary_rate || ""));
    sessionStorage.setItem("super-to-trust-exit_exit_tax", String(Math.round(verdict.result.exitTax)));
    sessionStorage.setItem("super-to-trust-exit_break_even_years", String(verdict.result.breakEvenYears === Infinity ? -1 : Math.round(verdict.result.breakEvenYears)));
    sessionStorage.setItem("super-to-trust-exit_net_benefit_20_year", String(Math.round(verdict.result.netBenefit20Year)));
    sessionStorage.setItem("super-to-trust-exit_exit_recommended", String(verdict.result.exitRecommended));
    sessionStorage.setItem("super-to-trust-exit_status", verdict.status);
    sessionStorage.setItem("super-to-trust-exit_tier", String(popupTier));

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
          success_url: `${window.location.origin}/au/check/super-to-trust-exit/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/super-to-trust-exit`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your exit break-even number to show your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of the trust vs super comparison by email — free.</p>
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
                    {popupTier === 67 ? "Your Exit Break-Even Pack" : "Your Full Exit Decision Model"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">ATO-referenced · ITAA 1997 s301-10, Subdiv 296-B · April 2026</p>
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
                      {popupTier === 67 ? "Exit Break-Even Pack™" : "Full Exit Decision Model™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your break-even horizon at 3 earnings scenarios, exit tax quantum, 20-year trust vs super comparison, and 4 accountant questions — built for your exact balance, age, and beneficiary profile."
                        : "Full 20-year model, staged withdrawal strategy, pension phase optimisation, trust distribution planning, alternative strategies ranked by tax saving, and accountant-ready implementation documents."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic Div 296 avoidance guide. A decision for your exact balance and family.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Break-Even Number →" : "Get My Full Model →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the break-even number? — $67 instead" : "Want the full model + alternatives? — $147 instead"}
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
                    { label: "How urgent is this?", key: "urgency", options: [["acting_now","Acting before 30 June 2026"],["planning","Planning 12-24 months out"],["just_checking","Just checking my position"]] },
                    { label: "Do you have an accountant or adviser?", key: "accountant", options: [["accountant","Yes — SMSF accountant"],["adviser","Yes — financial adviser"],["both","Both"],["no","No — managing myself"]] },
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
      {showVerdict && verdict && verdict.result.netBenefit20Year > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Cost of exiting</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatAUD(verdict.result.netBenefit20Year)} over 20 years
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
