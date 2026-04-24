"use client";

/**
 * CAN-03 — Canada Property Flipping Tax Trap Auditor
 * Pattern: Timeline + Classification -> business income vs capital gain outcome
 *
 * Legal anchor: Income Tax Act (Canada) s12(12) + s12(13)
 *
 * CRITICAL LANGUAGE RULE: Never say "you will be taxed as business income" deterministically.
 * Always "may" / "the CRA may treat" / "appears". Life event exceptions always conditional.
 *
 * DETERMINATION ORDER:
 *   1. Held 365+ days -> OUTSIDE_RULE (capital gain + PRE possible)
 *   2. Life event qualifying + documented -> LIFE_EVENT_EXCEPTION (may rebut)
 *   3. Not yet sold -> PLANNING_WINDOW (can delay to 365+)
 *   4. Held <365 days + no exception -> BUSINESS_INCOME_FLIPPING_RULE
 *   5. Investment property -> INVESTMENT_PROPERTY_ALWAYS_INCOME (intent-based income regardless)
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type Status =
  | "OUTSIDE_RULE_365_PLUS"
  | "LIFE_EVENT_EXCEPTION"
  | "PLANNING_WINDOW_NOT_SOLD"
  | "BUSINESS_INCOME_FLIPPING_RULE"
  | "INVESTMENT_PROPERTY_ALWAYS_INCOME"
  | "UNCERTAIN_NEEDS_REVIEW";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface FlippingResult {
  purchaseTiming:    string;
  saleStatus:         string;
  daysHeld:            string;
  propertyUse:           string;
  saleReason:              string;
  estimatedProfit:           string;
  marginalRate:                string;

  profitMidpoint:                number;
  marginalRatePct:                number;
  businessIncomeTax:               number;
  capitalGainTax:                   number;
  preTax:                             number;
  additionalTaxVsCapGain:               number;
  additionalTaxVsPre:                     number;

  status:                                    Status;
  statusLabel:                                string;
  hasPlanningWindow:                            boolean;
  isFlippingRule:                                 boolean;
  preAvailable:                                    boolean;

  reasoningChain:                                     Array<{ layer: string; outcome: string; resolved: boolean }>;
  routes:                                               Route[];
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
  result: FlippingResult;
}

interface PopupAnswers {
  filing_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "can_67_property_flipping_tax_trap",
  p147: "can_147_property_flipping_tax_trap",
};

const PROFIT_MIDPOINT: Record<string, number> = {
  under_50k:      30000,
  "50k_to_150k":  100000,
  "150k_to_300k": 225000,
  over_300k:      500000,
};

const PROFIT_LABEL: Record<string, string> = {
  under_50k:      "Under $50,000",
  "50k_to_150k":  "$50,000-$150,000",
  "150k_to_300k": "$150,000-$300,000",
  over_300k:      "Over $300,000",
};

const MARGINAL_RATE: Record<string, number> = {
  under_30:  0.25,
  "30_to_40": 0.35,
  "40_to_50": 0.45,
  over_50:    0.53,
};

function cad(n: number): string {
  return `$${Math.round(n).toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
}

function calcFlipping(answers: AnswerMap): FlippingResult {
  const purchaseTiming    = String(answers.purchase_timing     || "1_to_3yr");
  const saleStatus         = String(answers.sale_status          || "planning");
  const daysHeld             = String(answers.days_held             || "180_to_364");
  const propertyUse           = String(answers.property_use           || "primary_residence");
  const saleReason              = String(answers.sale_reason             || "planned_profit");
  const estimatedProfit           = String(answers.estimated_profit        || "150k_to_300k");
  const marginalRate                = String(answers.marginal_rate           || "40_to_50");

  const profitMidpoint = PROFIT_MIDPOINT[estimatedProfit] ?? 225000;
  const marginalRatePct = MARGINAL_RATE[marginalRate] ?? 0.45;

  // Business income tax: 100% × marginal
  const businessIncomeTax = Math.round(profitMidpoint * marginalRatePct);
  // Capital gain tax: 50% × marginal (assuming under $250k threshold; 50% inclusion)
  const capitalGainTax = Math.round(profitMidpoint * 0.5 * marginalRatePct);
  // PRE: $0 for primary residence
  const preTax = propertyUse === "primary_residence" ? 0 : capitalGainTax;
  const additionalTaxVsCapGain = businessIncomeTax - capitalGainTax;
  const additionalTaxVsPre = businessIncomeTax - preTax;

  const reasoningChain: FlippingResult["reasoningChain"] = [];

  let status: Status | null = null;
  let statusLabel = "";

  // GATE 1 — Held 365+ days (outside rule)
  if (daysHeld === "over_365") {
    reasoningChain.push({ layer: "Gate 1 — Holding period (s12(12))", outcome: "Property held 365+ consecutive days — flipping rule does NOT apply. Standard capital gain treatment available. Principal residence exemption may apply if primary residence.", resolved: true });
    status = "OUTSIDE_RULE_365_PLUS";
    statusLabel = "OUTSIDE FLIPPING RULE — CAPITAL GAIN TREATMENT";
  }

  // GATE 2 — Investment property (always income regardless)
  if (status === null && propertyUse === "investment") {
    reasoningChain.push({ layer: "Gate 1 — Property use", outcome: "Investment property — intent-based business income characterisation generally applies regardless of holding period. Flipping rule adds specific 365-day presumption but investment intent itself points to business income treatment.", resolved: true });
    if (daysHeld === "over_365") {
      reasoningChain.push({ layer: "Gate 1b — Investment + 365+ days", outcome: "Over 365 days but still investment property — capital gain possible on intent-based analysis; PRE unavailable (not primary residence).", resolved: true });
      status = "OUTSIDE_RULE_365_PLUS";
      statusLabel = "INVESTMENT PROPERTY — OUTSIDE FLIPPING RULE";
    } else {
      reasoningChain.push({ layer: "Gate 1b — Investment under 365 days", outcome: "Investment property held under 365 days — definitively business income. Flipping rule + intent-based characterisation both point to same outcome.", resolved: true });
      status = "INVESTMENT_PROPERTY_ALWAYS_INCOME";
      statusLabel = "INVESTMENT PROPERTY — BUSINESS INCOME";
    }
  }

  // GATE 3 — Life event exception (if qualifying reason)
  if (status === null && daysHeld !== "over_365") {
    const qualifyingEvents = ["job_relocation", "marital_breakdown", "illness_disability", "death", "safety", "insolvency"];
    if (qualifyingEvents.includes(saleReason)) {
      reasoningChain.push({ layer: "Gate 2 — Life event exception (s12(13))", outcome: `Reason: ${saleReason.replace(/_/g, " ")} — appears to qualify under one of the 8 statutory life event exceptions. CRA will examine causal necessity between event and sale. Documentation critical.`, resolved: true });
      status = "LIFE_EVENT_EXCEPTION";
      statusLabel = "LIFE EVENT EXCEPTION — PRESUMPTION MAY BE REBUTTED";
    } else {
      reasoningChain.push({ layer: "Gate 2 — Life event exception", outcome: "Sale reason does not appear to fall within the 8 statutory life event exceptions (death / household addition / marital breakdown / illness / qualifying employment change / safety / insolvency / involuntary disposition).", resolved: false });
    }
  }

  // GATE 4 — Not yet sold (planning window)
  if (status === null && (saleStatus === "planning" || saleStatus === "considering")) {
    reasoningChain.push({ layer: "Gate 3 — Sale status", outcome: "Not yet sold — planning window still available. Reaching 365-day mark before signing sale contract moves outcome from flipping rule to capital gain treatment.", resolved: true });
    status = "PLANNING_WINDOW_NOT_SOLD";
    statusLabel = "PLANNING WINDOW — NOT YET SOLD";
  }

  // GATE 5 — Flipping rule applies (default for under 365 + already sold + no exception)
  if (status === null) {
    reasoningChain.push({ layer: "Gate 3 — Sale status", outcome: "Already sold within the last 2 years OR sale planned without exception — flipping rule determines classification.", resolved: true });
    reasoningChain.push({ layer: "Gate 4 — Classification outcome", outcome: `Held ${daysHeld === "under_180" ? "under 180" : "180-364"} days + no qualifying life event + sale committed/imminent = deemed business income under s12(12). Principal residence exemption UNAVAILABLE on deemed business income.`, resolved: true });
    status = "BUSINESS_INCOME_FLIPPING_RULE";
    statusLabel = "BUSINESS INCOME — FLIPPING RULE APPLIES";
  }

  // Fallback
  if (status === null) {
    status = "UNCERTAIN_NEEDS_REVIEW";
    statusLabel = "UNCERTAIN — REVIEW NEEDED";
  }

  // Tax math reasoning
  if (status === "BUSINESS_INCOME_FLIPPING_RULE" || status === "INVESTMENT_PROPERTY_ALWAYS_INCOME") {
    reasoningChain.push({ layer: "Tax impact (vs capital gain + PRE)", outcome: `Profit ${cad(profitMidpoint)} × 100% × ${Math.round(marginalRatePct * 100)}% = ${cad(businessIncomeTax)} business income tax. Capital gain alternative: ${cad(capitalGainTax)} (50% inclusion). Principal residence exemption if eligible: ${cad(preTax)}. Additional tax cost of flipping rule: ${cad(additionalTaxVsCapGain)} vs capital gain; ${cad(additionalTaxVsPre)} vs PRE.`, resolved: true });
  } else if (status === "OUTSIDE_RULE_365_PLUS") {
    reasoningChain.push({ layer: "Tax impact (capital gain + possible PRE)", outcome: `Profit ${cad(profitMidpoint)} × 50% inclusion × ${Math.round(marginalRatePct * 100)}% = ${cad(capitalGainTax)} capital gain tax. ${propertyUse === "primary_residence" ? "Primary residence: PRE may eliminate this entirely." : "Non-primary: PRE unavailable."}`, resolved: true });
  } else if (status === "LIFE_EVENT_EXCEPTION") {
    reasoningChain.push({ layer: "Tax impact (if exception holds)", outcome: `If exception successful: capital gain treatment (${cad(capitalGainTax)}); PRE if primary residence → ${cad(preTax)}. If CRA rejects exception: business income (${cad(businessIncomeTax)}). Documentation determines outcome.`, resolved: true });
  } else if (status === "PLANNING_WINDOW_NOT_SOLD") {
    reasoningChain.push({ layer: "Tax impact (flipping vs wait)", outcome: `Sell under 365 days without exception: ${cad(businessIncomeTax)} business income tax. Wait to 365+ days: ${propertyUse === "primary_residence" ? `potentially ${cad(preTax)} (PRE)` : `${cad(capitalGainTax)} capital gain`}. Saving from waiting: up to ${cad(additionalTaxVsPre)}.`, resolved: true });
  }

  const hasPlanningWindow = status === "PLANNING_WINDOW_NOT_SOLD";
  const isFlippingRule = status === "BUSINESS_INCOME_FLIPPING_RULE" || status === "INVESTMENT_PROPERTY_ALWAYS_INCOME";
  const preAvailable = propertyUse === "primary_residence" && status === "OUTSIDE_RULE_365_PLUS";

  // Routing
  const routes: Route[] = [];
  if (isFlippingRule) {
    routes.push({ label: "Canada Departure Tax Trap — cross-check s128.1", href: "/can/check/departure-tax-trap", note: "If leaving Canada, additional deemed disposition rules apply" });
    routes.push({ label: "AU Expat CGT Trap — cross-border context", href: "/nomad/check/au-expat-cgt", note: "If Australian connection — parallel rules" });
    routes.push({ label: "Tax Treaty Navigator — allocation between countries", href: "/nomad/check/tax-treaty-navigator", note: "Destination country treatment of Canadian property gain" });
  } else if (status === "PLANNING_WINDOW_NOT_SOLD") {
    routes.push({ label: "Canada Departure Tax Trap", href: "/can/check/departure-tax-trap", note: "If leaving Canada, plan property sale before or after departure" });
    routes.push({ label: "Canada Non-Resident Rental", href: "/can/check/non-resident-landlord-withholding", note: "If renting during wait period as non-resident" });
  } else if (status === "LIFE_EVENT_EXCEPTION") {
    routes.push({ label: "Canada Departure Tax Trap", href: "/can/check/departure-tax-trap", note: "If relocation is abroad — departure tax also in scope" });
    routes.push({ label: "Tax Treaty Navigator", href: "/nomad/check/tax-treaty-navigator", note: "If moving abroad — destination country treatment" });
  } else {
    routes.push({ label: "Canada Departure Tax Trap", href: "/can/check/departure-tax-trap", note: "Companion Canadian exit tax analysis" });
    routes.push({ label: "183-Day Rule Reality Check", href: "/nomad/check/183-day-rule", note: "Residency position if relevant" });
  }
  routes.push({ label: "← Back to Nomad Residency Risk Index", href: "/nomad", note: "Reclassify with updated answers" });

  return {
    purchaseTiming, saleStatus, daysHeld, propertyUse, saleReason, estimatedProfit, marginalRate,
    profitMidpoint, marginalRatePct,
    businessIncomeTax, capitalGainTax, preTax,
    additionalTaxVsCapGain, additionalTaxVsPre,
    status, statusLabel,
    hasPlanningWindow, isFlippingRule, preAvailable,
    reasoningChain, routes,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcFlipping(answers);

  const headline = (() => {
    if (result.status === "BUSINESS_INCOME_FLIPPING_RULE") return `Your property was held under 365 days and no qualifying life event exception appears to apply. The CRA may treat the profit as business income under s12(12) — fully taxable at your marginal rate with no principal residence exemption. Estimated business income tax: ${cad(result.businessIncomeTax)} on ${PROFIT_LABEL[result.estimatedProfit]} profit. Additional tax vs capital gain treatment: ${cad(result.additionalTaxVsCapGain)}; vs principal residence exemption: ${cad(result.additionalTaxVsPre)}.`;
    if (result.status === "INVESTMENT_PROPERTY_ALWAYS_INCOME") return `Your property is an investment property held under 365 days. Two rules reinforce business income treatment: (1) the 365-day flipping rule (s12(12)); and (2) intent-based business income characterisation for investment-purpose property. The principal residence exemption is not available for investment properties regardless of holding period. Estimated business income tax: ${cad(result.businessIncomeTax)}.`;
    if (result.status === "LIFE_EVENT_EXCEPTION") return `Your sale reason — ${result.saleReason.replace(/_/g, " ")} — appears to fall within one of the 8 statutory life event exceptions to the flipping rule. If documented properly, the presumption may be rebutted and capital gain treatment (with potential principal residence exemption) applies. CRA examines the causal connection between the event and the necessity of sale. Potential tax range: ${cad(result.preTax)} (if exception + PRE) to ${cad(result.businessIncomeTax)} (if exception rejected).`;
    if (result.status === "PLANNING_WINDOW_NOT_SOLD") return `Your property is not yet sold — the planning window is still open. If you wait until 365 days of ownership before signing the sale contract, the flipping rule does not apply. On ${PROFIT_LABEL[result.estimatedProfit]} profit at your marginal rate, waiting saves approximately ${cad(result.additionalTaxVsCapGain)} vs business income treatment (up to ${cad(result.additionalTaxVsPre)} if principal residence exemption applies). Consider coordinating sale closing with the 365-day mark.`;
    if (result.status === "OUTSIDE_RULE_365_PLUS") return `Your property was held for 365 consecutive days or more — the flipping rule does not apply. The profit is a capital gain subject to the standard inclusion rate (50% for first $250,000 annually for individuals; 2/3 above that threshold after 25 June 2024). Principal residence exemption may eliminate the capital gain entirely if the property was your primary residence and ordinarily inhabited.`;
    return `Your property flipping rule position requires specialist review — inputs do not map cleanly to a single scenario.`;
  })();

  const consequences: string[] = [];

  if (result.status === "BUSINESS_INCOME_FLIPPING_RULE") {
    consequences.push(`🔒 Flipping rule applies — profit deemed business income under s12(12). 100% inclusion at ${Math.round(result.marginalRatePct * 100)}% marginal = ${cad(result.businessIncomeTax)}.`);
    consequences.push(`Principal residence exemption UNAVAILABLE on deemed business income — regardless of occupancy during ownership.`);
    consequences.push(`Reporting: Schedule 3 + Form T2125 (Statement of Business or Professional Activities) with your T1 return. Deduct direct selling costs (commission, legal fees) against the profit.`);
    consequences.push(`Life event exception review: recheck whether any of the 8 qualifying events apply (death / household addition / marital breakdown / illness / qualifying employment change / safety / insolvency / involuntary disposition). Narrow but possible.`);
    consequences.push(`CRA audit risk: residential property sales are actively matched against land title data. Near-miss holding periods (300-364 days) with claimed PRE raise red flags.`);
    consequences.push(`Post-reform (25 June 2024): business income inclusion remains 100%. Capital gains post-reform: 50% up to $250k annual / 2/3 above for individuals. The gap between classifications remains material.`);
    consequences.push(`Immediate action: engage Canadian CPA with real estate experience. Typical fee $1,500-$3,000 for flipping rule return prep + review.`);
  } else if (result.status === "INVESTMENT_PROPERTY_ALWAYS_INCOME") {
    consequences.push(`🔒 Investment property — business income treatment near-certain under both the 365-day flipping rule AND intent-based CRA analysis.`);
    consequences.push(`Tax: ${cad(result.businessIncomeTax)} on ${PROFIT_LABEL[result.estimatedProfit]} profit at ${Math.round(result.marginalRatePct * 100)}% marginal.`);
    consequences.push(`No principal residence exemption available — investment property never qualifies.`);
    consequences.push(`Reporting: T2125 business income. Deduct selling costs, carrying costs during ownership (interest, property tax, insurance, maintenance) to extent not already deducted in prior-year T776.`);
    consequences.push(`If previously reported as rental income on T776: ensure consistency + review timing of classification change on T2125.`);
    consequences.push(`Non-resident consideration: if you become non-resident, Section 116 certificate process applies on sale (25% NRWHT reduced to ~25% of gain). See Canada Non-Resident Landlord auditor.`);
  } else if (result.status === "LIFE_EVENT_EXCEPTION") {
    consequences.push(`🔬 Life event exception may apply — narrow but potentially decisive.`);
    consequences.push(`Qualifying event: ${result.saleReason.replace(/_/g, " ")}. The exception rebuts the flipping rule presumption IF the sale was necessary due to the event (not merely convenient).`);
    consequences.push(`Documentation required: (a) evidence of the event itself; (b) causal connection (timeline + communications); (c) alternatives considered; (d) timing showing event preceded decision to sell.`);
    consequences.push(`If job relocation: must meet 40km+ closer test (new workplace at least 40km closer from new home than from old home, in driving distance).`);
    consequences.push(`If exception holds: capital gain treatment (${cad(result.capitalGainTax)}); if primary residence, PRE may eliminate entirely (${cad(result.preTax)}).`);
    consequences.push(`If exception rejected: business income treatment (${cad(result.businessIncomeTax)}) — $${cad(result.businessIncomeTax - result.preTax)} range of risk.`);
    consequences.push(`Belt-and-braces: if feasible, delay sale to 365+ days — removes the exception argument entirely and falls back to standard capital gain + PRE eligibility.`);
    consequences.push(`CRA audit response protocol: retain all documentation 6+ years; respond to CRA queries within 30 days; escalate to objection (90-day window) if reassessment issued.`);
  } else if (result.status === "PLANNING_WINDOW_NOT_SOLD") {
    consequences.push(`⏰ Planning window open — maximum flexibility.`);
    consequences.push(`Primary planning move: wait until 365+ days of ownership before signing sale contract. Flipping rule presumption not triggered; capital gain treatment available; PRE possible if primary residence.`);
    consequences.push(`Contract flexibility: most Agreements of Purchase and Sale have 30-60 day closing windows. Negotiate closing to fall post-365-day mark if near threshold.`);
    consequences.push(`Tax saving from waiting: up to ${cad(result.additionalTaxVsPre)} (if primary residence); ${cad(result.additionalTaxVsCapGain)} minimum (vs capital gain with no PRE).`);
    consequences.push(`Life event tracking: if a qualifying life event occurs during the wait period (job change, household change etc.), exception path may become available even before 365 days.`);
    consequences.push(`Market risk: property value can move during wait period — weigh tax saving against market volatility exposure.`);
    consequences.push(`Multi-property coordination: if selling multiple properties in a year, time each to minimise combined tax (particularly post-25 June 2024 $250k threshold for 2/3 inclusion).`);
  } else if (result.status === "OUTSIDE_RULE_365_PLUS") {
    consequences.push(`✓ Outside flipping rule — held 365+ days. Capital gain treatment applies.`);
    consequences.push(`Capital gain tax: ${cad(result.capitalGainTax)} (50% inclusion × ${Math.round(result.marginalRatePct * 100)}% marginal). Post 25 June 2024: still 50% inclusion for individuals up to $250k annual gain.`);
    if (result.propertyUse === "primary_residence") {
      consequences.push(`✓ Primary residence — Principal Residence Exemption may apply. If ordinarily inhabited entire period + designated on T2091 + only-one-property-per-family-per-year rule respected: potentially $0 tax.`);
    } else {
      consequences.push(`Non-primary property — principal residence exemption unavailable. Full capital gain treatment.`);
    }
    consequences.push(`Reporting: Schedule 3 (capital gains) + T2091 (PRE designation if applicable) with T1 return.`);
    consequences.push(`Filing deadline: 30 April following tax year.`);
    consequences.push(`Documentation retention 6+ years: purchase/sale documents, occupancy evidence, improvements records.`);
  } else if (result.status === "UNCERTAIN_NEEDS_REVIEW") {
    consequences.push(`Specialist review required — inputs do not map cleanly to a single scenario.`);
    consequences.push(`Engage Canadian CPA with real estate experience. Flipping rule interacts with intent-based business income tests, PRE rules, and post-June 2024 inclusion rate changes.`);
    consequences.push(`Before engagement: gather purchase/sale documents, occupancy evidence, holding period calculation, life event documentation if any.`);
  }

  const statusClass = result.isFlippingRule ? "text-red-700" : (result.status === "PLANNING_WINDOW_NOT_SOLD" || result.status === "LIFE_EVENT_EXCEPTION" ? "text-amber-700" : "text-emerald-700");
  const panelClass  = result.isFlippingRule ? "border-red-200 bg-red-50" : (result.status === "PLANNING_WINDOW_NOT_SOLD" || result.status === "LIFE_EVENT_EXCEPTION" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50");

  const confidence: ConfidenceLevel = result.status === "UNCERTAIN_NEEDS_REVIEW" ? "LOW" : (result.status === "LIFE_EVENT_EXCEPTION" ? "MEDIUM" : "HIGH");
  const confidenceNote = result.status === "UNCERTAIN_NEEDS_REVIEW"
    ? "Inputs do not map cleanly — specialist review essential."
    : result.status === "LIFE_EVENT_EXCEPTION"
      ? "Exception outcome depends on documentation + CRA review. Consider belt-and-braces: delay sale to 365+ days if feasible."
      : "Flipping rule outcome determined deterministically by s12(12) thresholds applied to your inputs.";

  // Tier selection
  const tier2Triggers = [
    result.daysHeld === "180_to_364" || result.daysHeld === "under_180",
    result.estimatedProfit === "over_300k" || result.estimatedProfit === "150k_to_300k",
    result.saleReason === "planned_profit" || result.saleReason === "other",
    result.propertyUse === "primary_residence" && result.daysHeld !== "over_365",
    result.saleStatus === "sold_recent",
    result.status === "LIFE_EVENT_EXCEPTION",
    result.isFlippingRule,
  ];
  const tier: Tier = tier2Triggers.some(Boolean) ? 147 : 67;

  return {
    status: result.statusLabel,
    statusClass,
    panelClass,
    headline,
    stats: [
      { label: "Classification outcome",          value: result.isFlippingRule ? "Business income" : (result.status === "LIFE_EVENT_EXCEPTION" ? "Exception (review)" : result.status === "PLANNING_WINDOW_NOT_SOLD" ? "Pending" : "Capital gain"),              highlight: result.isFlippingRule },
      { label: "Business income tax",                value: cad(result.businessIncomeTax),                                                                                                                                                                                                                highlight: result.isFlippingRule },
      { label: "Additional tax vs PRE",                value: result.additionalTaxVsPre > 0 ? cad(result.additionalTaxVsPre) : "$0"                                                                                                                                                                                                                        },
    ],
    consequences,
    confidence,
    confidenceNote,
    tier,
    ctaLabel: tier === 147 ? "Get My Property Strategy System — $147 →" : "Get My Classification Report — $67 →",
    altTierLabel: tier === 147 ? "Just want the classification report? — $67 instead" : "Want the full strategy + life event kit? — $147",
    productKey67: PRODUCT_KEYS.p67,
    productKey147: PRODUCT_KEYS.p147,
    result,
  };
}

type Q = {
  id: string;
  step: number;
  type: "button_group";
  label: string;
  subLabel?: string;
  options: { label: string; value: string; subLabel?: string }[];
  showIf?: (a: AnswerMap) => boolean;
  required?: boolean;
};

const QUESTIONS: Q[] = [
  {
    id: "purchase_timing", step: 1, type: "button_group",
    label: "When did you purchase the property?",
    subLabel: "Flipping rule applies to residential properties sold on or after 1 January 2023.",
    options: [
      { label: "Over 3 years ago (likely out of scope)",              value: "over_3yr",   subLabel: "Long-term hold" },
      { label: "1-3 years ago (in scope depending on sale date)",       value: "1_to_3yr",  subLabel: "Classification depends on days held" },
      { label: "Within the last 12 months",                               value: "under_12mo", subLabel: "Classification critical" },
    ],
    required: true,
  },
  {
    id: "sale_status", step: 2, type: "button_group",
    label: "Have you sold or are you planning to sell?",
    subLabel: "Pre-sale has planning window. Already sold = classification locked in, life event exception is the primary lever.",
    options: [
      { label: "Already sold — within last 2 years",              value: "sold_recent",   subLabel: "Classification locked" },
      { label: "Planning to sell — have not yet sold",              value: "planning",     subLabel: "Full planning window" },
      { label: "Considering selling",                                 value: "considering",  subLabel: "Maximum flexibility" },
    ],
    required: true,
  },
  {
    id: "days_held", step: 3, type: "button_group",
    label: "How long did/will you own the property?",
    subLabel: "Counted consecutive calendar days from purchase closing to sale closing. 365-day threshold is absolute.",
    options: [
      { label: "Under 180 days",                             value: "under_180",   subLabel: "Clearly within rule" },
      { label: "180-364 days (within 365-day rule)",            value: "180_to_364", subLabel: "Within rule" },
      { label: "365 days or more (outside rule)",                  value: "over_365",    subLabel: "Outside rule" },
      { label: "Not sure of exact days",                              value: "not_sure",    subLabel: "Specialist review needed" },
    ],
    required: true,
  },
  {
    id: "property_use", step: 4, type: "button_group",
    label: "Property use",
    subLabel: "Primary residence only qualifies for PRE if outside flipping rule. Investment property never qualifies for PRE.",
    options: [
      { label: "Primary residence (I lived here)",         value: "primary_residence", subLabel: "PRE possible if outside rule" },
      { label: "Investment property (tenanted or vacant)",   value: "investment",        subLabel: "Business income likely" },
      { label: "Mixed — lived there then rented",              value: "mixed",             subLabel: "Partial PRE analysis" },
      { label: "Secondary / vacation property",                  value: "vacation",          subLabel: "PRE possible but requires designation" },
    ],
    required: true,
  },
  {
    id: "sale_reason", step: 5, type: "button_group",
    label: "Reason for sale",
    subLabel: "Life event exceptions are narrow — 8 specific categories. CRA examines causal necessity, not convenience.",
    options: [
      { label: "Planned investment / profit-taking",                value: "planned_profit",    subLabel: "Not a qualifying exception" },
      { label: "Job relocation (40km+ closer to new work)",           value: "job_relocation",   subLabel: "Qualifying exception" },
      { label: "Marital breakdown / separation",                        value: "marital_breakdown", subLabel: "Qualifying exception" },
      { label: "Serious illness or disability",                           value: "illness_disability", subLabel: "Qualifying exception" },
      { label: "Death in family",                                           value: "death",              subLabel: "Qualifying exception" },
      { label: "Personal safety concern",                                    value: "safety",              subLabel: "Qualifying exception" },
      { label: "Financial hardship / insolvency",                              value: "insolvency",         subLabel: "Qualifying exception (s128)" },
      { label: "Other personal circumstances",                                    value: "other",              subLabel: "Not a qualifying exception" },
    ],
    required: true,
  },
  {
    id: "estimated_profit", step: 6, type: "button_group",
    label: "Estimated profit on sale",
    subLabel: "Sale price minus purchase price minus selling costs. Drives the absolute tax impact of classification.",
    options: [
      { label: "Under $50,000",              value: "under_50k",       subLabel: "Lower stakes" },
      { label: "$50,000-$150,000",            value: "50k_to_150k",    subLabel: "Moderate exposure" },
      { label: "$150,000-$300,000",            value: "150k_to_300k",   subLabel: "Material exposure — planning critical" },
      { label: "Over $300,000",                  value: "over_300k",       subLabel: "High-stakes exposure" },
    ],
    required: true,
  },
  {
    id: "marginal_rate", step: 7, type: "button_group",
    label: "Your approximate marginal tax rate (federal + provincial combined)",
    subLabel: "Marginal rate determines absolute cost of business income vs capital gain classification.",
    options: [
      { label: "Under 30%",          value: "under_30",   subLabel: "Lower bracket" },
      { label: "30%-40%",              value: "30_to_40",  subLabel: "Middle bracket" },
      { label: "40%-50%",              value: "40_to_50",  subLabel: "Higher bracket" },
      { label: "Over 50% (top bracket)", value: "over_50",    subLabel: "Top combined rate (Ontario / BC)" },
    ],
    required: true,
  },
];

const TOTAL_STEPS = 7;

function VerdictBlock({ verdict, onCheckout, loading }: {
  verdict: VerdictResult;
  onCheckout: (t: Tier) => void;
  loading: boolean;
}) {
  const result = verdict.result;

  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>{verdict.status}</p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

      {/* Logic chain */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Flipping rule logic — Income Tax Act (Canada) s12(12) + s12(13)</p>
        <div className="space-y-1.5">
          {result.reasoningChain.map((r, i) => (
            <div key={i} className={`flex items-start gap-2 rounded px-2 py-1 ${r.resolved ? (result.isFlippingRule ? "bg-red-100" : result.status === "PLANNING_WINDOW_NOT_SOLD" || result.status === "LIFE_EVENT_EXCEPTION" ? "bg-amber-100" : "bg-emerald-100") : "bg-white"}`}>
              <span className={`shrink-0 mt-0.5 text-[10px] font-mono font-bold ${r.resolved ? (result.isFlippingRule ? "text-red-700" : result.status === "PLANNING_WINDOW_NOT_SOLD" || result.status === "LIFE_EVENT_EXCEPTION" ? "text-amber-700" : "text-emerald-700") : "text-neutral-500"}`}>{r.resolved ? "✓" : "→"}</span>
              <div className="flex-1">
                <p className={`text-[11px] font-bold ${r.resolved ? (result.isFlippingRule ? "text-red-700" : result.status === "PLANNING_WINDOW_NOT_SOLD" || result.status === "LIFE_EVENT_EXCEPTION" ? "text-amber-700" : "text-emerald-700") : "text-neutral-700"}`}>{r.layer}</p>
                <p className="text-xs text-neutral-700">{r.outcome}</p>
              </div>
            </div>
          ))}
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

      {/* 3-way tax comparison */}
      <div className="mb-4 rounded-xl border-2 border-neutral-200 bg-white px-4 py-3 text-sm">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">3-way tax comparison — {PROFIT_LABEL[result.estimatedProfit]} profit at {Math.round(result.marginalRatePct * 100)}% marginal</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-neutral-500 border-b border-neutral-200">
              <th className="py-2 text-left">Classification</th>
              <th className="py-2 text-right">Inclusion</th>
              <th className="py-2 text-right">Tax</th>
              <th className="py-2 text-right">PRE</th>
            </tr>
          </thead>
          <tbody>
            <tr className={`border-b border-neutral-100 ${result.isFlippingRule ? "bg-red-50 font-bold" : ""}`}>
              <td className="py-2">Business income (flipping) {result.isFlippingRule && <span className="ml-1 text-red-700">✓</span>}</td>
              <td className="py-2 text-right">100%</td>
              <td className="py-2 text-right text-red-700">{cad(result.businessIncomeTax)}</td>
              <td className="py-2 text-right text-neutral-400">N/A</td>
            </tr>
            <tr className={`border-b border-neutral-100 ${result.status === "OUTSIDE_RULE_365_PLUS" && !result.preAvailable ? "bg-emerald-50 font-bold" : ""}`}>
              <td className="py-2">Capital gain (outside rule)</td>
              <td className="py-2 text-right">50%</td>
              <td className="py-2 text-right">{cad(result.capitalGainTax)}</td>
              <td className="py-2 text-right text-neutral-400">If primary</td>
            </tr>
            <tr className={`${result.preAvailable ? "bg-emerald-50 font-bold" : ""}`}>
              <td className="py-2">Capital gain + PRE {result.preAvailable && <span className="ml-1 text-emerald-700">✓</span>}</td>
              <td className="py-2 text-right">0%</td>
              <td className="py-2 text-right text-emerald-700">{cad(result.preTax)}</td>
              <td className="py-2 text-right text-emerald-700">Applied</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Planning window visual */}
      {result.status === "PLANNING_WINDOW_NOT_SOLD" && (
        <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">⏰ Planning window — wait to 365 days</p>
          <p className="font-bold text-amber-900">
            Waiting saves up to {cad(result.additionalTaxVsPre)} in tax
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Move sale closing past the 365-day mark — moves outcome from business income ({cad(result.businessIncomeTax)}) to capital gain + potentially PRE ({cad(result.preTax)}).
          </p>
        </div>
      )}

      {/* Life event visual */}
      {result.status === "LIFE_EVENT_EXCEPTION" && (
        <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">Life event exception — narrow but decisive</p>
          <p className="font-bold text-amber-900">
            Range: {cad(result.preTax)} (exception + PRE) to {cad(result.businessIncomeTax)} (exception rejected)
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Documentation determines outcome. If feasible, belt-and-braces approach: delay sale to 365+ days to remove the exception argument entirely.
          </p>
        </div>
      )}

      {/* Language disclaimer */}
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        <strong>Language note:</strong> The flipping rule creates a presumption. CRA interpretation is fact-specific. Life event exceptions are narrow and documentation-dependent. This assessment uses &quot;may&quot; deliberately — confirm with a Canadian CPA before filing.
      </div>

      {/* Routing destinations */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Routing — Canadian property + cross-border engines</p>
          <div className="space-y-2">
            {result.routes.map((r, i) => (
              <a key={i} href={r.href} className="block rounded-lg border border-emerald-300 bg-white px-3 py-2 hover:border-emerald-500 transition">
                <p className="text-sm font-semibold text-neutral-950">{r.label}</p>
                <p className="text-xs text-neutral-600 mt-0.5">{r.note}</p>
              </a>
            ))}
          </div>
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
          <strong className="text-neutral-950">Occupancy does not save you.</strong> The 365-day rule deems profit as business income regardless of whether you lived in the property. The principal residence exemption only applies to capital gains — not business income. Occupancy is not the test; holding period is.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your specific classification analysis with reasoning chain</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Business income vs capital gain vs PRE comparison</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Life event exception assessment with documentation requirements</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>365-day threshold timing analysis with planning windows</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Life event documentation kit for all 8 categories (tier 2)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>CRA audit defence framework (tier 2)</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your exact Canadian property sale position</p>
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
  onAnswer: (id: string, v: string) => void;
}) {
  const sel = (v: string) => value === v;
  const base = "rounded-xl border px-4 py-3 text-left transition";
  const active = "border-neutral-950 bg-neutral-950 text-white";
  const inactive = "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400";

  return (
    <div>
      <h2 className="mb-1 font-serif text-base font-bold text-neutral-950">{q.label}</h2>
      {q.subLabel && <p className="mb-4 text-xs text-neutral-500">{q.subLabel}</p>}

      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map(opt => (
          <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value)}
            className={`${base} ${sel(opt.value) ? active : inactive}`}>
            <span className="block text-sm font-medium">{opt.label}</span>
            {opt.subLabel && <span className={`mt-0.5 block text-xs ${sel(opt.value) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CanPropertyFlippingCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ filing_role: "", urgency: "", accountant: "" });
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
    if (!visibleQs.length && step <= TOTAL_STEPS) {
      const next = step + 1;
      if (next <= TOTAL_STEPS) setStep(next);
      else setVerdict(true);
      return;
    }
    if (!stepComplete) return;
    const t = setTimeout(() => {
      const next = step + 1;
      if (next <= TOTAL_STEPS) setStep(next);
      else setVerdict(true);
    }, 300);
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
        product_slug: "can-property-flipping",
        source_path: "/can/check/property-flipping-tax-trap",
        country_code: "CA", currency_code: "CAD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          flipping_status: verdict.result.status,
          business_income_tax: verdict.result.businessIncomeTax,
          additional_tax_vs_pre: verdict.result.additionalTaxVsPre,
          is_flipping_rule: verdict.result.isFlippingRule,
          tier: verdict.tier,
        },
        recommended_tier: verdict.tier,
      }),
    }).then(r => r.json()).then(d => { if (d.id) setSessionId(d.id); }).catch(() => {});
  }, [showVerdict]);

  function answer(id: string, v: string) {
    setAnswers(p => ({ ...p, [id]: v }));
  }

  function back() {
    if (showVerdict) { setVerdict(false); return; }
    if (step > 1) {
      let prev = step - 1;
      while (prev > 1 && !QUESTIONS.some(q => q.step === prev && (!q.showIf || q.showIf(answers)))) {
        prev -= 1;
      }
      setStep(prev);
    }
  }

  async function handleSaveEmail() {
    if (!email) return;
    await fetch("/api/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "can_property_flipping", country_code: "CA", site: "taxchecknow" }),
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
    const sid = sessionId || `canpft_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("can-property-flipping_purchase_timing",   String(answers.purchase_timing || ""));
    sessionStorage.setItem("can-property-flipping_sale_status",         String(answers.sale_status      || ""));
    sessionStorage.setItem("can-property-flipping_days_held",            String(answers.days_held         || ""));
    sessionStorage.setItem("can-property-flipping_property_use",           String(answers.property_use       || ""));
    sessionStorage.setItem("can-property-flipping_sale_reason",              String(answers.sale_reason         || ""));
    sessionStorage.setItem("can-property-flipping_estimated_profit",           String(answers.estimated_profit    || ""));
    sessionStorage.setItem("can-property-flipping_marginal_rate",                String(answers.marginal_rate       || ""));
    sessionStorage.setItem("can-property-flipping_business_income_tax",            String(verdict.result.businessIncomeTax));
    sessionStorage.setItem("can-property-flipping_additional_tax_vs_pre",            String(verdict.result.additionalTaxVsPre));
    sessionStorage.setItem("can-property-flipping_flipping_status",                     verdict.result.status);
    sessionStorage.setItem("can-property-flipping_status",                                 verdict.status);
    sessionStorage.setItem("can-property-flipping_tier",                                    String(popupTier));

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
          success_url: `${window.location.origin}/can/check/property-flipping-tax-trap/success/${successPath}`,
          cancel_url: `${window.location.origin}/can/check/property-flipping-tax-trap`,
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
              {visibleQs.map(q => <QuestionBlock key={q.id} q={q} value={answers[q.id] as string} onAnswer={answer} />)}
            </div>
          </div>
        )}

        {showVerdict && verdict && (
          <div ref={verdictRef} className="space-y-4">
            <button onClick={back} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← Change my answers</button>
            <VerdictBlock verdict={verdict} onCheckout={openPopup} loading={loading} />
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your property flipping decision for your Canadian tax advisor.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your classification assessment by email — free.</p>
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
                    {popupTier === 67 ? "Your Property Tax Classification Report" : "Your Property Tax Strategy System"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">Income Tax Act (Canada) s12(12) + s12(13) · CRA · April 2026</p>
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
                      {popupTier === 67 ? "Property Tax Classification Report™" : "Property Tax Strategy System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your classification analysis, life-event exception assessment, estimated additional tax exposure, and timing recommendation."
                        : "Full property tax strategy: sale timing optimisation, life-event documentation kit (all 8 categories), CRA audit defence framework, capital gains inclusion rate optimisation, and multi-property coordination."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic Canadian tax content. Your specific 365-day rule position + life event pathway.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Classification Report →" : "Get My Property Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the classification report? — $67 instead" : "Want the full strategy + documentation kit? — $147 instead"}
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
                    { label: "Your role", key: "filing_role", options: [["home_seller","Canadian home seller — primary residence"],["investor","Property investor / multiple units"],["relocating","Relocating for work / family"],["post_sale","Already sold — review + filing"],["advisor","Canadian CPA / tax advisor"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["sale_imminent","Sale closing in next 30 days"],["sale_3mo","Sale closing in 3 months"],["cra_letter","CRA letter / reassessment"],["filing_deadline","T1 filing deadline approaching"],["planning","General planning"]] },
                    { label: "Do you have a Canadian tax advisor?", key: "accountant", options: [["cpa_real_estate","Yes — CPA with real estate expertise"],["general_cpa","Yes — general CPA"],["diy","Self-managed"],["none","No — need one"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · CRA property flipping rule (ITA s12(12) + s12(13))</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && verdict.result.isFlippingRule && verdict.result.businessIncomeTax >= 30000 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Flipping rule — business income tax</p>
              <p className="text-sm font-bold text-neutral-950">
                {cad(verdict.result.businessIncomeTax)} at stake
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
