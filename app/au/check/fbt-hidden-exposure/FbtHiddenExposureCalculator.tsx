"use client";

/**
 * AU-03 — FBT Hidden Exposure Engine
 * Pattern: Module E (MultiSelect) + Module C (Classification)
 * Brief: benefit types → recipient → private use → records → EV detail → entertainment → GST
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean | string[]>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;

interface BenefitRisk {
  benefit: string;
  risk: "high" | "medium" | "low" | "exempt";
  note: string;
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
  benefitRisks: BenefitRisk[];
  strongestRisk: string;
  estimatedExposure: string;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FBT CLASSIFICATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const FBT_RATE = 0.47;
const FBT_YEAR = "1 April 2025 – 31 March 2026";
const FBT_DUE  = "21 May 2026";

function classifyBenefits(answers: AnswerMap): BenefitRisk[] {
  const benefits     = answers.benefit_types as string[] || [];
  const privateUse   = answers.private_use;
  const hasLogbook   = answers.has_logbook;
  const isEV         = answers.is_ev;
  const evEligible   = answers.ev_eligible;
  const entertainment = String(answers.entertainment_type || "");
  const recordQuality = String(answers.record_quality || "");

  const risks: BenefitRisk[] = [];

  if (benefits.includes("car")) {
    if (isEV === true && evEligible === true) {
      risks.push({
        benefit: "Electric vehicle",
        risk: "exempt",
        note: "Eligible EV — FBT exempt under the electric vehicle exemption. No FBT payable on this vehicle.",
      });
    } else if (privateUse === false) {
      risks.push({
        benefit: "Car fringe benefit",
        risk: "low",
        note: "Work-only use claimed — no FBT if genuinely no private use. Evidence required.",
      });
    } else if (hasLogbook === false) {
      risks.push({
        benefit: "Car fringe benefit — no logbook",
        risk: "high",
        note: "No logbook means the statutory method applies — 20% of base value regardless of actual business use. This is often the most expensive treatment.",
      });
    } else {
      risks.push({
        benefit: "Car fringe benefit — logbook held",
        risk: "medium",
        note: "Logbook available — operating cost method may significantly reduce liability vs statutory method. Compare both.",
      });
    }
  }

  if (benefits.includes("meals") || benefits.includes("entertainment")) {
    if (entertainment === "staff_event") {
      risks.push({
        benefit: "Staff entertainment",
        risk: "medium",
        note: "Staff-only events under $300 per person per occasion may qualify for the minor benefit exemption. Over $300 — fully taxable at 47% FBT.",
      });
    } else if (entertainment === "client_meals") {
      risks.push({
        benefit: "Client meal entertainment",
        risk: "high",
        note: "Client meals are non-deductible AND may be subject to FBT — worst-case double tax treatment. Neither deductible for income tax nor exempt from FBT in most cases.",
      });
    } else if (entertainment === "travel") {
      risks.push({
        benefit: "Travel entertainment",
        risk: "high",
        note: "Travel as entertainment (e.g. accommodation for leisure, cruises, event tickets) is a common FBT trap — often incorrectly treated as business travel.",
      });
    } else {
      risks.push({
        benefit: "Meal entertainment",
        risk: "medium",
        note: "Meal entertainment requires careful classification — type 1 (GST claimable) vs type 2 treatment changes the gross-up rate and final liability.",
      });
    }
  }

  if (benefits.includes("loan")) {
    risks.push({
      benefit: "Loan fringe benefit",
      risk: "medium",
      note: "Below-market loans to employees or associates are subject to FBT on the interest shortfall. Director loans from a company can create both FBT and Division 7A exposure.",
    });
  }

  if (benefits.includes("expense_reimbursement")) {
    risks.push({
      benefit: "Expense reimbursement",
      risk: recordQuality === "poor" ? "high" : "medium",
      note: recordQuality === "poor"
        ? "Without receipts and declarations, expense reimbursements cannot be substantiated as work-related — FBT applies to the full amount."
        : "Expense reimbursements are exempt if work-related and substantiated. Private-use portion is subject to FBT.",
    });
  }

  if (benefits.includes("property")) {
    risks.push({
      benefit: "Property benefit",
      risk: "medium",
      note: "Goods provided to employees (equipment, products) are subject to FBT unless a minor benefit exemption applies (under $300 per occasion, infrequent).",
    });
  }

  if (benefits.includes("housing")) {
    risks.push({
      benefit: "Housing / accommodation benefit",
      risk: "high",
      note: "Housing fringe benefits are among the highest-value FBT items — taxable on market rent value less employee contribution. Special rules apply for remote area housing.",
    });
  }

  return risks;
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const benefits     = answers.benefit_types as string[] || [];
  const recordQuality = String(answers.record_quality || "");
  const recipient    = String(answers.recipient || "");
  const benefitRisks = classifyBenefits(answers);

  const KEYS = {
    p67:  "au_67_fbt_hidden_exposure",
    p147: "au_147_fbt_hidden_exposure",
  };

  const highRisks   = benefitRisks.filter(r => r.risk === "high");
  const mediumRisks = benefitRisks.filter(r => r.risk === "medium");
  const exemptRisks = benefitRisks.filter(r => r.risk === "exempt");

  // ── No benefits selected ──────────────────────────────────────────────────
  if (benefits.length === 0) {
    return {
      status: "SELECT BENEFITS TO CHECK EXPOSURE",
      statusClass: "text-neutral-600",
      panelClass: "border-neutral-200 bg-neutral-50",
      headline: "Select the benefits you provide to see your FBT exposure by category.",
      stats: [
        { label: "FBT rate", value: "47%" },
        { label: "FBT year", value: "1 Apr – 31 Mar" },
        { label: "Due date", value: FBT_DUE },
      ],
      consequences: [],
      confidence: "LOW",
      confidenceNote: "Select benefit types to calculate exposure.",
      tier: 67,
      ctaLabel: "Get My FBT Exposure Fix Plan — $67 →",
      altTierLabel: "Want the full FBT control system? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      benefitRisks: [], strongestRisk: "", estimatedExposure: "Not yet calculated",
    };
  }

  // ── Determine strongest risk ──────────────────────────────────────────────
  let strongestRisk = "";
  if (highRisks.length > 0) {
    strongestRisk = highRisks[0].note;
  } else if (mediumRisks.length > 0) {
    strongestRisk = mediumRisks[0].note;
  } else if (exemptRisks.length > 0) {
    strongestRisk = "EV exemption applies — confirm eligibility dates and vehicle classification";
  }

  // ── High exposure ─────────────────────────────────────────────────────────
  if (highRisks.length >= 1) {
    const carNoLogbook = benefitRisks.find(r => r.benefit.includes("no logbook"));
    return {
      status: `HIGH FBT EXPOSURE — ${highRisks.length} HIGH-RISK BENEFIT${highRisks.length > 1 ? "S" : ""} DETECTED`,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `${highRisks.length} high-risk FBT ${highRisks.length === 1 ? "category" : "categories"} detected. FBT is charged at 47% — higher than the top individual income tax rate.`,
      stats: [
        { label: "High-risk benefits", value: String(highRisks.length), highlight: true },
        { label: "FBT rate", value: "47% — highest ATO rate", highlight: true },
        { label: "FBT year due", value: FBT_DUE },
      ],
      consequences: [
        "FBT is payable by the employer — employees do not pay it, but the employer pays 47% on the grossed-up value of each benefit",
        carNoLogbook ? "No logbook means the statutory method forces you to pay 47% FBT on 20% of the car's base value — regardless of actual business use" : "",
        recipient === "director" ? "Director benefits from a company create both FBT exposure and potential Division 7A issues — these are often linked" : "",
        `FBT return for ${FBT_YEAR} is due ${FBT_DUE}`,
        recordQuality === "poor" ? "Poor records significantly limit your ability to use the operating cost method or claim exemptions — this is fixable before year-end" : "",
      ].filter(Boolean),
      confidence: recordQuality === "all" ? "HIGH" : recordQuality === "some" ? "MEDIUM" : "LOW",
      confidenceNote: recordQuality === "poor"
        ? "Records are poor — actual liability will depend on what can be substantiated."
        : "Based on benefit mix and record quality.",
      tier: 147,
      ctaLabel: "Get My FBT Control System — $147 →",
      altTierLabel: "Just want the exposure fix plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      benefitRisks, strongestRisk,
      estimatedExposure: carNoLogbook
        ? "Potentially significant — car statutory method applied to full base value at 47%"
        : "High — multiple benefit categories at 47% FBT rate",
    };
  }

  // ── Medium exposure ───────────────────────────────────────────────────────
  if (mediumRisks.length >= 1 && highRisks.length === 0) {
    return {
      status: "MODERATE FBT EXPOSURE — CLASSIFICATION REVIEW REQUIRED",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `${mediumRisks.length} benefit ${mediumRisks.length === 1 ? "category" : "categories"} with moderate FBT exposure — the right valuation method or exemption could significantly reduce your liability.`,
      stats: [
        { label: "Benefits to review", value: String(mediumRisks.length), highlight: true },
        { label: "FBT rate", value: "47%" },
        { label: "FBT year due", value: FBT_DUE },
      ],
      consequences: [
        "Moderate exposure means the right classification or method choice can make a significant difference to your FBT bill",
        "Get the valuation method wrong and you overpay — get it right and you may owe nothing on some benefits",
        `FBT return for ${FBT_YEAR} is due ${FBT_DUE}`,
        recipient === "associate" ? "Benefits provided to associates (family members) of employees count — not just direct employee benefits" : "",
      ].filter(Boolean),
      confidence: "MEDIUM",
      confidenceNote: "Moderate exposure — method choice will determine final liability.",
      tier: 147,
      ctaLabel: "Get My FBT Control System — $147 →",
      altTierLabel: "Just want the exposure fix plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      benefitRisks, strongestRisk,
      estimatedExposure: "Moderate — depends on valuation method and available exemptions",
    };
  }

  // ── Exempt or low ─────────────────────────────────────────────────────────
  return {
    status: exemptRisks.length > 0 ? "LOW EXPOSURE — EV EXEMPTION APPLIES" : "LOW EXPOSURE — BENEFITS APPEAR EXEMPT OR MINIMAL",
    statusClass: "text-emerald-700",
    panelClass: "border-emerald-200 bg-emerald-50",
    headline: exemptRisks.length > 0
      ? "Your electric vehicle qualifies for the FBT exemption — no FBT is payable on this vehicle provided the conditions are met."
      : "Based on your benefit mix and records, your FBT exposure appears low — but confirm with your accountant before lodging.",
    stats: [
      { label: "High-risk benefits", value: "0" },
      { label: "EV exempt", value: exemptRisks.length > 0 ? "Yes ✓" : "N/A" },
      { label: "FBT year due", value: FBT_DUE },
    ],
    consequences: [
      exemptRisks.length > 0
        ? "The EV exemption requires the vehicle to be a zero or low-emission vehicle and first held and used after 1 July 2022 — confirm with your accountant"
        : "Low exposure confirmed for current benefit mix",
      "Minor benefits under $300 per occasion per employee are exempt — confirm each benefit individually",
      "Work-related expenses are exempt if substantiated — ensure declarations and receipts are on file",
      `An FBT return may still be required if reportable fringe benefits exceed $2,000 — confirm with your accountant`,
    ],
    confidence: "MEDIUM",
    confidenceNote: "Low exposure based on benefit mix — confirm EV exemption conditions if applicable.",
    tier: 67,
    ctaLabel: "Get My FBT Exposure Fix Plan — $67 →",
    altTierLabel: "Want the full FBT control system? — $147",
    productKey67: KEYS.p67, productKey147: KEYS.p147,
    benefitRisks, strongestRisk,
    estimatedExposure: "Low — benefits appear exempt or below thresholds",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

type Q = {
  id: string;
  step: number;
  type: "multi_select" | "two_button" | "button_group" | "confidence";
  label: string;
  subLabel?: string;
  options: { label: string; value: string | boolean; subLabel?: string }[];
  showIf?: (a: AnswerMap) => boolean;
  required?: boolean;
};

const QUESTIONS: Q[] = [
  {
    id: "benefit_types", step: 1, type: "multi_select",
    label: "Which benefits did you provide to employees, directors, or their associates?",
    subLabel: "Select all that apply — each routes to the correct valuation method and exemption logic",
    options: [
      { label: "Car", value: "car", subLabel: "Company car or ute with private use" },
      { label: "Meals / entertainment", value: "meals", subLabel: "Staff meals, client meals, events" },
      { label: "Loan", value: "loan", subLabel: "Below-market or interest-free loan" },
      { label: "Expense reimbursement", value: "expense_reimbursement", subLabel: "Personal expenses paid by employer" },
      { label: "Property / goods", value: "property", subLabel: "Products, equipment, or goods provided" },
      { label: "Housing / accommodation", value: "housing", subLabel: "Rent paid or subsidised housing" },
    ],
    required: true,
  },
  {
    id: "recipient", step: 2, type: "button_group",
    label: "Who received the benefit?",
    subLabel: "FBT applies to employees, directors, and their associates — all are in scope",
    options: [
      { label: "Employee", value: "employee" },
      { label: "Director / shareholder", value: "director", subLabel: "Director-only company — both FBT and Div 7A risks" },
      { label: "Associate", value: "associate", subLabel: "Family member of employee or director" },
      { label: "Multiple", value: "multiple" },
    ],
    required: true,
  },
  {
    id: "private_use", step: 3, type: "two_button",
    label: "Was there any private use of the car or benefit?",
    subLabel: "Private use — including home to work travel — triggers FBT. Work-only use is exempt if genuinely no private access.",
    options: [
      { label: "Yes — some or all private use", value: true },
      { label: "No — work use only, genuinely restricted", value: false },
    ],
    showIf: (a) => (a.benefit_types as string[] || []).includes("car"),
    required: true,
  },
  {
    id: "is_ev", step: 4, type: "two_button",
    label: "Is the car an electric or plug-in hybrid vehicle?",
    subLabel: "Eligible EVs held and used after 1 July 2022 may be fully exempt from FBT",
    options: [
      { label: "Yes — electric or plug-in hybrid", value: true },
      { label: "No — petrol or diesel", value: false },
    ],
    showIf: (a) => (a.benefit_types as string[] || []).includes("car") && a.private_use === true,
  },
  {
    id: "ev_eligible", step: 5, type: "two_button",
    label: "Was the EV first held and used after 1 July 2022 and below the luxury car threshold?",
    subLabel: "The EV exemption requires: zero/low emissions, first held after 1 July 2022, and value under the luxury car limit",
    options: [
      { label: "Yes — meets all EV exemption conditions", value: true },
      { label: "No or unsure", value: false },
    ],
    showIf: (a) => (a.benefit_types as string[] || []).includes("car") && a.is_ev === true,
  },
  {
    id: "has_logbook", step: 6, type: "two_button",
    label: "Do you have a valid 12-week logbook for the car?",
    subLabel: "No logbook = statutory method only (20% of base value). Logbook = operating cost method available — often significantly lower.",
    options: [
      { label: "Yes — valid logbook (less than 5 years old)", value: true },
      { label: "No — no logbook or expired", value: false },
    ],
    showIf: (a) => (a.benefit_types as string[] || []).includes("car") && a.private_use === true && a.is_ev !== true,
    required: true,
  },
  {
    id: "entertainment_type", step: 7, type: "button_group",
    label: "What type of meal or entertainment did you provide?",
    subLabel: "The treatment differs significantly — client meals vs staff events vs travel all have different rules",
    options: [
      { label: "Staff-only event or meal", value: "staff_event", subLabel: "Under $300/person may be exempt" },
      { label: "Client meals or entertainment", value: "client_meals", subLabel: "Often non-deductible AND FBT applies — worst case" },
      { label: "Travel entertainment", value: "travel", subLabel: "Accommodation, events, cruises for leisure" },
      { label: "Mixed staff and client", value: "mixed", subLabel: "Need to apportion — complex treatment" },
    ],
    showIf: (a) => (a.benefit_types as string[] || []).includes("meals"),
  },
  {
    id: "record_quality", step: 8, type: "confidence",
    label: "How complete are your records for these benefits?",
    subLabel: "Records determine whether you can use lower-cost valuation methods or claim exemptions",
    options: [
      { label: "Complete records", value: "all", subLabel: "Logbooks, invoices, declarations — all on file" },
      { label: "Partial records", value: "some", subLabel: "Most records but some gaps" },
      { label: "Poor records", value: "poor", subLabel: "Few or no supporting documents" },
    ],
    required: true,
  },
];

const TOTAL_STEPS = 8;

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

      {/* Benefit risk breakdown */}
      {verdict.benefitRisks.length > 0 && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Benefit-by-benefit exposure</p>
          <div className="space-y-2">
            {verdict.benefitRisks.map((r, i) => (
              <div key={i} className={`rounded-xl border px-4 py-3 text-xs ${
                r.risk === "high" ? "border-red-200 bg-red-50"
                : r.risk === "medium" ? "border-amber-200 bg-amber-50"
                : r.risk === "exempt" ? "border-emerald-200 bg-emerald-50"
                : "border-neutral-200 bg-neutral-50"
              }`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-neutral-950">{r.benefit}</span>
                  <span className={`shrink-0 font-mono text-[10px] font-bold uppercase ${
                    r.risk === "high" ? "text-red-700"
                    : r.risk === "medium" ? "text-amber-700"
                    : r.risk === "exempt" ? "text-emerald-700"
                    : "text-neutral-500"
                  }`}>{r.risk === "exempt" ? "EXEMPT" : r.risk.toUpperCase() + " RISK"}</span>
                </div>
                <p className="text-neutral-700 leading-relaxed">{r.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strongest risk */}
      {verdict.strongestRisk && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700 mb-1">Strongest risk trigger</p>
          <p className="text-xs text-amber-900">→ {verdict.strongestRisk}</p>
        </div>
      )}

      {/* Consequences */}
      {verdict.consequences.length > 0 && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <strong className="text-sm text-neutral-950">What this means:</strong>
          <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
            {verdict.consequences.map((c, i) => <li key={i}>→ {c}</li>)}
          </ul>
        </div>
      )}

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
          Most employers don't realise how many benefits trigger FBT — or that the wrong valuation method can cost thousands more than necessary.
          <strong className="text-neutral-950"> This check shows your exact exposure by benefit type.</strong>
        </p>
      </div>

      {/* What you get */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What's in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Benefit-by-benefit classification memo — each benefit with the correct ATO treatment</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Car method comparison — statutory vs operating cost for your situation</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Record gaps list — what you need before 21 May to use the right method</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Available exemptions — minor benefit, EV, work-related expense</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>3 accountant questions written for your exact benefit mix</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your answers above</p>
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

function QuestionBlock({ q, value, onAnswer, onContinue }: {
  q: Q;
  value: AnswerMap[string];
  onAnswer: (id: string, v: string | boolean | string[]) => void;
  onContinue?: () => void;
}) {
  const sel = (v: string | boolean) => value === v || String(value) === String(v);
  const base = "rounded-xl border px-4 py-3 text-left transition";
  const active = "border-neutral-950 bg-neutral-950 text-white";
  const inactive = "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400";

  return (
    <div>
      <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">{q.label}</h2>
      {q.subLabel && <p className="mb-4 text-sm text-neutral-500">{q.subLabel}</p>}

      {q.type === "multi_select" && (
        <div className="space-y-2">
          <p className="mb-2 text-xs text-neutral-500">Select all that apply</p>
          {q.options.map(opt => {
            const selected = Array.isArray(value) && (value as string[]).includes(String(opt.value));
            return (
              <button key={String(opt.value)}
                onClick={() => {
                  const current = Array.isArray(value) ? value as string[] : [];
                  const next = selected ? current.filter(v => v !== String(opt.value)) : [...current, String(opt.value)];
                  onAnswer(q.id, next);
                }}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${selected ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"}`}>
                <span className="mr-2 font-mono">{selected ? "✓" : "○"}</span>
                <span className="font-medium">{opt.label}</span>
                {opt.subLabel && <span className={`ml-2 text-xs ${selected ? "text-neutral-300" : "text-neutral-500"}`}>— {opt.subLabel}</span>}
              </button>
            );
          })}
          {Array.isArray(value) && (value as string[]).length > 0 && (
            <button onClick={() => onContinue?.()}
              className="mt-2 w-full rounded-xl bg-neutral-950 py-3 text-sm font-bold text-white hover:bg-neutral-800 transition">
              Continue with {(value as string[]).length} selected →
            </button>
          )}
        </div>
      )}

      {q.type === "two_button" && (
        <div className="grid grid-cols-2 gap-3">
          {q.options.map(opt => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as boolean)}
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition text-center ${sel(opt.value as boolean) ? active : inactive}`}>
              <span className="block">{opt.label}</span>
              {opt.subLabel && <span className={`mt-0.5 block text-xs ${sel(opt.value as boolean) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>}
            </button>
          ))}
        </div>
      )}

      {(q.type === "button_group" || q.type === "confidence") && (
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

export default function FbtHiddenExposureCalculator() {
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
  const isMultiSelect = visibleQs.some(q => q.type === "multi_select");
  const stepComplete = isMultiSelect
    ? false  // multi-select steps always advance via Continue button only
    : !visibleQs.length || visibleQs.filter(q => q.required !== false).every(q => {
        const v = answers[q.id];
        return v !== undefined && v !== "" && v !== null;
      });

  useEffect(() => {
    if (!stepComplete || isMultiSelect) return;
    const t = setTimeout(() => {
      const next = step + 1;
      if (next <= TOTAL_STEPS) setStep(next);
      else setVerdict(true);
    }, visibleQs.length ? 300 : 0);
    return () => clearTimeout(t);
  }, [stepComplete, step, isMultiSelect, visibleQs.length]);

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
        product_slug: "fbt-hidden-exposure",
        source_path: "/au/check/fbt-hidden-exposure",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: { status: verdict.status, high_risks: verdict.benefitRisks.filter(r => r.risk === "high").length, tier: verdict.tier },
        recommended_tier: verdict.tier,
      }),
    }).then(r => r.json()).then(d => { if (d.id) setSessionId(d.id); }).catch(() => {});
  }, [showVerdict]);

  function advanceStep() {
    const next = step + 1;
    if (next <= TOTAL_STEPS) setStep(next);
    else setVerdict(true);
  }

  function answer(id: string, v: string | boolean | string[]) {
    setAnswers(p => ({ ...p, [id]: v }));
    // Multi-select: only advance via Continue button (onContinue)
    // All other types: advance via stepComplete useEffect
  }

  function back() {
    if (showVerdict) { setVerdict(false); return; }
    if (step > 1) setStep(s => s - 1);
  }

  async function handleSaveEmail() {
    if (!email) return;
    await fetch("/api/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "fbt_hidden_exposure", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `fbt_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("fbt-hidden-exposure_benefit_types", JSON.stringify(answers.benefit_types || []));
    sessionStorage.setItem("fbt-hidden-exposure_high_risks", String(verdict.benefitRisks.filter(r => r.risk === "high").length));
    sessionStorage.setItem("fbt-hidden-exposure_status", verdict.status);
    sessionStorage.setItem("fbt-hidden-exposure_strongest_risk", verdict.strongestRisk);
    sessionStorage.setItem("fbt-hidden-exposure_record_quality", String(answers.record_quality || ""));
    sessionStorage.setItem("fbt-hidden-exposure_tier", String(popupTier));

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
          success_url: `${window.location.origin}/au/check/fbt-hidden-exposure/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/fbt-hidden-exposure`,
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

  const maxStep     = QUESTIONS.reduce((acc, q) => (!q.showIf || q.showIf(answers)) ? Math.max(acc, q.step) : acc, 1);
  const popupComplete = Object.values(popupAnswers).every(v => v !== "");

  return (
    <>
      {/* FBT year banner */}
      <div className="mb-4 flex items-center justify-between rounded-xl bg-neutral-950 px-4 py-2.5">
        <span className="text-sm font-bold text-white">📋 FBT year: {FBT_YEAR}</span>
        <span className="font-mono text-sm font-bold text-neutral-400">Return due: {FBT_DUE}</span>
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
              {visibleQs.map(q => <QuestionBlock key={q.id} q={q} value={answers[q.id]} onAnswer={answer} onContinue={advanceStep} />)}
            </div>
          </div>
        )}

        {showVerdict && verdict && (
          <div ref={verdictRef} className="space-y-4">
            <button onClick={back} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← Change my answers</button>
            <VerdictBlock verdict={verdict} onCheckout={openPopup} loading={loading} />
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your FBT exposure result.</p>
              <p className="mb-2 text-xs text-neutral-500">Email yourself the benefit-by-benefit breakdown — free.</p>
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

      {showPopup && verdict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl my-auto">
            <div className="rounded-t-2xl bg-neutral-950 px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass.replace("700","400")}`}>FBT Hidden Exposure</p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">{verdict.estimatedExposure}</p>
                  <p className="mt-1 text-sm text-neutral-300">ATO-referenced · {FBT_YEAR}</p>
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
                      {popupTier === 67 ? "Your FBT Exposure Fix Plan™" : "Your FBT Control System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Benefit-by-benefit classification memo, car method comparison, record gaps list, available exemptions, and accountant questions — built around your exact benefit mix."
                        : "Full annual FBT workflow, car method recommendation, entertainment policy settings, evidence templates, and remediation plan to reduce future 47% leakages."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic FBT guide. Built around your benefit mix.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Get My FBT Exposure Plan →" : "Get My FBT Control System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the exposure fix plan? — $67 instead" : "Want the full FBT control system? — $147 instead"}
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
                    { label: "Business structure", key: "entity_type", options: [["sole_trader","Sole trader"],["company","Company / Pty Ltd"],["trust","Trust"],["partnership","Partnership"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["before_due","Before 21 May FBT return due"],["review","Annual review — not urgent"],["prior_year","Prior year — already lodged"]] },
                    { label: "Do you have an accountant?", key: "accountant", options: [["yes_active","Yes — speaking with them soon"],["yes_inactive","Yes — not spoken recently"],["no","No — managing myself"]] },
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

      {showVerdict && verdict && verdict.benefitRisks.filter(r => r.risk === "high").length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">FBT exposure</p>
              <p className="text-sm font-bold text-neutral-950 truncate">High-risk benefits detected — get your plan</p>
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
