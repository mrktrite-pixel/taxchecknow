"use client";

/**
 * US-02 — FEIE Qualification & Failure Risk Engine (formerly FEIE Nomad Auditor)
 * Pattern: D (GateTest — sequential qualification gates)
 *
 * Core question: Does this US citizen / resident alien qualify for FEIE under §911,
 * and what is the exposure if they fail or haven't elected correctly?
 *
 * Key facts (IRS confirmed April 2026):
 *   FEIE 2026 exclusion amount: $126,500 (indexed annually)
 *   Physical Presence Test: 330 full days in foreign countries in any 12-month period
 *     (NOT calendar year) — all-or-nothing, no partial exclusion
 *   Bona Fide Residence Test: established foreign residence for uninterrupted period
 *     including a full tax year
 *   Tax home requirement: main place of business / employment abroad
 *   Election: must file Form 2555 annually — NOT automatic
 *   Earned income only: wages, salary, net SE income from services performed abroad
 *   Excluded from FEIE: dividends, interest, capital gains, rental income, crypto
 *   Filing required regardless — US citizens file worldwide income
 *   Legal anchor: IRC §911, Treas. Reg. §1.911
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type QualificationStatus =
  | "QUALIFIED"
  | "QUALIFIED_PASSIVE_FLAG"
  | "AT_RISK_DAYS"
  | "AT_RISK_BONA_FIDE"
  | "FAIL_NO_TAX_HOME"
  | "FAIL_DAYS"
  | "FAIL_NO_RESIDENCE"
  | "NO_FORM_2555"
  | "UNCLEAR_TEST"
  | "UNCLEAR_DAYS";

interface FeieResult {
  taxHome: string;
  qualificationTest: string;
  daysAbroad: string;
  foreignResidence: string;
  incomeType: string;
  form2555Status: string;

  status: QualificationStatus;
  feieAmount: number;                 // $126,500 (2026)
  assumedIncome: number;              // $120,000 illustrative
  effectiveTaxRate: number;           // ~18% for illustrative
  taxIfFeieFails: number;             // federal tax if exclusion disallowed
  hasPassiveIncome: boolean;          // income type includes passive
  priorYearRisk: boolean;             // didn't file Form 2555 correctly
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
  result: FeieResult;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const FEIE_2026 = 126500;
const ILLUSTRATIVE_INCOME = 120000;
const EFFECTIVE_TAX_RATE = 0.18;   // approximate single-filer federal rate on $120k
const PRODUCT_KEYS = {
  p67:  "us_67_feie_nomad_auditor",
  p147: "us_147_feie_nomad_auditor",
};

function formatUSD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

// ─────────────────────────────────────────────────────────────────────────────
// CALC ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcFeie(answers: AnswerMap): FeieResult {
  const taxHome            = String(answers.tax_home || "yes_foreign");
  const qualificationTest  = String(answers.qualification_test || "physical_presence");
  const daysAbroad         = String(answers.days_abroad || "not_sure");
  const foreignResidence   = String(answers.foreign_residence || "yes_established");
  const incomeType         = String(answers.income_type || "wages");
  const form2555Status     = String(answers.form_2555 || "yes_filed");

  const hasPassiveIncome = incomeType === "mixed_earned_passive" || incomeType === "primarily_passive";
  const taxIfFeieFails = ILLUSTRATIVE_INCOME * EFFECTIVE_TAX_RATE;

  // Determine status via gate sequence
  let status: QualificationStatus = "QUALIFIED";

  // Gate 1: tax home
  if (taxHome === "no_us_based") {
    status = "FAIL_NO_TAX_HOME";
  }
  // Gate 2: Form 2555 filed?
  else if (form2555Status === "no_assumed_automatic" || form2555Status === "no_no_return") {
    status = "NO_FORM_2555";
  }
  // Gate 3: qualification test clarity
  else if (qualificationTest === "not_sure") {
    status = "UNCLEAR_TEST";
  }
  // Gate 4a: physical presence
  else if (qualificationTest === "physical_presence") {
    if (daysAbroad === "under_300") status = "FAIL_DAYS";
    else if (daysAbroad === "300_to_329") status = "AT_RISK_DAYS";
    else if (daysAbroad === "not_sure") status = "UNCLEAR_DAYS";
    else status = hasPassiveIncome ? "QUALIFIED_PASSIVE_FLAG" : "QUALIFIED";
  }
  // Gate 4b: bona fide residence
  else if (qualificationTest === "bona_fide") {
    if (foreignResidence === "no_nomadic") status = "FAIL_NO_RESIDENCE";
    else if (foreignResidence === "partial") status = "AT_RISK_BONA_FIDE";
    else status = hasPassiveIncome ? "QUALIFIED_PASSIVE_FLAG" : "QUALIFIED";
  }

  const priorYearRisk = form2555Status === "no_assumed_automatic" || form2555Status === "accountant_unsure";

  return {
    taxHome,
    qualificationTest,
    daysAbroad,
    foreignResidence,
    incomeType,
    form2555Status,
    status,
    feieAmount: FEIE_2026,
    assumedIncome: ILLUSTRATIVE_INCOME,
    effectiveTaxRate: EFFECTIVE_TAX_RATE,
    taxIfFeieFails,
    hasPassiveIncome,
    priorYearRisk,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcFeie(answers);

  // ── FAIL: No tax home ─────────────────────────────────────────────────────
  if (result.status === "FAIL_NO_TAX_HOME") {
    return {
      status: "FAIL — NO FOREIGN TAX HOME",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `You indicated you are based in the US, not a foreign country. FEIE under IRC §911 requires a tax home in a foreign country — not just US citizenship and foreign travel. Without a foreign tax home, you cannot claim the exclusion regardless of how many days you spend abroad. Your foreign-earned income is fully subject to US federal tax. At ${formatUSD(result.assumedIncome)} illustrative earnings, that is approximately ${formatUSD(result.taxIfFeieFails)} of federal tax.`,
      stats: [
        { label: "FEIE status", value: "NOT ELIGIBLE", highlight: true },
        { label: "Tax home", value: "US-based" },
        { label: "Tax if FEIE fails", value: formatUSD(result.taxIfFeieFails), highlight: true },
      ],
      consequences: [
        "🔒 FEIE requires your TAX HOME to be in a foreign country (IRC §911(d)(3)). Tax home is generally where your main place of business or employment is. US citizens who work remotely from the US but travel abroad do not have a foreign tax home.",
        "🔒 If you have been filing Form 2555 claiming FEIE without a foreign tax home, those returns are incorrect. IRS examination risk applies — the exclusion can be disallowed, foreign income becomes taxable, and accuracy-related penalties may apply.",
        "Alternative: Foreign Tax Credit (Form 1116). If you paid foreign income tax on foreign-sourced income, you may be able to claim a FTC against US tax on the same income. This is an alternative to FEIE, not a duplicate.",
        "To qualify for FEIE going forward: (a) relocate your main place of business / employment to a foreign country, (b) meet physical presence (330 days) or bona fide residence test, (c) elect FEIE via Form 2555 annually.",
        `Prior year exposure: if FEIE was claimed incorrectly, amended returns (Form 1040X) may be required. Penalties and interest accrue from original filing dates. The IRS has 3 years to examine returns (6 if understatement exceeds 25% of gross income).`,
      ],
      confidence: "HIGH",
      confidenceNote: "Tax home requirement is statutory under IRC §911(d)(3). Without foreign tax home, FEIE is definitively unavailable.",
      tier: 147,
      ctaLabel: "Get My FEIE Failure Recovery Plan — $147 →",
      altTierLabel: "Just want the audit? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── NO FORM 2555 ──────────────────────────────────────────────────────────
  if (result.status === "NO_FORM_2555") {
    return {
      status: "FEIE NOT CLAIMED — NO FORM 2555 FILED",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `FEIE is not automatic. Without a filed Form 2555, the exclusion was not claimed — your foreign earned income was fully taxable. At ${formatUSD(result.assumedIncome)} illustrative income, you may have paid approximately ${formatUSD(result.taxIfFeieFails)} in federal tax that could have been excluded. Prior year returns may need amendment.${result.form2555Status === "no_no_return" ? " Worse: if you did not file a US return at all, you have a compliance obligation regardless of FEIE." : ""}`,
      stats: [
        { label: "FEIE claimed", value: "NO — Form 2555 missing", highlight: true },
        { label: "Tax paid (unnecessary)", value: formatUSD(result.taxIfFeieFails), highlight: true },
        { label: "Amendment window", value: "3 years (usually)", highlight: true },
      ],
      consequences: [
        "🔒 FEIE is an ELECTION — it must be affirmatively made by filing Form 2555 with your tax return. The IRS does not apply the exclusion automatically even if you qualify.",
        "🔒 If you did not file Form 2555 in prior years when you otherwise qualified, your foreign earned income was treated as fully taxable — you paid tax you could have legally excluded.",
        result.form2555Status === "no_no_return" ? "🔒 Additionally: if you did not file a US federal return at all, you have a compliance obligation separate from FEIE. US citizens must file worldwide income regardless of foreign residence or FEIE eligibility. The IRS Streamlined Filing Compliance Procedures exist for non-willful non-filers." : "You filed but did not claim FEIE. The correction path is an amended return with Form 2555 attached.",
        "🔓 Amendment path: Form 1040X with Form 2555 attached, within 3 years of original filing deadline (or 2 years from tax paid, whichever is later). Late FEIE elections may require IRS consent per Rev. Proc. 2022-41 — consult a CPA familiar with international returns.",
        "🔓 Going forward: file Form 2555 WITH your federal tax return every year you want FEIE. The election persists until revoked, but must be documented annually.",
        `Tax at stake per year: approximately ${formatUSD(result.taxIfFeieFails)} at ${formatUSD(result.assumedIncome)} income level. Over 3 prior years at comparable income: potentially ${formatUSD(result.taxIfFeieFails * 3)} in unnecessarily paid federal tax.`,
      ],
      confidence: "HIGH",
      confidenceNote: "Form 2555 election requirement is statutory. Prior year non-election can often be corrected via amendment if within time limits.",
      tier: 147,
      ctaLabel: "Get My FEIE Election + Amendment Plan — $147 →",
      altTierLabel: "Just want the exposure audit? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── FAIL: Days under 300 ──────────────────────────────────────────────────
  if (result.status === "FAIL_DAYS") {
    return {
      status: "FAIL — UNDER 300 DAYS ABROAD",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `The physical presence test requires 330 full days in foreign countries in any 12-month period. Under 300 days does not meet this threshold. Your foreign earned income is fully taxable in the US — at ${formatUSD(result.assumedIncome)} illustrative income, approximately ${formatUSD(result.taxIfFeieFails)} in federal tax.`,
      stats: [
        { label: "Days threshold", value: "330 required", highlight: true },
        { label: "Your days", value: "Under 300", highlight: true },
        { label: "Tax exposure", value: formatUSD(result.taxIfFeieFails), highlight: true },
      ],
      consequences: [
        "🔒 IRC §911(d)(1)(A) — physical presence test requires exactly 330 FULL days in foreign countries in any consecutive 12-month period. Under 300 days fails the test with no partial exclusion.",
        "🔒 'Full days' means 24-hour days in foreign countries. Transit days where you pass through the US (including airport layovers), days entering/leaving the US, and partial days do not count as foreign days.",
        "Alternative path — Bona Fide Residence Test: if you have established formal foreign residence (lease, residence permit, community ties), you may qualify under the bona fide residence test even with fewer than 330 days abroad. Requires continuous residence including a full tax year.",
        "Alternative — Foreign Tax Credit (Form 1116): if you paid foreign tax on the foreign income, you may be able to credit that against US tax — separate mechanism from FEIE, not mutually exclusive.",
        "Going forward: track days precisely. Consider residence strategy: settling in one foreign country and building ties may qualify under bona fide residence without the 330-day count pressure.",
        "If you already claimed FEIE on a prior return without meeting the 330-day test: amendment required. Penalties may apply. Voluntary correction before IRS examination is treated more favorably.",
      ],
      confidence: "HIGH",
      confidenceNote: "Physical presence test is a strict 330-day statutory threshold under IRC §911(d)(1)(A).",
      tier: 147,
      ctaLabel: "Get My FEIE Recovery + FTC Plan — $147 →",
      altTierLabel: "Just want the audit? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── AT RISK: Days 300-329 ─────────────────────────────────────────────────
  if (result.status === "AT_RISK_DAYS") {
    return {
      status: "AT RISK — 300 TO 329 DAYS IS CLOSE CALL",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `You are within 1-30 days of the 330-day threshold. The physical presence test is ALL-OR-NOTHING — 329 days fails, 330 days passes. At ${formatUSD(result.assumedIncome)} illustrative income, the difference is approximately ${formatUSD(result.taxIfFeieFails)} in federal tax. Count your days precisely before filing.`,
      stats: [
        { label: "Days threshold", value: "330 required", highlight: true },
        { label: "Your days", value: "300-329 range", highlight: true },
        { label: "Exposure if 329", value: formatUSD(result.taxIfFeieFails), highlight: true },
      ],
      consequences: [
        "⚠ You are in the risk zone. Every US day costs you an equivalent of ~1/30th of the FEIE exclusion. A single miscounted US layover can drop you below 330 and invalidate the entire exclusion.",
        "⚠ Common counting mistakes: (a) treating a US airport layover as a foreign day (it is US), (b) counting partial days abroad (must be FULL 24-hour days), (c) using calendar year instead of a 12-month period starting/ending on ANY date (the 12-month period is flexible — choose the most favourable).",
        "🔓 Correction strategy: the 12-month period is flexible. You can choose the 12-month window that maximises foreign days. Example: if you were in the US Jan 1-15 and then fully abroad, use the period Jan 16 - Jan 15 next year — excludes the US days.",
        "🔓 Alternative — Bona Fide Residence Test: if you have established formal residence in a foreign country, you may qualify under bona fide residence rather than physical presence. Requires continuous residence including a full tax year — but no 330-day constraint.",
        "🔓 Foreign Tax Credit backup (Form 1116): if you paid foreign tax on foreign earnings, you can credit against US tax even if FEIE fails. Not a full replacement (FEIE excludes income entirely; FTC only credits foreign tax paid) but useful as fallback.",
        "Precise day counting tool: keep a travel log with entry/exit stamps, boarding passes, receipts. The IRS can request documentation.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "330-day test is binary. At 300-329 days, precise counting is required. The 12-month period choice can tip the result.",
      tier: 147,
      ctaLabel: "Get My Day Count + Planning Pack — $147 →",
      altTierLabel: "Just want the audit? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── UNCLEAR: Days not counted ─────────────────────────────────────────────
  if (result.status === "UNCLEAR_DAYS") {
    return {
      status: "DAY COUNT UNCLEAR — PRECISE RECONCILIATION NEEDED",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `You have not counted your exact days outside the US for the physical presence test. This is the most common cause of FEIE disallowance on audit. At ${formatUSD(result.assumedIncome)} illustrative income, the difference between qualifying and not is approximately ${formatUSD(result.taxIfFeieFails)} in federal tax. You need the precise count before filing.`,
      stats: [
        { label: "Day count status", value: "Not verified", highlight: true },
        { label: "Required", value: "330 full days", highlight: true },
        { label: "Tax at stake", value: formatUSD(result.taxIfFeieFails), highlight: true },
      ],
      consequences: [
        "⚠ Without a precise day count, you cannot confirm physical presence qualification. Filing FEIE on Form 2555 without the count is risky — if audited, the burden is on YOU to demonstrate 330 foreign days.",
        "📋 Day counting checklist: (a) compile all travel dates (passport stamps, boarding passes, residence records), (b) count only FULL 24-hour days in foreign countries, (c) exclude transit days through the US (even layovers), (d) choose the most favourable 12-month period (need not be calendar year).",
        "📋 Documentation to keep: passport pages showing entry/exit stamps, boarding passes, foreign residence records, employment records showing work location. IRS can request any or all.",
        "Tools: mobile apps like Nomad List, TaxAct Xpat, or a simple spreadsheet with date in / date out per country. Reconstruct from credit card statements, email confirmations, travel receipts if needed.",
        "Timing: count BEFORE filing. If you discover you are under 330, you may be able to extend your trip, choose a different 12-month period, or fall back on bona fide residence test.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Day count verification is mechanical — needs complete travel records. Cannot confirm qualification without precise count.",
      tier: 147,
      ctaLabel: "Get My Day Count Reconciliation — $147 →",
      altTierLabel: "Just want the audit? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── FAIL: No bona fide residence ──────────────────────────────────────────
  if (result.status === "FAIL_NO_RESIDENCE") {
    return {
      status: "FAIL — NO BONA FIDE FOREIGN RESIDENCE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `The bona fide residence test requires established foreign residence with community ties — not just travel between countries. Nomadic lifestyle without formal residence does not satisfy this test. Your foreign earned income is fully taxable in the US. At ${formatUSD(result.assumedIncome)} illustrative income, approximately ${formatUSD(result.taxIfFeieFails)} in federal tax.`,
      stats: [
        { label: "Bona fide residence", value: "Not established", highlight: true },
        { label: "Tax exposure", value: formatUSD(result.taxIfFeieFails), highlight: true },
        { label: "Alternative", value: "Physical presence test", highlight: false },
      ],
      consequences: [
        "🔒 IRC §911(d)(1)(B) — bona fide residence test requires an UNINTERRUPTED period of residence in a foreign country that includes at least one full tax year. Moving between countries does not satisfy this test.",
        "🔒 Indicators of bona fide residence: (a) formal residence permit or long-term visa, (b) rental lease or property ownership in the foreign country, (c) foreign driver's licence, bank accounts, tax filings in host country, (d) community ties (memberships, schools, family).",
        "🔄 Alternative — Physical Presence Test: requires 330 full days in foreign countries in any 12-month period. If you meet the day count, you qualify even without formal residence. Often easier for digital nomads to satisfy.",
        "🔄 Combined approach: in a single tax year you can establish bona fide residence starting mid-year, then use physical presence for the prior year. Does not work within a single year — but useful for multi-year planning.",
        "If you claimed bona fide residence on prior returns without meeting the test: amendment likely required. Consider switching to physical presence test if day count supports it.",
      ],
      confidence: "HIGH",
      confidenceNote: "Bona fide residence requires demonstrable continuity of residence. Nomadic lifestyle generally does not qualify.",
      tier: 147,
      ctaLabel: "Get My Physical Presence Strategy — $147 →",
      altTierLabel: "Just want the audit? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── AT RISK: Partial bona fide ────────────────────────────────────────────
  if (result.status === "AT_RISK_BONA_FIDE") {
    return {
      status: "AT RISK — PARTIAL BONA FIDE RESIDENCE",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `You have some ties to a foreign country but not formal residence. The bona fide residence test is a subjective determination — partial ties create audit risk. At ${formatUSD(result.assumedIncome)} illustrative income, the exposure if FEIE fails is approximately ${formatUSD(result.taxIfFeieFails)}.`,
      stats: [
        { label: "Bona fide status", value: "Partial — at risk", highlight: true },
        { label: "Tax at stake", value: formatUSD(result.taxIfFeieFails), highlight: true },
        { label: "Safer path", value: "Physical presence test" },
      ],
      consequences: [
        "⚠ The bona fide residence test is a FACTS AND CIRCUMSTANCES determination. Having some ties but not formal residence puts you in a gray zone — the IRS may challenge the claim on examination.",
        "⚠ Stronger ties help: formal residence permit or long-term visa, lease on foreign property, foreign driver's licence, foreign bank accounts, filed foreign tax returns, community memberships.",
        "📋 Weaker signals: Airbnb or short-term rentals only, no foreign tax filings, still holding primary US bank / mailing address, kids in school in US, spouse living in US.",
        "🔄 Safer path: Physical Presence Test (330 days). If you can meet the day count, you qualify regardless of residence status. Many digital nomads use physical presence specifically because bona fide residence is subjective.",
        "If using bona fide residence: document community ties extensively. IRS examiners weigh the totality of circumstances.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Bona fide residence is a facts-and-circumstances test with no bright line. Partial ties create examination risk.",
      tier: 147,
      ctaLabel: "Get My Residence Strategy Review — $147 →",
      altTierLabel: "Just want the audit? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── UNCLEAR TEST ──────────────────────────────────────────────────────────
  if (result.status === "UNCLEAR_TEST") {
    return {
      status: "QUALIFICATION TEST UNCLEAR",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `You are not sure which qualification test (physical presence vs bona fide residence) applies to your situation. Both have different requirements — and choosing the right one for your specific facts materially affects whether FEIE is available. At ${formatUSD(result.assumedIncome)} illustrative income, correct test selection can be worth ${formatUSD(result.taxIfFeieFails)} per year.`,
      stats: [
        { label: "Test selection", value: "Needs review", highlight: true },
        { label: "Annual value", value: formatUSD(result.taxIfFeieFails) },
        { label: "FEIE 2026", value: formatUSD(result.feieAmount), highlight: true },
      ],
      consequences: [
        "Both tests have distinct requirements: Physical Presence = 330 full days abroad in any 12-month period (mechanical count). Bona Fide Residence = continuous foreign residence including a full tax year (subjective, facts-based).",
        "For digital nomads moving between countries: physical presence is usually easier — just requires the day count. Bona fide residence typically requires settling somewhere.",
        "For expats with a single foreign home: bona fide residence often preferred — no day count pressure, and one short US trip does not invalidate the claim.",
        "Annual review: you can switch between tests year to year. Some taxpayers use bona fide residence in settled years and physical presence during transition years.",
        "Start with facts: where is your tax home? Do you have formal foreign residence? How many days were you actually in the US last year? These three questions drive the test choice.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Test selection depends on specific facts. Review required to determine optimal path.",
      tier: 147,
      ctaLabel: "Get My Test Selection Review — $147 →",
      altTierLabel: "Just want the explainer? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── QUALIFIED (with passive income flag overlay) ──────────────────────────
  if (result.status === "QUALIFIED_PASSIVE_FLAG") {
    return {
      status: "QUALIFIED — BUT PASSIVE INCOME STILL TAXABLE",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `You appear to meet the §911 qualification requirements. Your foreign EARNED income up to ${formatUSD(result.feieAmount)} (2026) can be excluded. But your investment and passive income is NOT excluded and is fully taxable in the US. This is the most common oversight for digital nomads with US portfolios.`,
      stats: [
        { label: "FEIE status", value: "Likely qualified ✓" },
        { label: "Exclusion 2026", value: formatUSD(result.feieAmount), highlight: true },
        { label: "Passive income", value: "Still taxable in US", highlight: true },
      ],
      consequences: [
        "✓ You appear to qualify for FEIE under IRC §911 — exclusion of up to $126,500 (2026) of foreign earned income.",
        "⚠ FEIE only excludes EARNED income — wages, salary, net self-employment income from services performed abroad. It does NOT exclude: dividends, interest, capital gains, rental income, crypto gains, royalties, or business distributions not attributable to personal services.",
        "⚠ If you have US brokerage dividends, US property rental, crypto trading, or any other passive income, that income is FULLY TAXABLE in the US — regardless of where you live.",
        "📋 Planning for passive income: (a) Foreign Tax Credit (Form 1116) if you paid foreign tax on the passive income, (b) state residency planning (some states tax expats differently), (c) investment account structure review, (d) PFIC rules if holding foreign mutual funds (complex — consult a CPA).",
        "✓ Filing requirement: even with FEIE, you must file Form 2555 with Form 1040 annually. The exclusion is elected each year — it does not carry forward automatically.",
        `Confirm: (a) Form 2555 filed for this year, (b) all passive income separately reported, (c) state tax position reviewed.`,
      ],
      confidence: "HIGH",
      confidenceNote: "FEIE qualification appears satisfied based on stated facts. Passive income exposure is a known structural issue affecting most digital nomads.",
      tier: 147,
      ctaLabel: "Get My Full Expat Tax Plan — $147 →",
      altTierLabel: "Just want the confirmation? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── QUALIFIED (clean case) ────────────────────────────────────────────────
  return {
    status: "QUALIFIED — FEIE APPEARS VALID",
    statusClass: "text-emerald-700",
    panelClass: "border-emerald-200 bg-emerald-50",
    headline: `You appear to meet the §911 qualification requirements. Your foreign earned income up to ${formatUSD(result.feieAmount)} (2026) can be excluded from US federal tax via Form 2555. Continue to track days (if using physical presence) or maintain residence ties (if bona fide residence) annually.`,
    stats: [
      { label: "FEIE status", value: "Likely qualified ✓" },
      { label: "Exclusion 2026", value: formatUSD(result.feieAmount), highlight: true },
      { label: "Form 2555", value: "Filed ✓" },
    ],
    consequences: [
      "✓ You meet the key gates: foreign tax home, qualifying test (physical presence or bona fide residence), Form 2555 filed.",
      `✓ Exclusion amount for 2026: ${formatUSD(result.feieAmount)} of foreign earned income. Income above this amount is taxable in the US (but foreign tax credit may offset).`,
      "📋 Annual maintenance: file Form 2555 with each year's Form 1040. If using physical presence, keep a precise travel log. If using bona fide residence, maintain documentation of foreign ties.",
      "📋 Watch for: returning to the US for medical treatment, family emergencies, or work trips can erode the 330-day count. Even vacation days in the US count as US days.",
      "📋 Housing exclusion: in high-cost-of-living foreign cities you may also qualify for the foreign housing exclusion / deduction under §911(c) — additional exclusion for employer-provided housing or self-employed housing expenses.",
      "Planning: FEIE does not eliminate self-employment tax. US self-employed individuals abroad still pay SE tax (~15.3% up to SS wage base) unless a totalisation agreement applies. Check whether your host country has one.",
    ],
    confidence: "HIGH",
    confidenceNote: "All stated gates pass. Annual re-verification recommended as travel patterns and residence ties change.",
    tier: 67,
    ctaLabel: "Get My Compliance Confirmation — $67 →",
    altTierLabel: "Want the full expat plan too? — $147",
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
    id: "tax_home", step: 1, type: "button_group",
    label: "Do you have a tax home in a foreign country?",
    subLabel: "Tax home is generally where your main place of business or employment is located. FEIE requires a FOREIGN tax home — not just travel.",
    options: [
      { label: "Yes — my main place of business is outside the US",       value: "yes_foreign",    subLabel: "Eligibility gate passed" },
      { label: "Unclear — I work remotely, move between countries",        value: "unclear_remote", subLabel: "Review needed" },
      { label: "No — I am based in the US but travel abroad",              value: "no_us_based",    subLabel: "FEIE not available" },
    ],
    required: true,
  },
  {
    id: "qualification_test", step: 2, type: "button_group",
    label: "Which qualification test are you relying on?",
    subLabel: "Physical presence = 330 days abroad (mechanical count). Bona fide residence = established foreign residence (facts-based).",
    options: [
      { label: "Physical Presence (330 days in foreign countries)",    value: "physical_presence", subLabel: "Day count based" },
      { label: "Bona Fide Residence (established foreign residence)",  value: "bona_fide",         subLabel: "Residence ties based" },
      { label: "Not sure which applies to me",                          value: "not_sure",          subLabel: "Review needed" },
    ],
    required: true,
  },
  {
    id: "days_abroad", step: 3, type: "button_group",
    label: "Days outside the US in the relevant 12-month period?",
    subLabel: "The 12-month period need not be calendar year — choose any 12-month window. Count only FULL 24-hour foreign days.",
    options: [
      { label: "Under 300 days",       value: "under_300",    subLabel: "Clearly fails 330 threshold" },
      { label: "300 to 329 days",      value: "300_to_329",   subLabel: "At risk — close to threshold" },
      { label: "330 to 365 days",      value: "330_plus",     subLabel: "Meets threshold" },
      { label: "Not sure — have not counted",  value: "not_sure", subLabel: "Precise count required" },
    ],
    showIf: (a) => a.qualification_test === "physical_presence",
    required: true,
  },
  {
    id: "foreign_residence", step: 3, type: "button_group",
    label: "Have you established formal residence in a foreign country?",
    subLabel: "Bona fide residence requires an uninterrupted period of residence including a full tax year with genuine community ties.",
    options: [
      { label: "Yes — lease, residence permit, established ties",     value: "yes_established", subLabel: "Strong bona fide claim" },
      { label: "Partially — some ties but not formal",                 value: "partial",         subLabel: "At risk — subjective test" },
      { label: "No — I move between countries",                         value: "no_nomadic",      subLabel: "Bona fide not met" },
    ],
    showIf: (a) => a.qualification_test === "bona_fide",
    required: true,
  },
  {
    id: "income_type", step: 4, type: "button_group",
    label: "What is your primary income type?",
    subLabel: "FEIE applies only to EARNED income. Dividends, interest, capital gains, rental, and crypto are NOT excluded — even if you qualify for FEIE.",
    options: [
      { label: "Primarily wages / salary from foreign employer",          value: "wages",                  subLabel: "Fully FEIE-eligible" },
      { label: "Self-employment / freelance income",                       value: "self_employment",        subLabel: "FEIE-eligible — SE tax still applies" },
      { label: "Mix of earned + investment/passive income",                value: "mixed_earned_passive",   subLabel: "Passive portion NOT excluded" },
      { label: "Primarily investment / passive income",                    value: "primarily_passive",      subLabel: "FEIE minimal — separate plan" },
    ],
    required: true,
  },
  {
    id: "form_2555", step: 5, type: "button_group",
    label: "Did you file Form 2555 to elect FEIE?",
    subLabel: "FEIE is NOT automatic. Without Form 2555 filed with your federal return, the exclusion was not claimed.",
    options: [
      { label: "Yes — filed correctly",                           value: "yes_filed",           subLabel: "Election made" },
      { label: "No — I assumed it was automatic",                  value: "no_assumed_automatic", subLabel: "Prior year amendment needed" },
      { label: "Not sure — my accountant handled it",              value: "accountant_unsure",    subLabel: "Verify with CPA" },
      { label: "No — I did not file a US return at all",            value: "no_no_return",         subLabel: "Compliance issue beyond FEIE" },
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

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* FEIE position breakdown */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your FEIE qualification profile</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Tax home</span>
            <span className="font-mono font-bold text-neutral-950">
              {verdict.result.taxHome === "yes_foreign" ? "Foreign ✓" : verdict.result.taxHome === "unclear_remote" ? "Unclear ⚠" : "US-based ✗"}
            </span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Qualification test</span>
            <span className="font-mono text-neutral-950">
              {verdict.result.qualificationTest === "physical_presence" ? "Physical Presence (330 days)"
                : verdict.result.qualificationTest === "bona_fide" ? "Bona Fide Residence"
                : "Not determined"}
            </span>
          </div>
          {verdict.result.qualificationTest === "physical_presence" && (
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Days abroad status</span>
              <span className={`font-mono font-bold ${
                verdict.result.daysAbroad === "330_plus" ? "text-emerald-700"
                : verdict.result.daysAbroad === "under_300" ? "text-red-700"
                : "text-amber-700"
              }`}>
                {verdict.result.daysAbroad === "330_plus" ? "Passes ✓"
                  : verdict.result.daysAbroad === "300_to_329" ? "At risk"
                  : verdict.result.daysAbroad === "under_300" ? "Fails"
                  : "Not counted"}
              </span>
            </div>
          )}
          {verdict.result.qualificationTest === "bona_fide" && (
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Foreign residence</span>
              <span className={`font-mono font-bold ${
                verdict.result.foreignResidence === "yes_established" ? "text-emerald-700"
                : verdict.result.foreignResidence === "no_nomadic" ? "text-red-700"
                : "text-amber-700"
              }`}>
                {verdict.result.foreignResidence === "yes_established" ? "Established ✓"
                  : verdict.result.foreignResidence === "partial" ? "Partial ⚠"
                  : "Not established ✗"}
              </span>
            </div>
          )}
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Income type</span>
            <span className={`font-mono ${verdict.result.hasPassiveIncome ? "text-amber-700" : "text-neutral-950"}`}>
              {verdict.result.incomeType === "wages" ? "Wages (FEIE-eligible)"
                : verdict.result.incomeType === "self_employment" ? "Self-employment (FEIE-eligible)"
                : verdict.result.incomeType === "mixed_earned_passive" ? "Mixed (partial FEIE)"
                : "Primarily passive (minimal FEIE)"}
            </span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Form 2555 status</span>
            <span className={`font-mono font-bold ${
              verdict.result.form2555Status === "yes_filed" ? "text-emerald-700"
              : verdict.result.form2555Status === "no_no_return" ? "text-red-700"
              : "text-amber-700"
            }`}>
              {verdict.result.form2555Status === "yes_filed" ? "Filed ✓"
                : verdict.result.form2555Status === "no_assumed_automatic" ? "Not filed"
                : verdict.result.form2555Status === "accountant_unsure" ? "Verify with CPA"
                : "No return filed"}
            </span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">FEIE 2026 exclusion</span>
            <span className="font-mono font-bold text-neutral-950">{formatUSD(verdict.result.feieAmount)}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="font-semibold text-neutral-800">Tax if FEIE fails (illustrative on $120k)</span>
            <span className="font-mono font-bold text-red-700">{formatUSD(verdict.result.taxIfFeieFails)}</span>
          </div>
        </div>
      </div>

      {/* Fear framing — where appropriate */}
      {(verdict.result.status === "FAIL_NO_TAX_HOME"
        || verdict.result.status === "FAIL_DAYS"
        || verdict.result.status === "FAIL_NO_RESIDENCE"
        || verdict.result.status === "AT_RISK_DAYS"
        || verdict.result.status === "NO_FORM_2555") && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ The FEIE failure cost</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-1">
            {formatUSD(verdict.result.taxIfFeieFails)} federal tax per year on ${Math.round(verdict.result.assumedIncome / 1000)}k of foreign earnings if FEIE fails.
          </p>
          <p className="text-xs text-red-800 leading-relaxed">
            The 330-day test is all-or-nothing — 329 days fails. Bona fide residence is facts-based — partial ties may fail on audit. Form 2555 must be filed annually — the exclusion is not automatic. One missed element can invalidate the entire exclusion for a tax year.
          </p>
        </div>
      )}

      {/* Passive income flag — always show if relevant */}
      {verdict.result.hasPassiveIncome && (
        <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700 mb-1.5">⚠ Passive income — NOT excluded by FEIE</p>
          <p className="text-base font-bold text-amber-900 leading-tight mb-1">
            FEIE excludes earned income only. Dividends, interest, capital gains, rental, and crypto gains remain fully taxable in the US.
          </p>
          <p className="text-xs text-amber-800 leading-relaxed">
            Most digital nomads with US portfolios do not realise this. A $30,000 dividend from US stocks owes full US federal tax regardless of how many days you were abroad. Foreign Tax Credit (Form 1116) may offset if you paid foreign tax on the same income — but FEIE itself provides no relief.
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
          <strong className="text-neutral-950">FEIE is not automatic and it is not comprehensive.</strong> You must qualify (tax home + physical presence OR bona fide residence) AND file Form 2555 annually. Even when claimed correctly, it only covers earned income — passive income remains fully taxable. Most digital nomads fail on one of these three fronts.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your exact qualification status under IRC §911</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Day count methodology + 12-month period optimisation</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Passive income treatment analysis (dividends, capital gains, rental, crypto)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Form 2555 election path + prior year amendment options if needed</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 CPA questions specific to your expat tax situation</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your tax home, qualification test, and filing history</p>
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

export default function FeieNomadAuditorCalculator() {
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
        product_slug: "feie-nomad-auditor",
        source_path: "/us/check/feie-nomad-auditor",
        country_code: "US", currency_code: "USD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          qualification_status: verdict.result.status,
          tax_if_feie_fails: verdict.result.taxIfFeieFails,
          has_passive_income: verdict.result.hasPassiveIncome,
          prior_year_risk: verdict.result.priorYearRisk,
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
      body: JSON.stringify({ email, source: "feie_nomad_auditor", country_code: "US", site: "taxchecknow" }),
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
    const sid = sessionId || `feie_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("feie-nomad-auditor_tax_home", String(answers.tax_home || ""));
    sessionStorage.setItem("feie-nomad-auditor_qualification_test", String(answers.qualification_test || ""));
    sessionStorage.setItem("feie-nomad-auditor_days_abroad", String(answers.days_abroad || ""));
    sessionStorage.setItem("feie-nomad-auditor_foreign_residence", String(answers.foreign_residence || ""));
    sessionStorage.setItem("feie-nomad-auditor_income_type", String(answers.income_type || ""));
    sessionStorage.setItem("feie-nomad-auditor_form_2555", String(answers.form_2555 || ""));
    sessionStorage.setItem("feie-nomad-auditor_qualification_status", verdict.result.status);
    sessionStorage.setItem("feie-nomad-auditor_tax_if_feie_fails", String(Math.round(verdict.result.taxIfFeieFails)));
    sessionStorage.setItem("feie-nomad-auditor_has_passive_income", String(verdict.result.hasPassiveIncome));
    sessionStorage.setItem("feie-nomad-auditor_status", verdict.status);
    sessionStorage.setItem("feie-nomad-auditor_tier", String(popupTier));

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
          success_url: `${window.location.origin}/us/check/feie-nomad-auditor/success/${successPath}`,
          cancel_url: `${window.location.origin}/us/check/feie-nomad-auditor`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your FEIE qualification status for your CPA.</p>
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
                    {popupTier === 67 ? "Your FEIE Audit Pack" : "Your Full Expat Tax Plan"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">IRS-referenced · IRC §911 · Form 2555 · April 2026</p>
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
                      {popupTier === 67 ? "FEIE Audit Pack™" : "Full Expat Tax Plan™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your exact FEIE qualification status, day count methodology, passive income impact, Form 2555 election path, and 5 CPA questions — built around your specific facts."
                        : "Full plan: FEIE qualification + Foreign Tax Credit analysis, passive income treatment strategy, state tax residency review, prior year amendment analysis, SE tax and totalisation treaty review, and CPA coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic expat tax advice. Your exact qualification and exposure math.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My FEIE Audit →" : "Get My Full Plan →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the audit? — $67 instead" : "Want the full plan? — $147 instead"}
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
                    { label: "Expat status", key: "entity_type", options: [["digital_nomad","Digital nomad — moves between countries"],["settled_expat","Settled expat — one foreign country"],["remote_us_employer","Remote US employer, abroad"],["self_employed_abroad","Self-employed abroad"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["acting_now","Acting before next filing"],["planning","Planning next tax year"],["just_checking","Just checking my position"]] },
                    { label: "Do you have a CPA?", key: "accountant", options: [["cpa","Yes — expat CPA"],["domestic_cpa","Yes — domestic CPA"],["diy","DIY"],["none","No — looking for one"]] },
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
      {showVerdict && verdict && verdict.result.status !== "QUALIFIED" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Tax if FEIE fails</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatUSD(verdict.result.taxIfFeieFails)} on $120k foreign earnings
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
