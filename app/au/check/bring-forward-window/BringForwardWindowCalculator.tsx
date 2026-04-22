"use client";

/**
 * AU-11 — Super Contribution Bring-Forward Window Engine
 * Pattern: Module G (ThresholdTest) + Module B (Timeline) + Module D (GateTest)
 * Brief: TSB band → age → work test → bring-forward status → div296 → carry-forward intent
 *
 * Core question: How much can I contribute before 30 June AND from 1 July,
 *                given my TSB at 30 June 2026 and whether a bring-forward is already running?
 * The $150,000 sequencing decision is the product.
 *
 * Key facts (ATO confirmed April 2026):
 *   2025-26: NCC cap $120,000 | Bring-forward $360,000 | TSB threshold $1.76M (full) / $2.0M (nil)
 *   2026-27: NCC cap $130,000 | Bring-forward $390,000 | TSB thresholds $1.84M / $1.97M / $2.1M
 *   Sequencing window: $120k before 30 June + $390k from 1 July = $510,000
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;

interface TimingResult {
  canActBeforeJune30: boolean;
  canActAfterJuly1: boolean;
  maxBeforeJune30: number;
  maxAfterJuly1: number;
  totalPossible: number;
  lockedOut: boolean;
  lockedOutReason: string;
  optimalSequence: string;
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
  timing: TimingResult;
  decisionGap: number;
  div296Flagged: boolean;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — ATO confirmed April 2026
// Source: ATO — Non-concessional contributions cap · ITAA 1997 s292-85
// ─────────────────────────────────────────────────────────────────────────────

const CAP_2025_26 = {
  ncc: 120_000,
  bringForward3Year: 360_000,
};

const CAP_2026_27 = {
  ncc: 130_000,
  bringForward3Year: 390_000,
  bringForward2Year: 260_000,
  tsbFullBringForward: 1_840_000,
  tsbTwoYearLimit: 1_970_000,
  tsbLockout: 2_100_000,
};

const SEQUENCING_MAX = 510_000;
const WAIT_ONLY_MAX = 390_000;
const LOCKED_OLD_MAX = 360_000;
const DECISION_GAP = 150_000;

const JUNE_30_2026 = new Date("2026-06-30T23:59:59.000+10:00");
const DAYS_TO_JUNE30 = Math.max(0, Math.floor((JUNE_30_2026.getTime() - Date.now()) / 86_400_000));
const AFTER_JUNE30 = Date.now() > JUNE_30_2026.getTime();

const PRODUCT_KEYS = {
  p67:  "au_67_bring_forward_window",
  p147: "au_147_bring_forward_window",
};

function formatAUD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-AU");
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcTiming(answers: AnswerMap): TimingResult {
  const tsbBand              = String(answers.tsb_band || "");
  const age                  = String(answers.age || "");
  const workTest             = answers.work_test;
  const bringForwardTriggered = answers.bring_forward_triggered;

  // ── Age 75+: no NCCs at all ───────────────────────────────────────────────
  if (age === "75_plus") {
    return {
      canActBeforeJune30: false,
      canActAfterJuly1: false,
      maxBeforeJune30: 0,
      maxAfterJuly1: 0,
      totalPossible: 0,
      lockedOut: true,
      lockedOutReason: "Age 75+ — non-concessional contributions not permitted",
      optimalSequence: "Not applicable — age restriction applies",
    };
  }

  // ── Age 67-74 without work test: no NCCs ──────────────────────────────────
  if (age === "67_to_74" && workTest === false) {
    return {
      canActBeforeJune30: false,
      canActAfterJuly1: false,
      maxBeforeJune30: 0,
      maxAfterJuly1: 0,
      totalPossible: 0,
      lockedOut: true,
      lockedOutReason: "Age 67–74 without meeting the work test — NCCs not permitted",
      optimalSequence: "Work test must be met (40 hours in a 30-day period) before contributing",
    };
  }

  // ── Bring-forward already triggered: locked into old schedule ─────────────
  if (bringForwardTriggered === true) {
    return {
      canActBeforeJune30: false,
      canActAfterJuly1: false,
      maxBeforeJune30: 0,
      maxAfterJuly1: 0,
      totalPossible: 0,
      lockedOut: true,
      lockedOutReason: "Bring-forward already triggered — locked into 2025-26 caps at $360,000 maximum",
      optimalSequence: "No sequencing available — existing schedule must expire before new caps apply",
    };
  }

  // ── TSB $2.1M+ at 30 June: locked out from 1 July ─────────────────────────
  if (tsbBand === "over_2_1m") {
    return {
      canActBeforeJune30: true,
      canActAfterJuly1: false,
      maxBeforeJune30: CAP_2025_26.ncc,
      maxAfterJuly1: 0,
      totalPossible: CAP_2025_26.ncc,
      lockedOut: true,
      lockedOutReason: "TSB at or above $2.1M at 30 June 2026 — nil NCC cap from 1 July",
      optimalSequence: `Contribute up to ${formatAUD(CAP_2025_26.ncc)} before 30 June under 2025-26 rules — then locked out from 1 July`,
    };
  }

  // ── TSB $1.97M–$2.1M: annual cap only from 1 July ─────────────────────────
  if (tsbBand === "1_97m_to_2_1m") {
    const beforeJune30 = CAP_2025_26.ncc;
    const afterJuly1 = CAP_2026_27.ncc;
    return {
      canActBeforeJune30: true,
      canActAfterJuly1: true,
      maxBeforeJune30: beforeJune30,
      maxAfterJuly1: afterJuly1,
      totalPossible: beforeJune30 + afterJuly1,
      lockedOut: false,
      lockedOutReason: "",
      optimalSequence: `Contribute ${formatAUD(beforeJune30)} before 30 June, then ${formatAUD(afterJuly1)} from 1 July — total ${formatAUD(beforeJune30 + afterJuly1)}`,
    };
  }

  // ── TSB $1.84M–$1.97M: 2-year bring-forward from 1 July ───────────────────
  if (tsbBand === "1_84m_to_1_97m") {
    const beforeJune30 = CAP_2025_26.ncc;
    const afterJuly1 = CAP_2026_27.bringForward2Year;
    return {
      canActBeforeJune30: true,
      canActAfterJuly1: true,
      maxBeforeJune30: beforeJune30,
      maxAfterJuly1: afterJuly1,
      totalPossible: beforeJune30 + afterJuly1,
      lockedOut: false,
      lockedOutReason: "",
      optimalSequence: `Contribute ${formatAUD(beforeJune30)} before 30 June, then trigger 2-year bring-forward ${formatAUD(afterJuly1)} from 1 July — total ${formatAUD(beforeJune30 + afterJuly1)}`,
    };
  }

  // ── TSB under $1.84M: full 3-year bring-forward from 1 July ───────────────
  if (tsbBand === "under_1_84m") {
    const beforeJune30 = CAP_2025_26.ncc;
    const afterJuly1 = CAP_2026_27.bringForward3Year;
    return {
      canActBeforeJune30: true,
      canActAfterJuly1: true,
      maxBeforeJune30: beforeJune30,
      maxAfterJuly1: afterJuly1,
      totalPossible: beforeJune30 + afterJuly1,
      lockedOut: false,
      lockedOutReason: "",
      optimalSequence: `Contribute ${formatAUD(beforeJune30)} before 30 June, then trigger full 3-year bring-forward ${formatAUD(afterJuly1)} from 1 July — total ${formatAUD(beforeJune30 + afterJuly1)} ✓ OPTIMAL`,
    };
  }

  // Fallback
  return {
    canActBeforeJune30: false,
    canActAfterJuly1: false,
    maxBeforeJune30: 0,
    maxAfterJuly1: 0,
    totalPossible: 0,
    lockedOut: true,
    lockedOutReason: "Unable to determine position — confirm TSB band with your super fund",
    optimalSequence: "Confirm inputs",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const timing                = calcTiming(answers);
  const tsbBand               = String(answers.tsb_band || "");
  const age                   = String(answers.age || "");
  const bringForwardTriggered = answers.bring_forward_triggered;
  const div296Affected        = answers.div296_affected;
  const carryForwardIntent    = answers.carry_forward;

  const div296Flagged = div296Affected === true;

  // ── Age 75+: locked out entirely ──────────────────────────────────────────
  if (age === "75_plus") {
    return {
      status: "LOCKED OUT — AGE 75+",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "At age 75 or above, you cannot make non-concessional contributions at all. The bring-forward window does not apply to you.",
      stats: [
        { label: "NCC capacity", value: "$0 — locked out ✗", highlight: true },
        { label: "Concessional cap", value: "$30k still available" },
        { label: "Downsizer", value: "Check eligibility (55+)" },
      ],
      consequences: [
        "Non-concessional contributions are prohibited from age 75 under ITAA 1997 s292-85",
        "Concessional contributions (up to $30,000 in 2025-26, $32,500 in 2026-27) may still be available via employer or salary sacrifice",
        "Downsizer contributions ($300,000 per person from sale of family home) may be available if 55+ and eligibility conditions met",
        "Speak to your accountant about non-super alternatives for surplus capital",
      ],
      confidence: "HIGH",
      confidenceNote: "Age 75+ is a hard ATO rule under ITAA 1997 s292-85 — no exceptions.",
      tier: 67,
      ctaLabel: "Get My June 30 Decision Pack — $67 →",
      altTierLabel: "Want the full execution plan? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      timing, decisionGap: 0, div296Flagged,
    };
  }

  // ── Age 67-74 without work test ───────────────────────────────────────────
  if (age === "67_to_74" && answers.work_test === false) {
    return {
      status: "BLOCKED — WORK TEST NOT MET",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "Between 67 and 74, you must meet the work test before making non-concessional contributions — 40 hours of gainful employment in a 30-day period. Without it, contributions are blocked.",
      stats: [
        { label: "Work test required", value: "40 hours / 30 days", highlight: true },
        { label: "Your status", value: "Not met ✗", highlight: true },
        { label: "Potential capacity", value: "If met: up to $510k" },
      ],
      consequences: [
        "The work test requires 40 hours of gainful employment in a consecutive 30-day period BEFORE the contribution is made",
        "'Gainful employment' means paid work — volunteer work does not qualify",
        "Evidence is required if the ATO asks — payslips, contracts, or director fees confirming hours and dates",
        "A one-off work test exemption may apply if the test was met in the prior year AND TSB is under $300,000",
        "If the work test is met before 30 June, full sequencing is available — $120k before + $390k from 1 July (subject to TSB)",
      ],
      confidence: "HIGH",
      confidenceNote: "Work test is a hard ATO requirement under ITAA 1997 s292-85 for ages 67–74.",
      tier: 147,
      ctaLabel: "Get My June 30 Execution Plan — $147 →",
      altTierLabel: "Just want the decision pack? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      timing, decisionGap: 0, div296Flagged,
    };
  }

  // ── Bring-forward already triggered ───────────────────────────────────────
  if (bringForwardTriggered === true) {
    return {
      status: "LOCKED IN OLD SCHEDULE — BRING-FORWARD ALREADY TRIGGERED",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "You triggered a bring-forward in a prior year — you are locked into the 2025-26 caps at $360,000 maximum for the remainder of the schedule. Indexation does not apply mid-schedule.",
      stats: [
        { label: "Locked cap", value: formatAUD(LOCKED_OLD_MAX), highlight: true },
        { label: "Missed new cap", value: formatAUD(WAIT_ONLY_MAX) },
        { label: "Decision gap", value: formatAUD(DECISION_GAP) + " permanent", highlight: true },
      ],
      consequences: [
        "The ATO rule is explicit: the bring-forward cap is fixed at the year of trigger — indexation during the schedule does not lift your cap",
        "A bring-forward triggered in 2024-25 or 2025-26 keeps you at the $360,000 maximum until the 3-year period expires",
        "Once the existing schedule expires, a new bring-forward becomes available under whatever caps apply at that time",
        "If your bring-forward triggered in 2024-25, it expires 30 June 2027 — you can trigger a fresh bring-forward from 1 July 2027",
        "If your bring-forward triggered in 2025-26, it expires 30 June 2028 — you can trigger a fresh bring-forward from 1 July 2028",
        div296Flagged ? "Division 296 may apply from 1 July 2026 — contributing more super may increase your Division 296 liability" : "",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "Bring-forward already triggered — the schedule must expire before new caps apply. Confirm expiry date with your accountant.",
      tier: 147,
      ctaLabel: "Get My June 30 Execution Plan — $147 →",
      altTierLabel: "Just want the decision pack? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      timing, decisionGap: DECISION_GAP, div296Flagged,
    };
  }

  // ── TSB at or above $2.1M at 30 June ──────────────────────────────────────
  if (tsbBand === "over_2_1m") {
    return {
      status: "LOCKED OUT FROM 1 JULY — TSB OVER $2.1M",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "With a TSB at or above $2.1M at 30 June 2026, your NCC cap is nil from 1 July 2026. You can still contribute up to $120,000 before 30 June under 2025-26 rules.",
      stats: [
        { label: "Before 30 June", value: formatAUD(CAP_2025_26.ncc) },
        { label: "From 1 July", value: "$0 — locked ✗", highlight: true },
        { label: "Your TSB", value: "Over $2.1M ✗", highlight: true },
      ],
      consequences: [
        "The 2026-27 TSB lockout threshold is $2.1M (indexed from $2.0M with the Transfer Balance Cap)",
        "At or above $2.1M at 30 June 2026, NCCs are prohibited for the entire 2026-27 financial year",
        "You can still contribute up to $120,000 before 30 June 2026 under 2025-26 rules — this is the final opportunity",
        "Pension drawdowns or withdrawals before 30 June may bring TSB below $2.1M and unlock the annual cap from 1 July — worth modelling with an accountant",
        "Concessional contributions (employer / salary sacrifice up to $32,500) remain available from 1 July regardless of TSB",
        div296Flagged ? "Division 296 applies from 1 July 2026 to balances above $3M — a withdrawal strategy may help both positions simultaneously" : "",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "TSB lockout at $2.1M is confirmed under ITAA 1997 s292-85, indexed with the Transfer Balance Cap.",
      tier: 147,
      ctaLabel: "Get My June 30 Execution Plan — $147 →",
      altTierLabel: "Just want the decision pack? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      timing, decisionGap: DECISION_GAP, div296Flagged,
    };
  }

  // ── TSB $1.97M–$2.1M: annual cap only ─────────────────────────────────────
  if (tsbBand === "1_97m_to_2_1m") {
    return {
      status: "ANNUAL CAP ONLY — NO BRING-FORWARD FROM 1 JULY",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `With TSB between $1.97M and $2.1M at 30 June 2026, you get the annual cap only from 1 July — no bring-forward. Sequencing gives you ${formatAUD(timing.totalPossible)} across the two financial years.`,
      stats: [
        { label: "Before 30 June", value: formatAUD(timing.maxBeforeJune30) },
        { label: "From 1 July", value: formatAUD(timing.maxAfterJuly1), highlight: false },
        { label: "Sequencing total", value: formatAUD(timing.totalPossible) },
      ],
      consequences: [
        `Contribute ${formatAUD(CAP_2025_26.ncc)} before 30 June 2026 under the 2025-26 annual cap`,
        `Then contribute ${formatAUD(CAP_2026_27.ncc)} from 1 July 2026 under the new 2026-27 annual cap (indexed)`,
        "No bring-forward available at this TSB bracket — annual caps only for both years",
        "Pension drawdowns before 30 June may bring TSB under $1.97M and unlock 2-year bring-forward ($260k) from 1 July — check with accountant",
        div296Flagged ? "Division 296 applies from 1 July 2026 — at this TSB level, you are approaching the $3M threshold" : "",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "TSB band confirmed — annual cap only applies at $1.97M–$2.1M.",
      tier: 147,
      ctaLabel: "Get My June 30 Execution Plan — $147 →",
      altTierLabel: "Just want the decision pack? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      timing, decisionGap: WAIT_ONLY_MAX - timing.totalPossible, div296Flagged,
    };
  }

  // ── TSB $1.84M–$1.97M: 2-year bring-forward ───────────────────────────────
  if (tsbBand === "1_84m_to_1_97m") {
    return {
      status: "2-YEAR BRING-FORWARD AVAILABLE FROM 1 JULY",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `With TSB between $1.84M and $1.97M at 30 June 2026, you can trigger a 2-year bring-forward ($260,000) from 1 July. Sequencing gives you ${formatAUD(timing.totalPossible)} across two financial years.`,
      stats: [
        { label: "Before 30 June", value: formatAUD(timing.maxBeforeJune30) },
        { label: "From 1 July (2-yr)", value: formatAUD(timing.maxAfterJuly1), highlight: false },
        { label: "Sequencing total", value: formatAUD(timing.totalPossible) },
      ],
      consequences: [
        `Contribute ${formatAUD(CAP_2025_26.ncc)} before 30 June 2026 under the 2025-26 annual cap (do NOT trigger bring-forward yet)`,
        `Then trigger the 2-year bring-forward from 1 July 2026: ${formatAUD(CAP_2026_27.bringForward2Year)} over 2 years at the new indexed cap`,
        "If TSB drops under $1.84M before 30 June (via drawdowns or market movement), the full 3-year bring-forward of $390,000 becomes available — total $510,000",
        "Do NOT trigger the bring-forward in June 2026 — that locks you into $360,000 under 2025-26 caps. Wait until 1 July.",
        div296Flagged ? "Division 296 applies from 1 July 2026 — monitor your TSB against the $3M threshold as contributions push it higher" : "",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "TSB band confirmed — 2-year bring-forward applies at $1.84M–$1.97M.",
      tier: 147,
      ctaLabel: "Get My June 30 Execution Plan — $147 →",
      altTierLabel: "Just want the decision pack? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      timing, decisionGap: SEQUENCING_MAX - timing.totalPossible, div296Flagged,
    };
  }

  // ── TSB under $1.84M: full 3-year bring-forward — THE $510K WINDOW ────────
  if (tsbBand === "under_1_84m") {
    return {
      status: "SEQUENCING WINDOW OPEN — $510,000 AVAILABLE",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `With TSB under $1.84M at 30 June 2026, the full sequencing window is open: contribute $120,000 before 30 June, then trigger the new $390,000 bring-forward from 1 July — $510,000 total across two financial years.`,
      stats: [
        { label: "Before 30 June", value: formatAUD(timing.maxBeforeJune30) },
        { label: "From 1 July (3-yr)", value: formatAUD(timing.maxAfterJuly1) },
        { label: "Sequencing total", value: formatAUD(timing.totalPossible) + " ✓" },
      ],
      consequences: [
        `Step 1: Contribute ${formatAUD(CAP_2025_26.ncc)} before 30 June 2026 as a standard annual NCC under 2025-26 rules. Do NOT trigger the bring-forward in June — that locks you into the old $360,000 cap.`,
        `Step 2: From 1 July 2026, trigger the 3-year bring-forward by contributing ${formatAUD(CAP_2026_27.bringForward3Year)} under the new 2026-27 caps. The 3-year period starts from this trigger.`,
        "Waiting until 1 July for everything means you get $390,000, not $510,000 — a $120,000 difference that cannot be recovered later",
        "Once triggered in July 2026, the 3-year bring-forward runs through 30 June 2029 — you cannot trigger a new bring-forward until it expires",
        "The indexation benefit is a one-time sequencing window — it does not repeat next year",
        div296Flagged ? "Division 296 applies from 1 July 2026 to balances above $3M — at this TSB level the impact is likely minimal, but model the projection with your accountant" : "",
        carryForwardIntent === true ? "You have unused carry-forward concessional cap — note that 2020-21 unused cap expires 30 June 2026 and cannot be recovered afterwards" : "",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "TSB under $1.84M confirmed — full 3-year bring-forward available at the new indexed cap from 1 July 2026.",
      tier: 147,
      ctaLabel: "Get My June 30 Execution Plan — $147 →",
      altTierLabel: "Just want the decision pack? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      timing, decisionGap: DECISION_GAP, div296Flagged,
    };
  }

  // Fallback — should not reach
  return {
    status: "CONFIRM YOUR INPUTS",
    statusClass: "text-neutral-700",
    panelClass: "border-neutral-200 bg-neutral-50",
    headline: "Confirm your TSB band, age, and bring-forward status to see your sequencing window.",
    stats: [
      { label: "Status", value: "Incomplete" },
      { label: "Next", value: "Check inputs" },
      { label: "Window", value: "To be determined" },
    ],
    consequences: ["Complete all questions to see your sequencing verdict"],
    confidence: "LOW",
    confidenceNote: "Incomplete inputs — cannot determine verdict.",
    tier: 67,
    ctaLabel: "Get My June 30 Decision Pack — $67 →",
    altTierLabel: "Want the full execution plan? — $147",
    productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
    timing, decisionGap: 0, div296Flagged,
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
  // Step 1: TSB band at 30 June 2026 — the primary gate
  {
    id: "tsb_band", step: 1, type: "button_group",
    label: "What is your expected Total Super Balance at 30 June 2026?",
    subLabel: "The TSB at 30 June 2026 (not today) determines your eligibility for the new 2026-27 caps",
    options: [
      { label: "Under $1.84M", value: "under_1_84m", subLabel: "Full 3-year bring-forward available — sequencing window open" },
      { label: "$1.84M–$1.97M", value: "1_84m_to_1_97m", subLabel: "2-year bring-forward only ($260k) from 1 July" },
      { label: "$1.97M–$2.1M", value: "1_97m_to_2_1m", subLabel: "Annual cap only ($130k) from 1 July" },
      { label: "$2.1M or above", value: "over_2_1m", subLabel: "Locked out from 1 July 2026" },
    ],
    required: true,
  },

  // Step 2: Age — gates eligibility entirely
  {
    id: "age", step: 2, type: "button_group",
    label: "What is your age at the time of contribution?",
    subLabel: "Age 75+ cannot make NCCs. Age 67-74 must meet the work test.",
    options: [
      { label: "Under 60", value: "under_60", subLabel: "No work test — full eligibility" },
      { label: "60–66", value: "60_to_66", subLabel: "No work test — full eligibility" },
      { label: "67–74", value: "67_to_74", subLabel: "Work test required (40 hrs / 30 days)" },
      { label: "75 or over", value: "75_plus", subLabel: "Cannot make non-concessional contributions" },
    ],
    required: true,
  },

  // Step 3: Work test — only asked for 67-74
  {
    id: "work_test", step: 3, type: "two_button",
    label: "Have you worked 40+ hours in a 30-day period in the financial year of the contribution?",
    subLabel: "Gainful employment only — paid work, not volunteer hours. The ATO may ask for evidence.",
    options: [
      { label: "Yes — work test met", value: true },
      { label: "No — not met / unsure", value: false },
    ],
    showIf: (a) => a.age === "67_to_74",
    required: true,
  },

  // Step 4: Bring-forward already triggered — the critical lockout gate
  {
    id: "bring_forward_triggered", step: 4, type: "two_button",
    label: "Have you already triggered the 3-year bring-forward in 2024-25 or 2025-26?",
    subLabel: "A bring-forward already running locks you into the old $360,000 cap — indexation does not apply mid-schedule",
    options: [
      { label: "No — bring-forward available", value: false },
      { label: "Yes — already triggered in a prior year", value: true },
    ],
    showIf: (a) => a.age !== "75_plus" && !(a.age === "67_to_74" && a.work_test === false),
    required: true,
  },

  // Step 5: Division 296 awareness — drives messaging + cross-link to AU-12
  {
    id: "div296_affected", step: 5, type: "two_button",
    label: "Is your Total Super Balance approaching or above $3 million?",
    subLabel: "Division 296 applies an additional 15% tax from 1 July 2026 on earnings attributable to balances above $3M — contributing more may increase exposure",
    options: [
      { label: "No — well under $3M", value: false },
      { label: "Yes — approaching or above $3M", value: true },
    ],
    showIf: (a) => a.age !== "75_plus" && a.bring_forward_triggered !== true,
  },

  // Step 6: Carry-forward concessional intent — 2020-21 unused expires 30 June 2026
  {
    id: "carry_forward", step: 6, type: "two_button",
    label: "Do you have unused concessional contribution cap from prior years (TSB under $500k)?",
    subLabel: "The 2020-21 unused concessional cap expires 30 June 2026 — permanent loss if not used",
    options: [
      { label: "Yes — have unused carry-forward", value: true },
      { label: "No / unsure / TSB over $500k", value: false },
    ],
    showIf: (a) => a.age !== "75_plus" && a.bring_forward_triggered !== true,
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

      {/* Sequencing breakdown (only shown when action is possible) */}
      {!verdict.timing.lockedOut && verdict.timing.totalPossible > 0 && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your sequencing plan</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Before 30 June 2026 (2025-26 annual cap)</span>
              <span className="font-mono font-bold text-neutral-950">{formatAUD(verdict.timing.maxBeforeJune30)}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">From 1 July 2026 (2026-27 bring-forward / annual cap)</span>
              <span className="font-mono font-bold text-neutral-950">{formatAUD(verdict.timing.maxAfterJuly1)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="font-semibold text-neutral-800">Total possible across two financial years</span>
              <span className="font-mono font-bold text-emerald-700">{formatAUD(verdict.timing.totalPossible)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Decision gap — the conversion weapon */}
      {verdict.decisionGap > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1">Decision gap</p>
          <p className="text-xs text-red-900">→ Getting this wrong costs up to {formatAUD(verdict.decisionGap)} of permanent contribution capacity.</p>
        </div>
      )}

      {/* Division 296 flag */}
      {verdict.div296Flagged && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700 mb-1">Division 296 interaction</p>
          <p className="text-xs text-amber-900">→ TSB approaching $3M — Division 296 applies from 1 July 2026. Model both decisions together before acting.</p>
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
        <p className="text-sm text-neutral-700 leading-relaxed">
          This is not about how much you can contribute. It is about <strong className="text-neutral-950">when.</strong> Same person, same money — the sequencing decision is worth up to {formatAUD(DECISION_GAP)}.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What's in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your exact 30 June / 1 July sequencing window — amounts and timing</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>TSB bracket analysis with bring-forward eligibility at 30 June 2026</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Bring-forward status check (already triggered vs available)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Decision gap calculation for your exact situation</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>3 accountant questions written for your exact TSB and bring-forward status</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your TSB and timing</p>
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

export default function BringForwardWindowCalculator() {
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

  // Auto-advance when step complete
  useEffect(() => {
    if (!stepComplete) return;
    const t = setTimeout(() => {
      const next = step + 1;
      if (next <= TOTAL_STEPS) setStep(next);
      else setVerdict(true);
    }, visibleQs.length ? 300 : 0);
    return () => clearTimeout(t);
  }, [stepComplete, step, visibleQs.length]);

  // Scroll to verdict
  useEffect(() => {
    if (showVerdict && verdictRef.current)
      setTimeout(() => verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [showVerdict]);

  // Lock body scroll when popup open
  useEffect(() => {
    document.body.style.overflow = showPopup ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showPopup]);

  // Log decision session on verdict display
  useEffect(() => {
    if (!showVerdict || !verdict) return;
    fetch("/api/decision-sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_slug: "bring-forward-window",
        source_path: "/au/check/bring-forward-window",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          total_possible: verdict.timing.totalPossible,
          locked_out: verdict.timing.lockedOut,
          decision_gap: verdict.decisionGap,
          div296_flagged: verdict.div296Flagged,
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
      body: JSON.stringify({ email, source: "bring_forward_window", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `bfw_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    // Save sessionStorage keys — MUST match config's successPromptFields exactly
    sessionStorage.setItem("bring-forward-window_tsb_band", String(answers.tsb_band || ""));
    sessionStorage.setItem("bring-forward-window_age", String(answers.age || ""));
    sessionStorage.setItem("bring-forward-window_bring_forward_triggered", String(answers.bring_forward_triggered ?? false));
    sessionStorage.setItem("bring-forward-window_total_possible", String(verdict.timing.totalPossible));
    sessionStorage.setItem("bring-forward-window_locked_out", String(verdict.timing.lockedOut));
    sessionStorage.setItem("bring-forward-window_decision_gap", String(verdict.decisionGap));
    sessionStorage.setItem("bring-forward-window_status", verdict.status);
    sessionStorage.setItem("bring-forward-window_tier", String(popupTier));

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
          success_url: `${window.location.origin}/au/check/bring-forward-window/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/bring-forward-window`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your result to show your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your contribution window position by email — free.</p>
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
                    {verdict.timing.lockedOut ? "Your contribution window — locked out"
                     : verdict.decisionGap > 0 ? "Your June 30 sequencing window"
                     : "Your contribution plan"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">ATO-referenced · April 2026</p>
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
                      {popupTier === 67 ? "Your June 30 Decision Pack™" : "Your June 30 Execution Plan™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your exact 30 June / 1 July sequencing window, TSB bracket analysis, bring-forward eligibility check, decision gap calculation, and 3 accountant questions — built for your exact TSB and timing."
                        : "Full sequencing plan with SMSF timing requirements, Division 296 interaction modelling, carry-forward concessional maximisation, and an accountant-ready implementation worksheet you can action before 30 June."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic super guide. A plan for your exact TSB and bring-forward position.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Get My June 30 Decision Pack →" : "Get My June 30 Execution Plan →"}
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
                    { label: "How urgent is this decision?", key: "urgency", options: [["this_year","Acting this financial year"],["planning","Planning ahead — not urgent yet"],["just_checking","Just checking my position"]] },
                    { label: "Do you have an accountant or financial adviser?", key: "accountant", options: [["accountant","Yes — accountant"],["adviser","Yes — financial adviser"],["both","Both"],["no","No — managing myself"]] },
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

      {/* Mobile sticky bar — shown when sequencing is open or locked out (live fear either way) */}
      {showVerdict && verdict && (!verdict.timing.lockedOut || verdict.decisionGap > 0) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">June 30 Window</p>
              <p className="text-sm font-bold text-neutral-950">
                {verdict.timing.lockedOut ? "Locked out — know your position" : `${formatAUD(verdict.timing.totalPossible)} available — sequence correctly`}
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
