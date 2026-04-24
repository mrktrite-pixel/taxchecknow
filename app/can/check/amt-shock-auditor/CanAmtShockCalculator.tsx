"use client";

/**
 * CAN-04 — Canada AMT Shock Auditor
 * Pattern: CashflowModel + ThresholdTest -> regular tax vs AMT comparison + credit carryforward
 *
 * Legal anchor: Income Tax Act (Canada) s127.5-127.55 (revised 2024)
 *
 * CRITICAL LANGUAGE RULE: AMT is parallel calculation — not a penalty.
 * AMT paid becomes credit carryforward (indefinite recovery).
 *
 * RISK LEVELS:
 *   HIGH — multiple triggers + AMT clearly exceeds regular
 *   MEDIUM — triggers present + AMT borderline
 *   LOW — triggers present but regular tax dominant
 *   NO_EXPOSURE — no triggers or AMTI under exemption
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type Status =
  | "HIGH_AMT_RISK"
  | "MEDIUM_AMT_RISK"
  | "LOW_AMT_RISK"
  | "NO_AMT_EXPOSURE"
  | "UNCERTAIN_NEEDS_REVIEW";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface AmtResult {
  primaryTriggers:    string;
  capitalGains:        string;
  stockOptions:          string;
  charitableDonations:    string;
  otherDeductions:          string;
  province:                   string;
  totalIncome:                  string;

  totalIncomeMidpoint:           number;
  capitalGainsMidpoint:            number;
  stockOptionsMidpoint:             number;
  donationsMidpoint:                  number;
  deductionsMidpoint:                   number;

  amti:                                    number;
  amtExemption:                             number;
  amtBase:                                   number;
  amtRate:                                    number;
  amtFederal:                                   number;
  regularFederalTax:                              number;
  additionalAmtExposure:                            number;
  amtCreditCarryforward:                              number;
  primaryTriggerLabel:                                  string;

  status:                                                    Status;
  statusLabel:                                                string;
  isAmtTriggered:                                              boolean;
  hasRecoveryPath:                                               boolean;

  reasoningChain:                                                  Array<{ layer: string; outcome: string; resolved: boolean }>;
  routes:                                                            Route[];
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
  result: AmtResult;
}

interface PopupAnswers {
  filing_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "can_67_amt_shock_auditor",
  p147: "can_147_amt_shock_auditor",
};

const AMT_EXEMPTION_2024 = 173205;
const AMT_RATE_2024 = 0.205;

const TOTAL_INCOME_MIDPOINT: Record<string, number> = {
  under_100k:     75000,
  "100k_to_250k": 175000,
  "250k_to_500k": 375000,
  over_500k:      700000,
};

const CAPITAL_GAINS_MIDPOINT: Record<string, number> = {
  none:           0,
  under_50k:      25000,
  "50k_to_200k":  125000,
  "200k_to_500k": 350000,
  over_500k:      750000,
};

const STOCK_OPTIONS_MIDPOINT: Record<string, number> = {
  none:           0,
  under_50k:      30000,
  "50k_to_200k":  125000,
  over_200k:      350000,
};

const DONATIONS_MIDPOINT: Record<string, number> = {
  none:        0,
  under_10k:   5000,
  "10k_to_50k": 30000,
  over_50k:     80000,
};

const DEDUCTIONS_MIDPOINT: Record<string, number> = {
  minimal:     5000,
  moderate:    60000,
  significant: 150000,
};

function cad(n: number): string {
  return `$${Math.round(n).toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
}

// Federal progressive rate approximation (simplified 2026 brackets)
function federalTaxEst(income: number): number {
  if (income <= 56000) return income * 0.15;
  if (income <= 112000) return 56000 * 0.15 + (income - 56000) * 0.205;
  if (income <= 173000) return 56000 * 0.15 + 56000 * 0.205 + (income - 112000) * 0.26;
  if (income <= 246000) return 56000 * 0.15 + 56000 * 0.205 + 61000 * 0.26 + (income - 173000) * 0.29;
  return 56000 * 0.15 + 56000 * 0.205 + 61000 * 0.26 + 73000 * 0.29 + (income - 246000) * 0.33;
}

function calcAmt(answers: AnswerMap): AmtResult {
  const primaryTriggers    = String(answers.primary_triggers     || "capital_gains_options");
  const capitalGains         = String(answers.capital_gains         || "200k_to_500k");
  const stockOptions           = String(answers.stock_options           || "50k_to_200k");
  const charitableDonations      = String(answers.charitable_donations    || "under_10k");
  const otherDeductions             = String(answers.other_deductions       || "moderate");
  const province                      = String(answers.province              || "ontario");
  const totalIncome                     = String(answers.total_income         || "250k_to_500k");

  const totalIncomeMidpoint = TOTAL_INCOME_MIDPOINT[totalIncome] ?? 375000;
  const capitalGainsMidpoint = CAPITAL_GAINS_MIDPOINT[capitalGains] ?? 350000;
  const stockOptionsMidpoint = STOCK_OPTIONS_MIDPOINT[stockOptions] ?? 125000;
  const donationsMidpoint = DONATIONS_MIDPOINT[charitableDonations] ?? 5000;
  const deductionsMidpoint = DEDUCTIONS_MIDPOINT[otherDeductions] ?? 60000;

  // Regular federal tax estimate:
  // Taxable income = total income + 50% capital gains + 50% stock option benefit - deductions - donation credit (approx)
  const regularCapGainIncl = capitalGainsMidpoint * 0.5;
  const regularStockOptIncl = stockOptionsMidpoint * 0.5;
  const regularTaxableIncome = Math.max(0, totalIncomeMidpoint + regularCapGainIncl + regularStockOptIncl - deductionsMidpoint);
  // Donation credit approx (15% federal on first $200 + 29% above — using 25% blended)
  const donationCredit = donationsMidpoint * 0.25;
  const regularFederalTax = Math.max(0, federalTaxEst(regularTaxableIncome) - donationCredit);

  // AMTI: total income + 100% capital gains + 100% stock option benefit - 50% of deductions + 100% of appreciated securities gains
  const amtCapGainIncl = capitalGainsMidpoint; // 100%
  const amtStockOptIncl = stockOptionsMidpoint; // 100% (50% deduction reversed)
  const amtDeductionsAllowed = deductionsMidpoint * 0.5;
  // Appreciated securities donation: if large donation, add back the embedded gain (assume ~60% of donation value is gain)
  const appreciatedGainAddBack = charitableDonations === "over_50k" ? donationsMidpoint * 0.6 : 0;
  const amti = totalIncomeMidpoint + amtCapGainIncl + amtStockOptIncl + appreciatedGainAddBack - amtDeductionsAllowed;

  const amtExemption = AMT_EXEMPTION_2024;
  const amtBase = Math.max(0, amti - amtExemption);
  const amtRate = AMT_RATE_2024;
  // AMT before credits
  const grossAmt = amtBase * amtRate;
  // Donation credit at 50% of regular AMT: donationsMidpoint * 0.25 * 0.5
  const amtDonationCredit = donationsMidpoint * 0.25 * 0.5;
  const amtFederal = Math.max(0, grossAmt - amtDonationCredit);

  const additionalAmtExposure = Math.max(0, amtFederal - regularFederalTax);
  const amtCreditCarryforward = additionalAmtExposure;

  // Primary trigger identification
  let primaryTriggerLabel = "none identified";
  if (primaryTriggers === "capital_gains_options") primaryTriggerLabel = "stock options + capital gains";
  else if (primaryTriggers === "capital_gains") primaryTriggerLabel = "large capital gain";
  else if (primaryTriggers === "stock_options") primaryTriggerLabel = "stock option benefit";
  else if (primaryTriggers === "charitable_donations") primaryTriggerLabel = "large charitable donations";
  else if (primaryTriggers === "loss_deductions") primaryTriggerLabel = "loss deductions applied";
  else if (primaryTriggers === "tax_shelter") primaryTriggerLabel = "tax shelter / resource deductions";

  const reasoningChain: AmtResult["reasoningChain"] = [];

  let status: Status | null = null;
  let statusLabel = "";

  // GATE 1 — no triggers
  if (primaryTriggers === "none" && capitalGainsMidpoint === 0 && stockOptionsMidpoint === 0 && donationsMidpoint < 20000) {
    reasoningChain.push({ layer: "Gate 1 — AMT triggers", outcome: "No material AMT triggers present — standard regular tax calculation applies.", resolved: true });
    status = "NO_AMT_EXPOSURE";
    statusLabel = "NO AMT EXPOSURE — STANDARD REGULAR TAX";
  } else {
    reasoningChain.push({ layer: "Gate 1 — AMT triggers", outcome: `Primary trigger: ${primaryTriggerLabel}. AMTI additions: capital gains ${cad(capitalGainsMidpoint)} (100% vs 50%); stock option benefit ${cad(stockOptionsMidpoint)} (100% vs 50%); ${appreciatedGainAddBack > 0 ? `appreciated securities donation gain ${cad(appreciatedGainAddBack)} at 100%; ` : ""}deductions ${cad(deductionsMidpoint)} limited to 50%.`, resolved: true });
  }

  // GATE 2 — AMTI vs exemption
  if (status === null && amti < amtExemption) {
    reasoningChain.push({ layer: "Gate 2 — AMT exemption", outcome: `AMTI ${cad(amti)} is below the $173,205 AMT exemption. No AMT calculation proceeds — regular tax applies.`, resolved: true });
    status = "NO_AMT_EXPOSURE";
    statusLabel = "NO AMT EXPOSURE — AMTI UNDER EXEMPTION";
  } else if (status === null) {
    reasoningChain.push({ layer: "Gate 2 — AMT calculation", outcome: `AMTI ${cad(amti)} − $173,205 exemption = ${cad(amtBase)} AMT base. × 20.5% rate = ${cad(grossAmt)} gross AMT. Less ${cad(amtDonationCredit)} (donation credit at 50% of regular value) = ${cad(amtFederal)} AMT.`, resolved: true });
  }

  // GATE 3 — compare to regular tax
  if (status === null) {
    reasoningChain.push({ layer: "Gate 3 — Regular vs AMT", outcome: `Regular federal tax estimate: ${cad(regularFederalTax)}. AMT: ${cad(amtFederal)}. ${amtFederal > regularFederalTax ? `AMT exceeds regular by ${cad(additionalAmtExposure)} — AMT applies.` : "Regular tax higher — AMT does not apply this year."}`, resolved: true });

    if (amtFederal > regularFederalTax * 1.15) {
      status = "HIGH_AMT_RISK";
      statusLabel = "HIGH AMT RISK — AMT SIGNIFICANTLY EXCEEDS REGULAR";
    } else if (amtFederal > regularFederalTax) {
      status = "MEDIUM_AMT_RISK";
      statusLabel = "MEDIUM AMT RISK — AMT EXCEEDS REGULAR";
    } else if (amtFederal > regularFederalTax * 0.85) {
      status = "LOW_AMT_RISK";
      statusLabel = "LOW AMT RISK — BORDERLINE";
    } else {
      status = "NO_AMT_EXPOSURE";
      statusLabel = "NO AMT EXPOSURE — REGULAR TAX DOMINANT";
    }
  }

  // Credit carryforward reasoning
  if (status === "HIGH_AMT_RISK" || status === "MEDIUM_AMT_RISK") {
    reasoningChain.push({ layer: "Gate 4 — Credit carryforward", outcome: `${cad(amtCreditCarryforward)} AMT credit generated — applies in future years when regular tax exceeds AMT. Indefinite carryforward period. Recovery typically occurs over 2-5 years if regular income returns to normal levels.`, resolved: true });
  }

  // Quebec note
  if (province === "quebec" && (status === "HIGH_AMT_RISK" || status === "MEDIUM_AMT_RISK" || status === "LOW_AMT_RISK")) {
    reasoningChain.push({ layer: "Gate 5 — Quebec provincial AMT", outcome: "Quebec residents also subject to separate provincial AMT (administered by Revenu Québec). Provincial AMT may apply in addition to federal AMT.", resolved: true });
  }

  const isAmtTriggered = status === "HIGH_AMT_RISK" || status === "MEDIUM_AMT_RISK";
  const hasRecoveryPath = isAmtTriggered && totalIncomeMidpoint >= 100000; // Assume recovery likely if ongoing income

  // Routing
  const routes: Route[] = [];
  if (isAmtTriggered) {
    routes.push({ label: "Canada Property Flipping Tax Trap", href: "/can/check/property-flipping-tax-trap", note: "If capital gain came from short-hold property" });
    routes.push({ label: "Canada Departure Tax Trap", href: "/can/check/departure-tax-trap", note: "If planning to leave Canada — AMT credit becomes unrecoverable" });
    routes.push({ label: "US Citizen Abroad Optimizer", href: "/nomad/check/us-expat-tax", note: "If US person with cross-border exposure" });
  } else if (status === "LOW_AMT_RISK") {
    routes.push({ label: "Canada Property Flipping Tax Trap", href: "/can/check/property-flipping-tax-trap", note: "Property-related capital gains context" });
    routes.push({ label: "Canada Departure Tax Trap", href: "/can/check/departure-tax-trap", note: "Related departure tax regime" });
  } else {
    routes.push({ label: "Canada Departure Tax Trap", href: "/can/check/departure-tax-trap", note: "Related Canadian exit tax regime" });
    routes.push({ label: "Canada Non-Resident Landlord", href: "/can/check/non-resident-landlord-withholding", note: "If renting Canadian property as non-resident" });
  }
  routes.push({ label: "← Back to Nomad Residency Risk Index", href: "/nomad", note: "Reclassify with updated answers" });

  return {
    primaryTriggers, capitalGains, stockOptions, charitableDonations, otherDeductions, province, totalIncome,
    totalIncomeMidpoint, capitalGainsMidpoint, stockOptionsMidpoint, donationsMidpoint, deductionsMidpoint,
    amti, amtExemption, amtBase, amtRate, amtFederal, regularFederalTax,
    additionalAmtExposure, amtCreditCarryforward, primaryTriggerLabel,
    status: status ?? "UNCERTAIN_NEEDS_REVIEW",
    statusLabel,
    isAmtTriggered, hasRecoveryPath,
    reasoningChain, routes,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcAmt(answers);

  const headline = (() => {
    if (result.status === "HIGH_AMT_RISK") return `AMT is significantly above your regular federal tax this year. Primary trigger: ${result.primaryTriggerLabel}. Regular federal tax estimate: ${cad(result.regularFederalTax)}. AMT estimate: ${cad(result.amtFederal)}. Additional tax from AMT: ${cad(result.additionalAmtExposure)}. This excess becomes an AMT credit carryforward recoverable in future years when regular tax exceeds AMT — indefinite period.`;
    if (result.status === "MEDIUM_AMT_RISK") return `AMT exceeds your regular federal tax this year — additional tax of approximately ${cad(result.additionalAmtExposure)}. Primary trigger: ${result.primaryTriggerLabel}. The excess becomes an AMT credit carryforward. For a one-off high-income event, the credit is typically recoverable over 2-5 years as regular income returns to normal levels.`;
    if (result.status === "LOW_AMT_RISK") return `AMT is close to regular federal tax — borderline outcome. AMTI ${cad(result.amti)} × 20.5% after exemption = ${cad(result.amtFederal)}. Regular federal tax ${cad(result.regularFederalTax)}. Small planning moves (RRSP contribution, deduction timing) could tip the calculation either way. Year-end modelling recommended before filing.`;
    if (result.status === "NO_AMT_EXPOSURE") return `No AMT exposure identified in this year. ${result.amti < result.amtExemption ? `AMTI of ${cad(result.amti)} is below the $173,205 AMT exemption.` : "AMT calculation proceeds but regular federal tax exceeds AMT — regular tax applies."} No AMT credit carryforward; no additional AMT tax owed.`;
    return `Your AMT position requires specialist review — inputs do not map cleanly to a single scenario.`;
  })();

  const consequences: string[] = [];

  if (result.status === "HIGH_AMT_RISK") {
    consequences.push(`🔒 AMT triggered — pay the greater of regular federal tax or AMT. Additional tax this year: ${cad(result.additionalAmtExposure)}.`);
    consequences.push(`AMTI breakdown: capital gains ${cad(result.capitalGainsMidpoint)} (100% inclusion) + stock options ${cad(result.stockOptionsMidpoint)} (50% deduction reversed) + other triggers. Total AMTI: ${cad(result.amti)}.`);
    consequences.push(`AMT credit carryforward of ${cad(result.amtCreditCarryforward)} — applies in future years when regular tax exceeds AMT. Indefinite period. For one-off events, typically recovered over 2-5 years.`);
    consequences.push(`Form T691 filed with T1 return — shows AMT calculation + carryforward balance. Retain documentation 6+ years.`);
    consequences.push(`Year-end planning (if still December): maximise RRSP contribution (AMT-safe deduction — reduces both regular tax AND AMTI equally). Split donations across years if feasible.`);
    consequences.push(`Multi-year recovery: project future regular tax exceeding AMT to ensure credit is recoverable. Key risks: impending retirement, emigration (credit unusable abroad), permanent low-income change.`);
    consequences.push(`Quebec residents: separate provincial AMT applies in addition to federal.`);
    consequences.push(`Engage Canadian CPA with AMT experience immediately — the 2024 reforms changed the calculation substantially; pre-2024 advice is unreliable.`);
  } else if (result.status === "MEDIUM_AMT_RISK") {
    consequences.push(`⚠ AMT applies — additional federal tax ${cad(result.additionalAmtExposure)} this year.`);
    consequences.push(`Primary trigger: ${result.primaryTriggerLabel}. The AMT calculation has captured preference items normally reduced under regular rules.`);
    consequences.push(`AMT credit carryforward: ${cad(result.amtCreditCarryforward)} recoverable in future years. Track on Form T691.`);
    consequences.push(`Recovery typical: high AMT in year of one-off event; regular tax exceeds AMT in normal years; credit fully absorbed within 2-5 years.`);
    consequences.push(`Planning moves if still possible: (a) additional RRSP contribution (deduction deadline 60 days after year-end); (b) review whether any optional deductions (carryforward losses) can be deferred to next year.`);
    consequences.push(`Multi-year coordination: if further high-income events anticipated, model combined impact across 3-year horizon.`);
  } else if (result.status === "LOW_AMT_RISK") {
    consequences.push(`AMT calculation close to regular tax — small moves could tip outcome either way.`);
    consequences.push(`AMTI ${cad(result.amti)} produces AMT of ${cad(result.amtFederal)}; regular federal tax ${cad(result.regularFederalTax)}.`);
    consequences.push(`Year-end RRSP contribution: AMT-safe deduction that reduces both calculations equally. Often converts borderline case to no-AMT outcome.`);
    consequences.push(`Deduction timing: if some deductions are optional or carryforward-eligible (e.g. carrying charges from prior years), consider deferring to next year if it reduces AMT exposure this year.`);
    consequences.push(`Year-end T691 dry run recommended — run the calculation in November/December before making year-end decisions.`);
  } else if (result.status === "NO_AMT_EXPOSURE") {
    consequences.push(`✓ No AMT this year — regular federal tax applies standard.`);
    consequences.push(result.amti < result.amtExemption ? `AMTI below exemption — no AMT calculation needed.` : `AMT calculation ran but regular tax exceeds AMT — no additional tax owing.`);
    consequences.push(`Annual re-check: if any of the trigger conditions change next year (large capital gain, stock options, donation strategy), re-run this auditor.`);
    consequences.push(`Prior-year AMT credit carryforward (if any) can still be applied against current regular tax — check T691 balance from prior returns.`);
  } else if (result.status === "UNCERTAIN_NEEDS_REVIEW") {
    consequences.push(`Specialist review required — inputs do not map cleanly to a single scenario.`);
    consequences.push(`Engage Canadian CPA with AMT experience. The 2024 reforms make older guidance unreliable.`);
    consequences.push(`Before engagement: gather T5/T5008 slips, T4PS stock option benefit records, donation receipts, and prior-year T691 for carryforward balance.`);
  }

  const statusClass = result.status === "HIGH_AMT_RISK" ? "text-red-700" : (result.status === "MEDIUM_AMT_RISK" ? "text-amber-700" : (result.status === "LOW_AMT_RISK" ? "text-amber-700" : (result.status === "UNCERTAIN_NEEDS_REVIEW" ? "text-amber-700" : "text-emerald-700")));
  const panelClass  = result.status === "HIGH_AMT_RISK" ? "border-red-200 bg-red-50" : (result.status === "MEDIUM_AMT_RISK" || result.status === "LOW_AMT_RISK" || result.status === "UNCERTAIN_NEEDS_REVIEW" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50");

  const confidence: ConfidenceLevel = result.status === "UNCERTAIN_NEEDS_REVIEW" ? "LOW" : (result.status === "LOW_AMT_RISK" ? "MEDIUM" : "HIGH");
  const confidenceNote = result.status === "UNCERTAIN_NEEDS_REVIEW"
    ? "Inputs do not map cleanly — specialist T691 run required."
    : result.status === "LOW_AMT_RISK"
      ? "Borderline outcome — small planning moves can change result. Year-end modelling recommended."
      : "AMT calculation based on simplified estimates. Actual T691 calculation requires detailed inputs.";

  // Tier selection
  const tier2Triggers = [
    result.primaryTriggers === "capital_gains_options",
    result.primaryTriggers === "tax_shelter",
    result.capitalGains === "over_500k" || result.capitalGains === "200k_to_500k",
    result.stockOptions === "over_200k" || result.stockOptions === "50k_to_200k",
    result.charitableDonations === "over_50k",
    result.otherDeductions === "significant",
    result.totalIncome === "over_500k",
    result.status === "HIGH_AMT_RISK",
    result.status === "MEDIUM_AMT_RISK",
  ];
  const tier: Tier = tier2Triggers.some(Boolean) ? 147 : 67;

  return {
    status: result.statusLabel,
    statusClass,
    panelClass,
    headline,
    stats: [
      { label: "AMT this year",                   value: cad(result.amtFederal),                                                                              highlight: result.isAmtTriggered },
      { label: "Regular federal tax",              value: cad(result.regularFederalTax)                                                                                                     },
      { label: "AMT additional (credit fwd)",       value: result.additionalAmtExposure > 0 ? cad(result.additionalAmtExposure) : "$0",                         highlight: result.additionalAmtExposure >= 5000 },
    ],
    consequences,
    confidence,
    confidenceNote,
    tier,
    ctaLabel: tier === 147 ? "Get My AMT Optimization System — $147 →" : "Get My AMT Risk Report — $67 →",
    altTierLabel: tier === 147 ? "Just want the risk report? — $67 instead" : "Want the full optimisation system? — $147",
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
    id: "primary_triggers", step: 1, type: "button_group",
    label: "Which of these apply this tax year?",
    subLabel: "Primary AMT triggers — select the most significant one for your position.",
    options: [
      { label: "Large capital gain (over $50k)",                  value: "capital_gains",          subLabel: "100% inclusion in AMTI" },
      { label: "Employee stock option benefit",                    value: "stock_options",         subLabel: "50% deduction reversed" },
      { label: "Large charitable donations (over $20k)",             value: "charitable_donations", subLabel: "Credit limited to 50%" },
      { label: "Stock options + capital gains",                       value: "capital_gains_options", subLabel: "Combined trigger — high risk" },
      { label: "Significant rental / business losses applied",          value: "loss_deductions",      subLabel: "Losses partially disallowed" },
      { label: "Tax shelter or resource deductions",                     value: "tax_shelter",           subLabel: "Deductions 50% disallowed" },
      { label: "None of the above",                                        value: "none",                    subLabel: "Low AMT risk" },
    ],
    required: true,
  },
  {
    id: "capital_gains", step: 2, type: "button_group",
    label: "Approximate total capital gains this year",
    subLabel: "Capital gains at 100% in AMTI vs 50% (or 2/3 above $250k after 25 June 2024) under regular rules.",
    options: [
      { label: "None",                         value: "none",          subLabel: "No AMT trigger from gains" },
      { label: "Under $50,000",                 value: "under_50k",     subLabel: "Modest exposure" },
      { label: "$50,000-$200,000",                value: "50k_to_200k",  subLabel: "Meaningful exposure" },
      { label: "$200,000-$500,000",                value: "200k_to_500k", subLabel: "Significant exposure" },
      { label: "Over $500,000",                     value: "over_500k",     subLabel: "Major AMTI addition" },
    ],
    required: true,
  },
  {
    id: "stock_options", step: 3, type: "button_group",
    label: "Stock option benefit (employment benefit from exercising stock options)",
    subLabel: "50% employment deduction reversed for AMT — 100% of benefit enters AMTI.",
    options: [
      { label: "None",                   value: "none",          subLabel: "No options trigger" },
      { label: "Under $50,000",            value: "under_50k",     subLabel: "Modest" },
      { label: "$50,000-$200,000",           value: "50k_to_200k",  subLabel: "Meaningful" },
      { label: "Over $200,000",                value: "over_200k",     subLabel: "Major AMTI addition" },
    ],
    required: true,
  },
  {
    id: "charitable_donations", step: 4, type: "button_group",
    label: "Charitable donations this year",
    subLabel: "Donation credit limited to 50% of regular value under AMT. Appreciated securities donations add capital gain to AMTI at 100%.",
    options: [
      { label: "None",                                           value: "none",       subLabel: "Not a factor" },
      { label: "Under $10,000",                                   value: "under_10k", subLabel: "Minimal impact" },
      { label: "$10,000-$50,000",                                  value: "10k_to_50k", subLabel: "Meaningful credit restriction" },
      { label: "Over $50,000 (or appreciated securities)",           value: "over_50k",   subLabel: "Major AMT consideration" },
    ],
    required: true,
  },
  {
    id: "other_deductions", step: 5, type: "button_group",
    label: "Other deductions being claimed (losses, carrying charges, professional expenses)",
    subLabel: "Employment expenses + carrying charges + non-capital losses all limited or restricted for AMT.",
    options: [
      { label: "Minimal — standard deductions only",                value: "minimal",     subLabel: "Low AMT risk" },
      { label: "Moderate — $20,000-$100,000 in deductions",          value: "moderate",    subLabel: "Moderate risk" },
      { label: "Significant — over $100,000 in deductions",            value: "significant", subLabel: "High AMT risk if combined with triggers" },
    ],
    required: true,
  },
  {
    id: "province", step: 6, type: "button_group",
    label: "Province of residence",
    subLabel: "Provincial AMT varies. Quebec has own separate system.",
    options: [
      { label: "Ontario",                     value: "ontario",   subLabel: "Federal AMT + Ontario surtax" },
      { label: "British Columbia",              value: "bc",       subLabel: "Federal AMT + BC calculation" },
      { label: "Alberta",                         value: "alberta", subLabel: "Federal AMT only (Alberta flat tax)" },
      { label: "Quebec",                            value: "quebec",  subLabel: "Federal AMT + separate Quebec AMT" },
      { label: "Other province",                      value: "other",   subLabel: "Federal AMT + provincial top-up" },
    ],
    required: true,
  },
  {
    id: "total_income", step: 7, type: "button_group",
    label: "Total income before deductions",
    subLabel: "Base income level — combined with triggers determines AMT exposure magnitude.",
    options: [
      { label: "Under $100,000",              value: "under_100k",    subLabel: "Likely under AMT exemption" },
      { label: "$100,000-$250,000",            value: "100k_to_250k", subLabel: "May trigger with large preference items" },
      { label: "$250,000-$500,000",             value: "250k_to_500k", subLabel: "High AMT risk zone" },
      { label: "Over $500,000",                   value: "over_500k",     subLabel: "Clearly above exemption — trigger-dependent" },
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
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">AMT calculation logic — ITA s127.5-127.55 (revised 2024)</p>
        <div className="space-y-1.5">
          {result.reasoningChain.map((r, i) => (
            <div key={i} className={`flex items-start gap-2 rounded px-2 py-1 ${r.resolved ? (result.status === "HIGH_AMT_RISK" ? "bg-red-100" : result.isAmtTriggered || result.status === "LOW_AMT_RISK" ? "bg-amber-100" : "bg-emerald-100") : "bg-white"}`}>
              <span className={`shrink-0 mt-0.5 text-[10px] font-mono font-bold ${r.resolved ? (result.status === "HIGH_AMT_RISK" ? "text-red-700" : result.isAmtTriggered || result.status === "LOW_AMT_RISK" ? "text-amber-700" : "text-emerald-700") : "text-neutral-500"}`}>{r.resolved ? "✓" : "→"}</span>
              <div className="flex-1">
                <p className={`text-[11px] font-bold ${r.resolved ? (result.status === "HIGH_AMT_RISK" ? "text-red-700" : result.isAmtTriggered || result.status === "LOW_AMT_RISK" ? "text-amber-700" : "text-emerald-700") : "text-neutral-700"}`}>{r.layer}</p>
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

      {/* AMT math visual */}
      {result.isAmtTriggered && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">AMT math — 2024+ reformed calculation</p>
          <p className="font-bold text-red-900">
            AMTI {cad(result.amti)} − $173,205 exemption = {cad(result.amtBase)} × 20.5% ≈ {cad(result.amtFederal)} AMT
          </p>
          <p className="mt-1 text-xs text-red-800">
            Regular federal tax: {cad(result.regularFederalTax)}. Pay the greater = {cad(result.amtFederal)}. Additional vs regular: {cad(result.additionalAmtExposure)}. Credit carryforward: {cad(result.amtCreditCarryforward)} (indefinite recovery).
          </p>
        </div>
      )}

      {/* Credit recovery visual */}
      {result.isAmtTriggered && result.hasRecoveryPath && (
        <div className="mb-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-emerald-700">✓ Credit recovery pathway</p>
          <p className="font-bold text-emerald-900">
            {cad(result.amtCreditCarryforward)} carries forward indefinitely
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            In future years where regular federal tax exceeds AMT, the credit reduces regular tax. For one-off income events, typical recovery over 2-5 years.
          </p>
        </div>
      )}

      {/* Language disclaimer */}
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        <strong>Language note:</strong> AMT is a parallel calculation — not a penalty. Excess AMT over regular tax becomes a carryforward credit. This estimate uses simplified assumptions; actual T691 calculation requires detailed inputs. Confirm with a Canadian CPA.
      </div>

      {/* Routing destinations */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Routing — Canadian tax + cross-border engines</p>
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
          <strong className="text-neutral-950">AMT is typically a timing issue, not a permanent cost.</strong> Excess AMT over regular tax becomes a credit recoverable in future years when regular tax exceeds AMT. The risk is for taxpayers who never have regular-tax-dominant years after the AMT event — retirement, emigration, permanent low income.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your specific AMT risk assessment with reasoning chain</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Regular tax vs AMT calculation comparison</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Primary AMT trigger analysis by income type</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>AMT credit carryforward calculation and recovery path</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Income + deduction timing strategy (tier 2)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Multi-year AMT credit recovery plan (tier 2)</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your specific Canadian AMT position</p>
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

export default function CanAmtShockCalculator() {
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
        product_slug: "can-amt-shock",
        source_path: "/can/check/amt-shock-auditor",
        country_code: "CA", currency_code: "CAD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          amt_status: verdict.result.status,
          amt_federal: verdict.result.amtFederal,
          regular_federal_tax: verdict.result.regularFederalTax,
          additional_amt: verdict.result.additionalAmtExposure,
          credit_carryforward: verdict.result.amtCreditCarryforward,
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
      body: JSON.stringify({ email, source: "can_amt_shock", country_code: "CA", site: "taxchecknow" }),
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
    const sid = sessionId || `canamt_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("can-amt-shock_primary_triggers",      String(answers.primary_triggers      || ""));
    sessionStorage.setItem("can-amt-shock_capital_gains",           String(answers.capital_gains          || ""));
    sessionStorage.setItem("can-amt-shock_stock_options",             String(answers.stock_options            || ""));
    sessionStorage.setItem("can-amt-shock_charitable_donations",        String(answers.charitable_donations    || ""));
    sessionStorage.setItem("can-amt-shock_other_deductions",              String(answers.other_deductions       || ""));
    sessionStorage.setItem("can-amt-shock_province",                        String(answers.province              || ""));
    sessionStorage.setItem("can-amt-shock_total_income",                      String(answers.total_income         || ""));
    sessionStorage.setItem("can-amt-shock_amt_federal",                          String(verdict.result.amtFederal));
    sessionStorage.setItem("can-amt-shock_regular_tax",                            String(verdict.result.regularFederalTax));
    sessionStorage.setItem("can-amt-shock_additional_amt",                           String(verdict.result.additionalAmtExposure));
    sessionStorage.setItem("can-amt-shock_credit_carryforward",                        String(verdict.result.amtCreditCarryforward));
    sessionStorage.setItem("can-amt-shock_amt_status",                                    verdict.result.status);
    sessionStorage.setItem("can-amt-shock_status",                                          verdict.status);
    sessionStorage.setItem("can-amt-shock_tier",                                             String(popupTier));

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
          success_url: `${window.location.origin}/can/check/amt-shock-auditor/success/${successPath}`,
          cancel_url: `${window.location.origin}/can/check/amt-shock-auditor`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your AMT decision for your Canadian tax advisor.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your AMT assessment by email — free.</p>
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
                    {popupTier === 67 ? "Your AMT Risk Report" : "Your AMT Optimization System"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">Income Tax Act (Canada) s127.5-127.55 · CRA · April 2026</p>
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
                      {popupTier === 67 ? "AMT Risk Report™" : "AMT Optimization System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your AMT risk assessment, regular tax vs AMT comparison, primary trigger analysis, and credit carryforward estimate."
                        : "Full AMT optimisation: income + deduction timing strategy, donation optimisation, multi-year AMT credit recovery plan, and adviser coordination framework."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic Canadian tax content. Your specific AMT position + credit recovery pathway.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My AMT Report →" : "Get My Optimization System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the report? — $67 instead" : "Want the full optimisation system? — $147 instead"}
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
                    { label: "Your role", key: "filing_role", options: [["high_earner_options","High-earner with stock options"],["capital_gains_year","Year with large capital gain"],["donor","Donor of appreciated securities"],["multi_trigger","Multiple triggers (options + gains + donations)"],["advisor","Canadian CPA / tax advisor"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["filing_deadline","T1 filing deadline approaching"],["year_end_planning","Year-end planning (November-December)"],["cra_letter","CRA letter / reassessment"],["multi_year_plan","Multi-year optimisation"],["planning","General planning"]] },
                    { label: "Do you have a Canadian tax advisor?", key: "accountant", options: [["cpa_amt","Yes — CPA with AMT expertise"],["general_cpa","Yes — general CPA"],["diy","Self-managed"],["none","No — need one"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · CRA AMT (ITA s127.5-127.55 revised 2024)</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && verdict.result.additionalAmtExposure >= 5000 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">AMT additional tax</p>
              <p className="text-sm font-bold text-neutral-950">
                {cad(verdict.result.additionalAmtExposure)} · credit fwd
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
