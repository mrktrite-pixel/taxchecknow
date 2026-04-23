"use client";

/**
 * NZ-04 — Trust Income Allocation Decision Engine (formerly Trust Tax Splitter)
 * Pattern: Classification (Module C) + CashflowModel (Module F)
 *
 * Core question: Should trust income be retained (at 39% trustee rate) or
 * distributed to beneficiaries (at their marginal rate) — and which of the
 * 7 distinct decision paths applies.
 *
 * LEGAL ANCHOR: Income Tax Act 2007, section HC 32 as amended by the
 * Taxation (Annual Rates for 2023-24, Multinational Tax, and Remedial Matters)
 * Act 2024. Trustee rate = 39% from 1 April 2024.
 *
 * WHEN DISTRIBUTION WORKS (rate arbitrage available):
 *   - Adult beneficiary (18+) with marginal rate below 39%
 *   - Passive income (investment, rental, dividends)
 *   - Genuine beneficial interest + actual benefit
 *   - Formal trustee resolution within tax return filing period
 *
 * WHEN DISTRIBUTION FAILS (stays at 39% or is attributed back):
 *   - Minor beneficiaries (under 16) — attribution back to settlor OR 39%
 *   - Personal services income — cannot be split regardless of structure
 *   - Artificial / circular distributions — BG 1 general anti-avoidance
 *   - Company beneficiary — taxed at 28% (different path)
 *   - Beneficiary already at 39% band — no rate arbitrage
 *
 * BENEFICIARY MARGINAL RATES (NZ 2025-26):
 *   10.5% on income to $14,000
 *   17.5% on $14,001–$48,000
 *   30%   on $48,001–$70,000
 *   33%   on $70,001–$180,000
 *   39%   on income over $180,000
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type DecisionStatus =
  | "OPTIMAL_DISTRIBUTION"          // adult at low marginal, passive, correct timing — full arbitrage available
  | "BLOCKED_MINORS_ONLY"           // minors only — attribution or 39%
  | "BLOCKED_PERSONAL_SERVICES"     // personal services income — cannot be split
  | "BLOCKED_NO_ARBITRAGE"          // adult beneficiary but already at 39%
  | "RETAINING_SUBOPTIMAL"          // not distributing, could be
  | "IRD_HIGH_RISK"                  // audit flags (previous issues raised)
  | "MIXED_BENEFICIARIES_PARTIAL"   // adult + minor mix — partial arbitrage only
  | "COMPANY_BENEFICIARY_REVIEW";   // company/trust beneficiary — 28% path

interface DecisionResult {
  trustIncome:      number;
  incomeType:       string;
  beneficiaryComp:  string;
  lowestMarginal:   number;
  marginalLabel:    string;
  distributing:     string;
  irdReviewed:      string;

  retainedTax:           number;     // income × 39%
  retainedAfterTax:      number;
  optimalTax:            number;     // income × lowest marginal (if works)
  optimalAfterTax:       number;
  annualSaving:          number;
  tenYearSaving:         number;

  audit_risk:            "low" | "medium" | "high";
  timingRecommendation:  string;

  status: DecisionStatus;
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
  result: DecisionResult;
}

interface PopupAnswers {
  trustee_role: string;
  urgency: string;
  accountant: string;
}

const TRUSTEE_RATE = 0.39;
const COMPANY_RATE = 0.28;

const INCOME_MIDPOINT: Record<string, number> = {
  under_50k:   30_000,
  "50k_150k":  100_000,
  "150k_500k": 300_000,
  over_500k:   750_000,
};

const MARGINAL_RATE: Record<string, { rate: number; label: string }> = {
  "10_5": { rate: 0.105, label: "10.5%" },
  "17_5": { rate: 0.175, label: "17.5%" },
  "30":    { rate: 0.30,  label: "30%" },
  "33":    { rate: 0.33,  label: "33%" },
  "39":    { rate: 0.39,  label: "39% — no arbitrage" },
};

const PRODUCT_KEYS = {
  p67:  "nz_67_trust_tax_splitter",
  p147: "nz_147_trust_tax_splitter",
};

function formatNZD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-NZ");
}

function formatNZDPerYear(n: number): string {
  return formatNZD(n) + "/yr";
}

function calcDecision(answers: AnswerMap): DecisionResult {
  const incomeKey        = String(answers.trust_income      || "50k_150k");
  const incomeType       = String(answers.income_type        || "investment");
  const beneficiaryComp  = String(answers.beneficiary_comp   || "adults_only");
  const rateKey          = String(answers.lowest_marginal    || "17_5");
  const distributing     = String(answers.distributing       || "no");
  const irdReviewed      = String(answers.ird_reviewed        || "no_never");

  const trustIncome = INCOME_MIDPOINT[incomeKey] ?? 100_000;
  const rateInfo = MARGINAL_RATE[rateKey] ?? { rate: 0.175, label: "17.5%" };

  const retainedTax = trustIncome * TRUSTEE_RATE;
  const retainedAfterTax = trustIncome - retainedTax;
  const optimalTax = trustIncome * rateInfo.rate;
  const optimalAfterTax = trustIncome - optimalTax;
  const annualSaving = Math.max(0, retainedTax - optimalTax);
  const tenYearSaving = annualSaving * 10;

  // Audit risk
  let audit_risk: DecisionResult["audit_risk"] = "low";
  if (irdReviewed === "yes_issues") audit_risk = "high";
  else if (irdReviewed === "not_sure" || distributing === "not_sure") audit_risk = "medium";

  // Timing recommendation
  let timingRecommendation = "";
  if (distributing === "no" || distributing === "not_sure") {
    timingRecommendation = "Pass formal trustee resolutions before trust return is due for this income year. Retrospective resolutions after filing are an IRD audit trigger under section BG 1.";
  } else {
    timingRecommendation = "Continue with formal resolutions within tax return filing period. Document each distribution with a signed trustee resolution and actual payment/credit to beneficiary account.";
  }

  // Status determination — priority order
  let status: DecisionStatus;

  if (incomeType === "personal_services") {
    status = "BLOCKED_PERSONAL_SERVICES";
  } else if (beneficiaryComp === "minors_only") {
    status = "BLOCKED_MINORS_ONLY";
  } else if (beneficiaryComp === "company_or_trust") {
    status = "COMPANY_BENEFICIARY_REVIEW";
  } else if (rateKey === "39") {
    status = "BLOCKED_NO_ARBITRAGE";
  } else if (irdReviewed === "yes_issues") {
    status = "IRD_HIGH_RISK";
  } else if (beneficiaryComp === "adults_and_minors") {
    status = "MIXED_BENEFICIARIES_PARTIAL";
  } else if (distributing === "no" || distributing === "not_sure") {
    status = "RETAINING_SUBOPTIMAL";
  } else {
    status = "OPTIMAL_DISTRIBUTION";
  }

  return {
    trustIncome, incomeType, beneficiaryComp,
    lowestMarginal: rateInfo.rate, marginalLabel: rateInfo.label,
    distributing, irdReviewed,
    retainedTax, retainedAfterTax, optimalTax, optimalAfterTax,
    annualSaving, tenYearSaving,
    audit_risk, timingRecommendation,
    status,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcDecision(answers);

  if (result.status === "OPTIMAL_DISTRIBUTION") {
    return {
      status: "OPTIMAL — RATE ARBITRAGE FULLY AVAILABLE",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Adult beneficiary with ${result.marginalLabel} marginal rate, passive income type, and distribution pattern in place. On ${formatNZD(result.trustIncome)} of trust income the retained (trustee) tax is ${formatNZD(result.retainedTax)} at 39%. Distributed to beneficiary at ${result.marginalLabel} the tax is ${formatNZD(result.optimalTax)} — a saving of ${formatNZDPerYear(result.annualSaving)} per year. Compounded over 10 years: ${formatNZD(result.tenYearSaving)} difference from one annual decision.`,
      stats: [
        { label: "Retained tax (trustee rate)",     value: formatNZD(result.retainedTax),                          highlight: false },
        { label: "Distributed tax (beneficiary)",   value: formatNZD(result.optimalTax),                           highlight: false },
        { label: "Annual saving",                      value: formatNZDPerYear(result.annualSaving),               highlight: true },
      ],
      consequences: [
        `✓ Rate arbitrage: ${result.marginalLabel} beneficiary vs 39% trustee = ${((TRUSTEE_RATE - result.lowestMarginal) * 100).toFixed(1)}% differential on distributed income.`,
        `Mechanics: pass a formal trustee resolution during or before the end of the income year. The resolution should identify the beneficiary, the amount, and the effective date. Actual payment or credit to the beneficiary's account should follow — paper-only arrangements can be challenged.`,
        `Annual saving: ${formatNZDPerYear(result.annualSaving)}. 10-year compounded saving: ${formatNZD(result.tenYearSaving)}. At your income level and rate differential this is one of the highest-value annual decisions available in NZ personal tax.`,
        "Genuine benefit test: the beneficiary must genuinely own the distributed income and be able to use it as their own. Circular flows (income distributed, then returned to settlor or trust) are challenged under BG 1 general anti-avoidance.",
        "Timing rule: beneficiary income must be allocated by the time the trust's tax return is due for the income year. Retrospective resolutions after filing are an IRD audit flag.",
        "Documentation: trustee resolution (dated, signed), beneficiary notice of entitlement, evidence of payment or credit, beneficiary's own tax return declaring the distribution. Keep 7 years minimum.",
        "Watch-outs: (a) beneficiary's own income may push their marginal rate up if distributions are large — model the combined effect; (b) Working for Families or benefits can be affected by declared income; (c) in a year where the trust has losses, there is no income to distribute.",
      ],
      confidence: "HIGH",
      confidenceNote: "Standard rate arbitrage case. All gates pass — adult, passive income, distributing, clean IRD history.",
      tier: 67,
      ctaLabel: "Get My Distribution Resolution Pack — $67 →",
      altTierLabel: "Multiple beneficiaries / complex situation? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "RETAINING_SUBOPTIMAL") {
    return {
      status: "RETAINING AT 39% — DISTRIBUTION LEVER UNUSED",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your trust has adult beneficiaries with a ${result.marginalLabel} marginal rate, but income is currently being retained at the 39% trustee rate. On ${formatNZD(result.trustIncome)} of trust income you are paying ${formatNZD(result.retainedTax)} in tax when a distribution-based approach would cost ${formatNZD(result.optimalTax)}. The annual saving available is ${formatNZDPerYear(result.annualSaving)} — ${formatNZD(result.tenYearSaving)} over 10 years from the single decision to pass a distribution resolution.`,
      stats: [
        { label: "Current tax (retained 39%)",  value: formatNZD(result.retainedTax),                          highlight: true },
        { label: "Optimal tax (distributed)",   value: formatNZD(result.optimalTax),                           highlight: true },
        { label: "Annual saving available",     value: formatNZDPerYear(result.annualSaving),                  highlight: true },
      ],
      consequences: [
        `⚠ You have adult beneficiaries at ${result.marginalLabel} but are not currently distributing. Rate arbitrage available: ${((TRUSTEE_RATE - result.lowestMarginal) * 100).toFixed(1)}% on distributed income.`,
        `Current annual cost of retaining: ${formatNZDPerYear(result.retainedTax)}. With distribution: ${formatNZDPerYear(result.optimalTax)}. Saving: ${formatNZDPerYear(result.annualSaving)}.`,
        "10-year view: compounded at ${result.marginalLabel} vs 39%, the net amount retained by the family is materially larger with a distribution strategy. This is not a marginal optimisation — it is one of the largest annual tax decisions available to a NZ trust with adult beneficiaries in lower brackets.",
        "Action: engage your accountant to draft a trustee resolution for the current income year BEFORE the trust tax return is due. The resolution should allocate income to specified adult beneficiaries and document their entitlement.",
        "Beneficiary verification: before resolving, confirm each beneficiary is named in the trust deed, is an adult (18+ for clean treatment), and has a marginal rate below 39%. A beneficiary whose income is already high may not provide arbitrage.",
        "Resolution content: date (within income year or before return is due), trustee signatures, name of each beneficiary receiving a distribution, amount allocated, whether income or capital, terms of payment or credit.",
        "Timing: beneficiary income must be allocated within the filing window. Resolutions passed after the return is filed are an IRD audit trigger. Plan ahead — do not leave to the end of the year.",
      ],
      confidence: "HIGH",
      confidenceNote: "Rate arbitrage clearly available but not being captured. Standard distribution strategy applies.",
      tier: 147,
      ctaLabel: "Get My Distribution Strategy Pack — $147 →",
      altTierLabel: "Just want the resolution template? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "BLOCKED_MINORS_ONLY") {
    return {
      status: "BLOCKED — MINORS ONLY, ANTI-SPLITTING RULE APPLIES",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Your trust has only minor beneficiaries (under 16). Under the anti-splitting rules, income allocated to minor beneficiaries is attributed back to the settlor or taxed at the 39% trustee rate — no rate arbitrage is available. On ${formatNZD(result.trustIncome)} of trust income, tax remains ${formatNZD(result.retainedTax)} regardless of distribution pattern. Standard splitting strategies do not work here.`,
      stats: [
        { label: "Retained tax (no arbitrage)", value: formatNZD(result.retainedTax), highlight: true },
        { label: "Distribution saving",          value: formatNZD(0),                  highlight: true },
        { label: "Effective rate",                value: "39%",                         highlight: true },
      ],
      consequences: [
        `🔒 Minor beneficiary rule: income allocated to beneficiaries under 16 is either attributed back to the settlor (taxed at settlor's marginal rate) or taxed at the 39% trustee rate. The intended rate arbitrage is specifically prevented for minors by the Income Tax Act 2007.`,
        "The policy rationale is clear: the rule prevents parents from shifting investment income to their young children to access the 10.5% or 17.5% personal rates — without any genuine independence of the child in the arrangement.",
        "When this status changes: when a minor beneficiary turns 16, distributions to them are taxed at their marginal rate (which may still be very low if they have no other income). A distribution in the income year they turn 16 is taxed at their marginal rate for the full year.",
        "Alternative strategies to consider: (a) if you are the settlor, is there an adult beneficiary (e.g. spouse) on a lower marginal rate who could receive distributions legitimately? (b) would a company structure (28%) be more efficient than the 39% trustee rate for retained income? (c) for capital-growth investments, the capital gain may not be taxable at all (outside bright-line), in which case the rate is 0%.",
        "Do not attempt workarounds: distributions to minors that are immediately used for the settlor's benefit, or arrangements that circulate income back to the settlor, are challenged under BG 1 general anti-avoidance. The penalty + interest exposure on failed challenges typically exceeds any short-term saving.",
        "Timeline planning: track each minor beneficiary's 16th birthday and plan distribution strategy around those dates. Year-by-year the arbitrage gradually becomes available as children age.",
      ],
      confidence: "HIGH",
      confidenceNote: "Anti-splitting rule for minor beneficiaries is explicit in the Income Tax Act 2007. No distribution strategy overcomes it.",
      tier: 147,
      ctaLabel: "Get My Minor-Beneficiary Workaround Analysis — $147 →",
      altTierLabel: "Just want the rule? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "BLOCKED_PERSONAL_SERVICES") {
    return {
      status: "BLOCKED — PERSONAL SERVICES INCOME CANNOT BE SPLIT",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Personal services income — professional fees, consulting income, employment income earned by the individual — cannot be allocated to trust beneficiaries regardless of structure. The income is taxed as income of the person who performed the services. On ${formatNZD(result.trustIncome)} of personal services income, the trust structure provides no rate arbitrage opportunity.`,
      stats: [
        { label: "Retained / assessed tax", value: formatNZD(result.retainedTax), highlight: true },
        { label: "Distribution saving",      value: formatNZD(0),                  highlight: true },
        { label: "Alternative path",           value: "Company (28%) may apply",   highlight: false },
      ],
      consequences: [
        `🔒 Personal services income (PSI) rule: income derived from the personal exertion of an individual — consulting fees, professional services, employment — cannot be split through a trust to other beneficiaries. IRD treats it as the income of the person who performed the service regardless of who the fee was paid to.`,
        "Common misclassification: some income looks like trust income but is really personal services. Examples: a consultant billing through their family trust; a professional whose fees are paid to a trust they control. In both cases the fees remain personal services income and are taxed to the individual, not allocable to beneficiaries.",
        "What CAN be split through a trust: genuinely passive income — interest, dividends, rental income, managed fund returns, capital distributions from investments. The test is whether the income was earned by capital / assets (trust beneficiary share is possible) vs earned by a specific individual's work (not splittable).",
        "Alternative structure consideration: for a professional or consultant, a company structure (28% company rate) is often more efficient than either trust retention (39%) or personal ownership (up to 39% personal marginal). Dividends from the company can then be paid with imputation credits.",
        "Hybrid trust with passive income: if the trust ALSO holds passive-income-producing assets (e.g. investments, rental property), those income streams CAN be distributed to beneficiaries at their marginal rates. The personal services income stream is ring-fenced separately.",
        "Do not attempt to reclassify: attempting to characterise personal services income as 'management fees' or 'consulting services' paid to an entity that then distributes is exactly the arrangement IRD targets under BG 1. The reclassification is ignored; tax is assessed to the individual.",
      ],
      confidence: "HIGH",
      confidenceNote: "Personal services income rule is foundational in NZ tax. No trust structure splits PSI among beneficiaries.",
      tier: 147,
      ctaLabel: "Get My Structure Alternative Analysis — $147 →",
      altTierLabel: "Just want the rule? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "BLOCKED_NO_ARBITRAGE") {
    return {
      status: "NO ARBITRAGE — BENEFICIARY ALREADY AT 39%",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your lowest-marginal adult beneficiary is in the 39% band (income over $180,000). There is no rate arbitrage available — distributions are taxed at 39% whether retained in the trust or distributed. On ${formatNZD(result.trustIncome)} of income, the tax is ${formatNZD(result.retainedTax)} in both scenarios. Consider: company structure, spouse/dependent with lower income, or tax-efficient investments instead.`,
      stats: [
        { label: "Trust / beneficiary tax",   value: formatNZD(result.retainedTax), highlight: true },
        { label: "Distribution saving",        value: formatNZD(0),                  highlight: true },
        { label: "Alternatives to consider",    value: "Company at 28%" },
      ],
      consequences: [
        `⚠ No rate arbitrage: your adult beneficiaries are at the 39% marginal rate, which matches the trustee rate. Distribution does not reduce tax.`,
        "Alternative paths worth modelling: (a) company structure at 28% — 11 percentage points below trustee rate for retained income; (b) identifying a lower-income beneficiary not currently in scope (e.g. retired parent, student relative, spouse with lower income); (c) capital-growth focus where gains are not taxable under general rules (outside bright-line, outside trading property).",
        "Company pivot calculation: on retained income, company pays 28% vs trust at 39%. On distribution via dividend, the shareholder receives an imputation credit for the 28% already paid. If the shareholder's marginal rate is also 39%, they pay an additional 11% — same total as the trust path. If the shareholder's rate is lower, imputation credits generate refund.",
        "Income type matters: if the trust holds investment-type assets (shares, managed funds), dividends carry imputation credits — often making the company path more efficient net of imputation. If the trust holds rental property, the 2019 ring-fencing rules apply to losses but the income itself is straightforwardly taxable at trustee/beneficiary rate.",
        "Capital gains note: capital gains on asset disposal (outside bright-line, outside trading) are generally not taxable in NZ. A growth-focused strategy that defers gains over many years may be more efficient than reshuffling high-marginal-rate income.",
        "Timing lever: if beneficiaries' incomes vary year-to-year (e.g. employment changes, retirement, sabbatical), a year with lower income for a specific beneficiary may open the arbitrage again. Monitor annually.",
      ],
      confidence: "HIGH",
      confidenceNote: "All adult beneficiaries at 39% — distribution provides no rate arbitrage. Alternative structures may still help.",
      tier: 147,
      ctaLabel: "Get My Structure Alternative Analysis — $147 →",
      altTierLabel: "Just want the rule? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "IRD_HIGH_RISK") {
    return {
      status: "IRD HIGH RISK — ISSUES RAISED IN PRIOR REVIEW",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `IRD has previously raised issues with your trust distribution pattern. Continuing the same approach carries material risk of adjustment under section BG 1 (general anti-avoidance). While the theoretical rate arbitrage is ${formatNZDPerYear(result.annualSaving)}, the actual position must be rebuilt with genuine distributions, formal resolutions in time, and clean evidence of beneficiary benefit. Address the issues before relying on further distributions.`,
      stats: [
        { label: "Theoretical saving",       value: formatNZDPerYear(result.annualSaving),                  highlight: true },
        { label: "IRD risk rating",           value: "HIGH",                                                   highlight: true },
        { label: "Retained tax position",    value: formatNZD(result.retainedTax),                          highlight: false },
      ],
      consequences: [
        `🔒 IRD has raised issues in your trust's prior review. The most common flags: circular flows (distributions returned to settlor or trust), distributions to beneficiaries with no genuine entitlement or benefit, retrospective resolutions passed after the return was filed, or distributions to beneficiaries whose lifestyle shows no evidence of receiving the income.`,
        "Do NOT simply continue. A pattern that has been flagged will attract heightened scrutiny on subsequent returns. Continuing without change escalates risk from adjustment to penalties and potentially tax avoidance characterisation.",
        "Remedial path: (a) engage a specialist trust tax advisor (not just a general accountant); (b) work with them to restructure distribution arrangements — clean trustee resolutions, genuine beneficiary benefit (payment to beneficiary's own bank account, use for beneficiary's own purposes), clear documentation; (c) consider whether the trust itself is the right structure — a company may be cleaner going forward.",
        "Evidence patterns IRD looks for: (a) beneficiary's bank account shows the distribution amount arriving and being used as the beneficiary's own funds; (b) beneficiary's own tax return declares the income correctly; (c) trustee resolutions dated before the return filing period; (d) no subsequent loan-back or return of funds to the settlor or trust.",
        "Voluntary disclosure: if prior-year returns used arrangements that would now be flagged, voluntary disclosure before IRD re-examines can significantly reduce penalties. Engage counsel first.",
        "BG 1 general anti-avoidance: IRD can void artificial distributions and assess tax at the trustee rate. Penalties start at 20% and can reach 150% of the tax shortfall in abusive tax position cases.",
      ],
      confidence: "LOW",
      confidenceNote: "Prior IRD issues raised — the risk profile requires specialist advice, not generic distribution guidance.",
      tier: 147,
      ctaLabel: "Get My IRD Remediation Plan — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "MIXED_BENEFICIARIES_PARTIAL") {
    return {
      status: "MIXED BENEFICIARIES — PARTIAL ARBITRAGE ON ADULT SHARE",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your trust has both adult and minor beneficiaries. The adult portion can be distributed at the beneficiary's ${result.marginalLabel} marginal rate — but minor distributions are subject to the anti-splitting rule and taxed at 39%. The optimisation is to allocate to adult beneficiaries where possible and accept the 39% on any portion notionally allocated to minors. Partial saving: up to ${formatNZDPerYear(result.annualSaving)} if the full trust income can be legitimately allocated to the adult beneficiary.`,
      stats: [
        { label: "Adult-only saving (theoretical max)", value: formatNZDPerYear(result.annualSaving), highlight: true },
        { label: "Minor portion (always 39%)",           value: "No saving available",                 highlight: true },
        { label: "Retained baseline",                     value: formatNZD(result.retainedTax) },
      ],
      consequences: [
        `⚠ Mixed beneficiary structure — the saving depends on how much of the trust income can legitimately be allocated to the adult beneficiary vs the minor(s).`,
        "Legitimate allocation patterns: (a) allocate ALL trust income to adult beneficiaries if they have clear beneficial interest and the trust deed permits; (b) allocate proportionally based on capital contributions or entitlement — requires careful deed reading; (c) split allocations by income type — passive investment income to adults, retain capital-allocation items.",
        "The minor beneficiary rule applies at the time of allocation. If an under-16 beneficiary receives no allocation in a given year, no attribution or 39% issue arises for that year. A year-by-year allocation decision may avoid the minor issue entirely.",
        "Timing planning: track each minor beneficiary's 16th birthday. Once they turn 16, distributions to them are taxed at their marginal rate (often very low if they have no other income). The arbitrage gradually opens as children age.",
        "Documentation requirement: trustee resolutions must clearly state which beneficiary receives what amount. A vague resolution naming 'the beneficiaries' is not sufficient — IRD requires specific allocations.",
        `Annual maximum saving if all income allocated to adult: ${formatNZDPerYear(result.annualSaving)}. Actual saving depends on allocation structure specified in the trust deed and any minor-specific entitlements.`,
      ],
      confidence: "MEDIUM",
      confidenceNote: "Saving depends on how much income can legitimately be allocated to the adult beneficiary versus minor beneficiaries.",
      tier: 147,
      ctaLabel: "Get My Mixed-Beneficiary Allocation Plan — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // COMPANY_BENEFICIARY_REVIEW
  return {
    status: "COMPANY / TRUST BENEFICIARY — 28% PATH APPLIES",
    statusClass: "text-neutral-700",
    panelClass: "border-neutral-200 bg-neutral-50",
    headline: `Your trust's beneficiary is itself a company or another trust. Company beneficiaries pay the 28% company rate on distributions received (not the settlor's marginal rate). On ${formatNZD(result.trustIncome)} of trust income distributed to a company beneficiary, tax is ${formatNZD(result.trustIncome * COMPANY_RATE)} — a saving of ${formatNZDPerYear(result.retainedTax - result.trustIncome * COMPANY_RATE)} vs the 39% trustee rate. Trust-to-trust distributions have their own specific rules.`,
    stats: [
      { label: "Company beneficiary tax (28%)",   value: formatNZD(result.trustIncome * COMPANY_RATE),                    highlight: true },
      { label: "Saving vs 39% trustee",             value: formatNZDPerYear(result.retainedTax - result.trustIncome * COMPANY_RATE), highlight: true },
      { label: "Retained baseline (39%)",          value: formatNZD(result.retainedTax) },
    ],
    consequences: [
      `✓ Company beneficiary: receives distributions taxed at the 28% company rate, not the settlor's personal marginal rate.`,
      `Saving calculation: ${formatNZD(result.retainedTax)} (trustee) − ${formatNZD(result.trustIncome * COMPANY_RATE)} (company) = ${formatNZDPerYear(result.retainedTax - result.trustIncome * COMPANY_RATE)} saved annually at the 11-percentage-point differential.`,
      "Imputation credits: when the company subsequently distributes dividends to its shareholders, imputation credits for the 28% already paid flow through. If the ultimate shareholders have marginal rates below 28%, they may receive a refund of part of the imputation credit.",
      "Trust-to-trust distributions: these have specific rules under the Income Tax Act 2007. Depending on the relationship between the trusts (settlor, beneficiary, associated), the distribution may be treated as trustee income of the receiving trust (taxed at 39%) or as beneficiary income. Specialist advice required.",
      "Structure review: a trust with a company beneficiary is a common structure for asset protection + tax efficiency. The combined 28% + imputation regime is typically more efficient than a direct 39% trustee retention. However, the administrative burden (two entities, two tax returns) needs to be weighed.",
      "Documentation: trustee resolution, company board minutes accepting the distribution, company accounts showing the distribution as income. Keep for 7 years minimum.",
      "Anti-avoidance check: the structure must be commercially genuine. A company beneficiary that exists only to receive trust distributions and is then drained to the settlor is challenged under BG 1. Company must have genuine commercial purpose and independent operation.",
    ],
    confidence: "MEDIUM",
    confidenceNote: "Company beneficiary path is well-established. Trust-to-trust distributions require specialist analysis of the specific trust deed terms and relationships.",
    tier: 147,
    ctaLabel: "Get My Company-Beneficiary Analysis — $147 →",
    altTierLabel: "Just want the rule? — $67 instead",
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
    id: "trust_income", step: 1, type: "button_group",
    label: "Total trust income this year?",
    subLabel: "Trust net income (after allowable deductions) for the current income year.",
    options: [
      { label: "Under $50,000",        value: "under_50k",  subLabel: "Lower-income trust" },
      { label: "$50,000 – $150,000",    value: "50k_150k",  subLabel: "Typical family trust" },
      { label: "$150,000 – $500,000",   value: "150k_500k", subLabel: "Higher-income trust" },
      { label: "Over $500,000",         value: "over_500k", subLabel: "Substantial annual income" },
    ],
    required: true,
  },
  {
    id: "income_type", step: 2, type: "button_group",
    label: "Income type?",
    subLabel: "Personal services income cannot be split through a trust. Passive income can.",
    options: [
      { label: "Investment income (interest, dividends, managed funds)", value: "investment",         subLabel: "Passive — can be split" },
      { label: "Rental income from property",                              value: "rental",              subLabel: "Passive — can be split (ring-fencing applies)" },
      { label: "Business income passed through trust",                      value: "business",            subLabel: "May be split depending on structure" },
      { label: "Personal services income (professional fees, consulting)", value: "personal_services",  subLabel: "CANNOT be split — PSI rule" },
      { label: "Mixed sources",                                              value: "mixed",                subLabel: "Allocate by stream — advice needed" },
    ],
    required: true,
  },
  {
    id: "beneficiary_comp", step: 3, type: "button_group",
    label: "Beneficiary composition?",
    subLabel: "Adults can receive distributions at personal marginal rates. Minors are subject to anti-splitting rules.",
    options: [
      { label: "Adult beneficiaries only (18+)",            value: "adults_only",         subLabel: "Full arbitrage potentially available" },
      { label: "Mix of adults and minors (under 16)",        value: "adults_and_minors", subLabel: "Partial arbitrage only — track ages" },
      { label: "Minors only (under 16)",                      value: "minors_only",        subLabel: "Anti-splitting — 39% regardless" },
      { label: "Company or trust as beneficiary",             value: "company_or_trust",   subLabel: "Different path — 28% for company" },
    ],
    required: true,
  },
  {
    id: "lowest_marginal", step: 4, type: "button_group",
    label: "Lowest marginal rate among eligible adult beneficiaries?",
    subLabel: "Based on the beneficiary's total annual income excluding any trust distribution. Lower = more arbitrage.",
    options: [
      { label: "10.5% (beneficiary income under $14,000)",      value: "10_5", subLabel: "Maximum arbitrage — 28.5% differential" },
      { label: "17.5% (income $14,001 – $48,000)",                 value: "17_5", subLabel: "Strong arbitrage — 21.5% differential" },
      { label: "30% (income $48,001 – $70,000)",                    value: "30",   subLabel: "Moderate arbitrage — 9% differential" },
      { label: "33% (income $70,001 – $180,000)",                   value: "33",   subLabel: "Marginal arbitrage — 6% differential" },
      { label: "39% (income over $180,000)",                         value: "39",   subLabel: "NO arbitrage — same as trustee rate" },
    ],
    required: true,
  },
  {
    id: "distributing", step: 5, type: "button_group",
    label: "Are distributions currently being made to beneficiaries?",
    subLabel: "Formal trustee resolutions in time = distribution works. Informal or retrospective arrangements fail.",
    options: [
      { label: "Yes — income regularly distributed",          value: "yes",      subLabel: "Optimisation in place" },
      { label: "No — income retained in trust",                value: "no",       subLabel: "Lever is unused" },
      { label: "Partial — some distributed some retained",      value: "partial",  subLabel: "Could be optimised further" },
      { label: "Not sure — trustee handles it",                  value: "not_sure", subLabel: "Verify before this income year ends" },
    ],
    required: true,
  },
  {
    id: "ird_reviewed", step: 6, type: "button_group",
    label: "Has IRD reviewed your trust distribution pattern in the last 3 years?",
    subLabel: "Prior review issues raise audit risk under the general anti-avoidance rule (BG 1).",
    options: [
      { label: "Yes — and no issues raised",          value: "yes_no_issues", subLabel: "Low risk — continue with documentation" },
      { label: "Yes — and issues were raised",          value: "yes_issues",   subLabel: "HIGH RISK — remediation required before further distributions" },
      { label: "No — never reviewed",                    value: "no_never",    subLabel: "Standard case — document well" },
      { label: "Not sure",                                 value: "not_sure",    subLabel: "Verify with accountant" },
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

      {/* Legal anchor banner */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Legal anchor — Income Tax Act 2007, section HC 32 (as amended 2024)</p>
        <div className="space-y-1 text-neutral-800">
          <p><strong>Trustee rate:</strong> 39% from 1 April 2024 (Taxation (Annual Rates for 2023-24, Multinational Tax, and Remedial Matters) Act 2024)</p>
          <p><strong>Beneficiary rates:</strong> 10.5% / 17.5% / 30% / 33% / 39% by total income</p>
          <p><strong>Anti-splitting (minors under 16):</strong> attributed to settlor or taxed at 39%</p>
          <p><strong>General anti-avoidance:</strong> BG 1 — artificial distributions voided</p>
          <p><strong>Timing:</strong> resolutions required within tax return filing period</p>
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

      {/* Before/After comparison */}
      {verdict.result.annualSaving > 0 && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Retained at 39% vs distributed at {verdict.result.marginalLabel}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-red-700">Retained (trustee 39%)</p>
              <ul className="space-y-1 text-xs text-red-900">
                <li>Trust income: {formatNZD(verdict.result.trustIncome)}</li>
                <li>Tax: {formatNZD(verdict.result.retainedTax)}</li>
                <li>After tax: {formatNZD(verdict.result.retainedAfterTax)}</li>
                <li className="font-bold mt-1 pt-1 border-t border-red-200">Effective rate: 39%</li>
              </ul>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-700">Distributed ({verdict.result.marginalLabel})</p>
              <ul className="space-y-1 text-xs text-emerald-900">
                <li>Trust income: {formatNZD(verdict.result.trustIncome)}</li>
                <li>Tax: {formatNZD(verdict.result.optimalTax)}</li>
                <li>After tax: {formatNZD(verdict.result.optimalAfterTax)}</li>
                <li className="font-bold mt-1 pt-1 border-t border-emerald-200">Effective rate: {verdict.result.marginalLabel}</li>
              </ul>
            </div>
          </div>
          <p className="mt-2 text-center text-sm font-bold text-neutral-950">
            Annual saving: {formatNZDPerYear(verdict.result.annualSaving)} · 10-year compounded: {formatNZD(verdict.result.tenYearSaving)}
          </p>
        </div>
      )}

      {/* Audit risk box */}
      <div className={`mb-4 rounded-xl border px-4 py-3 text-xs ${
        verdict.result.audit_risk === "high" ? "border-red-300 bg-red-50"
        : verdict.result.audit_risk === "medium" ? "border-amber-200 bg-amber-50"
        : "border-emerald-200 bg-emerald-50"
      }`}>
        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-500">IRD audit risk rating</p>
        <p className={`font-bold uppercase ${
          verdict.result.audit_risk === "high" ? "text-red-700"
          : verdict.result.audit_risk === "medium" ? "text-amber-700"
          : "text-emerald-700"
        }`}>{verdict.result.audit_risk}</p>
        <p className="mt-1 text-neutral-700">{verdict.result.timingRecommendation}</p>
      </div>

      {/* IRD scrutiny warning */}
      <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-xs">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">⚠ IRD scrutiny of trust distributions</p>
        <p className="text-amber-900 leading-relaxed">
          Under section BG 1 (general anti-avoidance), IRD can void artificial distributions and assess tax at the trustee rate plus penalties. Watch-outs: circular flows (income distributed then returned), non-commercial arrangements, distributions to beneficiaries who receive no actual benefit, retrospective resolutions after filing. Income must genuinely belong to the beneficiary and they must genuinely receive it.
        </p>
      </div>

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
          <strong className="text-neutral-950">Rate arbitrage is a 39% vs marginal-rate decision — taken annually.</strong> Correct distribution saves $21,500+ per year on $100k. Wrong distribution (minors, personal services, retrospective) saves nothing and attracts audit risk. The resolution must be passed in time with genuine benefit to the beneficiary.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Which of the decision paths applies (A-G) with specific reasoning</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Annual tax saving + 10-year compounded projection</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Trustee resolution template + timing checklist</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>IRD audit-defence documentation pack</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Alternative structures (company, multi-entity) if arbitrage blocked</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 accountant questions specific to your situation</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} NZD · One-time · Built around your exact trust and beneficiaries</p>
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

export default function TrustTaxSplitterCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ trustee_role: "", urgency: "", accountant: "" });
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
        product_slug: "trust-tax-splitter",
        source_path: "/nz/check/trust-tax-splitter",
        country_code: "NZ", currency_code: "NZD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          decision_status: verdict.result.status,
          trust_income: verdict.result.trustIncome,
          retained_tax: verdict.result.retainedTax,
          optimal_tax: verdict.result.optimalTax,
          annual_saving: verdict.result.annualSaving,
          ten_year_saving: verdict.result.tenYearSaving,
          audit_risk: verdict.result.audit_risk,
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
      body: JSON.stringify({ email, source: "trust_tax_splitter", country_code: "NZ", site: "taxchecknow" }),
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
    const sid = sessionId || `trust_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("trust-tax-splitter_trust_income", String(answers.trust_income || ""));
    sessionStorage.setItem("trust-tax-splitter_income_type", String(answers.income_type || ""));
    sessionStorage.setItem("trust-tax-splitter_beneficiary_comp", String(answers.beneficiary_comp || ""));
    sessionStorage.setItem("trust-tax-splitter_lowest_marginal", String(answers.lowest_marginal || ""));
    sessionStorage.setItem("trust-tax-splitter_distributing", String(answers.distributing || ""));
    sessionStorage.setItem("trust-tax-splitter_ird_reviewed", String(answers.ird_reviewed || ""));
    sessionStorage.setItem("trust-tax-splitter_decision_status", verdict.result.status);
    sessionStorage.setItem("trust-tax-splitter_annual_saving", String(Math.round(verdict.result.annualSaving)));
    sessionStorage.setItem("trust-tax-splitter_ten_year_saving", String(Math.round(verdict.result.tenYearSaving)));
    sessionStorage.setItem("trust-tax-splitter_audit_risk", verdict.result.audit_risk);
    sessionStorage.setItem("trust-tax-splitter_status", verdict.status);
    sessionStorage.setItem("trust-tax-splitter_tier", String(popupTier));

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
          success_url: `${window.location.origin}/nz/check/trust-tax-splitter/success/${successPath}`,
          cancel_url: `${window.location.origin}/nz/check/trust-tax-splitter`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your trust allocation analysis for your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your decision path and saving math by email — free.</p>
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
                    {popupTier === 67 ? "Your Trust Allocation Pack" : "Your Trust Allocation + Alternative-Structure Pack"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">IRD · Income Tax Act 2007 HC 32 · April 2026</p>
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
                      {popupTier === 67 ? "Trust Allocation Pack™" : "Trust Allocation + Alternative-Structure Pack™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your decision path (A-G), annual saving + 10-year compound projection, trustee resolution template, timing checklist, and 5 accountant questions — built around your exact income type, beneficiaries, and rates."
                        : "Full strategy: decision path + alternative structures (company 28%, multi-entity) + imputation credit mapping + IRD audit-defence documentation + mixed-beneficiary allocation plan + accountant coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier} NZD</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic trust advice. Your specific decision path, math, and audit-defence pack.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Allocation Decision →" : "Get My Trust Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the decision? — $67 instead" : "Want the full strategy + alternatives? — $147 instead"}
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
                    { label: "Your role", key: "trustee_role", options: [["settlor","Settlor / founder"],["trustee","Trustee"],["beneficiary","Beneficiary"],["advisor","Advisor / accountant"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["year_end","Tax year-end approaching"],["filing_soon","Trust return due soon"],["planning","Planning next year"]] },
                    { label: "Do you have a trust accountant?", key: "accountant", options: [["specialist","Yes — specialist trust accountant"],["general","Yes — general accountant"],["diy","Self-managed"],["none","No — need one"]] },
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
      {showVerdict && verdict && verdict.result.annualSaving > 5_000 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Annual saving available</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatNZDPerYear(verdict.result.annualSaving)} · {formatNZD(verdict.result.tenYearSaving)} over 10 years
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
