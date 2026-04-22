"use client";

/**
 * AU-13 — Division 296 Wealth Eraser
 * Pattern: G (ThresholdTest — $3M TSB) + B (Timeline — 30 June 2026 cost-base reset election)
 *
 * Core question: Should this SMSF elect the one-time cost-base reset before 30 June 2026?
 *
 * Key facts (ATO confirmed April 2026):
 *   Div 296: additional 15% on realised earnings above $3M TSB from 1 July 2026
 *   Additional 10% (25% total) above $10M
 *   Thresholds indexed $150k / $500k steps
 *   Cost-base reset election: fund-level, all-or-nothing, irrevocable
 *   Based on 30 June 2026 market values; lodged via 2026-27 SMSF annual return
 *   Applies to all CGT assets held at 30 June 2026 or none
 *   For Division 296 purposes only — ordinary CGT cost base unchanged (two sets of records)
 *   Does NOT extend to underlying assets in trusts/companies
 *   Loss-position assets are PENALISED (cost base locks in at lower value)
 *   Legal anchor: ITAA 1997 Subdivision 296-B
 *   Enacted: Treasury Laws Amendment (Building a Stronger and Fairer Super System) Act 2026
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;

interface Div296Result {
  div296Applies: boolean;
  totalBalance: number;
  embeddedGains: number;
  attributableProp: number;
  annualDiv296: number;
  exposedGrowthTax: number;     // tax on pre-2026 gains if no election (the "wealth eraser" number)
  avoidableWithReset: number;   // tax avoidable by electing the reset
  lossAssetPenalty: number;     // additional cost if loss assets included in all-or-nothing
  electionNetBenefit: number;   // total net benefit after accounting for loss penalty
  electionRecommended: boolean;
  tenYearExposure: number;      // 10-year cumulative Div 296 if no action
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
  result: Div296Result;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — Enacted law, April 2026
// ─────────────────────────────────────────────────────────────────────────────

const DIV296_THRESHOLD_LOW = 3_000_000;       // $3M TSB
const DIV296_THRESHOLD_HIGH = 10_000_000;     // $10M TSB (additional 10%)
const DIV296_RATE_LOW = 0.15;                 // 15% additional on earnings above $3M
const DIV296_RATE_HIGH = 0.10;                // additional 10% (25% total) above $10M
const ASSUMED_EARNINGS_RATE = 0.045;          // 4.5% realised earnings p.a.
const ASSUMED_REALISATION_RATE = 0.10;        // 10% of embedded gains realised per year (for exposed growth tax)

const BALANCE_MAP: Record<string, number> = {
  under_1_5m:   1_200_000,
  "1_5m_to_3m": 2_400_000,
  "3m_to_10m":  5_500_000,
  over_10m:     14_000_000,
};

const GAINS_MAP: Record<string, number> = {
  under_200k:      100_000,
  "200k_to_500k":  350_000,
  "500k_to_1m":    750_000,
  over_1m:         1_500_000,
};

const PRODUCT_KEYS = {
  p67:  "au_67_div296_wealth_eraser",
  p147: "au_147_div296_wealth_eraser",
};

function formatAUD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-AU");
}

function formatAUDShort(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "k";
  return "$" + Math.round(n).toLocaleString("en-AU");
}

// ─────────────────────────────────────────────────────────────────────────────
// CALCULATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcDiv296(answers: AnswerMap): Div296Result {
  const tsbBand         = String(answers.tsb_band || "3m_to_10m");
  const embeddedBand    = String(answers.embedded_gains_band || "500k_to_1m");
  const hasLossAssets   = answers.has_loss_assets === true;

  const totalBalance    = BALANCE_MAP[tsbBand] ?? 5_500_000;
  const embeddedGains   = GAINS_MAP[embeddedBand] ?? 750_000;

  const div296Applies   = totalBalance > DIV296_THRESHOLD_LOW;

  // ── Attributable proportion ──────────────────────────────────────────────
  let attributableProp = 0;
  if (div296Applies) {
    attributableProp = (totalBalance - DIV296_THRESHOLD_LOW) / totalBalance;
  }

  // ── Annual Div 296 (ordinary earnings, assumed 4.5%) ─────────────────────
  let annualDiv296 = 0;
  if (div296Applies) {
    const ordinaryEarnings = totalBalance * ASSUMED_EARNINGS_RATE;
    annualDiv296 = ordinaryEarnings * attributableProp * DIV296_RATE_LOW;

    // Additional 10% band above $10M
    if (totalBalance > DIV296_THRESHOLD_HIGH) {
      const highAttributable = (totalBalance - DIV296_THRESHOLD_HIGH) / totalBalance;
      annualDiv296 += ordinaryEarnings * highAttributable * DIV296_RATE_HIGH;
    }
  }

  // ── Exposed growth tax (the wealth eraser — pre-2026 gains taxed if no election) ──
  // If no election: embedded gains flow through Div 296 as realised over time.
  // Assume realised gradually over 10 years for modelling.
  let exposedGrowthTax = 0;
  if (div296Applies) {
    exposedGrowthTax = embeddedGains * attributableProp * DIV296_RATE_LOW;
    if (totalBalance > DIV296_THRESHOLD_HIGH) {
      const highAttributable = (totalBalance - DIV296_THRESHOLD_HIGH) / totalBalance;
      exposedGrowthTax += embeddedGains * highAttributable * DIV296_RATE_HIGH;
    }
  } else {
    // Under $3M today but may cross threshold — forward protection value
    // Model as if balance grows to crossing $3M over 5 years; embedded gains still at risk
    exposedGrowthTax = embeddedGains * 0.15 * 0.3; // conservative forward-protection estimate
  }

  // ── Loss asset penalty (if all-or-nothing includes loss assets) ──────────
  // Assumed ~15% of embedded gains in loss recovery penalty if loss assets present
  const lossAssetPenalty = hasLossAssets ? embeddedGains * 0.15 * attributableProp * DIV296_RATE_LOW : 0;

  // ── Avoidable with reset ─────────────────────────────────────────────────
  const avoidableWithReset = exposedGrowthTax;
  const electionNetBenefit = avoidableWithReset - lossAssetPenalty;
  const electionRecommended = electionNetBenefit > 0;

  // ── 10-year cumulative Div 296 (ongoing earnings drain if no action) ─────
  const tenYearExposure = annualDiv296 * 10 + exposedGrowthTax;

  return {
    div296Applies,
    totalBalance,
    embeddedGains,
    attributableProp,
    annualDiv296,
    exposedGrowthTax,
    avoidableWithReset,
    lossAssetPenalty,
    electionNetBenefit,
    electionRecommended,
    tenYearExposure,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcDiv296(answers);
  const hasLossAssets = answers.has_loss_assets === true;
  const tsbBand = String(answers.tsb_band || "3m_to_10m");

  // ── Under $3M without loss assets: forward protection scenario ────────────
  if (!result.div296Applies && !hasLossAssets) {
    return {
      status: "UNDER $3M TODAY — FORWARD PROTECTION AVAILABLE",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your SMSF is under the $3M threshold today, but the cost-base reset election is still available. If your TSB crosses $3M in future (likely with normal growth), the election will have protected ${formatAUD(result.embeddedGains)} of pre-2026 gains from Division 296.`,
      stats: [
        { label: "Current TSB", value: formatAUDShort(result.totalBalance) },
        { label: "Embedded gains", value: formatAUDShort(result.embeddedGains), highlight: true },
        { label: "Forward protection", value: formatAUD(result.exposedGrowthTax), highlight: true },
      ],
      consequences: [
        "Division 296 does not apply at your current TSB — but the $3M threshold is indexed only in $150k CPI steps, so normal balance growth will push many SMSFs into scope each year",
        "The cost-base reset election is AVAILABLE regardless of current balance — it's a forward protection tool",
        `If you elect now and TSB crosses $3M later, the ${formatAUD(result.embeddedGains)} of embedded pre-2026 gains are permanently excluded from Division 296 calculations`,
        "Cost of electing: two-track record-keeping (ordinary CGT + Division 296 reset base) for the life of every asset — maintained by your SMSF accountant",
        "⚠ 30 June 2026 is the VALUATION DATE, not the lodgement date. The reset values are fixed to that day's market values — missing it is permanent.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Forward-protection election is often beneficial for $2M+ SMSFs with meaningful embedded gains but depends on 10-year TSB trajectory.",
      tier: 67,
      ctaLabel: "Show My Div 296 Exposure — $67 →",
      altTierLabel: "Want the execution plan too? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── Under $3M WITH loss assets: disposal decision matters ────────────────
  if (!result.div296Applies && hasLossAssets) {
    return {
      status: "UNDER $3M — LOSS ASSETS NEED PRE-30-JUNE DECISION",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your TSB is under $3M today, but with loss-position assets in your fund, the cost-base reset election becomes complex. If you elect, the loss assets get their cost base locked at the lower value — penalising any future recovery.`,
      stats: [
        { label: "Current TSB", value: formatAUDShort(result.totalBalance) },
        { label: "Embedded gains", value: formatAUDShort(result.embeddedGains) },
        { label: "Loss asset penalty", value: formatAUD(result.lossAssetPenalty), highlight: true },
      ],
      consequences: [
        "Loss-position assets are PENALISED by the reset — their cost base drops to current (lower) market value, locking in reduced cost for future Division 296",
        "For mixed portfolios (gain + loss assets), the optimal path is often: SELL loss-position assets BEFORE 30 June 2026, then elect the reset for the remaining (gain-only) assets",
        "If you don't elect: loss-position assets keep their original higher cost base, BUT pre-2026 gains remain exposed to future Division 296 when TSB crosses $3M",
        "The all-or-nothing trap: you cannot pick and choose assets for the reset. Pre-30-June disposal of specific loss assets is the only way to optimise",
        "⚠ This decision requires asset-level modelling BEFORE 30 June 2026. After that date, the election is locked to that day's valuations.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Mixed gain/loss portfolios require asset-by-asset modelling to decide whether to elect + which loss assets to sell first.",
      tier: 147,
      ctaLabel: "Get My Execution Plan — $147 →",
      altTierLabel: "Just want the decision pack? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── Over $10M with loss assets: highest-stakes verdict ───────────────────
  if (tsbBand === "over_10m" && hasLossAssets) {
    return {
      status: "OVER $10M + LOSS ASSETS — BOTH DIV 296 BANDS + ALL-OR-NOTHING TRAP",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Your SMSF is exposed to BOTH Division 296 tax bands (15% above $3M, additional 10% above $10M). Without the cost-base reset, ${formatAUD(result.exposedGrowthTax)} of pre-2026 growth is taxed under Div 296 when realised. But loss-position assets create an all-or-nothing trap — worth approximately ${formatAUD(result.lossAssetPenalty)} if you elect without disposing of them first.`,
      stats: [
        { label: "Exposed growth tax", value: formatAUD(result.exposedGrowthTax), highlight: true },
        { label: "Loss asset penalty", value: formatAUD(result.lossAssetPenalty), highlight: true },
        { label: "Annual Div 296 drain", value: formatAUD(result.annualDiv296), highlight: true },
      ],
      consequences: [
        `🔒 Two Division 296 bands active: 15% above $3M AND additional 10% above $10M (25% total on the portion above $10M). Annual drain ~${formatAUD(result.annualDiv296)} compounding every year.`,
        `🔒 ${formatAUD(result.exposedGrowthTax)} of avoidable tax sits in pre-2026 embedded gains — permanently exposed unless you elect the cost-base reset`,
        `⚠ The all-or-nothing trap — if you elect WITHOUT disposing of loss-position assets first, those assets' cost base locks in at today's lower value. You lose approximately ${formatAUD(result.lossAssetPenalty)} of future protection.`,
        "Optimal path: asset-level modelling → sell loss-position assets before 30 June 2026 → elect the reset on remaining (gain-position) assets → set up two-track record-keeping",
        "The election is lodged via the 2026-27 SMSF annual return, but the VALUATION DATE is 30 June 2026. All disposal decisions must happen before that date.",
        "Once lodged: irrevocable. Once 30 June 2026 passes: no retrospective valuations. No second chance.",
      ],
      confidence: "HIGH",
      confidenceNote: "Both Division 296 bands are enacted law (Subdiv 296-B). Cost-base reset election structure is statutory — irrevocable once lodged.",
      tier: 147,
      ctaLabel: "Get My Execution Plan — $147 →",
      altTierLabel: "Just want the diagnostic? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── Over $3M, election recommended (standard high-value case) ────────────
  if (result.div296Applies && result.electionRecommended && !hasLossAssets) {
    return {
      status: "DIV 296 ACTIVE — COST-BASE RESET RECOMMENDED",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Division 296 applies to your SMSF from 1 July 2026. Without the cost-base reset election, ${formatAUD(result.exposedGrowthTax)} of pre-2026 embedded gains are permanently exposed to the additional 15% tax when assets are realised. This is avoidable — but only with action before 30 June 2026.`,
      stats: [
        { label: "Exposed growth tax", value: formatAUD(result.exposedGrowthTax), highlight: true },
        { label: "Annual Div 296", value: formatAUD(result.annualDiv296) },
        { label: "10-year cumulative", value: formatAUD(result.tenYearExposure), highlight: true },
      ],
      consequences: [
        `🔒 ${formatAUD(result.exposedGrowthTax)} of avoidable Division 296 tax sits in pre-2026 embedded gains — decades of growth captured by a law that wasn't in force when the gains accrued`,
        `🔒 Annual Division 296 drain ~${formatAUD(result.annualDiv296)} on ordinary earnings above $3M threshold — compounds every year`,
        `10-year projected cumulative exposure without action: ${formatAUD(result.tenYearExposure)}. Most of this is avoidable with the cost-base reset.`,
        "The cost-base reset election resets ALL CGT assets to their 30 June 2026 market value for Division 296 purposes only — pre-2026 gains excluded permanently",
        "With all assets in gain position, the election is unambiguously beneficial — no pre-30-June disposals required. Just valuations + lodgement.",
        "⚠ The election is irrevocable. Once 30 June 2026 passes, the valuation date is locked. Lodgement happens via the 2026-27 SMSF annual return but the numbers are set in stone at 30 June.",
      ],
      confidence: "HIGH",
      confidenceNote: "Division 296 enacted 13 March 2026 (Treasury Laws Amendment Act 2026). Cost-base reset election is statutory right under Subdiv 296-B.",
      tier: 147,
      ctaLabel: "Get My Execution Plan — $147 →",
      altTierLabel: "Just want the decision pack? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── Over $3M with loss assets but not over $10M ──────────────────────────
  if (result.div296Applies && hasLossAssets) {
    return {
      status: "DIV 296 ACTIVE — LOSS ASSETS NEED PRE-30-JUNE DECISION",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Division 296 applies. ${formatAUD(result.exposedGrowthTax)} of pre-2026 gains are exposed without the reset. But loss-position assets create an all-or-nothing trap worth approximately ${formatAUD(result.lossAssetPenalty)} — if you elect without disposing of loss assets first, their cost base locks in at today's lower value.`,
      stats: [
        { label: "Exposed growth tax", value: formatAUD(result.exposedGrowthTax), highlight: true },
        { label: "Loss asset penalty", value: formatAUD(result.lossAssetPenalty), highlight: true },
        { label: "Annual Div 296", value: formatAUD(result.annualDiv296) },
      ],
      consequences: [
        `🔒 ${formatAUD(result.exposedGrowthTax)} of avoidable Division 296 tax in pre-2026 embedded gains — permanently exposed without the reset`,
        `⚠ The all-or-nothing trap — loss-position assets reset DOWN to today's market value, locking in the lower base. Approximately ${formatAUD(result.lossAssetPenalty)} of future Division 296 exposure from asset recovery.`,
        "Optimal path: SELL loss-position assets BEFORE 30 June 2026 (realising CGT loss against 2025-26 capital gains), then elect the reset for the remaining gain-position assets",
        "Can repurchase loss assets after 30 June if you still want the exposure — new cost base is repurchase price, no reset needed. Be aware of wash-sale considerations.",
        "Net election benefit after accounting for loss penalty: " + (result.electionNetBenefit > 0 ? `${formatAUD(result.electionNetBenefit)} favourable (elect + sell losses first)` : "Consider NOT electing given loss concentration"),
        "⚠ Valuation date 30 June 2026. No retrospective adjustments. No asset-by-asset opt-in. No reversal.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Mixed gain/loss portfolio requires asset-level modelling + pre-30-June disposal strategy to optimise.",
      tier: 147,
      ctaLabel: "Get My Execution Plan — $147 →",
      altTierLabel: "Just want the decision pack? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── Fallback (over $3M without loss assets, election marginal) ───────────
  return {
    status: "DIV 296 ACTIVE — ELECTION DECISION MARGINAL",
    statusClass: "text-amber-700",
    panelClass: "border-amber-200 bg-amber-50",
    headline: `Division 296 applies but with modest embedded gains, the cost-base reset benefit is ${formatAUD(result.avoidableWithReset)}. Still worthwhile but not overwhelming — weigh against two-track record-keeping cost.`,
    stats: [
      { label: "Avoidable tax", value: formatAUD(result.avoidableWithReset), highlight: true },
      { label: "Annual Div 296", value: formatAUD(result.annualDiv296) },
      { label: "10-year exposure", value: formatAUD(result.tenYearExposure) },
    ],
    consequences: [
      `Division 296 applies — annual drain ~${formatAUD(result.annualDiv296)} on ordinary earnings above $3M`,
      `Avoidable tax via reset: ${formatAUD(result.avoidableWithReset)} across pre-2026 embedded gains`,
      "Trade-off: election vs ongoing two-track record-keeping cost (ordinary CGT + Division 296 reset base for life of every asset)",
      "Forward protection consideration: if TSB grows significantly, embedded gains become more valuable to protect",
      "⚠ Decision window closes 30 June 2026 — after that, valuations are locked",
    ],
    confidence: "MEDIUM",
    confidenceNote: "Marginal elections often still beneficial given forward-protection value. Accountant modelling recommended.",
    tier: 147,
    ctaLabel: "Get My Execution Plan — $147 →",
    altTierLabel: "Just want the decision pack? — $67 instead",
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
    id: "tsb_band", step: 1, type: "button_group",
    label: "What is your current Total Super Balance?",
    subLabel: "The $3M Division 296 threshold — but the reset election is available at any balance",
    options: [
      { label: "Under $1.5M", value: "under_1_5m", subLabel: "Forward protection only" },
      { label: "$1.5M–$3M", value: "1_5m_to_3m", subLabel: "Under threshold today, may cross later" },
      { label: "$3M–$10M", value: "3m_to_10m", subLabel: "15% additional Div 296 applies" },
      { label: "Over $10M", value: "over_10m", subLabel: "Both bands active (25% total above $10M)" },
    ],
    required: true,
  },
  {
    id: "embedded_gains_band", step: 2, type: "button_group",
    label: "Approximate total unrealised gains across your SMSF assets?",
    subLabel: "Assets bought years ago with significant appreciation drive the election benefit",
    options: [
      { label: "Under $200k", value: "under_200k", subLabel: "Modest protection from election" },
      { label: "$200k–$500k", value: "200k_to_500k", subLabel: "Meaningful tax at risk" },
      { label: "$500k–$1M", value: "500k_to_1m", subLabel: "Election clearly valuable" },
      { label: "Over $1M", value: "over_1m", subLabel: "Substantial exposed growth" },
    ],
    required: true,
  },
  {
    id: "has_loss_assets", step: 3, type: "two_button",
    label: "Do any of your SMSF assets currently sit in a loss position vs their original cost?",
    subLabel: "Loss-position assets are penalised by the all-or-nothing reset — disposal before 30 June may be needed",
    options: [
      { label: "No — all assets in gain", value: false },
      { label: "Yes — some assets in loss", value: true },
    ],
    required: true,
  },
  {
    id: "assets_in_trusts", step: 4, type: "two_button",
    label: "Does your SMSF hold assets indirectly through unit trusts, companies, or other entities?",
    subLabel: "The cost-base reset does NOT extend to underlying assets held indirectly — this is a look-through gap",
    options: [
      { label: "Yes — has indirect holdings", value: true },
      { label: "No — direct holdings only", value: false },
    ],
    showIf: (a) => a.tsb_band === "3m_to_10m" || a.tsb_band === "over_10m",
  },
  {
    id: "age_band", step: 5, type: "button_group",
    label: "What is your age?",
    subLabel: "Affects timing of when Division 296 impact materialises vs when reset benefit compounds",
    options: [
      { label: "Under 55", value: "under_55", subLabel: "Long horizon — election very valuable" },
      { label: "55–64", value: "55_to_64", subLabel: "Pre-retirement — decision window critical" },
      { label: "65–74", value: "65_to_74", subLabel: "Retirement phase — Div 296 compounds" },
      { label: "75 or over", value: "75_plus", subLabel: "Estate planning overlap" },
    ],
    required: true,
  },
  {
    id: "accountant_aware", step: 6, type: "two_button",
    label: "Has your SMSF accountant modelled the cost-base reset election for your specific asset mix?",
    subLabel: "Most trustees have not been shown the asset-level numbers yet — the law only passed March 2026",
    options: [
      { label: "Yes — modelled and planned", value: true },
      { label: "No — never been discussed", value: false },
    ],
  },
];

const TOTAL_STEPS = 6;

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

      {/* Div 296 exposure breakdown */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your Division 296 exposure breakdown</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Total Super Balance</span>
            <span className="font-mono font-bold text-neutral-950">{formatAUD(verdict.result.totalBalance)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Embedded unrealised gains</span>
            <span className="font-mono text-neutral-950">{formatAUD(verdict.result.embeddedGains)}</span>
          </div>
          {verdict.result.div296Applies && (
            <>
              <div className="flex justify-between border-b border-neutral-100 pb-1">
                <span className="text-neutral-600">Attributable portion above $3M</span>
                <span className="font-mono text-neutral-950">{(verdict.result.attributableProp * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between border-b border-neutral-100 pb-1">
                <span className="text-neutral-600">Annual Div 296 (ordinary earnings)</span>
                <span className="font-mono text-red-700">{formatAUD(verdict.result.annualDiv296)} / yr</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Exposed growth tax (pre-2026 gains)</span>
            <span className="font-mono font-bold text-red-700">{formatAUD(verdict.result.exposedGrowthTax)}</span>
          </div>
          {verdict.result.lossAssetPenalty > 0 && (
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Loss asset all-or-nothing penalty</span>
              <span className="font-mono text-red-700">− {formatAUD(verdict.result.lossAssetPenalty)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1">
            <span className="font-semibold text-neutral-800">Net avoidable with reset + optimal strategy</span>
            <span className="font-mono font-bold text-emerald-700">{formatAUD(Math.max(0, verdict.result.electionNetBenefit))}</span>
          </div>
        </div>
      </div>

      {/* Active loss framing — the wealth eraser message */}
      {verdict.result.exposedGrowthTax > 0 && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ The wealth eraser — same growth, taxed twice</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-1">
            {formatAUD(verdict.result.exposedGrowthTax)} of tax on growth that accrued BEFORE Division 296 existed — unless you elect by 30 June 2026.
          </p>
          <p className="text-xs text-red-800 leading-relaxed">
            The cost-base reset election is the only way to exclude pre-2026 gains from Division 296. Miss 30 June 2026 valuation date = permanent exposure.
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
          <strong className="text-neutral-950">30 June 2026 is the valuation date — not the lodgement deadline.</strong> The election is lodged with the 2026-27 SMSF annual return, but the numbers lock in at 30 June 2026 market values. Any loss-asset disposals must happen before that date.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What's in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your exact Division 296 exposure at current TSB and growth rate</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Cost-base reset modelling — net benefit vs cost</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Loss-position asset handling — when to sell before 30 June</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Valuation evidence checklist for ATO-defensible election</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>4 accountant questions written for YOUR exact fund</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your exact SMSF asset mix</p>
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

export default function Div296WealthEraserCalculator() {
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
        product_slug: "div296-wealth-eraser",
        source_path: "/au/check/div296-wealth-eraser",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          div296_applies: verdict.result.div296Applies,
          exposed_growth_tax: verdict.result.exposedGrowthTax,
          annual_div296: verdict.result.annualDiv296,
          avoidable_with_reset: verdict.result.avoidableWithReset,
          election_recommended: verdict.result.electionRecommended,
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
      body: JSON.stringify({ email, source: "div296_wealth_eraser", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `div296_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    // sessionStorage keys MUST match config successPromptFields exactly
    sessionStorage.setItem("div296-wealth-eraser_tsb_band", String(answers.tsb_band || ""));
    sessionStorage.setItem("div296-wealth-eraser_embedded_gains_band", String(answers.embedded_gains_band || ""));
    sessionStorage.setItem("div296-wealth-eraser_has_loss_assets", String(answers.has_loss_assets || false));
    sessionStorage.setItem("div296-wealth-eraser_div296_exposure", String(Math.round(verdict.result.tenYearExposure)));
    sessionStorage.setItem("div296-wealth-eraser_avoidable_with_reset", String(Math.round(verdict.result.avoidableWithReset)));
    sessionStorage.setItem("div296-wealth-eraser_election_recommended", String(verdict.result.electionRecommended));
    sessionStorage.setItem("div296-wealth-eraser_status", verdict.status);
    sessionStorage.setItem("div296-wealth-eraser_tier", String(popupTier));

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
          success_url: `${window.location.origin}/au/check/div296-wealth-eraser/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/div296-wealth-eraser`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your Div 296 exposure number to show your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your cost-base reset decision summary by email — free.</p>
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
                    {popupTier === 67 ? "Your Div 296 Decision Pack" : "Your Div 296 Execution Pack"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">ATO-referenced · ITAA 1997 Subdiv 296-B · April 2026</p>
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
                      {popupTier === 67 ? "Div 296 Decision Pack™" : "Div 296 Execution Pack™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your exact Division 296 exposure, cost-base reset election modelling, avoidable tax quantum, loss-asset handling, valuation requirements, and 4 accountant questions — built for your fund's current asset mix and TSB trajectory."
                        : "Full asset-level modelling, pre-30-June disposal strategy for loss-position assets, valuation evidence checklist, trustee election lodgement plan, two-track record-keeping setup, and long-term projection model."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic Div 296 guide. A decision for your exact SMSF before 30 June 2026.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Div 296 Exposure →" : "Get My Execution Plan →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the decision pack? — $67 instead" : "Want the full execution plan? — $147 instead"}
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
                    { label: "Fund structure", key: "entity_type", options: [["smsf","SMSF — self-managed"],["apra","Industry / retail fund"],["both","Both SMSF and APRA fund"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["acting_now","Acting before 30 June 2026"],["planning","Planning 30 June 2027 onwards"],["just_checking","Just checking my position"]] },
                    { label: "Do you have an accountant or financial adviser?", key: "accountant", options: [["accountant","Yes — SMSF accountant"],["adviser","Yes — financial adviser"],["both","Both"],["no","No — managing myself"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · ATO-sourced content</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile sticky bar */}
      {showVerdict && verdict && verdict.result.exposedGrowthTax > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Avoidable tax</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatAUD(Math.max(0, verdict.result.electionNetBenefit))} with reset
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
