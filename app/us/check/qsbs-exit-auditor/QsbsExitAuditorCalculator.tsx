"use client";

/**
 * US-03 — QSBS Exit Risk Engine (formerly QSBS Exit Auditor)
 * Pattern: D (GateTest — 7 sequential gates, all must pass for full exclusion)
 *
 * Core question: On exit, does the taxpayer's stock qualify as QSBS under §1202 —
 * and which exclusion regime applies given pre- or post-July 4, 2025 acquisition?
 *
 * TWO LEGAL REGIMES — MUST DISTINGUISH
 *   Pre-July 4, 2025 (original §1202):
 *     5-year hold → 100% exclusion
 *     Cap: greater of $10M or 10× adjusted basis
 *     All-or-nothing — no partial under this regime
 *   Post-July 4, 2025 (OBBBA amendment):
 *     3-year hold → 50% exclusion
 *     4-year hold → 75% exclusion
 *     5-year hold → 100% exclusion
 *     Cap: greater of $15M or 10× adjusted basis
 *
 * Seven gates (all structural gates must pass; timing determines exclusion %):
 *   1. C-corporation at issuance (not LLC / S-corp / partnership)
 *   2. Original issuance (not secondary market)
 *   3. Gross assets under $50M at issuance
 *   4. Qualified active business (excludes: professional services, finance,
 *      hospitality, farming)
 *   5. Holding period (5 yrs full, 3/4 yrs partial post-2025 only)
 *   6. Acquisition date (pre vs post July 4, 2025)
 *   7. Exit value (affects cap application, not qualification)
 *
 * Legal anchors: IRC §1202 (as amended by OBBBA 2025), §1202(e) excluded businesses
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type QsbsStatus =
  | "FAIL_NOT_CCORP"
  | "FAIL_SECONDARY"
  | "FAIL_GROSS_ASSETS"
  | "FAIL_EXCLUDED_BUSINESS"
  | "FAIL_HOLDING_PRE2025"        // pre-2025 and not yet 5 years
  | "FAIL_HOLDING_POST2025"       // post-2025 and under 3 years
  | "PARTIAL_50"                  // post-2025, 3-4 years
  | "PARTIAL_75"                  // post-2025, 4-5 years
  | "QUALIFIED_PRE2025"           // all gates + 5+ years + pre-2025 ($10M cap)
  | "QUALIFIED_POST2025"          // all gates + 5+ years + post-2025 ($15M cap)
  | "AT_RISK_ENTITY"              // not_sure on entity
  | "AT_RISK_ASSETS"              // not_sure on gross assets
  | "AT_RISK_MULTIPLE";           // multiple uncertainties

interface QsbsResult {
  entityType: string;
  acquisition: string;
  grossAssets: string;
  businessType: string;
  acquisitionDate: string;
  holdingPeriod: string;
  exitValue: string;

  gainAssumed: number;              // from exit value band (treating as gain for simplicity)
  cap: number;                      // $10M or $15M depending on regime
  exclusionPct: number;             // 0, 0.50, 0.75, or 1.00
  excludedAmount: number;
  taxableGain: number;
  taxOnGain: number;                // 23.8% combined (20% + 3.8% NIIT)
  taxIfFullyExcluded: number;       // if qualified, what you'd pay on excluded amount
  savings: number;                  // tax saved by qualification
  status: QsbsStatus;
  firstFailingGate: string | null;
  regime: "pre_2025" | "post_2025";
}

interface VerdictResult {
  status: string;
  statusClass: string;
  panelClass: string;
  headline: string;
  stats: Array<{ label: string; value: string; highlight?: boolean }>;
  consequences: string[];
  gates?: Array<{ step: number; label: string; status: "pass" | "fail" | "unknown" }>;
  confidence: ConfidenceLevel;
  confidenceNote: string;
  tier: Tier;
  ctaLabel: string;
  altTierLabel: string;
  productKey67: string;
  productKey147: string;
  result: QsbsResult;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CAPITAL_GAINS_RATE = 0.20;
const NIIT_RATE = 0.038;
const COMBINED_TAX_RATE = CAPITAL_GAINS_RATE + NIIT_RATE;  // 23.8%

const CAP_PRE_2025 = 10_000_000;
const CAP_POST_2025 = 15_000_000;

const EXIT_VALUE_MAP: Record<string, number> = {
  under_1m:      500_000,
  "1m_to_5m":    2_500_000,
  "5m_to_15m":   10_000_000,
  over_15m:      25_000_000,
};

const PRODUCT_KEYS = {
  p67:  "us_67_qsbs_exit_auditor",
  p147: "us_147_qsbs_exit_auditor",
};

function formatUSD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function formatUSDShort(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "k";
  return "$" + Math.round(n).toLocaleString("en-US");
}

// ─────────────────────────────────────────────────────────────────────────────
// CALC ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcQsbs(answers: AnswerMap): QsbsResult {
  const entityType      = String(answers.entity_type      || "c_corp");
  const acquisition     = String(answers.acquisition      || "original");
  const grossAssets     = String(answers.gross_assets     || "under_50m");
  const businessType    = String(answers.business_type    || "tech");
  const acquisitionDate = String(answers.acquisition_date || "pre_2025");
  const holdingPeriod   = String(answers.holding_period   || "over_5");
  const exitValue       = String(answers.exit_value       || "5m_to_15m");

  const regime: "pre_2025" | "post_2025" = acquisitionDate === "post_2025" ? "post_2025" : "pre_2025";
  const cap = regime === "post_2025" ? CAP_POST_2025 : CAP_PRE_2025;
  const gainAssumed = EXIT_VALUE_MAP[exitValue] ?? 10_000_000;

  // Structural gate checks
  let status: QsbsStatus = "QUALIFIED_PRE2025";
  let firstFailingGate: string | null = null;

  if (entityType === "s_corp" || entityType === "llc") {
    status = "FAIL_NOT_CCORP";
    firstFailingGate = "Gate 1: Entity type (not C-corp)";
  } else if (entityType === "not_sure") {
    status = "AT_RISK_ENTITY";
    firstFailingGate = "Gate 1: Entity uncertain";
  } else if (acquisition === "secondary") {
    status = "FAIL_SECONDARY";
    firstFailingGate = "Gate 2: Secondary market purchase";
  } else if (grossAssets === "over_50m") {
    status = "FAIL_GROSS_ASSETS";
    firstFailingGate = "Gate 3: Gross assets over $50M at issuance";
  } else if (grossAssets === "not_sure") {
    status = "AT_RISK_ASSETS";
    firstFailingGate = "Gate 3: Gross assets uncertain";
  } else if (businessType === "professional_services") {
    status = "FAIL_EXCLUDED_BUSINESS";
    firstFailingGate = "Gate 4: Excluded business type";
  }
  // Holding period checks (only if structural gates passed)
  else {
    if (regime === "pre_2025") {
      if (holdingPeriod !== "over_5") {
        status = "FAIL_HOLDING_PRE2025";
        firstFailingGate = "Gate 5: Holding period under 5 years (pre-2025 is all-or-nothing)";
      } else {
        status = "QUALIFIED_PRE2025";
      }
    } else {
      // post_2025 regime
      if (holdingPeriod === "over_5") {
        status = "QUALIFIED_POST2025";
      } else if (holdingPeriod === "4_to_5") {
        status = "PARTIAL_75";
      } else if (holdingPeriod === "3_to_4") {
        status = "PARTIAL_50";
      } else {
        status = "FAIL_HOLDING_POST2025";
        firstFailingGate = "Gate 5: Holding period under 3 years (no exclusion yet)";
      }
    }
  }

  // Exclusion percentage
  let exclusionPct = 0;
  if (status === "QUALIFIED_PRE2025" || status === "QUALIFIED_POST2025") exclusionPct = 1.00;
  else if (status === "PARTIAL_75") exclusionPct = 0.75;
  else if (status === "PARTIAL_50") exclusionPct = 0.50;

  const applicableGain = Math.min(gainAssumed, cap);
  const excludedAmount = applicableGain * exclusionPct;
  const taxableGain = gainAssumed - excludedAmount;
  const taxOnGain = taxableGain * COMBINED_TAX_RATE;
  const taxIfFullyExcluded = excludedAmount * COMBINED_TAX_RATE;
  const savings = taxIfFullyExcluded;

  return {
    entityType,
    acquisition,
    grossAssets,
    businessType,
    acquisitionDate,
    holdingPeriod,
    exitValue,
    gainAssumed,
    cap,
    exclusionPct,
    excludedAmount,
    taxableGain,
    taxOnGain,
    taxIfFullyExcluded,
    savings,
    status,
    firstFailingGate,
    regime,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function buildGatesArray(result: QsbsResult): Array<{ step: number; label: string; status: "pass" | "fail" | "unknown" }> {
  return [
    {
      step: 1,
      label: "C-corporation at issuance",
      status: result.entityType === "c_corp" ? "pass"
            : result.entityType === "not_sure" ? "unknown"
            : "fail",
    },
    {
      step: 2,
      label: "Original issuance",
      status: result.acquisition === "secondary" ? "fail" : "pass",
    },
    {
      step: 3,
      label: "Gross assets under $50M",
      status: result.grossAssets === "over_50m" ? "fail"
            : result.grossAssets === "not_sure" ? "unknown"
            : "pass",
    },
    {
      step: 4,
      label: "Qualified active business",
      status: result.businessType === "professional_services" ? "fail" : "pass",
    },
    {
      step: 5,
      label: `Holding period (${result.regime === "post_2025" ? "3/4/5" : "5"} yr)`,
      status: (result.status === "FAIL_HOLDING_PRE2025" || result.status === "FAIL_HOLDING_POST2025") ? "fail"
            : (result.status === "PARTIAL_50" || result.status === "PARTIAL_75") ? "unknown"
            : "pass",
    },
  ];
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcQsbs(answers);
  const gates = buildGatesArray(result);

  // ── STRUCTURAL FAILS ──────────────────────────────────────────────────────
  if (result.status === "FAIL_NOT_CCORP") {
    return {
      status: "FAIL — NOT A C-CORPORATION AT ISSUANCE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `QSBS under IRC §1202 requires the issuer to be a domestic C-corporation at the time of stock issuance. ${result.entityType === "s_corp" ? "S-corporations" : "LLCs and partnerships"} do not qualify — regardless of business activity or holding period. At ${formatUSD(result.gainAssumed)} exit value, full federal capital gains tax applies: approximately ${formatUSD(result.gainAssumed * COMBINED_TAX_RATE)} at the 23.8% combined rate (20% capital gains + 3.8% NIIT).`,
      stats: [
        { label: "Entity type", value: result.entityType === "s_corp" ? "S-corp ✗" : "LLC / Partnership ✗", highlight: true },
        { label: "QSBS status", value: "DISQUALIFIED", highlight: true },
        { label: "Tax on $" + Math.round(result.gainAssumed / 1_000_000) + "M exit", value: formatUSD(result.gainAssumed * COMBINED_TAX_RATE), highlight: true },
      ],
      consequences: [
        "🔒 IRC §1202 requires the issuer to be a domestic C-corporation at the time the stock is issued to you. Subsequent conversion from LLC to C-corp does NOT cure pre-conversion equity — those units/shares remain non-qualifying.",
        `🔒 At ${formatUSD(result.gainAssumed)} gain, federal capital gains tax applies at ~23.8% combined (20% + 3.8% NIIT) = ${formatUSD(result.gainAssumed * COMBINED_TAX_RATE)}.`,
        "This is the most common QSBS failure mode. Many early-stage companies operate as LLCs before converting. Founders and early employees holding pre-conversion equity frequently do not realise it does not qualify.",
        "Post-conversion shares DO qualify if all other tests are met and held 5+ years from issuance date (not LLC formation date). Check your cap table for the specific share issuance date and entity type at that time.",
        "Partial remedy — §1045 rollover: if you sold QSBS held over 6 months, you may roll gain into new QSBS within 60 days and defer tax. Requires NEW qualifying QSBS to roll into — does not retroactively qualify non-QSBS equity.",
        "Planning going forward: ensure any new equity issuance post-C-corp conversion is documented as QSBS-qualifying from day one. Keep records of entity type, gross assets, and business activity at each issuance date.",
      ],
      gates,
      confidence: "HIGH",
      confidenceNote: "C-corporation requirement is statutory under IRC §1202(c)(1). No remedial path for non-C-corp equity.",
      tier: 147,
      ctaLabel: "Get My QSBS Failure Analysis + Alternatives — $147 →",
      altTierLabel: "Just want the diagnosis? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "FAIL_SECONDARY") {
    return {
      status: "FAIL — SECONDARY MARKET PURCHASE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `QSBS requires ORIGINAL ISSUANCE — stock received directly from the issuing corporation in exchange for money, property, or services. Shares purchased from another shareholder (secondary market, platforms like Forge / EquityZen, private transfers) do not qualify regardless of the company's QSBS status. At ${formatUSD(result.gainAssumed)} exit, full capital gains tax applies: ${formatUSD(result.gainAssumed * COMBINED_TAX_RATE)}.`,
      stats: [
        { label: "Acquisition", value: "Secondary market ✗", highlight: true },
        { label: "QSBS status", value: "DISQUALIFIED", highlight: true },
        { label: "Tax on $" + Math.round(result.gainAssumed / 1_000_000) + "M exit", value: formatUSD(result.gainAssumed * COMBINED_TAX_RATE), highlight: true },
      ],
      consequences: [
        "🔒 IRC §1202(c)(1)(B) requires the stock to be acquired by the taxpayer 'at its original issue' from the corporation. Purchases from other shareholders do not qualify even if the original holder's shares were QSBS.",
        "🔒 This is an absolute disqualification — no partial qualification, no rehabilitation, no alternative path to the exclusion for those shares.",
        `Tax on ${formatUSD(result.gainAssumed)} gain: approximately ${formatUSD(result.gainAssumed * COMBINED_TAX_RATE)} federal. Plus state tax depending on residency.`,
        "Common secondary scenarios that fail: buying from a departing founder, purchasing on Forge / EquityZen / CartaX, receiving shares in acquisition of another company (complex — some tacking rules apply), and buying in a secondary tender offer run by the company (may or may not qualify depending on structure).",
        "Exception — §1045 rollover: if you purchased QSBS (original issuance from another company) and sold QSBS held over 6 months, you may roll gain into the new QSBS. Does not cure your secondary purchase — applies only to PRIMARY QSBS you already owned.",
        "Alternative for this gain: long-term capital gains treatment (still 20% + 3.8% NIIT = 23.8%). Consider loss harvesting from other investments to offset. State tax planning may help if in a high-tax state.",
      ],
      gates,
      confidence: "HIGH",
      confidenceNote: "Original issuance requirement is statutory under IRC §1202(c)(1)(B). Secondary purchases do not qualify.",
      tier: 147,
      ctaLabel: "Get My QSBS Failure + Alternatives — $147 →",
      altTierLabel: "Just want the diagnosis? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "FAIL_GROSS_ASSETS") {
    return {
      status: "FAIL — GROSS ASSETS OVER $50M AT ISSUANCE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `QSBS requires the company's aggregate gross assets to have been $50 million or less at and immediately after the stock was issued. If gross assets exceeded this threshold, the stock does not qualify. At ${formatUSD(result.gainAssumed)} exit value, full capital gains tax applies: approximately ${formatUSD(result.gainAssumed * COMBINED_TAX_RATE)}.`,
      stats: [
        { label: "Gross assets test", value: "Over $50M ✗", highlight: true },
        { label: "QSBS status", value: "DISQUALIFIED", highlight: true },
        { label: "Tax on $" + Math.round(result.gainAssumed / 1_000_000) + "M exit", value: formatUSD(result.gainAssumed * COMBINED_TAX_RATE), highlight: true },
      ],
      consequences: [
        "🔒 IRC §1202(d)(1) — gross assets of the corporation must not exceed $50 million (a) at any time before the stock issuance, and (b) immediately after the issuance. Once the company crosses $50M, subsequent stock issuances are permanently disqualified.",
        "🔒 'Gross assets' means the sum of cash and adjusted bases of assets (property contributed counts at FMV). This is a specific test — not 'valuation' or 'enterprise value' — it's a balance sheet measurement.",
        `Tax on ${formatUSD(result.gainAssumed)} gain: approximately ${formatUSD(result.gainAssumed * COMBINED_TAX_RATE)} at 23.8% federal combined.`,
        "Shares issued BEFORE the company crossed $50M may still qualify — this test is applied per-issuance, not company-wide. Verify the issuance date against the gross assets timeline.",
        "Tip for early employees: if you have ISO grants from early (pre-$50M) and later (post-$50M), the early ones may qualify while later ones do not. Separate your cap table analysis by issuance date.",
        "Alternative planning: for the non-qualifying portion, consider §1045 rollover if you have other QSBS. Also: state tax planning, installment sales to spread gain, charitable giving strategies for a portion.",
      ],
      gates,
      confidence: "HIGH",
      confidenceNote: "Gross assets threshold is statutory under IRC §1202(d)(1). Once exceeded, subsequent issuances permanently fail this test.",
      tier: 147,
      ctaLabel: "Get My QSBS Failure + Alternatives — $147 →",
      altTierLabel: "Just want the diagnosis? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "FAIL_EXCLUDED_BUSINESS") {
    return {
      status: "FAIL — EXCLUDED BUSINESS TYPE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `QSBS requires the company to be engaged in a qualified trade or business. Professional services (law, medicine, consulting), financial services, hospitality, and farming are specifically excluded under IRC §1202(e)(3). Your business type does not qualify. At ${formatUSD(result.gainAssumed)} exit, full capital gains tax applies: ${formatUSD(result.gainAssumed * COMBINED_TAX_RATE)}.`,
      stats: [
        { label: "Business type", value: "Excluded ✗", highlight: true },
        { label: "QSBS status", value: "DISQUALIFIED", highlight: true },
        { label: "Tax on $" + Math.round(result.gainAssumed / 1_000_000) + "M exit", value: formatUSD(result.gainAssumed * COMBINED_TAX_RATE), highlight: true },
      ],
      consequences: [
        "🔒 IRC §1202(e)(3) excludes: professional services (law, health, engineering, architecture, accounting, actuarial science, performing arts, consulting, athletics, financial services, brokerage services), financial services broadly, any business where the principal asset is the reputation or skill of employees, hotels, restaurants, farming, extraction of minerals/oil/gas, and banking/insurance/investing.",
        "🔒 The test is the NATURE of the business, not how the company describes itself. A 'technology consulting' business that primarily provides consulting services may fail even if it uses technology. The IRS looks at revenue sources and activities.",
        `Tax on ${formatUSD(result.gainAssumed)} gain: approximately ${formatUSD(result.gainAssumed * COMBINED_TAX_RATE)} federal at 23.8% combined rate.`,
        "Qualifying businesses include: technology / software product companies, manufacturing, retail, wholesale, life sciences and biotech, medical devices (not medical practices), consumer products. The line is often subtle — a biotech company qualifies, a medical practice does not.",
        "Common misclassifications: fintech that is primarily brokerage (fails), SaaS that is primarily consulting (fails), healthcare software that is primarily medical practice (fails). Confirm your company's primary activity documented for IRS purposes.",
        "Planning: if your company is at the borderline (tech-enabled services, for example), careful documentation of product revenue vs service revenue is essential. Document early — retroactive characterisation is hard.",
      ],
      gates,
      confidence: "HIGH",
      confidenceNote: "Excluded businesses are statutorily defined under IRC §1202(e)(3). Nature of business determined by activity, not label.",
      tier: 147,
      ctaLabel: "Get My QSBS Failure + Alternatives — $147 →",
      altTierLabel: "Just want the diagnosis? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── HOLDING PERIOD FAILS ──────────────────────────────────────────────────
  if (result.status === "FAIL_HOLDING_PRE2025") {
    return {
      status: "TOO EARLY — PRE-2025 STOCK REQUIRES 5 YEARS (NO PARTIAL)",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `For stock acquired BEFORE July 4, 2025, the §1202 exclusion is all-or-nothing at 5 years. You are not yet at the 5-year mark — there is no partial exclusion available under the pre-amendment rules. Wait until 5 years have elapsed, or the entire gain is taxable. At ${formatUSD(result.gainAssumed)}, that is approximately ${formatUSD(result.gainAssumed * COMBINED_TAX_RATE)} in federal tax.`,
      stats: [
        { label: "Acquisition date", value: "Pre-July 4, 2025", highlight: true },
        { label: "Current holding", value: "Under 5 years", highlight: true },
        { label: "Action", value: "Wait for 5-year mark", highlight: true },
      ],
      consequences: [
        "🔒 Under the original §1202 rules (applicable to stock acquired before July 4, 2025), the exclusion is all-or-nothing at 5 years. 4 years 364 days = 0% exclusion. 5 years = 100% exclusion (subject to $10M cap or 10× basis). No partial available.",
        `The savings of waiting to 5 years: approximately ${formatUSD(Math.min(result.gainAssumed, CAP_PRE_2025) * COMBINED_TAX_RATE)} in federal tax if gain is up to $10M cap. On a ${formatUSD(result.gainAssumed)} gain that means holding to the 5-year anniversary is worth every month you can wait.`,
        "Strategy if you must sell earlier: §1045 rollover is available if you held QSBS for 6 months. You can defer gain by rolling into NEW QSBS within 60 days of sale. This preserves QSBS treatment for the new stock but restarts the 5-year clock.",
        "Strategy if early liquidity is essential: consider a secondary sale of only a portion of shares. Hold the rest to 5 years. Model the blended tax outcome.",
        "Timing precision: the 5-year clock runs from the original issuance date, not from vest date (for restricted stock) or from grant date (for options). For exercised options, the clock runs from exercise date. Check your cap table documentation.",
        "Planning windows: the post-July 4, 2025 rules allow 50% at 3 years and 75% at 4 years — but ONLY for stock acquired after that date. Your pre-2025 stock does not qualify for the new partial rules.",
      ],
      gates,
      confidence: "HIGH",
      confidenceNote: "Pre-2025 §1202 is all-or-nothing at 5 years. Post-2025 partial rules do not apply retroactively to pre-2025 stock.",
      tier: 147,
      ctaLabel: "Get My Hold-vs-Sell Decision — $147 →",
      altTierLabel: "Just want the analysis? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "FAIL_HOLDING_POST2025") {
    return {
      status: "TOO EARLY — POST-2025 STOCK REQUIRES 3 YEARS MINIMUM",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `For stock acquired on or after July 4, 2025 (under OBBBA), partial exclusion starts at 3 years (50%). You are under 3 years — no exclusion available yet. Full federal capital gains tax applies on sale: approximately ${formatUSD(result.gainAssumed * COMBINED_TAX_RATE)} on ${formatUSD(result.gainAssumed)} gain.`,
      stats: [
        { label: "Acquisition date", value: "Post-July 4, 2025", highlight: true },
        { label: "Current holding", value: "Under 3 years", highlight: true },
        { label: "Wait to", value: "3 yr = 50% / 4 yr = 75% / 5 yr = 100%", highlight: true },
      ],
      consequences: [
        "🔒 Under post-OBBBA §1202, minimum holding for any exclusion is 3 years (50% partial). Under that, no exclusion available.",
        "🔓 Waiting progression: 3 years = 50% exclusion, 4 years = 75%, 5 years = 100% (capped at $15M or 10× basis). Each additional year is meaningfully more valuable.",
        `At your gain of ${formatUSD(result.gainAssumed)}: waiting from sub-3 to 3 years saves ~${formatUSD(Math.min(result.gainAssumed, CAP_POST_2025) * 0.50 * COMBINED_TAX_RATE)}. Waiting to 4 years: additional ~${formatUSD(Math.min(result.gainAssumed, CAP_POST_2025) * 0.25 * COMBINED_TAX_RATE)}. Waiting to 5 years: additional ~${formatUSD(Math.min(result.gainAssumed, CAP_POST_2025) * 0.25 * COMBINED_TAX_RATE)}.`,
        "If liquidity is essential: §1045 rollover available after 6 months — defers tax by rolling into new QSBS within 60 days.",
        "The 3-year, 4-year, 5-year structure is NEW — it only applies to stock acquired post-July 4, 2025. Pre-2025 stock remains all-or-nothing at 5 years.",
        "Planning: model the cost of early exit vs 12-month wait for each increment (3→4, 4→5). For many exits the savings from one additional year far exceed the opportunity cost.",
      ],
      gates,
      confidence: "HIGH",
      confidenceNote: "OBBBA partial exclusion thresholds (3/4/5 years) apply only to stock acquired on or after July 4, 2025.",
      tier: 147,
      ctaLabel: "Get My Timing Optimisation Plan — $147 →",
      altTierLabel: "Just want the analysis? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── PARTIAL EXCLUSIONS (POST-2025) ────────────────────────────────────────
  if (result.status === "PARTIAL_50" || result.status === "PARTIAL_75") {
    const pctLabel = result.status === "PARTIAL_50" ? "50%" : "75%";
    const nextThreshold = result.status === "PARTIAL_50" ? "4 years (75%)" : "5 years (100%)";
    const additionalSaving = result.status === "PARTIAL_50"
      ? Math.min(result.gainAssumed, CAP_POST_2025) * 0.25 * COMBINED_TAX_RATE  // 50% to 75% = additional 25% excluded
      : Math.min(result.gainAssumed, CAP_POST_2025) * 0.25 * COMBINED_TAX_RATE; // 75% to 100% = additional 25%

    return {
      status: `PARTIAL EXCLUSION — ${pctLabel} UNDER POST-2025 RULES`,
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your stock (acquired post-July 4, 2025) qualifies for ${pctLabel} exclusion under the OBBBA partial rules. Of your ${formatUSD(result.gainAssumed)} gain, ${formatUSD(result.excludedAmount)} is excluded. Tax on remaining ${formatUSD(result.taxableGain)}: approximately ${formatUSD(result.taxOnGain)}. Waiting to ${nextThreshold} would save an additional ${formatUSD(additionalSaving)}.`,
      stats: [
        { label: "Current exclusion", value: pctLabel, highlight: true },
        { label: "Tax if sold now", value: formatUSD(result.taxOnGain), highlight: true },
        { label: `Savings if held to ${nextThreshold}`, value: formatUSD(additionalSaving), highlight: true },
      ],
      consequences: [
        `✓ You qualify for ${pctLabel} exclusion under post-OBBBA §1202 rules (stock acquired after July 4, 2025, held at least ${result.status === "PARTIAL_50" ? "3" : "4"} years).`,
        `${formatUSD(result.excludedAmount)} of your ${formatUSD(result.gainAssumed)} gain is excluded from federal capital gains tax. Remaining ${formatUSD(result.taxableGain)} taxed at 23.8% combined rate = ${formatUSD(result.taxOnGain)}.`,
        `🔓 Timing optimisation: waiting to ${nextThreshold} saves approximately ${formatUSD(additionalSaving)}. ${result.status === "PARTIAL_50" ? "At 4 years: 75% excluded. At 5 years: 100% excluded." : "At 5 years: 100% excluded."}`,
        "Decision framework: weigh the tax savings of waiting against liquidity preference, opportunity cost, and market / company risk. For many exits the tax savings dominate.",
        `Cap reminder: under post-2025 rules, the exclusion is capped at the greater of $15M or 10× adjusted basis. Gains above the cap are fully taxable regardless of holding period. Your gain of ${formatUSD(result.gainAssumed)} is ${result.gainAssumed > CAP_POST_2025 ? "ABOVE" : "within"} the $15M cap.`,
        "Structural gates confirmed ✓: C-corp at issuance, original issuance, gross assets under $50M, qualified business. Only timing is affecting your current exclusion percentage.",
      ],
      gates,
      confidence: "HIGH",
      confidenceNote: "Post-OBBBA partial exclusion structure (50% at 3yrs, 75% at 4yrs, 100% at 5yrs) is statutory. Exact numbers depend on your basis.",
      tier: 147,
      ctaLabel: "Get My Timing Optimisation Plan — $147 →",
      altTierLabel: "Just want the audit? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── AT RISK CASES ─────────────────────────────────────────────────────────
  if (result.status === "AT_RISK_ENTITY" || result.status === "AT_RISK_ASSETS") {
    const uncertain = result.status === "AT_RISK_ENTITY" ? "entity type at issuance" : "gross assets at issuance";
    return {
      status: "AT RISK — CRITICAL FACT UNCERTAIN",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `You are uncertain about a critical QSBS qualification fact — ${uncertain}. This must be resolved before exit. If the fact fails on investigation, QSBS is fully disqualified — ${formatUSD(result.gainAssumed * COMBINED_TAX_RATE)} of federal tax on your ${formatUSD(result.gainAssumed)} gain. If it passes, you may qualify for 100% exclusion.`,
      stats: [
        { label: "Uncertainty", value: uncertain, highlight: true },
        { label: "Tax if fails", value: formatUSD(result.gainAssumed * COMBINED_TAX_RATE), highlight: true },
        { label: "Tax if qualifies", value: "$0 (up to cap)", highlight: true },
      ],
      consequences: [
        `⚠ Your QSBS qualification hangs on ${uncertain}. This is verifiable from company records but must be verified — not assumed.`,
        result.status === "AT_RISK_ENTITY" ? `Verify from the company's formation documents, Form 2553 (if S-elected), and cap table: (1) what was the entity form at your specific issuance date? (2) if it was an LLC or S-corp at some point, when did it convert to C-corp? (3) were your shares issued before or after the C-corp conversion?` : `Verify from company financial records: (1) was the balance-sheet gross assets value under $50M at your issuance date? (2) what was the adjusted basis of contributed property at that time? (3) gross assets means cash + adjusted basis of assets — not enterprise value or market capitalisation.`,
        "Documents to pull: cap table entries for your specific shares, company formation / incorporation documents, any amendments (C-corp conversion if applicable), annual balance sheets around issuance date, and §1202 compliance letter if the company issued one.",
        `Tax exposure range: if QSBS VALID (100% exclusion), federal tax = $0 on up to ${formatUSD(result.cap)} of gain. If QSBS INVALID, tax on full ${formatUSD(result.gainAssumed)} = ${formatUSD(result.gainAssumed * COMBINED_TAX_RATE)}. Spread between outcomes: ${formatUSD(Math.min(result.gainAssumed, result.cap) * COMBINED_TAX_RATE)}.`,
        "Action: engage a tax attorney with QSBS expertise. Many early-stage companies have §1202 attestation letters; request yours. If the company disputes QSBS eligibility, you need to know before exit — not during audit.",
      ],
      gates,
      confidence: "LOW",
      confidenceNote: "Cannot confirm qualification without verifying the uncertain fact. Tax outcome depends entirely on this resolution.",
      tier: 147,
      ctaLabel: "Get My QSBS Verification Plan — $147 →",
      altTierLabel: "Just want the overview? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── QUALIFIED — PRE-2025 ──────────────────────────────────────────────────
  if (result.status === "QUALIFIED_PRE2025") {
    return {
      status: "QUALIFIED — PRE-2025 STOCK, 100% EXCLUSION UP TO $10M CAP",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your stock appears to qualify for the full QSBS exclusion under the original §1202 rules (pre-July 4, 2025). Up to ${formatUSD(result.cap)} of gain is excluded from federal capital gains tax. On your ${formatUSD(result.gainAssumed)} gain: ${formatUSD(result.excludedAmount)} excluded, ${formatUSD(result.taxableGain)} taxable (if over cap), total tax: ${formatUSD(result.taxOnGain)}. Savings vs no QSBS: ${formatUSD(result.savings)}.`,
      stats: [
        { label: "QSBS status", value: "QUALIFIED ✓", highlight: false },
        { label: "Exclusion", value: "100% up to $10M", highlight: true },
        { label: "Federal tax savings", value: formatUSD(result.savings), highlight: true },
      ],
      consequences: [
        `✓ All five gates pass: C-corp at issuance, original issuance, gross assets under $50M at issuance, qualified business, 5+ years held.`,
        `✓ Pre-2025 §1202 rules apply: 100% exclusion up to the greater of $10M or 10× adjusted basis. Your gain is ${result.gainAssumed > CAP_PRE_2025 ? `above the $10M cap — ${formatUSD(result.gainAssumed - CAP_PRE_2025)} of gain remains taxable` : `within the $10M cap — full exclusion applies`}.`,
        `Federal tax on ${formatUSD(result.gainAssumed)} gain: ${formatUSD(result.taxOnGain)} (${result.gainAssumed > CAP_PRE_2025 ? "gain above $10M cap × 23.8%" : "$0 — fully excluded"}).`,
        `Savings vs 0% QSBS: ${formatUSD(result.savings)} of federal tax avoided. This is why §1202 is one of the most valuable provisions in the US tax code.`,
        "Documentation to preserve: §1202 statement from the issuer, cap table showing issuance date + entity type, gross assets confirmation, business activity evidence. IRS can request any of this on examination.",
        "State tax treatment: most states conform to federal §1202, but some do not (e.g. California does not exclude federal QSBS gain from state tax). Plan separately for state tax.",
        "10× basis alternative: if your adjusted basis was over $1M, the cap is 10× basis (not $10M). High-basis holders get meaningfully larger caps.",
        `${result.gainAssumed > CAP_PRE_2025 ? "For gain above $10M cap: consider §1045 rollover into new QSBS (defers rather than excludes), charitable remainder trusts, or charitable giving strategies for the portion exceeding the cap." : ""}`,
      ],
      gates,
      confidence: "HIGH",
      confidenceNote: "Pre-2025 §1202 with 5+ year hold and all gates passing provides 100% exclusion up to the $10M cap. Document carefully.",
      tier: 67,
      ctaLabel: "Get My QSBS Confirmation Pack — $67 →",
      altTierLabel: "Want the full exit strategy? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── QUALIFIED — POST-2025 (default fall-through) ──────────────────────────
  return {
    status: "QUALIFIED — POST-2025 STOCK, 100% EXCLUSION UP TO $15M CAP",
    statusClass: "text-emerald-700",
    panelClass: "border-emerald-200 bg-emerald-50",
    headline: `Your stock appears to qualify for the full QSBS exclusion under the post-OBBBA §1202 rules (acquired on or after July 4, 2025, held 5+ years). Up to ${formatUSD(result.cap)} of gain is excluded — $5M more than the pre-2025 cap. On your ${formatUSD(result.gainAssumed)} gain: federal tax ${formatUSD(result.taxOnGain)}. Savings vs no QSBS: ${formatUSD(result.savings)}.`,
    stats: [
      { label: "QSBS status", value: "QUALIFIED ✓", highlight: false },
      { label: "Exclusion", value: "100% up to $15M", highlight: true },
      { label: "Federal tax savings", value: formatUSD(result.savings), highlight: true },
    ],
    consequences: [
      `✓ All five gates pass: C-corp at issuance, original issuance, gross assets under $50M at issuance, qualified business, 5+ years held.`,
      `✓ Post-OBBBA §1202 rules apply: 100% exclusion up to the greater of $15M or 10× adjusted basis. Your gain is ${result.gainAssumed > CAP_POST_2025 ? `above the $15M cap — ${formatUSD(result.gainAssumed - CAP_POST_2025)} of gain remains taxable` : `within the $15M cap — full exclusion applies`}.`,
      `Federal tax on ${formatUSD(result.gainAssumed)} gain: ${formatUSD(result.taxOnGain)} (${result.gainAssumed > CAP_POST_2025 ? "gain above $15M cap × 23.8%" : "$0 — fully excluded"}).`,
      `Savings vs 0% QSBS: ${formatUSD(result.savings)} of federal tax avoided.`,
      "The post-2025 cap increase ($10M → $15M) is one of the most valuable provisions of OBBBA for startup exits. If your company issued shares to you post-July 4, 2025, you benefit from the higher cap vs pre-amendment holders.",
      "Documentation: same as pre-2025 (cap table, gross assets confirmation, business activity evidence, issuer QSBS statement). Maintain thoroughly.",
      "State conformity: some states haven't updated to match the $15M cap. State tax may apply on a portion that federal excludes. Check state position separately.",
      `${result.gainAssumed > CAP_POST_2025 ? "For gain above $15M cap: §1045 rollover or charitable strategies. Multiple-shareholder planning may stack caps across family members." : ""}`,
    ],
    gates,
    confidence: "HIGH",
    confidenceNote: "Post-OBBBA §1202 with 5+ year hold provides 100% exclusion up to $15M cap. This is the most generous QSBS regime.",
    tier: 67,
    ctaLabel: "Get My QSBS Confirmation Pack — $67 →",
    altTierLabel: "Want the full exit strategy? — $147",
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
    id: "entity_type", step: 1, type: "button_group",
    label: "What was the entity type at the time the stock was issued to you?",
    subLabel: "QSBS requires C-corporation at issuance — LLC or S-corp equity does NOT qualify even if later converted.",
    options: [
      { label: "C-Corporation",                           value: "c_corp",    subLabel: "Qualifies for QSBS" },
      { label: "S-Corporation",                            value: "s_corp",    subLabel: "Does NOT qualify for QSBS" },
      { label: "LLC / Partnership",                        value: "llc",       subLabel: "Does NOT qualify for QSBS" },
      { label: "Not sure",                                 value: "not_sure",  subLabel: "Must verify — at risk" },
    ],
    required: true,
  },
  {
    id: "acquisition", step: 2, type: "button_group",
    label: "How did you acquire the stock?",
    subLabel: "QSBS requires original issuance directly from the company — secondary purchases fail.",
    options: [
      { label: "Original issuance directly from company",  value: "original",       subLabel: "Qualifies" },
      { label: "Purchased from another shareholder",        value: "secondary",      subLabel: "Does NOT qualify — secondary fails" },
      { label: "Exercised options (ISO or NSO)",            value: "options",        subLabel: "Qualifies — counts as original issuance" },
      { label: "Received as compensation",                  value: "compensation",   subLabel: "Qualifies — counts as original issuance" },
    ],
    required: true,
  },
  {
    id: "gross_assets", step: 3, type: "button_group",
    label: "Company gross assets at time of issuance?",
    subLabel: "QSBS requires gross assets to have been under $50M at issuance and immediately after.",
    options: [
      { label: "Under $50M",    value: "under_50m", subLabel: "Passes gross assets test" },
      { label: "Over $50M",     value: "over_50m",  subLabel: "Fails — disqualified" },
      { label: "Not sure",       value: "not_sure",  subLabel: "Must verify from company records" },
    ],
    required: true,
  },
  {
    id: "business_type", step: 4, type: "button_group",
    label: "What is the company's primary business?",
    subLabel: "Professional services, finance, hospitality, farming are excluded under §1202(e)(3).",
    options: [
      { label: "Technology / software / hardware",          value: "tech",                   subLabel: "Qualifying business" },
      { label: "Life sciences / biotech / medical devices",  value: "biotech",                subLabel: "Qualifying business" },
      { label: "Manufacturing / retail / wholesale",         value: "manufacturing",         subLabel: "Qualifying business" },
      { label: "Professional services (law, finance, consulting, medical practice)", value: "professional_services", subLabel: "Does NOT qualify — excluded" },
      { label: "Other",                                      value: "other",                  subLabel: "Verify specific activity" },
    ],
    required: true,
  },
  {
    id: "acquisition_date", step: 5, type: "button_group",
    label: "When was the stock acquired?",
    subLabel: "Two regimes — pre-July 4, 2025 ($10M cap, 5-year all-or-nothing) vs post-July 4, 2025 ($15M cap, partial at 3/4 years).",
    options: [
      { label: "Before July 4, 2025",        value: "pre_2025",   subLabel: "Original §1202 rules — $10M cap, 5yr binary" },
      { label: "On or after July 4, 2025",    value: "post_2025",  subLabel: "OBBBA rules — $15M cap, 3/4/5 year partial" },
    ],
    required: true,
  },
  {
    id: "holding_period", step: 6, type: "button_group",
    label: "How long have you held the stock?",
    subLabel: "Holding period is measured from original issuance date (or exercise date for options).",
    options: [
      { label: "Under 3 years",    value: "under_3",  subLabel: "No exclusion yet under any regime" },
      { label: "3 to 4 years",      value: "3_to_4",   subLabel: "50% exclusion if post-2025; fails pre-2025" },
      { label: "4 to 5 years",      value: "4_to_5",   subLabel: "75% exclusion if post-2025; fails pre-2025" },
      { label: "Over 5 years",      value: "over_5",   subLabel: "100% exclusion if all gates pass" },
    ],
    required: true,
  },
  {
    id: "exit_value", step: 7, type: "button_group",
    label: "Approximate exit value / gain?",
    subLabel: "Gain above the cap ($10M pre-2025 / $15M post-2025 or 10× basis) is fully taxable regardless of exclusion.",
    options: [
      { label: "Under $1M",     value: "under_1m",   subLabel: "Modest — exclusion still valuable" },
      { label: "$1M – $5M",      value: "1m_to_5m",  subLabel: "Within typical cap" },
      { label: "$5M – $15M",      value: "5m_to_15m", subLabel: "May approach or cross cap" },
      { label: "Over $15M",       value: "over_15m",  subLabel: "Above post-2025 cap — excess taxable" },
    ],
    required: true,
  },
];

const TOTAL_STEPS = 7;

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

      {/* Legal regime banner */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Two QSBS regimes — Section 1202</p>
        <div className="space-y-1 text-neutral-800">
          <p><strong>Pre-July 4, 2025 stock:</strong> 5-year hold for 100% exclusion. No partial. Cap: greater of $10M or 10× basis.</p>
          <p><strong>Post-July 4, 2025 stock (OBBBA):</strong> 3yr=50%, 4yr=75%, 5yr=100%. Cap: greater of $15M or 10× basis.</p>
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

      {/* Gate diagram */}
      {verdict.gates && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your QSBS gates</p>
          <div className="space-y-1.5 text-xs">
            {verdict.gates.map(g => (
              <div key={g.step} className="flex justify-between">
                <span className="text-neutral-600">Gate {g.step}: {g.label}</span>
                <span className={`font-mono font-bold ${
                  g.status === "pass" ? "text-emerald-700"
                  : g.status === "fail" ? "text-red-700"
                  : "text-amber-700"
                }`}>
                  {g.status === "pass" ? "✓ PASS" : g.status === "fail" ? "✗ FAIL" : "? UNKNOWN"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tax math breakdown */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your QSBS exit math</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Assumed gain / exit value</span>
            <span className="font-mono font-bold text-neutral-950">{formatUSD(verdict.result.gainAssumed)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Regime</span>
            <span className="font-mono text-neutral-950">{verdict.result.regime === "post_2025" ? "Post-July 4, 2025 (OBBBA)" : "Pre-July 4, 2025 (original)"}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Applicable cap</span>
            <span className="font-mono text-neutral-950">{formatUSD(verdict.result.cap)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Exclusion percentage</span>
            <span className={`font-mono font-bold ${
              verdict.result.exclusionPct === 1 ? "text-emerald-700"
              : verdict.result.exclusionPct === 0 ? "text-red-700"
              : "text-amber-700"
            }`}>{(verdict.result.exclusionPct * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Excluded amount</span>
            <span className="font-mono text-emerald-700">{formatUSD(verdict.result.excludedAmount)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Taxable gain</span>
            <span className="font-mono text-red-700">{formatUSD(verdict.result.taxableGain)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Federal tax at 23.8% (20% + 3.8% NIIT)</span>
            <span className="font-mono font-bold text-red-700">{formatUSD(verdict.result.taxOnGain)}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="font-semibold text-neutral-800">Federal tax savings vs no QSBS</span>
            <span className="font-mono font-bold text-emerald-700">{formatUSD(verdict.result.savings)}</span>
          </div>
        </div>
      </div>

      {/* Fear framing for failures */}
      {(verdict.result.status.startsWith("FAIL_") || verdict.result.status.startsWith("AT_RISK_")) && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ QSBS is all-or-nothing on structural gates</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-1">
            {formatUSD(verdict.result.gainAssumed * COMBINED_TAX_RATE)} federal tax on a {formatUSD(verdict.result.gainAssumed)} exit if QSBS fails.
          </p>
          <p className="text-xs text-red-800 leading-relaxed">
            One failing gate — not a C-corp at issuance, secondary market purchase, gross assets over $50M, excluded business — and the entire exclusion is lost. No partial qualification for structural failures. The only partial exclusions are timing-based under the post-2025 rules.
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
          <strong className="text-neutral-950">QSBS is structural-first, timing-second.</strong> Structural gates (C-corp, original issuance, gross assets, business type) are binary — any failure kills the exclusion. Timing determines the exclusion percentage under post-2025 rules. Verify every gate before exit.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Gate-by-gate QSBS qualification analysis for your specific stock</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Pre-2025 vs post-2025 regime treatment + cap analysis</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Timing optimisation for partial exclusion (if post-2025)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>§1045 rollover analysis if partial or failing</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 tax attorney questions specific to your exit scenario</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your gate-by-gate position and timing</p>
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

export default function QsbsExitAuditorCalculator() {
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
        product_slug: "qsbs-exit-auditor",
        source_path: "/us/check/qsbs-exit-auditor",
        country_code: "US", currency_code: "USD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          qualification_status: verdict.result.status,
          regime: verdict.result.regime,
          exclusion_pct: verdict.result.exclusionPct,
          tax_on_gain: verdict.result.taxOnGain,
          savings: verdict.result.savings,
          first_failing_gate: verdict.result.firstFailingGate,
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
      body: JSON.stringify({ email, source: "qsbs_exit_auditor", country_code: "US", site: "taxchecknow" }),
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
    const sid = sessionId || `qsbs_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("qsbs-exit-auditor_entity_type", String(answers.entity_type || ""));
    sessionStorage.setItem("qsbs-exit-auditor_acquisition", String(answers.acquisition || ""));
    sessionStorage.setItem("qsbs-exit-auditor_gross_assets", String(answers.gross_assets || ""));
    sessionStorage.setItem("qsbs-exit-auditor_business_type", String(answers.business_type || ""));
    sessionStorage.setItem("qsbs-exit-auditor_acquisition_date", String(answers.acquisition_date || ""));
    sessionStorage.setItem("qsbs-exit-auditor_holding_period", String(answers.holding_period || ""));
    sessionStorage.setItem("qsbs-exit-auditor_exit_value", String(answers.exit_value || ""));
    sessionStorage.setItem("qsbs-exit-auditor_qualification_status", verdict.result.status);
    sessionStorage.setItem("qsbs-exit-auditor_exclusion_pct", String(verdict.result.exclusionPct));
    sessionStorage.setItem("qsbs-exit-auditor_tax_on_gain", String(Math.round(verdict.result.taxOnGain)));
    sessionStorage.setItem("qsbs-exit-auditor_savings", String(Math.round(verdict.result.savings)));
    sessionStorage.setItem("qsbs-exit-auditor_status", verdict.status);
    sessionStorage.setItem("qsbs-exit-auditor_tier", String(popupTier));

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
          success_url: `${window.location.origin}/us/check/qsbs-exit-auditor/success/${successPath}`,
          cancel_url: `${window.location.origin}/us/check/qsbs-exit-auditor`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your QSBS qualification analysis for your tax attorney.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your gate-by-gate position by email — free.</p>
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
                    {popupTier === 67 ? "Your QSBS Audit Pack" : "Your QSBS Exit Strategy Pack"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">IRS-referenced · IRC §1202 · OBBBA 2025 · April 2026</p>
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
                      {popupTier === 67 ? "QSBS Audit Pack™" : "QSBS Exit Strategy Pack™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Gate-by-gate qualification analysis, regime comparison (pre vs post-July 2025), exit value tax calculation, and 5 tax attorney questions — built around your specific stock."
                        : "Full strategy: gate-by-gate audit, timing optimisation for partial exclusion, §1045 rollover analysis, basis planning, exit sequencing, multi-shareholder cap stacking, and tax attorney coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic QSBS content. Your specific gate-by-gate position and tax math.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My QSBS Audit →" : "Get My Exit Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the audit? — $67 instead" : "Want the full exit strategy? — $147 instead"}
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
                    { label: "Your role", key: "entity_type", options: [["founder","Founder / co-founder"],["early_employee","Early employee"],["investor","Early investor"],["late_stage_employee","Later-stage employee"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["pending_exit","Exit pending / imminent"],["planning","Planning next 12-24 months"],["just_checking","Just checking my position"]] },
                    { label: "Do you have a tax attorney or CPA?", key: "accountant", options: [["tax_attorney","Yes — tax attorney"],["cpa","Yes — CPA"],["both","Both"],["none","No — need one"]] },
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
      {showVerdict && verdict && verdict.result.status !== "QUALIFIED_PRE2025" && verdict.result.status !== "QUALIFIED_POST2025" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Tax exposure on ${Math.round(verdict.result.gainAssumed / 1_000_000)}M exit</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatUSD(verdict.result.taxOnGain)} if QSBS fails — {formatUSD(verdict.result.savings)} at stake
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
