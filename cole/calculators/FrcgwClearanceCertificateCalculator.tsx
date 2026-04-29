"use client";

/**
 * AU-19 — Foreign Resident Capital Gains Withholding (FRCGW)
 * Clearance Certificate Calculator
 *
 * Core question: Will the ATO withhold 15% at settlement on your property sale?
 *
 * Key facts (ATO confirmed April 2026):
 *   FRCGW: 15% withholding on sale price from 1 January 2025
 *   Threshold: $0 (all property sales apply, changed from $750,000)
 *   Previous rate: 12.5% (until 31 December 2024)
 *   Clearance certificate: Free, issued by ATO, 1-4 weeks processing
 *   Certificate requirement: Must be in buyer's solicitor's office BEFORE settlement
 *   Australian residents: Eligible for standard certificate
 *   Foreign residents: Must apply for variation certificate (no automatic exemption)
 *   If no certificate: buyer withholds 15%, cash locked 6-18 months pending ATO refund
 *   Legal anchor: TAA 1953 Schedule 1 Subdivision 14-D
 *   Enacted: Treasury Laws Amendment (Foreign Resident Capital Gains Withholding) Act 2024
 *   Effective: 1 January 2025
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;

interface FrcgwResult {
  salePrice: number;
  withholdingAmount: number;
  residencyStatus: string;
  certificateStatus: string;
  daysToSettlement: number;
  certificateRequired: boolean;
  urgencyLevel: string;
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
  result: FrcgwResult;
}

interface PopupAnswers {
  sale_context: string;
  settlement_status: string;
  accountant_engaged: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const RATE = 0.15;
const THRESHOLD = 0;
const MEDIAN_FEAR_NUMBER = 135_000;

const PRICE_MAP: Record<string, number> = {
  under_500k:     400_000,
  "500k_to_900k": 700_000,
  "900k_to_1_5m": 1_200_000,
  over_1_5m:      2_000_000,
};

const DAYS_MAP: Record<string, number> = {
  less_14:  7,
  "14_to_28": 21,
  "28_to_60": 45,
  over_60:  90,
};

const PRODUCT_KEYS = {
  p67:  "au_67_frcgw_clearance_certificate",
  p147: "au_147_frcgw_clearance_certificate",
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

function calcFrcgw(answers: AnswerMap): FrcgwResult {
  const priceBand       = String(answers.sale_price || "900k_to_1_5m");
  const residencyStatus = String(answers.residency_status || "au_resident");
  const certificateStatus = String(answers.certificate_status || "not_applied");
  const daysStr         = String(answers.days_to_settlement || "28_to_60");

  const salePrice       = PRICE_MAP[priceBand] ?? 1_200_000;
  const daysToSettlement = DAYS_MAP[daysStr] ?? 45;
  const withholdingAmount = salePrice * RATE;

  const certificateRequired = true; // Every Australian property sale from 1 Jan 2025 requires cert

  let urgencyLevel = "standard";
  if (residencyStatus === "foreign_resident") {
    urgencyLevel = "critical"; // No exemption available
  } else if (certificateStatus === "not_applied" && daysToSettlement < 28) {
    urgencyLevel = "critical";
  } else if (certificateStatus === "applied_waiting" && daysToSettlement < 14) {
    urgencyLevel = "critical";
  } else if (certificateStatus === "not_applied" && daysToSettlement >= 28 && daysToSettlement <= 60) {
    urgencyLevel = "high";
  }

  return {
    salePrice,
    withholdingAmount,
    residencyStatus,
    certificateStatus,
    daysToSettlement,
    certificateRequired,
    urgencyLevel,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC — BINARY OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcFrcgw(answers);
  const { salePrice, withholdingAmount, residencyStatus, certificateStatus, daysToSettlement } = result;

  // ── VERDICT 1: AU resident + HAS certificate → NO WITHHOLDING ────────────
  if (residencyStatus === "au_resident" && certificateStatus === "have_cert") {
    return {
      status: "CERTIFICATE IN HAND — WITHHOLDING WILL NOT APPLY",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `You have your ATO clearance certificate. WITHHOLDING WILL NOT APPLY — the buyer's solicitor will pay you the full ${formatAUD(salePrice)} at settlement. No cash locked up. No refund wait.`,
      stats: [
        { label: "Your sale price", value: formatAUDShort(salePrice) },
        { label: "Amount you will receive", value: formatAUDShort(salePrice), highlight: true },
        { label: "Withholding exposure avoided", value: formatAUD(withholdingAmount), highlight: true },
      ],
      consequences: [
        "WITHHOLDING WILL NOT APPLY — CERTIFICATE CONFIRMS EXEMPTION. Your clearance certificate proves to the buyer's solicitor that the ATO has assessed your residency and exempted you from the 15% withholding requirement.",
        `The full ${formatAUD(salePrice)} is paid to you at settlement. No portion is withheld. No cash flow disruption.`,
        "Your accountant or solicitor hands the certificate to the buyer's solicitor before settlement morning — confirm receipt in writing 1 day before settlement to close the loop.",
        "Once settlement completes with the certificate in the buyer's possession, the withholding trigger is satisfied. You have no tax adjustment to make on your next return (unless there is a separate CGT liability on the gain — that is a different calculation).",
        "Keep a copy of the certificate and the settlement statement together — audit-trail evidence if the ATO ever queries the transaction.",
      ],
      confidence: "HIGH",
      confidenceNote: "Certificate in hand = withholding cancelled. This is a binary outcome — no risk.",
      tier: 67,
      ctaLabel: "Confirm My Settlement Plan — $67 →",
      altTierLabel: "Want the full execution plan too? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── VERDICT 2: Foreign resident → WITHHOLDING WILL APPLY: $X (tier 147) ───
  if (residencyStatus === "foreign_resident") {
    return {
      status: "FOREIGN RESIDENT — NO EXEMPTION AVAILABLE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `As a foreign resident, you are not automatically exempt from the 15% withholding. WITHHOLDING WILL APPLY: ${formatAUD(withholdingAmount)} at settlement — unless you have a variation certificate from the ATO confirming an exemption applies. Most foreign residents do not qualify for variation certificates. Plan on the withholding happening.`,
      stats: [
        { label: "Your sale price", value: formatAUDShort(salePrice) },
        { label: "15% withholding at settlement", value: formatAUD(withholdingAmount), highlight: true },
        { label: "What you receive on settlement day", value: formatAUD(salePrice - withholdingAmount), highlight: true },
      ],
      consequences: [
        "WITHHOLDING WILL APPLY: $X — foreign residents have no standard exemption from the 15% withholding requirement.",
        `At settlement, the buyer's solicitor must withhold ${formatAUD(withholdingAmount)} (15% of your sale price). You receive ${formatAUD(salePrice - withholdingAmount)} on settlement day.`,
        `The ${formatAUD(withholdingAmount)} is held by the buyer's solicitor pending the ATO's refund. Refund timeline varies by circumstances — typically 6–18 months if you are eligible, longer or not at all for foreign residents depending on your tax status in your home country.`,
        "Variation certificate path: if your circumstances justify an exemption (e.g. former Australian resident, short-term working visa holder returning home), contact the ATO to apply for a variation certificate. Processing is slower and the threshold for approval is high.",
        `Plan your cash flow for the withdrawal of ${formatAUD(withholdingAmount)} on settlement day — this is not optional unless you have a signed variation certificate before settlement morning.`,
        "The buyer's solicitor is required by law to withhold — they cannot waive it because you promise to get a refund later.",
      ],
      confidence: "HIGH",
      confidenceNote: "Foreign residents do not qualify for the standard exemption. Variation certificates are rare. Budget for withholding.",
      tier: 147,
      ctaLabel: "Get My Execution Plan — $147 →",
      altTierLabel: "Just want the decision? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── VERDICT 3: AU resident + NOT applied + days < 28 → CRITICAL ───────────
  if (residencyStatus === "au_resident" && certificateStatus === "not_applied" && daysToSettlement < 28) {
    return {
      status: "CRITICAL: SETTLEMENT IN LESS THAN 28 DAYS — NO CERTIFICATE YET",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Settlement is ${daysToSettlement} days away and you have not yet applied for your clearance certificate. ATO processing takes 1–4 weeks. CRITICAL: WITHHOLDING WILL APPLY: ${formatAUD(withholdingAmount)} at settlement unless you apply to the ATO urgently TODAY and they approve it in time.`,
      stats: [
        { label: "Your sale price", value: formatAUDShort(salePrice) },
        { label: "15% withholding at settlement", value: formatAUD(withholdingAmount), highlight: true },
        { label: "Days to settlement", value: String(daysToSettlement), highlight: true },
      ],
      consequences: [
        `CRITICAL: WITHHOLDING WILL APPLY: ${formatAUD(withholdingAmount)} — you have fewer than 28 days until settlement and the certificate is not yet lodged.`,
        `ATO processing takes 1–4 weeks. At ${daysToSettlement} days, you are in the high-risk zone. Even with urgent application today, there is no guarantee the certificate will arrive before settlement morning.`,
        "If the certificate does not arrive: the buyer's solicitor must withhold 15%. That cash is then locked up for 6–18 months pending the ATO refund. Your cash flow is disrupted by months.",
        "Your options: (1) Apply to the ATO today and request urgent processing — cite your settlement date. (2) Ask the buyer to agree to a settlement extension — rare, and the buyer may refuse. (3) Accept the withholding and plan for the refund in 6–18 months.",
        "Do not assume the ATO will approve urgent processing. Urgent applications are granted only in exceptional cases. Plan on the withholding happening unless you have written confirmation from the ATO that the certificate will be issued before settlement.",
        "If settlement goes ahead without the certificate, confirm with the buyer's solicitor in writing that the withholding has occurred so you can claim the refund through the tax system.",
      ],
      confidence: "HIGH",
      confidenceNote: "Less than 28 days + no certificate = withholding is probable. Action needed immediately.",
      tier: 147,
      ctaLabel: "Get My Execution Plan — $147 →",
      altTierLabel: "Just want the decision? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── VERDICT 4: AU resident + NOT applied + days 28-60 → WITHHOLDING UNLESS APPLY THIS WEEK ──
  if (residencyStatus === "au_resident" && certificateStatus === "not_applied" && daysToSettlement >= 28 && daysToSettlement <= 60) {
    return {
      status: "HIGH URGENCY — APPLY THIS WEEK OR WITHHOLDING WILL OCCUR",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `You have ${daysToSettlement} days until settlement and you have not yet applied for your clearance certificate. You still have a window, but it is closing fast. Apply this week to give the ATO 3+ weeks to process. If you delay: WITHHOLDING WILL APPLY: ${formatAUD(withholdingAmount)} — UNLESS YOU APPLY THIS WEEK.`,
      stats: [
        { label: "Your sale price", value: formatAUDShort(salePrice) },
        { label: "Withholding if no certificate", value: formatAUD(withholdingAmount), highlight: true },
        { label: "Days to settlement", value: String(daysToSettlement) },
      ],
      consequences: [
        `WITHHOLDING WILL APPLY: ${formatAUD(withholdingAmount)} — UNLESS YOU APPLY THIS WEEK. You have ${daysToSettlement} days to settlement. ATO processing is 1–4 weeks. The margin is tight but still in play.`,
        "The ATO needs 3–4 weeks to process and approve your application. If you apply this week, the certificate has 2–3 weeks' chance of arriving before settlement. If you wait: processing time shrinks, risk of late arrival grows exponentially.",
        `If the certificate arrives before settlement: zero withholding, you receive the full ${formatAUD(salePrice)}. If it arrives after: the buyer withholds ${formatAUD(withholdingAmount)}, and you wait 6–18 months for refund.`,
        "Action: Contact your accountant TODAY. Assemble your residency evidence NOW (tax returns, address proof, employment records, bank statements). Submit the application to the ATO within 48 hours. Do not delay.",
        "Residency evidence the ATO needs: last 2 tax returns, current address proof (utility bill/rates), employment records, Australian bank statements. Have these ready before you apply.",
        "After application: check with the ATO weekly on status. Most approvals in 2–3 weeks; some take 4 weeks. The moment it is issued, your accountant must courier it to the buyer's solicitor.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Window is still open but closing. Application THIS WEEK is the difference between no withholding and a 6-18 month cash lock-up.",
      tier: 67,
      ctaLabel: "Show My Application Checklist — $67 →",
      altTierLabel: "Want the full pre-settlement plan? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── VERDICT 5: AU resident + APPLIED waiting + days < 14 → PENDING CONDITIONAL ──
  if (residencyStatus === "au_resident" && certificateStatus === "applied_waiting" && daysToSettlement < 14) {
    return {
      status: "APPLICATION IN PROGRESS — CRITICAL TIMEFRAME",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Your application is with the ATO but settlement is ${daysToSettlement} days away — less than 2 weeks. If the certificate arrives in time: zero withholding. If it does not arrive by 9 am on settlement morning: WITHHOLDING WILL APPLY: ${formatAUD(withholdingAmount)}. This is now a race against the clock.`,
      stats: [
        { label: "Your sale price", value: formatAUDShort(salePrice) },
        { label: "Potential withholding", value: formatAUD(withholdingAmount), highlight: true },
        { label: "Days until settlement", value: String(daysToSettlement), highlight: true },
      ],
      consequences: [
        `PENDING: WITHHOLDING DEPENDS ON CERTIFICATE ARRIVAL. You are in the critical final phase.`,
        `If certificate arrives before 9 am on settlement day: zero withholding, you receive ${formatAUD(salePrice)} in full. If it arrives after: buyer withholds ${formatAUD(withholdingAmount)}.`,
        "You are now dependent on ATO processing speed. Most applications approved within 4 weeks, but you do not have 4 weeks. You have 2 weeks.",
        `Contact the ATO now and mention your settlement date. Request priority processing or urgent escalation. Provide your application reference. Ask for a specific approval timeline.`,
        "Daily check-ins with the ATO are justified at this point. The certificate can be issued as soon as the ATO approves — the moment it is issued, it must be couriered to the buyer's solicitor for 9 am settlement delivery.",
        "Have a contingency: if the certificate does not arrive by 6 pm the day before settlement, contact the buyer's solicitor and your accountant immediately to discuss next steps (withholding acceptance, settlement delay request, etc.).",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Outcome is genuinely uncertain — depends on ATO processing pace in final weeks.",
      tier: 147,
      ctaLabel: "Get My Daily Tracking Plan — $147 →",
      altTierLabel: "Just decision guidance? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── FALLBACK: AU resident + reasonable timeline ────────────────────────────
  return {
    status: "APPLICATION WINDOW OPEN — APPLY NOW",
    statusClass: "text-amber-700",
    panelClass: "border-amber-200 bg-amber-50",
    headline: `You have over 60 days until settlement and you have not yet applied for your clearance certificate. This gives you a comfortable window — apply now, allow 3–4 weeks for processing, and you will have the certificate well before settlement. No withholding risk if you act now.`,
    stats: [
      { label: "Your sale price", value: formatAUDShort(salePrice) },
      { label: "Withholding at risk", value: formatAUD(withholdingAmount) },
      { label: "Days to settlement", value: String(daysToSettlement) },
    ],
    consequences: [
      `You have ${daysToSettlement} days until settlement and a clear application window. Apply this week to the ATO and there is no withholding risk.`,
      `ATO processing is 1–4 weeks. With ${daysToSettlement} days on the clock, you can safely apply, wait 4 weeks for approval, and still have time to deliver the certificate to the buyer's solicitor before settlement.`,
      `Action: Gather your residency evidence (last 2 tax returns, address proof, employment records, Australian bank statements), complete the ATO form, and submit this week.`,
      `Once approved, your accountant couriers the certificate to the buyer's solicitor. Confirm receipt in writing 1 week before settlement.`,
      "No withholding happens if the certificate is in the buyer's solicitor's office on settlement morning.",
    ],
    confidence: "HIGH",
    confidenceNote: "You have time. Apply now and there is no withholding risk.",
    tier: 67,
    ctaLabel: "Show My Application Timeline — $67 →",
    altTierLabel: "Want the execution plan? — $147",
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
    id: "sale_price", step: 1, type: "button_group",
    label: "What is your approximate property sale price?",
    subLabel: "The withholding is 15% of this amount. Example: $900,000 sale = $135,000 withheld",
    options: [
      { label: "Under $500k", value: "under_500k", subLabel: "$75k withholding at risk" },
      { label: "$500k–$900k", value: "500k_to_900k", subLabel: "$75k–$135k withheld" },
      { label: "$900k–$1.5M", value: "900k_to_1_5m", subLabel: "$135k–$225k withheld" },
      { label: "Over $1.5M", value: "over_1_5m", subLabel: "$225k+ withheld" },
    ],
    required: true,
  },
  {
    id: "residency_status", step: 2, type: "button_group",
    label: "What is your residency status for tax purposes?",
    subLabel: "The clearance certificate requirement is the same, but foreign residents have fewer exemption options",
    options: [
      { label: "Australian resident for tax", value: "au_resident", subLabel: "Eligible for standard certificate" },
      { label: "Foreign resident", value: "foreign_resident", subLabel: "Must apply for variation certificate" },
      { label: "Unsure", value: "unsure", subLabel: "Ask your accountant before settlement" },
    ],
    required: true,
  },
  {
    id: "certificate_status", step: 3, type: "button_group",
    label: "What is your certificate status?",
    subLabel: "Processing takes 1-4 weeks. Settlement date is fixed. This determines your urgency.",
    options: [
      { label: "Have certificate already", value: "have_cert", subLabel: "Zero withholding risk" },
      { label: "Applied (waiting for ATO)", value: "applied_waiting", subLabel: "Now in approval phase" },
      { label: "Not applied yet", value: "not_applied", subLabel: "Application needed urgently" },
    ],
    required: true,
  },
  {
    id: "days_to_settlement", step: 4, type: "button_group",
    label: "Days until your settlement date?",
    subLabel: "Certificate must arrive BEFORE settlement. Less than 28 days means urgent application or extension needed.",
    options: [
      { label: "Less than 14 days", value: "less_14", subLabel: "Critical timeframe" },
      { label: "14–28 days", value: "14_to_28", subLabel: "Urgent but manageable" },
      { label: "28–60 days", value: "28_to_60", subLabel: "Apply this week" },
      { label: "Over 60 days", value: "over_60", subLabel: "Comfortable window" },
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
          <strong className="text-neutral-950">The certificate deadline is settlement morning.</strong> The ATO clearance certificate must be in your buyer's solicitor's office BEFORE 9 am on settlement day. After that, the withholding is automatic and the cash is locked up for 6–18 months.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What's in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your exact withholding exposure at your sale price</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Certificate application urgency assessment</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Days-to-settlement countdown and risk analysis</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Residency evidence checklist for ATO application</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>4 accountant questions written for your situation</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built for your settlement date</p>
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

export default function FrcgwClearanceCertificateCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ sale_context: "", settlement_status: "", accountant_engaged: "" });
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
        product_slug: "frcgw-clearance-certificate",
        source_path: "/au/check/frcgw-clearance-certificate",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          withholding_amount: verdict.result.withholdingAmount,
          residency_status: verdict.result.residencyStatus,
          certificate_status: verdict.result.certificateStatus,
          days_to_settlement: verdict.result.daysToSettlement,
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
      body: JSON.stringify({ email, source: "frcgw_clearance_certificate", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `frcgw_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    // sessionStorage keys MUST match config successPromptFields exactly
    sessionStorage.setItem("frcgw-clearance-certificate_sale_price", String(answers.sale_price || ""));
    sessionStorage.setItem("frcgw-clearance-certificate_withholding_amount", String(Math.round(verdict.result.withholdingAmount)));
    sessionStorage.setItem("frcgw-clearance-certificate_residency_status", String(answers.residency_status || ""));
    sessionStorage.setItem("frcgw-clearance-certificate_certificate_status", String(answers.certificate_status || ""));
    sessionStorage.setItem("frcgw-clearance-certificate_days_to_settlement", String(answers.days_to_settlement || ""));
    sessionStorage.setItem("frcgw-clearance-certificate_certificate_required", String(verdict.result.certificateRequired));
    sessionStorage.setItem("frcgw-clearance-certificate_urgency_level", verdict.result.urgencyLevel);
    sessionStorage.setItem("frcgw-clearance-certificate_tier", String(popupTier));

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
          success_url: `${window.location.origin}/au/check/frcgw-clearance-certificate/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/frcgw-clearance-certificate`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your withholding exposure to show your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your FRCGW settlement decision summary by email — free.</p>
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
                    {popupTier === 67 ? "Your FRCGW Decision Pack" : "Your FRCGW Execution Pack"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">ATO-referenced · TAA 1953 Subdiv 14-D · April 2026</p>
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
                      {popupTier === 67 ? "FRCGW Decision Pack™" : "FRCGW Execution Pack™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your exact withholding exposure, certificate application urgency, days-to-settlement countdown, residency evidence checklist, and 4 accountant questions — built for your sale price and settlement date."
                        : "Full pre-settlement execution plan, certificate application walkthrough, residency evidence checklist, settlement-day buyer instruction template, dispute recovery path if certificate misses deadline, and long-term planning."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic FRCGW guide. A decision for your settlement date.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Withholding Exposure →" : "Get My Execution Plan →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the decision pack? — $67 instead" : "Want the execution plan? — $147 instead"}
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
                    { label: "What is your sale context?", key: "sale_context", options: [["investment","Investment property"],["residential","Residential/family home"],["mixed","Mixed portfolio"]] },
                    { label: "Where are you in the process?", key: "settlement_status", options: [["contracts_signed","Contracts signed, settlement booked"],["pre_contract","Pre-contract, negotiating"],["exploring","Exploring sale options"]] },
                    { label: "Do you have an accountant?", key: "accountant_engaged", options: [["yes_engaged","Yes — accountant engaged"],["yes_not_told","Yes — haven't told them yet"],["no","No — managing myself"]] },
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
      {showVerdict && verdict && verdict.result.withholdingAmount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">At risk if no certificate</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatAUD(verdict.result.withholdingAmount)} withheld
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
