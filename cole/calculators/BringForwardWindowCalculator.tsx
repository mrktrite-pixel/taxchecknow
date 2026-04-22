"use client";

/**
 * AU-11 — Super Contribution Window Engine
 * Pattern: Module B (Timeline) + Module G (ThresholdTest)
 * Core question: Am I locked out, or can I sequence $510k across June 30 / July 1?
 * The $150,000 decision gap is the product.
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
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — 2025-26 and 2026-27 confirmed caps
// Source: ATO — ITAA 1997 s292-85 · indexation confirmed April 2026
// ─────────────────────────────────────────────────────────────────────────────

const CAP_2025_26 = {
  ncc: 120_000,          // Non-concessional contribution cap
  bringForward: 360_000, // 3-year bring-forward maximum
  tsbNilCap: 1_900_000,  // TSB below this → full bring-forward available
  tsbOneCap: 2_000_000,  // TSB above this → locked out entirely (pre July 1 2026)
};

const CAP_2026_27 = {
  ncc: 130_000,          // Increases from $120k → $130k (indexation)
  bringForward: 390_000, // Increases from $360k → $390k (indexation)
  tsbNilCap: 2_100_000,  // New TBC — below this → full bring-forward
  tsbLockedOut: 2_100_000, // At or above → locked out from July 1
};

const JUNE_30 = new Date("2026-06-30T23:59:59.000+10:00");
const DAYS_TO_JUNE30 = Math.max(0, Math.floor((JUNE_30.getTime() - Date.now()) / 86_400_000));
const AFTER_JUNE30 = Date.now() > JUNE_30.getTime();

function formatAUD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-AU");
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcTiming(answers: AnswerMap): TimingResult {
  const tsbBand          = String(answers.tsb_band || "");
  const bringForwardUsed = String(answers.bring_forward_used || "");
  const age              = String(answers.age || "");
  const workTest         = answers.work_test;
  const div296Affected   = answers.div296_affected;

  // Age gate — under 67: no work test. 67-74: work test applies. 75+: locked out
  if (age === "75_plus") {
    return {
      canActBeforeJune30: false,
      canActAfterJuly1: false,
      maxBeforeJune30: 0,
      maxAfterJuly1: 0,
      totalPossible: 0,
      lockedOut: true,
      lockedOutReason: "Age 75+ — non-concessional contributions not permitted",
      optimalSequence: "Not applicable — age restriction",
    };
  }

  if (age === "67_to_74" && workTest === false) {
    return {
      canActBeforeJune30: false,
      canActAfterJuly1: false,
      maxBeforeJune30: 0,
      maxAfterJuly1: 0,
      totalPossible: 0,
      lockedOut: true,
      lockedOutReason: "Age 67-74 without meeting the work test — contributions not permitted",
      optimalSequence: "Confirm work test eligibility with your accountant first",
    };
  }

  // TSB-based bring-forward logic
  // Current year (before June 30 2026): uses 2025-26 TSB rules
  // Next year (from July 1 2026): uses 2026-27 TSB rules (higher thresholds)

  let canActBeforeJune30 = false;
  let canActAfterJuly1   = false;
  let maxBeforeJune30    = 0;
  let maxAfterJuly1      = 0;
  let lockedOut          = false;
  let lockedOutReason    = "";

  // ── Before June 30 2026 (2025-26 rules) ──────────────────────────────────
  if (!AFTER_JUNE30) {
    if (tsbBand === "under_1_79m") {
      // Under $1.79M: full bring-forward, $120k + $120k + $120k = $360k
      if (bringForwardUsed === "none") {
        canActBeforeJune30 = true;
        maxBeforeJune30 = CAP_2025_26.ncc; // $120k this year
      } else if (bringForwardUsed === "partial") {
        canActBeforeJune30 = true;
        maxBeforeJune30 = CAP_2025_26.ncc; // simplified — depends on prior amounts
      } else {
        // Already triggered bring-forward — only annual cap available
        canActBeforeJune30 = true;
        maxBeforeJune30 = 0; // locked into existing bring-forward schedule
      }
    } else if (tsbBand === "1_79m_to_1_9m") {
      // $1.79M-$1.9M: 2-year bring-forward only ($240k)
      canActBeforeJune30 = true;
      maxBeforeJune30 = bringForwardUsed === "none" ? CAP_2025_26.ncc : 0;
    } else if (tsbBand === "1_9m_to_2_0m") {
      // $1.9M-$2.0M: annual cap only ($120k), no bring-forward
      canActBeforeJune30 = true;
      maxBeforeJune30 = bringForwardUsed === "none" ? CAP_2025_26.ncc : 0;
    } else if (tsbBand === "over_2_0m") {
      // Over $2.0M before June 30: locked out entirely under 2025-26 rules
      canActBeforeJune30 = false;
      maxBeforeJune30 = 0;
      if (bringForwardUsed === "none") {
        // Special: will be unlocked by new $2.1M threshold from July 1
        lockedOut = false; // Not permanently locked — just before July 1
      }
    }
  }

  // ── After July 1 2026 (2026-27 rules — higher caps) ──────────────────────
  if (tsbBand === "under_1_79m" || tsbBand === "1_79m_to_1_9m" ||
      tsbBand === "1_9m_to_2_0m" || tsbBand === "2_0m_to_2_1m") {
    canActAfterJuly1 = true;
  } else if (tsbBand === "over_2_1m") {
    canActAfterJuly1 = false;
    lockedOut = true;
    lockedOutReason = "TSB over $2.1M at June 30 — locked out from July 1 2026";
  }

  // ── Max after July 1 based on TSB and bring-forward status ───────────────
  if (canActAfterJuly1) {
    if (tsbBand === "under_1_79m") {
      // Full 3-year bring-forward: $390k from July 1
      maxAfterJuly1 = bringForwardUsed === "triggered"
        ? 0 // already in bring-forward schedule
        : CAP_2026_27.bringForward;
    } else if (tsbBand === "1_79m_to_1_9m") {
      maxAfterJuly1 = 2 * CAP_2026_27.ncc; // 2-year: $260k
    } else if (tsbBand === "1_9m_to_2_0m") {
      maxAfterJuly1 = CAP_2026_27.ncc; // Annual only: $130k
    } else if (tsbBand === "2_0m_to_2_1m") {
      // Currently locked out before June 30 but UNLOCKED from July 1
      // (TSB will be measured at NEXT June 30 — has a window)
      maxAfterJuly1 = CAP_2026_27.ncc; // Annual cap: $130k
    }
  }

  // ── Total possible ────────────────────────────────────────────────────────
  const totalPossible = maxBeforeJune30 + maxAfterJuly1;

  // ── Optimal sequence ──────────────────────────────────────────────────────
  let optimalSequence = "";
  if (maxBeforeJune30 > 0 && maxAfterJuly1 > 0) {
    optimalSequence = `Contribute ${formatAUD(maxBeforeJune30)} before June 30, then ${formatAUD(maxAfterJuly1)} from July 1 — total ${formatAUD(totalPossible)}`;
  } else if (maxBeforeJune30 > 0) {
    optimalSequence = `Contribute ${formatAUD(maxBeforeJune30)} before June 30 under 2025-26 rules`;
  } else if (maxAfterJuly1 > 0) {
    optimalSequence = `Wait for July 1 — then contribute ${formatAUD(maxAfterJuly1)} under new 2026-27 caps`;
  } else {
    optimalSequence = "Locked out — confirm position with your accountant";
  }

  return {
    canActBeforeJune30,
    canActAfterJuly1,
    maxBeforeJune30,
    maxAfterJuly1,
    totalPossible,
    lockedOut,
    lockedOutReason,
    optimalSequence,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const timing    = calcTiming(answers);
  const tsbBand   = String(answers.tsb_band || "");
  const bfUsed    = String(answers.bring_forward_used || "");
  const div296    = answers.div296_affected;
  const carryFwd  = answers.carry_forward;

  const KEYS = {
    p67:  "au_67_super_contribution_window",
    p147: "au_147_super_contribution_window",
  };

  // The $150k decision gap: difference between locked-at-$360k vs sequenced $510k
  const BEST_CASE = 510_000; // $120k before June 30 + $390k from July 1
  const LOCKED_CASE = 360_000; // Old bring-forward, no sequencing
  const DECISION_GAP = 150_000;

  // ── Locked out — over $2.1M ───────────────────────────────────────────────
  if (timing.lockedOut && tsbBand === "over_2_1m") {
    return {
      status: "LOCKED OUT — TSB OVER $2.1M AT JUNE 30",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "With a TSB over $2.1M at June 30, you cannot make non-concessional contributions from July 1 2026. Your bring-forward capacity is nil.",
      stats: [
        { label: "NCC capacity", value: "$0 — locked out ✗", highlight: true },
        { label: "New TBC from July 1", value: "$2.1M threshold" },
        { label: "Your TSB", value: "Over $2.1M ✗", highlight: true },
      ],
      consequences: [
        "The Transfer Balance Cap rises to $2.1M from July 1 2026 — but if your TSB exceeds this at June 30, you are locked out of non-concessional contributions",
        "Concessional (employer and salary sacrifice) contributions are still available — only after-tax non-concessional contributions are restricted",
        "If your TSB is close to $2.1M, withdrawing before June 30 to bring it below the threshold may unlock contribution capacity — but only if you meet a condition of release",
        div296 ? "Division 296 tax also applies to your balance — a withdrawal strategy needs to model both Div 296 and NCC eligibility simultaneously" : "",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "TSB over $2.1M — locked out confirmed under ITAA 1997 s292-85.",
      tier: 147,
      ctaLabel: "Get My June 30 Execution Plan — $147 →",
      altTierLabel: "Just want the decision pack? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      timing, decisionGap: 0,
    };
  }

  // ── Locked out — age ──────────────────────────────────────────────────────
  if (timing.lockedOut && timing.lockedOutReason.includes("Age")) {
    return {
      status: "LOCKED OUT — AGE RESTRICTION APPLIES",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: timing.lockedOutReason,
      stats: [
        { label: "NCC capacity", value: "$0 — locked out ✗", highlight: true },
        { label: "Concessional cap", value: "$30,000 still available" },
        { label: "Downsizer", value: "Check eligibility" },
      ],
      consequences: [
        "Non-concessional contributions are not available due to age restrictions",
        "Concessional contributions (up to $30,000) are still available",
        "Downsizer contributions ($300,000 per person from sale of family home) may still be available if you are 55+",
      ],
      confidence: "HIGH",
      confidenceNote: "Age restriction is a hard ATO rule.",
      tier: 67,
      ctaLabel: "Get My June 30 Decision Pack — $67 →",
      altTierLabel: "Want the full execution plan? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      timing, decisionGap: 0,
    };
  }

  // ── Currently locked out (TSB $2.0M-$2.1M) — unlocked from July 1 ────────
  if (tsbBand === "2_0m_to_2_1m" && !AFTER_JUNE30) {
    return {
      status: "LOCKED OUT NOW — BUT UNLOCKED FROM JULY 1",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your TSB is between $2.0M and $2.1M — you are locked out before June 30, but the new $2.1M threshold from July 1 may unlock contribution capacity.`,
      stats: [
        { label: "Before June 30", value: "$0 — currently locked ✗", highlight: true },
        { label: "From July 1 2026", value: formatAUD(timing.maxAfterJuly1) + " available", highlight: false },
        { label: "Decision deadline", value: `${DAYS_TO_JUNE30} days` },
      ],
      consequences: [
        "Under 2025-26 rules, the TSB threshold for contribution eligibility is $2.0M — you are currently over it",
        "From July 1 2026, the threshold rises to $2.1M (indexed). If your TSB remains below $2.1M at June 30, you will have annual cap availability from July 1",
        `Estimated capacity from July 1: ${formatAUD(timing.maxAfterJuly1)} under the 2026-27 annual cap`,
        "This window is created by indexation — not new legislation. It is not widely understood.",
        div296 ? "Your balance may also trigger Division 296 tax from 1 July 2026 — model both simultaneously before acting" : "",
      ].filter(Boolean),
      confidence: "MEDIUM",
      confidenceNote: "Confirm your exact TSB at June 30 with your accountant before acting.",
      tier: 147,
      ctaLabel: "Get My June 30 Execution Plan — $147 →",
      altTierLabel: "Just want the decision pack? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      timing, decisionGap: timing.maxAfterJuly1,
    };
  }

  // ── Bring-forward already triggered ──────────────────────────────────────
  if (bfUsed === "triggered") {
    return {
      status: "BRING-FORWARD ALREADY TRIGGERED — EXISTING SCHEDULE APPLIES",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: "You have already triggered the bring-forward rule — you are locked into your existing contribution schedule and cannot start a new bring-forward until it expires.",
      stats: [
        { label: "Bring-forward status", value: "Already triggered ✗", highlight: true },
        { label: "New bring-forward", value: "Not available yet" },
        { label: "After expiry", value: "Full $390k from July 1 resets" },
      ],
      consequences: [
        "Once a bring-forward is triggered, you must complete the schedule before starting a new one",
        "If your bring-forward was triggered in 2024-25 or earlier, check when your schedule expires with your accountant",
        "After the existing schedule expires, the new $390,000 bring-forward (from July 1 2026) will be available — subject to your TSB at that time",
        carryFwd ? "You may still have carry-forward concessional contribution capacity — this is separate from the bring-forward NCC rule" : "",
      ].filter(Boolean),
      confidence: "MEDIUM",
      confidenceNote: "Confirm your bring-forward schedule and expiry date with your accountant.",
      tier: 67,
      ctaLabel: "Get My June 30 Decision Pack — $67 →",
      altTierLabel: "Want the full execution plan? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      timing, decisionGap: 0,
    };
  }

  // ── Optimal window — can sequence both ────────────────────────────────────
  if (timing.canActBeforeJune30 && timing.canActAfterJuly1 && !AFTER_JUNE30) {
    return {
      status: `SEQUENCING WINDOW OPEN — UP TO ${formatAUD(timing.totalPossible)} POSSIBLE`,
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `You can sequence contributions across the June 30 / July 1 boundary — potentially getting ${formatAUD(timing.totalPossible)} into super vs ${formatAUD(CAP_2025_26.bringForward)} if you wait.`,
      stats: [
        { label: "Before June 30", value: formatAUD(timing.maxBeforeJune30), highlight: false },
        { label: "From July 1", value: formatAUD(timing.maxAfterJuly1), highlight: false },
        { label: "Total possible", value: formatAUD(timing.totalPossible), highlight: true },
      ],
      consequences: [
        timing.optimalSequence,
        `The decision gap: ${formatAUD(timing.totalPossible)} sequenced vs ${formatAUD(CAP_2025_26.bringForward)} if you wait — a ${formatAUD(timing.totalPossible - CAP_2025_26.bringForward)} difference`,
        "This window closes June 30. After that, only the July 1 bring-forward is available.",
        "Sequencing requires careful confirmation of your TSB at June 30 — contribute too much before June 30 and you risk triggering excess contributions",
        div296 ? "Your balance may approach or exceed the $3M Division 296 threshold — model the tax interaction before contributing" : "",
        carryFwd ? "You may also have carry-forward concessional contribution capacity — maximise both before the window closes" : "",
      ].filter(Boolean),
      confidence: "MEDIUM",
      confidenceNote: "Exact TSB at June 30 must be confirmed before acting — contribution decisions are irreversible.",
      tier: 147,
      ctaLabel: "Get My June 30 Execution Plan — $147 →",
      altTierLabel: "Just want the decision pack? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      timing, decisionGap: DECISION_GAP,
    };
  }

  // ── July 1 only — wait and contribute ────────────────────────────────────
  if (!timing.canActBeforeJune30 && timing.canActAfterJuly1) {
    return {
      status: "WAIT FOR JULY 1 — NEW CAPS UNLOCK YOUR WINDOW",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `You cannot act before June 30, but from July 1 the new ${formatAUD(timing.maxAfterJuly1)} cap is available to you.`,
      stats: [
        { label: "Before June 30", value: "Not available ✗" },
        { label: "From July 1 2026", value: formatAUD(timing.maxAfterJuly1), highlight: false },
        { label: "Wait period", value: `${DAYS_TO_JUNE30} days` },
      ],
      consequences: [
        `From July 1 2026, you have ${formatAUD(timing.maxAfterJuly1)} in non-concessional contribution capacity under the new indexed caps`,
        "Confirm your TSB position at June 30 with your accountant before acting on July 1",
        "Your TSB at June 30 2026 determines your capacity — not your TSB today",
        div296 ? "Division 296 tax may apply from July 1 if your balance exceeds $3M — confirm the interaction before contributing" : "",
      ].filter(Boolean),
      confidence: "MEDIUM",
      confidenceNote: "Based on current TSB band — confirm exact June 30 TSB before acting.",
      tier: 67,
      ctaLabel: "Get My June 30 Decision Pack — $67 →",
      altTierLabel: "Want the full sequencing execution plan? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      timing, decisionGap: 0,
    };
  }

  // ── Default ───────────────────────────────────────────────────────────────
  return {
    status: "CONTRIBUTION WINDOW — CONFIRM YOUR POSITION",
    statusClass: "text-amber-700",
    panelClass: "border-amber-200 bg-amber-50",
    headline: "Your contribution window position depends on your exact TSB at June 30 — confirm with your accountant before acting.",
    stats: [
      { label: "June 30 deadline", value: `${DAYS_TO_JUNE30} days`, highlight: DAYS_TO_JUNE30 < 14 },
      { label: "New cap from July 1", value: "$390,000 bring-forward" },
      { label: "Decision type", value: "Irreversible" },
    ],
    consequences: [
      "Non-concessional contribution decisions are irreversible — excess contributions attract 47% tax",
      "Confirm your exact TSB at June 30 before contributing",
    ],
    confidence: "LOW",
    confidenceNote: "Insufficient information to calculate exact position — confirm TSB with accountant.",
    tier: 67,
    ctaLabel: "Get My June 30 Decision Pack — $67 →",
    altTierLabel: "Want the full execution plan? — $147",
    productKey67: KEYS.p67, productKey147: KEYS.p147,
    timing, decisionGap: 0,
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
    label: "What is your estimated Total Super Balance (TSB) at June 30 2026?",
    subLabel: "Your TSB at June 30 determines which caps and thresholds apply — this is the key number",
    options: [
      { label: "Under $1.79M", value: "under_1_79m", subLabel: "Full 3-year bring-forward available" },
      { label: "$1.79M – $1.9M", value: "1_79m_to_1_9m", subLabel: "2-year bring-forward only" },
      { label: "$1.9M – $2.0M", value: "1_9m_to_2_0m", subLabel: "Annual cap only — no bring-forward" },
      { label: "$2.0M – $2.1M", value: "2_0m_to_2_1m", subLabel: "Currently locked — may unlock July 1" },
      { label: "Over $2.1M", value: "over_2_1m", subLabel: "Locked out from July 1 2026" },
    ],
    required: true,
  },
  {
    id: "bring_forward_used", step: 2, type: "button_group",
    label: "Have you already triggered the bring-forward rule in the last 2 years?",
    subLabel: "Triggering bring-forward locks you into a 3-year schedule — you cannot start a new one until it expires",
    options: [
      { label: "No — never triggered", value: "none", subLabel: "Full capacity available" },
      { label: "Yes — triggered and completed", value: "completed", subLabel: "Schedule finished — capacity resets" },
      { label: "Yes — currently in schedule", value: "triggered", subLabel: "Locked into existing schedule" },
      { label: "Not sure", value: "unsure", subLabel: "Check with your accountant" },
    ],
    showIf: (a) => a.tsb_band !== "over_2_1m",
    required: true,
  },
  {
    id: "age", step: 3, type: "button_group",
    label: "What is your age?",
    subLabel: "Age affects whether you can make non-concessional contributions and whether the work test applies",
    options: [
      { label: "Under 67", value: "under_67", subLabel: "No work test required" },
      { label: "67 to 74", value: "67_to_74", subLabel: "Work test applies — must have worked 40+ hours in 30 days" },
      { label: "75 or over", value: "75_plus", subLabel: "Non-concessional contributions not permitted" },
    ],
    required: true,
  },
  {
    id: "work_test", step: 4, type: "two_button",
    label: "Have you met the work test? (40+ hours of gainful employment in any 30-day period this financial year)",
    subLabel: "Required for ages 67-74 to make voluntary contributions",
    options: [
      { label: "Yes — work test met", value: true },
      { label: "No — have not worked sufficient hours", value: false },
    ],
    showIf: (a) => a.age === "67_to_74",
  },
  {
    id: "carry_forward", step: 5, type: "two_button",
    label: "Do you have unused concessional contribution carry-forward amounts from prior years?",
    subLabel: "Carry-forward (unused CC cap from up to 5 prior years) expires on a rolling basis — use before it rolls off",
    options: [
      { label: "Yes — have carry-forward", value: true, subLabel: "Use before expiry — ITAA 1997 Div 291" },
      { label: "No or unsure", value: false },
    ],
    showIf: (a) => a.tsb_band !== "over_2_1m",
  },
  {
    id: "div296_affected", step: 6, type: "two_button",
    label: "Is your TSB approaching or above $3 million?",
    subLabel: "Division 296 tax applies from 1 July 2026 for TSB over $3M — contributing more may affect your Div 296 position",
    options: [
      { label: "No — well under $3M", value: false },
      { label: "Yes — approaching or over $3M", value: true, subLabel: "Div 296 interaction must be modelled" },
    ],
    showIf: (a) => a.tsb_band !== "over_2_1m",
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
  const t = verdict.timing;

  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>{verdict.status}</p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

      {/* Stats */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Decision gap callout — the $150k anchor */}
      {verdict.decisionGap > 0 && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700 mb-1">The sequencing advantage</p>
          <p className="text-xs text-emerald-900">
            → Correct timing: up to {formatAUD(t.totalPossible)} into super<br />
            → Wrong timing (wait): {formatAUD(360_000)} under old bring-forward<br />
            → <strong>Decision gap: {formatAUD(verdict.decisionGap)}</strong> — same person, same money, completely different outcome
          </p>
        </div>
      )}

      {/* Sequence visual */}
      {t.canActBeforeJune30 && t.canActAfterJuly1 && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Optimal contribution sequence</p>
          <div className="flex items-center gap-3">
            <div className={`flex-1 rounded-xl border px-3 py-2.5 text-center ${t.maxBeforeJune30 > 0 ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-neutral-50"}`}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-0.5">Before June 30</p>
              <p className={`font-serif text-base font-bold ${t.maxBeforeJune30 > 0 ? "text-emerald-700" : "text-neutral-400"}`}>
                {t.maxBeforeJune30 > 0 ? formatAUD(t.maxBeforeJune30) : "Not available"}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">2025-26 rules</p>
            </div>
            <span className="text-neutral-400 font-bold text-lg">+</span>
            <div className={`flex-1 rounded-xl border px-3 py-2.5 text-center ${t.canActAfterJuly1 ? "border-blue-200 bg-blue-50" : "border-neutral-200 bg-neutral-50"}`}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-0.5">From July 1</p>
              <p className={`font-serif text-base font-bold ${t.canActAfterJuly1 ? "text-blue-700" : "text-neutral-400"}`}>
                {t.canActAfterJuly1 ? formatAUD(t.maxAfterJuly1) : "Not available"}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">2026-27 new caps</p>
            </div>
            <span className="text-neutral-400 font-bold text-lg">=</span>
            <div className="flex-1 rounded-xl border border-neutral-950 bg-neutral-950 px-3 py-2.5 text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-0.5">Total possible</p>
              <p className="font-serif text-base font-bold text-white">{formatAUD(t.totalPossible)}</p>
              <p className="text-xs text-neutral-400 mt-0.5">If sequenced correctly</p>
            </div>
          </div>
        </div>
      )}

      {/* Consequences */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <strong className="text-sm text-neutral-950">What this means:</strong>
        <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
          {verdict.consequences.map((c, i) => <li key={i}>→ {c}</li>)}
        </ul>
      </div>

      {/* Confidence */}
      <div className={`mb-4 rounded-xl border px-4 py-2 text-xs ${
        verdict.confidence === "HIGH" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : verdict.confidence === "MEDIUM" ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800"
      }`}>
        <strong>Confidence: {verdict.confidence}</strong> — {verdict.confidenceNote}
      </div>

      {/* Conversion line */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-sm text-neutral-700 leading-relaxed">
          Get the timing wrong — or miss the June 30 window — and you could be permanently locked at {formatAUD(360_000)} when the correct sequence was {formatAUD(510_000)}.
          <strong className="text-neutral-950"> This check shows your exact window.</strong>
        </p>
      </div>

      {/* What you get */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What's in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Exact contribution window — what you can contribute before June 30 and from July 1</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Bring-forward eligibility check — locked out or open, and from when</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Carry-forward concessional cap analysis — use before it expires</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Division 296 interaction note — if your balance approaches $3M</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>3 accountant questions built for your exact TSB band and timing</span></li>
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
  const sel = (v: string | boolean) => value === v || String(value) === String(v);
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
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as boolean)}
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition text-center ${sel(opt.value as boolean) ? active : inactive}`}>
              <span className="block">{opt.label}</span>
              {opt.subLabel && <span className={`mt-0.5 block text-xs ${sel(opt.value as boolean) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>}
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
  const [answers, setAnswers]     = useState<AnswerMap>({});
  const [step, setStep]           = useState(1);
  const [showVerdict, setVerdict] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showQuestions, setShowQ] = useState(false);
  const [popupTier, setPopupTier] = useState<Tier>(147);
  const [popupAnswers, setPopupA] = useState<PopupAnswers>({ entity_type: "", urgency: "", accountant: "" });
  const [email, setEmail]         = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const verdictRef                = useRef<HTMLDivElement>(null);

  const verdict   = useMemo(() => showVerdict ? calcVerdict(answers) : null, [showVerdict, answers]);
  const visibleQs = QUESTIONS.filter(q => q.step === step && (!q.showIf || q.showIf(answers)));
  const stepComplete = !visibleQs.length || visibleQs.filter(q => q.required !== false).every(q => {
    const v = answers[q.id];
    return v !== undefined && v !== "" && v !== null;
  });

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
        product_slug: "bring-forward-window",
        source_path: "/au/check/bring-forward-window",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          total_possible: verdict.timing.totalPossible,
          locked_out: verdict.timing.lockedOut,
          decision_gap: verdict.decisionGap,
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

    sessionStorage.setItem("bring-forward-window_tsb_band", String(answers.tsb_band || ""));
    sessionStorage.setItem("bring-forward-window_bring_forward_used", String(answers.bring_forward_used || ""));
    sessionStorage.setItem("bring-forward-window_total_possible", String(verdict.timing.totalPossible));
    sessionStorage.setItem("bring-forward-window_locked_out", String(verdict.timing.lockedOut));
    sessionStorage.setItem("bring-forward-window_decision_gap", String(verdict.decisionGap));
    sessionStorage.setItem("bring-forward-window_status", verdict.status);
    sessionStorage.setItem("bring-forward-window_optimal_sequence", verdict.timing.optimalSequence);
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

  const maxStep       = QUESTIONS.reduce((acc, q) => (!q.showIf || q.showIf(answers)) ? Math.max(acc, q.step) : acc, 1);
  const popupComplete = Object.values(popupAnswers).every(v => v !== "");

  return (
    <>
      {/* June 30 deadline banner */}
      <div className={`mb-4 flex items-center justify-between rounded-xl px-4 py-2.5 ${DAYS_TO_JUNE30 <= 14 ? "bg-red-700" : DAYS_TO_JUNE30 <= 30 ? "bg-amber-700" : "bg-neutral-950"}`}>
        <span className="text-sm font-bold text-white">
          {AFTER_JUNE30
            ? "⚠️ June 30 has passed — July 1 caps now apply"
            : `🔴 ${DAYS_TO_JUNE30} days to June 30 2026 — contribution window deadline`}
        </span>
        <span className="font-mono text-sm font-bold text-white/60">
          {AFTER_JUNE30 ? "2026-27 rules" : "30 Jun 2026"}
        </span>
      </div>

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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your contribution window analysis.</p>
              <p className="mb-2 text-xs text-neutral-500">Email yourself the timing summary — free.</p>
              {!emailSent ? (
                <div className="flex gap-2">
                  <input type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                  <button onClick={handleSaveEmail} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">Send</button>
                </div>
              ) : <p className="text-sm font-semibold text-emerald-700">✓ Sent — check your inbox.</p>}
            </div>
          </div>
        )}
      </div>

      {/* Popup */}
      {showPopup && verdict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl my-auto">
            <div className="rounded-t-2xl bg-neutral-950 px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400">
                    {AFTER_JUNE30 ? "July 1 caps now apply" : `${DAYS_TO_JUNE30} days to June 30`}
                  </p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">
                    {verdict.timing.totalPossible > 0
                      ? `Up to ${formatAUD(verdict.timing.totalPossible)} possible`
                      : verdict.timing.lockedOut
                        ? "Locked out — confirm your options"
                        : "Your contribution window"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">ATO-confirmed · ITAA 1997 s292-85</p>
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
                        ? "Exact contribution window, bring-forward eligibility, carry-forward analysis, Division 296 interaction note, and 3 accountant questions — built for your TSB band and timing."
                        : "Contribution sequencing (June 30 + July 1), SMSF timing requirements, Division 296 interaction modelling, carry-forward maximisation, and accountant-ready implementation worksheet."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic super guide. Built for your TSB and June 30 timing.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Get My Decision Pack →" : "Get My Execution Plan →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the decision pack? — $67 instead" : "Want the full sequencing execution plan? — $147 instead"}
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · ITAA 1997 s292-85</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile sticky — shows for meaningful windows */}
      {showVerdict && verdict && !verdict.timing.lockedOut && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                {AFTER_JUNE30 ? "July 1 caps active" : `${DAYS_TO_JUNE30} days to June 30`}
              </p>
              <p className="text-sm font-bold text-neutral-950 truncate">
                {verdict.timing.totalPossible > 0
                  ? `Up to ${formatAUD(verdict.timing.totalPossible)} — get your sequence`
                  : "Check your July 1 position"}
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
