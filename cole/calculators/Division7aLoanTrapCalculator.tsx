"use client";

/**
 * AU-02 — Division 7A Loan Trap Engine
 * Pattern: Module D (GateTest) — lodgement day is the critical dividing line
 * Brief: relationship → transaction type → written agreement → repayments → timing → security
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;

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
  strongestRisk: string;
  exposureNote: string;
  isDemedDividend: boolean;
}

interface PopupAnswers {
  loan_amount: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const relationship    = String(answers.relationship || "");
  const transactionType = String(answers.transaction_type || "");
  const hasAgreement    = answers.has_agreement;
  const repaymentsMade  = String(answers.repayments_made || "");
  const useOfFunds      = String(answers.use_of_funds || "");
  const incomeYear      = String(answers.income_year || "");
  const isSecured       = answers.is_secured;
  const lodgementPassed = answers.lodgement_passed;

  const KEYS = {
    p67:  "au_67_division_7a_loan_trap",
    p147: "au_147_division_7a_loan_trap",
  };

  // ── Not caught by Div 7A ──────────────────────────────────────────────────
  if (relationship === "none") {
    return {
      status: "NOT CAUGHT BY DIVISION 7A",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: "Division 7A only applies to payments or loans from private companies to shareholders or their associates. Your situation does not appear to trigger it.",
      stats: [
        { label: "Division 7A risk", value: "Not applicable" },
        { label: "Relationship test", value: "Not met" },
        { label: "Deemed dividend risk", value: "$0" },
      ],
      consequences: [
        "No private company relationship detected — Division 7A does not apply",
        "If you do have a private company and draw funds from it, the position changes significantly",
      ],
      confidence: "HIGH",
      confidenceNote: "No private company relationship — Division 7A not triggered.",
      tier: 67,
      ctaLabel: "Get My Director Loan Position Confirmed — $67 →",
      altTierLabel: "Want the full loan shield system? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      strongestRisk: "None detected",
      exposureNote: "No exposure",
      isDemedDividend: false,
    };
  }

  // ── Debt forgiveness — immediate deemed dividend ───────────────────────────
  if (transactionType === "debt_forgiveness") {
    return {
      status: "DEEMED DIVIDEND — DEBT FORGIVENESS IS IMMEDIATE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "Debt forgiveness by a private company to a shareholder or associate is automatically treated as an unfranked deemed dividend — it cannot be structured away after the fact.",
      stats: [
        { label: "Transaction type", value: "Debt forgiveness ✗", highlight: true },
        { label: "Tax treatment", value: "Unfranked dividend", highlight: true },
        { label: "Tax credits", value: "None — full rate applies", highlight: true },
      ],
      consequences: [
        "When a private company forgives a debt owed by a shareholder or associate, the full amount is a deemed dividend in the year of forgiveness",
        "An unfranked deemed dividend is taxed as personal income at your full marginal rate — with no franking credits to offset the tax",
        "This is one of the harshest Division 7A outcomes — there is no complying loan path available after forgiveness",
        "The dividend is limited by the company's distributable surplus — confirm this with your accountant",
      ],
      confidence: "HIGH",
      confidenceNote: "Debt forgiveness is an absolute Division 7A trigger — no exceptions.",
      tier: 147,
      ctaLabel: "Get My Director Loan Shield System — $147 →",
      altTierLabel: "Just want the rescue plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      strongestRisk: "Debt forgiveness — immediate unfranked deemed dividend, no remediation path",
      exposureNote: "Full forgiven amount treated as unfranked dividend taxed at marginal rate",
      isDemedDividend: true,
    };
  }

  // ── Lodgement day already passed — no agreement ───────────────────────────
  if (lodgementPassed === true && hasAgreement === false) {
    return {
      status: "DEEMED DIVIDEND — LODGEMENT DAY HAS PASSED",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "The company's tax return lodgement day has passed without a complying loan agreement — the loan is now a deemed unfranked dividend. It cannot be fixed retroactively.",
      stats: [
        { label: "Lodgement day", value: "Passed ✗", highlight: true },
        { label: "Loan agreement", value: "Not in place ✗", highlight: true },
        { label: "Tax treatment", value: "Unfranked dividend", highlight: true },
      ],
      consequences: [
        "Division 7A does not care about June 30 — it cares about lodgement day. If a complying loan agreement was not in place before the company's tax return was lodged, the loan becomes a deemed dividend on that date.",
        "A deemed dividend is unfranked — meaning it is added to your personal income with no franking credits. A $50,000 loan becomes a $50,000 taxable dividend — with a tax bill of up to $23,500 at the top rate.",
        "This is not a repayment problem — it is the entire outstanding loan balance that is taxed, not just the amount overdue.",
        "The distributable surplus of the company may limit the deemed dividend — but this rarely reduces the exposure significantly.",
        "Speak to your accountant urgently about the amended assessment exposure and voluntary disclosure options.",
      ],
      confidence: "HIGH",
      confidenceNote: "Lodgement day passed without agreement — deemed dividend has already occurred.",
      tier: 147,
      ctaLabel: "Get My Director Loan Shield System — $147 →",
      altTierLabel: "Just want the rescue plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      strongestRisk: "Lodgement day passed — entire loan balance is now a deemed unfranked dividend",
      exposureNote: "Full loan balance treated as unfranked dividend — tax up to 47% of the outstanding amount",
      isDemedDividend: true,
    };
  }

  // ── No agreement — approaching lodgement day ──────────────────────────────
  if (hasAgreement === false && lodgementPassed !== true) {
    return {
      status: "HIGH RISK — NO COMPLYING LOAN AGREEMENT IN PLACE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "Without a written complying loan agreement in place before lodgement day, this loan will become a deemed unfranked dividend — taxed in full at your personal rate.",
      stats: [
        { label: "Loan agreement", value: "Not in place ✗", highlight: true },
        { label: "Lodgement day deadline", value: "Critical — act now", highlight: true },
        { label: "Risk if missed", value: "Unfranked deemed dividend", highlight: true },
      ],
      consequences: [
        "Division 7A's key deadline is not June 30 — it is the company's tax return lodgement day",
        "A complying loan agreement must be signed before lodgement day — backdating is not permitted",
        "If the deadline is missed, the entire loan balance becomes an unfranked deemed dividend in that income year",
        "An unfranked dividend carries no franking credits — you pay tax at your full marginal rate with no offset",
        useOfFunds === "private" ? "Private spending funded by the company loan increases the urgency — the ATO specifically targets director loans used for personal expenses" : "",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "No agreement — must act before lodgement day to prevent deemed dividend.",
      tier: 147,
      ctaLabel: "Get My Director Loan Shield System — $147 →",
      altTierLabel: "Just want the rescue plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      strongestRisk: "No complying loan agreement — loan becomes deemed dividend on lodgement day",
      exposureNote: "Full loan balance at risk — unfranked dividend at marginal rate if deadline missed",
      isDemedDividend: false,
    };
  }

  // ── Agreement in place but repayments missed ──────────────────────────────
  if (hasAgreement === true && repaymentsMade === "no") {
    return {
      status: "MINIMUM REPAYMENT MISSED — DEEMED DIVIDEND RISK",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "A complying loan agreement is in place, but minimum yearly repayments have not been made — the shortfall amount becomes a deemed unfranked dividend.",
      stats: [
        { label: "Loan agreement", value: "In place ✓" },
        { label: "Minimum repayment", value: "Missed ✗", highlight: true },
        { label: "Exposure", value: "Shortfall = deemed dividend", highlight: true },
      ],
      consequences: [
        "A complying loan agreement does not eliminate Division 7A risk — minimum yearly repayments must also be made by 30 June each year",
        "If a minimum repayment is missed, the shortfall — not the full balance — becomes a deemed dividend in that income year",
        "Unlike the full lodgement-day trigger, this is fixable before 30 June by making the required repayment",
        isSecured === false ? "Unsecured loans have a shorter maximum term (7 years) and higher minimum repayment rates — confirm your loan terms are compliant" : "",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "Agreement exists but repayment missed — shortfall is the deemed dividend amount.",
      tier: 147,
      ctaLabel: "Get My Director Loan Shield System — $147 →",
      altTierLabel: "Just want the rescue plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      strongestRisk: "Minimum repayment missed — shortfall is a deemed unfranked dividend for this year",
      exposureNote: "Repayment shortfall treated as unfranked dividend — make payment before 30 June to remediate",
      isDemedDividend: false,
    };
  }

  // ── Agreement in place, repayments unsure ────────────────────────────────
  if (hasAgreement === true && repaymentsMade === "unsure") {
    return {
      status: "COMPLIANCE UNCERTAIN — REPAYMENT POSITION NEEDS VERIFICATION",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: "A complying loan agreement is in place, but the minimum repayment position is uncertain — confirm with your accountant before 30 June.",
      stats: [
        { label: "Loan agreement", value: "In place ✓" },
        { label: "Repayment status", value: "Uncertain ⚠", highlight: true },
        { label: "Action needed", value: "Verify before 30 June" },
      ],
      consequences: [
        "The minimum yearly repayment must be calculated using the ATO benchmark interest rate and the loan's remaining term",
        "If the repayment is insufficient, the shortfall becomes a deemed dividend — even unintentionally",
        "Request your accountant to confirm the minimum repayment calculation and confirm it has been satisfied",
        isSecured === false ? "Unsecured loans have shorter terms and higher required repayments — confirm the loan is still within its maximum 7-year term" : "",
      ].filter(Boolean),
      confidence: "MEDIUM",
      confidenceNote: "Uncertain repayment position — confirm before 30 June.",
      tier: 67,
      ctaLabel: "Get My Division 7A Rescue Plan — $67 →",
      altTierLabel: "Want the full loan shield system? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      strongestRisk: "Repayment position uncertain — unconfirmed shortfall may trigger deemed dividend",
      exposureNote: "Potential shortfall — confirm repayment calculation with accountant before 30 June",
      isDemedDividend: false,
    };
  }

  // ── Compliant — agreement and repayments in place ─────────────────────────
  if (hasAgreement === true && repaymentsMade === "yes") {
    return {
      status: "COMPLIANT — AGREEMENT AND REPAYMENTS IN PLACE",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: "A complying loan agreement is in place and minimum yearly repayments have been made — this loan is currently compliant with Division 7A.",
      stats: [
        { label: "Loan agreement", value: "In place ✓" },
        { label: "Minimum repayment", value: "Made ✓" },
        { label: "Deemed dividend risk", value: "Low — if compliant" },
      ],
      consequences: [
        "Current year compliance is confirmed — Division 7A does not apply for this period",
        "The loan must continue to meet minimum repayment requirements each year until fully repaid",
        isSecured === false ? "Unsecured loans must be repaid within 7 years — confirm the loan is within its maximum term" : "Secured loans have a maximum 25-year term — confirm the security is still valid and registered",
        "Keep the loan agreement and repayment records — the ATO can audit up to 4 years back",
        incomeYear === "prior_years" ? "Prior year compliance should also be confirmed — if any year had a missed repayment, that year's shortfall may still be assessable" : "",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "Agreement and repayments confirmed — current year is compliant.",
      tier: 67,
      ctaLabel: "Get My Division 7A Compliance Confirmation — $67 →",
      altTierLabel: "Want full restructuring and multi-year shield? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      strongestRisk: incomeYear === "prior_years"
        ? "Prior year compliance not confirmed — earlier years may have missed repayments"
        : "None detected — maintain agreement and repayments",
      exposureNote: "Compliant for current year — confirm prior years and maintain repayments",
      isDemedDividend: false,
    };
  }

  // ── Trust / UPE interaction ───────────────────────────────────────────────
  if (transactionType === "trust_upe") {
    return {
      status: "TRUST UPE — COMPLEX DIVISION 7A INTERACTION",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: "Unpaid present entitlements from a trust to a private company are a complex Division 7A interaction — the ATO has specific rules that changed significantly from 1 July 2022.",
      stats: [
        { label: "Transaction type", value: "Trust UPE", highlight: true },
        { label: "ATO focus area", value: "Active compliance target" },
        { label: "Professional advice", value: "Required ✗", highlight: true },
      ],
      consequences: [
        "From 1 July 2022, unpaid present entitlements owed to a corporate beneficiary are subject to new Division 7A rules",
        "The UPE may need to be placed under a complying sub-trust arrangement or a loan agreement with the private company",
        "This is one of the ATO's active compliance focus areas — trust UPE arrangements are being audited at a high rate",
        "The interaction between trust law and Division 7A is complex — professional advice is not optional here",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Trust UPE interactions require professional analysis — position depends on specific arrangement.",
      tier: 147,
      ctaLabel: "Get My Director Loan Shield System — $147 →",
      altTierLabel: "Just want the rescue plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      strongestRisk: "Trust UPE — complex Division 7A interaction, active ATO compliance focus area",
      exposureNote: "Depends on trust and company arrangement — professional analysis required",
      isDemedDividend: false,
    };
  }

  // ── Default fallback ──────────────────────────────────────────────────────
  return {
    status: "DIVISION 7A EXPOSURE — POSITION REQUIRES REVIEW",
    statusClass: "text-amber-700",
    panelClass: "border-amber-200 bg-amber-50",
    headline: "Your answers indicate a potential Division 7A exposure — the exact risk depends on the specific loan structure and timing.",
    stats: [
      { label: "Division 7A risk", value: "Possible ⚠", highlight: true },
      { label: "Lodgement day", value: "Key deadline", highlight: true },
      { label: "Professional advice", value: "Recommended" },
    ],
    consequences: [
      "Division 7A can convert a loan or payment from a private company into an unfranked deemed dividend — taxed at your full marginal rate",
      "The key deadline is lodgement day — not June 30",
      "A complying loan agreement must be in place before the company's tax return is lodged",
      "Get professional advice before the next lodgement day to confirm your position",
    ],
    confidence: "LOW",
    confidenceNote: "Insufficient information to determine exact position — professional review recommended.",
    tier: 147,
    ctaLabel: "Get My Director Loan Shield System — $147 →",
    altTierLabel: "Just want the rescue plan? — $67 instead",
    productKey67: KEYS.p67, productKey147: KEYS.p147,
    strongestRisk: "Division 7A exposure — position requires professional review before lodgement day",
    exposureNote: "Potential deemed dividend exposure — amount depends on loan balance and structure",
    isDemedDividend: false,
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
    id: "relationship", step: 1, type: "button_group",
    label: "What is your relationship to the private company?",
    subLabel: "Division 7A only applies to shareholders, their associates, and related trusts — not arm's-length parties",
    options: [
      { label: "Shareholder or director", value: "shareholder", subLabel: "You own shares or are a director of the company" },
      { label: "Associate of shareholder", value: "associate", subLabel: "Family member, related trust, or connected entity" },
      { label: "Trust with corporate beneficiary", value: "trust", subLabel: "Trust owes money to a private company" },
      { label: "None of the above", value: "none", subLabel: "Arm's length party — Division 7A likely not applicable" },
    ],
    required: true,
  },
  {
    id: "transaction_type", step: 2, type: "button_group",
    label: "What did you actually receive from the company?",
    subLabel: "Different transaction types trigger different Division 7A treatments — each has its own rules and fix options",
    options: [
      { label: "Cash withdrawal or loan", value: "loan", subLabel: "Money taken from the company account" },
      { label: "Private expense paid by company", value: "private_expense", subLabel: "Personal bills, travel, or purchases paid by company" },
      { label: "Use of company asset", value: "asset_use", subLabel: "Using company car, property, or equipment privately" },
      { label: "Debt forgiveness", value: "debt_forgiveness", subLabel: "Company wrote off a debt you owed — immediate deemed dividend" },
      { label: "Trust unpaid entitlement", value: "trust_upe", subLabel: "Trust owes a UPE to a private company beneficiary" },
    ],
    showIf: (a) => a.relationship !== "none",
    required: true,
  },
  {
    id: "lodgement_passed", step: 3, type: "two_button",
    label: "Has the company's tax return lodgement day already passed for the year the loan arose?",
    subLabel: "Division 7A's deadline is lodgement day — NOT 30 June. If lodgement day has passed without a complying agreement, the deemed dividend has already occurred.",
    options: [
      { label: "No — lodgement day has not yet passed", value: false },
      { label: "Yes — company return has already been lodged", value: true },
    ],
    showIf: (a) => a.relationship !== "none" && a.transaction_type !== "debt_forgiveness" && a.transaction_type !== "trust_upe",
    required: true,
  },
  {
    id: "has_agreement", step: 4, type: "two_button",
    label: "Is there a written complying Division 7A loan agreement in place?",
    subLabel: "Must be signed before lodgement day — verbal agreements and informal arrangements do not comply",
    options: [
      { label: "Yes — signed complying loan agreement exists", value: true },
      { label: "No — no written agreement in place", value: false },
    ],
    showIf: (a) => a.relationship !== "none" && a.transaction_type !== "debt_forgiveness" && a.transaction_type !== "trust_upe",
    required: true,
  },
  {
    id: "repayments_made", step: 5, type: "button_group",
    label: "Have minimum yearly repayments been made on the loan?",
    subLabel: "Even with a complying agreement, minimum yearly repayments must be made by 30 June — a missed repayment is a deemed dividend for that year's shortfall",
    options: [
      { label: "Yes — minimum repayments made each year", value: "yes" },
      { label: "No — repayments have been missed", value: "no", subLabel: "Shortfall is a deemed dividend" },
      { label: "Unsure — need to check", value: "unsure" },
    ],
    showIf: (a) => a.has_agreement === true,
    required: true,
  },
  {
    id: "is_secured", step: 6, type: "two_button",
    label: "Is the loan secured over property or another asset?",
    subLabel: "Secured loans have a 25-year maximum term. Unsecured loans have a 7-year maximum term with higher required repayments.",
    options: [
      { label: "Yes — secured over property or asset", value: true },
      { label: "No — unsecured loan", value: false },
    ],
    showIf: (a) => a.has_agreement === true,
  },
  {
    id: "use_of_funds", step: 7, type: "button_group",
    label: "How were the funds used?",
    subLabel: "The use of funds does not change whether Division 7A applies — but it affects the remediation options and risk flags",
    options: [
      { label: "Private spending", value: "private", subLabel: "Personal expenses, living costs, holidays" },
      { label: "Investment", value: "investment", subLabel: "Shares, property, or other investments" },
      { label: "Business use", value: "business", subLabel: "Used in a business — still caught by Division 7A" },
      { label: "Repaid another loan", value: "loan_repayment" },
    ],
    showIf: (a) => a.relationship !== "none" && a.transaction_type !== "debt_forgiveness",
  },
  {
    id: "income_year", step: 8, type: "button_group",
    label: "When did the loan or payment arise?",
    subLabel: "Needed for lodgement day and remediation sequencing",
    options: [
      { label: "This financial year (2024-25)", value: "current_year", subLabel: "Lodgement day still approaching" },
      { label: "Last financial year (2023-24)", value: "last_year", subLabel: "Lodgement day likely passed" },
      { label: "Prior years", value: "prior_years", subLabel: "Multiple years — compounding exposure" },
    ],
    showIf: (a) => a.relationship !== "none",
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

      {/* Deemed dividend callout */}
      {verdict.isDemedDividend && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1">Unfranked deemed dividend</p>
          <p className="text-xs text-red-900">
            → This amount is now treated as personal income with no franking credits. A $50,000 loan becomes a $50,000 taxable dividend — with a tax bill of up to $23,500 at the top rate. There are no credits to offset this tax.
          </p>
        </div>
      )}

      {/* Strongest risk */}
      {verdict.strongestRisk && !verdict.strongestRisk.startsWith("None") && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700 mb-1">Strongest risk trigger</p>
          <p className="text-xs text-amber-900">→ {verdict.strongestRisk}</p>
        </div>
      )}

      {/* Consequences */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <strong className="text-sm text-neutral-950">What this means:</strong>
        <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
          {verdict.consequences.map((c, i) => <li key={i}>→ {c}</li>)}
        </ul>
      </div>

      {/* Exposure note */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Exposure summary</p>
        <p className="text-sm font-semibold text-neutral-950">{verdict.exposureNote}</p>
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
          This is one of the few tax rules where a simple mistake can turn into a full taxable income event — even if you never intended to take a dividend.
          <strong className="text-neutral-950"> This check shows your exact Division 7A position.</strong>
        </p>
      </div>

      {/* What you get */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What's in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Loan classification memo — your Division 7A position with the specific ATO rule applied</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Minimum repayment calculation — exact repayment required to maintain compliance</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Lodgement day checklist — what must be in place before the company return is lodged</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Evidence pack — documents to collect for your accountant</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>3 accountant questions written for your specific Division 7A situation</span></li>
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

export default function Division7aLoanTrapCalculator() {
  const [answers, setAnswers]     = useState<AnswerMap>({});
  const [step, setStep]           = useState(1);
  const [showVerdict, setVerdict] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showQuestions, setShowQ] = useState(false);
  const [popupTier, setPopupTier] = useState<Tier>(147);
  const [popupAnswers, setPopupA] = useState<PopupAnswers>({ loan_amount: "", urgency: "", accountant: "" });
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
        product_slug: "division-7a-loan-trap",
        source_path: "/au/check/division-7a-loan-trap",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: { status: verdict.status, is_deemed_dividend: verdict.isDemedDividend, tier: verdict.tier },
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
      body: JSON.stringify({ email, source: "division_7a_loan_trap", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `div7a_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("division-7a-loan-trap_transaction_type", String(answers.transaction_type || ""));
    sessionStorage.setItem("division-7a-loan-trap_has_agreement", String(answers.has_agreement || ""));
    sessionStorage.setItem("division-7a-loan-trap_is_deemed_dividend", String(verdict.isDemedDividend));
    sessionStorage.setItem("division-7a-loan-trap_status", verdict.status);
    sessionStorage.setItem("division-7a-loan-trap_strongest_risk", verdict.strongestRisk);
    sessionStorage.setItem("division-7a-loan-trap_income_year", String(answers.income_year || ""));
    sessionStorage.setItem("division-7a-loan-trap_tier", String(popupTier));

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
          success_url: `${window.location.origin}/au/check/division-7a-loan-trap/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/division-7a-loan-trap`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your Division 7A position.</p>
              <p className="mb-2 text-xs text-neutral-500">Email yourself the loan compliance summary — free.</p>
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
                  <p className={`font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass.replace("700","400")}`}>Division 7A</p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">
                    {verdict.isDemedDividend ? "Deemed dividend — act urgently" : "Director loan position"}
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
                      {popupTier === 67 ? "Your Division 7A Rescue Plan™" : "Your Director Loan Shield System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Loan classification memo, minimum repayment calculation, lodgement day checklist, evidence pack, and accountant questions — built around your specific loan situation."
                        : "Full restructuring blueprint — complying loan setup, repayment schedule, UPE/trust interaction notes, private-use remediation plan, and an implementation worksheet your accountant can adopt directly."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic Division 7A guide. Built around your loan structure.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Get My Rescue Plan →" : "Get My Loan Shield System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the rescue plan? — $67 instead" : "Want the full loan shield system? — $147 instead"}
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
                    { label: "Approximate loan balance", key: "loan_amount", options: [["under_25k","Under $25,000"],["25k_100k","$25,000–$100,000"],["100k_500k","$100,000–$500,000"],["over_500k","Over $500,000"]] },
                    { label: "Where are you in the process?", key: "urgency", options: [["pre_lodgement","Before company return lodged"],["post_lodgement","After company return lodged"],["audit","Under ATO review"]] },
                    { label: "Do you have an accountant?", key: "accountant", options: [["yes_active","Yes — speaking with them soon"],["yes_inactive","Yes — not recently"],["no","No — managing myself"]] },
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

      {showVerdict && verdict && verdict.isDemedDividend && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-red-200 bg-red-50 px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-red-700">Deemed dividend detected</p>
              <p className="text-sm font-bold text-red-900">Act before next lodgement day</p>
            </div>
            <button onClick={() => openPopup(verdict.tier)}
              className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white whitespace-nowrap">
              Get Help →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
