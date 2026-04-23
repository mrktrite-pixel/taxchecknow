"use client";

/**
 * UK-04 — HMRC Side Income Declaration Engine (formerly Side Hustle Checker)
 * Pattern: A (StatusCheck — registered / must register / must amend) + G (ThresholdTest — £1k / £50,270)
 *
 * Core question: Does this person owe HMRC a declaration of side income,
 * and at what rate will it be taxed given their full income picture?
 *
 * Key facts (HMRC confirmed April 2026):
 *   Trading allowance: £1,000/year — below this, no declaration needed
 *   Above £1,000: must register for Self Assessment by 5 October following tax year
 *   Platform reporting (DAC7): since Jan 2024 eBay, Vinted, Etsy, Airbnb, Amazon,
 *     Fiverr, Upwork report seller income directly to HMRC
 *   Higher rate threshold: £50,270 — side income above this taxed at 40%
 *   Late filing penalty: £100 minimum, daily penalties after 3 months
 *   Deliberate non-disclosure: up to 100% of tax owed as penalty
 *   Legal anchors: ITTOIA 2005 · Platform Operators (Due Diligence and Reporting
 *     Requirements) Regulations 2023 (implementing DAC7)
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type DeclarationStatus =
  | "BELOW_THRESHOLD"        // under £1k — no action required
  | "MUST_REGISTER"          // over £1k + not registered
  | "MUST_AMEND"             // over £1k + registered but didn't declare
  | "DECLARED_CORRECTLY"     // over £1k + registered + declared
  | "AT_RISK_UNSURE";        // unclear registration status

interface SideIncomeResult {
  sideIncome: number;
  incomeBand: string;
  incomeType: string;
  saRegistration: string;
  higherRate: boolean | null;        // true/false/null (not_sure)
  declarationStatus: DeclarationStatus;
  effectiveTaxRate: number;          // 0, 0.20, or 0.40
  estimatedTax: number;              // gross tax on side income (excluding expenses)
  platformReporting: boolean;        // true if income type is platform-reported
  hobbyTradingAmbiguous: boolean;    // true if personal-items selling is unclear
  latePenaltyBase: number;           // £100 minimum
  interestRate: number;              // HMRC late payment interest
  deadlineIso: string;               // 5 Oct following last tax year
  deadlineLabel: string;
  daysToDeadline: number;
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
  result: SideIncomeResult;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — HMRC confirmed April 2026
// ─────────────────────────────────────────────────────────────────────────────

const TRADING_ALLOWANCE = 1000;
const HIGHER_RATE_THRESHOLD = 50270;
const BASIC_RATE = 0.20;
const HIGHER_RATE = 0.40;
const LATE_FILING_PENALTY_BASE = 100;
const HMRC_INTEREST_RATE = 0.075;      // approximate April 2026 late payment interest

const INCOME_MAP: Record<string, number> = {
  under_1k:     500,
  "1k_to_5k":   3000,
  "5k_to_10k":  7500,
  over_10k:     15000,
};

// 2025-26 tax year (ending 5 April 2026) registration deadline = 5 October 2026
const DEADLINE_ISO = "2026-10-05T23:59:59.000+01:00";
const DEADLINE_LABEL = "5 October 2026";

const PRODUCT_KEYS = {
  p67:  "uk_67_side_hustle_checker",
  p147: "uk_147_side_hustle_checker",
};

function formatGBP(n: number): string {
  return "£" + Math.round(n).toLocaleString("en-GB");
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

// ─────────────────────────────────────────────────────────────────────────────
// CALC ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcSideIncome(answers: AnswerMap): SideIncomeResult {
  const incomeBand     = String(answers.income_band || "1k_to_5k");
  const incomeType     = String(answers.income_type || "goods_online");
  const saRegistration = String(answers.sa_registration || "no_never");
  const totalIncomeBand = String(answers.total_income_band || "not_sure");

  const sideIncome = INCOME_MAP[incomeBand] ?? 3000;

  // Higher rate determination
  let higherRate: boolean | null;
  if (totalIncomeBand === "higher_rate") higherRate = true;
  else if (totalIncomeBand === "basic_rate") higherRate = false;
  else higherRate = null;  // not sure

  // Platform-reported? goods_online, property, freelance, multiple — all covered by DAC7
  const platformReporting = incomeType !== "other";

  // Hobby/trading ambiguity for goods_online at low volumes
  const hobbyTradingAmbiguous = incomeType === "goods_online" && sideIncome <= 5000;

  // Effective tax rate on side income
  let effectiveTaxRate = 0;
  if (sideIncome > TRADING_ALLOWANCE) {
    if (higherRate === true) effectiveTaxRate = HIGHER_RATE;
    else if (higherRate === false) effectiveTaxRate = BASIC_RATE;
    else effectiveTaxRate = BASIC_RATE;  // default to 20% when unsure
  }

  // Estimated tax on gross side income (simplified — ignores expenses)
  const estimatedTax = sideIncome > TRADING_ALLOWANCE
    ? (sideIncome - TRADING_ALLOWANCE) * effectiveTaxRate
    : 0;

  // Declaration status
  let declarationStatus: DeclarationStatus;
  if (sideIncome <= TRADING_ALLOWANCE) {
    declarationStatus = "BELOW_THRESHOLD";
  } else if (saRegistration === "yes_not_declared") {
    declarationStatus = "MUST_AMEND";
  } else if (saRegistration === "yes_declared") {
    declarationStatus = "DECLARED_CORRECTLY";
  } else if (saRegistration === "no_never") {
    declarationStatus = "MUST_REGISTER";
  } else {
    declarationStatus = "AT_RISK_UNSURE";
  }

  return {
    sideIncome,
    incomeBand,
    incomeType,
    saRegistration,
    higherRate,
    declarationStatus,
    effectiveTaxRate,
    estimatedTax,
    platformReporting,
    hobbyTradingAmbiguous,
    latePenaltyBase: LATE_FILING_PENALTY_BASE,
    interestRate: HMRC_INTEREST_RATE,
    deadlineIso: DEADLINE_ISO,
    deadlineLabel: DEADLINE_LABEL,
    daysToDeadline: daysUntil(DEADLINE_ISO),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcSideIncome(answers);

  // ── BELOW THRESHOLD — under £1,000 ────────────────────────────────────────
  if (result.declarationStatus === "BELOW_THRESHOLD") {
    return {
      status: "BELOW £1,000 — NO DECLARATION REQUIRED",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your side income of ${formatGBP(result.sideIncome)} is below the £1,000 trading allowance, so no declaration or Self Assessment registration is required for this tax year. The allowance is annual — if your income grows above £1,000 next year, registration becomes mandatory.${result.hobbyTradingAmbiguous ? " ⚠ However, if you are BUYING to resell (even at low value), HMRC treats this as trading from the first £ — check the hobby-vs-trading distinction." : ""}`,
      stats: [
        { label: "Your side income", value: formatGBP(result.sideIncome) },
        { label: "Trading allowance", value: formatGBP(TRADING_ALLOWANCE) },
        { label: "Declaration required", value: "No ✓" },
      ],
      consequences: [
        `Your side income of ${formatGBP(result.sideIncome)} is below the £1,000 trading allowance (ITTOIA 2005 s783A). No Self Assessment registration or declaration required for this tax year.`,
        "The allowance covers total trading income — not per platform. If you have £500 on eBay + £400 on Vinted + £200 on Etsy = £1,100 total, you are OVER the threshold and must register.",
        `Watch for growth: if your side income grows above £1,000 next year, you must register for Self Assessment by 5 October following the tax year (${result.deadlineLabel} for 2025-26).`,
        result.hobbyTradingAmbiguous ? "⚠ Hobby vs trading test: if you BUY items specifically to resell at profit, HMRC treats this as trading from £0 — the £1,000 allowance does not apply to trading activity with commercial intent, only to casual sales of personal items. If in doubt, declare anyway to avoid penalties." : "Your income type is clearly trading/service-based — the £1,000 allowance applies cleanly at this level.",
        "Platform data still flows to HMRC under DAC7 regardless of amount — HMRC has the data. Small sellers under £1,000 are not audit priorities but are visible.",
      ],
      confidence: "HIGH",
      confidenceNote: "Trading allowance of £1,000 is statutory under ITTOIA 2005 s783A. Confirmed April 2026.",
      tier: 67,
      ctaLabel: "Show My Position — £67 →",
      altTierLabel: "Want the full guide too? — £147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── MUST AMEND — over £1k + registered but not declared ──────────────────
  if (result.declarationStatus === "MUST_AMEND") {
    const higherRateNote = result.higherRate === true
      ? ` At higher rate (40%), tax owed on ${formatGBP(result.sideIncome - TRADING_ALLOWANCE)} taxable portion is approximately ${formatGBP(result.estimatedTax)}.`
      : result.higherRate === false
      ? ` At basic rate (20%), tax owed on ${formatGBP(result.sideIncome - TRADING_ALLOWANCE)} taxable portion is approximately ${formatGBP(result.estimatedTax)}.`
      : ` Tax rate depends on your full income picture — could be 20% or 40% on the ${formatGBP(result.sideIncome - TRADING_ALLOWANCE)} taxable portion.`;

    return {
      status: "MUST AMEND RETURN — HMRC MAY ALREADY HAVE THIS DATA",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `You are registered for Self Assessment but did not declare ${formatGBP(result.sideIncome)} of side income. HMRC receives platform data automatically under DAC7 since January 2024 — a nudge letter may already be in the post.${higherRateNote} Voluntary disclosure before HMRC opens a case significantly reduces penalties.`,
      stats: [
        { label: "Undeclared income", value: formatGBP(result.sideIncome), highlight: true },
        { label: "Estimated tax owed", value: formatGBP(result.estimatedTax), highlight: true },
        { label: "Min late penalty", value: formatGBP(result.latePenaltyBase), highlight: true },
      ],
      consequences: [
        `🔒 You did not declare ${formatGBP(result.sideIncome)} of side income. HMRC has this data from the platform reporting under DAC7 (Platform Operators Regulations 2023). Cross-referencing against your return is automated.`,
        `🔒 Tax exposure: ${formatGBP(result.estimatedTax)} on the ${formatGBP(result.sideIncome - TRADING_ALLOWANCE)} taxable portion (after £1,000 allowance) at ${(result.effectiveTaxRate * 100).toFixed(0)}% marginal rate. Plus interest at ~${(result.interestRate * 100).toFixed(1)}%/year from original due date.`,
        `🔒 Penalty regime: £${result.latePenaltyBase} minimum for late filing / omission. Up to 30% of tax owed if careless. Up to 70% if deliberate but not concealed. Up to 100% if deliberate AND concealed.`,
        "🔓 Voluntary disclosure path: amend your return via your SA account OR make an unprompted disclosure via HMRC's Let Property Campaign (landlords) or Digital Disclosure Service (others). Unprompted disclosure typically reduces penalties by 30-50% vs HMRC-initiated cases.",
        result.platformReporting ? `Platform-reported income is HIGH risk. Your income type (${result.incomeType.replace(/_/g, " ")}) is covered by DAC7 reporting — HMRC received your figures directly from the platform operator.` : "Non-platform income is LESS VISIBLE to HMRC but still declarable — the obligation is yours regardless of whether HMRC has the data yet.",
        `Timeline: amendments to the 2024-25 SA return can be made until 31 January 2027 (one year after filing deadline). After that, you need the formal disclosure route.`,
      ],
      confidence: "HIGH",
      confidenceNote: "Failure to declare known income is a substantive Self Assessment compliance failure. DAC7 platform reporting since January 2024 means HMRC has platform data for the past 2 tax years.",
      tier: 147,
      ctaLabel: "Get My Voluntary Disclosure Plan — £147 →",
      altTierLabel: "Just want the exposure audit? — £67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── MUST REGISTER — over £1k + not registered ────────────────────────────
  if (result.declarationStatus === "MUST_REGISTER") {
    const higherRateNote = result.higherRate === true
      ? ` At higher rate (40%), tax owed on the ${formatGBP(result.sideIncome - TRADING_ALLOWANCE)} taxable portion is approximately ${formatGBP(result.estimatedTax)}.`
      : result.higherRate === false
      ? ` At basic rate (20%), tax owed on the ${formatGBP(result.sideIncome - TRADING_ALLOWANCE)} taxable portion is approximately ${formatGBP(result.estimatedTax)}.`
      : ` Tax rate depends on your full income — 20% if total under £50,270, 40% above.`;

    return {
      status: "MUST REGISTER FOR SELF ASSESSMENT — DEADLINE 5 OCTOBER",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `You must register for Self Assessment and declare ${formatGBP(result.sideIncome)} of side income. Registration deadline: ${result.deadlineLabel} (${result.daysToDeadline} days away). HMRC receives your platform data automatically under DAC7 — they know about the income.${higherRateNote}`,
      stats: [
        { label: "Side income to declare", value: formatGBP(result.sideIncome), highlight: true },
        { label: "Registration deadline", value: result.deadlineLabel, highlight: true },
        { label: "Estimated tax owed", value: formatGBP(result.estimatedTax), highlight: true },
      ],
      consequences: [
        `🔒 Registration is MANDATORY above the £1,000 trading allowance (ITTOIA 2005 s7). You must register for Self Assessment by 5 October following the tax year in which you earned the income.`,
        `🔒 For 2025-26 tax year (ending 5 April 2026), registration deadline is ${result.deadlineLabel}. Miss it = £${result.latePenaltyBase} minimum penalty. Further penalties accumulate if income remains undeclared.`,
        `Tax exposure: approximately ${formatGBP(result.estimatedTax)} on the ${formatGBP(result.sideIncome - TRADING_ALLOWANCE)} taxable portion (after £1,000 allowance) at ${(result.effectiveTaxRate * 100).toFixed(0)}% rate.`,
        result.platformReporting ? `🔒 Your income type (${result.incomeType.replace(/_/g, " ")}) is covered by DAC7 platform reporting — HMRC already has the data. Self Assessment registration is the compliant response.` : "Your income is not platform-reported, but the obligation to register and declare still applies.",
        "Registration process: GOV.UK online form. Usually 2-3 weeks for HMRC to issue UTR number. Then file by 31 January following the tax year (online) or 31 October (paper).",
        result.hobbyTradingAmbiguous ? "⚠ If you are uncertain whether your activity is 'trading' or 'hobby selling personal items': HMRC's test is INTENT + PATTERN. Buying to resell = trading. Selling your own used items occasionally = usually not. If you buy anything to resell in your activity, register." : "Your income type is clearly trading — the £1,000 allowance applies, then full taxation above that.",
      ],
      confidence: "HIGH",
      confidenceNote: "Self Assessment registration above £1,000 trading allowance is statutory under ITTOIA 2005 and TMA 1970 s7. Penalty for late notification is automatic.",
      tier: 147,
      ctaLabel: "Get My Registration and Disclosure Plan — £147 →",
      altTierLabel: "Just want the audit? — £67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── DECLARED CORRECTLY — registered and declared ─────────────────────────
  if (result.declarationStatus === "DECLARED_CORRECTLY") {
    const higherRateNote = result.higherRate === true
      ? ` Check your tax calculation: at 40% marginal rate, tax on the ${formatGBP(result.sideIncome - TRADING_ALLOWANCE)} taxable portion is approximately ${formatGBP(result.estimatedTax)} — many people assume 20% and underpay.`
      : result.higherRate === false
      ? ` At 20% basic rate, tax on the taxable portion is approximately ${formatGBP(result.estimatedTax)}.`
      : ` Your rate depends on full income — verify which rate HMRC applied.`;

    return {
      status: "DECLARED — VERIFY RATE AND OPTIMISE",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `You declared your side income — compliance confirmed. ${higherRateNote} Next steps: review expense deductions to minimise tax, and plan for next year's declaration.`,
      stats: [
        { label: "Declared income", value: formatGBP(result.sideIncome) },
        { label: "Tax rate applied", value: `${(result.effectiveTaxRate * 100).toFixed(0)}% marginal` },
        { label: "Estimated tax", value: formatGBP(result.estimatedTax) },
      ],
      consequences: [
        `✓ You declared ${formatGBP(result.sideIncome)} of side income on your Self Assessment return. You are compliant with the declaration obligation under ITTOIA 2005.`,
        `Tax rate verification: at ${(result.effectiveTaxRate * 100).toFixed(0)}%, tax on your ${formatGBP(result.sideIncome - TRADING_ALLOWANCE)} taxable portion is approximately ${formatGBP(result.estimatedTax)}. Check your SA calculation to confirm HMRC applied the correct rate.`,
        "Expense optimisation: you can deduct allowable business expenses from gross side income before tax. Common deductions: platform fees, shipping costs, cost of goods, home office (£6/week without receipts), mileage, phone/internet pro-rata.",
        "Alternative: choose the £1,000 trading allowance INSTEAD of deducting expenses — whichever gives lower tax. If your expenses are under £1,000, take the trading allowance; above that, itemise.",
        "Next year planning: consider timing of sales, advance-purchase of stock, and pension contributions to reduce overall tax. If total income is close to £50,270 threshold, pension contributions can prevent 40% rate applying to side income.",
      ],
      confidence: "HIGH",
      confidenceNote: "Declared income position is verifiable from SA records. Tax rate verification depends on full income picture.",
      tier: 67,
      ctaLabel: "Get My Optimisation Review — £67 →",
      altTierLabel: "Want the full tax strategy too? — £147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── AT RISK — unclear registration status ────────────────────────────────
  return {
    status: "AT RISK — REGISTRATION STATUS UNCLEAR",
    statusClass: "text-amber-700",
    panelClass: "border-amber-200 bg-amber-50",
    headline: `You are not sure whether you are registered for Self Assessment or whether this income has been declared. Over the £1,000 threshold with ${formatGBP(result.sideIncome)} of side income, this uncertainty IS a compliance risk — HMRC has the platform data and expects a matching declaration.`,
    stats: [
      { label: "Side income", value: formatGBP(result.sideIncome), highlight: true },
      { label: "Status", value: "Unclear", highlight: true },
      { label: "Deadline to resolve", value: result.deadlineLabel },
    ],
    consequences: [
      `⚠ Side income of ${formatGBP(result.sideIncome)} is over the £1,000 trading allowance — registration and declaration are mandatory.`,
      "Check your registration status: log in to your HMRC online account (gov.uk/sign-in). If you have a UTR (Unique Taxpayer Reference) number, you are registered. If not, you need to register.",
      "Check your recent Self Assessment returns: if you filed one and included this side income, you are compliant. If you filed but did not include the income, you need to amend. If you never filed, you need to register + declare.",
      "Platform data: HMRC has received your figures from eBay/Etsy/Vinted/Airbnb/etc. since January 2024 under DAC7. Nudge letters may have been sent — check your email and post from HMRC.",
      `Timeline risk: ${result.daysToDeadline} days until ${result.deadlineLabel} registration deadline for 2025-26 tax year. Clarify status NOW.`,
    ],
    confidence: "MEDIUM",
    confidenceNote: "Status must be confirmed from HMRC records before specific action path can be determined. The uncertainty itself is the risk.",
    tier: 147,
    ctaLabel: "Get My Status Clarification Plan — £147 →",
    altTierLabel: "Just want the overview? — £67 instead",
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
    id: "income_band", step: 1, type: "button_group",
    label: "What was your total side income last tax year (all sources combined)?",
    subLabel: "Gross income before expenses. Combine all platforms and activities — the £1,000 allowance is a single threshold, not per platform.",
    options: [
      { label: "Under £1,000",         value: "under_1k",     subLabel: "Below trading allowance — no declaration" },
      { label: "£1,000–£5,000",         value: "1k_to_5k",    subLabel: "Mandatory registration and declaration" },
      { label: "£5,000–£10,000",        value: "5k_to_10k",   subLabel: "Meaningful tax owed — full SA required" },
      { label: "Over £10,000",          value: "over_10k",    subLabel: "Substantial income — likely higher rate" },
    ],
    required: true,
  },
  {
    id: "income_type", step: 2, type: "button_group",
    label: "What type of side income?",
    subLabel: "Platform-reported income (DAC7) is visible to HMRC automatically since January 2024.",
    options: [
      { label: "Selling goods online (eBay, Vinted, Etsy, Amazon)",     value: "goods_online",     subLabel: "DAC7-reported — HMRC has data" },
      { label: "Renting property or rooms (Airbnb, SpareRoom)",           value: "property_rental",   subLabel: "DAC7-reported + separate rental allowance" },
      { label: "Freelance / consulting / gig work (Fiverr, Upwork, Uber)", value: "freelance_gig",    subLabel: "DAC7-reported for platform work" },
      { label: "Multiple types combined",                                 value: "multiple",          subLabel: "All sources aggregate for threshold" },
    ],
    required: true,
  },
  {
    id: "sa_registration", step: 3, type: "button_group",
    label: "Are you already registered for Self Assessment?",
    subLabel: "Registration status determines whether you need to REGISTER + DECLARE or just AMEND a prior return.",
    options: [
      { label: "Yes — and I declared this income",             value: "yes_declared",      subLabel: "Compliant — verify rate and expenses" },
      { label: "Yes — but I did not declare this income",       value: "yes_not_declared",  subLabel: "Amend return — voluntary disclosure" },
      { label: "No — never registered",                         value: "no_never",          subLabel: "Must register by 5 October deadline" },
      { label: "Not sure",                                      value: "not_sure",          subLabel: "Check HMRC account urgently" },
    ],
    required: true,
  },
  {
    id: "total_income_band", step: 4, type: "button_group",
    label: "Is your total income (employment + side) over £50,270?",
    subLabel: "Above £50,270 the marginal tax on side income is 40% (not 20%). Most people incorrectly assume 20%.",
    options: [
      { label: "Yes — already a higher rate taxpayer",          value: "higher_rate",   subLabel: "Side income taxed at 40%" },
      { label: "No — basic rate taxpayer",                      value: "basic_rate",    subLabel: "Side income taxed at 20%" },
      { label: "Not sure — need to check",                      value: "not_sure",      subLabel: "Rate depends on full picture" },
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

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Side income math breakdown */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your declaration position</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Side income (gross)</span>
            <span className="font-mono font-bold text-neutral-950">{formatGBP(verdict.result.sideIncome)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Trading allowance</span>
            <span className="font-mono text-neutral-950">− {formatGBP(TRADING_ALLOWANCE)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Taxable portion (before expenses)</span>
            <span className="font-mono font-bold text-neutral-950">{formatGBP(Math.max(0, verdict.result.sideIncome - TRADING_ALLOWANCE))}</span>
          </div>
          {verdict.result.effectiveTaxRate > 0 && (
            <>
              <div className="flex justify-between border-b border-neutral-100 pb-1">
                <span className="text-neutral-600">Marginal tax rate</span>
                <span className="font-mono text-red-700">{(verdict.result.effectiveTaxRate * 100).toFixed(0)}%{verdict.result.higherRate === null ? " (estimated)" : ""}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-100 pb-1">
                <span className="text-neutral-600">Estimated tax owed</span>
                <span className="font-mono font-bold text-red-700">{formatGBP(verdict.result.estimatedTax)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Platform reporting (DAC7)</span>
            <span className={`font-mono ${verdict.result.platformReporting ? "text-red-700 font-bold" : "text-neutral-950"}`}>
              {verdict.result.platformReporting ? "Yes — HMRC has data" : "No"}
            </span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="font-semibold text-neutral-800">Registration deadline (2025-26 tax year)</span>
            <span className="font-mono font-bold text-neutral-950">{verdict.result.deadlineLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-neutral-800">Days until deadline</span>
            <span className={`font-mono font-bold ${verdict.result.daysToDeadline < 60 ? "text-red-700" : "text-neutral-950"}`}>{verdict.result.daysToDeadline} days</span>
          </div>
        </div>
      </div>

      {/* Fear framing */}
      {(verdict.result.declarationStatus === "MUST_AMEND" || verdict.result.declarationStatus === "MUST_REGISTER") && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ What HMRC already has on you</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-1">
            Since January 2024, platforms report seller income to HMRC automatically under DAC7.
          </p>
          <p className="text-xs text-red-800 leading-relaxed">
            If you sold over 30 items or earned over €2,000 (approximately £1,700) on a platform in 2024, your data has already been shared with HMRC. Penalties: £{verdict.result.latePenaltyBase} minimum for late notification. Up to 100% of tax owed if deliberate non-disclosure. Voluntary disclosure before HMRC opens a case typically reduces penalties by 30-50%.
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
          <strong className="text-neutral-950">Platform reporting is live.</strong> HMRC has been receiving your eBay, Etsy, Vinted, Airbnb, Amazon, Fiverr, and Upwork data directly since 1 January 2024. The data-matching to Self Assessment records is automated. Most people who haven&apos;t declared do not know this yet.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your exact declaration requirement (register, amend, or confirm)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Tax rate verification — 20% or 40% based on your full income</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Voluntary disclosure path if undeclared — reduces penalties</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Expense deduction list for your income type</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 accountant questions — written for your specific situation</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">£{verdict.tier} · One-time · Built around your declaration status and tax rate</p>
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

export default function SideHustleCheckerCalculator() {
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
        product_slug: "side-hustle-checker",
        source_path: "/uk/check/side-hustle-checker",
        country_code: "UK", currency_code: "GBP", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          declaration_status: verdict.result.declarationStatus,
          side_income: verdict.result.sideIncome,
          effective_tax_rate: verdict.result.effectiveTaxRate,
          estimated_tax: verdict.result.estimatedTax,
          platform_reporting: verdict.result.platformReporting,
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
      body: JSON.stringify({ email, source: "side_hustle_checker", country_code: "UK", site: "taxchecknow" }),
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
    const sid = sessionId || `sh_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("side-hustle-checker_income_band", String(answers.income_band || ""));
    sessionStorage.setItem("side-hustle-checker_income_type", String(answers.income_type || ""));
    sessionStorage.setItem("side-hustle-checker_sa_registration", String(answers.sa_registration || ""));
    sessionStorage.setItem("side-hustle-checker_total_income_band", String(answers.total_income_band || ""));
    sessionStorage.setItem("side-hustle-checker_declaration_status", verdict.result.declarationStatus);
    sessionStorage.setItem("side-hustle-checker_side_income", String(Math.round(verdict.result.sideIncome)));
    sessionStorage.setItem("side-hustle-checker_effective_tax_rate", String(verdict.result.effectiveTaxRate));
    sessionStorage.setItem("side-hustle-checker_estimated_tax", String(Math.round(verdict.result.estimatedTax)));
    sessionStorage.setItem("side-hustle-checker_status", verdict.status);
    sessionStorage.setItem("side-hustle-checker_tier", String(popupTier));

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
          success_url: `${window.location.origin}/uk/check/side-hustle-checker/success/${successPath}`,
          cancel_url: `${window.location.origin}/uk/check/side-hustle-checker`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your declaration position and tax estimate.</p>
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
                    {popupTier === 67 ? "Your Side Income Audit Pack" : "Your Disclosure and Compliance Plan"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">HMRC-referenced · ITTOIA 2005 · DAC7 2024 · April 2026</p>
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
                      {popupTier === 67 ? "Side Income Audit Pack™" : "Disclosure and Compliance Plan™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your exact declaration position, tax rate verification, voluntary disclosure options if needed, expense deduction list for your income type, and 5 accountant questions — built around your registration status and income band."
                        : "Full disclosure plan: registration or amendment path, voluntary disclosure strategy to minimise penalties, expense optimisation, multi-year compliance plan, and accountant coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">£{popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic side hustle tax guide. Your exact declaration position and tax math.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Declaration Position →" : "Get My Disclosure Plan →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the audit? — £67 instead" : "Want the full disclosure plan? — £147 instead"}
                    </button>
                  </p>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">3 quick questions then pay</p>
                    <p className="font-serif text-lg font-bold text-neutral-950">£{popupTier}</p>
                  </div>
                  {[
                    { label: "Employment type", key: "entity_type", options: [["employee","Employee (PAYE main job)"],["self_employed","Self-employed / sole trader"],["director","Company director with side hustle"],["none","No main job — side income only"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["acting_now","Acting before 5 October deadline"],["planning","Planning 6 months out"],["just_checking","Just checking my position"]] },
                    { label: "Do you have an accountant?", key: "accountant", options: [["accountant","Yes — accountant"],["online_service","Online tax service"],["none","No — managing myself"]] },
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
                    {loading ? "Redirecting to Stripe…" : `Pay £${popupTier} →`}
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · HMRC-sourced content</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile sticky bar */}
      {showVerdict && verdict && (verdict.result.declarationStatus === "MUST_AMEND" || verdict.result.declarationStatus === "MUST_REGISTER") && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Estimated tax owed</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatGBP(verdict.result.estimatedTax)} + £{verdict.result.latePenaltyBase}+ penalty
              </p>
            </div>
            <button onClick={() => openPopup(verdict.tier)}
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white whitespace-nowrap">
              From £67 →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
