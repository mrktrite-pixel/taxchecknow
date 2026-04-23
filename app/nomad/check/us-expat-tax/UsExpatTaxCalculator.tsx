"use client";

/**
 * NOMAD-08 — US Citizen Abroad Optimizer
 * Pattern: CashflowModel + Classification -> FEIE vs FTC vs Hybrid recommendation
 *
 * Legal anchor: IRC §911 (FEIE) + IRC §901 (FTC) + IRC §904 (FTC limitation)
 *
 * DETERMINATION ORDER:
 *   1. Passive-only income -> FTC only (FEIE doesn't cover passive)
 *   2. FEIE days not met (under 330) -> FTC only path
 *   3. Zero/low-tax country + earned income -> FEIE typically optimal
 *   4. High-tax country + earned income -> FTC typically optimal
 *   5. Above FEIE limit + passive component -> Hybrid
 *   6. First year / uncertain -> show 3-way comparison
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type Status =
  | "FTC_RECOMMENDED_HIGH_TAX"
  | "FEIE_RECOMMENDED_LOW_TAX"
  | "HYBRID_RECOMMENDED"
  | "FEIE_NOT_AVAILABLE_DAYS"
  | "PASSIVE_INCOME_ONLY_FTC"
  | "FIRST_YEAR_COMPARE";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface OptimResult {
  residenceCountry: string;
  incomeType:         string;
  annualIncome:       string;
  foreignTaxRate:     string;
  currentMethod:      string;
  hasPassiveIncome:   string;
  daysAbroad:         string;

  incomeMidpoint:     number;
  foreignRatePct:     number;      // effective foreign rate as decimal
  usEffectiveRate:    number;      // US federal effective rate approximation
  feieExclusion:      number;      // 2026 = 126500

  // Computed outcomes
  feieUsTax:          number;      // US tax under FEIE
  feieForeignTax:     number;      // foreign tax paid (not creditable)
  feieTotal:          number;
  feieWastedCredits:  number;      // UK/foreign tax on excluded income

  ftcUsTax:           number;      // US tax under FTC (post-credit)
  ftcForeignTax:      number;
  ftcTotal:           number;
  ftcCarryforward:    number;

  hybridUsTax:        number;
  hybridForeignTax:   number;
  hybridTotal:        number;

  // Recommendation
  status:             Status;
  statusLabel:        string;
  recommendedMethod:  "FEIE" | "FTC" | "HYBRID";
  annualSaving:       number;      // vs current method, if different

  reasoningChain:     Array<{ layer: string; outcome: string; resolved: boolean }>;
  routes:             Route[];
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
  result: OptimResult;
}

interface PopupAnswers {
  filing_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "nomad_67_us_expat_tax",
  p147: "nomad_147_us_expat_tax",
};

const FEIE_2026 = 126500;

const INCOME_MIDPOINT: Record<string, number> = {
  under_80k:           60000,
  "80k_to_126500":     103250,
  "126500_to_200k":    163250,
  over_200k:           300000,
};

const INCOME_LABEL: Record<string, string> = {
  under_80k:           "Under $80,000",
  "80k_to_126500":     "$80,000-$126,500",
  "126500_to_200k":    "$126,500-$200,000",
  over_200k:           "Over $200,000",
};

const FOREIGN_RATE: Record<string, number> = {
  zero:       0,
  under_15:   0.12,
  "15_to_25": 0.20,
  "25_to_35": 0.30,
  over_35:    0.40,
};

const COUNTRY_LABEL: Record<string, string> = {
  uk_ie:      "United Kingdom / Ireland",
  high_eu:    "Germany / France / high-tax EU",
  au_nz_ca:   "Australia / New Zealand / Canada",
  zero_tax:   "UAE / Saudi Arabia / zero-tax",
  low_asia:   "Singapore / Hong Kong / low-tax Asia",
  other:      "Other",
};

// US federal effective rate approximation (single filer, 2026 brackets, simplified)
function usEffectiveRate(income: number): number {
  if (income <= 50000) return 0.11;
  if (income <= 100000) return 0.16;
  if (income <= 200000) return 0.21;
  if (income <= 400000) return 0.27;
  return 0.31;
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function calcOptim(answers: AnswerMap): OptimResult {
  const residenceCountry = String(answers.residence_country || "uk_ie");
  const incomeType       = String(answers.income_type        || "employment");
  const annualIncome     = String(answers.annual_income       || "126500_to_200k");
  const foreignTaxRate   = String(answers.foreign_tax_rate    || "over_35");
  const currentMethod    = String(answers.current_method      || "feie");
  const hasPassiveIncome = String(answers.has_passive_income  || "no");
  const daysAbroad       = String(answers.days_abroad          || "330_plus");

  const incomeMidpoint = INCOME_MIDPOINT[annualIncome] ?? 163250;
  const foreignRatePct = FOREIGN_RATE[foreignTaxRate] ?? 0.40;
  const usRate         = usEffectiveRate(incomeMidpoint);
  const feieExclusion  = FEIE_2026;

  // Passive vs earned split (rough allocation for modelling)
  const passiveFraction = hasPassiveIncome === "significant" ? 0.30 : hasPassiveIncome === "some" ? 0.10 : 0;
  const passiveIncome = incomeMidpoint * passiveFraction;
  const earnedIncome  = incomeMidpoint - passiveIncome;
  const feieExcluded  = Math.min(earnedIncome, feieExclusion);
  const earnedAboveFeie = Math.max(0, earnedIncome - feieExclusion);

  // FEIE-only (applied to earned only — passive fully taxed by US + FTC on passive tax)
  const feieUsTaxableEarned = earnedAboveFeie;
  const feieUsTaxablePassive = passiveIncome;
  const feieUsTax = (feieUsTaxableEarned + feieUsTaxablePassive) * usRate;
  const feieForeignTax = incomeMidpoint * foreignRatePct;
  // Wasted credits are foreign tax on excluded earned income
  const feieWastedCredits = feieExcluded * foreignRatePct;
  const feieTotal = feieUsTax + feieForeignTax - Math.max(0, Math.min(feieForeignTax - feieWastedCredits, feieUsTax)); // crude: FTC on non-excluded portion can still offset US tax
  // Simpler model: total tax = US tax + foreign tax (no US credit for excluded; creditable portion offsets US portion)
  const nonExcludedForeignTax = feieForeignTax - feieWastedCredits;
  const feieCreditUsed = Math.min(nonExcludedForeignTax, feieUsTax);
  const feieTotalSimple = feieForeignTax + (feieUsTax - feieCreditUsed);

  // FTC-only
  const ftcUsTax = incomeMidpoint * usRate;
  const ftcForeignTax = incomeMidpoint * foreignRatePct;
  const ftcCreditUsed = Math.min(ftcForeignTax, ftcUsTax);
  const ftcTotal = ftcForeignTax + (ftcUsTax - ftcCreditUsed);
  const ftcCarryforward = Math.max(0, ftcForeignTax - ftcUsTax);

  // Hybrid (FEIE on earned up to limit + FTC on above-limit and passive)
  const hybridUsTaxableEarned = earnedAboveFeie;
  const hybridUsTaxablePassive = passiveIncome;
  const hybridUsTax = (hybridUsTaxableEarned + hybridUsTaxablePassive) * usRate;
  const hybridForeignTax = incomeMidpoint * foreignRatePct;
  // Foreign tax attributable to non-excluded income only (earned above FEIE + passive)
  const hybridCreditable = (earnedAboveFeie + passiveIncome) * foreignRatePct;
  const hybridCreditUsed = Math.min(hybridCreditable, hybridUsTax);
  const hybridTotal = hybridForeignTax + (hybridUsTax - hybridCreditUsed);

  const reasoningChain: OptimResult["reasoningChain"] = [];

  let status: Status | null = null;
  let statusLabel = "";
  let recommendedMethod: "FEIE" | "FTC" | "HYBRID" = "FTC";

  // LAYER 1 — passive only (FTC only path)
  if (incomeType === "passive_only") {
    reasoningChain.push({ layer: "Layer 1 — Income type", outcome: "Primarily passive income — FEIE does not apply to dividends, interest, capital gains, or rental income. FTC is the only mechanism available.", resolved: true });
    status = "PASSIVE_INCOME_ONLY_FTC";
    statusLabel = "PASSIVE INCOME ONLY — FTC REQUIRED";
    recommendedMethod = "FTC";
  } else {
    reasoningChain.push({ layer: "Layer 1 — Income type", outcome: "Earned income or mixed — both FEIE and FTC are potential mechanisms", resolved: false });
  }

  // LAYER 2 — FEIE days not met
  if (status === null && daysAbroad === "under_330") {
    reasoningChain.push({ layer: "Layer 2 — FEIE qualification", outcome: "Under 330 days in foreign countries — physical presence test not met. FEIE unavailable unless bona fide residence test is established separately.", resolved: true });
    status = "FEIE_NOT_AVAILABLE_DAYS";
    statusLabel = "FEIE NOT AVAILABLE — PHYSICAL PRESENCE TEST NOT MET";
    recommendedMethod = "FTC";
  } else if (status === null) {
    reasoningChain.push({ layer: "Layer 2 — FEIE qualification", outcome: daysAbroad === "bona_fide" ? "Using bona fide residence test — FEIE available" : "Physical presence test met (330+ days) — FEIE available", resolved: false });
  }

  // LAYER 3 — Hybrid path when above FEIE limit OR has passive income
  if (status === null && (annualIncome === "over_200k" || (annualIncome === "126500_to_200k" && hasPassiveIncome !== "no") || hasPassiveIncome === "significant")) {
    // Choose between hybrid and pure FTC — whichever is lower
    if (hybridTotal < ftcTotal && hybridTotal < feieTotalSimple) {
      reasoningChain.push({ layer: "Layer 3 — Strategy comparison", outcome: `Hybrid (FEIE + FTC) total ${usd(hybridTotal)} vs FTC-only ${usd(ftcTotal)} vs FEIE-only ${usd(feieTotalSimple)} — hybrid gives lowest total tax`, resolved: true });
      status = "HYBRID_RECOMMENDED";
      statusLabel = "HYBRID RECOMMENDED — FEIE + FTC COMBINATION";
      recommendedMethod = "HYBRID";
    }
  }

  // LAYER 4 — high-tax country -> FTC typically optimal
  if (status === null && foreignRatePct >= 0.25) {
    reasoningChain.push({ layer: "Layer 3 — Strategy comparison", outcome: `High-tax country (foreign rate ~${Math.round(foreignRatePct * 100)}% vs US rate ~${Math.round(usRate * 100)}%) — FEIE total ${usd(feieTotalSimple)} vs FTC total ${usd(ftcTotal)} (+${usd(ftcCarryforward)} carryforward)`, resolved: true });
    status = "FTC_RECOMMENDED_HIGH_TAX";
    statusLabel = "FTC RECOMMENDED — HIGH-TAX COUNTRY";
    recommendedMethod = "FTC";
  }

  // LAYER 5 — low/zero-tax country -> FEIE typically optimal
  if (status === null && foreignRatePct < 0.20) {
    reasoningChain.push({ layer: "Layer 3 — Strategy comparison", outcome: `Low-tax country (foreign rate ~${Math.round(foreignRatePct * 100)}% vs US rate ~${Math.round(usRate * 100)}%) — FEIE total ${usd(feieTotalSimple)} vs FTC total ${usd(ftcTotal)}. FEIE eliminates US tax on excluded income without needing foreign credit.`, resolved: true });
    status = "FEIE_RECOMMENDED_LOW_TAX";
    statusLabel = "FEIE RECOMMENDED — LOW/ZERO-TAX COUNTRY";
    recommendedMethod = "FEIE";
  }

  // LAYER 6 — moderate-tax / first year / uncertain -> compare
  if (status === null) {
    // Pick lowest of the three
    const options = [
      { method: "FEIE" as const, total: feieTotalSimple },
      { method: "FTC" as const, total: ftcTotal },
      { method: "HYBRID" as const, total: hybridTotal },
    ];
    options.sort((a, b) => a.total - b.total);
    const best = options[0];
    recommendedMethod = best.method;
    reasoningChain.push({ layer: "Layer 3 — Strategy comparison", outcome: `Moderate-tax scenario — 3-way comparison: FEIE ${usd(feieTotalSimple)} | FTC ${usd(ftcTotal)} | Hybrid ${usd(hybridTotal)} — ${best.method} gives lowest total ${usd(best.total)}`, resolved: true });
    status = best.method === "HYBRID" ? "HYBRID_RECOMMENDED" : best.method === "FTC" ? "FTC_RECOMMENDED_HIGH_TAX" : "FEIE_RECOMMENDED_LOW_TAX";
    statusLabel = best.method === "HYBRID" ? "HYBRID RECOMMENDED — 3-WAY COMPARISON" : best.method === "FTC" ? "FTC RECOMMENDED — COMPARISON RESULT" : "FEIE RECOMMENDED — COMPARISON RESULT";
  }

  // Compute annual saving vs current method (if different)
  const currentTotal = currentMethod === "feie" ? feieTotalSimple : currentMethod === "ftc" ? ftcTotal : currentMethod === "hybrid" ? hybridTotal : ftcTotal;
  const recommendedTotal = recommendedMethod === "FEIE" ? feieTotalSimple : recommendedMethod === "FTC" ? ftcTotal : hybridTotal;
  const annualSaving = Math.max(0, currentTotal - recommendedTotal);

  if (annualSaving > 0) {
    reasoningChain.push({ layer: "Layer 4 — Current method impact", outcome: `Switching from ${currentMethod.toUpperCase()} to ${recommendedMethod} saves approximately ${usd(annualSaving)} per year`, resolved: true });
  }

  // Routing
  const routes: Route[] = [];
  if (status === "FEIE_NOT_AVAILABLE_DAYS") {
    routes.push({ label: "FEIE Nomad Auditor — qualification check", href: "/us/check/feie-nomad-auditor", note: "Verify physical presence or bona fide residence qualification" });
    routes.push({ label: "US Section 174 Auditor — R&D tax treatment", href: "/us/check/section-174-auditor", note: "If self-employed with R&D expenses" });
  } else if (status === "PASSIVE_INCOME_ONLY_FTC") {
    routes.push({ label: "FEIE Nomad Auditor — days check if earned income appears later", href: "/us/check/feie-nomad-auditor", note: "Future-proofing if income mix changes" });
    routes.push({ label: "Tax Treaty Navigator — passive income allocation", href: "/nomad/check/tax-treaty-navigator", note: "Treaty rules for dividends, interest, royalties" });
  } else {
    routes.push({ label: "FEIE Nomad Auditor — days + bona fide residence", href: "/us/check/feie-nomad-auditor", note: "Verify FEIE eligibility details" });
    routes.push({ label: "Tax Treaty Navigator — double tax allocation", href: "/nomad/check/tax-treaty-navigator", note: "Treaty overrides may affect FEIE/FTC analysis" });
    routes.push({ label: "183-Day Rule Reality Check", href: "/nomad/check/183-day-rule", note: "Confirm country residency position" });
  }
  routes.push({ label: "← Back to Nomad Residency Risk Index", href: "/nomad", note: "Reclassify with updated answers" });

  return {
    residenceCountry, incomeType, annualIncome, foreignTaxRate, currentMethod, hasPassiveIncome, daysAbroad,
    incomeMidpoint, foreignRatePct, usEffectiveRate: usRate, feieExclusion,
    feieUsTax, feieForeignTax, feieTotal: feieTotalSimple, feieWastedCredits,
    ftcUsTax, ftcForeignTax, ftcTotal, ftcCarryforward,
    hybridUsTax, hybridForeignTax, hybridTotal,
    status: status ?? "FIRST_YEAR_COMPARE",
    statusLabel,
    recommendedMethod,
    annualSaving,
    reasoningChain,
    routes,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcOptim(answers);

  const headline = (() => {
    if (result.status === "FTC_RECOMMENDED_HIGH_TAX") return `You are in a high-tax country (~${Math.round(result.foreignRatePct * 100)}% effective foreign rate). FTC is typically better than FEIE in this environment — foreign taxes fully offset US liability and excess credits carry forward 10 years. FEIE wastes credits on income up to $${FEIE_2026.toLocaleString()}. Under your profile: FEIE total ≈ ${usd(result.feieTotal)}; FTC total ≈ ${usd(result.ftcTotal)} (plus ${usd(result.ftcCarryforward)} carryforward). ${result.annualSaving > 0 ? `Switching to FTC saves approximately ${usd(result.annualSaving)} per year.` : ""}`;
    if (result.status === "FEIE_RECOMMENDED_LOW_TAX") return `You are in a low or zero-tax country (~${Math.round(result.foreignRatePct * 100)}% effective foreign rate). FEIE is typically better than FTC in this environment — FTC provides little or no credit to offset US tax because foreign tax is low. FEIE excludes the first $${FEIE_2026.toLocaleString()} of earned income from US tax. Under your profile: FEIE total ≈ ${usd(result.feieTotal)}; FTC total ≈ ${usd(result.ftcTotal)}. ${result.annualSaving > 0 ? `Switching to FEIE saves approximately ${usd(result.annualSaving)} per year.` : ""}`;
    if (result.status === "HYBRID_RECOMMENDED") return `A hybrid FEIE + FTC approach is optimal for your profile — FEIE on earned income up to $${FEIE_2026.toLocaleString()} plus FTC on income above the limit and on all passive income. Under your profile: FEIE-only ≈ ${usd(result.feieTotal)} | FTC-only ≈ ${usd(result.ftcTotal)} | Hybrid ≈ ${usd(result.hybridTotal)}. ${result.annualSaving > 0 ? `Switching to Hybrid saves approximately ${usd(result.annualSaving)} per year.` : ""}`;
    if (result.status === "FEIE_NOT_AVAILABLE_DAYS") return `You do not meet the 330-day physical presence test for FEIE. Unless you qualify under the bona fide residence test (established foreign residency for a full tax year with no clear plan to return to the US), FEIE is not available. FTC is the only mechanism for reducing US tax on your foreign income. Run the FEIE Nomad Auditor to confirm qualification.`;
    if (result.status === "PASSIVE_INCOME_ONLY_FTC") return `You have primarily passive income (dividends, interest, capital gains, rental). FEIE does not apply to passive income under any circumstances — it covers earned income only (wages, salary, net self-employment). FTC is the only mechanism available for reducing US tax on your foreign passive income.`;
    return `Your US expat tax position requires a full comparison across FEIE, FTC, and Hybrid strategies. Under your profile: FEIE ≈ ${usd(result.feieTotal)} | FTC ≈ ${usd(result.ftcTotal)} | Hybrid ≈ ${usd(result.hybridTotal)}.`;
  })();

  const consequences: string[] = [];

  if (result.status === "FTC_RECOMMENDED_HIGH_TAX") {
    consequences.push(`✓ FTC optimal: foreign tax paid ≈ ${usd(result.ftcForeignTax)} fully offsets US tax ≈ ${usd(result.ftcUsTax)}; excess ≈ ${usd(result.ftcCarryforward)} carries forward 10 years.`);
    consequences.push(`Form 1116 replaces Form 2555. Allocate foreign income into correct baskets (general vs passive). FTC carryforward tracked separately by basket.`);
    if (result.currentMethod === "feie") {
      consequences.push(`⚠ Currently using FEIE: wasting ~${usd(result.feieWastedCredits)} of foreign tax credits annually. Consider switching. Note: revoking FEIE requires IRS consent to re-elect within 5 years — plan the switch to be permanent.`);
      consequences.push(`Potential amendment opportunity: prior-year returns within 3 years of filing can be amended to claim FTC. Refunds capped at amounts paid in amended years.`);
    }
    consequences.push(`Housing exclusion under §911(c) still worth considering for certain high-cost cities if FEIE is used for any portion of income — but in pure-FTC strategy the housing exclusion is also waived.`);
    consequences.push(`FBAR (FinCEN 114) remains required if aggregate foreign accounts exceed $10,000. Form 8938 (FATCA) if specified foreign financial assets exceed thresholds ($200k/$400k single/joint abroad).`);
    consequences.push(`PFIC watch: hold non-US mutual funds/ETFs? Form 8621 + punitive tax treatment. Usually better to hold via US-domiciled brokerage (Interactive Brokers, Schwab International).`);
    consequences.push(`Multi-year FTC carryforward is a major latent asset — track by basket (general, passive, other). Useful if you later return to the US or have a high-US-tax year.`);
  } else if (result.status === "FEIE_RECOMMENDED_LOW_TAX") {
    consequences.push(`✓ FEIE optimal: exclude first $${FEIE_2026.toLocaleString()} of earned income; US tax only applies to earned income above that limit and any passive income.`);
    consequences.push(`Form 2555 election. Housing exclusion under §911(c) can add $15k-$50k+ more exclusion for high-cost cities — model if applicable.`);
    if (result.currentMethod === "ftc") {
      consequences.push(`⚠ Currently using FTC: missing ~${usd(result.annualSaving)} per year. With no meaningful foreign tax to credit, FTC provides little benefit in your country.`);
    }
    consequences.push(`FBAR required at $10,000 aggregate; Form 8938 if specified foreign assets exceed thresholds.`);
    consequences.push(`Self-employment tax (15.3%) still applies to net SE income regardless of FEIE — totalization agreement with your country may exempt.`);
    consequences.push(`PFIC watch: same caution as FTC path. Avoid non-US mutual funds/ETFs to prevent complex punitive tax regime.`);
    consequences.push(`If your country later raises its tax rates or you move to a high-tax country, re-model FEIE vs FTC annually.`);
  } else if (result.status === "HYBRID_RECOMMENDED") {
    consequences.push(`✓ Hybrid optimal: FEIE on earned income up to $${FEIE_2026.toLocaleString()} + FTC on earned income above that limit AND all passive income.`);
    consequences.push(`Both Form 2555 (FEIE) and Form 1116 (FTC) filed together. Income allocation must be precise — foreign taxes paid split pro-rata between excluded and non-excluded income.`);
    consequences.push(`Hybrid total ≈ ${usd(result.hybridTotal)} vs FEIE-only ${usd(result.feieTotal)} vs FTC-only ${usd(result.ftcTotal)}.`);
    consequences.push(`Passive income baskets tracked separately under FTC (IRC §904 category limits) — passive basket credits cannot be used against general basket income.`);
    consequences.push(`FBAR + Form 8938 filing obligations unchanged — thresholds apply regardless of strategy.`);
    consequences.push(`Annual re-modelling recommended — income mix and foreign rates can shift optimal strategy over time.`);
  } else if (result.status === "FEIE_NOT_AVAILABLE_DAYS") {
    consequences.push(`🔒 FEIE unavailable: physical presence test requires 330 full days in foreign countries in any 12-month period; bona fide residence is an alternative qualification.`);
    consequences.push(`FTC becomes the default strategy regardless of country. Effective in high-tax countries; less effective in low-tax countries but still the only option.`);
    consequences.push(`Bona fide residence qualification: established foreign residency for a complete tax year + no defined plan to return to the US. Typically applies to longer-term expats with local employment, family ties, etc.`);
    consequences.push(`If you anticipate 330+ days next year, plan to claim FEIE then. Short-term situation may not allow FEIE for current year.`);
    consequences.push(`FBAR + Form 8938 still required — filing obligation independent of FEIE/FTC.`);
  } else if (result.status === "PASSIVE_INCOME_ONLY_FTC") {
    consequences.push(`🔒 FEIE does not apply: covers earned income only. Your dividends, interest, capital gains, and rental income fall outside FEIE scope regardless of country or day count.`);
    consequences.push(`FTC on Form 1116 (passive basket) is the only mechanism. Foreign tax paid on passive income credits US tax on that passive income.`);
    consequences.push(`Passive basket FTC cannot be used against general basket income (earned). Basket rules are strict under IRC §904.`);
    consequences.push(`PFIC exposure critical if any non-US mutual funds or ETFs are held — Form 8621 required per fund + punitive default tax treatment unless QEF or Mark-to-Market election.`);
    consequences.push(`Rental income: depreciation claimed at US rules; foreign tax on rental income credits against US tax on rental income (same basket).`);
    consequences.push(`FBAR + Form 8938 still required on foreign accounts/assets.`);
  }

  const statusClass = result.status === "FEIE_NOT_AVAILABLE_DAYS" ? "text-amber-700" : (result.recommendedMethod === "FTC" ? "text-emerald-700" : result.recommendedMethod === "FEIE" ? "text-emerald-700" : "text-emerald-700");
  const panelClass  = result.status === "FEIE_NOT_AVAILABLE_DAYS" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50";

  const isHighImpact = result.annualSaving >= 3000;
  const confidence: ConfidenceLevel = result.status === "FIRST_YEAR_COMPARE" ? "MEDIUM" : result.status === "FEIE_NOT_AVAILABLE_DAYS" ? "MEDIUM" : "HIGH";
  const confidenceNote = result.status === "FIRST_YEAR_COMPARE"
    ? "Close-call scenario — re-model annually as income and rates change."
    : result.status === "FEIE_NOT_AVAILABLE_DAYS"
      ? "FEIE qualification is the gating issue — confirm via FEIE Nomad Auditor."
      : "Strategy optimality determined by foreign tax rate, income type, and income level.";

  // Tier selection
  const tier2Triggers = [
    result.hasPassiveIncome === "significant",
    result.annualIncome === "over_200k",
    result.incomeType === "mixed",
    result.currentMethod === "feie" && result.foreignRatePct >= 0.30,
    isHighImpact,
    result.status === "HYBRID_RECOMMENDED",
  ];
  const tier: Tier = tier2Triggers.some(Boolean) ? 147 : 67;

  return {
    status: result.statusLabel,
    statusClass,
    panelClass,
    headline,
    stats: [
      { label: "Recommended method",         value: result.recommendedMethod,                                                                                                                                                         highlight: result.currentMethod !== result.recommendedMethod.toLowerCase() },
      { label: "Annual saving vs current",    value: result.annualSaving > 0 ? usd(result.annualSaving) : "$0",                                                                                                                          highlight: result.annualSaving >= 3000 },
      { label: "FTC carryforward generated",   value: result.recommendedMethod === "FTC" ? usd(result.ftcCarryforward) + "/yr" : result.recommendedMethod === "HYBRID" ? "partial" : "$0"                                                                                                                                                            },
    ],
    consequences,
    confidence,
    confidenceNote,
    tier,
    ctaLabel: tier === 147 ? "Get My Global Tax Optimization System — $147 →" : "Get My US Expat Tax Report — $67 →",
    altTierLabel: tier === 147 ? "Just want the strategy report? — $67 instead" : "Want the full optimisation system? — $147",
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
    id: "residence_country", step: 1, type: "button_group",
    label: "Country of residence",
    subLabel: "Foreign country's effective tax rate is the single biggest driver of FEIE vs FTC optimal choice.",
    options: [
      { label: "United Kingdom / Ireland",                value: "uk_ie",     subLabel: "High-tax — FTC typically optimal" },
      { label: "Germany / France / high-tax EU",            value: "high_eu",   subLabel: "High-tax — FTC typically optimal" },
      { label: "Australia / New Zealand / Canada",           value: "au_nz_ca", subLabel: "Moderate to high — analysis needed" },
      { label: "UAE / Saudi Arabia / zero-tax",               value: "zero_tax", subLabel: "Zero-tax — FEIE typically optimal" },
      { label: "Singapore / Hong Kong / low-tax Asia",        value: "low_asia", subLabel: "Low-tax — FEIE typically optimal" },
      { label: "Other",                                         value: "other",    subLabel: "Analysis depends on effective rate" },
    ],
    required: true,
  },
  {
    id: "income_type", step: 2, type: "button_group",
    label: "Primary income type",
    subLabel: "FEIE covers earned income only (wages, self-employment). FTC covers all income types including passive.",
    options: [
      { label: "Employment salary (W-2 equivalent)",          value: "employment",    subLabel: "Earned — FEIE eligible" },
      { label: "Self-employment / freelance",                    value: "self_employed", subLabel: "Earned — FEIE eligible but SE tax applies" },
      { label: "Business owner (pass-through)",                    value: "business_owner", subLabel: "Earned from services; dividends separate" },
      { label: "Mix of earned + investment/passive",                value: "mixed",           subLabel: "Hybrid strategy likely optimal" },
      { label: "Primarily investment/passive income",                value: "passive_only",    subLabel: "FEIE does NOT apply — FTC only" },
    ],
    required: true,
  },
  {
    id: "annual_income", step: 3, type: "button_group",
    label: "Annual gross income (USD equivalent)",
    subLabel: "Determines whether FEIE exclusion fully covers your earned income or partial US tax remains.",
    options: [
      { label: "Under $80,000",                            value: "under_80k",        subLabel: "FEIE may fully exclude earned" },
      { label: "$80,000-$126,500",                          value: "80k_to_126500",   subLabel: "At/below FEIE 2026 limit" },
      { label: "$126,500-$200,000",                          value: "126500_to_200k",  subLabel: "Above limit — partial or hybrid" },
      { label: "Over $200,000",                               value: "over_200k",        subLabel: "Hybrid strategy typically needed" },
    ],
    required: true,
  },
  {
    id: "foreign_tax_rate", step: 4, type: "button_group",
    label: "Estimated effective foreign tax rate on your income",
    subLabel: "Effective rate after deductions/credits in the foreign country. This is the key variable for FEIE vs FTC.",
    options: [
      { label: "0% (zero-tax country)",               value: "zero",      subLabel: "FEIE optimal" },
      { label: "Under 15%",                             value: "under_15",  subLabel: "FEIE typically optimal" },
      { label: "15%-25%",                                value: "15_to_25", subLabel: "Borderline — detailed comparison needed" },
      { label: "25%-35%",                                value: "25_to_35", subLabel: "FTC typically optimal" },
      { label: "Over 35% (high-tax country)",             value: "over_35",  subLabel: "FTC clearly optimal" },
    ],
    required: true,
  },
  {
    id: "current_method", step: 5, type: "button_group",
    label: "Do you currently use FEIE or FTC?",
    subLabel: "Many expats inherit FEIE by default. Often not optimal — especially in high-tax countries.",
    options: [
      { label: "FEIE (Form 2555)",                       value: "feie",       subLabel: "Check if optimal vs FTC" },
      { label: "FTC (Form 1116)",                        value: "ftc",        subLabel: "Check if optimal vs FEIE" },
      { label: "Both (hybrid approach)",                    value: "hybrid",     subLabel: "Confirm allocation is correct" },
      { label: "Neither — not filing or unsure",             value: "none",        subLabel: "Compliance priority" },
      { label: "First year abroad — not yet decided",         value: "first_year",  subLabel: "Decision point now" },
    ],
    required: true,
  },
  {
    id: "has_passive_income", step: 6, type: "button_group",
    label: "Do you have passive income? (dividends, rental, capital gains, interest)",
    subLabel: "Passive income cannot be sheltered by FEIE — only FTC applies.",
    options: [
      { label: "No — earned income only",                value: "no",          subLabel: "FEIE fully available for earned" },
      { label: "Yes — significant passive income",          value: "significant", subLabel: "Hybrid essential" },
      { label: "Yes — some passive income",                  value: "some",        subLabel: "FTC applies to passive portion" },
    ],
    required: true,
  },
  {
    id: "days_abroad", step: 7, type: "button_group",
    label: "Days outside the US in the last 12 months",
    subLabel: "FEIE physical presence test = 330 full days in foreign countries in any 12-month period.",
    options: [
      { label: "Under 330 (physical presence NOT met)",        value: "under_330", subLabel: "FEIE via physical presence not available" },
      { label: "330 or more (physical presence MET)",            value: "330_plus",  subLabel: "FEIE available" },
      { label: "Using bona fide residence test instead",          value: "bona_fide", subLabel: "FEIE available via bona fide residence" },
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

      {/* Strategy logic chain */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">FEIE vs FTC comparison — IRC §911 + §901</p>
        <div className="space-y-1.5">
          {result.reasoningChain.map((r, i) => (
            <div key={i} className={`flex items-start gap-2 rounded px-2 py-1 ${r.resolved ? "bg-emerald-100" : "bg-white"}`}>
              <span className={`shrink-0 mt-0.5 text-[10px] font-mono font-bold ${r.resolved ? "text-emerald-700" : "text-neutral-500"}`}>{r.resolved ? "✓" : "→"}</span>
              <div className="flex-1">
                <p className={`text-[11px] font-bold ${r.resolved ? "text-emerald-700" : "text-neutral-700"}`}>{r.layer}</p>
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

      {/* 3-way comparison table */}
      <div className="mb-4 rounded-xl border-2 border-neutral-200 bg-white px-4 py-3 text-sm">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">3-way strategy comparison — {COUNTRY_LABEL[result.residenceCountry]} · {INCOME_LABEL[result.annualIncome]}</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-neutral-500 border-b border-neutral-200">
              <th className="py-2 text-left">Strategy</th>
              <th className="py-2 text-right">US tax</th>
              <th className="py-2 text-right">Foreign tax</th>
              <th className="py-2 text-right">Total</th>
              <th className="py-2 text-right">Carryforward</th>
            </tr>
          </thead>
          <tbody>
            <tr className={`border-b border-neutral-100 ${result.recommendedMethod === "FEIE" ? "bg-emerald-50 font-bold" : ""}`}>
              <td className="py-2">FEIE only {result.recommendedMethod === "FEIE" && <span className="ml-1 text-emerald-700">✓</span>}</td>
              <td className="py-2 text-right">{usd(Math.max(0, result.feieTotal - result.feieForeignTax))}</td>
              <td className="py-2 text-right">{usd(result.feieForeignTax)}</td>
              <td className="py-2 text-right">{usd(result.feieTotal)}</td>
              <td className="py-2 text-right text-neutral-400">$0</td>
            </tr>
            <tr className={`border-b border-neutral-100 ${result.recommendedMethod === "FTC" ? "bg-emerald-50 font-bold" : ""}`}>
              <td className="py-2">FTC only {result.recommendedMethod === "FTC" && <span className="ml-1 text-emerald-700">✓</span>}</td>
              <td className="py-2 text-right">{usd(Math.max(0, result.ftcUsTax - Math.min(result.ftcForeignTax, result.ftcUsTax)))}</td>
              <td className="py-2 text-right">{usd(result.ftcForeignTax)}</td>
              <td className="py-2 text-right">{usd(result.ftcTotal)}</td>
              <td className="py-2 text-right text-emerald-700">{usd(result.ftcCarryforward)}</td>
            </tr>
            <tr className={`${result.recommendedMethod === "HYBRID" ? "bg-emerald-50 font-bold" : ""}`}>
              <td className="py-2">Hybrid {result.recommendedMethod === "HYBRID" && <span className="ml-1 text-emerald-700">✓</span>}</td>
              <td className="py-2 text-right">{usd(Math.max(0, result.hybridTotal - result.hybridForeignTax))}</td>
              <td className="py-2 text-right">{usd(result.hybridForeignTax)}</td>
              <td className="py-2 text-right">{usd(result.hybridTotal)}</td>
              <td className="py-2 text-right text-neutral-400">partial</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Savings highlight */}
      {result.annualSaving > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-emerald-700">Annual saving — switching from {result.currentMethod.toUpperCase()} to {result.recommendedMethod}</p>
          <p className="font-bold text-emerald-900">
            {usd(result.annualSaving)} per year
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            Over 10 years with FTC carryforward utilisation, total saving can exceed {usd(result.annualSaving * 8)}. Amendment of prior-year returns (within 3-year statute) may recover some past overpayment.
          </p>
        </div>
      )}

      {/* Routing destinations */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Routing — US expat engines + residency cross-check</p>
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
          <strong className="text-neutral-950">FEIE and FTC are not substitutes.</strong> IRC §911 excludes earned income up to $126,500; IRC §901 credits foreign tax against US tax. They cannot apply to the same dollar of income. Optimal choice depends on country tax rate, income type, and income level.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your specific FEIE vs FTC comparison with numeric breakdown</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Optimal strategy recommendation with reasoning</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Annual tax saving estimate + multi-year projection</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>FBAR + FATCA + PFIC filing obligations checklist</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Hybrid strategy implementation guide (tier 2)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Multi-year FTC carryforward optimisation (tier 2)</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your exact US expat position</p>
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

export default function UsExpatTaxCalculator() {
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
        product_slug: "us-expat-tax",
        source_path: "/nomad/check/us-expat-tax",
        country_code: "US", currency_code: "USD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          recommended_method: verdict.result.recommendedMethod,
          current_method: verdict.result.currentMethod,
          annual_saving: verdict.result.annualSaving,
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
      body: JSON.stringify({ email, source: "us_expat_tax", country_code: "US", site: "taxchecknow" }),
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
    const sid = sessionId || `usexpat_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("us-expat-tax_residence_country",   String(answers.residence_country || ""));
    sessionStorage.setItem("us-expat-tax_income_type",          String(answers.income_type        || ""));
    sessionStorage.setItem("us-expat-tax_annual_income",         String(answers.annual_income       || ""));
    sessionStorage.setItem("us-expat-tax_foreign_tax_rate",       String(answers.foreign_tax_rate    || ""));
    sessionStorage.setItem("us-expat-tax_current_method",          String(answers.current_method      || ""));
    sessionStorage.setItem("us-expat-tax_has_passive_income",       String(answers.has_passive_income  || ""));
    sessionStorage.setItem("us-expat-tax_days_abroad",               String(answers.days_abroad          || ""));
    sessionStorage.setItem("us-expat-tax_recommended_strategy",       verdict.result.recommendedMethod);
    sessionStorage.setItem("us-expat-tax_annual_saving",               String(verdict.result.annualSaving));
    sessionStorage.setItem("us-expat-tax_status",                       verdict.status);
    sessionStorage.setItem("us-expat-tax_tier",                          String(popupTier));

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
          success_url: `${window.location.origin}/nomad/check/us-expat-tax/success/${successPath}`,
          cancel_url: `${window.location.origin}/nomad/check/us-expat-tax`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your US expat tax decision for your tax advisor.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your FEIE vs FTC comparison by email — free.</p>
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
                    {popupTier === 67 ? "Your US Expat Tax Strategy Report" : "Your Global Tax Optimization System"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">IRC §911 + §901 · IRS Publication 54 · April 2026</p>
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
                      {popupTier === 67 ? "US Expat Tax Strategy Report™" : "Global Tax Optimization System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your FEIE vs FTC comparison, optimal strategy, estimated annual saving, and US filing obligations checklist."
                        : "Full global tax optimisation: hybrid FEIE/FTC implementation, multi-year FTC carryforward planning, income classification strategy, PFIC avoidance, cross-border structuring."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic US expat content. Your specific FEIE vs FTC position + optimal method + multi-year plan.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My US Expat Report →" : "Get My Optimization System →"}
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
                    { label: "Your role", key: "filing_role", options: [["employee_abroad","US citizen employee abroad"],["self_employed_abroad","US citizen self-employed abroad"],["business_owner","US citizen business owner abroad"],["returning_us","Returning to US — prior-year cleanup"],["advisor","Tax advisor / EA / CPA"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["filing_deadline","Filing deadline approaching"],["strategy_review","Strategy review / method switch"],["first_year","First year abroad"],["audit_letter","IRS letter / compliance enquiry"],["planning","General planning"]] },
                    { label: "Do you have a US expat tax advisor?", key: "accountant", options: [["ea_cross_border","Yes — EA/CPA with cross-border expertise"],["general_us","Yes — general US CPA"],["diy","Self-managed (TurboTax etc.)"],["none","No — need one"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · IRS US expat (IRC §911 + §901)</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && verdict.result.annualSaving >= 3000 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">{verdict.result.currentMethod.toUpperCase()} → {verdict.result.recommendedMethod} switch</p>
              <p className="text-sm font-bold text-neutral-950">
                {usd(verdict.result.annualSaving)}/year saving
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
