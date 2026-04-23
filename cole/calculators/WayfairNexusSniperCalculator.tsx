"use client";

/**
 * US-05 — Sales Tax Nexus Liability Engine (formerly Wayfair Nexus Sniper)
 * Pattern: StatusCheck (Module A) + ThresholdTest (Module G)
 *
 * Core question: How many states has the seller likely triggered economic nexus
 * in, and what is the retroactive exposure from the date of crossing — not the
 * date of registration.
 *
 * Legal anchor: South Dakota v. Wayfair, Inc., 585 U.S. 162 (2018). 45 states +
 * DC have enacted economic nexus rules. Most common threshold: $100,000 in sales
 * or 200 transactions per state. Liability is retroactive from threshold date.
 *
 * Five steps:
 *   1. Customer geography (1 state / multi known / multi untracked / intl+US)
 *   2. Annual US online revenue (under $100k / $100k-500k / $500k-2M / over $2M)
 *   3. Marketplace channel mix (primarily marketplace / mix / direct only)
 *   4. Current sales tax registration (multi-state / home only / nowhere / unsure)
 *   5. Duration at current revenue (under 1yr / 1-3yr / over 3yr)
 *
 * Marketplace confusion trap: Amazon / Etsy / eBay / Shopify collect on
 * marketplace sales in most states, BUT marketplace sales STILL COUNT toward
 * nexus thresholds, and direct website sales create separate obligations.
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type NexusStatus =
  | "CLEAR_LOW_REVENUE"         // under threshold everywhere
  | "CLEAR_SINGLE_STATE"        // one state, home-registered
  | "AT_RISK_NEW_MULTISTATE"    // under 1yr, multi-state, mid-revenue
  | "AT_RISK_GROWING"           // 1-3yr, multi-state, mid-revenue, not fully registered
  | "NON_COMPLIANT_MODERATE"    // 1-3yr, mid-high revenue, unregistered
  | "NON_COMPLIANT_SEVERE"      // 3+yr, high revenue, unregistered
  | "UNTRACKED_EXPOSURE"        // customer geography unknown — can't assess
  | "REGISTERED_COMPLIANT";     // multi-state registered, low risk

interface NexusResult {
  geography:       string;   // one_state | multi_known | multi_untracked | intl_us
  annualRevenue:   string;   // under_100k | 100k_500k | 500k_2m | over_2m
  marketplace:     string;   // primarily | mix | direct
  registered:      string;   // multi | home | nowhere | unsure
  duration:        string;   // under_1 | one_to_3 | over_3

  revenueMidpoint:        number;
  estimatedStatesTriggered: number;
  yearsUnregistered:      number;

  backTaxLow:   number;      // lower bound retroactive tax exposure
  backTaxHigh:  number;      // upper bound retroactive tax exposure
  penaltiesLow: number;
  penaltiesHigh: number;
  interestLow:  number;
  interestHigh: number;
  totalExposureLow:  number;
  totalExposureHigh: number;

  vdaExposureLow:   number;  // exposure if VDA filed now
  vdaExposureHigh:  number;
  vdaSavingsLow:    number;
  vdaSavingsHigh:   number;

  marketplaceShare: number;   // 0..1
  directShare:      number;   // 0..1

  status: NexusStatus;
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
  result: NexusResult;
}

interface PopupAnswers {
  seller_role: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const AVG_SALES_TAX_RATE = 0.07;  // 7% blended average
const INTEREST_RATE = 0.08;       // 8% per year (typical range 6-12%)
const PENALTY_RATE_LOW = 0.10;    // 10% of tax owed (low end of typical range)
const PENALTY_RATE_HIGH = 0.25;   // 25% (high end)
const VDA_LOOKBACK_YEARS = 3.5;   // average VDA lookback (3-4 yr range)

const REVENUE_MIDPOINT: Record<string, number> = {
  under_100k: 50_000,
  "100k_500k": 275_000,
  "500k_2m":   1_200_000,
  over_2m:     3_500_000,
};

const PRODUCT_KEYS = {
  p67:  "us_67_wayfair_nexus_sniper",
  p147: "us_147_wayfair_nexus_sniper",
};

function formatUSD(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + Math.round(n / 1_000) + "k";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function formatUSDRange(lo: number, hi: number): string {
  return formatUSD(lo) + "–" + formatUSD(hi);
}

// ─────────────────────────────────────────────────────────────────────────────
// CALC ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function estimateStatesTriggered(geography: string, revenue: number): number {
  if (revenue < 100_000) {
    if (geography === "one_state") return 0;
    return 0; // under threshold even if spread
  }
  if (geography === "one_state") return 1;

  // For multi-state sellers, estimate per state concentration.
  // Top-10 states typically hold 55-70% of US consumer spending.
  // Each major state (CA, TX, NY, FL, IL) averages 8-15% of US revenue.
  // Nexus threshold: $100k/state.
  const concentrationFactor = geography === "intl_us" ? 0.7 : 1.0; // intl dilutes US concentration
  const effectiveUsRevenue = revenue * concentrationFactor;

  // Rough sequence: each state requires $100k. Top state absorbs ~12% of revenue.
  // Number of states over threshold ≈ number where cumulative 12%, 10%, 8%, 6%, 5%, 4%... × revenue >= $100k
  const shares = [0.12, 0.10, 0.08, 0.06, 0.05, 0.045, 0.04, 0.035, 0.03, 0.025, 0.02, 0.018, 0.015, 0.013];
  let triggered = 0;
  for (const s of shares) {
    if (effectiveUsRevenue * s >= 100_000) triggered++;
    else break;
  }
  return triggered;
}

function calcNexus(answers: AnswerMap): NexusResult {
  const geography      = String(answers.geography      || "one_state");
  const annualRevenue  = String(answers.annual_revenue || "under_100k");
  const marketplace    = String(answers.marketplace    || "direct");
  const registered     = String(answers.registered     || "home");
  const duration       = String(answers.duration       || "under_1");

  const revenueMidpoint = REVENUE_MIDPOINT[annualRevenue] ?? 50_000;
  const estimatedStatesTriggered = estimateStatesTriggered(geography, revenueMidpoint);

  let yearsUnregistered = 0;
  if (registered === "nowhere" || registered === "home" || registered === "unsure") {
    if (duration === "under_1")      yearsUnregistered = 0.5;
    else if (duration === "one_to_3") yearsUnregistered = 2;
    else                              yearsUnregistered = 4;
  }

  // Marketplace vs direct share
  let marketplaceShare = 0;
  if (marketplace === "primarily") marketplaceShare = 0.85;
  else if (marketplace === "mix")   marketplaceShare = 0.50;
  else                              marketplaceShare = 0;
  const directShare = 1 - marketplaceShare;

  // Back tax calculation (tax on revenue that should have been collected and remitted)
  // Only direct revenue creates full back-tax exposure (marketplace collected on your behalf
  // in most states — but still counts toward nexus threshold). Use direct share × state allocation.
  const revenuePerTriggeredState = estimatedStatesTriggered > 0
    ? (revenueMidpoint / Math.max(estimatedStatesTriggered * 2, 5)) // rough per-state apportionment
    : 0;

  const taxableRevenueTotal = estimatedStatesTriggered * revenuePerTriggeredState * directShare;
  const baseBackTax = taxableRevenueTotal * yearsUnregistered * AVG_SALES_TAX_RATE;

  // Bands: ±30% either side to reflect rate variance (5-10% state sales tax)
  const backTaxLow  = baseBackTax * 0.7;
  const backTaxHigh = baseBackTax * 1.4;

  // Penalties
  const penaltiesLow  = backTaxLow  * PENALTY_RATE_LOW;
  const penaltiesHigh = backTaxHigh * PENALTY_RATE_HIGH;

  // Interest — compounded over avg half the unregistered period
  const interestFactor = INTEREST_RATE * (yearsUnregistered / 2);
  const interestLow  = backTaxLow  * interestFactor;
  const interestHigh = backTaxHigh * interestFactor;

  const totalExposureLow  = backTaxLow  + penaltiesLow  + interestLow;
  const totalExposureHigh = backTaxHigh + penaltiesHigh + interestHigh;

  // VDA scenario — lookback capped at 3-4 years, penalties waived, tax + interest only
  const vdaYears = Math.min(yearsUnregistered, VDA_LOOKBACK_YEARS);
  const vdaBackTaxLow  = taxableRevenueTotal * vdaYears * AVG_SALES_TAX_RATE * 0.7;
  const vdaBackTaxHigh = taxableRevenueTotal * vdaYears * AVG_SALES_TAX_RATE * 1.4;
  const vdaInterestLow  = vdaBackTaxLow  * INTEREST_RATE * (vdaYears / 2);
  const vdaInterestHigh = vdaBackTaxHigh * INTEREST_RATE * (vdaYears / 2);
  const vdaExposureLow  = vdaBackTaxLow  + vdaInterestLow;
  const vdaExposureHigh = vdaBackTaxHigh + vdaInterestHigh;

  const vdaSavingsLow  = Math.max(0, totalExposureLow  - vdaExposureLow);
  const vdaSavingsHigh = Math.max(0, totalExposureHigh - vdaExposureHigh);

  // Status determination
  let status: NexusStatus = "CLEAR_LOW_REVENUE";

  if (geography === "multi_untracked") {
    status = "UNTRACKED_EXPOSURE";
  } else if (registered === "multi") {
    status = "REGISTERED_COMPLIANT";
  } else if (revenueMidpoint < 100_000 && geography === "one_state") {
    status = "CLEAR_SINGLE_STATE";
  } else if (revenueMidpoint < 100_000) {
    status = "CLEAR_LOW_REVENUE";
  } else if (yearsUnregistered >= 3 && revenueMidpoint >= 500_000) {
    status = "NON_COMPLIANT_SEVERE";
  } else if (yearsUnregistered >= 1 && revenueMidpoint >= 100_000) {
    status = "NON_COMPLIANT_MODERATE";
  } else if (yearsUnregistered < 1 && revenueMidpoint >= 100_000) {
    status = "AT_RISK_NEW_MULTISTATE";
  } else {
    status = "AT_RISK_GROWING";
  }

  return {
    geography, annualRevenue, marketplace, registered, duration,
    revenueMidpoint, estimatedStatesTriggered, yearsUnregistered,
    backTaxLow, backTaxHigh, penaltiesLow, penaltiesHigh, interestLow, interestHigh,
    totalExposureLow, totalExposureHigh,
    vdaExposureLow, vdaExposureHigh, vdaSavingsLow, vdaSavingsHigh,
    marketplaceShare, directShare, status,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcNexus(answers);

  const highlightCTA = `${formatUSDRange(result.totalExposureLow, result.totalExposureHigh)} current retroactive exposure`;
  const vdaCTA = `${formatUSDRange(result.vdaSavingsLow, result.vdaSavingsHigh)} potential VDA savings`;

  if (result.status === "CLEAR_LOW_REVENUE") {
    return {
      status: "CLEAR — UNDER ECONOMIC NEXUS THRESHOLD",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `At an estimated ${formatUSD(result.revenueMidpoint)} annual US online revenue, you are under the $100,000 per-state economic nexus threshold in every state. No retroactive exposure identified. Continue monitoring: when combined revenue with heavy state concentration crosses $100,000 in any single state, economic nexus is triggered.`,
      stats: [
        { label: "Revenue tier", value: formatUSD(result.revenueMidpoint) + "/yr" },
        { label: "States triggered", value: "0 estimated" },
        { label: "Retroactive exposure", value: "$0 identified" },
      ],
      consequences: [
        "✓ Under $100,000 in any single state: below the most common economic nexus threshold. Some states have lower thresholds — if you have concentrated sales in one state, verify its specific threshold.",
        "Home state: you still owe sales tax obligations in your home state (physical nexus from your business location) — make sure you are registered there.",
        "Watch signal: if one state becomes a concentrated channel (e.g. 40% of sales going to California), per-state revenue may approach threshold before total revenue looks large. Track by-state quarterly.",
        "Marketplace sales DO count toward nexus thresholds even when the marketplace collects tax on your behalf. If you add Amazon / Etsy / Walmart channels, revisit.",
        "Planning: set up by-state revenue tracking now while it is still simple. Establishing the habit before thresholds are crossed is dramatically easier than reconstructing history after the fact.",
      ],
      confidence: "HIGH",
      confidenceNote: "Under $100k total revenue with single-channel, single-state concentration — below economic nexus threshold in all 45 economic-nexus states.",
      tier: 67,
      ctaLabel: "Get My Nexus Monitoring Plan — $67 →",
      altTierLabel: "Want the full compliance strategy? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "CLEAR_SINGLE_STATE") {
    return {
      status: "CLEAR — HOME STATE ONLY, NO MULTI-STATE NEXUS",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Selling primarily into one state and under $100,000 total US revenue. No multi-state economic nexus triggered. Ensure you are registered in your home state (physical nexus from business location) and continue monitoring by-state revenue as you grow.`,
      stats: [
        { label: "Revenue tier", value: formatUSD(result.revenueMidpoint) + "/yr" },
        { label: "States triggered", value: "0–1 (home only)" },
        { label: "Retroactive exposure", value: "$0 identified" },
      ],
      consequences: [
        "✓ No economic nexus triggered in out-of-state jurisdictions based on your current geography and revenue.",
        "Home state: your physical presence creates obligation in your home state regardless of revenue. Verify you are registered and collecting / remitting there.",
        "If you expand: the moment multi-state customer base grows, per-state revenue can cross $100k in top states before total revenue looks large. California alone can be 10-15% of US-consumer revenue.",
        "Marketplace signal: adding Amazon / Etsy / Walmart changes the picture. Marketplace sales count toward nexus thresholds even with facilitator collection.",
        "Monitoring rule of thumb: set an alert at 80% of each state's threshold. Most states: $80,000 total revenue in any state should trigger review.",
      ],
      confidence: "HIGH",
      confidenceNote: "Single-state seller under total $100k revenue — outside economic nexus of all other states.",
      tier: 67,
      ctaLabel: "Get My Home-State Compliance Plan — $67 →",
      altTierLabel: "Planning to expand? — $147 full strategy",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "REGISTERED_COMPLIANT") {
    return {
      status: "REGISTERED — MULTI-STATE COMPLIANCE IN PLACE",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `You are registered for sales tax in multiple states, which indicates an active compliance position. Focus areas: verify coverage matches current nexus footprint, confirm marketplace vs direct obligations are correctly split, and audit for any states where nexus has been triggered since last review.`,
      stats: [
        { label: "Revenue tier", value: formatUSD(result.revenueMidpoint) + "/yr" },
        { label: "States likely needing coverage", value: result.estimatedStatesTriggered + " estimated" },
        { label: "Ongoing compliance", value: "Active" },
      ],
      consequences: [
        "✓ Multi-state registration in place — ahead of most sellers at your revenue tier.",
        "Coverage review: as revenue and geography shift, new states can cross the threshold. Reconfirm coverage quarterly — especially after product launches, marketplace additions, or geography expansion.",
        "Marketplace / direct split: confirm that registration and filing correctly reflect marketplace facilitator collection (platform-collected) vs direct website sales (you collect). Some states require separate filing even when marketplace collects.",
        "Economic vs physical nexus: verify you have accounted for physical nexus creators too — remote employees, warehouses, inventory (including FBA), returned-goods processing facilities.",
        "Filing burden audit: typical registered seller at your revenue tier files 30-80 returns per year. Sales tax automation (TaxJar, Avalara) becomes essential above 5 states.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Multi-state registered seller — primary risk is coverage gaps as geography / products / channels change, not initial exposure.",
      tier: 147,
      ctaLabel: "Get My Compliance Coverage Audit — $147 →",
      altTierLabel: "Just want a status check? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "UNTRACKED_EXPOSURE") {
    return {
      status: "UNTRACKED EXPOSURE — CANNOT QUANTIFY WITHOUT STATE-LEVEL DATA",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `You do not currently track sales by destination state. This is the most common cause of undetected nexus exposure. At ${formatUSD(result.revenueMidpoint)} annual revenue you are almost certainly over the $100,000 threshold in multiple states — but without state-level tracking, you cannot know how many, how long, or what the retroactive liability is. The first action is the data pull, not the registration decision.`,
      stats: [
        { label: "Revenue tier", value: formatUSD(result.revenueMidpoint) + "/yr", highlight: true },
        { label: "Estimated states (if typical distribution)", value: result.estimatedStatesTriggered + " likely", highlight: true },
        { label: "Exposure (estimate, typical distribution)", value: formatUSDRange(result.totalExposureLow, result.totalExposureHigh), highlight: true },
      ],
      consequences: [
        "⚠ Without state-level revenue data, you cannot confirm or deny nexus in any specific state. Typical distribution for a multi-state online seller at this revenue tier crosses nexus in 4-10 states.",
        "Immediate action: pull sales-by-destination-state report from your e-commerce platform / payment processor / marketplace accounts. This is a 1-2 hour data pull, not a consulting project.",
        "Channels to aggregate: direct website (Shopify / WooCommerce / BigCommerce), marketplace (Amazon / Etsy / eBay / Walmart — download Seller Central / Etsy Manager reports), POS (Square / Stripe).",
        `Rough exposure estimate assuming typical distribution: ${formatUSDRange(result.totalExposureLow, result.totalExposureHigh)} across an estimated ${result.estimatedStatesTriggered} states. Actual exposure depends entirely on true geographic concentration.`,
        `VDA path: once states are confirmed, Voluntary Disclosure Agreements can limit lookback to ${VDA_LOOKBACK_YEARS} years and waive penalties. Potential saving vs audit discovery: ${formatUSDRange(result.vdaSavingsLow, result.vdaSavingsHigh)}.`,
        "Priority principle: register in states with highest unregistered revenue first. Biggest states (CA, TX, NY, FL, IL) by consumer population drive most of the exposure.",
      ],
      confidence: "LOW",
      confidenceNote: "Cannot provide state-specific exposure without state-level revenue data. Estimate assumes typical US consumer-revenue distribution for multi-state online sellers.",
      tier: 147,
      ctaLabel: "Get My State-Level Exposure Mapping — $147 →",
      altTierLabel: "Just want the overview? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "AT_RISK_NEW_MULTISTATE") {
    return {
      status: "AT RISK — MULTI-STATE SALES UNDER 1 YEAR",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `At ${formatUSD(result.revenueMidpoint)} annual revenue across multiple states for under a year, nexus may be freshly triggered in ${result.estimatedStatesTriggered} state${result.estimatedStatesTriggered === 1 ? "" : "s"}. Retroactive exposure is still small because the clock started recently — but it grows every month you remain unregistered. Acting now caps it at a manageable level and positions you to register cleanly before any state audit contact.`,
      stats: [
        { label: "States likely triggered", value: String(result.estimatedStatesTriggered), highlight: true },
        { label: "Current exposure (approx)", value: formatUSDRange(result.totalExposureLow, result.totalExposureHigh), highlight: true },
        { label: "VDA savings available", value: formatUSDRange(result.vdaSavingsLow, result.vdaSavingsHigh) },
      ],
      consequences: [
        `⚠ Estimated ${result.estimatedStatesTriggered} state${result.estimatedStatesTriggered === 1 ? "" : "s"} with economic nexus triggered based on your revenue and geography. Exact count depends on state-level revenue concentration.`,
        `Current retroactive exposure: ${formatUSDRange(result.totalExposureLow, result.totalExposureHigh)} — back tax + penalties + interest. Low end of range reflects minimum rates / penalties; high end reflects states with aggressive enforcement (e.g. California, Texas).`,
        `Liability is RETROACTIVE from the date each threshold was crossed — not from discovery or registration date. Every month of delay adds uncollected tax + additional interest + potential penalty escalation.`,
        "Marketplace clarification: if you sell through Amazon / Etsy / Walmart, those platforms collected tax on marketplace sales in most states — but marketplace sales still count toward your nexus threshold, and direct website sales are still YOUR obligation.",
        `Voluntary Disclosure Agreement (VDA): available in most states. Limits lookback to ${VDA_LOOKBACK_YEARS} years, typically waives penalties. At your exposure level, VDA saves approximately ${formatUSDRange(result.vdaSavingsLow, result.vdaSavingsHigh)} vs waiting for audit discovery.`,
        "Priority registration order: start with the largest consumer states where you have crossed threshold (CA, TX, NY, FL, IL), then work through smaller states. Concentrate work in the states where exposure is largest.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "State count and exposure are estimates based on typical multi-state revenue distribution. Precise figures require state-level revenue data.",
      tier: 147,
      ctaLabel: "Get My Multi-State VDA Plan — $147 →",
      altTierLabel: "Just want the exposure map? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "AT_RISK_GROWING") {
    return {
      status: "AT RISK — NEXUS LIKELY IN MULTIPLE STATES",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your revenue and geography point to economic nexus triggered in approximately ${result.estimatedStatesTriggered} states, with current registration not covering that footprint. Retroactive exposure is accruing in every uncovered state. The VDA window is still open — but only until the first state audit contact, which becomes increasingly likely as revenue grows.`,
      stats: [
        { label: "States likely triggered", value: String(result.estimatedStatesTriggered), highlight: true },
        { label: "Current retroactive exposure", value: formatUSDRange(result.totalExposureLow, result.totalExposureHigh), highlight: true },
        { label: "VDA savings available", value: formatUSDRange(result.vdaSavingsLow, result.vdaSavingsHigh), highlight: true },
      ],
      consequences: [
        `⚠ Approximately ${result.estimatedStatesTriggered} states with triggered nexus. Your current registration does not cover this footprint.`,
        `Retroactive exposure: ${formatUSDRange(result.totalExposureLow, result.totalExposureHigh)} — uncollected tax + penalties + interest across ${result.yearsUnregistered} year${result.yearsUnregistered === 1 ? "" : "s"} average. This exposure is yours because you never collected the tax from customers; the state will still collect it from you.`,
        "Marketplace layer: if you sell through Amazon / Etsy / Walmart, facilitator laws mean the platform collected tax on marketplace sales in most states. BUT: marketplace sales still count toward your nexus threshold, and direct website sales remain your collection obligation. The platforms are not a compliance shield for your direct channels.",
        `VDA mathematics: filing VDAs in triggered states typically caps lookback at ${VDA_LOOKBACK_YEARS} years and waives penalties. Estimated saving vs waiting for audit discovery: ${formatUSDRange(result.vdaSavingsLow, result.vdaSavingsHigh)}.`,
        "Audit risk profile: revenue around this level + unregistered multi-state footprint is a common audit trigger. States share data with each other (Multistate Tax Commission). A contact letter from one state often leads to inquiries from others.",
        "Priority action sequence: (1) pull by-state revenue history, (2) identify threshold crossings by state and date, (3) engage sales-tax VDA counsel (anonymous filing available in most states), (4) file VDAs in order of exposure size, (5) register and begin ongoing collection in each state.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Estimates assume typical revenue distribution across US states. Precision requires state-level revenue data.",
      tier: 147,
      ctaLabel: "Get My VDA Registration Plan — $147 →",
      altTierLabel: "Just want the state-by-state map? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "NON_COMPLIANT_MODERATE") {
    return {
      status: "NON-COMPLIANT — MULTI-STATE NEXUS, UNDER-REGISTERED",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Multi-year multi-state sales at ${formatUSD(result.revenueMidpoint)} revenue without full state registration creates material retroactive exposure. Estimated ${result.estimatedStatesTriggered} states with triggered nexus. Current exposure: ${formatUSDRange(result.totalExposureLow, result.totalExposureHigh)}. VDA registration is the cleanest lever — it caps lookback to ${VDA_LOOKBACK_YEARS} years and typically waives penalties, but only before the first audit contact.`,
      stats: [
        { label: "States likely triggered", value: String(result.estimatedStatesTriggered), highlight: true },
        { label: "Retroactive exposure (audit discovery)", value: formatUSDRange(result.totalExposureLow, result.totalExposureHigh), highlight: true },
        { label: "VDA savings available", value: formatUSDRange(result.vdaSavingsLow, result.vdaSavingsHigh), highlight: true },
      ],
      consequences: [
        `🔒 Estimated ${result.estimatedStatesTriggered} states with triggered nexus based on revenue distribution — unregistered or partially registered for ${result.yearsUnregistered}+ years.`,
        `Retroactive exposure breakdown: back tax ${formatUSDRange(result.backTaxLow, result.backTaxHigh)} · penalties ${formatUSDRange(result.penaltiesLow, result.penaltiesHigh)} · interest ${formatUSDRange(result.interestLow, result.interestHigh)}. Total: ${formatUSDRange(result.totalExposureLow, result.totalExposureHigh)}. This is money the customer already paid you in the form of revenue — you absorb it from margin because it was never collected as tax.`,
        `VDA scenario: filing Voluntary Disclosure Agreements now caps lookback at ${VDA_LOOKBACK_YEARS} years and waives penalties. Resulting exposure ${formatUSDRange(result.vdaExposureLow, result.vdaExposureHigh)}. Saving vs audit discovery: ${formatUSDRange(result.vdaSavingsLow, result.vdaSavingsHigh)}.`,
        "Marketplace facilitator note: Amazon / Etsy / Walmart collect sales tax on marketplace sales in most states — but those sales still count toward your nexus threshold, and direct website sales remain your collection obligation. Sellers who assumed 'Amazon handles it' typically have unaddressed direct-sales exposure.",
        "State enforcement pattern: revenue at this level typically draws audit attention within 1-3 years of non-compliance. The Multistate Tax Commission coordinates data sharing — one state's inquiry often leads to multiple.",
        "Action sequence: (1) state-level revenue data pull, (2) by-state threshold-crossing dates, (3) engage a sales-tax attorney for multi-state VDA negotiation (anonymous filing available in most states until VDA is accepted), (4) prioritise VDAs in largest-exposure states first, (5) begin ongoing collection and filing.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "State count and exposure are estimates based on typical multi-state distribution. Precision improves dramatically with state-level revenue history.",
      tier: 147,
      ctaLabel: "Get My Multi-State VDA Plan — $147 →",
      altTierLabel: "Just want the exposure map? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // NON_COMPLIANT_SEVERE
  return {
    status: "SEVERE EXPOSURE — MULTI-YEAR UNREGISTERED AT SCALE",
    statusClass: "text-red-700",
    panelClass: "border-red-200 bg-red-50",
    headline: `At ${formatUSD(result.revenueMidpoint)} annual revenue across multiple states for 3+ years without full registration, you are carrying material retroactive liability. Estimated ${result.estimatedStatesTriggered} states with triggered nexus. Exposure: ${formatUSDRange(result.totalExposureLow, result.totalExposureHigh)}. This revenue tier and unregistered period attracts state audit attention — the VDA window is narrowing. Filing now can limit exposure to ${formatUSDRange(result.vdaExposureLow, result.vdaExposureHigh)} — saving ${formatUSDRange(result.vdaSavingsLow, result.vdaSavingsHigh)}.`,
    stats: [
      { label: "States likely triggered", value: String(result.estimatedStatesTriggered), highlight: true },
      { label: "Exposure (audit discovery)", value: formatUSDRange(result.totalExposureLow, result.totalExposureHigh), highlight: true },
      { label: "VDA savings available", value: formatUSDRange(result.vdaSavingsLow, result.vdaSavingsHigh), highlight: true },
    ],
    consequences: [
      `🔒 Estimated ${result.estimatedStatesTriggered} states with nexus triggered — unregistered for ${result.yearsUnregistered}+ years at ${formatUSD(result.revenueMidpoint)}/yr revenue.`,
      `Retroactive exposure at audit discovery: back tax ${formatUSDRange(result.backTaxLow, result.backTaxHigh)} + penalties ${formatUSDRange(result.penaltiesLow, result.penaltiesHigh)} + interest ${formatUSDRange(result.interestLow, result.interestHigh)} = ${formatUSDRange(result.totalExposureLow, result.totalExposureHigh)}. All paid from margin — customer already paid you the revenue; the state will still collect the tax component from you.`,
      `VDA mathematics: lookback capped at ${VDA_LOOKBACK_YEARS} years, penalties typically waived. Resulting exposure ${formatUSDRange(result.vdaExposureLow, result.vdaExposureHigh)}. Saving vs audit: ${formatUSDRange(result.vdaSavingsLow, result.vdaSavingsHigh)}. This is the single largest economic lever available to you.`,
      "Marketplace layer: if a significant portion of sales flows through Amazon / Etsy / Walmart, those platforms collected tax on marketplace sales in most states — your back-tax exposure is concentrated on DIRECT website sales. But marketplace sales still count toward your nexus threshold, and in some states require separate registration even when the marketplace collects.",
      "Enforcement risk: at this revenue tier and unregistered duration, audit probability within 12-24 months is meaningful. Multistate Tax Commission data sharing means one state's inquiry often triggers others. VDAs must be filed BEFORE the audit letter — once contacted, VDA is generally off the table in that state.",
      "Urgent sequence: (1) this week — state-level revenue data pull from all channels, (2) next 2 weeks — engage sales-tax VDA counsel (specialist, not general tax); anonymous filing available, (3) file VDAs in parallel across highest-exposure states (typically CA, TX, NY, FL, IL first), (4) negotiate payment plan where necessary, (5) implement sales tax automation (TaxJar / Avalara) to prevent future accumulation.",
    ],
    confidence: "MEDIUM",
    confidenceNote: "Estimates reflect typical multi-state revenue distribution. Actual exposure depends entirely on state-level revenue history — which is the first data pull required.",
    tier: 147,
    ctaLabel: "Get My Urgent VDA Strategy — $147 →",
    altTierLabel: "Just want the exposure overview? — $67 instead",
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
    id: "geography", step: 1, type: "button_group",
    label: "Where do your customers buy from?",
    subLabel: "Customer destination — not where you or your warehouse are. Economic nexus is triggered by where your customers live, not where your business is located.",
    options: [
      { label: "Primarily one state (usually my home state)", value: "one_state",       subLabel: "Low multi-state nexus risk" },
      { label: "Multiple states — I know roughly which ones",  value: "multi_known",   subLabel: "Likely nexus in multiple states" },
      { label: "Multiple states — I am not tracking by state",  value: "multi_untracked", subLabel: "Tracking gap — state-level data needed" },
      { label: "International + US customers",                  value: "intl_us",       subLabel: "US nexus still applies to US sales" },
    ],
    required: true,
  },
  {
    id: "annual_revenue", step: 2, type: "button_group",
    label: "Annual US online revenue (all channels combined)?",
    subLabel: "All US revenue from all channels — direct website, Amazon, Etsy, Walmart, eBay, Shopify. Include marketplace sales: they count toward nexus thresholds.",
    options: [
      { label: "Under $100,000",         value: "under_100k", subLabel: "Below $100k/state threshold in all states" },
      { label: "$100,000 – $500,000",     value: "100k_500k", subLabel: "Approaching / crossing in top states" },
      { label: "$500,000 – $2,000,000",   value: "500k_2m",   subLabel: "Nexus likely in 3-7 states" },
      { label: "Over $2,000,000",         value: "over_2m",   subLabel: "Nexus likely in 8+ states" },
    ],
    required: true,
  },
  {
    id: "marketplace", step: 3, type: "button_group",
    label: "Do you sell through marketplaces?",
    subLabel: "Amazon, Etsy, eBay, Walmart Marketplace, Shopify — these platforms typically collect sales tax on marketplace sales, but those sales STILL COUNT toward your nexus threshold.",
    options: [
      { label: "Yes — primarily marketplace sales",        value: "primarily", subLabel: "Platform collects on marketplace; nexus threshold still tracked" },
      { label: "Yes — mix of marketplace and direct",       value: "mix",       subLabel: "Direct website sales = your collection obligation" },
      { label: "No — direct website / own store only",      value: "direct",    subLabel: "All sales tax collection is your responsibility" },
    ],
    required: true,
  },
  {
    id: "registered", step: 4, type: "button_group",
    label: "Are you registered for sales tax beyond your home state?",
    subLabel: "Multi-state registration = actively collecting and filing in states beyond your home state. Check your sales tax filings to confirm.",
    options: [
      { label: "Yes — registered in multiple states",        value: "multi",    subLabel: "Compliance position in place" },
      { label: "Yes — registered in my home state only",     value: "home",     subLabel: "No multi-state coverage — exposure likely" },
      { label: "No — not registered anywhere",                value: "nowhere",  subLabel: "Home state may also have physical nexus obligation" },
      { label: "Not sure",                                    value: "unsure",   subLabel: "Same risk profile as unregistered until confirmed" },
    ],
    required: true,
  },
  {
    id: "duration", step: 5, type: "button_group",
    label: "How long have you been selling online at current revenue levels?",
    subLabel: "Duration at current revenue indicates how long nexus thresholds may have been crossed unregistered — retroactive exposure compounds each year.",
    options: [
      { label: "Under 1 year",    value: "under_1",  subLabel: "Limited retroactive window" },
      { label: "1 to 3 years",     value: "one_to_3", subLabel: "Moderate retroactive exposure accrual" },
      { label: "Over 3 years",     value: "over_3",   subLabel: "Significant exposure + higher audit probability" },
    ],
    required: true,
  },
];

const TOTAL_STEPS = 5;

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

      {/* Legal anchor banner */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Legal anchor — South Dakota v. Wayfair</p>
        <p className="text-neutral-800 leading-relaxed">
          <strong>South Dakota v. Wayfair, Inc., 585 U.S. 162 (2018)</strong> — Supreme Court held that states may require remote sellers to collect and remit sales tax based on economic activity alone, without physical presence. 45 states + DC have economic nexus statutes. Most common threshold: $100,000 in sales or 200 transactions per state per calendar year.
        </p>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Before/After comparison — only when there is exposure */}
      {verdict.result.totalExposureHigh > 0 && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Without VDA vs With VDA registration now</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-red-700">Wait for audit discovery</p>
              <ul className="space-y-1 text-xs text-red-900">
                <li>Back tax: {formatUSDRange(verdict.result.backTaxLow, verdict.result.backTaxHigh)}</li>
                <li>Penalties: {formatUSDRange(verdict.result.penaltiesLow, verdict.result.penaltiesHigh)}</li>
                <li>Interest: {formatUSDRange(verdict.result.interestLow, verdict.result.interestHigh)}</li>
                <li className="font-bold mt-1 pt-1 border-t border-red-200">Total: {formatUSDRange(verdict.result.totalExposureLow, verdict.result.totalExposureHigh)}</li>
              </ul>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-700">File VDAs now</p>
              <ul className="space-y-1 text-xs text-emerald-900">
                <li>Lookback capped: {VDA_LOOKBACK_YEARS} years</li>
                <li>Penalties: typically waived</li>
                <li>Tax + interest only</li>
                <li className="font-bold mt-1 pt-1 border-t border-emerald-200">Total: {formatUSDRange(verdict.result.vdaExposureLow, verdict.result.vdaExposureHigh)}</li>
              </ul>
            </div>
          </div>
          <p className="mt-2 text-center text-sm font-bold text-neutral-950">
            Saving from acting now: {formatUSDRange(verdict.result.vdaSavingsLow, verdict.result.vdaSavingsHigh)}
          </p>
        </div>
      )}

      {/* Marketplace vs direct split */}
      {verdict.result.marketplaceShare > 0 && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Marketplace vs direct obligation split</p>
          <div className="flex justify-between mb-1">
            <span className="text-neutral-600">Marketplace-facilitator collected ({(verdict.result.marketplaceShare * 100).toFixed(0)}%)</span>
            <span className="text-emerald-700 font-mono">Platform collects in most states</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600">Direct website sales ({(verdict.result.directShare * 100).toFixed(0)}%)</span>
            <span className="text-red-700 font-mono">Your collection obligation</span>
          </div>
          <p className="mt-2 text-[11px] text-neutral-500">Note: marketplace sales STILL count toward your nexus threshold even when the platform collects tax. Some states require registration even when marketplace collects.</p>
        </div>
      )}

      {/* Fear framing for exposure cases */}
      {(verdict.result.totalExposureHigh > 10_000) && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ Nexus liability is retroactive from threshold date</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-1">
            {formatUSDRange(verdict.result.totalExposureLow, verdict.result.totalExposureHigh)} is the exposure you are carrying right now.
          </p>
          <p className="text-xs text-red-800 leading-relaxed">
            You never collected this tax from customers. The state does not care. The liability is yours — paid from margin. And it grows every month you remain unregistered. VDA is the clean lever: lookback capped at {VDA_LOOKBACK_YEARS} years, penalties typically waived — but only available before the first state audit letter arrives.
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
          <strong className="text-neutral-950">Nexus is retroactive; registration is prospective.</strong> Liability begins the day you cross each state&apos;s threshold — not the day you discover or register. The VDA window closes once a state makes audit contact. Acting while the window is open is the primary lever.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Estimated states where nexus is triggered based on your revenue and geography</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Retroactive exposure range (tax + penalties + interest) by scenario</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>VDA opportunity mapping — which states, what lookback, what savings</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Priority registration sequence — highest exposure states first</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Filing burden estimate and automation readiness assessment</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 sales-tax attorney questions specific to your exposure profile</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your multi-state exposure profile</p>
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

export default function WayfairNexusSniperCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ seller_role: "", urgency: "", accountant: "" });
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
        product_slug: "wayfair-nexus-sniper",
        source_path: "/us/check/wayfair-nexus-sniper",
        country_code: "US", currency_code: "USD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          compliance_status: verdict.result.status,
          states_triggered: verdict.result.estimatedStatesTriggered,
          exposure_low: verdict.result.totalExposureLow,
          exposure_high: verdict.result.totalExposureHigh,
          vda_savings_low: verdict.result.vdaSavingsLow,
          vda_savings_high: verdict.result.vdaSavingsHigh,
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
      body: JSON.stringify({ email, source: "wayfair_nexus_sniper", country_code: "US", site: "taxchecknow" }),
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
    const sid = sessionId || `nexus_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("wayfair-nexus-sniper_geography", String(answers.geography || ""));
    sessionStorage.setItem("wayfair-nexus-sniper_annual_revenue", String(answers.annual_revenue || ""));
    sessionStorage.setItem("wayfair-nexus-sniper_marketplace", String(answers.marketplace || ""));
    sessionStorage.setItem("wayfair-nexus-sniper_registered", String(answers.registered || ""));
    sessionStorage.setItem("wayfair-nexus-sniper_duration", String(answers.duration || ""));
    sessionStorage.setItem("wayfair-nexus-sniper_compliance_status", verdict.result.status);
    sessionStorage.setItem("wayfair-nexus-sniper_states_triggered", String(verdict.result.estimatedStatesTriggered));
    sessionStorage.setItem("wayfair-nexus-sniper_exposure_low", String(Math.round(verdict.result.totalExposureLow)));
    sessionStorage.setItem("wayfair-nexus-sniper_exposure_high", String(Math.round(verdict.result.totalExposureHigh)));
    sessionStorage.setItem("wayfair-nexus-sniper_vda_savings_low", String(Math.round(verdict.result.vdaSavingsLow)));
    sessionStorage.setItem("wayfair-nexus-sniper_vda_savings_high", String(Math.round(verdict.result.vdaSavingsHigh)));
    sessionStorage.setItem("wayfair-nexus-sniper_status", verdict.status);
    sessionStorage.setItem("wayfair-nexus-sniper_tier", String(popupTier));

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
          success_url: `${window.location.origin}/us/check/wayfair-nexus-sniper/success/${successPath}`,
          cancel_url: `${window.location.origin}/us/check/wayfair-nexus-sniper`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your nexus exposure analysis for your sales-tax attorney.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your state-by-state exposure map by email — free.</p>
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
                    {popupTier === 67 ? "Your Nexus Audit Pack" : "Your VDA Shield Strategy Pack"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">S.D. v. Wayfair · 45-state economic nexus · April 2026</p>
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
                      {popupTier === 67 ? "Nexus Audit Pack™" : "VDA Shield Strategy Pack™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "State-by-state nexus exposure map, retroactive liability estimate, marketplace vs direct obligation split, and 5 sales-tax attorney questions — built around your specific revenue profile."
                        : "Full strategy: nexus exposure map, VDA filing sequence across priority states, penalty-reduction calculation, filing-burden forecast, sales-tax automation readiness, and multi-state attorney coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic nexus content. Your specific state-level exposure and VDA sequence.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Nexus Audit →" : "Get My VDA Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the audit? — $67 instead" : "Want the full VDA strategy? — $147 instead"}
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
                    { label: "Your role", key: "seller_role", options: [["founder","Founder / owner"],["cfo","CFO / finance lead"],["ops","Operations / compliance lead"],["advisor","Advisor / CPA for a client"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["audit_contact","Audit letter received"],["planning_now","Registering in next 90 days"],["modeling","Modelling exposure before decision"]] },
                    { label: "Do you have a sales-tax advisor?", key: "accountant", options: [["tax_attorney","Yes — sales-tax attorney"],["cpa","Yes — CPA firm"],["software","Software only (TaxJar / Avalara)"],["none","No — need one"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · Wayfair-referenced content</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile sticky bar */}
      {showVerdict && verdict && verdict.result.totalExposureHigh > 10_000 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Retroactive exposure</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatUSDRange(verdict.result.totalExposureLow, verdict.result.totalExposureHigh)} — VDA saves {formatUSDRange(verdict.result.vdaSavingsLow, verdict.result.vdaSavingsHigh)}
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
