"use client";

/**
 * NZ-02 — Platform GST Decision Engine (formerly App Tax GST Sniper)
 * Pattern: DecisionPath (Module E) — 5 explicit paths, not a binary
 *
 * Core question: Which of five GST paths applies to this platform seller?
 *   1. STAY_FLAT_RATE         — low expenses, simple, clawback risk absent
 *   2. VOLUNTARY_REGISTER     — break-even favourable + multi-year horizon
 *   3. THRESHOLD_REGISTER     — at/near $60k — mandatory
 *   4. REGISTER_BIG_PURCHASE  — one-off recovery on major asset
 *   5. DO_NOT_REGISTER_CLAWBACK — retained assets + short horizon = clawback risk dominates
 *
 * Legal anchor: Goods and Services Tax Act 1985 — marketplace rules for listed
 * services, OPERATIVE FROM 1 APRIL 2024 (seller-facing date; 2023 refers only
 * to legislative passage). Listed services include ride-sharing, food delivery,
 * and short-stay / visitor accommodation.
 *
 * Core maths:
 *   Platform collects 15% GST on gross listed services regardless of seller
 *   registration. IRD retains 6.5% and passes 8.5% to unregistered sellers as
 *   flat-rate credit. Registered sellers zero-rate the platform supply in their
 *   own return AND claim 15% input tax credits on costs.
 *
 * Deregistration trap: deemed sale of retained business assets at market value
 * times 15% GST. For Airbnb hosts with property assets, this can exceed the
 * cumulative benefit of registration if activity stops within ~3 years.
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type DecisionPath =
  | "STAY_FLAT_RATE"
  | "VOLUNTARY_REGISTER"
  | "THRESHOLD_REGISTER"
  | "REGISTER_BIG_PURCHASE"
  | "DO_NOT_REGISTER_CLAWBACK"
  | "ALREADY_REGISTERED_REVIEW"
  | "APPROACHING_THRESHOLD";

interface GstResult {
  platform:          string;   // airbnb / rideshare / food_delivery / multi
  monthlyIncome:     number;
  monthlyExpenses:   number;
  currentStatus:     string;   // not_registered / registered_voluntary / registered_threshold / unsure
  bigPurchase:       string;   // none / small_5_15k / mid_15_50k / large_over_50k
  horizon:           string;   // under_1yr / one_to_3yr / multi_year
  retainedAssets:    string;   // none / small / significant (property-scale)

  annualIncome:         number;
  annualExpenses:       number;
  flatRateCreditAnnual: number;           // income × 8.5%
  inputTaxCreditAnnual: number;           // expenses × (15/115)
  ongoingBenefitAnnual: number;           // input - flat-rate
  breakEvenExpensePct:  number;           // ~56% roughly
  bigPurchaseGst:       number;           // one-off input tax on the purchase

  deregistrationClawbackEstimate: number; // retained assets × 15% (rough)
  thresholdStatus:                "under" | "approaching" | "at_or_over";

  decisionPath: DecisionPath;
  status: DecisionPath;
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
  result: GstResult;
}

interface PopupAnswers {
  seller_role: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const GST_RATE = 0.15;
const FLAT_RATE_CREDIT = 0.085;
const PLATFORM_KEEPS_FOR_IRD = 0.065;
const REGISTRATION_THRESHOLD = 60_000;

const INCOME_MIDPOINT: Record<string, number> = {
  under_500:    300,
  "500_2k":     1_200,
  "2k_5k":      3_500,
  over_5k:      7_000,
};

const EXPENSE_MIDPOINT: Record<string, number> = {
  under_200:    100,
  "200_1k":     600,
  "1k_3k":      2_000,
  over_3k:      4_000,
};

const BIG_PURCHASE_AMOUNT: Record<string, number> = {
  none:             0,
  small_5_15k:      10_000,
  mid_15_50k:       30_000,
  large_over_50k:   75_000,
};

const RETAINED_ASSET_VALUE: Record<string, number> = {
  none:        0,
  small:       15_000,     // vehicle, equipment
  significant: 700_000,    // property (for Airbnb hosts)
};

const PRODUCT_KEYS = {
  p67:  "nz_67_app_tax_gst_sniper",
  p147: "nz_147_app_tax_gst_sniper",
};

function formatNZD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-NZ");
}

function formatNZDPerYear(n: number): string {
  return formatNZD(n) + "/yr";
}

// ─────────────────────────────────────────────────────────────────────────────
// CALC ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcGst(answers: AnswerMap): GstResult {
  const platform       = String(answers.platform        || "airbnb");
  const incomeKey      = String(answers.monthly_income  || "500_2k");
  const expensesKey    = String(answers.monthly_expenses || "200_1k");
  const currentStatus  = String(answers.current_status  || "not_registered");
  const bigPurchase    = String(answers.big_purchase    || "none");
  const horizon        = String(answers.horizon         || "multi_year");
  const retainedAssets = String(answers.retained_assets || "none");

  const monthlyIncome   = INCOME_MIDPOINT[incomeKey] ?? 1_200;
  const monthlyExpenses = EXPENSE_MIDPOINT[expensesKey] ?? 600;
  const annualIncome    = monthlyIncome * 12;
  const annualExpenses  = monthlyExpenses * 12;

  const flatRateCreditAnnual = annualIncome * FLAT_RATE_CREDIT;
  const inputTaxCreditAnnual = annualExpenses * (GST_RATE / (1 + GST_RATE));
  const ongoingBenefitAnnual = inputTaxCreditAnnual - flatRateCreditAnnual;

  const breakEvenExpensePct = FLAT_RATE_CREDIT * (1 + GST_RATE) / GST_RATE; // ~0.5617

  const bigPurchaseAmount = BIG_PURCHASE_AMOUNT[bigPurchase] ?? 0;
  const bigPurchaseGst = bigPurchaseAmount * (GST_RATE / (1 + GST_RATE));

  const retainedAssetValue = RETAINED_ASSET_VALUE[retainedAssets] ?? 0;
  const deregistrationClawbackEstimate = retainedAssetValue * GST_RATE;

  // Threshold status
  let thresholdStatus: GstResult["thresholdStatus"] = "under";
  if (annualIncome >= REGISTRATION_THRESHOLD) thresholdStatus = "at_or_over";
  else if (annualIncome >= 0.80 * REGISTRATION_THRESHOLD) thresholdStatus = "approaching";

  // Decision path — priority order
  let decisionPath: DecisionPath;

  if (currentStatus === "registered_threshold" || currentStatus === "registered_voluntary") {
    decisionPath = "ALREADY_REGISTERED_REVIEW";
  } else if (thresholdStatus === "at_or_over") {
    decisionPath = "THRESHOLD_REGISTER";
  } else if (horizon === "under_1yr" && retainedAssets === "significant") {
    // Short horizon + retained property = clawback trap even if ongoing positive
    decisionPath = "DO_NOT_REGISTER_CLAWBACK";
  } else if (horizon === "one_to_3yr" && retainedAssets === "significant" && ongoingBenefitAnnual < deregistrationClawbackEstimate) {
    decisionPath = "DO_NOT_REGISTER_CLAWBACK";
  } else if (bigPurchase === "mid_15_50k" || bigPurchase === "large_over_50k") {
    decisionPath = "REGISTER_BIG_PURCHASE";
  } else if (thresholdStatus === "approaching") {
    decisionPath = "APPROACHING_THRESHOLD";
  } else if (ongoingBenefitAnnual > 0 && horizon === "multi_year") {
    decisionPath = "VOLUNTARY_REGISTER";
  } else {
    decisionPath = "STAY_FLAT_RATE";
  }

  return {
    platform, monthlyIncome, monthlyExpenses,
    currentStatus, bigPurchase, horizon, retainedAssets,
    annualIncome, annualExpenses,
    flatRateCreditAnnual, inputTaxCreditAnnual, ongoingBenefitAnnual,
    breakEvenExpensePct,
    bigPurchaseGst,
    deregistrationClawbackEstimate,
    thresholdStatus,
    decisionPath,
    status: decisionPath,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcGst(answers);
  const pathLabel = {
    STAY_FLAT_RATE: "PATH A — STAY ON FLAT-RATE CREDIT",
    VOLUNTARY_REGISTER: "PATH B — VOLUNTARILY REGISTER",
    THRESHOLD_REGISTER: "PATH C — MANDATORY REGISTRATION ($60K THRESHOLD)",
    REGISTER_BIG_PURCHASE: "PATH D — REGISTER BEFORE LARGE PURCHASE",
    DO_NOT_REGISTER_CLAWBACK: "PATH E — DO NOT REGISTER (DEREGISTRATION CLAWBACK RISK)",
    APPROACHING_THRESHOLD: "APPROACHING THRESHOLD — PLAN REGISTRATION TIMING",
    ALREADY_REGISTERED_REVIEW: "ALREADY REGISTERED — COVERAGE REVIEW",
  }[result.decisionPath];

  if (result.decisionPath === "STAY_FLAT_RATE") {
    return {
      status: pathLabel,
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `At ${formatNZD(result.annualIncome)}/year platform income and ${formatNZD(result.annualExpenses)}/year expenses, the 8.5% flat-rate credit (${formatNZDPerYear(result.flatRateCreditAnnual)}) exceeds what you would recover as a registered seller (${formatNZDPerYear(result.inputTaxCreditAnnual)}). Registration would add admin, apportionment obligations, and deregistration clawback exposure — with no offsetting ongoing benefit. Stay on the flat-rate credit.`,
      stats: [
        { label: "Flat-rate credit (current)", value: formatNZDPerYear(result.flatRateCreditAnnual) },
        { label: "Input tax if registered",      value: formatNZDPerYear(result.inputTaxCreditAnnual) },
        { label: "Ongoing benefit of registering", value: formatNZDPerYear(result.ongoingBenefitAnnual) },
      ],
      consequences: [
        `✓ Expense ratio (${Math.round((result.annualExpenses / Math.max(result.annualIncome, 1)) * 100)}%) is below the ~56% break-even where registration overtakes flat-rate. Staying unregistered is optimal on the ongoing calculation.`,
        `The flat-rate credit of ${formatNZDPerYear(result.flatRateCreditAnnual)} is automatic — IRD passes it to you via the platform payment. No GST returns, no apportionment, no change-of-use adjustments.`,
        "Key watch-outs that would change this verdict: (a) expense ratio rises above ~56% — revisit; (b) you cross the $60,000 12-month threshold — mandatory registration triggers; (c) you plan a large asset purchase — one-off registration benefit may apply; (d) you start another taxable activity outside platforms — GST registration for that may drag in the platform income too.",
        "What counts toward the $60,000 threshold: ALL taxable activity including platform income. Platform income is still your income for GST threshold purposes even though the platform collects the GST. If you have multiple income streams, aggregate them.",
        "Platform reporting: from 1 April 2024, platforms collect 15% regardless of registration. You see this in your payment statements — the platform has already accounted for it. The 8.5% flat-rate credit shows up as a reconciling credit in your platform earnings.",
        "Income tax reminder: platform income is still taxable income. The flat-rate GST credit is a GST-only mechanism — it does not change your income tax obligation on net profit from platform activity.",
      ],
      confidence: "HIGH",
      confidenceNote: "Expense ratio below break-even with no big-purchase or threshold triggers — flat-rate is the clean path.",
      tier: 67,
      ctaLabel: "Get My Flat-Rate Optimisation Pack — $67 →",
      altTierLabel: "Planning a change? — $147 full strategy",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.decisionPath === "VOLUNTARY_REGISTER") {
    return {
      status: pathLabel,
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your expense ratio (${Math.round((result.annualExpenses / Math.max(result.annualIncome, 1)) * 100)}%) is above the ~56% break-even. Voluntary registration recovers ${formatNZDPerYear(result.inputTaxCreditAnnual)} of input tax versus the ${formatNZDPerYear(result.flatRateCreditAnnual)} flat-rate credit — an ongoing benefit of approximately ${formatNZDPerYear(result.ongoingBenefitAnnual)}. With a multi-year activity horizon and no significant retained-asset clawback risk, voluntary registration is net positive.`,
      stats: [
        { label: "Ongoing benefit",           value: formatNZDPerYear(result.ongoingBenefitAnnual), highlight: true },
        { label: "Input tax (if registered)", value: formatNZDPerYear(result.inputTaxCreditAnnual) },
        { label: "Flat-rate (current)",         value: formatNZDPerYear(result.flatRateCreditAnnual) },
      ],
      consequences: [
        `✓ Break-even passed: expenses of ${formatNZDPerYear(result.annualExpenses)} mean input tax credit of ${formatNZDPerYear(result.inputTaxCreditAnnual)} exceeds the 8.5% flat-rate of ${formatNZDPerYear(result.flatRateCreditAnnual)}.`,
        `✓ Activity horizon is multi-year — the cumulative benefit outweighs GST admin cost. Rough 3-year cumulative benefit: ${formatNZDPerYear(result.ongoingBenefitAnnual * 3)}.`,
        `✓ Retained-asset clawback risk is ${result.retainedAssets === "none" ? "absent" : result.retainedAssets === "small" ? "low — vehicle/equipment can be disposed of before deregistration" : "material — but on the stated horizon the ongoing benefit still dominates"}. Deregistration deemed-sale exposure on retained assets: ${formatNZD(result.deregistrationClawbackEstimate)}.`,
        "Mechanics of registration: (1) register via myIR; (2) provide your GST number to each platform (Airbnb, Uber, Bookabach — they have sections in your account for this); (3) platforms switch your listed services supply to zero-rated for YOUR return (the platform already accounted for the 15%); (4) you file 2-monthly or 6-monthly returns claiming input tax on costs; (5) IRD refunds the net input tax if your returns are in credit.",
        "Apportionment for mixed use: if any assets are used partly for private purposes (vehicle with personal use, home office, property with personal stays between Airbnb bookings), you can only claim the business-use proportion of GST. Keep logbooks (vehicle), occupancy records (property), and floor-area records (home office).",
        "Filing cadence: 2-monthly is standard for most sellers under $24M turnover. 6-monthly is available for turnover under $500k with IRD approval — worth considering if your expenses are lumpy rather than monthly.",
        "Exit planning: build a 'deregistration playbook' now — know which assets you will retain when you eventually stop, and their likely market values. This prevents surprise clawback when the day comes.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Ongoing benefit positive with multi-year horizon. Deregistration planning must be part of the registration decision — clawback exposure grows with each asset retained.",
      tier: 147,
      ctaLabel: "Get My Voluntary Registration Plan — $147 →",
      altTierLabel: "Just want the math? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.decisionPath === "THRESHOLD_REGISTER") {
    return {
      status: pathLabel,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Your annual platform income of ${formatNZD(result.annualIncome)} is at or over the $60,000 GST registration threshold. Registration is MANDATORY. You must register from the date your 12-month turnover reached $60k — late registration carries penalties. Once registered, your platform supply is zero-rated in your own return (platform has already accounted for 15%) and you claim input tax on costs.`,
      stats: [
        { label: "Annual income",             value: formatNZD(result.annualIncome),   highlight: true },
        { label: "Threshold",                   value: formatNZD(REGISTRATION_THRESHOLD), highlight: true },
        { label: "Ongoing benefit of registering", value: formatNZDPerYear(result.ongoingBenefitAnnual) },
      ],
      consequences: [
        `🔒 MANDATORY: 12-month turnover over $60,000 triggers compulsory GST registration under the GST Act 1985. Platform income counts toward this threshold even though the platform collects GST.`,
        `Registration effective date: from the date your 12-month turnover actually reached $60k — not from when you register. Late registration → back-filing of returns from the threshold-crossing date + penalties + interest.`,
        "Action sequence: (1) identify the exact date 12-month turnover crossed $60k — pull platform statements; (2) register via myIR with that date as effective registration date; (3) file all GST returns from that date forward; (4) notify each platform of your GST number; (5) engage a GST advisor if any returns must be back-filed — penalty/UOMI mitigation may require voluntary disclosure framing.",
        "On-registration adjustments: once registered, your platform supply is zero-rated in your own return (because the platform has already accounted for the 15% GST). You claim 15% input tax on all business costs. For the first return after registration, you may also claim GST on stock-on-hand and on business assets held at registration date (at their then market value, subject to specific rules).",
        "Apportionment from day one: if you have mixed-use assets (vehicle with personal use, home with Airbnb space), apportionment rules apply immediately. Keep records from registration date.",
        "Deregistration risk: now that you are registered, deregistration in future (falling below threshold + cancelling voluntarily) triggers a deemed sale of retained business assets at market value × 15%. For Airbnb hosts with property assets, this is the single largest watch-out. Plan exit treatment when you plan entry.",
      ],
      confidence: "HIGH",
      confidenceNote: "Mandatory registration — GST Act 1985. Threshold crossing date determines effective registration date and any required back-filing.",
      tier: 147,
      ctaLabel: "Get My Threshold-Triggered Registration Plan — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.decisionPath === "APPROACHING_THRESHOLD") {
    return {
      status: pathLabel,
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your annual platform income of ${formatNZD(result.annualIncome)} is within 20% of the $60,000 registration threshold. At current run-rate you will cross within 6-12 months. You can (a) voluntarily register now to capture ongoing benefit and avoid threshold scramble, or (b) wait and register precisely at the crossing date. Either way, register proactively — late registration triggers penalties and back-filing.`,
      stats: [
        { label: "Current annual income", value: formatNZD(result.annualIncome),   highlight: true },
        { label: "Threshold",              value: formatNZD(REGISTRATION_THRESHOLD), highlight: true },
        { label: "Ongoing benefit (if register)", value: formatNZDPerYear(result.ongoingBenefitAnnual) },
      ],
      consequences: [
        `⚠ You are approaching the $60,000 threshold. The relevant 12-month window is any rolling 12-month period — not strictly a tax year.`,
        `Registration strategies: (a) voluntary registration now — captures ongoing benefit immediately, avoids threshold scramble, sets up clean records from day one; (b) wait and register at crossing — minimises admin period, but you must accurately identify the crossing date and register within the IRD window (generally 21 days of knowing you will cross).`,
        `Ongoing benefit of registering: ${formatNZDPerYear(result.ongoingBenefitAnnual)}. ${result.ongoingBenefitAnnual > 0 ? "Positive — voluntary registration saves money starting immediately." : "Negative on current expenses — voluntary registration primarily buys threshold-crossing cleanliness rather than ongoing savings."}`,
        "Timing traps: (a) the 12-month window is rolling — a strong month can pull you over even if prior months were low; (b) platform income is deemed turnover for threshold purposes even though the platform collects GST; (c) once you cross, you must register from the crossing date — back-filing required if registration is delayed.",
        `Deregistration horizon check: if your activity horizon is short (under 2 years) AND you have retained assets, weigh the ongoing benefit against deregistration clawback exposure. Your retained-asset clawback estimate: ${formatNZD(result.deregistrationClawbackEstimate)}.`,
        "Practical action: engage an accountant this month to model the registration timing. Monthly turnover forecasts + expense mix + large purchase plans + exit horizon form the full decision. This is one of the highest-value conversations you can have in the next 90 days.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Threshold is rolling 12-month — exact crossing date determines registration timing. Voluntary registration before crossing is often the cleanest path.",
      tier: 147,
      ctaLabel: "Get My Threshold Timing Plan — $147 →",
      altTierLabel: "Just want the math? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.decisionPath === "REGISTER_BIG_PURCHASE") {
    return {
      status: pathLabel,
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `A planned large purchase creates a one-off GST recovery opportunity. On the purchase, you would recover ${formatNZD(result.bigPurchaseGst)} of input tax. That is typically several years' worth of flat-rate credit captured in a single GST period. Registering before the purchase (and planning the exit-side clawback) can be highly economic — but the mechanics must be right.`,
      stats: [
        { label: "One-off input tax on purchase", value: formatNZD(result.bigPurchaseGst),        highlight: true },
        { label: "Ongoing benefit / year",          value: formatNZDPerYear(result.ongoingBenefitAnnual) },
        { label: "Deregistration clawback est.",    value: formatNZD(result.deregistrationClawbackEstimate) },
      ],
      consequences: [
        `⚠ Register BEFORE the purchase settles. GST paid on a purchase made before your registration date is generally NOT recoverable. Typical sequence: register 1-2 GST periods before settlement to allow paperwork lag and GST number issuance.`,
        `One-off input tax recovery: ${formatNZD(result.bigPurchaseGst)} (15/115 of the GST-inclusive purchase price). For vehicles, equipment, fit-out — this is usually the single largest GST event in the seller's life.`,
        `Ongoing benefit alongside the one-off: ${formatNZDPerYear(result.ongoingBenefitAnnual)}. ${result.ongoingBenefitAnnual > 0 ? "Both sides are positive — registration is a clear win." : "Ongoing side is marginal — the big-purchase recovery is the primary value."}`,
        `Exit-side clawback: ${formatNZD(result.deregistrationClawbackEstimate)} is the rough deemed-sale GST if you deregister with the retained assets you have described. Plan disposal BEFORE deregistration wherever practical — sell assets separately (at market value, triggering GST at sale rather than at deregistration), or sell the business as a going concern (zero-rated if buyer is GST registered).`,
        "Mixed-use apportionment: if the purchase is partly for private use (e.g. a vehicle with personal use), only the business-use proportion of GST is claimable. Keep a logbook from day one. For a $50k vehicle with 70% business use, you claim 70% × $50k × (15/115) = $4,565 — not the full $6,522.",
        "Timing detail: the GST return that includes the purchase date is when you claim the input tax. If you are on 2-monthly returns and the purchase settles in the second month, the claim appears in that return. Consider filing frequency choice to align with expected cashflow.",
      ],
      confidence: "HIGH",
      confidenceNote: "Large asset purchase creates clear input tax recovery — registration MUST precede purchase settlement for the claim to be valid.",
      tier: 147,
      ctaLabel: "Get My Big-Purchase Registration Plan — $147 →",
      altTierLabel: "Just want the math? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.decisionPath === "DO_NOT_REGISTER_CLAWBACK") {
    return {
      status: pathLabel,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Short activity horizon combined with significant retained-asset exposure means voluntary registration would likely create a LARGER liability on exit than the cumulative benefit while registered. Estimated deregistration clawback on retained assets: ${formatNZD(result.deregistrationClawbackEstimate)}. Rough cumulative benefit over horizon: ${formatNZD(Math.max(0, result.ongoingBenefitAnnual) * (result.horizon === "under_1yr" ? 1 : 2))}. Do not register unless a specific trigger (threshold / big purchase) forces it.`,
      stats: [
        { label: "Deregistration clawback est.",          value: formatNZD(result.deregistrationClawbackEstimate), highlight: true },
        { label: "Cumulative reg. benefit over horizon",  value: formatNZD(Math.max(0, result.ongoingBenefitAnnual) * (result.horizon === "under_1yr" ? 1 : 2)) },
        { label: "Net of registering then deregistering", value: formatNZD(Math.max(0, result.ongoingBenefitAnnual) * (result.horizon === "under_1yr" ? 1 : 2) - result.deregistrationClawbackEstimate), highlight: true },
      ],
      consequences: [
        `🔒 Deregistration trigger: when you stop the taxable activity (or fall below the threshold and elect to deregister), IRD treats it as a deemed sale of retained business assets at market value. 15% GST applies. For property used in Airbnb activity, this is the single largest GST risk in the NZ system.`,
        `Estimated exposure on your retained assets: ${formatNZD(result.deregistrationClawbackEstimate)}. This is the GST that would crystallise if you deregister while holding ${result.retainedAssets === "significant" ? "a property-scale asset (Airbnb home, commercial property)" : "a retained business asset"}.`,
        `Horizon mismatch: your stated activity horizon of ${result.horizon === "under_1yr" ? "under 1 year" : "1-3 years"} means accumulated registration benefit (${formatNZD(Math.max(0, result.ongoingBenefitAnnual) * (result.horizon === "under_1yr" ? 1 : 2))}) is likely well below the deregistration exposure. The net of registering and then deregistering is negative.`,
        "Exceptions that flip this verdict: (a) turnover crosses $60k — mandatory registration regardless of clawback; (b) large asset purchase on the ingress side that exceeds the clawback estimate (rare for property-scale retained assets); (c) you can sell the retained asset separately at market value before deregistration — then GST applies on the sale transaction, which you're doing anyway; (d) the activity continues indefinitely and the deregistration event is so far in the future that present-value calculation flips.",
        "Alternative treatment pathways: (i) if the asset could be sold as part of a going concern to another GST-registered buyer, the transfer is zero-rated — no GST clawback; (ii) if you restructure the asset into a different entity before the activity stops, specific rollover rules may apply; (iii) if you continue as a registered seller until the asset is naturally sold at market, the clawback becomes a regular output tax on the sale rather than a deemed-sale event.",
        `Do not register on the strength of ongoing benefit alone until the exit-side clawback is planned. The ${formatNZD(result.deregistrationClawbackEstimate)} exposure dwarfs years of cumulative input tax recovery at your expense level.`,
      ],
      confidence: "MEDIUM",
      confidenceNote: "Deregistration clawback estimate is based on stated retained-asset value — actual exposure depends on market value at deregistration date and specific asset use.",
      tier: 147,
      ctaLabel: "Get My No-Register Strategy Pack — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ALREADY_REGISTERED_REVIEW
  return {
    status: pathLabel,
    statusClass: "text-emerald-700",
    panelClass: "border-emerald-200 bg-emerald-50",
    headline: `You are already GST registered. Focus areas: (a) confirm platform supply zero-rating is applied in your own return (platform has already accounted for 15%); (b) ensure apportionment rules are correctly applied to mixed-use assets; (c) plan exit treatment for retained assets before any deregistration; (d) check filing cadence matches your cashflow pattern.`,
    stats: [
      { label: "Input tax / year",                 value: formatNZDPerYear(result.inputTaxCreditAnnual) },
      { label: "Flat-rate equivalent foregone",     value: formatNZDPerYear(result.flatRateCreditAnnual) },
      { label: "Deregistration clawback estimate",  value: formatNZD(result.deregistrationClawbackEstimate) },
    ],
    consequences: [
      "✓ Already registered — focus on correct treatment rather than a register/don't-register decision.",
      "Platform supply zero-rating: since 1 April 2024, a GST-registered seller zero-rates the listed services supply in their own GST return — because the platform has already collected and returned 15%. This is frequently missed by sellers filing their own returns; a second 15% output tax on the platform income is a common error.",
      "Apportionment review: mixed-use assets (vehicle with personal use, home office, property with personal stays) must be apportioned. IRD apportionment methods: kilometres (vehicle), floor area (home), occupancy nights (property). Records to maintain: logbook / floor plan / booking calendar.",
      "Annual adjustment: at year-end, if an asset's use proportion has changed, an annual adjustment may be required. This is especially relevant for properties used partly for Airbnb and partly for private stays.",
      `Exit treatment planning: your retained-asset deregistration exposure is approximately ${formatNZD(result.deregistrationClawbackEstimate)}. If you ever plan to stop the activity, plan the disposal of retained assets FIRST — going concern sale to a registered buyer is zero-rated; private sale and deregistration triggers deemed sale at market value × 15%.`,
      `Filing cadence: currently 2-monthly is most common. If your expense pattern is lumpy (e.g. large purchases every few months), 2-monthly improves cashflow. If your net position is consistently in credit (refund), 2-monthly returns the refund faster than 6-monthly.`,
      "Year-end check: reconcile platform reports against your returns. The platform should be showing zero-rated supplies on your listed services income, and your input tax claims should reconcile to expense records.",
    ],
    confidence: "MEDIUM",
    confidenceNote: "Coverage review — primary risks are treatment errors (double-accounting the 15% GST, missing apportionment, surprise deregistration clawback) rather than the register/don't decision.",
    tier: 147,
    ctaLabel: "Get My Registration Coverage Audit — $147 →",
    altTierLabel: "Just want a status check? — $67 instead",
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
    id: "platform", step: 1, type: "button_group",
    label: "Which platform(s) do you earn income through?",
    subLabel: "From 1 April 2024, all listed-services platforms collect 15% GST on your behalf regardless of your registration status.",
    options: [
      { label: "Airbnb / Bookabach / Booking.com (short-stay)", value: "airbnb",         subLabel: "Short-stay accommodation" },
      { label: "Uber / Ola (rideshare)",                         value: "rideshare",      subLabel: "Ride-sharing services" },
      { label: "UberEats / DoorDash / Menulog",                  value: "food_delivery",  subLabel: "Food and beverage delivery" },
      { label: "Multiple of the above",                          value: "multi",          subLabel: "Mixed platform income" },
    ],
    required: true,
  },
  {
    id: "monthly_income", step: 2, type: "button_group",
    label: "What is your average monthly platform income?",
    subLabel: "Gross income before platform fees — this is the amount on which the platform calculates the 15% GST.",
    options: [
      { label: "Under $500/month",     value: "under_500", subLabel: "Well under threshold — low stakes" },
      { label: "$500 – $2,000/month",   value: "500_2k",    subLabel: "Up to $24k/year — under threshold" },
      { label: "$2,000 – $5,000/month", value: "2k_5k",     subLabel: "$24k-$60k/year — approaching threshold" },
      { label: "Over $5,000/month",     value: "over_5k",   subLabel: "Likely over $60k threshold" },
    ],
    required: true,
  },
  {
    id: "monthly_expenses", step: 3, type: "button_group",
    label: "What are your monthly business expenses (GST-inclusive)?",
    subLabel: "Include vehicle running costs, cleaning, supplies, repairs, insurance, platform fees. These are the expenses whose GST you could reclaim if registered.",
    options: [
      { label: "Under $200/month",     value: "under_200", subLabel: "Low expenses — flat-rate likely wins" },
      { label: "$200 – $1,000/month",   value: "200_1k",    subLabel: "Moderate — check break-even" },
      { label: "$1,000 – $3,000/month", value: "1k_3k",     subLabel: "Significant — likely above break-even" },
      { label: "Over $3,000/month",     value: "over_3k",   subLabel: "High — registration typically positive" },
    ],
    required: true,
  },
  {
    id: "current_status", step: 4, type: "button_group",
    label: "Are you currently GST registered?",
    subLabel: "Determines whether this is a register/don't-register decision or a coverage review.",
    options: [
      { label: "No — not registered",                       value: "not_registered",         subLabel: "Standard flat-rate credit seller" },
      { label: "Yes — voluntarily registered (under $60k)",  value: "registered_voluntary",  subLabel: "Registered but below threshold" },
      { label: "Yes — registered (over $60k threshold)",     value: "registered_threshold", subLabel: "Mandatorily registered" },
      { label: "Not sure",                                    value: "unsure",                 subLabel: "Verify in myIR before acting" },
    ],
    required: true,
  },
  {
    id: "big_purchase", step: 5, type: "button_group",
    label: "Any large business asset purchases planned in next 12 months?",
    subLabel: "A large purchase (vehicle, equipment, fit-out) creates one-off input tax recovery that can justify registration on its own.",
    options: [
      { label: "None planned",              value: "none",            subLabel: "No purchase-triggered registration" },
      { label: "Small ($5k – $15k)",         value: "small_5_15k",     subLabel: "Modest one-off benefit" },
      { label: "Mid ($15k – $50k)",           value: "mid_15_50k",      subLabel: "Substantial one-off recovery" },
      { label: "Large (over $50k)",          value: "large_over_50k",  subLabel: "Major purchase — register before settlement" },
    ],
    required: true,
  },
  {
    id: "horizon", step: 6, type: "button_group",
    label: "How long do you plan to continue this platform activity?",
    subLabel: "Horizon determines whether registration benefit accumulates enough to offset deregistration clawback when you eventually stop.",
    options: [
      { label: "Under 1 year",         value: "under_1yr",   subLabel: "Short — clawback dominates" },
      { label: "1 – 3 years",          value: "one_to_3yr",  subLabel: "Medium — depends on retained assets" },
      { label: "Multi-year / indefinite", value: "multi_year", subLabel: "Long — registration benefits accrue" },
    ],
    required: true,
  },
  {
    id: "retained_assets", step: 7, type: "button_group",
    label: "What business assets will you retain when you eventually stop?",
    subLabel: "On deregistration, IRD treats retained business assets as a deemed sale at market value — 15% GST clawback applies. This is the single largest watch-out.",
    options: [
      { label: "None / minimal (I will sell everything)",        value: "none",         subLabel: "No deregistration exposure" },
      { label: "Small assets (vehicle, equipment — under $50k)",  value: "small",        subLabel: "Manageable clawback" },
      { label: "Significant (property used for Airbnb)",          value: "significant", subLabel: "Major clawback risk — $100k+ possible" },
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

      {/* Five-path banner */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Five decision paths — GST Act 1985 marketplace rules (operative 1 April 2024)</p>
        <div className="space-y-1 text-neutral-800">
          <p><strong>A. Stay flat-rate:</strong> low expenses, 8.5% credit is optimal</p>
          <p><strong>B. Voluntary register:</strong> expenses over ~56% of income + multi-year horizon</p>
          <p><strong>C. Threshold-triggered ($60k):</strong> mandatory — 12-month turnover crosses $60,000</p>
          <p><strong>D. Register before big purchase:</strong> one-off 15% recovery on $15k+ asset</p>
          <p><strong>E. Do NOT register:</strong> short horizon + retained assets = deregistration clawback dominates</p>
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

      {/* 6.5% gap — always visible */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your 6.5% gap (at stated monthly income)</p>
        <div className="flex justify-between">
          <span className="text-neutral-700">Platform collects 15% GST on {formatNZD(verdict.result.monthlyIncome)}/month</span>
          <span className="font-mono text-neutral-950">{formatNZD(verdict.result.monthlyIncome * 0.15)}/month</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-neutral-700">Flat-rate credit (8.5%) back to you</span>
          <span className="font-mono text-emerald-700">{formatNZD(verdict.result.monthlyIncome * 0.085)}/month</span>
        </div>
        <div className="flex justify-between mt-1 pt-1 border-t border-neutral-200">
          <span className="text-neutral-700 font-semibold">Gap absorbed from your economics (6.5%)</span>
          <span className="font-mono text-red-700 font-bold">{formatNZD(verdict.result.monthlyIncome * 0.065)}/month · {formatNZD(verdict.result.monthlyIncome * 0.065 * 12)}/year</span>
        </div>
      </div>

      {/* Deregistration clawback warning — always visible when significant */}
      {verdict.result.deregistrationClawbackEstimate > 0 && (
        <div className={`mb-4 rounded-xl border-2 px-4 py-3 text-xs ${verdict.result.deregistrationClawbackEstimate > 50_000 ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}>
          <p className={`mb-1 font-mono text-[10px] uppercase tracking-widest ${verdict.result.deregistrationClawbackEstimate > 50_000 ? "text-red-700" : "text-amber-700"}`}>⚠ Deregistration clawback estimate (retained assets × 15%)</p>
          <p className={`${verdict.result.deregistrationClawbackEstimate > 50_000 ? "text-red-900" : "text-amber-900"} leading-relaxed`}>
            If you register and later deregister, retained business assets are treated as a deemed sale at market value — 15% GST applies. Your estimated exposure based on stated retained assets: <strong>{formatNZD(verdict.result.deregistrationClawbackEstimate)}</strong>. Plan exit treatment as part of the registration decision.
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
          <strong className="text-neutral-950">GST is already charged — the question is which path recovers or protects the most.</strong> From 1 April 2024, the platform takes 15% regardless. Your choice is between 8.5% automatic credit, voluntary full recovery with exit planning, mandatory registration, big-purchase timing, or deliberate non-registration to protect retained assets from deemed-sale clawback.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Which of the 5 paths applies — and why</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Break-even math at your exact expense ratio</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Deregistration clawback exposure if you register then stop</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Apportionment and filing cadence plan</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 accountant questions specific to your decision path</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} NZD · One-time · Built around your exact decision path</p>
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

export default function AppTaxGstSniperCalculator() {
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
        product_slug: "app-tax-gst-sniper",
        source_path: "/nz/check/app-tax-gst-sniper",
        country_code: "NZ", currency_code: "NZD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          decision_path: verdict.result.decisionPath,
          flat_rate_credit_annual: verdict.result.flatRateCreditAnnual,
          input_tax_credit_annual: verdict.result.inputTaxCreditAnnual,
          ongoing_benefit_annual: verdict.result.ongoingBenefitAnnual,
          deregistration_clawback_estimate: verdict.result.deregistrationClawbackEstimate,
          threshold_status: verdict.result.thresholdStatus,
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
      body: JSON.stringify({ email, source: "app_tax_gst_sniper", country_code: "NZ", site: "taxchecknow" }),
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
    const sid = sessionId || `gst_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("app-tax-gst-sniper_platform", String(answers.platform || ""));
    sessionStorage.setItem("app-tax-gst-sniper_monthly_income", String(answers.monthly_income || ""));
    sessionStorage.setItem("app-tax-gst-sniper_monthly_expenses", String(answers.monthly_expenses || ""));
    sessionStorage.setItem("app-tax-gst-sniper_current_status", String(answers.current_status || ""));
    sessionStorage.setItem("app-tax-gst-sniper_big_purchase", String(answers.big_purchase || ""));
    sessionStorage.setItem("app-tax-gst-sniper_horizon", String(answers.horizon || ""));
    sessionStorage.setItem("app-tax-gst-sniper_retained_assets", String(answers.retained_assets || ""));
    sessionStorage.setItem("app-tax-gst-sniper_decision_path", verdict.result.decisionPath);
    sessionStorage.setItem("app-tax-gst-sniper_ongoing_benefit_annual", String(Math.round(verdict.result.ongoingBenefitAnnual)));
    sessionStorage.setItem("app-tax-gst-sniper_deregistration_clawback_estimate", String(Math.round(verdict.result.deregistrationClawbackEstimate)));
    sessionStorage.setItem("app-tax-gst-sniper_threshold_status", verdict.result.thresholdStatus);
    sessionStorage.setItem("app-tax-gst-sniper_status", verdict.status);
    sessionStorage.setItem("app-tax-gst-sniper_tier", String(popupTier));

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
          success_url: `${window.location.origin}/nz/check/app-tax-gst-sniper/success/${successPath}`,
          cancel_url: `${window.location.origin}/nz/check/app-tax-gst-sniper`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your GST decision path analysis for your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your 5-path assessment by email — free.</p>
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
                    {popupTier === 67 ? "Your GST Decision Path Pack" : "Your GST Strategy + Exit-Planning Pack"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">IRD · GST Act 1985 · Operative 1 April 2024 · April 2026</p>
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
                      {popupTier === 67 ? "GST Decision Path Pack™" : "GST Strategy + Exit-Planning Pack™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your specific path (A-E), break-even math, 6.5% gap analysis, deregistration clawback exposure, and 5 accountant questions — built around your exact revenue, expenses, and activity horizon."
                        : "Full strategy: decision path + registration sequence + apportionment plan + filing cadence + deregistration exit planning + change-of-use analysis + retained-asset disposal strategy + accountant coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier} NZD</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic GST content. Your specific path and the exit-side clawback math most advisors miss.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Decision Path →" : "Get My GST Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the path? — $67 instead" : "Want the full strategy + exit plan? — $147 instead"}
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
                    { label: "Your role", key: "seller_role", options: [["airbnb_host","Airbnb / short-stay host"],["rideshare","Rideshare / delivery driver"],["multi_side_hustle","Multi-platform side hustle"],["advisor","Advisor assessing for client"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["big_purchase_imminent","Big purchase imminent"],["threshold_crossing","Approaching / crossing $60k"],["modelling","Modelling before deciding"]] },
                    { label: "Do you have an accountant?", key: "accountant", options: [["accountant","Yes — accountant"],["bookkeeper","Yes — bookkeeper"],["diy","Self-managed via myIR"],["none","No — need one"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · IRD-referenced content (operative 1 April 2024)</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile sticky bar */}
      {showVerdict && verdict && (verdict.result.decisionPath === "THRESHOLD_REGISTER" || verdict.result.decisionPath === "REGISTER_BIG_PURCHASE" || verdict.result.decisionPath === "DO_NOT_REGISTER_CLAWBACK") && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Decision path stakes</p>
              <p className="text-sm font-bold text-neutral-950">
                {verdict.result.decisionPath === "THRESHOLD_REGISTER" ? "Mandatory — register from $60k crossing date"
                : verdict.result.decisionPath === "REGISTER_BIG_PURCHASE" ? `${formatNZD(verdict.result.bigPurchaseGst)} one-off GST recovery`
                : `${formatNZD(verdict.result.deregistrationClawbackEstimate)} deregistration clawback risk`}
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
