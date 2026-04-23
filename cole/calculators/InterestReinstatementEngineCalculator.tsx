"use client";

/**
 * NZ-03 — Property Interest Deductibility Recovery Engine
 * (formerly Interest Reinstatement Engine)
 * Pattern: Timeline (Module B) + CashflowModel (Module F)
 *
 * Four regimes by purchase date and property type:
 *   Before 1 Oct 2021:            100% deductible (original)
 *   1 Oct 2021 – 31 Mar 2024:     phased removal — 0% for most existing residential
 *   1 Apr 2024 – 31 Mar 2025:     80% deductible (first restoration step)
 *   From 1 Apr 2025:              100% deductible (full restoration — current)
 *
 *   New builds (post-July 2020) and commercial: never restricted.
 *
 * Legal anchor: Income Tax Act 2007, section DB 2. Restored by the Taxation
 * (Annual Rates for 2023-24, Multinational Tax, and Remedial Matters) Act 2024.
 *
 * Ownership structure determines WHERE the deduction is claimed:
 *   Individual → personal return at marginal rate
 *   Company    → company return at 28%
 *   Trust      → trust return at 33%
 *   LTC        → flows to shareholders at personal marginal rate
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type RecoveryStatus =
  | "RECOVERY_RESTORED_EXISTING"
  | "RECOVERY_NEW_BUILD"
  | "RECOVERY_COMMERCIAL"
  | "HOLD_PREFERRED_RECOVERY"
  | "HOLD_BRIGHT_LINE_INTERACT"
  | "OWNERSHIP_STRUCTURE_REVIEW";

interface RecoveryResult {
  purchaseDate:    string;
  propertyType:    string;
  annualInterest:  number;
  ownership:       string;
  marginalRate:    number;
  marginalRateLabel: string;
  saleConsidering: string;

  currentDeductiblePct:       number;
  currentYearTaxSaving:       number;
  restrictionPeriodTaxSaving: number;
  annualRecovery:             number;
  cumulative3YrRecovery:      number;
  netInterestCostNow:         number;
  netInterestCostRestriction: number;

  structureNote: string;
  structureRate: string;

  brightLineInteraction: boolean;
  status: RecoveryStatus;
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
  result: RecoveryResult;
}

interface PopupAnswers {
  owner_role: string;
  urgency: string;
  accountant: string;
}

const INTEREST_MIDPOINT: Record<string, number> = {
  under_10k:   7_500,
  "10k_25k":   17_500,
  "25k_50k":   37_500,
  over_50k:    75_000,
};

const MARGINAL_RATE: Record<string, { rate: number; label: string }> = {
  "17_5": { rate: 0.175, label: "17.5%" },
  "30":    { rate: 0.30,  label: "30%" },
  "33":    { rate: 0.33,  label: "33%" },
  "39":    { rate: 0.39,  label: "39%" },
};

const STRUCTURE_INFO: Record<string, { note: string; rate: string }> = {
  individual: { note: "Claimed on personal tax return at your marginal rate.",                                        rate: "Personal marginal (up to 39%)" },
  company:    { note: "Claimed on company return at the 28% company tax rate.",                                       rate: "28% (company rate)" },
  trust:      { note: "Claimed on trust return at the 33% trustee rate (or distributed to beneficiaries at their marginal rates).", rate: "33% (trustee rate) or beneficiary marginal" },
  ltc:        { note: "Look-Through Company flows deductions through to shareholders at their personal marginal rate.", rate: "Shareholder marginal rate" },
};

const PRODUCT_KEYS = {
  p67:  "nz_67_interest_reinstatement_engine",
  p147: "nz_147_interest_reinstatement_engine",
};

function formatNZD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-NZ");
}

function formatNZDPerYear(n: number): string {
  return formatNZD(n) + "/yr";
}

function calcRecovery(answers: AnswerMap): RecoveryResult {
  const purchaseDate    = String(answers.purchase_date    || "pre_oct_2021");
  const propertyType    = String(answers.property_type    || "existing_residential");
  const interestKey     = String(answers.annual_interest  || "10k_25k");
  const ownership       = String(answers.ownership        || "individual");
  const rateKey         = String(answers.marginal_rate    || "33");
  const saleConsidering = String(answers.sale_considering || "no");

  const annualInterest = INTEREST_MIDPOINT[interestKey] ?? 17_500;
  const rateInfo = MARGINAL_RATE[rateKey] ?? { rate: 0.33, label: "33%" };

  let effectiveClaimRate = rateInfo.rate;
  if (ownership === "company") effectiveClaimRate = 0.28;
  else if (ownership === "trust") effectiveClaimRate = 0.33;

  const currentDeductiblePct = 100;
  const currentYearTaxSaving = annualInterest * 1.0 * effectiveClaimRate;
  const restrictionPeriodTaxSaving = 0;
  const annualRecovery = currentYearTaxSaving - restrictionPeriodTaxSaving;
  const cumulative3YrRecovery = annualRecovery * 3;
  const netInterestCostNow = annualInterest - currentYearTaxSaving;
  const netInterestCostRestriction = annualInterest;

  const structureInfo = STRUCTURE_INFO[ownership] ?? STRUCTURE_INFO.individual;

  const brightLineInteraction = purchaseDate === "post_apr_2024" && (saleConsidering === "yes" || saleConsidering === "maybe");

  let status: RecoveryStatus;
  if (propertyType === "new_build") {
    status = "RECOVERY_NEW_BUILD";
  } else if (propertyType === "commercial") {
    status = "RECOVERY_COMMERCIAL";
  } else if (brightLineInteraction) {
    status = "HOLD_BRIGHT_LINE_INTERACT";
  } else if (saleConsidering === "yes" || saleConsidering === "maybe") {
    status = "HOLD_PREFERRED_RECOVERY";
  } else if (ownership !== "individual") {
    status = "OWNERSHIP_STRUCTURE_REVIEW";
  } else {
    status = "RECOVERY_RESTORED_EXISTING";
  }

  return {
    purchaseDate, propertyType, annualInterest, ownership,
    marginalRate: rateInfo.rate, marginalRateLabel: rateInfo.label,
    saleConsidering,
    currentDeductiblePct, currentYearTaxSaving, restrictionPeriodTaxSaving,
    annualRecovery, cumulative3YrRecovery,
    netInterestCostNow, netInterestCostRestriction,
    structureNote: structureInfo.note, structureRate: structureInfo.rate,
    brightLineInteraction,
    status,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcRecovery(answers);

  const commonStats = [
    { label: "Current deductibility",     value: result.currentDeductiblePct + "%",                 highlight: false },
    { label: "Annual tax saving",          value: formatNZDPerYear(result.currentYearTaxSaving),    highlight: true },
    { label: "3-year cumulative recovery", value: formatNZD(result.cumulative3YrRecovery),         highlight: true },
  ];

  if (result.status === "RECOVERY_RESTORED_EXISTING") {
    return {
      status: "RECOVERY COMPLETE — 100% DEDUCTIBILITY RESTORED",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `From 1 April 2025, 100% of your mortgage interest on this existing residential investment property is deductible again. On ${formatNZDPerYear(result.annualInterest)} of interest at your ${result.marginalRateLabel} marginal rate, that is ${formatNZDPerYear(result.currentYearTaxSaving)} of tax saving back in your pocket — recovering from the restriction period when this was ${formatNZD(0)}. Over 3 years, cumulative recovery is approximately ${formatNZD(result.cumulative3YrRecovery)}.`,
      stats: commonStats,
      consequences: [
        `✓ Current rate: 100% of mortgage interest deductible under section DB 2 of the Income Tax Act 2007 (as restored by the Taxation (Annual Rates for 2023-24, Multinational Tax, and Remedial Matters) Act 2024).`,
        `Cashflow math: ${formatNZDPerYear(result.annualInterest)} interest × ${result.marginalRateLabel} = ${formatNZDPerYear(result.currentYearTaxSaving)} tax saving restored. Net interest cost: ${formatNZDPerYear(result.netInterestCostNow)} (vs ${formatNZDPerYear(result.annualInterest)} during restriction when deductibility was 0%).`,
        "Timeline context: restriction ran 1 October 2021 to 31 March 2024 (0% for most existing residential). Restoration was staged — 80% from 1 April 2024, then 100% from 1 April 2025. We are now past both steps.",
        "Claim mechanics: the deduction flows through your rental income schedule in your personal tax return. Annual interest statement from your bank goes directly into the rental expenses section. No separate application — the legislation does the work.",
        "Ring-fencing rules (2019) REMAIN in place. Rental losses (interest + other expenses minus rental income) cannot offset your salary or business income. They carry forward to offset future rental income or gains on property disposal. Full deductibility restoration does not remove ring-fencing.",
        "Documentation to retain: annual interest certificate from lender, loan agreement, settlement statement showing rental purpose of original borrowing, records of any refinance and what funds were used for. Keep for 7 years — IRD can audit rental deductions retrospectively.",
        "Loan tracing: if you have refinanced or topped up, the nexus between the borrowing and rental use must be documented. Mixed loans (part rental, part personal) require a split — usually by asking the bank to formally separate the loan into two facilities.",
      ],
      confidence: "HIGH",
      confidenceNote: "Existing residential, individual ownership, restoration fully in effect from 1 April 2025. Standard case.",
      tier: 67,
      ctaLabel: "Get My Recovery Calculation Pack — $67 →",
      altTierLabel: "Have refinanced / multiple properties? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "RECOVERY_NEW_BUILD") {
    return {
      status: "NEW BUILD — DEDUCTIBILITY NEVER RESTRICTED",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Properties constructed after July 2020 were never subject to the 2021-2024 interest limitation. You have always been entitled to 100% interest deductibility. On ${formatNZDPerYear(result.annualInterest)} of interest at your ${result.marginalRateLabel} marginal rate, that is ${formatNZDPerYear(result.currentYearTaxSaving)} of annual tax saving — unchanged by the restoration, which only affected existing residential properties.`,
      stats: commonStats,
      consequences: [
        `✓ New build exemption: the interest limitation introduced in October 2021 specifically excluded new builds (post-July 2020). Investors in new builds retained full 100% deductibility throughout the restriction period.`,
        `Position today is identical to position during restriction — 100% deductible. The restoration does not add anything new to your case; it brings existing residential owners into the same position.`,
        `Cashflow: ${formatNZDPerYear(result.annualInterest)} × ${result.marginalRateLabel} = ${formatNZDPerYear(result.currentYearTaxSaving)} tax saving annually. Net interest cost: ${formatNZDPerYear(result.netInterestCostNow)}.`,
        "Portfolio consideration: if you hold both new builds AND existing residential, note that BOTH categories are now 100% deductible from 1 April 2025. During 2021-2024 you had two different treatments on the same portfolio. This simplification matters for bookkeeping.",
        "What counts as 'new build': a self-contained residential dwelling with a Code Compliance Certificate (CCC) confirming it was added to NZ residential dwelling stock on or after 27 March 2020. Conversions and subdivisions may or may not qualify — depends on circumstances.",
        "Documentation: the CCC date is the key evidentiary document. Keep it filed. If challenged on new build status, this is what IRD asks for first.",
        "Ring-fencing: still applies — rental losses cannot offset other income.",
      ],
      confidence: "HIGH",
      confidenceNote: "New build exemption means deductibility has always been 100%. No change from restoration — just continuity.",
      tier: 67,
      ctaLabel: "Get My New-Build Documentation Pack — $67 →",
      altTierLabel: "Mixed portfolio analysis? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "RECOVERY_COMMERCIAL") {
    return {
      status: "COMMERCIAL PROPERTY — ALWAYS DEDUCTIBLE",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Commercial property was never subject to the 2021-2024 interest limitation — that regime was specifically targeted at residential rental investment. Your 100% deductibility has been continuous. On ${formatNZDPerYear(result.annualInterest)} of interest at your ${result.marginalRateLabel} marginal rate, that is ${formatNZDPerYear(result.currentYearTaxSaving)} of annual tax saving.`,
      stats: commonStats,
      consequences: [
        `✓ Commercial property interest has always been deductible under section DB 2 of the Income Tax Act 2007. The 2021-2024 limitation applied only to RESIDENTIAL rental property.`,
        `Cashflow: ${formatNZDPerYear(result.annualInterest)} × ${result.marginalRateLabel} = ${formatNZDPerYear(result.currentYearTaxSaving)} tax saving annually.`,
        "Classification matters: commercial vs residential is based on zoning and actual use, not structure type. Mixed-use properties (retail on ground floor, residential above) may require apportionment between commercial (always deductible) and residential (restricted then restored).",
        "Ring-fencing does NOT apply to commercial — commercial rental losses can offset other income (subject to general loss rules). Significant difference from residential.",
        "GST on commercial: commercial rental is a taxable supply for GST (unlike residential rental which is exempt). If GST registered, input tax credits on commercial property expenses are claimable. GST and income tax interaction on commercial property worth reviewing with your accountant.",
        "Documentation: commercial loan agreements, lease agreements with tenants, annual interest certificates. Deductibility evidence is straightforward; the work is in GST treatment if you are registered.",
      ],
      confidence: "HIGH",
      confidenceNote: "Commercial property has been outside the residential interest limitation regime throughout.",
      tier: 67,
      ctaLabel: "Get My Commercial Property Pack — $67 →",
      altTierLabel: "Mixed residential + commercial? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "HOLD_BRIGHT_LINE_INTERACT") {
    return {
      status: "HOLD vs SELL — DOUBLE COST IF YOU SELL NOW",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Selling in the next 12 months creates a DOUBLE cost: (1) lost future interest deductibility — ${formatNZDPerYear(result.currentYearTaxSaving)} per year going forward, and (2) bright-line tax exposure — this property was purchased on or after 1 April 2024 and is subject to the current 2-year bright-line rule (any profit taxed as income at your marginal rate if the sale agreement is signed within 2 years of purchase). Each year you hold is ${formatNZDPerYear(result.currentYearTaxSaving)} recovered.`,
      stats: [
        { label: "Annual recovery if held",       value: formatNZDPerYear(result.currentYearTaxSaving), highlight: true },
        { label: "Bright-line exposure if sold",  value: "2-year rule applies",                         highlight: true },
        { label: "3-year cumulative recovery",     value: formatNZD(result.cumulative3YrRecovery),       highlight: true },
      ],
      consequences: [
        `⚠ Dual tax cost of early exit: (a) lost annual deduction — every year not held is ${formatNZDPerYear(result.currentYearTaxSaving)} of tax saving forgone; (b) bright-line tax — if the sale agreement is signed within 2 years of your post-1 April 2024 settlement, the full profit is taxed as income at your marginal rate.`,
        "Bright-line rule (current): 2 years from settlement to AGREEMENT signing — not to settlement of the sale. Agreement date is the test. A property can settle after the 2-year period ends and still be taxed if the agreement was signed before. See the Bright-Line Property Tax Decision Engine for the full timing analysis.",
        `Hold-through math: ${formatNZDPerYear(result.currentYearTaxSaving)} × 3 years = ${formatNZD(result.cumulative3YrRecovery)} of cumulative tax saving. This is in addition to any bright-line tax avoided.`,
        "Exit optimisation: if sale is truly necessary, agreement date should fall OUTSIDE the 2-year bright-line window from original settlement. This removes the bright-line component while still forgoing the interest deduction from the sale date forward. Agreement timing is the sole lever.",
        "Cashflow reality: the $6,600/year recovery figure (at 33% on $20k interest) is not marginal. It is the difference between a property that breaks even and a property that generates positive cashflow. Many investors who entered during restriction are only now seeing the property make sense on cashflow terms.",
        "Main home exemption: if this property was predominantly your main home (not rented out), the bright-line test may be avoided via the main home exemption. Interest deductions only apply if the property is rental.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Bright-line and interest deductibility are two independent statutes. Holding maximises interest recovery; agreement date controls bright-line exposure.",
      tier: 147,
      ctaLabel: "Get My Hold-vs-Sell + Bright-Line Analysis — $147 →",
      altTierLabel: "Just want the recovery math? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "HOLD_PREFERRED_RECOVERY") {
    return {
      status: "HOLD PREFERRED — RECOVERY ECONOMICS ARGUE AGAINST SELLING",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `You are considering selling. The restored 100% interest deductibility from 1 April 2025 delivers ${formatNZDPerYear(result.currentYearTaxSaving)} of annual tax saving. Each year you hold rather than sell is ${formatNZDPerYear(result.currentYearTaxSaving)} in additional cashflow vs exit. Cumulative over 3 years: ${formatNZD(result.cumulative3YrRecovery)}. Unless there is a specific reason to sell (capital need, market call, lifestyle change), recovery economics strongly argue for holding.`,
      stats: commonStats,
      consequences: [
        `✓ Recovery economics: ${formatNZDPerYear(result.annualInterest)} interest × ${result.marginalRateLabel} × 100% deductibility = ${formatNZDPerYear(result.currentYearTaxSaving)} annual tax saving. This was ${formatNZD(0)} during the 2021-2024 restriction — the entire amount is recovered.`,
        `Cumulative hold value: ${formatNZD(result.cumulative3YrRecovery)} over 3 years. Over a typical remaining hold period (5-10 years), cumulative recovery is ${formatNZD(result.cumulative3YrRecovery * 2)} to ${formatNZD(result.cumulative3YrRecovery * 3)}.`,
        "Bright-line note: if the property was purchased before 1 April 2024 under an earlier regime, the bright-line period may be 5 years or 10 years instead of 2. Check the Bright-Line Property Tax Decision Engine for your specific rule based on purchase date.",
        "Reasons to sell that may override: (a) capital required for higher-return opportunity; (b) property-specific problems (leaky building, high-needs tenants, unsustainable maintenance); (c) personal/family circumstances require liquidity; (d) market concentration in a declining region.",
        "Agreement-date timing: if sale does proceed, ensure the agreement is signed OUTSIDE any applicable bright-line period. Agreement date — not settlement date — is the bright-line test.",
        `Structure: your ownership is ${result.ownership === "individual" ? "individual — deduction flows to your personal return at marginal rate" : "not individual — " + result.structureNote}. 100% deductibility applies regardless; only the claim location and effective rate differ.`,
      ],
      confidence: "MEDIUM",
      confidenceNote: "Recovery economics favour holding. Specific reasons to sell may override, but the cashflow impact is material and recurring.",
      tier: 147,
      ctaLabel: "Get My Hold-vs-Sell Decision Pack — $147 →",
      altTierLabel: "Just want the recovery math? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  return {
    status: `OWNERSHIP STRUCTURE REVIEW — ${result.ownership.toUpperCase()}`,
    statusClass: "text-neutral-700",
    panelClass: "border-neutral-200 bg-neutral-50",
    headline: `100% interest deductibility applies from 1 April 2025 on existing residential property regardless of ownership structure. What changes with your ${result.ownership === "trust" ? "trust" : result.ownership === "company" ? "company" : "LTC"} is WHERE the deduction is claimed and at WHAT RATE. Effective claim: ${result.structureRate}. Annual tax saving: ${formatNZDPerYear(result.currentYearTaxSaving)}.`,
    stats: [
      { label: "Deductibility",            value: result.currentDeductiblePct + "%" },
      { label: "Effective claim rate",       value: result.structureRate,                           highlight: true },
      { label: "Annual tax saving",          value: formatNZDPerYear(result.currentYearTaxSaving), highlight: true },
    ],
    consequences: [
      `✓ Restoration applies to the property regardless of who owns it. ${result.structureNote}`,
      `Effective rate: ${result.structureRate}. On ${formatNZDPerYear(result.annualInterest)} of interest, tax saving at this rate is ${formatNZDPerYear(result.currentYearTaxSaving)}.`,
      result.ownership === "ltc" ? "LTC specifics: the Look-Through Company flows losses and profits through to shareholders in proportion to shareholding. Deductions reach shareholders at their personal marginal rate. For a shareholder at 39%, LTC delivers the deduction at 39%; at 17.5%, far less. Consider which shareholders receive which portion." : "",
      result.ownership === "trust" ? "Trust specifics: resident trusts pay tax at 33% on trustee income (39% for trustee income above $10k in certain circumstances under post-2024 rules). Distributed beneficiary income is taxed at beneficiary's marginal rate. Who receives the deduction affects effective rate." : "",
      result.ownership === "company" ? "Company specifics: deduction claimed at 28% company rate. Rental profits taxed at 28% (vs up to 39% for individual). Dividend payments to shareholders generate imputation credits. Company structure makes more sense when rental net income is positive and retained." : "",
      "Structure-change consideration: the 2021-2024 restriction changed the calculus for property structures. With full deductibility restored, some structures that made sense during restriction may be less optimal now. Complex structures designed to preserve deductibility are no longer necessary for that purpose. Review whether simplification is worth considering.",
      "Ring-fencing: applies at entity level for trusts and companies; LTC flows losses through and ring-fencing applies at shareholder level. In all cases, rental losses cannot offset non-rental income.",
    ],
    confidence: "MEDIUM",
    confidenceNote: "Deductibility is restored equally across structures. Review is about whether current structure is still optimal given 100% deductibility is back.",
    tier: 147,
    ctaLabel: "Get My Structure Review Pack — $147 →",
    altTierLabel: "Just want the recovery math? — $67 instead",
    productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
    result,
  };
}

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
    id: "purchase_date", step: 1, type: "button_group",
    label: "When did you purchase the property?",
    subLabel: "Purchase date determines which historical regime applied and whether current bright-line interacts with sale.",
    options: [
      { label: "Before 1 October 2021 (pre-restriction)",             value: "pre_oct_2021",       subLabel: "Original 100% applied; now 100% again" },
      { label: "1 October 2021 – 31 March 2024 (during restriction)", value: "oct_2021_mar_2024", subLabel: "Saw phased removal to 0%; now 100% restored" },
      { label: "On or after 1 April 2024 (post-restoration)",        value: "post_apr_2024",     subLabel: "80% then 100%; 2-year bright-line applies to sale" },
    ],
    required: true,
  },
  {
    id: "property_type", step: 2, type: "button_group",
    label: "Property type",
    subLabel: "Determines which regime the property was under and whether the restoration affects you.",
    options: [
      { label: "Existing residential (pre-restriction)",             value: "existing_residential", subLabel: "Was affected; now restored" },
      { label: "New build (constructed after July 2020)",             value: "new_build",            subLabel: "Never restricted — always 100%" },
      { label: "Commercial property",                                 value: "commercial",           subLabel: "Different rules — always deductible" },
    ],
    required: true,
  },
  {
    id: "annual_interest", step: 3, type: "button_group",
    label: "Annual mortgage interest on investment property?",
    subLabel: "Total interest paid on loans used to acquire, improve, or maintain rental property.",
    options: [
      { label: "Under $10,000",        value: "under_10k", subLabel: "Modest portfolio" },
      { label: "$10,000 – $25,000",     value: "10k_25k",  subLabel: "Single rental typical" },
      { label: "$25,000 – $50,000",     value: "25k_50k",  subLabel: "Larger single or 2-property portfolio" },
      { label: "Over $50,000",          value: "over_50k", subLabel: "Multi-property portfolio" },
    ],
    required: true,
  },
  {
    id: "ownership", step: 4, type: "button_group",
    label: "Ownership structure?",
    subLabel: "Determines where the deduction is claimed and at which effective rate.",
    options: [
      { label: "Individual (personal ownership)",    value: "individual", subLabel: "Personal return at marginal rate" },
      { label: "Company",                             value: "company",    subLabel: "Company return at 28%" },
      { label: "Trust",                                 value: "trust",      subLabel: "Trust return at 33% or distributed" },
      { label: "Look-Through Company (LTC)",            value: "ltc",        subLabel: "Flows to shareholders at marginal rate" },
    ],
    required: true,
  },
  {
    id: "marginal_rate", step: 5, type: "button_group",
    label: "Your marginal tax rate (personal income)?",
    subLabel: "Applied to flow-through income (LTC) or personal ownership. For trusts/companies entity rate applies automatically.",
    options: [
      { label: "17.5% (income $14k – $48k)",  value: "17_5", subLabel: "Lower marginal — reduced recovery value" },
      { label: "30% (income $48k – $70k)",     value: "30",   subLabel: "Mid marginal" },
      { label: "33% (income $70k – $180k)",    value: "33",   subLabel: "Most common for NZ investors" },
      { label: "39% (income over $180k)",       value: "39",   subLabel: "Top marginal — maximum recovery value" },
    ],
    required: true,
  },
  {
    id: "sale_considering", step: 6, type: "button_group",
    label: "Are you considering selling in the next 12 months?",
    subLabel: "Restored deductibility materially changes hold-vs-sell economics.",
    options: [
      { label: "Yes — actively considering",     value: "yes",    subLabel: "Evaluate bright-line + lost deduction" },
      { label: "Maybe — depends on cashflow",     value: "maybe",  subLabel: "Recovery cashflow may flip decision" },
      { label: "No — holding long term",           value: "no",     subLabel: "Full recovery each year captured" },
    ],
    required: true,
  },
];

const TOTAL_STEPS = 6;

function VerdictBlock({ verdict, onCheckout, loading }: {
  verdict: VerdictResult;
  onCheckout: (t: Tier) => void;
  loading: boolean;
}) {
  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>{verdict.status}</p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Interest deductibility timeline — Income Tax Act 2007, section DB 2</p>
        <div className="space-y-1 text-neutral-800">
          <p><strong>Before 1 Oct 2021:</strong> 100% deductible (original)</p>
          <p><strong>1 Oct 2021 – 31 Mar 2024:</strong> phased removal — 0% for most existing residential</p>
          <p><strong>1 Apr 2024 – 31 Mar 2025:</strong> 80% deductible (first step)</p>
          <p><strong>From 1 Apr 2025:</strong> 100% deductible (full restoration — current)</p>
          <p className="mt-1 pt-1 border-t border-neutral-200 text-[11px] text-neutral-600">New builds (post-July 2020) and commercial property: never restricted.</p>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-emerald-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Restriction period vs now — same property, same interest</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-red-700">During restriction (2022-23)</p>
            <ul className="space-y-1 text-xs text-red-900">
              <li>Interest paid: {formatNZD(verdict.result.annualInterest)}</li>
              <li>Deductibility: 0%</li>
              <li>Tax saving: $0</li>
              <li className="font-bold mt-1 pt-1 border-t border-red-200">Net interest cost: {formatNZD(verdict.result.netInterestCostRestriction)}</li>
            </ul>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-700">From 1 Apr 2025 onwards</p>
            <ul className="space-y-1 text-xs text-emerald-900">
              <li>Interest paid: {formatNZD(verdict.result.annualInterest)}</li>
              <li>Deductibility: 100%</li>
              <li>Tax saving: {formatNZDPerYear(verdict.result.currentYearTaxSaving)}</li>
              <li className="font-bold mt-1 pt-1 border-t border-emerald-200">Net interest cost: {formatNZD(verdict.result.netInterestCostNow)}</li>
            </ul>
          </div>
        </div>
        <p className="mt-2 text-center text-sm font-bold text-neutral-950">
          Annual recovery: {formatNZDPerYear(verdict.result.annualRecovery)} — {formatNZD(verdict.result.cumulative3YrRecovery)} over 3 years
        </p>
      </div>

      {verdict.result.ownership !== "individual" && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Where the deduction is claimed — your structure</p>
          <p className="text-neutral-700">{verdict.result.structureNote}</p>
          <p className="mt-1 text-neutral-500">Effective claim rate: <strong className="text-neutral-950">{verdict.result.structureRate}</strong></p>
        </div>
      )}

      {verdict.result.brightLineInteraction && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ Bright-line interaction — post-1 April 2024 purchase</p>
          <p className="text-red-900 leading-relaxed">
            This property was purchased on or after 1 April 2024 and is subject to the current 2-year bright-line rule. If you sell within 2 years of settlement (measured to AGREEMENT date, not sale settlement), profit is taxed as income at your marginal rate. Selling now creates a DOUBLE cost: lost interest deduction AND bright-line tax.
          </p>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
        <strong className="text-neutral-950">What this means:</strong>
        <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
          {verdict.consequences.filter(c => c !== "").map((c, i) => <li key={i}>→ {c}</li>)}
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
          <strong className="text-neutral-950">This is recovery, not a new benefit.</strong> From 1 April 2025, residential property investors can again claim 100% of mortgage interest — the entitlement removed from 1 October 2021 has been restored. Every year of holding captures the full tax saving.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Applicable deductibility % at your purchase date</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Annual tax saving at your exact rate and structure</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>3-year cumulative recovery projection</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Hold-vs-sell economics with bright-line interaction</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Loan tracing checklist for IRD audit defence</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 accountant questions specific to your situation</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} NZD · One-time · Built around your exact recovery situation</p>
      <p className="mt-2 text-center">
        <button onClick={() => onCheckout(verdict.tier === 67 ? 147 : 67)} disabled={loading}
          className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
          {verdict.altTierLabel}
        </button>
      </p>
    </div>
  );
}

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

export default function InterestReinstatementEngineCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ owner_role: "", urgency: "", accountant: "" });
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
        product_slug: "interest-reinstatement-engine",
        source_path: "/nz/check/interest-reinstatement-engine",
        country_code: "NZ", currency_code: "NZD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          recovery_status: verdict.result.status,
          annual_tax_saving: verdict.result.currentYearTaxSaving,
          cumulative_3yr_recovery: verdict.result.cumulative3YrRecovery,
          bright_line_interaction: verdict.result.brightLineInteraction,
          effective_claim_rate: verdict.result.structureRate,
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
      body: JSON.stringify({ email, source: "interest_reinstatement_engine", country_code: "NZ", site: "taxchecknow" }),
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
    const sid = sessionId || `interest_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("interest-reinstatement-engine_purchase_date", String(answers.purchase_date || ""));
    sessionStorage.setItem("interest-reinstatement-engine_property_type", String(answers.property_type || ""));
    sessionStorage.setItem("interest-reinstatement-engine_annual_interest", String(answers.annual_interest || ""));
    sessionStorage.setItem("interest-reinstatement-engine_ownership", String(answers.ownership || ""));
    sessionStorage.setItem("interest-reinstatement-engine_marginal_rate", String(answers.marginal_rate || ""));
    sessionStorage.setItem("interest-reinstatement-engine_sale_considering", String(answers.sale_considering || ""));
    sessionStorage.setItem("interest-reinstatement-engine_recovery_status", verdict.result.status);
    sessionStorage.setItem("interest-reinstatement-engine_annual_tax_saving", String(Math.round(verdict.result.currentYearTaxSaving)));
    sessionStorage.setItem("interest-reinstatement-engine_cumulative_3yr", String(Math.round(verdict.result.cumulative3YrRecovery)));
    sessionStorage.setItem("interest-reinstatement-engine_bright_line_interaction", String(verdict.result.brightLineInteraction));
    sessionStorage.setItem("interest-reinstatement-engine_status", verdict.status);
    sessionStorage.setItem("interest-reinstatement-engine_tier", String(popupTier));

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
          success_url: `${window.location.origin}/nz/check/interest-reinstatement-engine/success/${successPath}`,
          cancel_url: `${window.location.origin}/nz/check/interest-reinstatement-engine`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your interest recovery analysis for your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your recovery math by email — free.</p>
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

      {showPopup && verdict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl my-auto">
            <div className="rounded-t-2xl bg-neutral-950 px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass.replace("700","400")}`}>{verdict.status}</p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">
                    {popupTier === 67 ? "Your Interest Recovery Pack" : "Your Recovery + Portfolio Strategy Pack"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">IRD · Income Tax Act 2007 DB 2 · Restoration Act 2024 · April 2026</p>
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
                      {popupTier === 67 ? "Interest Recovery Pack™" : "Recovery + Portfolio Strategy Pack™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your exact annual tax saving, 3-year cumulative recovery projection, loan tracing checklist, hold-vs-sell summary, and 5 accountant questions — built around your property, rate and structure."
                        : "Full strategy: recovery math + hold-vs-sell with bright-line interaction + ownership structure review + debt shifting plan + multi-property optimisation + ring-fencing analysis + accountant coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier} NZD</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic landlord content. Your specific recovery math and structure review.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Recovery Math →" : "Get My Portfolio Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the recovery? — $67 instead" : "Want the full portfolio strategy? — $147 instead"}
                    </button>
                  </p>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">3 quick questions then pay</p>
                    <p className="font-serif text-lg font-bold text-neutral-950">${popupTier} NZD</p>
                  </div>
                  {[
                    { label: "Your role", key: "owner_role", options: [["landlord","Individual landlord"],["trust","Trust trustee"],["company","Company director"],["advisor","Advisor / accountant"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["filing_now","Filing 2025/26 return now"],["considering_sale","Considering a sale"],["reviewing","Annual review"]] },
                    { label: "Do you have an accountant?", key: "accountant", options: [["accountant","Yes — accountant"],["bookkeeper","Yes — bookkeeper"],["diy","Self-managed"],["none","No — need one"]] },
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
                    {loading ? "Redirecting to Stripe…" : `Pay $${popupTier} NZD →`}
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · IRD-referenced content</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && verdict.result.brightLineInteraction && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Hold-vs-sell stakes</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatNZDPerYear(verdict.result.currentYearTaxSaving)} recovery + bright-line exposure if sold
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
