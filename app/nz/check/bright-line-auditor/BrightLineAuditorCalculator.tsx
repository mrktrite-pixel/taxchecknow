"use client";

/**
 * NZ-01 — Bright-Line Property Tax Decision Engine (formerly Bright Line Auditor)
 * Pattern: Timeline (Module B) + Classification (Module C)
 *
 * Core question: Does the NZ bright-line test apply to this property sale, and
 * what is the tax on the profit at the seller's marginal income tax rate.
 *
 * CRITICAL: Four regimes by purchase date — must distinguish
 *   Before 29 March 2018:               2-year bright-line (original)
 *   29 March 2018 – 26 March 2021:      5-year bright-line
 *   27 March 2021 – 30 June 2024:       10-year bright-line (5yr for new builds)
 *   On or after 1 July 2024:            2-year bright-line (current rule)
 *
 * Core rules (all regimes):
 *   - Start date: SETTLEMENT date (title transfer)
 *   - End date: AGREEMENT DATE (contract signing) — NOT settlement
 *   - Tax rate: profit added to income at marginal rate (10.5% – 39%)
 *   - Income tax (not a separate CGT rate)
 *   - Main home exemption: must be predominantly main home for majority of period
 *
 * Legal anchor: Income Tax Act 2007, subpart CB (formerly s CB 6A)
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type BrightLineStatus =
  | "CLEAR_OUTSIDE_PERIOD"
  | "CLEAR_MAIN_HOME_CONFIRMED"
  | "TAXABLE_WITHIN_PERIOD"
  | "AGREEMENT_TRAP_WARNING"
  | "MAIN_HOME_AT_RISK"
  | "NEAR_BOUNDARY_WAIT"
  | "PRE_2024_LONG_PERIOD"
  | "UNKNOWN_DATE"
  | "NOT_SELLING";

interface BrightLineResult {
  purchaseDate:    string;
  saleStatus:      string;
  agreementBucket: string;
  timeSincePurchase: string;
  propertyUse:     string;
  gainBand:        string;
  incomeBand:      string;

  applicableRule:    "2yr_pre_2018" | "5yr_2018_2021" | "10yr_2021_2024" | "2yr_post_2024";
  applicablePeriodYears: number;
  periodDescription: string;

  gainEstimate:        number;
  marginalRate:        number;
  marginalRateLabel:   string;

  withinPeriod:        boolean | null;
  mainHomeExemption:   "applies" | "at_risk" | "does_not_apply" | "unknown";

  brightLineTaxIfApplies: number;
  netProceedsIfTaxed:     number;
  netProceedsIfClear:     number;
  savingsFromWaiting:     number;

  status: BrightLineStatus;
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
  result: BrightLineResult;
}

interface PopupAnswers {
  owner_role: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const GAIN_MIDPOINT: Record<string, number> = {
  under_50k:   30_000,
  "50k_150k":  100_000,
  "150k_500k": 300_000,
  over_500k:   750_000,
};

const MARGINAL_RATE: Record<string, { rate: number; label: string }> = {
  under_48k:    { rate: 0.205, label: "20.5%" },
  "48k_70k":    { rate: 0.30,  label: "30%" },
  "70k_180k":   { rate: 0.33,  label: "33%" },
  over_180k:    { rate: 0.39,  label: "39%" },
};

const PRODUCT_KEYS = {
  p67:  "nz_67_bright_line_auditor",
  p147: "nz_147_bright_line_auditor",
};

function formatNZD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-NZ");
}

// ─────────────────────────────────────────────────────────────────────────────
// CALC ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function resolveRule(purchaseDate: string): {
  applicableRule: BrightLineResult["applicableRule"];
  years: number;
  description: string;
} {
  switch (purchaseDate) {
    case "pre_2018":   return { applicableRule: "2yr_pre_2018",   years: 2,  description: "2-year rule (original — pre-29 March 2018)" };
    case "2018_2021":  return { applicableRule: "5yr_2018_2021",  years: 5,  description: "5-year rule (29 Mar 2018 – 26 Mar 2021)" };
    case "2021_2024":  return { applicableRule: "10yr_2021_2024", years: 10, description: "10-year rule (27 Mar 2021 – 30 Jun 2024; 5 yr for new builds)" };
    case "post_2024":
    default:           return { applicableRule: "2yr_post_2024",  years: 2,  description: "2-year rule (current — from 1 July 2024)" };
  }
}

function calcBrightLine(answers: AnswerMap): BrightLineResult {
  const purchaseDate      = String(answers.purchase_date       || "post_2024");
  const saleStatus        = String(answers.sale_status         || "planning");
  const agreementBucket   = String(answers.agreement_bucket    || "");
  const timeSincePurchase = String(answers.time_since_purchase || "");
  const propertyUse       = String(answers.property_use        || "primary");
  const gainBand          = String(answers.gain_band           || "50k_150k");
  const incomeBand        = String(answers.income_band         || "70k_180k");

  const ruleInfo = resolveRule(purchaseDate);
  const gainEstimate = GAIN_MIDPOINT[gainBand] ?? 100_000;
  const rateInfo = MARGINAL_RATE[incomeBand] ?? { rate: 0.33, label: "33%" };

  // Within period determination
  let withinPeriod: boolean | null = null;

  if (saleStatus === "already_sold") {
    if (agreementBucket === "not_sure") {
      withinPeriod = null;
    } else if (ruleInfo.years === 2) {
      withinPeriod = agreementBucket === "within_2yr";
    } else if (ruleInfo.years === 5) {
      withinPeriod = agreementBucket === "within_2yr" || agreementBucket === "2_5yr";
    } else {
      // 10yr rule
      withinPeriod = agreementBucket !== "over_5yr";
    }
  } else if (saleStatus === "planning" || saleStatus === "considering") {
    if (ruleInfo.years === 2) {
      withinPeriod = timeSincePurchase === "under_18m" || timeSincePurchase === "18_24m";
    } else if (ruleInfo.years === 5) {
      withinPeriod = timeSincePurchase !== "over_3yr" ? true : null;
    } else {
      // 10yr
      withinPeriod = true;
    }
  } else {
    withinPeriod = null;
  }

  // Main home exemption
  let mainHomeExemption: BrightLineResult["mainHomeExemption"];
  if (propertyUse === "primary") {
    mainHomeExemption = "applies";
  } else if (propertyUse === "primary_plus_rental" || propertyUse === "mixed") {
    mainHomeExemption = "at_risk";
  } else if (propertyUse === "holiday" || propertyUse === "rental") {
    mainHomeExemption = "does_not_apply";
  } else {
    mainHomeExemption = "unknown";
  }

  const brightLineTaxIfApplies = gainEstimate * rateInfo.rate;
  const netProceedsIfTaxed = gainEstimate - brightLineTaxIfApplies;
  const netProceedsIfClear = gainEstimate;
  const savingsFromWaiting = brightLineTaxIfApplies;

  // Status determination
  let status: BrightLineStatus = "NOT_SELLING";

  if (saleStatus === "checking") {
    status = "NOT_SELLING";
  } else if (withinPeriod === null) {
    status = "UNKNOWN_DATE";
  } else if (!withinPeriod) {
    status = "CLEAR_OUTSIDE_PERIOD";
  } else {
    // within period
    if (mainHomeExemption === "applies") {
      status = "CLEAR_MAIN_HOME_CONFIRMED";
    } else if (mainHomeExemption === "at_risk") {
      status = "MAIN_HOME_AT_RISK";
    } else {
      if (saleStatus === "planning" || saleStatus === "considering") {
        if (ruleInfo.years === 2 && timeSincePurchase === "18_24m") {
          status = "NEAR_BOUNDARY_WAIT";
        } else if (ruleInfo.years === 2 && timeSincePurchase === "under_18m") {
          status = "AGREEMENT_TRAP_WARNING";
        } else if (ruleInfo.years > 2) {
          status = "PRE_2024_LONG_PERIOD";
        } else {
          status = "TAXABLE_WITHIN_PERIOD";
        }
      } else {
        status = "TAXABLE_WITHIN_PERIOD";
      }
    }
  }

  return {
    purchaseDate, saleStatus, agreementBucket, timeSincePurchase,
    propertyUse, gainBand, incomeBand,
    applicableRule: ruleInfo.applicableRule,
    applicablePeriodYears: ruleInfo.years,
    periodDescription: ruleInfo.description,
    gainEstimate, marginalRate: rateInfo.rate, marginalRateLabel: rateInfo.label,
    withinPeriod, mainHomeExemption,
    brightLineTaxIfApplies, netProceedsIfTaxed, netProceedsIfClear, savingsFromWaiting,
    status,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcBrightLine(answers);

  if (result.status === "NOT_SELLING") {
    return {
      status: "POSITION CHECK — NOT CURRENTLY SELLING",
      statusClass: "text-neutral-700",
      panelClass: "border-neutral-200 bg-neutral-50",
      headline: `Your applicable rule is the ${result.periodDescription}. If you were to sign a sale agreement today, bright-line ${result.withinPeriod === false ? "would NOT apply" : "would likely apply"}. On an estimated ${formatNZD(result.gainEstimate)} gain at ${result.marginalRateLabel}, hypothetical bright-line tax would be ${formatNZD(result.brightLineTaxIfApplies)}.`,
      stats: [
        { label: "Applicable rule",              value: `${result.applicablePeriodYears}-year bright-line` },
        { label: "Main home exemption",           value: result.mainHomeExemption === "applies" ? "Likely applies" : result.mainHomeExemption === "at_risk" ? "At risk — mixed use" : result.mainHomeExemption === "does_not_apply" ? "Does not apply" : "Verify" },
        { label: "Hypothetical bright-line tax",  value: formatNZD(result.brightLineTaxIfApplies) },
      ],
      consequences: [
        `✓ Applicable rule (determined by settlement date): ${result.periodDescription}.`,
        `Key rule: start date is settlement (title transfer); end date is the AGREEMENT DATE — the day the sale contract is signed, NOT the settlement date of the sale. The property can settle after the period ends and still be taxed if the agreement was signed within the period.`,
        `Hypothetical tax: on ${formatNZD(result.gainEstimate)} gain at ${result.marginalRateLabel} marginal rate = ${formatNZD(result.brightLineTaxIfApplies)} — added to income for the tax year.`,
        `Main home exemption: ${result.mainHomeExemption === "applies" ? "use pattern suggests it applies. Still requires documentation for IRD purposes — utility bills, electoral roll, bank statements." : result.mainHomeExemption === "at_risk" ? "mixed use puts it at risk. The IRD applies a proportional calculation — the exemption covers only the proportion of time the property was predominantly your main home." : result.mainHomeExemption === "does_not_apply" ? "investment / holiday use: main home exemption does not apply. Full bright-line assessment required if within period." : "property use unclear — verify."}`,
        "Planning lever: for post-1 July 2024 purchases, the 2-year rule means relatively short waits remove bright-line liability. For pre-2024 purchases in the 5-year or 10-year regimes, the wait can be much longer.",
        "Before signing any sale agreement, verify the bright-line end date using the AGREEMENT date — not the settlement date. This is the single most common error.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Position check based on stated purchase period and use pattern. Exact dates and main home documentation would tighten the assessment.",
      tier: 67,
      ctaLabel: "Get My Full Position Pack — $67 →",
      altTierLabel: "Planning a transfer or sale? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "UNKNOWN_DATE") {
    return {
      status: "UNKNOWN — AGREEMENT DATE MUST BE CONFIRMED",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `The bright-line test turns on the date the sale agreement was signed — not the settlement date. Without confirmation, the assessment cannot be completed. The difference between being inside and outside the ${result.applicablePeriodYears}-year period can be ${formatNZD(result.brightLineTaxIfApplies)} in tax.`,
      stats: [
        { label: "Applicable rule",     value: `${result.applicablePeriodYears}-year bright-line`, highlight: true },
        { label: "Tax if within period", value: formatNZD(result.brightLineTaxIfApplies),           highlight: true },
        { label: "Tax if outside",       value: formatNZD(0),                                         highlight: true },
      ],
      consequences: [
        "⚠ Your sale agreement date is the exact day the bright-line test is applied against. Pull the signed sale and purchase agreement — the date you (as vendor) signed is the end date.",
        `Two scenarios: (1) agreement signed within ${result.applicablePeriodYears} years of original settlement → taxable at your marginal rate → ${formatNZD(result.brightLineTaxIfApplies)} tax on ${formatNZD(result.gainEstimate)} gain; (2) agreement signed outside the period → no bright-line tax.`,
        "Agreement date vs settlement date: vendors commonly remember the settlement date (when money and title changed hands). The bright-line test uses the earlier date the sale agreement was signed. Settlement can be weeks or months after agreement — that gap is exactly where the trap sits.",
        "Documentation to locate: the signed sale and purchase agreement (your solicitor or real estate agent holds this), Certificate of Title showing original settlement date, and evidence of property use during ownership.",
        "Action: confirm the agreement date this week. If inside the period, voluntary disclosure with a correctly filed return is far preferable to IRD finding the sale in an audit.",
      ],
      confidence: "LOW",
      confidenceNote: "Cannot assess without confirmed agreement date. The signed sale and purchase agreement is the key document.",
      tier: 147,
      ctaLabel: "Get My Date Verification + Position — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "CLEAR_OUTSIDE_PERIOD") {
    return {
      status: "CLEAR — SALE OUTSIDE BRIGHT-LINE PERIOD",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your sale agreement date falls outside the applicable ${result.applicablePeriodYears}-year bright-line period. No bright-line tax applies on your ${formatNZD(result.gainEstimate)} gain. Keep the documentation that proves your agreement date in case IRD ever queries the sale.`,
      stats: [
        { label: "Applicable rule",    value: `${result.applicablePeriodYears}-year bright-line` },
        { label: "Period status",       value: "Outside — sale is clear" },
        { label: "Bright-line tax",     value: formatNZD(0) },
      ],
      consequences: [
        `✓ Sale agreement date is outside the ${result.applicablePeriodYears}-year period measured from settlement. Bright-line test does not apply.`,
        `Gain: ${formatNZD(result.gainEstimate)}. Bright-line tax: $0. Net proceeds: ${formatNZD(result.gainEstimate)} (before any other applicable tax considerations).`,
        "Evidence to retain: signed sale and purchase agreement (showing agreement date), Certificate of Title (showing settlement date), records of property use during ownership. Keep for 7 years minimum — IRD can review bright-line positions retrospectively.",
        "Other tax triggers: bright-line is one of several possible tax triggers on property. If the property was used in a business, held as part of a pattern of trading, or purchased with a clear resale intention, other provisions (e.g. intention test under subpart CB) may still apply. For a passive hold outside bright-line, no further tax typically applies.",
        "Transfer history: if the property was transferred from a trust or associated person, your bright-line start date may be the original acquisition date of the prior owner — not your settlement date. Confirm any transfer chain.",
      ],
      confidence: "HIGH",
      confidenceNote: `Sale outside the ${result.applicablePeriodYears}-year period based on stated agreement date bucket. Bright-line does not apply.`,
      tier: 67,
      ctaLabel: "Get My Bright-Line Clear Pack — $67 →",
      altTierLabel: "Keep documentation solid? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "CLEAR_MAIN_HOME_CONFIRMED") {
    return {
      status: "CLEAR — MAIN HOME EXEMPTION LIKELY APPLIES",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your sale falls within the ${result.applicablePeriodYears}-year bright-line period, but the property was used as your primary residence the entire time. The main home exemption likely applies — removing bright-line tax on your ${formatNZD(result.gainEstimate)} gain. Documentation is the key: keep the evidence IRD will want if they query.`,
      stats: [
        { label: "Applicable rule",      value: `${result.applicablePeriodYears}-year bright-line` },
        { label: "Main home exemption",   value: "Likely applies" },
        { label: "Bright-line tax",       value: formatNZD(0) + " (exemption)" },
      ],
      consequences: [
        `✓ Primary-residence use for the entire bright-line period — main home exemption applies under Income Tax Act 2007, subpart CB.`,
        `Without the exemption, bright-line tax at ${result.marginalRateLabel} would be ${formatNZD(result.brightLineTaxIfApplies)} on ${formatNZD(result.gainEstimate)} gain. The exemption protects this.`,
        "Documentation to preserve: utility bills (power, internet, water) showing the property address during ownership; bank statements with property address as primary account address; electoral roll registration at the property; insurance policy listing the property as main home; records confirming no rental / Airbnb / flatmate income from the property. Keep for 7 years minimum.",
        "The IRD can query the main home claim retrospectively — particularly when a property is bought and sold within a short period. Documentation that is easy to assemble now is difficult to reconstruct 3-5 years later.",
        "Multiple main homes clarification: if you owned another property simultaneously (inherited property, holiday home, rental), only ONE property can be your main home at any point in time. The IRD looks at actual residence, not ownership. If the split is not clear, document why this property was the main home.",
        "Two-year reuse restriction: if you have claimed the main home exemption on another sale in the past 2 years, restrictions may apply to claiming it again. Verify prior sales with your accountant.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Main home exemption requires proof of predominantly-main-home use. Based on stated pattern the exemption applies; documentation must support this if IRD queries.",
      tier: 67,
      ctaLabel: "Get My Main Home Proof Pack — $67 →",
      altTierLabel: "Multi-property situation? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "MAIN_HOME_AT_RISK") {
    return {
      status: "MAIN HOME AT RISK — MIXED USE REDUCES EXEMPTION",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your sale falls within the ${result.applicablePeriodYears}-year bright-line period. You have used the property as your home — but mixed use (rental, Airbnb, flatmates paying market rent) puts the full main home exemption at risk. The IRD applies a proportional calculation. On a ${formatNZD(result.gainEstimate)} gain at ${result.marginalRateLabel}, the full bright-line tax would be ${formatNZD(result.brightLineTaxIfApplies)} — partial exemption reduces this proportionally.`,
      stats: [
        { label: "Applicable rule",          value: `${result.applicablePeriodYears}-year bright-line`, highlight: true },
        { label: "Main home exemption",       value: "At risk — partial or invalid",                    highlight: true },
        { label: "Full-tax scenario",         value: formatNZD(result.brightLineTaxIfApplies),           highlight: true },
      ],
      consequences: [
        `⚠ Mixed-use ownership: you have lived in the property but also rented some portion or rented the full property for some period. The IRD does NOT treat this as a full main home.`,
        `Proportional exemption: if the property was used as your main home for X% of the period and rented for Y%, the exemption covers only X% of the gain. The remaining Y% is taxed at your marginal rate.`,
        `Full-tax scenario (if no exemption): ${formatNZD(result.brightLineTaxIfApplies)} on ${formatNZD(result.gainEstimate)} gain at ${result.marginalRateLabel}.`,
        "Specific patterns that invalidate or reduce the exemption: (1) rented out for any significant period during ownership (even short periods matter); (2) used as holiday home or bach; (3) Airbnb / short-stay rental income; (4) flatmates paying market rent (as distinct from cost-sharing with family); (5) owned multiple properties simultaneously — only one can be the main home at a time; (6) owner did not live there during part of the period.",
        "Documentation needed: rental agreements or Airbnb booking history, rental income received, months of personal occupancy, and for multi-property owners — evidence of which property was the primary residence at each point.",
        "Planning action: before signing the sale agreement, calculate the main-home vs rental-period split with your accountant. The partial exemption math can still reduce your tax substantially if the property was primarily your home.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Mixed-use pattern reduces the main home exemption proportionally. Exact exemption percentage depends on documented use.",
      tier: 147,
      ctaLabel: "Get My Main Home Proportion Plan — $147 →",
      altTierLabel: "Just want the overview? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "AGREEMENT_TRAP_WARNING") {
    return {
      status: "AGREEMENT DATE TRAP — DO NOT SIGN WITHOUT CHECKING",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `You are inside the 2-year bright-line window. The trap: the bright-line test uses the AGREEMENT DATE — the day you sign the sale contract — not the settlement date. Sign the agreement even one day before the 2-year anniversary and the full gain is taxable. Sign after and there is no bright-line tax. On a ${formatNZD(result.gainEstimate)} gain at ${result.marginalRateLabel}, that is the difference between ${formatNZD(0)} and ${formatNZD(result.brightLineTaxIfApplies)}.`,
      stats: [
        { label: "Tax if within period",     value: formatNZD(result.brightLineTaxIfApplies), highlight: true },
        { label: "Tax if agreement after",    value: formatNZD(0),                             highlight: true },
        { label: "Stakes of timing",           value: formatNZD(result.brightLineTaxIfApplies), highlight: true },
      ],
      consequences: [
        `⚠ The agreement date rule — not the settlement date — is the critical test. A property can settle after the 2-year period ends and still be taxed if the agreement was signed before.`,
        `Worked example: purchase settlement 15 March 2023 → bright-line period ends 15 March 2025. Agreement signed 10 March 2025 → WITHIN period → ${formatNZD(result.brightLineTaxIfApplies)} tax. Agreement signed 20 March 2025 → OUTSIDE period → $0 tax. 10 days between the signatures = ${formatNZD(result.brightLineTaxIfApplies)} tax difference.`,
        "Vendors think about settlement dates. Real estate agents negotiate settlement timing. But the bright-line test only cares about the date the agreement was signed by you as the vendor. The agreement is typically signed 2-8 weeks before settlement.",
        "Practical planning: work BACKWARDS from your settlement anniversary. If you want to settle after the 2-year mark, the agreement must be signed after the 2-year anniversary of YOUR original settlement. Your solicitor and agent both need to know this — they do not usually track it automatically.",
        "If you are already inside the window and need to sell: the tax applies at your marginal rate — typically 33% (income $70k-$180k) or 39% (income over $180k). This is income tax, not a separate CGT, and there is no discount mechanism.",
        `If the property is your main home: the exemption may apply, in which case bright-line does not bite. Verify the main home test before relying on the exemption — see the MAIN HOME AT RISK path if you have had any mixed use.`,
      ],
      confidence: "HIGH",
      confidenceNote: "Agreement-date rule is statutory under Income Tax Act 2007, subpart CB. Settlement date is not the test.",
      tier: 147,
      ctaLabel: "Get My Agreement Date Planning Pack — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "NEAR_BOUNDARY_WAIT") {
    return {
      status: "NEAR BOUNDARY — WAITING SAVES THE FULL TAX",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `You are approaching the 2-year bright-line anniversary. Signing the sale agreement before the anniversary triggers the full bright-line tax on your ${formatNZD(result.gainEstimate)} gain — ${formatNZD(result.brightLineTaxIfApplies)} at your ${result.marginalRateLabel} marginal rate. Signing after the anniversary removes the liability entirely. The economic case for waiting a few weeks is usually decisive.`,
      stats: [
        { label: "Sign before anniversary",   value: formatNZD(result.brightLineTaxIfApplies) + " tax", highlight: true },
        { label: "Sign after anniversary",    value: formatNZD(0) + " tax",                              highlight: true },
        { label: "Saving from waiting",       value: formatNZD(result.savingsFromWaiting),              highlight: true },
      ],
      consequences: [
        `⚠ You are in the 18-24 month window. The bright-line anniversary is within weeks. The decision is not "should I sell?" — it is "what is the agreement date I sign?"`,
        `Economic comparison: sign within period → ${formatNZD(result.brightLineTaxIfApplies)} tax → net ${formatNZD(result.netProceedsIfTaxed)} from gain; sign after period → ${formatNZD(0)} tax → net ${formatNZD(result.netProceedsIfClear)} from gain. Saving from patience: ${formatNZD(result.savingsFromWaiting)}.`,
        "Market-timing concern: property values may move in either direction during a short wait. Historically, a few weeks of market risk is small compared with 20-39% of the gain going to IRD.",
        "Agreement date NOT settlement date: to get the post-anniversary outcome, the agreement itself must be signed after the 2-year anniversary. Typical settlement periods of 4-8 weeks mean the buyer offer timing must be managed carefully — a buyer pressing for fast exchange can cost you the full bright-line tax.",
        "Practical script for agent / solicitor: 'Agreement signing must be on or after [date]. Settlement date is secondary.' Your solicitor will typically need to be reminded — most property transactions are negotiated around settlement, not agreement.",
        `If market conditions require a pre-anniversary agreement: the main home exemption may apply if your use pattern qualifies. Otherwise the full ${formatNZD(result.brightLineTaxIfApplies)} applies.`,
      ],
      confidence: "HIGH",
      confidenceNote: "Boundary timing is a statutory test under the Income Tax Act 2007. Agreement date is the sole test.",
      tier: 147,
      ctaLabel: "Get My Boundary-Timing Plan — $147 →",
      altTierLabel: "Just want the rule? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "PRE_2024_LONG_PERIOD") {
    return {
      status: `WITHIN ${result.applicablePeriodYears}-YEAR PRE-2024 BRIGHT-LINE RULE`,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Property purchased under the ${result.periodDescription} has a long bright-line period. You are within that window. On your ${formatNZD(result.gainEstimate)} gain estimate at ${result.marginalRateLabel}, bright-line tax would be ${formatNZD(result.brightLineTaxIfApplies)}. The current 2-year rule does NOT apply retrospectively to earlier purchases — your applicable rule is the one in force when you purchased.`,
      stats: [
        { label: "Applicable rule",          value: `${result.applicablePeriodYears}-year (pre-1 July 2024)`, highlight: true },
        { label: "Bright-line tax estimate",  value: formatNZD(result.brightLineTaxIfApplies),               highlight: true },
        { label: "Net after tax",             value: formatNZD(result.netProceedsIfTaxed),                   highlight: true },
      ],
      consequences: [
        `🔒 Common AI error: many tools and articles say "NZ has a 2-year bright-line from 1 July 2024." That is correct for properties purchased on or after that date. YOUR property was purchased earlier, so the rule in force at your purchase date applies — ${result.periodDescription}.`,
        `Legal anchor: Income Tax Act 2007, subpart CB. The 2024 amendment applies prospectively to sales where the property was acquired on or after 1 July 2024. Earlier purchases continue under the prior rule.`,
        `Tax calculation: profit of ${formatNZD(result.gainEstimate)} added to other income, taxed at ${result.marginalRateLabel} = ${formatNZD(result.brightLineTaxIfApplies)}. Net from gain after tax: ${formatNZD(result.netProceedsIfTaxed)}.`,
        "Main home exemption: still available under pre-2024 rules on the same principles — property must have been predominantly main home for majority of the bright-line period.",
        "Planning: if sale is not time-urgent, wait until outside the applicable bright-line period. For 5-year rule properties that means holding until 5 years post settlement. For 10-year rule properties that means holding until 10 years. The wait saves the full tax.",
        `If sale must happen within the period: budget ${formatNZD(result.brightLineTaxIfApplies)} for IRD. Consider provisional tax implications — this bright-line income increases your total income for the year.`,
      ],
      confidence: "HIGH",
      confidenceNote: `Applicable rule is the ${result.periodDescription} — determined by settlement date, not amendment date.`,
      tier: 147,
      ctaLabel: "Get My Pre-2024 Rule Planning Pack — $147 →",
      altTierLabel: "Just want the rule? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // TAXABLE_WITHIN_PERIOD default fall-through
  return {
    status: "BRIGHT-LINE APPLIES — TAX OWED ON PROFIT",
    statusClass: "text-red-700",
    panelClass: "border-red-200 bg-red-50",
    headline: `Your sale is within the ${result.applicablePeriodYears}-year bright-line period and the main home exemption does not apply. Profit is taxed as income at your marginal rate. On your ${formatNZD(result.gainEstimate)} gain at ${result.marginalRateLabel}, the bright-line tax is ${formatNZD(result.brightLineTaxIfApplies)}. This tax is owed for the tax year in which the sale occurred.`,
    stats: [
      { label: "Applicable rule",          value: `${result.applicablePeriodYears}-year bright-line`, highlight: true },
      { label: "Bright-line tax",           value: formatNZD(result.brightLineTaxIfApplies),          highlight: true },
      { label: "Net after tax",             value: formatNZD(result.netProceedsIfTaxed),              highlight: true },
    ],
    consequences: [
      `🔒 Agreement date within the ${result.applicablePeriodYears}-year window, and property not used predominantly as main home. Bright-line applies on the full profit.`,
      `Tax calculation: profit of ${formatNZD(result.gainEstimate)} added to your other income, taxed at ${result.marginalRateLabel} = ${formatNZD(result.brightLineTaxIfApplies)}. Net from gain: ${formatNZD(result.netProceedsIfTaxed)}.`,
      "Legal framing: bright-line is income tax, not a separate CGT. NZ has no general capital gains tax. There is no CGT discount, no 50% reduction, no long-term / short-term rate split. The full gain is ordinary income in the year of the sale.",
      "Marginal rate impact: bright-line income pushes total income higher for the year. If the gain crosses a rate threshold (most relevantly $180,000 where the 39% rate begins), part of the gain is taxed at the higher bracket. Model the incremental rate carefully.",
      "Filing: bright-line income is declared in your income tax return for the year. If the sale was not accounted for in provisional tax, you may face use-of-money interest on the underpayment — voluntary disclosure before IRD contact reduces penalty risk.",
      "Evidence to keep: Certificate of Title showing settlement date; signed sale and purchase agreement showing agreement date; records of property use (rental agreements, Airbnb income, personal occupancy); documentation of deductible expenses (improvements, agent fees, legal fees — these reduce the taxable gain).",
      "Main home exemption reconsideration: if you have had even significant personal use of the property, partial main home exemption may still apply proportionally. The MAIN HOME AT RISK path applies if your use was genuinely mixed.",
    ],
    confidence: "HIGH",
    confidenceNote: "Bright-line applies where sale is within applicable period and main home exemption does not cover the full period. Profit added to income at marginal rate.",
    tier: 147,
    ctaLabel: "Get My Bright-Line Tax Planning Pack — $147 →",
    altTierLabel: "Just want the math? — $67 instead",
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
    id: "purchase_date", step: 1, type: "button_group",
    label: "When did you purchase the property? (settlement date)",
    subLabel: "The settlement date (when title transferred to you) determines which bright-line rule applies. The 2024 amendment does NOT apply retrospectively to earlier purchases.",
    options: [
      { label: "Before 29 March 2018",            value: "pre_2018",   subLabel: "Original 2-year rule" },
      { label: "29 March 2018 – 26 March 2021",    value: "2018_2021", subLabel: "5-year bright-line" },
      { label: "27 March 2021 – 30 June 2024",     value: "2021_2024", subLabel: "10-year rule (5yr for new builds)" },
      { label: "On or after 1 July 2024",          value: "post_2024", subLabel: "Current 2-year rule" },
    ],
    required: true,
  },
  {
    id: "sale_status", step: 2, type: "button_group",
    label: "Have you sold or are you planning to sell?",
    subLabel: "Determines whether we assess a signed agreement or a planning timeline.",
    options: [
      { label: "Already sold — agreement signed",              value: "already_sold", subLabel: "Assess the signed sale" },
      { label: "Planning to sell — not yet signed",            value: "planning",     subLabel: "Agreement date trap applies" },
      { label: "Considering selling in next 6 months",          value: "considering",  subLabel: "Plan the agreement date carefully" },
      { label: "No — just checking my position",                value: "checking",     subLabel: "Position check, no planned sale" },
    ],
    required: true,
  },
  {
    id: "agreement_bucket", step: 3, type: "button_group",
    label: "When was the sale agreement signed? (relative to purchase settlement)",
    subLabel: "Agreement date — the day YOU signed the sale contract. NOT the settlement date of the sale. The bright-line test is measured from original settlement to agreement signing.",
    options: [
      { label: "Within 2 years of purchase settlement",                value: "within_2yr",  subLabel: "Inside the 2-year window" },
      { label: "Between 2 and 5 years after purchase",                  value: "2_5yr",       subLabel: "Inside 5yr and 10yr rules; outside 2yr" },
      { label: "More than 5 years after purchase",                      value: "over_5yr",    subLabel: "Outside 5yr; may still be within 10yr" },
      { label: "Not sure of exact agreement date",                      value: "not_sure",    subLabel: "Date must be confirmed before assessment" },
    ],
    required: true,
    showIf: (a) => a.sale_status === "already_sold",
  },
  {
    id: "time_since_purchase", step: 3, type: "button_group",
    label: "How long since purchase settlement?",
    subLabel: "Time elapsed from your original settlement to today. Used to plan the agreement date.",
    options: [
      { label: "Under 18 months",                        value: "under_18m", subLabel: "Clearly inside 2-year window" },
      { label: "18-24 months (approaching 2-yr mark)",   value: "18_24m",    subLabel: "Near boundary — timing critical" },
      { label: "Just over 24 months",                     value: "24m_plus",  subLabel: "Outside 2-year rule; inside longer rules" },
      { label: "Over 3 years",                             value: "over_3yr",  subLabel: "Outside 2yr and often 5yr; may be inside 10yr" },
    ],
    required: true,
    showIf: (a) => a.sale_status === "planning" || a.sale_status === "considering",
  },
  {
    id: "property_use", step: 4, type: "button_group",
    label: "How was the property used during ownership?",
    subLabel: "Main home exemption requires predominant main home use for majority of the bright-line period. Mixed use reduces or invalidates the exemption.",
    options: [
      { label: "Primary residence the entire time",          value: "primary",              subLabel: "Main home exemption likely applies" },
      { label: "Primary residence + some rental/Airbnb",      value: "primary_plus_rental", subLabel: "Exemption at risk — proportional calc" },
      { label: "Primarily rental / investment",              value: "rental",               subLabel: "Main home exemption does not apply" },
      { label: "Holiday home / bach",                         value: "holiday",              subLabel: "Does not qualify as main home" },
      { label: "Mixed use (business + residential)",          value: "mixed",                subLabel: "Proportional treatment; get advice" },
    ],
    required: true,
  },
  {
    id: "gain_band", step: 5, type: "button_group",
    label: "Approximate gain on sale (sale price minus purchase price)?",
    subLabel: "Rough estimate. Agent fees, legal fees, and certain improvements can be deducted in the final calculation.",
    options: [
      { label: "Under $50,000",         value: "under_50k",  subLabel: "Lower end" },
      { label: "$50,000 – $150,000",     value: "50k_150k",  subLabel: "Typical Auckland / Wellington 2-year appreciation" },
      { label: "$150,000 – $500,000",    value: "150k_500k", subLabel: "Large gain — tax materially significant" },
      { label: "Over $500,000",          value: "over_500k", subLabel: "Substantial — top marginal rate likely applies" },
    ],
    required: true,
  },
  {
    id: "income_band", step: 6, type: "button_group",
    label: "Your approximate total annual income (excluding this gain)?",
    subLabel: "Determines the marginal rate applied to bright-line profit. Profit is added to your income for the year.",
    options: [
      { label: "Under $48,000",            value: "under_48k",  subLabel: "20.5% marginal rate" },
      { label: "$48,000 – $70,000",         value: "48k_70k",   subLabel: "30% rate" },
      { label: "$70,000 – $180,000",        value: "70k_180k",  subLabel: "33% rate (most common)" },
      { label: "Over $180,000",             value: "over_180k", subLabel: "39% rate" },
    ],
    required: true,
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

      {/* Four-regime banner */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Four bright-line regimes — Income Tax Act 2007, subpart CB</p>
        <div className="space-y-1 text-neutral-800">
          <p><strong>Before 29 Mar 2018:</strong> 2-year rule (original)</p>
          <p><strong>29 Mar 2018 – 26 Mar 2021:</strong> 5-year bright-line</p>
          <p><strong>27 Mar 2021 – 30 Jun 2024:</strong> 10-year rule (5yr for new builds)</p>
          <p><strong>On or after 1 Jul 2024:</strong> 2-year rule (current)</p>
          <p className="mt-1 pt-1 border-t border-neutral-200 text-[11px] text-neutral-600">Rule at your settlement date applies — amendments not retrospective.</p>
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

      {/* Agreement date rule — always visible */}
      <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-xs">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">⚠ Agreement date rule — not settlement</p>
        <p className="text-amber-900 leading-relaxed">
          The bright-line period ends on the date you SIGN the sale agreement — not on the settlement date. The property can settle after the period ends and still be taxed if the agreement was signed within the period. 10 days between signatures can be the entire tax outcome.
        </p>
      </div>

      {/* Before/After */}
      {(verdict.result.status === "NEAR_BOUNDARY_WAIT" || verdict.result.status === "AGREEMENT_TRAP_WARNING" || verdict.result.status === "TAXABLE_WITHIN_PERIOD" || verdict.result.status === "PRE_2024_LONG_PERIOD") && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Sign within period vs wait until outside</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-red-700">Sign within bright-line</p>
              <ul className="space-y-1 text-xs text-red-900">
                <li>Gain: {formatNZD(verdict.result.gainEstimate)}</li>
                <li>Marginal rate: {verdict.result.marginalRateLabel}</li>
                <li>Bright-line tax: {formatNZD(verdict.result.brightLineTaxIfApplies)}</li>
                <li className="font-bold mt-1 pt-1 border-t border-red-200">Net: {formatNZD(verdict.result.netProceedsIfTaxed)}</li>
              </ul>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-700">Wait — sign after period</p>
              <ul className="space-y-1 text-xs text-emerald-900">
                <li>Gain: {formatNZD(verdict.result.gainEstimate)}</li>
                <li>Bright-line tax: $0</li>
                <li>Main home test: not required</li>
                <li className="font-bold mt-1 pt-1 border-t border-emerald-200">Net: {formatNZD(verdict.result.netProceedsIfClear)}</li>
              </ul>
            </div>
          </div>
          <p className="mt-2 text-center text-sm font-bold text-neutral-950">
            Saving from patience: {formatNZD(verdict.result.savingsFromWaiting)}
          </p>
        </div>
      )}

      {/* Main home exemption status */}
      {verdict.result.mainHomeExemption !== "unknown" && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Main home exemption status</p>
          <div className="flex justify-between">
            <span className="text-neutral-700">Predominantly your main home for majority of period?</span>
            <span className={`font-mono font-bold ${
              verdict.result.mainHomeExemption === "applies" ? "text-emerald-700"
              : verdict.result.mainHomeExemption === "at_risk" ? "text-amber-700"
              : "text-red-700"
            }`}>
              {verdict.result.mainHomeExemption === "applies" ? "✓ LIKELY"
                : verdict.result.mainHomeExemption === "at_risk" ? "? PARTIAL / AT RISK"
                : "✗ DOES NOT APPLY"}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500">Holiday homes / bachs do not qualify. Mixed rental use reduces the exemption proportionally. Multiple simultaneous main homes: only one can qualify.</p>
        </div>
      )}

      {/* Fear framing */}
      {verdict.result.brightLineTaxIfApplies > 10_000 && (verdict.result.status === "AGREEMENT_TRAP_WARNING" || verdict.result.status === "TAXABLE_WITHIN_PERIOD" || verdict.result.status === "PRE_2024_LONG_PERIOD" || verdict.result.status === "NEAR_BOUNDARY_WAIT") && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ Fear anchor</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-1">
            {formatNZD(verdict.result.brightLineTaxIfApplies)} tax on a {formatNZD(verdict.result.gainEstimate)} gain — and the entire outcome turns on the date the agreement is signed.
          </p>
          <p className="text-xs text-red-800 leading-relaxed">
            Bright-line is income tax at marginal rate — not a separate CGT. Profit is added to your income for the year. On income over $180,000 the rate is 39%. A single signature on the wrong side of the anniversary is the entire tax outcome.
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
          <strong className="text-neutral-950">Bright-line is income tax — not CGT.</strong> Profit is added to income at marginal rate. The rule in force when you settled applies (not the current rule, for earlier purchases). The agreement date — not the settlement date — is the test.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Which bright-line rule applies to your property (by purchase date)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Agreement-date timing analysis — safe signing window</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Main home exemption proportion and documentation checklist</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Tax math at your exact marginal rate — bright-line + provisional tax impact</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 accountant / solicitor questions specific to your situation</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} NZD · One-time · Built around your exact purchase date and use pattern</p>
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

export default function BrightLineAuditorCalculator() {
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
        product_slug: "bright-line-auditor",
        source_path: "/nz/check/bright-line-auditor",
        country_code: "NZ", currency_code: "NZD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          bright_line_status: verdict.result.status,
          applicable_rule: verdict.result.applicableRule,
          gain_estimate: verdict.result.gainEstimate,
          bright_line_tax: verdict.result.brightLineTaxIfApplies,
          marginal_rate: verdict.result.marginalRate,
          main_home_exemption: verdict.result.mainHomeExemption,
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
      body: JSON.stringify({ email, source: "bright_line_auditor", country_code: "NZ", site: "taxchecknow" }),
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
    const sid = sessionId || `brightline_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("bright-line-auditor_purchase_date", String(answers.purchase_date || ""));
    sessionStorage.setItem("bright-line-auditor_sale_status", String(answers.sale_status || ""));
    sessionStorage.setItem("bright-line-auditor_agreement_bucket", String(answers.agreement_bucket || ""));
    sessionStorage.setItem("bright-line-auditor_time_since_purchase", String(answers.time_since_purchase || ""));
    sessionStorage.setItem("bright-line-auditor_property_use", String(answers.property_use || ""));
    sessionStorage.setItem("bright-line-auditor_gain_band", String(answers.gain_band || ""));
    sessionStorage.setItem("bright-line-auditor_income_band", String(answers.income_band || ""));
    sessionStorage.setItem("bright-line-auditor_bright_line_status", verdict.result.status);
    sessionStorage.setItem("bright-line-auditor_applicable_rule", verdict.result.applicableRule);
    sessionStorage.setItem("bright-line-auditor_bright_line_tax", String(Math.round(verdict.result.brightLineTaxIfApplies)));
    sessionStorage.setItem("bright-line-auditor_marginal_rate", verdict.result.marginalRateLabel);
    sessionStorage.setItem("bright-line-auditor_main_home_exemption", verdict.result.mainHomeExemption);
    sessionStorage.setItem("bright-line-auditor_status", verdict.status);
    sessionStorage.setItem("bright-line-auditor_tier", String(popupTier));

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
          success_url: `${window.location.origin}/nz/check/bright-line-auditor/success/${successPath}`,
          cancel_url: `${window.location.origin}/nz/check/bright-line-auditor`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your bright-line analysis for your accountant or solicitor.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your position assessment by email — free.</p>
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
                    {popupTier === 67 ? "Your Bright-Line Position Pack" : "Your Bright-Line Decision Strategy Pack"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">IRD · Income Tax Act 2007, subpart CB · April 2026</p>
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
                      {popupTier === 67 ? "Bright-Line Position Pack™" : "Bright-Line Decision Strategy Pack™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Applicable rule identification, agreement-date analysis, main home exemption assessment, tax math at your marginal rate, and 5 accountant/solicitor questions — built around your exact purchase date and use pattern."
                        : "Full strategy: applicable rule, agreement-date planning window, main home exemption proportion, tax math with provisional tax impact, documentation checklist, associated-person/trust rollover analysis, and accountant+solicitor coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier} NZD</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic bright-line content. Your specific rule, dates, and exemption proportion.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Bright-Line Position →" : "Get My Decision Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the position? — $67 instead" : "Want the full decision strategy? — $147 instead"}
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
                    { label: "Your role", key: "owner_role", options: [["owner_occupier","Owner-occupier"],["investor","Investor / landlord"],["family_trust","Trust beneficiary / trustee"],["inherited","Inherited property"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["agreement_pending","Agreement being drafted now"],["planning_soon","Planning sale in next 3-6 months"],["modelling","Modelling before deciding"]] },
                    { label: "Do you have an accountant or solicitor?", key: "accountant", options: [["accountant","Yes — accountant"],["solicitor","Yes — property solicitor"],["both","Both"],["none","No — need one"]] },
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

      {/* Mobile sticky bar */}
      {showVerdict && verdict && verdict.result.brightLineTaxIfApplies > 10_000 && (verdict.result.status === "AGREEMENT_TRAP_WARNING" || verdict.result.status === "TAXABLE_WITHIN_PERIOD" || verdict.result.status === "PRE_2024_LONG_PERIOD" || verdict.result.status === "NEAR_BOUNDARY_WAIT") && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Bright-line tax stakes</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatNZD(verdict.result.brightLineTaxIfApplies)} on {formatNZD(verdict.result.gainEstimate)} gain at {verdict.result.marginalRateLabel}
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
