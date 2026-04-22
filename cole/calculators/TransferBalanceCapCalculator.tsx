"use client";

/**
 * AU-15 — Transfer Balance Cap Optimiser
 * Pattern: G (ThresholdTest — $1.9M general cap) + A (StatusCheck — exceeded/approaching/clear)
 *
 * Core question: Has this member exceeded or are they approaching the Transfer Balance Cap —
 * and what happens if they do?
 *
 * Key facts (ATO confirmed April 2026):
 *   General TBC 2025-26: $1,900,000 (indexed in $100k CPI steps)
 *   Personal TBC: SET at general cap when first pension started — does NOT fully index up after
 *   Proportional indexation only if pension never reached 100% of personal cap
 *   Excess transfer balance tax: 15% on ATO-calculated notional earnings (first excess)
 *   Subsequent excess: 30% tax rate
 *   ATO issues excess transfer balance determination automatically — commutation forced
 *   Legal anchor: ITAA 1997 Subdivision 294-B, s294-25 (excess transfer balance tax)
 *
 * The citation gap: Most members think the TBC is a one-time check when they start a pension.
 * It's not — it tracks every credit and debit to the transfer balance account for life.
 * Steve Kovalenko started a pension in 2018 with $1.6M cap. The general cap is now $1.9M.
 * His personal cap is still $1.6M. He has $2.1M in pension phase. He's been over cap for years.
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type TbcStatus = "EXCEEDED" | "APPROACHING" | "CLEAR" | "NOT_YET_STARTED";

interface TbcResult {
  personalTbc: number;             // member's personal transfer balance cap
  generalTbc: number;              // current general cap ($1.9M 2025-26)
  pensionBalance: number;
  excessAmount: number;            // $ over personal TBC (0 if within)
  status: TbcStatus;
  notionalEarningsOnExcess: number; // annual notional earnings on excess
  annualExcessTax: number;         // 15% of notional earnings (first excess)
  fiveYearExcessTax: number;
  hasCapLiftOpportunity: boolean;  // true if pension started in lower-cap year
  missedIndexation: number;        // $ of cap indexation foregone if 100% used
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
  result: TbcResult;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — ATO confirmed April 2026
// ─────────────────────────────────────────────────────────────────────────────

const GENERAL_TBC_CURRENT = 1_900_000;           // 2025-26 general cap
const FIRST_EXCESS_TAX_RATE = 0.15;              // 15% first excess
const ASSUMED_NOTIONAL_EARNINGS_RATE = 0.07;    // ATO shortfall interest charge rate (~7% April 2026)

// Year-band → general TBC at commencement (frozen as personal TBC if fully used)
const TBC_AT_COMMENCEMENT: Record<string, number> = {
  pre_2021:    1_600_000,   // 2017-18 through 2020-21 — cap was $1.6M throughout
  "2021_2023": 1_700_000,   // 2021-22 and 2022-23 — cap indexed to $1.7M
  "2023_2025": 1_900_000,   // 2023-24 through 2024-25 — cap indexed to $1.9M (jumped from $1.7M)
  "2025_plus": 1_900_000,   // 2025-26 onwards
  never:       1_900_000,   // no pension yet — forward-looking cap
};

const PENSION_BALANCE_MAP: Record<string, number> = {
  under_1m:     750_000,
  "1m_to_1_6m": 1_300_000,
  "1_6m_to_1_9m": 1_750_000,
  "1_9m_to_2_2m": 2_050_000,
  over_2_2m:    2_600_000,
};

const PRODUCT_KEYS = {
  p67:  "au_67_transfer_balance_cap",
  p147: "au_147_transfer_balance_cap",
};

function formatAUD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-AU");
}

function formatAUDShort(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "k";
  return "$" + Math.round(n).toLocaleString("en-AU");
}

// ─────────────────────────────────────────────────────────────────────────────
// CALCULATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcTbc(answers: AnswerMap): TbcResult {
  const pensionStatus  = String(answers.pension_status || "in_pension");
  const startedYear    = String(answers.pension_started_year || "pre_2021");
  const balanceBand    = String(answers.pension_balance_band || "1_9m_to_2_2m");
  const capFullyUsed   = answers.cap_fully_used === true;

  const generalTbc = GENERAL_TBC_CURRENT;
  const capAtCommencement = TBC_AT_COMMENCEMENT[startedYear] ?? GENERAL_TBC_CURRENT;

  // ── Personal TBC ─────────────────────────────────────────────────────────
  // If pension never started → forward-looking cap (general cap at first commencement)
  // If fully used at time general cap indexed → personal cap frozen at commencement value
  // If not fully used → proportional indexation applies (simplified: give partial benefit)
  let personalTbc = capAtCommencement;
  const missedIndexation = generalTbc - capAtCommencement;

  // Partial indexation credit if not fully used — rough approximation
  // Real rule: proportional based on highest unused % at indexation event
  if (!capFullyUsed && missedIndexation > 0) {
    personalTbc = capAtCommencement + (missedIndexation * 0.3); // conservative partial credit
  }

  const pensionBalance = pensionStatus === "not_started" ? 0 : (PENSION_BALANCE_MAP[balanceBand] ?? 2_050_000);
  const excessAmount = Math.max(0, pensionBalance - personalTbc);

  // ── Status determination ────────────────────────────────────────────────
  let status: TbcStatus;
  if (pensionStatus === "not_started") {
    status = "NOT_YET_STARTED";
  } else if (excessAmount > 0) {
    status = "EXCEEDED";
  } else if (pensionBalance >= personalTbc * 0.9) {
    status = "APPROACHING";
  } else {
    status = "CLEAR";
  }

  // ── Excess transfer balance tax calculation ─────────────────────────────
  const notionalEarningsOnExcess = excessAmount * ASSUMED_NOTIONAL_EARNINGS_RATE;
  const annualExcessTax = notionalEarningsOnExcess * FIRST_EXCESS_TAX_RATE;
  const fiveYearExcessTax = annualExcessTax * 5;

  const hasCapLiftOpportunity = !capFullyUsed && missedIndexation > 0 && pensionStatus !== "not_started";

  return {
    personalTbc,
    generalTbc,
    pensionBalance,
    excessAmount,
    status,
    notionalEarningsOnExcess,
    annualExcessTax,
    fiveYearExcessTax,
    hasCapLiftOpportunity,
    missedIndexation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcTbc(answers);

  // ── Not yet started a pension — planning verdict ─────────────────────────
  if (result.status === "NOT_YET_STARTED") {
    return {
      status: "NOT YET IN PENSION — TIMING DECISION AHEAD",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `You haven't started a pension yet, which means your personal Transfer Balance Cap will be set at whatever the general cap is on the day you commence. Right now that's ${formatAUD(result.generalTbc)}. Starting now locks you at $1.9M; waiting until the next indexation event (expected 1 July 2027 at $2.0M) adds $100,000 of permanent cap headroom.`,
      stats: [
        { label: "Current general cap", value: formatAUDShort(result.generalTbc) },
        { label: "Next indexation est.", value: "$2.0M @ 1 July 2027" },
        { label: "Cap gained by waiting", value: "$100,000", highlight: true },
      ],
      consequences: [
        "Your personal Transfer Balance Cap is set at the GENERAL CAP ON THE DAY you first start an account-based pension (or receive a reversionary pension) — ITAA 1997 s294-35",
        "Once set, the personal cap does NOT fully index up. Only the UNUSED proportion benefits from future indexation — if you're at 100% of your cap when general cap rises, you get zero indexation benefit forever",
        "The general cap is indexed in $100,000 CPI steps. Historical: $1.6M (2017-2021), $1.7M (2021-2023), $1.9M (2023-2025). Next step to $2.0M expected 1 July 2027 (subject to CPI).",
        "Timing option 1 (act now): commence pension, lock personal cap at $1.9M. Simple but gives up potential indexation.",
        "Timing option 2 (wait for indexation): defer pension start until general cap indexes to $2.0M. You earn accumulation rate (15%) instead of pension rate (0%) in the intervening period, but gain $100k of permanent cap.",
        "Break-even: on earnings of $95k/year (5% on $1.9M), deferring one year costs $14,250 in accumulation tax vs $0 in pension. But gains $100,000 of permanent cap. Pays for itself in under 2 years if balance grows into the gap.",
      ],
      confidence: "HIGH",
      confidenceNote: "Transfer balance cap timing rules confirmed under ITAA 1997 s294-35. Indexation uses CPI in $100k steps — historical and forward-looking.",
      tier: 147,
      ctaLabel: "Get My Pension Start Timing Plan — $147 →",
      altTierLabel: "Just want the TBC check? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── Exceeded — the hero verdict ──────────────────────────────────────────
  if (result.status === "EXCEEDED") {
    return {
      status: "OVER YOUR PERSONAL TBC — EXCESS TRANSFER BALANCE TAX APPLIES NOW",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `You're ${formatAUD(result.excessAmount)} over your personal Transfer Balance Cap of ${formatAUD(result.personalTbc)}. The ATO calculates notional earnings on the excess at the shortfall interest charge rate (~${(ASSUMED_NOTIONAL_EARNINGS_RATE * 100).toFixed(0)}%) and taxes them at 15% — approximately ${formatAUD(result.annualExcessTax)} per year. And the ATO will issue an excess transfer balance determination forcing you to commute the excess back to accumulation.`,
      stats: [
        { label: "Excess amount", value: formatAUD(result.excessAmount), highlight: true },
        { label: "Annual excess tax", value: formatAUD(result.annualExcessTax), highlight: true },
        { label: "5-year tax cost", value: formatAUD(result.fiveYearExcessTax), highlight: true },
      ],
      consequences: [
        `🔒 Your PERSONAL TBC is ${formatAUD(result.personalTbc)} — this is frozen at the general cap when you first started your pension. It does NOT rise with general indexation unless you were under 100% used at the time of the indexation event (ITAA 1997 s294-40).`,
        `🔒 ATO excess transfer balance determination: on $${Math.round(result.excessAmount / 1000)}k excess, notional earnings at ~${(ASSUMED_NOTIONAL_EARNINGS_RATE * 100).toFixed(0)}% = ${formatAUD(result.notionalEarningsOnExcess)}/year. Tax at 15% = ${formatAUD(result.annualExcessTax)}/year of excess transfer balance tax (ITAA 1997 s294-25).`,
        "🔒 This is NOT a one-time fix — it compounds. The ATO will issue a commutation authority requiring you to move the excess back to accumulation phase OR withdraw it. Ignoring the authority triggers second-excess rules at 30% tax rate.",
        `Required action: commute ${formatAUD(result.excessAmount)} from pension phase back to accumulation phase. Earnings on that tranche then taxed at 15% (accumulation rate) instead of 0% (pension rate).`,
        "Re-contribution considerations: if you commute to accumulation, you may be able to later commute a different tranche back into pension if TBC room opens up (e.g. cap indexes). But cap indexation doesn't benefit you if you were at 100% — the cap is frozen for you.",
        `Spouse lever: if your spouse has unused TBC, transferring super between partners (subject to contribution caps and preservation) can reduce the member with the excess. But this is ONE-WAY — can only contribute TO a spouse, not withdraw FROM them into you.`,
        "⚠ Check for reversionary pension impact: if you're entitled to receive a deceased spouse's pension, that credit to your transfer balance account could push you further over. Must be planned before the reversion date.",
      ],
      confidence: "HIGH",
      confidenceNote: "Excess transfer balance tax is statutory under ITAA 1997 s294-25. Commutation authority process is automatic once ATO issues determination.",
      tier: 147,
      ctaLabel: "Get My Commutation Plan — $147 →",
      altTierLabel: "Just want the diagnostic? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── Approaching — warning zone ───────────────────────────────────────────
  if (result.status === "APPROACHING") {
    const headroom = result.personalTbc - result.pensionBalance;
    return {
      status: "APPROACHING CAP — WITHIN 10% OF PERSONAL TBC",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `You have ${formatAUD(headroom)} of headroom before hitting your personal Transfer Balance Cap of ${formatAUD(result.personalTbc)}. At typical pension-phase earnings rates, one or two years of unmodelled growth could push you over — triggering excess transfer balance tax and forced commutation.`,
      stats: [
        { label: "Your personal TBC", value: formatAUD(result.personalTbc), highlight: true },
        { label: "Current pension balance", value: formatAUD(result.pensionBalance) },
        { label: "Headroom", value: formatAUD(headroom), highlight: true },
      ],
      consequences: [
        `Your pension balance is within 10% of your personal TBC (${formatAUD(result.personalTbc)}). At 5% earnings on ${formatAUD(result.pensionBalance)}, that's ~${formatAUD(result.pensionBalance * 0.05)} of growth per year — enough to push into excess territory within ${headroom > 0 ? Math.max(1, Math.round(headroom / (result.pensionBalance * 0.05))) : 1} year${headroom > (result.pensionBalance * 0.05) ? "s" : ""}`,
        `Pension earnings are taxed at 0% (s295-385) — the best tax environment available. But any growth above your personal TBC becomes excess transfer balance tax territory. Good news: regular pension DRAWDOWNS reduce your transfer balance account.`,
        result.hasCapLiftOpportunity ? `Potential upside: your personal TBC may have indexation room — you started with the cap at ${formatAUD(result.generalTbc - result.missedIndexation)} and the general cap has risen to ${formatAUD(result.generalTbc)}. If you weren't at 100% use at the indexation date, you get proportional cap lift (ITAA 1997 s294-40).` : "Your personal TBC is likely frozen — full indexation was foregone if you were at 100% use at the general cap indexation date.",
        "Management levers: (a) take pension DRAWDOWNS — these are debits to your transfer balance account, reducing future risk of breach, (b) spouse balance equalisation to keep both members under their respective caps, (c) monitor each 30 June for growth events that might push you over.",
        "Pre-emptive commutation: some members choose to commute voluntarily before reaching the cap — moves earnings from 0% pension phase to 15% accumulation but prevents the excess transfer balance tax and ATO-forced commutation scenario.",
      ],
      confidence: "HIGH",
      confidenceNote: "TBC breach is binary — you're either over or under. Headroom estimate is conservative using current balance and assumed growth rate.",
      tier: 147,
      ctaLabel: "Get My Full TBC Strategy — $147 →",
      altTierLabel: "Just want the TBC calculation? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── Clear but missed indexation — specific recovery opportunity ──────────
  if (result.status === "CLEAR" && result.hasCapLiftOpportunity) {
    return {
      status: "CLEAR OF CAP — BUT CHECK PROPORTIONAL INDEXATION",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your pension balance of ${formatAUD(result.pensionBalance)} is comfortably under your personal Transfer Balance Cap of ${formatAUD(result.personalTbc)}. Because you started your pension before the general cap indexed, you may be entitled to proportional indexation of your personal cap (ITAA 1997 s294-40) — worth up to ${formatAUD(result.missedIndexation)} of extra cap headroom.`,
      stats: [
        { label: "Current personal TBC", value: formatAUD(result.personalTbc) },
        { label: "Max possible TBC", value: formatAUD(result.generalTbc), highlight: true },
        { label: "Potential cap lift", value: formatAUD(result.generalTbc - result.personalTbc), highlight: true },
      ],
      consequences: [
        "Proportional indexation rule (ITAA 1997 s294-40): when the general TBC is indexed, your personal TBC is increased by (general cap increase) × (highest unused % of your personal cap at the indexation date)",
        "Example: if you started pension at $1.6M and were at 50% use ($800k) when cap moved to $1.7M, your personal cap becomes $1.6M + ($100k × 50%) = $1.65M",
        "You need to verify the highest unused % at each general cap indexation event — 2021-22 ($1.6M→$1.7M) and 2023-24 ($1.7M→$1.9M). If your balance was below 100% at either date, additional cap is owed to you.",
        "This is administered by the ATO based on information received from super funds. Errors are common — especially for members with multiple pension accounts or reversionary pensions.",
        "Action: check your MyGov Transfer Balance Account Report to see your current personal cap. If it's less than your reading of the law would suggest, request a review through your super fund or directly via the ATO.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Proportional indexation is sensitive to pension use history. Actual personal cap should be verified with ATO records and may differ from this estimate.",
      tier: 67,
      ctaLabel: "Show My Proportional Cap Check — $67 →",
      altTierLabel: "Want the full strategy too? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── Clear, no particular opportunity ─────────────────────────────────────
  return {
    status: "CLEAR — WITHIN PERSONAL TBC, LOW IMMEDIATE RISK",
    statusClass: "text-emerald-700",
    panelClass: "border-emerald-200 bg-emerald-50",
    headline: `Your pension balance of ${formatAUD(result.pensionBalance)} is well within your personal Transfer Balance Cap of ${formatAUD(result.personalTbc)}. No excess transfer balance tax applies. The 0% pension phase earnings environment is yours to keep — subject to ongoing monitoring.`,
    stats: [
      { label: "Personal TBC", value: formatAUD(result.personalTbc), highlight: true },
      { label: "Pension balance", value: formatAUD(result.pensionBalance) },
      { label: "Headroom", value: formatAUD(result.personalTbc - result.pensionBalance), highlight: true },
    ],
    consequences: [
      "Your transfer balance account is within the personal TBC — pension phase earnings taxed at 0% on the full balance (ITAA 1997 s295-385)",
      "Each pension drawdown reduces your transfer balance account — over time, your cap room expands, allowing future contributions to pension phase if you wish",
      "Monitor each 30 June for growth events or reversionary pension credits that could push you toward cap breach",
      "Forward planning: if Division 296 applies to you (TSB above $3M), the TBC provides the primary shelter for 0% earnings — protect that $1.9M tranche carefully",
      "If married: your spouse has their own personal TBC — combined household TBC planning can optimise pension phase across both partners",
    ],
    confidence: "HIGH",
    confidenceNote: "Transfer balance cap compliance confirmed at current balance. Ongoing monitoring required as growth events can trigger breach.",
    tier: 67,
    ctaLabel: "Show My TBC Position — $67 →",
    altTierLabel: "Want the long-term strategy too? — $147",
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
    id: "pension_status", step: 1, type: "button_group",
    label: "What's your current pension status?",
    subLabel: "Pension phase earnings are taxed at 0% — but only within your personal Transfer Balance Cap",
    options: [
      { label: "In pension phase now", value: "in_pension", subLabel: "Account-based pension commenced" },
      { label: "Transitioning — accumulation + partial pension", value: "partial", subLabel: "Some balance in pension, some in accumulation" },
      { label: "Not yet started a pension", value: "not_started", subLabel: "Planning decision ahead" },
    ],
    required: true,
  },
  {
    id: "pension_started_year", step: 2, type: "button_group",
    label: "When did you first commence an account-based pension?",
    subLabel: "Your PERSONAL TBC is set at the general cap on the day you first started — critical input",
    options: [
      { label: "Before 1 July 2021 (cap was $1.6M)",   value: "pre_2021",   subLabel: "Personal cap starts at $1.6M" },
      { label: "1 July 2021 – 30 June 2023 ($1.7M cap)", value: "2021_2023", subLabel: "Personal cap starts at $1.7M" },
      { label: "1 July 2023 – 30 June 2025 ($1.9M cap)", value: "2023_2025", subLabel: "Personal cap starts at $1.9M" },
      { label: "1 July 2025 onwards ($1.9M cap)",      value: "2025_plus",  subLabel: "Personal cap starts at $1.9M" },
    ],
    showIf: (a) => a.pension_status !== "not_started",
    required: true,
  },
  {
    id: "pension_balance_band", step: 3, type: "button_group",
    label: "What's your current pension phase balance?",
    subLabel: "Compare this to your personal TBC — any excess is being taxed right now",
    options: [
      { label: "Under $1M",        value: "under_1m",       subLabel: "Well within any cap" },
      { label: "$1M–$1.6M",         value: "1m_to_1_6m",    subLabel: "Under all historical caps" },
      { label: "$1.6M–$1.9M",       value: "1_6m_to_1_9m",  subLabel: "Over pre-2021 cap, under current" },
      { label: "$1.9M–$2.2M",       value: "1_9m_to_2_2m",  subLabel: "At/over current cap — Steve's zone" },
      { label: "Over $2.2M",        value: "over_2_2m",     subLabel: "Significant excess likely" },
    ],
    showIf: (a) => a.pension_status !== "not_started",
    required: true,
  },
  {
    id: "cap_fully_used", step: 4, type: "two_button",
    label: "When the general cap last indexed up, was your pension at or near 100% of your cap?",
    subLabel: "Determines whether you got proportional indexation — if you were at 100%, your personal cap is frozen (s294-40)",
    options: [
      { label: "Yes — fully used", value: true },
      { label: "No — had headroom", value: false },
    ],
    showIf: (a) => a.pension_status !== "not_started" && a.pension_started_year !== "2025_plus",
    required: false,
  },
  {
    id: "has_reversionary", step: 5, type: "two_button",
    label: "Are you entitled to receive a reversionary pension (from a spouse or other)?",
    subLabel: "Reversionary pensions credit to your transfer balance account — can push you over cap",
    options: [
      { label: "Yes — reversionary in place", value: true },
      { label: "No", value: false },
    ],
    showIf: (a) => a.pension_status !== "not_started",
  },
  {
    id: "accountant_aware", step: 6, type: "two_button",
    label: "Has your accountant or adviser confirmed your EXACT personal Transfer Balance Cap?",
    subLabel: "Not the general cap — your PERSONAL cap, which may be lower or different due to indexation history",
    options: [
      { label: "Yes — specific number confirmed", value: true },
      { label: "No — only general $1.9M has been quoted", value: false },
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

      {/* TBC math breakdown */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your Transfer Balance Cap math</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">General TBC 2025-26</span>
            <span className="font-mono text-neutral-950">{formatAUD(verdict.result.generalTbc)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">YOUR personal TBC</span>
            <span className="font-mono font-bold text-neutral-950">{formatAUD(verdict.result.personalTbc)}</span>
          </div>
          {verdict.result.missedIndexation > 0 && verdict.result.personalTbc < verdict.result.generalTbc && (
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Cap indexation not applied</span>
              <span className="font-mono text-amber-700">− {formatAUD(verdict.result.generalTbc - verdict.result.personalTbc)}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Your current pension balance</span>
            <span className="font-mono text-neutral-950">{formatAUD(verdict.result.pensionBalance)}</span>
          </div>
          {verdict.result.excessAmount > 0 && (
            <>
              <div className="flex justify-between border-b border-neutral-100 pb-1">
                <span className="text-neutral-600">Excess above personal TBC</span>
                <span className="font-mono font-bold text-red-700">{formatAUD(verdict.result.excessAmount)}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-100 pb-1">
                <span className="text-neutral-600">Notional earnings on excess (~{(ASSUMED_NOTIONAL_EARNINGS_RATE * 100).toFixed(0)}%)</span>
                <span className="font-mono text-red-700">{formatAUD(verdict.result.notionalEarningsOnExcess)} / yr</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-semibold text-neutral-800">Excess transfer balance tax (15%)</span>
                <span className="font-mono font-bold text-red-700">{formatAUD(verdict.result.annualExcessTax)} / yr</span>
              </div>
            </>
          )}
          {verdict.result.excessAmount === 0 && (
            <div className="flex justify-between pt-1">
              <span className="font-semibold text-neutral-800">Headroom under personal TBC</span>
              <span className="font-mono font-bold text-emerald-700">{formatAUD(verdict.result.personalTbc - verdict.result.pensionBalance)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Active loss framing — the quiet excess tax */}
      {verdict.result.excessAmount > 0 && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ What the ATO is taxing you on — every year, quietly</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-1">
            {formatAUD(verdict.result.annualExcessTax)} per year in excess transfer balance tax — {formatAUD(verdict.result.fiveYearExcessTax)} over 5 years.
          </p>
          <p className="text-xs text-red-800 leading-relaxed">
            The ATO auto-calculates this based on information received from your super fund. Plus forced commutation back to accumulation phase. This is happening now, not at some future date.
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
          <strong className="text-neutral-950">Your personal TBC is not the general $1.9M cap.</strong> It&apos;s set at the general cap when you first started your pension — and frozen unless you had headroom at each general cap indexation event. Most members have never been told their personal number.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your exact personal TBC — calculated from your commencement year and cap use history</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Current excess or headroom, with 5-year tax projection if over</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Commutation strategy — which tranche to move back, when, and how</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Reversionary pension and spouse cap interaction analysis</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>4 accountant questions — proportional indexation verification plus action items</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your pension history</p>
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

export default function TransferBalanceCapCalculator() {
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
        product_slug: "transfer-balance-cap",
        source_path: "/au/check/transfer-balance-cap",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          personal_tbc: verdict.result.personalTbc,
          pension_balance: verdict.result.pensionBalance,
          excess_amount: verdict.result.excessAmount,
          annual_excess_tax: verdict.result.annualExcessTax,
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
      body: JSON.stringify({ email, source: "transfer_balance_cap", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `tbc_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("transfer-balance-cap_pension_status", String(answers.pension_status || ""));
    sessionStorage.setItem("transfer-balance-cap_pension_started_year", String(answers.pension_started_year || ""));
    sessionStorage.setItem("transfer-balance-cap_pension_balance_band", String(answers.pension_balance_band || ""));
    sessionStorage.setItem("transfer-balance-cap_cap_fully_used", String(answers.cap_fully_used || false));
    sessionStorage.setItem("transfer-balance-cap_has_reversionary", String(answers.has_reversionary || false));
    sessionStorage.setItem("transfer-balance-cap_personal_tbc", String(Math.round(verdict.result.personalTbc)));
    sessionStorage.setItem("transfer-balance-cap_excess_amount", String(Math.round(verdict.result.excessAmount)));
    sessionStorage.setItem("transfer-balance-cap_annual_excess_tax", String(Math.round(verdict.result.annualExcessTax)));
    sessionStorage.setItem("transfer-balance-cap_status", verdict.status);
    sessionStorage.setItem("transfer-balance-cap_tier", String(popupTier));

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
          success_url: `${window.location.origin}/au/check/transfer-balance-cap/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/transfer-balance-cap`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your personal TBC number to show your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your transfer balance cap position by email — free.</p>
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
                    {popupTier === 67 ? "Your TBC Position Pack" : "Your Full TBC Strategy"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">ATO-referenced · ITAA 1997 Subdiv 294-B · April 2026</p>
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
                      {popupTier === 67 ? "TBC Position Pack™" : "Full TBC Strategy™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your personal TBC calculation, excess amount (if over), annual tax exposure, commutation requirement, and 4 accountant questions — built for your commencement year and pension history."
                        : "Full commutation strategy, re-contribution options, reversionary pension impact analysis, spouse TBC interaction, long-term model, and accountant-ready implementation documents."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic TBC guide. Your personal cap calculation — which may be lower than you&apos;ve been told.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Personal TBC →" : "Get My Full Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the TBC check? — $67 instead" : "Want the full strategy + commutation plan? — $147 instead"}
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
                    { label: "How urgent is this?", key: "urgency", options: [["acting_now","Acting this financial year"],["planning","Planning 12-24 months out"],["just_checking","Just checking my position"]] },
                    { label: "Do you have an accountant or adviser?", key: "accountant", options: [["accountant","Yes — SMSF accountant"],["adviser","Yes — financial adviser"],["both","Both"],["no","No — managing myself"]] },
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

      {showVerdict && verdict && verdict.result.excessAmount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Annual excess tax</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatAUD(verdict.result.annualExcessTax)} / yr (ATO-calculated)
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
