"use client";

/**
 * US-01 — R&D Tax Cashflow Shock Engine (formerly Section 174 Auditor)
 * Pattern: F (CashflowModel — £ tax shock) + B (Timeline — three legal periods)
 *
 * Core question: How much cashflow shock has the 2022 Section 174 amendment
 * created for this business, and is there a retroactive recovery opportunity?
 *
 * CRITICAL LEGAL STATUS — THREE PERIODS
 *   Pre-2022: immediate deduction of R&D costs (old Section 174)
 *   2022-2024: mandatory amortization — domestic 5 years, foreign 15 years
 *              (TCJA amendment, effective for tax years beginning after Dec 31, 2021)
 *   2025+:    One Big Beautiful Bill Act proposes Section 174A restoring
 *              immediate expensing — NOT YET ENACTED as of April 2026
 *
 * Key facts:
 *   Domestic R&D amortization: 5 years, half-year convention
 *     Year 1: 10%, Years 2-5: 20% each, Year 6: 10% = 100% over 6 years
 *   Foreign R&D amortization: 15 years, half-year convention
 *     Year 1: 3.33%, Years 2-15: 6.67% each, Year 16: 3.33%
 *   Corporate tax rate: 21% (flat federal)
 *   Pass-through (S-corp, partnership, LLC): ~30-37% effective (personal + SE tax)
 *   Sole prop: ~25-37% effective
 *   Legal anchors: IRC §174 (as amended by TCJA 2017, effective post-Dec 31 2021)
 *     · Revenue Procedure 2023-8 (implementation guidance)
 *     · Proposed Section 174A under OBBBA (not yet enacted April 2026)
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type ExposureStatus =
  | "LOW_IMPACT"           // small R&D spend, minimal cashflow shock
  | "MATERIAL_SHOCK"       // meaningful spend, compliant filing
  | "AMENDMENT_RISK"       // filed under wrong rules — audit exposure
  | "AMBIGUOUS_FILING"     // unsure if filed correctly
  | "PROACTIVE_PLANNING";  // not yet filed — set up correctly

interface R174Result {
  rdSpend: number;
  domesticRd: number;
  foreignRd: number;
  entityType: string;
  taxRate: number;

  // Year 1 deductions
  year1DeductionNewRules: number;
  year1DeductionOldRules: number;
  additionalTaxableY1: number;
  additionalTaxY1: number;

  // 3-year cumulative (2022+2023+2024 if all spent same)
  cumulativeTaxShock3Year: number;

  // Retroactive / filing status
  filingStatus: string;
  amendmentOpportunity: boolean;

  exposureStatus: ExposureStatus;
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
  result: R174Result;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DOMESTIC_YEAR1_PCT = 0.10;       // 5-year amortization, half-year convention
const FOREIGN_YEAR1_PCT = 1 / 30;      // 15-year amortization, half-year convention (~3.33%)

const CORP_RATE = 0.21;
const PASS_THROUGH_EFFECTIVE = 0.30;   // rough blend — personal higher rate minus QBI
const SOLE_PROP_EFFECTIVE = 0.27;      // rough — SE + federal, varies widely

const RD_SPEND_MAP: Record<string, number> = {
  under_100k:      50000,
  "100k_to_500k":  300000,
  "500k_to_2m":    1250000,
  over_2m:         3500000,
};

const LOCATION_MIX: Record<string, { domestic: number; foreign: number }> = {
  domestic: { domestic: 1.0, foreign: 0.0 },
  foreign:  { domestic: 0.0, foreign: 1.0 },
  mixed:    { domestic: 0.5, foreign: 0.5 },
};

const PRODUCT_KEYS = {
  p67:  "us_67_section_174_auditor",
  p147: "us_147_section_174_auditor",
};

function formatUSD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

// ─────────────────────────────────────────────────────────────────────────────
// CALC ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcR174(answers: AnswerMap): R174Result {
  const rdSpend      = RD_SPEND_MAP[String(answers.rd_spend || "500k_to_2m")] ?? 1250000;
  const locationKey  = String(answers.rd_location || "domestic");
  const entityType   = String(answers.entity_type || "c_corp");
  const filingStatus = String(answers.filing_status || "some_unsure");

  const mix = LOCATION_MIX[locationKey] ?? LOCATION_MIX.domestic;
  const domesticRd = rdSpend * mix.domestic;
  const foreignRd  = rdSpend * mix.foreign;

  const taxRate = entityType === "c_corp" ? CORP_RATE
                : entityType === "pass_through" ? PASS_THROUGH_EFFECTIVE
                : SOLE_PROP_EFFECTIVE;

  // Year 1 deduction under 2022-2024 amendment rules
  const year1DeductionNewRules = domesticRd * DOMESTIC_YEAR1_PCT + foreignRd * FOREIGN_YEAR1_PCT;
  // Year 1 deduction under pre-2022 (old) rules
  const year1DeductionOldRules = rdSpend;

  const additionalTaxableY1 = year1DeductionOldRules - year1DeductionNewRules;
  const additionalTaxY1 = additionalTaxableY1 * taxRate;

  // Stacking impact across 2022+2023+2024 assuming constant R&D spend
  // Each year's deferred deductions partly offset by prior year's ongoing amortization
  // Rough approximation: year 2 net shock ~1.8x year 1, year 3 ~2.5x
  // Cumulative 3-year ≈ 5x year 1 (accounting for stacking)
  const cumulativeTaxShock3Year = additionalTaxY1 * 5;

  const amendmentOpportunity =
    filingStatus === "all_old_rules" ||
    filingStatus === "some_unsure";

  // Exposure classification
  let exposureStatus: ExposureStatus;
  if (filingStatus === "not_yet_filed") {
    exposureStatus = "PROACTIVE_PLANNING";
  } else if (filingStatus === "all_old_rules") {
    exposureStatus = "AMENDMENT_RISK";
  } else if (filingStatus === "some_unsure") {
    exposureStatus = "AMBIGUOUS_FILING";
  } else if (rdSpend < 100000) {
    exposureStatus = "LOW_IMPACT";
  } else {
    exposureStatus = "MATERIAL_SHOCK";
  }

  return {
    rdSpend,
    domesticRd,
    foreignRd,
    entityType,
    taxRate,
    year1DeductionNewRules,
    year1DeductionOldRules,
    additionalTaxableY1,
    additionalTaxY1,
    cumulativeTaxShock3Year,
    filingStatus,
    amendmentOpportunity,
    exposureStatus,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcR174(answers);

  // ── AMENDMENT RISK — filed under wrong rules ──────────────────────────────
  if (result.exposureStatus === "AMENDMENT_RISK") {
    return {
      status: "AMENDMENT RISK — FILED UNDER PRE-2022 RULES FOR POST-2021 YEARS",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Under the 2022 amendment to Section 174, R&D costs for tax years beginning after December 31, 2021 must be amortized — not immediately expensed. If you filed 2022-2024 returns claiming immediate expensing, your returns are likely incorrect and you have audit exposure. Year 1 shock on ${formatUSD(result.rdSpend)} R&D: approximately ${formatUSD(result.additionalTaxY1)} in additional tax you should have paid but did not.`,
      stats: [
        { label: "R&D spend", value: formatUSD(result.rdSpend), highlight: true },
        { label: "Additional tax year 1", value: formatUSD(result.additionalTaxY1), highlight: true },
        { label: "3-year cumulative risk", value: formatUSD(result.cumulativeTaxShock3Year), highlight: true },
      ],
      consequences: [
        `🔒 Filing risk: tax years 2022, 2023, and 2024 were subject to the 2022 amendment to IRC §174 — domestic R&D amortized over 5 years (10% year 1, 20% years 2-5, 10% year 6), foreign R&D over 15 years. If you claimed immediate expensing for those years, the returns are likely incorrect.`,
        `🔒 On ${formatUSD(result.rdSpend)} of R&D (${(result.foreignRd / result.rdSpend * 100).toFixed(0)}% foreign, ${(result.domesticRd / result.rdSpend * 100).toFixed(0)}% domestic), year 1 deduction under the amendment is approximately ${formatUSD(result.year1DeductionNewRules)} — not the full ${formatUSD(result.year1DeductionOldRules)}. Additional taxable income: ${formatUSD(result.additionalTaxableY1)}. Tax shortfall at your entity rate (${(result.taxRate * 100).toFixed(0)}%): ${formatUSD(result.additionalTaxY1)} per year.`,
        `🔒 Cumulative 3-year exposure (2022+2023+2024 with stacking amortization from prior years): approximately ${formatUSD(result.cumulativeTaxShock3Year)}. This is tax that you SHOULD have paid under correct application of the amendment. Penalties and interest accrue from original due dates.`,
        `🔓 Corrective action paths: (a) file amended returns (Form 1120X for C-corps, Form 1040X for individuals, Form 1065X for partnerships) for each affected year, (b) file a change-in-accounting-method request (Form 3115) to catch up on prior deductions via a section 481(a) adjustment, or (c) voluntary disclosure via the IRS Voluntary Disclosure Program if concerned about penalties.`,
        `Form 3115 approach: if you switched mid-stream from old treatment to new (or never properly switched), a Form 3115 can catch up the missed amortization pattern — often the preferred path for established companies that continued old habits post-2022.`,
        `IRS enforcement: Rev. Proc. 2023-8 provides implementation guidance for the amendment. IRS examinations of 2022-2024 returns are beginning to focus on Section 174 compliance — amendments before examination are treated more favorably than corrections after.`,
      ],
      beforeAfter: {
        beforeLabel: `Filed (pre-2022 rules) — ${formatUSD(result.rdSpend)} R&D year 1`,
        beforeRows: [
          { label: "Year 1 deduction claimed", value: formatUSD(result.year1DeductionOldRules) },
          { label: "Tax deduction value (at " + (result.taxRate * 100).toFixed(0) + "%)", value: formatUSD(result.year1DeductionOldRules * result.taxRate) },
          { label: "Tax paid (on R&D)", value: "$0 (fully offset)" },
        ],
        afterLabel: `Correct (2022 amendment) — ${formatUSD(result.rdSpend)} R&D year 1`,
        afterRows: [
          { label: "Year 1 deduction allowed", value: formatUSD(result.year1DeductionNewRules) },
          { label: "Remaining deduction (years 2-6)", value: formatUSD(result.rdSpend - result.year1DeductionNewRules) },
          { label: "Additional tax owed (year 1)", value: formatUSD(result.additionalTaxY1) },
        ],
      },
      confidence: "HIGH",
      confidenceNote: "The 2022 amendment to IRC §174 is statutory law for tax years beginning after December 31, 2021. Filing returns under pre-2022 rules for post-2021 years is a substantive compliance failure.",
      tier: 147,
      ctaLabel: "Get My Amendment + Recovery Plan — $147 →",
      altTierLabel: "Just want the exposure audit? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── AMBIGUOUS FILING — review needed ─────────────────────────────────────
  if (result.exposureStatus === "AMBIGUOUS_FILING") {
    return {
      status: "FILING STATUS UNCLEAR — REVIEW NEEDED",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `You are not sure whether your 2022, 2023, or 2024 returns correctly applied the 2022 amendment to Section 174. At your R&D spend level (${formatUSD(result.rdSpend)}), the cashflow impact is material — approximately ${formatUSD(result.additionalTaxY1)} additional tax in year 1 if amortization was NOT applied, or ${formatUSD(result.additionalTaxY1)} you correctly paid if it WAS. You need to know which.`,
      stats: [
        { label: "R&D spend", value: formatUSD(result.rdSpend), highlight: true },
        { label: "Annual cashflow impact", value: formatUSD(result.additionalTaxY1), highlight: true },
        { label: "3-year cumulative", value: formatUSD(result.cumulativeTaxShock3Year), highlight: true },
      ],
      consequences: [
        `⚠ Your filings may or may not have correctly applied the 2022 amendment to IRC §174. At ${formatUSD(result.rdSpend)} of R&D, the distinction matters — year 1 tax difference is ${formatUSD(result.additionalTaxY1)}.`,
        "Action step 1 — check your tax preparation software or accountant's files for 2022, 2023, 2024 returns. Look for: (a) Form 4562 (Depreciation and Amortization) with Section 174 R&E capitalization entries, (b) Schedule M-1 reconciliation showing timing differences, (c) amortization schedules attached to the return.",
        "Action step 2 — if Section 174 amortization is NOT reflected on prior returns, you likely filed under pre-2022 rules (which is incorrect for post-2021 years). See the AMENDMENT RISK verdict path above for corrective action.",
        "Action step 3 — if amortization IS reflected, verify it used correct percentages: 10% year 1 + 20% years 2-5 + 10% year 6 for domestic; 3.33% year 1 + 6.67% years 2-15 + 3.33% year 16 for foreign. Incorrect percentages can trigger audit adjustments.",
        `Cumulative risk: ${formatUSD(result.cumulativeTaxShock3Year)} potential tax shortfall across 2022-2024 if filed under wrong rules. Penalties and interest accrue from original filing dates.`,
        "Best next step: have your CPA pull all three years' returns and specifically confirm Section 174 treatment. This is a 30-minute review — but the downside is significant if it was wrong.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Cannot confirm compliance without review of actual filings. Section 174 amendment is statutory — incorrect application is a substantive issue.",
      tier: 147,
      ctaLabel: "Get My Filing Review Plan — $147 →",
      altTierLabel: "Just want the audit? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── PROACTIVE PLANNING — not yet filed ───────────────────────────────────
  if (result.exposureStatus === "PROACTIVE_PLANNING") {
    return {
      status: "NOT YET FILED — PROACTIVE PLANNING OPPORTUNITY",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `You have not yet filed the affected tax years — good. Apply the 2022 amendment to Section 174 correctly from the start: domestic R&D amortized over 5 years with half-year convention, foreign over 15 years. On ${formatUSD(result.rdSpend)} R&D, year 1 deduction is approximately ${formatUSD(result.year1DeductionNewRules)} — budget for the cashflow impact.`,
      stats: [
        { label: "R&D spend", value: formatUSD(result.rdSpend) },
        { label: "Year 1 deduction allowed", value: formatUSD(result.year1DeductionNewRules) },
        { label: "Additional tax vs old rules", value: formatUSD(result.additionalTaxY1), highlight: true },
      ],
      consequences: [
        `Good news — you have not yet filed. Apply the 2022 amendment to IRC §174 correctly from the start: domestic R&D amortized over 5 years (half-year convention — 10% year 1), foreign R&D over 15 years (3.33% year 1).`,
        `On ${formatUSD(result.rdSpend)} R&D spend (${(result.domesticRd / result.rdSpend * 100).toFixed(0)}% domestic, ${(result.foreignRd / result.rdSpend * 100).toFixed(0)}% foreign), year 1 deduction: ${formatUSD(result.year1DeductionNewRules)}. Remainder deducted over years 2-6 (domestic) or 2-16 (foreign).`,
        `Cashflow planning: at your entity rate of ${(result.taxRate * 100).toFixed(0)}%, expect approximately ${formatUSD(result.additionalTaxY1)} of additional tax in year 1 compared to pre-2022 expensing. Adjust quarterly estimated tax payments accordingly.`,
        "Classification review: not ALL employee wages and cloud costs are Section 174 expenditures. Ordinary business expenses remain immediately deductible. The distinction matters — proper classification can reduce your Section 174 base by 10-30% in some cases.",
        "Watch Section 174A: proposed under the One Big Beautiful Bill Act (not yet enacted as of April 2026). If enacted, would restore immediate expensing. Monitor for enactment — timing of a filing vs legislative progress may affect planning.",
        "Documentation: maintain detailed records of R&D activities, wages paid to engineers, cloud compute costs directly attributable to development, and contractor payments for qualified research. This documentation supports both Section 174 classification AND Section 41 R&D tax credit claims.",
      ],
      confidence: "HIGH",
      confidenceNote: "2022 amendment is statutory for post-2021 tax years. Correct first-time application avoids amendment costs and audit risk.",
      tier: 147,
      ctaLabel: "Get My Proactive Filing Plan — $147 →",
      altTierLabel: "Just want the basics? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── LOW IMPACT — small R&D spend ──────────────────────────────────────────
  if (result.exposureStatus === "LOW_IMPACT") {
    return {
      status: "LOW IMPACT — MINIMAL CASHFLOW SHOCK",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `At ${formatUSD(result.rdSpend)} of annual R&D spend, the 2022 amendment to Section 174 creates a modest cashflow impact — approximately ${formatUSD(result.additionalTaxY1)} in additional year 1 tax compared to pre-2022 rules. Worth getting right, but not a crisis at this level.`,
      stats: [
        { label: "R&D spend", value: formatUSD(result.rdSpend) },
        { label: "Year 1 tax impact", value: formatUSD(result.additionalTaxY1) },
        { label: "Filing status", value: "Correctly applied ✓" },
      ],
      consequences: [
        `At ${formatUSD(result.rdSpend)} R&D, year 1 cashflow shock from the 2022 amendment is ${formatUSD(result.additionalTaxY1)} — manageable at this scale but still a real cost.`,
        "Section 174 classification: at this level, correct classification between Section 174 expenditures (amortize) and ordinary business expenses (immediately deductible) is especially important. Small mislabels have proportionally larger impact.",
        "Section 41 R&D tax credit: for small and mid-size businesses, the R&D credit often provides MORE value than the deduction itself — up to 10% of qualified research expenses as a direct credit against tax. Check if you qualify.",
        "Monitor Section 174A: proposed legislation under the One Big Beautiful Bill Act (not yet enacted April 2026) would restore immediate expensing. If enacted, the amendment's cashflow impact disappears going forward.",
        "Annual review: even at this scale, confirm your CPA applied the amortization correctly on 2022-2024 returns. A 30-minute review prevents surprises.",
      ],
      confidence: "HIGH",
      confidenceNote: "Section 174 amendment applies regardless of spend level. Compliance is compliance.",
      tier: 67,
      ctaLabel: "Get My Compliance Review — $67 →",
      altTierLabel: "Want the full audit too? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── MATERIAL SHOCK — substantial R&D, compliant filing ───────────────────
  return {
    status: "MATERIAL CASHFLOW SHOCK — PLAN FOR AMORTIZATION STACKING",
    statusClass: "text-red-700",
    panelClass: "border-red-200 bg-red-50",
    headline: `At ${formatUSD(result.rdSpend)} of annual R&D, the 2022 amendment to Section 174 creates a significant year 1 cashflow shock of approximately ${formatUSD(result.additionalTaxY1)}. Across 2022-2024 with amortization stacking from prior years, cumulative tax front-loading is approximately ${formatUSD(result.cumulativeTaxShock3Year)}. This is timing, not permanent — but cashflow matters.`,
    stats: [
      { label: "R&D spend", value: formatUSD(result.rdSpend), highlight: true },
      { label: "Year 1 tax shock", value: formatUSD(result.additionalTaxY1), highlight: true },
      { label: "3-year cumulative", value: formatUSD(result.cumulativeTaxShock3Year), highlight: true },
    ],
    consequences: [
      `At ${formatUSD(result.rdSpend)} R&D spend, year 1 deduction under the 2022 amendment: ${formatUSD(result.year1DeductionNewRules)} (${(result.domesticRd / result.rdSpend * 100).toFixed(0)}% domestic at 10% half-year, ${(result.foreignRd / result.rdSpend * 100).toFixed(0)}% foreign at 3.33% half-year).`,
      `Compared to pre-2022 full expensing, that leaves ${formatUSD(result.additionalTaxableY1)} of additional taxable income in year 1. At your entity rate (${(result.taxRate * 100).toFixed(0)}%): ${formatUSD(result.additionalTaxY1)} of additional tax per year.`,
      `Cumulative impact: across 2022+2023+2024, cumulative year-over-year amortization from prior years' R&D stacks. Approximate 3-year cashflow shock: ${formatUSD(result.cumulativeTaxShock3Year)}. This is tax you pay NOW that you would have deferred or avoided under pre-2022 rules.`,
      "This is TIMING, not a permanent tax increase. The deductions are not lost — they flow through over 5 years (domestic) or 15 years (foreign). Total tax paid across the full amortization period matches pre-2022 treatment. But the front-loading creates real cashflow cost.",
      "Planning levers: (a) Section 41 R&D tax credit — partial offset, can claim up to 10% of QREs as direct credit, (b) quarterly estimated tax adjustments to avoid underpayment penalties, (c) classification review — ensure only true Section 174 expenditures are amortized, not ordinary business expenses, (d) line of credit or debt financing to bridge the cashflow gap.",
      "Monitor Section 174A: proposed under the One Big Beautiful Bill Act (not yet enacted April 2026). If enacted, immediate expensing is restored going forward — but does not automatically fix 2022-2024 amortization schedules already in progress. Those continue on their original schedule.",
    ],
    beforeAfter: {
      beforeLabel: `Pre-2022 rules — ${formatUSD(result.rdSpend)} R&D`,
      beforeRows: [
        { label: "Year 1 deduction", value: formatUSD(result.year1DeductionOldRules) + " (full)" },
        { label: "Year 1 tax on R&D", value: "$0 (fully offset)" },
        { label: "Cashflow: year 1", value: "Deduction fully recognized" },
      ],
      afterLabel: `2022 amendment — ${formatUSD(result.rdSpend)} R&D year 1`,
      afterRows: [
        { label: "Year 1 deduction", value: formatUSD(result.year1DeductionNewRules) },
        { label: "Additional taxable income year 1", value: formatUSD(result.additionalTaxableY1) },
        { label: "Additional tax paid year 1", value: formatUSD(result.additionalTaxY1) },
        { label: "Remaining deduction (years 2-6 domestic / 2-16 foreign)", value: formatUSD(result.rdSpend - result.year1DeductionNewRules) },
      ],
    },
    confidence: "HIGH",
    confidenceNote: "2022 amendment to IRC §174 is statutory law. Cashflow impact calculation uses standard amortization percentages and half-year convention per Rev. Proc. 2023-8.",
    tier: 147,
    ctaLabel: "Get My R&D Cashflow Strategy — $147 →",
    altTierLabel: "Just want the audit? — $67 instead",
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
    id: "rd_spend", step: 1, type: "button_group",
    label: "What is your annual R&D spend?",
    subLabel: "Include engineering / developer wages, qualified contractors, cloud computing for development, and R&D-attributable software costs.",
    options: [
      { label: "Under $100,000",             value: "under_100k",    subLabel: "Modest cashflow impact" },
      { label: "$100,000 – $500,000",         value: "100k_to_500k", subLabel: "Material at this scale" },
      { label: "$500,000 – $2,000,000",       value: "500k_to_2m",   subLabel: "Significant cashflow shock" },
      { label: "Over $2,000,000",             value: "over_2m",       subLabel: "Substantial year 1 tax impact" },
    ],
    required: true,
  },
  {
    id: "rd_location", step: 2, type: "button_group",
    label: "Where is your R&D primarily performed?",
    subLabel: "Domestic R&D amortizes over 5 years under the 2022 amendment. Foreign R&D amortizes over 15 years — bigger cashflow shock.",
    options: [
      { label: "Primarily domestic (US-based)",       value: "domestic", subLabel: "5-year amortization" },
      { label: "Primarily foreign",                    value: "foreign",  subLabel: "15-year amortization — larger shock" },
      { label: "Mix of domestic and foreign",          value: "mixed",    subLabel: "Blended — both schedules apply" },
    ],
    required: true,
  },
  {
    id: "entity_type", step: 3, type: "button_group",
    label: "What is your business entity type?",
    subLabel: "Entity type determines the tax rate applied to additional income from the amortization timing shift.",
    options: [
      { label: "C-Corporation",                                    value: "c_corp",        subLabel: "21% federal corporate rate" },
      { label: "S-Corporation / Partnership / LLC pass-through",   value: "pass_through",  subLabel: "Personal rates — typically 30-37%" },
      { label: "Sole proprietor",                                   value: "sole_prop",     subLabel: "Personal + SE tax — typically 25-37%" },
    ],
    required: true,
  },
  {
    id: "filing_status", step: 4, type: "button_group",
    label: "Have you filed 2022, 2023, 2024 returns — and under which rules?",
    subLabel: "Filing status determines whether you need to AMEND (wrong rules), REVIEW (unclear), or PLAN PROACTIVELY (not yet filed).",
    options: [
      { label: "All filed — under OLD immediate expensing rules", value: "all_old_rules", subLabel: "Amendment risk — likely incorrect" },
      { label: "All filed — correctly under amortization",         value: "all_correct",   subLabel: "Compliant — review for optimization" },
      { label: "Some filed — unsure which rules applied",           value: "some_unsure",  subLabel: "Need to verify prior filings" },
      { label: "Not yet filed one or more of these years",          value: "not_yet_filed", subLabel: "Proactive planning opportunity" },
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

      {/* Three-period legal status — CRITICAL for this product */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Three legal periods — Section 174 timeline</p>
        <div className="space-y-1.5 text-neutral-800">
          <p><strong>Pre-2022:</strong> R&amp;D costs immediately deductible (old Section 174).</p>
          <p><strong>2022-2024:</strong> Mandatory amortization — domestic 5 years, foreign 15 years (TCJA amendment, effective for tax years beginning after December 31, 2021).</p>
          <p><strong>2025+ (proposed):</strong> Section 174A under the One Big Beautiful Bill Act would restore immediate expensing. Not yet enacted as of April 2026.</p>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Cashflow breakdown */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your Section 174 cashflow math</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Annual R&amp;D spend</span>
            <span className="font-mono font-bold text-neutral-950">{formatUSD(verdict.result.rdSpend)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Domestic R&amp;D (5-year amortization)</span>
            <span className="font-mono text-neutral-950">{formatUSD(verdict.result.domesticRd)}</span>
          </div>
          {verdict.result.foreignRd > 0 && (
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Foreign R&amp;D (15-year amortization)</span>
              <span className="font-mono text-neutral-950">{formatUSD(verdict.result.foreignRd)}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Year 1 deduction under 2022 amendment</span>
            <span className="font-mono font-bold text-neutral-950">{formatUSD(verdict.result.year1DeductionNewRules)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Year 1 deduction under pre-2022 rules (old)</span>
            <span className="font-mono text-emerald-700">{formatUSD(verdict.result.year1DeductionOldRules)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Additional taxable income year 1</span>
            <span className="font-mono font-bold text-red-700">{formatUSD(verdict.result.additionalTaxableY1)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Entity tax rate</span>
            <span className="font-mono text-neutral-950">{(verdict.result.taxRate * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="font-semibold text-neutral-800">Additional tax year 1 (cashflow shock)</span>
            <span className="font-mono font-bold text-red-700">{formatUSD(verdict.result.additionalTaxY1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-neutral-800">Cumulative 3-year shock (with stacking)</span>
            <span className="font-mono font-bold text-red-700">{formatUSD(verdict.result.cumulativeTaxShock3Year)}</span>
          </div>
        </div>
      </div>

      {/* Before / After block */}
      {verdict.beforeAfter && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">Pre-2022 rules</p>
            <p className="mb-2 text-sm font-bold text-emerald-900">{verdict.beforeAfter.beforeLabel}</p>
            <div className="space-y-1 text-xs">
              {verdict.beforeAfter.beforeRows.map(r => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-emerald-800">{r.label}</span>
                  <span className="font-mono font-bold text-emerald-900">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-red-700">2022 amendment (current)</p>
            <p className="mb-2 text-sm font-bold text-red-900">{verdict.beforeAfter.afterLabel}</p>
            <div className="space-y-1 text-xs">
              {verdict.beforeAfter.afterRows.map(r => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-red-800">{r.label}</span>
                  <span className="font-mono font-bold text-red-900">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fear framing — for material exposure */}
      {(verdict.result.exposureStatus === "MATERIAL_SHOCK" || verdict.result.exposureStatus === "AMENDMENT_RISK") && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ The cashflow shock the 2022 amendment created</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-1">
            Year 1 tax impact: {formatUSD(verdict.result.additionalTaxY1)} on {formatUSD(verdict.result.rdSpend)} R&amp;D. Cumulative 3-year: {formatUSD(verdict.result.cumulativeTaxShock3Year)}.
          </p>
          <p className="text-xs text-red-800 leading-relaxed">
            This is timing, not a permanent tax increase. The deductions flow through over 5 (domestic) or 15 (foreign) years. But cashflow in years 1-3 is where the damage is felt. Many businesses did not budget for this — and some are still filing under the wrong rules, creating audit exposure on top of the cashflow impact.
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
          <strong className="text-neutral-950">This is timing, not permanent tax.</strong> Under the 2022 amendment, R&amp;D costs are still fully deductible — just spread over 5 or 15 years instead of year 1. The total tax over the amortization period matches pre-2022 treatment. But the cashflow front-loading is real — and for businesses that filed under the wrong rules, amendment is required.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Year-by-year amortization schedule for your exact R&amp;D spend</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Retroactive amendment analysis if prior returns used wrong rules</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Section 174 vs ordinary expense classification checklist</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Section 41 R&amp;D tax credit stacking opportunity</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 CPA questions written for your exact situation</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your R&amp;D spend, entity, and filing history</p>
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

export default function Section174AuditorCalculator() {
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
        product_slug: "section-174-auditor",
        source_path: "/us/check/section-174-auditor",
        country_code: "US", currency_code: "USD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          exposure_status: verdict.result.exposureStatus,
          rd_spend: verdict.result.rdSpend,
          year1_deduction_new: verdict.result.year1DeductionNewRules,
          additional_tax_y1: verdict.result.additionalTaxY1,
          cumulative_3year: verdict.result.cumulativeTaxShock3Year,
          amendment_opportunity: verdict.result.amendmentOpportunity,
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
      body: JSON.stringify({ email, source: "section_174_auditor", country_code: "US", site: "taxchecknow" }),
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
    const sid = sessionId || `s174_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("section-174-auditor_rd_spend", String(answers.rd_spend || ""));
    sessionStorage.setItem("section-174-auditor_rd_location", String(answers.rd_location || ""));
    sessionStorage.setItem("section-174-auditor_entity_type", String(answers.entity_type || ""));
    sessionStorage.setItem("section-174-auditor_filing_status", String(answers.filing_status || ""));
    sessionStorage.setItem("section-174-auditor_exposure_status", verdict.result.exposureStatus);
    sessionStorage.setItem("section-174-auditor_additional_tax_y1", String(Math.round(verdict.result.additionalTaxY1)));
    sessionStorage.setItem("section-174-auditor_cumulative_3year", String(Math.round(verdict.result.cumulativeTaxShock3Year)));
    sessionStorage.setItem("section-174-auditor_amendment_opportunity", String(verdict.result.amendmentOpportunity));
    sessionStorage.setItem("section-174-auditor_status", verdict.status);
    sessionStorage.setItem("section-174-auditor_tier", String(popupTier));

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
          success_url: `${window.location.origin}/us/check/section-174-auditor/success/${successPath}`,
          cancel_url: `${window.location.origin}/us/check/section-174-auditor`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your Section 174 exposure and amendment opportunity for your CPA.</p>
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
                    {popupTier === 67 ? "Your Section 174 Audit Pack" : "Your R&D Cashflow Strategy Pack"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">IRS-referenced · IRC §174 · Rev. Proc. 2023-8 · April 2026</p>
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
                      {popupTier === 67 ? "Section 174 Audit Pack™" : "R&D Cashflow Strategy Pack™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your exact Section 174 amortization schedule, prior-year filing review, Section 41 R&D credit screening, classification checklist, and 5 CPA questions — built around your R&D spend and filing history."
                        : "Full cashflow strategy: amendment path for prior years if needed, Section 41 credit stacking, Section 174 vs ordinary expense classification audit, Section 174A planning for potential enactment, and CPA coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic R&D tax article. Your specific amortization schedule + amendment opportunity.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Section 174 Audit →" : "Get My Strategy Pack →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the audit? — $67 instead" : "Want the full strategy? — $147 instead"}
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
                    { label: "Business stage", key: "entity_type", options: [["startup","Early-stage startup"],["growth","Growth-stage (Series A+)"],["established","Established company"],["agency","Agency / consultancy"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["acting_now","Acting before next filing"],["planning","Planning for 2025-26 returns"],["just_checking","Just checking my position"]] },
                    { label: "Do you have a CPA?", key: "accountant", options: [["cpa","Yes — dedicated CPA"],["firm","Yes — tax firm"],["diy","DIY / TurboTax"],["none","No — looking for one"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · IRS-sourced content</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile sticky bar */}
      {showVerdict && verdict && (verdict.result.exposureStatus === "MATERIAL_SHOCK" || verdict.result.exposureStatus === "AMENDMENT_RISK") && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Year 1 cashflow shock</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatUSD(verdict.result.additionalTaxY1)} ({formatUSD(verdict.result.cumulativeTaxShock3Year)} over 3 years)
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
