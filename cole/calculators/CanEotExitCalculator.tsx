"use client";

/**
 * CAN-05 — Canada EOT Exit Optimizer
 * Pattern: Sequential GateTest -> eligibility + exemption quantum
 *
 * Legal anchor: Income Tax Act (Canada) s56.3 (Budget 2023, window 2024-2026)
 *
 * CRITICAL LANGUAGE RULE: Never say "you qualify" deterministically.
 * Always "may qualify" / "appears to qualify" / "confirm with adviser".
 *
 * SEQUENTIAL GATES:
 *   1. Individual direct ownership -> or restructure needed
 *   2. CCPC + active business -> or ineligible
 *   3. 24-month QSBC holding -> or ineligible
 *   4. Within 2024-2026 window -> or outside window
 *   5. EOT established / being established -> or informal sale invalid
 *   6. All gates pass -> LIKELY_ELIGIBLE
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type Status =
  | "LIKELY_ELIGIBLE"
  | "CONDITIONAL_STRUCTURE_REVIEW"
  | "TIMING_ISSUE_OUTSIDE_WINDOW"
  | "TIMING_ISSUE_HOLDING_PERIOD"
  | "NOT_CCPC_INELIGIBLE"
  | "INFORMAL_SALE_NOT_EOT"
  | "UNCERTAIN_NEEDS_REVIEW";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface EotResult {
  ownershipStructure:    string;
  isCcpc:                 string;
  holdingPeriod:            string;
  withinWindow:               string;
  eotBeingEstablished:          string;
  estimatedGain:                  string;
  otherVendors:                     string;
  businessType:                       string;

  gainMidpoint:                          number;
  lcge2024:                                number;
  eotExemptionPool:                         number;   // $10M
  vendorShareOfPool:                         number;   // depends on multi-vendor
  potentialExemption:                         number;   // min(gain, pool share) + LCGE
  taxableGainAfterExemption:                    number;
  marginalRate:                                  number;   // ~50%
  taxSavedVsStandard:                              number;

  status:                                             Status;
  statusLabel:                                         string;
  isEligible:                                            boolean;
  needsRestructure:                                       boolean;

  reasoningChain:                                            Array<{ layer: string; outcome: string; resolved: boolean }>;
  routes:                                                      Route[];
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
  result: EotResult;
}

interface PopupAnswers {
  filing_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "can_67_eot_exit_optimizer",
  p147: "can_147_eot_exit_optimizer",
};

const LCGE_2024 = 1016602;
const EOT_EXEMPTION_POOL = 10000000;
const COMBINED_MARGINAL_RATE = 0.50; // Top combined fed + prov
const CG_INCLUSION = 0.5;

const GAIN_MIDPOINT: Record<string, number> = {
  under_1m:     500000,
  "1m_to_3m":   2000000,
  "3m_to_10m":  6500000,
  over_10m:     15000000,
};

const GAIN_LABEL: Record<string, string> = {
  under_1m:     "Under $1,000,000",
  "1m_to_3m":   "$1,000,000-$3,000,000",
  "3m_to_10m":  "$3,000,000-$10,000,000",
  over_10m:     "Over $10,000,000",
};

function cad(n: number): string {
  return `$${Math.round(n).toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
}

function calcEot(answers: AnswerMap): EotResult {
  const ownershipStructure    = String(answers.ownership_structure     || "individual_direct");
  const isCcpc                  = String(answers.is_ccpc                  || "yes_active");
  const holdingPeriod             = String(answers.holding_period           || "24_months_plus");
  const withinWindow                = String(answers.within_window            || "yes_in_window");
  const eotBeingEstablished           = String(answers.eot_being_established    || "planning");
  const estimatedGain                   = String(answers.estimated_gain           || "3m_to_10m");
  const otherVendors                      = String(answers.other_vendors            || "sole_vendor");
  const businessType                        = String(answers.business_type            || "active_non_professional");

  const gainMidpoint = GAIN_MIDPOINT[estimatedGain] ?? 6500000;
  const lcge2024 = LCGE_2024;
  // Vendor share of pool: if sole vendor -> full $10M; if multiple -> assume 50/50 split ($5M each)
  const vendorShareOfPool = otherVendors === "multiple_vendors" ? EOT_EXEMPTION_POOL / 2 : EOT_EXEMPTION_POOL;
  // Potential exemption: LCGE first, then EOT up to share of pool
  const gainAfterLcge = Math.max(0, gainMidpoint - lcge2024);
  const eotExemptionApplied = Math.min(gainAfterLcge, vendorShareOfPool);
  const potentialExemption = Math.min(gainMidpoint, lcge2024) + eotExemptionApplied;
  const taxableGainAfterExemption = Math.max(0, gainMidpoint - potentialExemption);

  // Tax saved vs standard (where only LCGE available):
  // Standard tax = max(0, gain - LCGE) × CG inclusion × marginal rate
  const standardTaxableGain = Math.max(0, gainMidpoint - lcge2024);
  const standardTax = standardTaxableGain * CG_INCLUSION * COMBINED_MARGINAL_RATE;
  // EOT tax = taxable gain after exemption × CG inclusion × marginal rate
  const eotTax = taxableGainAfterExemption * CG_INCLUSION * COMBINED_MARGINAL_RATE;
  const taxSavedVsStandard = Math.max(0, standardTax - eotTax);

  const reasoningChain: EotResult["reasoningChain"] = [];

  let status: Status | null = null;
  let statusLabel = "";

  // GATE 1 — ownership structure
  if (ownershipStructure !== "individual_direct") {
    reasoningChain.push({ layer: "Gate 1 — Ownership structure", outcome: `Shares held via ${ownershipStructure.replace(/_/g, " ")} — does NOT qualify directly. Pre-sale restructuring required: ${ownershipStructure === "family_trust" ? "distribute shares from trust to individual beneficiary" : ownershipStructure === "holding_company" ? "extract shares from holdco (dividend / s85 rollover)" : ownershipStructure === "partnership" ? "dissolve partnership / distribute partnership shares" : "clarify ownership structure first"}. Restructuring has its own tax consequences + timing impact.`, resolved: true });
    status = "CONDITIONAL_STRUCTURE_REVIEW";
    statusLabel = "CONDITIONAL — PRE-SALE RESTRUCTURING REQUIRED";
  } else {
    reasoningChain.push({ layer: "Gate 1 — Ownership structure", outcome: "Individual direct ownership of shares confirmed — gate passed.", resolved: true });
  }

  // GATE 2 — CCPC + active business
  if (status === null && isCcpc === "not_ccpc") {
    reasoningChain.push({ layer: "Gate 2 — CCPC + active business", outcome: "Not a Canadian-controlled private corporation — EOT exemption not available. Public company / foreign-controlled status is disqualifying.", resolved: true });
    status = "NOT_CCPC_INELIGIBLE";
    statusLabel = "INELIGIBLE — NOT A CCPC";
  } else if (status === null && isCcpc === "yes_with_investment") {
    reasoningChain.push({ layer: "Gate 2 — CCPC + active business", outcome: "CCPC with significant investment assets — active business test may fail if investment income or non-active assets exceed 10% of FMV. Pre-sale purification may be required.", resolved: true });
    if (ownershipStructure === "individual_direct") {
      status = "CONDITIONAL_STRUCTURE_REVIEW";
      statusLabel = "CONDITIONAL — ACTIVE BUSINESS TEST NEEDS REVIEW";
    }
  } else if (status === null) {
    reasoningChain.push({ layer: "Gate 2 — CCPC + active business", outcome: "CCPC with active business confirmed — gate passed.", resolved: true });
  }

  // GATE 3 — holding period
  if (status === null && holdingPeriod === "under_24_months") {
    reasoningChain.push({ layer: "Gate 3 — Holding period", outcome: "Shares held under 24 months — does NOT qualify. Must wait to reach 24-month mark. If close to window close (Dec 2026), may not be possible within qualifying period.", resolved: true });
    status = "TIMING_ISSUE_HOLDING_PERIOD";
    statusLabel = "TIMING ISSUE — HOLDING PERIOD UNDER 24 MONTHS";
  } else if (status === null) {
    reasoningChain.push({ layer: "Gate 3 — Holding period", outcome: "24-month minimum holding period met — gate passed.", resolved: true });
  }

  // GATE 4 — within window
  if (status === null && withinWindow === "after_window") {
    reasoningChain.push({ layer: "Gate 4 — Qualifying window", outcome: "Sale planned after 31 December 2026 — outside current EOT qualifying window. Legislation applies only to dispositions in 2024-2026. Extension not confirmed in any budget.", resolved: true });
    status = "TIMING_ISSUE_OUTSIDE_WINDOW";
    statusLabel = "TIMING ISSUE — OUTSIDE 2024-2026 WINDOW";
  } else if (status === null) {
    reasoningChain.push({ layer: "Gate 4 — Qualifying window", outcome: withinWindow === "already_sold" ? "Sale completed within 2024-2026 window — eligible for exemption claim on T1." : "Sale planned within 2024-2026 window — gate passed.", resolved: true });
  }

  // GATE 5 — EOT structure
  if (status === null && eotBeingEstablished === "informal_sale") {
    reasoningChain.push({ layer: "Gate 5 — EOT structure", outcome: "Informal sale to employees — does NOT qualify for EOT exemption. A formal Employee Ownership Trust under s56.3 is required (established in Canada, qualifying employee beneficiaries, qualifying governance giving employees control).", resolved: true });
    status = "INFORMAL_SALE_NOT_EOT";
    statusLabel = "INELIGIBLE — INFORMAL SALE NOT A QUALIFYING EOT";
  } else if (status === null && eotBeingEstablished === "unsure") {
    reasoningChain.push({ layer: "Gate 5 — EOT structure", outcome: "EOT structure uncertain — engage specialist legal counsel to establish qualifying trust. Setup typically 3-9 months. Confirm before transaction close.", resolved: true });
    if (ownershipStructure === "individual_direct" && status === null) {
      status = "CONDITIONAL_STRUCTURE_REVIEW";
      statusLabel = "CONDITIONAL — EOT STRUCTURE NEEDS ESTABLISHMENT";
    }
  } else if (status === null) {
    reasoningChain.push({ layer: "Gate 5 — EOT structure", outcome: eotBeingEstablished === "yes_establishing" ? "EOT being established with legal counsel — structural gate progressing." : "EOT planning underway — engage legal counsel promptly for 3-9 month setup.", resolved: true });
  }

  // GATE 6 — all pass
  if (status === null) {
    reasoningChain.push({ layer: "Final assessment", outcome: "All primary gates pass — structure appears to meet EOT exemption requirements. Engage qualified Canadian tax + legal counsel to execute.", resolved: true });
    status = "LIKELY_ELIGIBLE";
    statusLabel = "LIKELY ELIGIBLE — CONFIRM WITH SPECIALIST COUNSEL";
  }

  // Fallback
  if (status === null) {
    status = "UNCERTAIN_NEEDS_REVIEW";
    statusLabel = "UNCERTAIN — SPECIALIST REVIEW NEEDED";
  }

  // Tax quantum reasoning
  if (status === "LIKELY_ELIGIBLE" || status === "CONDITIONAL_STRUCTURE_REVIEW") {
    reasoningChain.push({ layer: "Tax saving estimate", outcome: `Gain ${cad(gainMidpoint)}: LCGE ${cad(lcge2024)} + EOT exemption ${cad(eotExemptionApplied)} ${otherVendors === "multiple_vendors" ? "(your share of $10M pool = $5M)" : "(up to full $10M pool as sole vendor)"} = ${cad(potentialExemption)} exempt. Taxable gain after exemption: ${cad(taxableGainAfterExemption)}. Tax saved vs standard sale: ${cad(taxSavedVsStandard)}.`, resolved: true });
  }

  // Business type note
  if (businessType === "professional" && (status === "LIKELY_ELIGIBLE" || status === "CONDITIONAL_STRUCTURE_REVIEW")) {
    reasoningChain.push({ layer: "Business type note", outcome: "Professional corporation — may face specific restrictions depending on province + active business test. Confirm with specialist counsel before relying on exemption.", resolved: true });
  }

  const isEligible = status === "LIKELY_ELIGIBLE";
  const needsRestructure = status === "CONDITIONAL_STRUCTURE_REVIEW" || ownershipStructure !== "individual_direct";

  // Routing
  const routes: Route[] = [];
  if (isEligible || status === "CONDITIONAL_STRUCTURE_REVIEW") {
    routes.push({ label: "Canada Departure Tax Trap — post-sale emigration planning", href: "/can/check/departure-tax-trap", note: "If considering leaving Canada after the EOT sale" });
    routes.push({ label: "Canada AMT Shock Auditor — cross-check", href: "/can/check/amt-shock-auditor", note: "Large capital gain year may trigger AMT" });
    routes.push({ label: "Tax Treaty Navigator — post-sale international planning", href: "/nomad/check/tax-treaty-navigator", note: "If international asset allocation planned post-sale" });
  } else if (status === "TIMING_ISSUE_OUTSIDE_WINDOW" || status === "TIMING_ISSUE_HOLDING_PERIOD") {
    routes.push({ label: "Canada Departure Tax Trap", href: "/can/check/departure-tax-trap", note: "Alternative exit planning" });
    routes.push({ label: "Canada AMT Shock Auditor", href: "/can/check/amt-shock-auditor", note: "Standard sale tax review" });
  } else {
    routes.push({ label: "Canada AMT Shock Auditor", href: "/can/check/amt-shock-auditor", note: "Tax review if alternative structure used" });
    routes.push({ label: "Canada Departure Tax Trap", href: "/can/check/departure-tax-trap", note: "Post-sale planning options" });
  }
  routes.push({ label: "← Back to Nomad Residency Risk Index", href: "/nomad", note: "Reclassify with updated answers" });

  return {
    ownershipStructure, isCcpc, holdingPeriod, withinWindow, eotBeingEstablished, estimatedGain, otherVendors, businessType,
    gainMidpoint, lcge2024, eotExemptionPool: EOT_EXEMPTION_POOL, vendorShareOfPool,
    potentialExemption, taxableGainAfterExemption, marginalRate: COMBINED_MARGINAL_RATE, taxSavedVsStandard,
    status, statusLabel, isEligible, needsRestructure,
    reasoningChain, routes,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcEot(answers);

  const headline = (() => {
    if (result.status === "LIKELY_ELIGIBLE") return `Your structure appears to meet the core EOT exemption requirements under s56.3. Based on ${GAIN_LABEL[result.estimatedGain]} estimated gain: combined LCGE + EOT exemption may shelter ${cad(result.potentialExemption)}, leaving ${cad(result.taxableGainAfterExemption)} taxable. Estimated tax saved vs standard sale: ${cad(result.taxSavedVsStandard)}. Engage qualified Canadian tax + legal counsel to confirm and execute within the 31 December 2026 window.`;
    if (result.status === "CONDITIONAL_STRUCTURE_REVIEW") return `Your structure has elements that may qualify but require attention before transaction. ${result.ownershipStructure !== "individual_direct" ? "Shares are held via " + result.ownershipStructure.replace(/_/g, " ") + " — pre-sale restructuring required to transfer to individual ownership." : result.isCcpc === "yes_with_investment" ? "Active business test may be compromised by significant investment assets — pre-sale purification may be required." : "EOT structure needs establishment via specialist legal counsel."} Potential tax saving if resolved: ${cad(result.taxSavedVsStandard)}. Timeline critical: window closes 31 December 2026.`;
    if (result.status === "TIMING_ISSUE_OUTSIDE_WINDOW") return `Sale is planned for after 31 December 2026 — outside the current EOT qualifying window. Under current legislation, EOT exemption applies only to qualifying dispositions from 1 January 2024 through 31 December 2026. Whether the window will be extended in future budgets is uncertain. If the sale can be accelerated into 2026, significant tax saving is available (~${cad(result.taxSavedVsStandard)}).`;
    if (result.status === "TIMING_ISSUE_HOLDING_PERIOD") return `Shares have been held for under 24 months — does not meet the QSBC holding period requirement. Must wait until the 24-month mark AND complete the sale within the 2024-2026 window. If window closes before holding period is met, EOT exemption is unavailable for this sale.`;
    if (result.status === "NOT_CCPC_INELIGIBLE") return `Shares are not of a Canadian-controlled private corporation — EOT exemption not available. Public companies and foreign-controlled entities are outside scope of s56.3. Alternative tax planning for the sale should be explored (LCGE if QSBC; capital gains treatment standard).`;
    if (result.status === "INFORMAL_SALE_NOT_EOT") return `Sale to employees without establishing a formal EOT does not qualify for the exemption. A qualifying Employee Ownership Trust under s56.3 has specific structural requirements: established in Canada, qualifying employee beneficiaries, employee control via governance provisions, qualifying EOT controller. Informal sales or standard ESOPs are not sufficient.`;
    return `Your EOT position requires specialist review — inputs do not map cleanly to a single scenario.`;
  })();

  const consequences: string[] = [];

  if (result.status === "LIKELY_ELIGIBLE") {
    consequences.push(`✓ All core eligibility gates appear to be met. Estimated potential exemption: ${cad(result.potentialExemption)} (LCGE + EOT combined).`);
    consequences.push(`Estimated tax saved vs standard sale: ${cad(result.taxSavedVsStandard)} — represents approximately the value of the EOT structure over LCGE-only treatment.`);
    consequences.push(`Timeline: 31 December 2026 window close means transaction must complete by that date. Typical EOT setup: 6-9 months for legal + tax + valuation + execution. Start now if planning.`);
    consequences.push(`Legal fees: ~$30k-$75k for specialist EOT counsel. Tax advisory: ~$10k-$30k. Business valuation (independent): ~$15k-$30k. Total setup: ~$55k-$135k. ROI strong at this exemption level.`);
    consequences.push(`Vendor financing: EOT typically has no cash; vendor accepts promissory note repayable over 5-10 years from future business earnings. Interest rate must be reasonable.`);
    consequences.push(`Governance: EOT must grant qualifying employees effective control. Vendor can remain as CEO / director but cannot retain veto / super-majority rights.`);
    consequences.push(`Documentation retention: all eligibility evidence + trust deed + transaction agreements + financing documentation + governance records — 6+ years.`);
  } else if (result.status === "CONDITIONAL_STRUCTURE_REVIEW") {
    consequences.push(`⚠ Structural attention required before transaction.`);
    if (result.ownershipStructure === "family_trust") {
      consequences.push(`Pre-sale fix: distribute shares from family trust to individual beneficiary. Trust realises gain on distribution at FMV. ACB to individual = FMV at distribution. Timing: 2-6 months. Model trust-level tax impact.`);
    } else if (result.ownershipStructure === "holding_company") {
      consequences.push(`Pre-sale fix: extract shares from holdco via dividend / s85 rollover. Dividend taxable to shareholder at integrated rate (~40%). S85 rollover defers tax if structured correctly (T2057 election). Timing: 3-6 months.`);
    } else if (result.ownershipStructure === "partnership") {
      consequences.push(`Pre-sale fix: dissolve partnership / distribute partnership shares. Complex — partnership tax is specialised. Timing: 3-6 months. Specialist partnership counsel required.`);
    } else if (result.isCcpc === "yes_with_investment") {
      consequences.push(`Active business purification: distribute investment assets out of the corporation before sale to meet the 90% active-business FMV test. Creates dividends / shareholder benefits — model tax impact.`);
    } else {
      consequences.push(`EOT structure: engage specialist legal counsel immediately to draft qualifying trust deed + governance. Setup typically 6-9 months.`);
    }
    consequences.push(`Potential tax saving if resolved: ${cad(result.taxSavedVsStandard)} — must exceed restructuring tax cost + professional fees. Model carefully.`);
    consequences.push(`Timeline urgency: window closes 31 December 2026. Account for restructuring time + EOT setup + transaction execution — 9-12 months total.`);
    consequences.push(`Engage Canadian CPA + legal counsel with EOT expertise in parallel. Specialist practitioners are limited — book early.`);
  } else if (result.status === "TIMING_ISSUE_OUTSIDE_WINDOW") {
    consequences.push(`🔒 Sale timing outside qualifying window — EOT exemption not available under current legislation.`);
    consequences.push(`Current window: 1 January 2024 - 31 December 2026 inclusive. No extension confirmed in any budget.`);
    consequences.push(`Option 1: accelerate sale into 2026 — potential saving ${cad(result.taxSavedVsStandard)}. Feasible if transaction infrastructure can be completed in time.`);
    consequences.push(`Option 2: monitor budget announcements for extension — uncertain; cannot be relied upon.`);
    consequences.push(`Option 3: proceed with standard sale post-2026 — LCGE still available; capital gain inclusion at 50% (up to $250k annual for individuals post-25 June 2024) or 2/3 above. Combined marginal rate ~50% on included portion.`);
    consequences.push(`Alternative: structure the sale as a series of transactions with some portion completing within the 2024-2026 window (if business / legal structure allows) — specialist advice required.`);
  } else if (result.status === "TIMING_ISSUE_HOLDING_PERIOD") {
    consequences.push(`🔒 24-month holding period not met — cannot qualify for EOT exemption yet.`);
    consequences.push(`Required: 24 consecutive months of individual ownership of QSBC shares before sale date. Count from actual share acquisition date.`);
    consequences.push(`Plan: wait until 24-month mark AND complete sale before 31 December 2026. Calculate whether both can be met.`);
    consequences.push(`If holding period ends after 31 December 2026: EOT exemption not available for this sale under current rules.`);
    consequences.push(`Interim strategy: standard LCGE planning; prepare EOT establishment concurrently so execution is ready when holding period is satisfied.`);
  } else if (result.status === "NOT_CCPC_INELIGIBLE") {
    consequences.push(`🔒 Not a CCPC — EOT exemption requirements cannot be met.`);
    consequences.push(`Public company shares: standard capital gain treatment applies. LCGE not available. Focus on timing of disposition + inclusion rate optimisation.`);
    consequences.push(`Foreign-controlled corporation: CCPC status lost when foreign control acquired. Cannot restore for this transaction.`);
    consequences.push(`Alternative planning: timing disposition across tax years (50% inclusion up to $250k; 2/3 inclusion above for individuals post-25 June 2024); use of RRSP room; donation of appreciated securities.`);
  } else if (result.status === "INFORMAL_SALE_NOT_EOT") {
    consequences.push(`🔒 Informal employee sale does not qualify for EOT exemption.`);
    consequences.push(`Requirement: qualifying Employee Ownership Trust under s56.3 — formal trust structure with legal counsel, qualifying employee beneficiaries, employee-controlled governance, qualifying EOT controller.`);
    consequences.push(`To qualify, restructure the transaction: establish formal EOT with specialist counsel; employees become beneficiaries of the trust (not direct shareholders); vendor sells to trust not to employees directly.`);
    consequences.push(`Timeline: EOT establishment + trust deed + governance: 3-9 months with specialist legal counsel.`);
    consequences.push(`Alternative: employee share ownership plan (ESOP) with different (non-EOT) tax treatment — standard LCGE only.`);
  } else if (result.status === "UNCERTAIN_NEEDS_REVIEW") {
    consequences.push(`Specialist review required — inputs do not map cleanly.`);
    consequences.push(`Engage Canadian CPA + legal counsel with EOT expertise. This is specialist territory; generic business advisors miss key issues.`);
    consequences.push(`Before specialist engagement: gather shareholder registry, historical ownership records, corporation articles + bylaws, recent financial statements.`);
  }

  const statusClass = result.isEligible ? "text-emerald-700" : (result.status === "CONDITIONAL_STRUCTURE_REVIEW" ? "text-amber-700" : (result.status === "TIMING_ISSUE_OUTSIDE_WINDOW" || result.status === "TIMING_ISSUE_HOLDING_PERIOD" ? "text-red-700" : (result.status === "NOT_CCPC_INELIGIBLE" || result.status === "INFORMAL_SALE_NOT_EOT" ? "text-red-700" : "text-amber-700")));
  const panelClass  = result.isEligible ? "border-emerald-200 bg-emerald-50" : (result.status === "CONDITIONAL_STRUCTURE_REVIEW" ? "border-amber-200 bg-amber-50" : (result.status === "TIMING_ISSUE_OUTSIDE_WINDOW" || result.status === "TIMING_ISSUE_HOLDING_PERIOD" ? "border-red-200 bg-red-50" : (result.status === "NOT_CCPC_INELIGIBLE" || result.status === "INFORMAL_SALE_NOT_EOT" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50")));

  const confidence: ConfidenceLevel = result.status === "UNCERTAIN_NEEDS_REVIEW" ? "LOW" : (result.isEligible ? "HIGH" : "MEDIUM");
  const confidenceNote = result.status === "UNCERTAIN_NEEDS_REVIEW"
    ? "Inputs do not map cleanly — specialist review essential."
    : result.isEligible
      ? "Eligibility appears strong — specialist legal + tax counsel should confirm and execute."
      : "Eligibility gates identified specific issues; outcome depends on resolution of those issues within the 2024-2026 window.";

  // Tier selection
  const tier2Triggers = [
    result.ownershipStructure === "family_trust" || result.ownershipStructure === "holding_company" || result.ownershipStructure === "partnership",
    result.estimatedGain === "over_10m" || result.estimatedGain === "3m_to_10m",
    result.otherVendors === "multiple_vendors",
    result.isCcpc === "yes_with_investment",
    result.eotBeingEstablished === "planning" || result.eotBeingEstablished === "unsure",
    result.needsRestructure,
  ];
  const tier: Tier = tier2Triggers.some(Boolean) ? 147 : 67;

  return {
    status: result.statusLabel,
    statusClass,
    panelClass,
    headline,
    stats: [
      { label: "Potential exemption",        value: cad(result.potentialExemption),                                                                                                             highlight: result.potentialExemption >= 3000000 },
      { label: "Tax saved vs standard",        value: result.taxSavedVsStandard > 0 ? cad(result.taxSavedVsStandard) : "$0",                                                                      highlight: result.taxSavedVsStandard >= 500000 },
      { label: "Window closes",                 value: "31 Dec 2026",                                                                                                                                                                                    },
    ],
    consequences,
    confidence,
    confidenceNote,
    tier,
    ctaLabel: tier === 147 ? "Get My EOT Exit Strategy — $147 →" : "Get My EOT Eligibility Report — $67 →",
    altTierLabel: tier === 147 ? "Just want the eligibility report? — $67 instead" : "Want the full exit strategy + restructuring plan? — $147",
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
    id: "ownership_structure", step: 1, type: "button_group",
    label: "What type of entity owns the shares you plan to sell?",
    subLabel: "EOT exemption requires individual direct ownership. Trust / holdco / partnership = pre-sale restructuring required.",
    options: [
      { label: "I own shares directly as an individual",             value: "individual_direct", subLabel: "Eligibility gate passed" },
      { label: "Shares held in a family trust",                       value: "family_trust",     subLabel: "Restructure required" },
      { label: "Shares held in a holding company",                     value: "holding_company",  subLabel: "Restructure required" },
      { label: "Shares held through a partnership",                      value: "partnership",      subLabel: "Restructure required" },
      { label: "Not sure of ownership structure",                         value: "unsure",            subLabel: "Review shareholder registry" },
    ],
    required: true,
  },
  {
    id: "is_ccpc", step: 2, type: "button_group",
    label: "Is the business a Canadian-controlled private corporation (CCPC)?",
    subLabel: "CCPC status + active business required. Public or foreign-controlled = ineligible.",
    options: [
      { label: "Yes — CCPC with active business operations",        value: "yes_active",        subLabel: "Eligibility gate passed" },
      { label: "Yes — but significant investment assets",             value: "yes_with_investment", subLabel: "Active business test at risk" },
      { label: "No — public company or foreign-controlled",             value: "not_ccpc",           subLabel: "Ineligible" },
      { label: "Not sure",                                              value: "unsure",              subLabel: "Corporate counsel confirmation needed" },
    ],
    required: true,
  },
  {
    id: "holding_period", step: 3, type: "button_group",
    label: "How long have you owned the shares?",
    subLabel: "24-month minimum QSBC holding period required.",
    options: [
      { label: "Under 24 months (does not qualify)",          value: "under_24_months",  subLabel: "Must wait to qualify" },
      { label: "24 months or more",                              value: "24_months_plus",   subLabel: "Eligibility gate passed" },
      { label: "Not sure",                                         value: "unsure",            subLabel: "Review acquisition records" },
    ],
    required: true,
  },
  {
    id: "within_window", step: 4, type: "button_group",
    label: "Is the transaction planned within the 2024-2026 qualifying window?",
    subLabel: "Absolute deadline: 31 December 2026. Extension possible in future budgets but uncertain.",
    options: [
      { label: "Yes — planning to sell in 2024, 2025, or 2026",   value: "yes_in_window",  subLabel: "Within window" },
      { label: "No — planning for after 2026",                      value: "after_window",   subLabel: "Outside current window" },
      { label: "Already sold in 2024, 2025, or 2026",                value: "already_sold",   subLabel: "Eligible for T1 claim" },
    ],
    required: true,
  },
  {
    id: "eot_being_established", step: 5, type: "button_group",
    label: "Will a formal Employee Ownership Trust be established?",
    subLabel: "Must meet full s56.3 statutory EOT definition. Informal sales to employees do NOT qualify.",
    options: [
      { label: "Yes — EOT is being set up with legal counsel",   value: "yes_establishing", subLabel: "On track" },
      { label: "Planning to — not yet established",                value: "planning",         subLabel: "Need to engage legal counsel" },
      { label: "Selling to employees informally (not an EOT)",      value: "informal_sale",   subLabel: "Does NOT qualify" },
      { label: "Not sure what structure to use",                      value: "unsure",           subLabel: "Specialist counsel required" },
    ],
    required: true,
  },
  {
    id: "estimated_gain", step: 6, type: "button_group",
    label: "Estimated capital gain on the sale",
    subLabel: "$10M exemption pool shared across all vendors. Quantifies tax saving magnitude.",
    options: [
      { label: "Under $1,000,000",           value: "under_1m",      subLabel: "LCGE may cover entire gain" },
      { label: "$1,000,000-$3,000,000",       value: "1m_to_3m",     subLabel: "Moderate exemption value" },
      { label: "$3,000,000-$10,000,000",      value: "3m_to_10m",     subLabel: "Significant exemption value" },
      { label: "Over $10,000,000",              value: "over_10m",      subLabel: "Exemption capped at $10M pool" },
    ],
    required: true,
  },
  {
    id: "other_vendors", step: 7, type: "button_group",
    label: "Are there other vendors selling to the same EOT?",
    subLabel: "$10M exemption is shared — multi-vendor reduces per-vendor amount.",
    options: [
      { label: "No — sole vendor",                                  value: "sole_vendor",       subLabel: "Full $10M pool available" },
      { label: "Yes — family members or co-owners also selling",    value: "multiple_vendors",  subLabel: "Pool split among vendors" },
      { label: "Not sure",                                            value: "unsure",             subLabel: "Confirm at deal structure" },
    ],
    required: true,
  },
  {
    id: "business_type", step: 8, type: "button_group",
    label: "Business type",
    subLabel: "Professional corporations may face specific restrictions. General active business qualifies.",
    options: [
      { label: "Professional services (law, medicine, accounting, engineering)", value: "professional",         subLabel: "May have provincial restrictions" },
      { label: "Technology / software / manufacturing",                             value: "tech_manufacturing",  subLabel: "Standard active business" },
      { label: "Retail / hospitality / trades",                                      value: "retail_trades",       subLabel: "Standard active business" },
      { label: "Other active business",                                                value: "active_non_professional", subLabel: "Standard active business" },
    ],
    required: true,
  },
];

const TOTAL_STEPS = 8;

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
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">EOT eligibility gates — Income Tax Act (Canada) s56.3</p>
        <div className="space-y-1.5">
          {result.reasoningChain.map((r, i) => (
            <div key={i} className={`flex items-start gap-2 rounded px-2 py-1 ${r.resolved ? (result.isEligible ? "bg-emerald-100" : result.status === "CONDITIONAL_STRUCTURE_REVIEW" ? "bg-amber-100" : "bg-red-100") : "bg-white"}`}>
              <span className={`shrink-0 mt-0.5 text-[10px] font-mono font-bold ${r.resolved ? (result.isEligible ? "text-emerald-700" : result.status === "CONDITIONAL_STRUCTURE_REVIEW" ? "text-amber-700" : "text-red-700") : "text-neutral-500"}`}>{r.resolved ? "✓" : "→"}</span>
              <div className="flex-1">
                <p className={`text-[11px] font-bold ${r.resolved ? (result.isEligible ? "text-emerald-700" : result.status === "CONDITIONAL_STRUCTURE_REVIEW" ? "text-amber-700" : "text-red-700") : "text-neutral-700"}`}>{r.layer}</p>
                <p className="text-xs text-neutral-700">{r.outcome}</p>
              </div>
            </div>
          ))}
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

      {/* Tax saving math visual */}
      {(result.isEligible || result.status === "CONDITIONAL_STRUCTURE_REVIEW") && result.taxSavedVsStandard > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-emerald-700">EOT exemption math — s56.3</p>
          <p className="font-bold text-emerald-900">
            Potential exemption: {cad(result.potentialExemption)} (LCGE {cad(result.lcge2024)} + EOT up to {cad(result.vendorShareOfPool)})
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            Taxable gain after exemption: {cad(result.taxableGainAfterExemption)}. Tax saved vs standard sale: {cad(result.taxSavedVsStandard)}. Window closes 31 December 2026.
          </p>
        </div>
      )}

      {/* Restructuring needed visual */}
      {result.status === "CONDITIONAL_STRUCTURE_REVIEW" && result.ownershipStructure !== "individual_direct" && (
        <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">Pre-sale restructuring required</p>
          <p className="font-bold text-amber-900">
            Shares in {result.ownershipStructure.replace(/_/g, " ")} — must transfer to individual ownership
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Timeline: 2-6 months. Has own tax consequences. Total time to close (restructure + EOT + transaction) typically 9-12 months — window closes 31 December 2026.
          </p>
        </div>
      )}

      {/* Window closed visual */}
      {(result.status === "TIMING_ISSUE_OUTSIDE_WINDOW" || result.status === "NOT_CCPC_INELIGIBLE" || result.status === "INFORMAL_SALE_NOT_EOT") && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">EOT exemption unavailable</p>
          <p className="font-bold text-red-900">
            Standard sale treatment applies
          </p>
          <p className="mt-1 text-xs text-red-800">
            LCGE ${LCGE_2024.toLocaleString()} (2024, indexed) still available for QSBC shares. Capital gain inclusion at 50% (up to $250k annual for individuals post-25 June 2024) / 2/3 above.
          </p>
        </div>
      )}

      {/* Language disclaimer */}
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        <strong>Language note:</strong> EOT eligibility is highly fact-specific. This assessment uses &quot;may&quot; deliberately — confirm with qualified Canadian tax + legal counsel before proceeding. Specialist practitioners required given complexity.
      </div>

      {/* Routing destinations */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Routing — Canadian exit + cross-border engines</p>
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
          <strong className="text-neutral-950">Structure is the usual failure point, not sale price.</strong> Most EOT transactions that fail do so because of ownership structure (shares in trust / holdco) or EOT non-compliance — not the business or exemption size. Pre-sale planning with specialist counsel is non-negotiable.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your specific EOT eligibility assessment with gate-by-gate reasoning</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Structural requirements checklist (vendor + business + EOT + timing)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Exemption quantum + LCGE interaction modelling</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Failure point identification + pre-sale fixes</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Pre-sale restructuring strategy (tier 2)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Vendor financing + governance framework (tier 2)</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your specific EOT transaction position</p>
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

export default function CanEotExitCalculator() {
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
        product_slug: "can-eot-exit",
        source_path: "/can/check/eot-exit-optimizer",
        country_code: "CA", currency_code: "CAD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          eot_status: verdict.result.status,
          potential_exemption: verdict.result.potentialExemption,
          tax_saved: verdict.result.taxSavedVsStandard,
          is_eligible: verdict.result.isEligible,
          needs_restructure: verdict.result.needsRestructure,
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
      body: JSON.stringify({ email, source: "can_eot_exit", country_code: "CA", site: "taxchecknow" }),
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
    const sid = sessionId || `caneot_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("can-eot-exit_ownership_structure",    String(answers.ownership_structure    || ""));
    sessionStorage.setItem("can-eot-exit_is_ccpc",                  String(answers.is_ccpc                 || ""));
    sessionStorage.setItem("can-eot-exit_holding_period",             String(answers.holding_period           || ""));
    sessionStorage.setItem("can-eot-exit_within_window",                String(answers.within_window            || ""));
    sessionStorage.setItem("can-eot-exit_eot_being_established",          String(answers.eot_being_established    || ""));
    sessionStorage.setItem("can-eot-exit_estimated_gain",                   String(answers.estimated_gain           || ""));
    sessionStorage.setItem("can-eot-exit_other_vendors",                      String(answers.other_vendors            || ""));
    sessionStorage.setItem("can-eot-exit_business_type",                        String(answers.business_type             || ""));
    sessionStorage.setItem("can-eot-exit_potential_exemption",                    String(verdict.result.potentialExemption));
    sessionStorage.setItem("can-eot-exit_tax_saved",                                String(verdict.result.taxSavedVsStandard));
    sessionStorage.setItem("can-eot-exit_eot_status",                                 verdict.result.status);
    sessionStorage.setItem("can-eot-exit_status",                                      verdict.status);
    sessionStorage.setItem("can-eot-exit_tier",                                         String(popupTier));

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
          success_url: `${window.location.origin}/can/check/eot-exit-optimizer/success/${successPath}`,
          cancel_url: `${window.location.origin}/can/check/eot-exit-optimizer`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your EOT decision for your Canadian tax + legal team.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your EOT eligibility assessment by email — free.</p>
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
                    {popupTier === 67 ? "Your EOT Eligibility Report" : "Your EOT Exit Strategy System"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">Income Tax Act (Canada) s56.3 · 2024-2026 window · CRA · April 2026</p>
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
                      {popupTier === 67 ? "EOT Eligibility Report™" : "EOT Exit Strategy System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your eligibility assessment, structural requirements check, failure point identification, potential exemption quantum, and LCGE interaction analysis."
                        : "Full EOT transaction system: pre-sale restructuring plan, EOT establishment roadmap, vendor financing + governance framework, multi-vendor allocation strategy, and transaction timing optimisation."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic Canadian tax content. Your specific EOT position + structural fix pathway + transaction roadmap.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My EOT Report →" : "Get My Exit Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the eligibility report? — $67 instead" : "Want the full exit strategy? — $147 instead"}
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
                    { label: "Your role", key: "filing_role", options: [["founder_ceo","Founder / CEO planning exit"],["family_business","Family business multi-vendor"],["minority_shareholder","Minority shareholder in EOT deal"],["professional","Professional services corporation"],["advisor","Canadian CPA / legal counsel"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["window_closing","Window closing 31 Dec 2026 — urgent"],["active_transaction","Active transaction / legal counsel engaged"],["restructure_needed","Pre-sale restructuring required"],["exploring","Exploring options"],["planning","General planning"]] },
                    { label: "Do you have Canadian tax + legal counsel?", key: "accountant", options: [["specialist_eot","Yes — CPA + legal counsel with EOT expertise"],["cpa_only","Yes — CPA but not EOT specialist"],["legal_only","Yes — legal counsel but not EOT specialist"],["none","No — need specialists"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · CRA EOT exemption (ITA s56.3, 2024-2026)</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && verdict.result.taxSavedVsStandard >= 250000 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">EOT tax saved</p>
              <p className="text-sm font-bold text-neutral-950">
                {cad(verdict.result.taxSavedVsStandard)} · window closes Dec 2026
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
