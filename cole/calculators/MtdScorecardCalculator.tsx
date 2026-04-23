"use client";

/**
 * UK-01 — MTD Mandation Engine
 * Pattern: A (StatusCheck — mandated vs not) + B (Timeline — exact mandate date)
 *
 * Core question: Is this person mandated under MTD ITSA — and what happens if they miss it?
 *
 * Key facts (HMRC confirmed April 2026):
 *   MTD ITSA (Making Tax Digital for Income Tax Self Assessment) under Finance Act 2021
 *   Phase 1: 6 April 2026 — gross income over £50,000 (self-employment + property combined)
 *   Phase 2: 6 April 2027 — gross income over £30,000
 *   Phase 3: 6 April 2028 — gross income over £20,000
 *   Reporting change: 1 annual self-assessment → 4 quarterly updates + 1 final declaration = 5 submissions/year
 *   HMRC-approved software mandatory — spreadsheets alone do not qualify (bridging tools needed)
 *   Penalty regime: £200 initial + £10/day up to 90 days = up to £1,100 per missed quarterly update
 *   Maximum annual penalty: £4,400 if all 4 quarters missed
 *   Legal anchor: Finance Act 2021 + implementing regulations
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type MandateWave = 1 | 2 | 3 | null;

interface MtdResult {
  mandated: boolean;
  mandateDate: string;
  mandateIso: string;
  mandateWave: MandateWave;
  incomeBand: string;
  softwareGap: boolean;
  unaware: boolean;
  perQuarterPenaltyMax: number;   // £1,100
  annualPenaltyMax: number;       // £4,400
  currentSubmissions: 1;
  mtdSubmissions: 5;
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
  result: MtdResult;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — HMRC confirmed April 2026
// ─────────────────────────────────────────────────────────────────────────────

const PENALTY_INITIAL = 200;                                        // £200 initial
const PENALTY_DAILY = 10;                                           // £10/day
const PENALTY_MAX_DAYS = 90;                                        // capped at 90 days
const PER_QUARTER_PENALTY_MAX = PENALTY_INITIAL + PENALTY_DAILY * PENALTY_MAX_DAYS;  // £1,100
const ANNUAL_PENALTY_MAX = PER_QUARTER_PENALTY_MAX * 4;             // £4,400

const PRODUCT_KEYS = {
  p67:  "uk_67_mtd_scorecard",
  p147: "uk_147_mtd_scorecard",
};

function formatGBP(n: number): string {
  return "£" + Math.round(n).toLocaleString("en-GB");
}

// ─────────────────────────────────────────────────────────────────────────────
// CALCULATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcMtd(answers: AnswerMap): MtdResult {
  const incomeBand     = String(answers.income_band || "30k_to_50k");
  const recordKeeping  = String(answers.record_keeping || "spreadsheets");
  const quarterlyAware = answers.quarterly_aware === true;

  let mandated = false;
  let mandateDate = "Not currently in scope";
  let mandateIso = "";
  let mandateWave: MandateWave = null;

  if (incomeBand === "over_50k") {
    mandated = true; mandateDate = "6 April 2026"; mandateIso = "2026-04-06"; mandateWave = 1;
  } else if (incomeBand === "30k_to_50k") {
    mandated = true; mandateDate = "6 April 2027"; mandateIso = "2027-04-06"; mandateWave = 2;
  } else if (incomeBand === "20k_to_30k") {
    mandated = true; mandateDate = "6 April 2028"; mandateIso = "2028-04-06"; mandateWave = 3;
  }

  const softwareGap = recordKeeping !== "digital";
  const unaware = !quarterlyAware;

  return {
    mandated,
    mandateDate,
    mandateIso,
    mandateWave,
    incomeBand,
    softwareGap,
    unaware,
    perQuarterPenaltyMax: PER_QUARTER_PENALTY_MAX,
    annualPenaltyMax: ANNUAL_PENALTY_MAX,
    currentSubmissions: 1,
    mtdSubmissions: 5,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcMtd(answers);
  const urgencyBoost = result.softwareGap || result.unaware;

  // ── Wave 1 — Over £50k, MANDATED NOW ──────────────────────────────────────
  if (result.mandateWave === 1) {
    return {
      status: "YOU ARE MANDATED — MTD APPLIES FROM 6 APRIL 2026",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Your gross income exceeds £50,000, so Making Tax Digital for Income Tax is mandatory for you from 6 April 2026. Your reporting changes from 1 annual self-assessment to 5 submissions per year — 4 quarterly updates plus 1 final declaration. Miss any of them and HMRC can charge up to ${formatGBP(result.perQuarterPenaltyMax)} per missed quarter — up to ${formatGBP(result.annualPenaltyMax)}/year in penalties alone.`,
      stats: [
        { label: "Mandate date", value: "6 Apr 2026", highlight: true },
        { label: "Submissions / year", value: "1 → 5", highlight: true },
        { label: "Max annual penalty", value: formatGBP(result.annualPenaltyMax), highlight: true },
      ],
      consequences: [
        `🔒 YOU ARE MANDATED. From 6 April 2026 you must use HMRC-approved software, file 4 quarterly updates, and submit a final declaration. This is statutory under Finance Act 2021 — not optional, not a readiness exercise.`,
        `Reporting change: 1 annual tax return (today) → 4 quarterly updates + 1 annual final declaration = 5 submissions per year. Each quarterly update is a brief digital summary — not a mini tax return — but it IS a mandatory filing with a deadline.`,
        `Quarterly deadlines: Q1 (Apr–Jul) due 5 August · Q2 (Jul–Oct) due 5 November · Q3 (Oct–Jan) due 5 February · Q4 (Jan–Apr) due 5 May. Annual final declaration remains due 31 January.`,
        `🔒 Penalty regime: each missed quarterly update triggers £${PENALTY_INITIAL} initial + £${PENALTY_DAILY} per day up to ${PENALTY_MAX_DAYS} days = ${formatGBP(result.perQuarterPenaltyMax)} per missed quarter. Missing all 4 quarters = ${formatGBP(result.annualPenaltyMax)}/year in penalties, on top of any late-payment interest.`,
        result.softwareGap ? `⚠ SOFTWARE GAP: You are not currently on HMRC-approved software. Spreadsheets and paper records do not satisfy MTD requirements unless bridged with approved software. Options: QuickBooks, Xero, FreeAgent, Sage. Migrate BEFORE 6 April 2026.` : `✓ You already use HMRC-approved software — the core compliance piece is in place.`,
        result.unaware ? `⚠ AWARENESS GAP: You did not know MTD turns 1 annual return into 5 submissions. This is the single most common MTD misconception, and it is what causes missed quarterly deadlines in the first year.` : `✓ You already know quarterly updates are required — ahead of most mandated taxpayers at this stage.`,
      ],
      confidence: "HIGH",
      confidenceNote: `MTD ITSA threshold of £50,000 is statutory under Finance Act 2021. Mandate date 6 April 2026 is confirmed. Penalty regime is operational.`,
      tier: urgencyBoost ? 147 : 67,
      ctaLabel: urgencyBoost ? "Get My MTD Implementation Plan — £147 →" : "Get My MTD Readiness Pack — £67 →",
      altTierLabel: urgencyBoost ? "Just want the readiness check? — £67 instead" : "Want the full implementation plan? — £147 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── Wave 2 — £30k–£50k, NEXT WAVE ──────────────────────────────────────────
  if (result.mandateWave === 2) {
    return {
      status: "YOU ARE IN NEXT WAVE — MTD APPLIES FROM 6 APRIL 2027",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your gross income falls in the £30,000–£50,000 band. MTD ITSA is mandatory for you from 6 April 2027 — one year after Phase 1. Same mechanics apply from day one of mandate: HMRC-approved software, 4 quarterly updates, final declaration, and the full penalty regime of up to ${formatGBP(result.annualPenaltyMax)}/year.`,
      stats: [
        { label: "Mandate date", value: "6 Apr 2027", highlight: true },
        { label: "Submissions / year", value: "1 → 5", highlight: true },
        { label: "Max annual penalty", value: formatGBP(result.annualPenaltyMax), highlight: true },
      ],
      consequences: [
        `You are in the £30,000–£50,000 band — mandated from 6 April 2027. Same rules, one year later. Software + quarterly + final declaration + penalty regime all apply from day one.`,
        `Reporting change from 6 April 2027: 1 annual return → 5 submissions/year. Quarterly deadlines same as Phase 1 (5 Aug, 5 Nov, 5 Feb, 5 May). Final declaration still due 31 January.`,
        `You have a full Phase 1 year (April 2026 – April 2027) to observe how £50k+ taxpayers handle the transition before your mandate date. Use it to choose software and build quarterly book-keeping habits.`,
        result.softwareGap ? `⚠ SOFTWARE GAP: You are not on approved software yet. Migrate to QuickBooks, Xero, FreeAgent, or Sage well before April 2027. Spreadsheet-only users need bridging software.` : `✓ You are already on approved software — the hardest migration piece is done.`,
        result.unaware ? `⚠ AWARENESS GAP: You did not know quarterly submissions are required. Most £30–50k taxpayers are in the same position. Start the quarterly book-keeping habit before mandate — by the time it hits, it should be routine.` : `✓ You already know quarterly updates are required.`,
        `Penalty exposure from 6 April 2027: ${formatGBP(result.perQuarterPenaltyMax)} per missed quarter × up to 4 quarters = ${formatGBP(result.annualPenaltyMax)}/year. Admin drift kills first-year compliance — set up now.`,
      ],
      confidence: "HIGH",
      confidenceNote: "Phase 2 threshold and mandate date confirmed under Finance Act 2021 implementing regulations.",
      tier: urgencyBoost ? 147 : 67,
      ctaLabel: urgencyBoost ? "Get My MTD Implementation Plan — £147 →" : "Get My MTD Readiness Pack — £67 →",
      altTierLabel: urgencyBoost ? "Just want the readiness check? — £67 instead" : "Want the full implementation plan? — £147 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── Wave 3 — £20k–£30k, FINAL WAVE ─────────────────────────────────────────
  if (result.mandateWave === 3) {
    return {
      status: "YOU ARE IN FINAL WAVE — MTD APPLIES FROM 6 APRIL 2028",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your gross income falls in the £20,000–£30,000 band — the final phase of the MTD ITSA rollout. Mandate date is 6 April 2028. You have two years of lead time, but the same penalty regime of up to ${formatGBP(result.annualPenaltyMax)}/year applies from day one of mandate.`,
      stats: [
        { label: "Mandate date", value: "6 Apr 2028", highlight: true },
        { label: "Submissions / year", value: "1 → 5" },
        { label: "Max annual penalty", value: formatGBP(result.annualPenaltyMax) },
      ],
      consequences: [
        `You are in the £20,000–£30,000 band — mandated from 6 April 2028, the final announced phase of MTD ITSA rollout.`,
        `Two years of lead time is the advantage. Use it to move to approved software, run a dry-run quarterly cycle, and have an accountant sign off on your setup before mandate hits.`,
        result.softwareGap ? `⚠ Move to HMRC-approved software during 2026-27 at the latest. Small landlords and sole traders routinely under-estimate how long migration from spreadsheets takes — set aside 2-3 months including a full quarterly cycle.` : `✓ You are already on approved software — in the best long-term position of any wave.`,
        result.unaware ? `⚠ AWARENESS GAP: You did not know quarterly submissions are required. You have time to learn but don't let this drift — the habit of quarterly book-keeping is the hardest part of the transition.` : `✓ You already know quarterly updates are required.`,
        `Same penalty regime as Phases 1 and 2: up to ${formatGBP(result.perQuarterPenaltyMax)} per missed quarter, up to ${formatGBP(result.annualPenaltyMax)}/year from 6 April 2028 onwards.`,
        `Watch for threshold changes — the government has not ruled out lowering the threshold below £20k in future phases. Being MTD-ready is a forward-looking advantage even if your income stays below £20k.`,
      ],
      confidence: "HIGH",
      confidenceNote: "Phase 3 threshold of £20,000 confirmed. Legislation for thresholds below £20k is not yet announced.",
      tier: 67,
      ctaLabel: "Get My MTD Readiness Pack — £67 →",
      altTierLabel: "Want the full implementation plan? — £147 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── Not in scope (under £20k) ─────────────────────────────────────────────
  return {
    status: "NOT YET IN SCOPE — BUT THRESHOLD DROPS FURTHER",
    statusClass: "text-emerald-700",
    panelClass: "border-emerald-200 bg-emerald-50",
    headline: `Your gross income is under £20,000, so you are not currently mandated under any announced phase of MTD ITSA. But the threshold history has been one-way downward — from £10k proposals to £50k/£30k/£20k — and future phases below £20k have not been ruled out.`,
    stats: [
      { label: "Currently mandated", value: "No ✓" },
      { label: "Lowest announced threshold", value: "£20k (Apr 2028)" },
      { label: "Direction of travel", value: "Threshold trending down" },
    ],
    consequences: [
      "MTD ITSA is not currently mandatory for your income level. Continue filing annual self-assessment as normal.",
      "The phased rollout has consistently lowered thresholds: £50k (2026) → £30k (2027) → £20k (2028). Further reductions below £20k have not been ruled out in future phases.",
      "If you are growing toward the £20k threshold, start thinking about approved software and quarterly book-keeping NOW. Switching before mandate is much easier than during.",
      "Watch combined income — MTD threshold is TOTAL gross income from self-employment + property. Small side-hustle + small rental can cross the threshold quickly.",
      "For now: no quarterly submissions, no software mandate, no new penalties. Annual self-assessment as usual.",
    ],
    confidence: "HIGH",
    confidenceNote: "Current MTD thresholds confirmed up to April 2028. Legislation below £20k threshold is not yet announced but is plausible given rollout pattern.",
    tier: 67,
    ctaLabel: "Show My MTD Position — £67 →",
    altTierLabel: "Want the full plan anyway? — £147",
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
    label: "What is your total gross income from self-employment and property?",
    subLabel: "GROSS = before expenses. Include ALL sources combined (self-employment + rental property).",
    options: [
      { label: "Under £20,000",       value: "under_20k",   subLabel: "Not currently mandated" },
      { label: "£20,000–£30,000",      value: "20k_to_30k", subLabel: "Mandated from April 2028" },
      { label: "£30,000–£50,000",      value: "30k_to_50k", subLabel: "Mandated from April 2027" },
      { label: "Over £50,000",         value: "over_50k",   subLabel: "Mandated from April 2026 — NOW" },
    ],
    required: true,
  },
  {
    id: "income_source", step: 2, type: "button_group",
    label: "What are your income sources?",
    subLabel: "MTD applies to self-employment AND property income combined — PAYE and dividends don't count.",
    options: [
      { label: "Self-employed only",              value: "self_employed",    subLabel: "Freelance, sole trader, consultant" },
      { label: "Landlord / property only",         value: "landlord",         subLabel: "Residential or commercial rental" },
      { label: "Both self-employed + property",    value: "both",             subLabel: "Combined income counts toward threshold" },
      { label: "Company director with rental",     value: "director_rental",  subLabel: "PAYE excluded; rental still counts" },
    ],
    required: true,
  },
  {
    id: "record_keeping", step: 3, type: "button_group",
    label: "What do you use for record-keeping today?",
    subLabel: "MTD requires HMRC-approved software. Spreadsheets and paper records do NOT qualify without bridging software.",
    options: [
      { label: "Approved software (QuickBooks, Xero, FreeAgent, Sage)", value: "digital",       subLabel: "MTD-ready already" },
      { label: "Spreadsheets only (Excel, Google Sheets)",               value: "spreadsheets",  subLabel: "Need bridging software or migration" },
      { label: "Paper / nothing digital",                                 value: "paper",         subLabel: "Significant migration required" },
    ],
    required: true,
  },
  {
    id: "quarterly_aware", step: 4, type: "two_button",
    label: "Did you know MTD requires 4 quarterly updates + 1 final declaration per year?",
    subLabel: "1 annual tax return becomes 5 submissions. Most people don't know this — it's the single biggest MTD misconception.",
    options: [
      { label: "Yes — I knew about quarterly submissions", value: true },
      { label: "No — I thought it was still annual",        value: false },
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

      {/* Mandate + penalty breakdown */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your MTD position in numbers</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Mandate status</span>
            <span className="font-mono font-bold text-neutral-950">{verdict.result.mandated ? "MANDATED" : "Not in scope"}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Mandate date</span>
            <span className="font-mono text-neutral-950">{verdict.result.mandateDate}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Submissions per year (current → MTD)</span>
            <span className="font-mono text-neutral-950">{verdict.result.currentSubmissions} → {verdict.result.mandated ? verdict.result.mtdSubmissions : verdict.result.currentSubmissions}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Software gap</span>
            <span className={`font-mono ${verdict.result.softwareGap ? "text-red-700 font-bold" : "text-emerald-700"}`}>{verdict.result.softwareGap ? "YES — migration required" : "No ✓"}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Awareness gap</span>
            <span className={`font-mono ${verdict.result.unaware ? "text-red-700 font-bold" : "text-emerald-700"}`}>{verdict.result.unaware ? "YES — quarterly habit to build" : "No ✓"}</span>
          </div>
          {verdict.result.mandated && (
            <>
              <div className="flex justify-between border-b border-neutral-100 pb-1">
                <span className="text-neutral-600">Max penalty per missed quarter</span>
                <span className="font-mono text-red-700">{formatGBP(verdict.result.perQuarterPenaltyMax)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-semibold text-neutral-800">Max annual penalty if all quarters missed</span>
                <span className="font-mono font-bold text-red-700">{formatGBP(verdict.result.annualPenaltyMax)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fear framing */}
      {verdict.result.mandated && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ What missing MTD deadlines actually costs</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-1">
            Up to {formatGBP(verdict.result.annualPenaltyMax)}/year in penalties — {formatGBP(verdict.result.perQuarterPenaltyMax)} per missed quarter (£{PENALTY_INITIAL} initial + £{PENALTY_DAILY}/day × up to {PENALTY_MAX_DAYS} days).
          </p>
          <p className="text-xs text-red-800 leading-relaxed">
            This is HMRC&apos;s new points-based penalty system. Penalties are additive — each missed quarter accumulates points, and the financial penalty kicks in at 4 points. Software and awareness gaps are the two biggest causes of first-year breaches.
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
          <strong className="text-neutral-950">MTD is a mandate, not a readiness exercise.</strong> The three things that cause first-year breaches are: not being on approved software, not knowing about quarterly updates, and treating MTD as optional because it&apos;s new.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your exact mandate date + income band confirmation</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Software migration path — ranked for your situation</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Quarterly submission calendar with all 4 deadlines</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Penalty risk assessment for YOUR income and software position</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 accountant questions written for YOUR mandate wave</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">£{verdict.tier} · One-time · Built around your mandate wave + software gap</p>
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

export default function MtdScorecardCalculator() {
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
        product_slug: "mtd-scorecard",
        source_path: "/uk/check/mtd-scorecard",
        country_code: "UK", currency_code: "GBP", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          mandated: verdict.result.mandated,
          mandate_date: verdict.result.mandateDate,
          mandate_wave: verdict.result.mandateWave,
          software_gap: verdict.result.softwareGap,
          unaware: verdict.result.unaware,
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
      body: JSON.stringify({ email, source: "mtd_scorecard", country_code: "UK", site: "taxchecknow" }),
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
    const sid = sessionId || `mtd_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("mtd-scorecard_income_band", String(answers.income_band || ""));
    sessionStorage.setItem("mtd-scorecard_income_source", String(answers.income_source || ""));
    sessionStorage.setItem("mtd-scorecard_record_keeping", String(answers.record_keeping || ""));
    sessionStorage.setItem("mtd-scorecard_quarterly_aware", String(answers.quarterly_aware || false));
    sessionStorage.setItem("mtd-scorecard_mandated", String(verdict.result.mandated));
    sessionStorage.setItem("mtd-scorecard_mandate_date", verdict.result.mandateDate);
    sessionStorage.setItem("mtd-scorecard_mandate_wave", String(verdict.result.mandateWave));
    sessionStorage.setItem("mtd-scorecard_software_gap", String(verdict.result.softwareGap));
    sessionStorage.setItem("mtd-scorecard_status", verdict.status);
    sessionStorage.setItem("mtd-scorecard_tier", String(popupTier));

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
          success_url: `${window.location.origin}/uk/check/mtd-scorecard/success/${successPath}`,
          cancel_url: `${window.location.origin}/uk/check/mtd-scorecard`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your mandate date and penalty exposure to show your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your MTD position by email — free.</p>
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
                    {popupTier === 67 ? "Your MTD Readiness Pack" : "Your MTD Implementation Plan"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">HMRC-referenced · Finance Act 2021 · April 2026</p>
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
                      {popupTier === 67 ? "MTD Readiness Pack™" : "MTD Implementation Plan™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your exact mandate date, software migration path, quarterly submission calendar, penalty exposure, and 5 accountant questions — built for your income band and record-keeping situation."
                        : "Full implementation plan: software selection + migration, quarterly book-keeping setup, penalty risk mitigation, accountant coordination brief, and multi-property reporting strategy if relevant."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">£{popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic MTD guide. A compliance plan for your exact mandate wave and software position.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My MTD Position →" : "Get My Implementation Plan →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the readiness check? — £67 instead" : "Want the full implementation plan? — £147 instead"}
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
                    { label: "Business structure", key: "entity_type", options: [["sole_trader","Sole trader / self-employed"],["landlord","Landlord (property only)"],["director","Company director with rental"],["both","Self-employed + landlord"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["acting_now","Acting before 6 April 2026"],["planning","Planning 12-24 months out"],["just_checking","Just checking my position"]] },
                    { label: "Do you have an accountant?", key: "accountant", options: [["accountant","Yes — accountant"],["adviser","Yes — financial adviser"],["both","Both"],["no","No — managing myself"]] },
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
      {showVerdict && verdict && verdict.result.mandated && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Max annual penalty</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatGBP(verdict.result.annualPenaltyMax)} if all quarters missed
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
