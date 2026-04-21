"use client";

/**
 * AU-09 — Rental Property Deduction Audit Calculator
 * Pattern: Module E (MultiSelect) + Module C (Classification) + Module H (Confidence)
 * Brief: expense type mix → timing → scale → availability → private use → records → borrowing
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean | string[]>;
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
  riskFlags: string[];
  missedOpportunities: string[];
}

interface PopupAnswers {
  situation: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASSIFICATION LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const expenseTypes  = answers.expense_types as string[] || [];
  const damageExisted = answers.damage_existed;
  const scaleOfWork   = String(answers.scale_of_work || "");
  const available     = answers.available_for_rent;
  const privateUse    = answers.private_use;
  const recordQuality = String(answers.record_quality || "");
  const hasBorrowing  = answers.has_borrowing;

  const KEYS = {
    p67:  "au_67_rental_property_deduction_audit",
    p147: "au_147_rental_property_deduction_audit",
  };

  // ── Risk flags ────────────────────────────────────────────────────────────
  const riskFlags: string[] = [];
  const missedOpportunities: string[] = [];

  // Initial repair flag — biggest ATO audit trigger
  if (damageExisted === true) {
    riskFlags.push("Initial repair risk — defects existing at purchase are capital, not deductible as repairs");
  }

  // Improvement classified as repair
  if (scaleOfWork === "improvement") {
    riskFlags.push("Improvement misclassified as repair — improvements are capital works (Div 43), not immediately deductible");
  }

  // Full replacement
  if (scaleOfWork === "full_replacement") {
    riskFlags.push("Full asset replacement — likely a depreciating asset (Div 40), not a repair — different deduction rules apply");
  }

  // Not genuinely available
  if (available === false) {
    riskFlags.push("Property not genuinely available for rent — ATO may deny deductions for periods when property was not on the market");
  }

  // Private use
  if (privateUse === true) {
    riskFlags.push("Private use during the year — deductions must be apportioned — full claim is an audit risk");
  }

  // Poor records
  if (recordQuality === "poor") {
    riskFlags.push("Insufficient records — without invoices, photos, and dates the ATO can disallow claims at audit");
  }

  // Missed opportunities
  if (hasBorrowing === true && !expenseTypes.includes("borrowing")) {
    missedOpportunities.push("Borrowing costs — loan establishment fees are deductible over 5 years or the loan term");
  }
  if (expenseTypes.includes("renovations") && !expenseTypes.includes("capital_works")) {
    missedOpportunities.push("Capital works (Div 43) — renovations may qualify for 2.5% annual deduction over 40 years");
  }
  if (!expenseTypes.includes("depreciation")) {
    missedOpportunities.push("Depreciation schedule — assets in the property may be depreciable under Div 40 — QS report recommended");
  }

  // Post-2017 depreciation flag — massive compliance gap
  if (expenseTypes.includes("depreciation")) {
    riskFlags.push("Post-9-May-2017 rule — second-hand assets in residential investment properties cannot be depreciated under Div 40. Only NEW assets installed after purchase qualify. Existing carpet, curtains, and appliances are excluded.");
  }

  // ── Confidence ───────────────────────────────────────────────────────────
  let confidence: ConfidenceLevel = "HIGH";
  let confidenceNote = "Records appear complete — position is reliable for your accountant.";
  if (recordQuality === "some") {
    confidence = "MEDIUM";
    confidenceNote = "Some records missing — your accountant will need the gaps filled before lodging.";
  }
  if (recordQuality === "poor") {
    confidence = "LOW";
    confidenceNote = "Records are insufficient — claims may be disallowed at ATO audit without invoices, photos, and dates.";
  }

  // ── Classification summary ────────────────────────────────────────────────
  const expenseCount = expenseTypes.length;
  const hasHighRisk  = riskFlags.length > 0;
  const hasMissed    = missedOpportunities.length > 0;

  // ── Verdict paths ─────────────────────────────────────────────────────────

  // No expenses selected
  if (expenseCount === 0) {
    return {
      status: "NO EXPENSES SELECTED",
      statusClass: "text-neutral-600",
      panelClass: "border-neutral-200 bg-neutral-50",
      headline: "Select the expenses you incurred to see your classification and risk position.",
      stats: [
        { label: "Expenses reviewed", value: "0" },
        { label: "Risk flags", value: "0" },
        { label: "Missed deductions", value: "0" },
      ],
      consequences: [],
      confidence, confidenceNote,
      tier: 67,
      ctaLabel: "Get My Rental Deduction Repair Pack — $67 →",
      altTierLabel: "Want the full ATO audit-ready system? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      riskFlags: [], missedOpportunities: [],
    };
  }

  // HIGH RISK — overclaiming detected
  if (hasHighRisk && riskFlags.length >= 2) {
    return {
      status: "HIGH OVERCLAIM RISK — ATO AUDIT EXPOSURE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `${riskFlags.length} classification issues detected. Your current deduction claims may not survive an ATO audit.`,
      stats: [
        { label: "Risk flags", value: String(riskFlags.length), highlight: true },
        { label: "Missed opportunities", value: String(missedOpportunities.length) },
        { label: "Record quality", value: recordQuality === "all" ? "Good" : recordQuality === "some" ? "Partial" : "Poor", highlight: recordQuality === "poor" },
      ],
      consequences: [
        "The ATO has identified rental deductions as a priority audit area — incorrect claims attract penalties",
        riskFlags[0],
        riskFlags.length > 1 ? riskFlags[1] : "",
        hasMissed ? `You may also be missing ${missedOpportunities.length} legitimate deduction${missedOpportunities.length > 1 ? "s" : ""}` : "",
      ].filter(Boolean),
      confidence, confidenceNote,
      tier: 147,
      ctaLabel: "Get My ATO Audit-Ready Rental System — $147 →",
      altTierLabel: "Just want the classification memo? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      riskFlags, missedOpportunities,
    };
  }

  // MODERATE RISK — one flag or missed deductions
  if (hasHighRisk || hasMissed) {
    return {
      status: "CLASSIFICATION ISSUES DETECTED",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `${riskFlags.length > 0 ? `${riskFlags.length} classification risk${riskFlags.length > 1 ? "s" : ""} detected` : ""}${hasMissed ? `${riskFlags.length > 0 ? " and " : ""}${missedOpportunities.length} missed deduction${missedOpportunities.length > 1 ? "s" : ""} identified` : ""}.`,
      stats: [
        { label: "Risk flags", value: String(riskFlags.length), highlight: riskFlags.length > 0 },
        { label: "Missed deductions", value: String(missedOpportunities.length), highlight: missedOpportunities.length > 0 },
        { label: "Expenses reviewed", value: String(expenseCount) },
      ],
      consequences: [
        ...riskFlags.slice(0, 2),
        ...missedOpportunities.slice(0, 1),
      ].filter(Boolean),
      confidence, confidenceNote,
      tier: 147,
      ctaLabel: "Get My ATO Audit-Ready Rental System — $147 →",
      altTierLabel: "Just want the classification memo? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      riskFlags, missedOpportunities,
    };
  }

  // CLEAN — no flags, no missed
  return {
    status: "DEDUCTIONS APPEAR CORRECTLY CLASSIFIED",
    statusClass: "text-emerald-700",
    panelClass: "border-emerald-200 bg-emerald-50",
    headline: `Your ${expenseCount} expense type${expenseCount > 1 ? "s" : ""} appear correctly classified with no obvious overclaim or audit risk detected.`,
    stats: [
      { label: "Expenses reviewed", value: String(expenseCount) },
      { label: "Risk flags", value: "0" },
      { label: "Record quality", value: recordQuality === "all" ? "Good" : "Partial" },
    ],
    consequences: [
      "Correct classification is confirmed — keep your invoices, photos, and dates on file",
      "The ATO can audit up to 5 years back — records must be retained for that period",
      "Consider a QS report if you have not claimed depreciation — it often uncovers additional deductions",
    ],
    confidence, confidenceNote,
    tier: 67,
    ctaLabel: "Get My Rental Deduction Repair Pack — $67 →",
    altTierLabel: "Want the full ATO audit-ready system? — $147",
    productKey67: KEYS.p67, productKey147: KEYS.p147,
    riskFlags: [], missedOpportunities,
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
  // Step 1: Expense types — multi-select
  {
    id: "expense_types", step: 1, type: "multi_select",
    label: "Which expenses did you incur on your rental property?",
    subLabel: "Select all that apply — each routes to the correct deduction class",
    options: [
      { label: "Repairs", value: "repairs", subLabel: "Like-for-like fix of existing damage" },
      { label: "Replacements", value: "replacements", subLabel: "Replaced an item with equivalent" },
      { label: "Renovations / improvements", value: "renovations", subLabel: "Upgraded or added something new" },
      { label: "Capital works", value: "capital_works", subLabel: "Structural work — Div 43 claim" },
      { label: "Depreciation", value: "depreciation", subLabel: "Assets in the property — Div 40" },
      { label: "Borrowing costs", value: "borrowing", subLabel: "Loan fees, mortgage insurance" },
    ],
    required: true,
  },

  // Step 2: Initial repair flag
  {
    id: "damage_existed", step: 2, type: "two_button",
    label: "Was the damage or defect already there when you bought the property?",
    subLabel: "Initial repairs (defects at purchase) are capital — not immediately deductible",
    options: [
      { label: "Yes — defect existed at purchase", value: true },
      { label: "No — damage occurred during ownership", value: false },
    ],
    showIf: (a) => (a.expense_types as string[] || []).includes("repairs"),
  },

  // Step 3: Scale of work
  {
    id: "scale_of_work", step: 3, type: "button_group",
    label: "What best describes the scale of the main work you did?",
    subLabel: "This determines whether it's a repair, capital works, or depreciating asset",
    options: [
      { label: "Like-for-like repair", value: "repair", subLabel: "Same materials, same function — true repair" },
      { label: "Improvement or upgrade", value: "improvement", subLabel: "Better materials or added functionality" },
      { label: "Full asset replacement", value: "full_replacement", subLabel: "Replaced entire asset e.g. new hot water system" },
      { label: "Structural / building work", value: "structural", subLabel: "Extensions, additions, major works" },
    ],
    required: true,
  },

  // Step 4: Availability for rent
  {
    id: "available_for_rent", step: 4, type: "two_button",
    label: "Was the property genuinely available for rent during the period you incurred these expenses?",
    subLabel: "ATO requires the property to be listed and available — not just intended to be rented",
    options: [
      { label: "Yes — listed and available", value: true },
      { label: "No — vacant or under renovation", value: false },
    ],
    required: true,
  },

  // Step 5: Private use
  {
    id: "private_use", step: 5, type: "two_button",
    label: "Did you use the property privately at any point during the year?",
    subLabel: "Any personal use requires apportionment of deductions — full claims are an audit risk",
    options: [
      { label: "No — purely rental", value: false },
      { label: "Yes — some private use", value: true },
    ],
    required: true,
  },

  // Step 6: Borrowing costs
  {
    id: "has_borrowing", step: 6, type: "two_button",
    label: "Did you have any loan setup or borrowing costs when you financed the property?",
    subLabel: "Borrowing costs are frequently missed — deductible over 5 years or loan term",
    options: [
      { label: "Yes — had borrowing costs", value: true },
      { label: "No — no borrowing costs", value: false },
    ],
  },

  // Step 7: Record quality (confidence)
  {
    id: "record_quality", step: 7, type: "confidence",
    label: "How complete are your records for these expenses?",
    subLabel: "ATO requires invoices, dates, photos, and descriptions for all rental claims",
    options: [
      { label: "Complete records", value: "all", subLabel: "Invoices, photos, dates, descriptions — all on file" },
      { label: "Partial records", value: "some", subLabel: "Most records but some gaps" },
      { label: "Poor records", value: "poor", subLabel: "Few or no supporting documents" },
    ],
    required: true,
  },
];

const TOTAL_STEPS = 7;

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT BLOCK
// ─────────────────────────────────────────────────────────────────────────────

function VerdictBlock({
  verdict, onCheckout, loading,
}: {
  verdict: VerdictResult;
  onCheckout: (t: Tier) => void;
  loading: Tier | null;
}) {
  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>
        {verdict.status}
      </p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

      {/* 3-stat grid */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map((s) => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Risk flags */}
      {verdict.riskFlags.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-red-700">Classification risks</p>
          <ul className="space-y-1.5 text-xs text-red-900">
            {verdict.riskFlags.map((f, i) => <li key={i}>→ {f}</li>)}
          </ul>
        </div>
      )}

      {/* Missed opportunities */}
      {verdict.missedOpportunities.length > 0 && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-blue-700">Missed deductions</p>
          <ul className="space-y-1.5 text-xs text-blue-900">
            {verdict.missedOpportunities.map((m, i) => <li key={i}>✓ {m}</li>)}
          </ul>
        </div>
      )}

      {/* Consequences */}
      {verdict.consequences.length > 0 && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
          <strong className="text-neutral-950">What this means:</strong>
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
          Most rental property owners are either overclaiming repairs the ATO will disallow — or missing legitimate deductions worth thousands.
          <strong className="text-neutral-950"> This check shows which side you're on.</strong>
        </p>
      </div>

      {/* What you get */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What's in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Expense classification memo — repairs vs capital works vs depreciating assets</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Initial repair flag — identifies any defects that existed at purchase</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Capital works claim prompts — Div 43 and Div 40 opportunities</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Depreciation schedule checklist — QS report guidance</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>3 accountant questions written for your exact expense mix</span></li>
        </ul>
      </div>

      {/* CTA */}
      <button onClick={() => onCheckout(verdict.tier)} disabled={loading !== null}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading === verdict.tier ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">
        ${verdict.tier} · One-time · Built around your answers above
      </p>
      <p className="mt-2 text-center">
        <button onClick={() => onCheckout(verdict.tier === 67 ? 147 : 67)} disabled={loading !== null}
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
  onAnswer: (id: string, v: string | boolean | string[]) => void;
}) {
  const sel = (v: string | boolean) => value === v;
  const base = "rounded-xl border px-4 py-3 text-left transition";
  const active = "border-neutral-950 bg-neutral-950 text-white";
  const inactive = "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400";

  return (
    <div>
      <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">{q.label}</h2>
      {q.subLabel && <p className="mb-4 text-sm text-neutral-500">{q.subLabel}</p>}

      {/* Multi-select */}
      {q.type === "multi_select" && (
        <div className="space-y-2">
          <p className="mb-2 text-xs text-neutral-500">Select all that apply</p>
          {q.options.map((opt) => {
            const selected = Array.isArray(value) && (value as string[]).includes(String(opt.value));
            return (
              <button key={String(opt.value)}
                onClick={() => {
                  const current = Array.isArray(value) ? value as string[] : [];
                  const next = selected
                    ? current.filter(v => v !== String(opt.value))
                    : [...current, String(opt.value)];
                  onAnswer(q.id, next);
                }}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                  selected ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
                }`}>
                <span className="mr-2 font-mono">{selected ? "✓" : "○"}</span>
                <span className="font-medium">{opt.label}</span>
                {opt.subLabel && (
                  <span className={`ml-2 text-xs ${selected ? "text-neutral-300" : "text-neutral-500"}`}>— {opt.subLabel}</span>
                )}
              </button>
            );
          })}
          {/* Continue button for multi-select */}
          {Array.isArray(value) && (value as string[]).length > 0 && (
            <button onClick={() => onAnswer(q.id, value as string[])}
              className="mt-2 w-full rounded-xl bg-neutral-950 py-3 text-sm font-bold text-white hover:bg-neutral-800 transition">
              Continue with {(value as string[]).length} selected →
            </button>
          )}
        </div>
      )}

      {/* Two button */}
      {q.type === "two_button" && (
        <div className="grid grid-cols-2 gap-3">
          {q.options.map((opt) => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as string | boolean)}
              className={`rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${sel(opt.value as string | boolean) ? active : inactive}`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Button group */}
      {q.type === "button_group" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((opt) => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as string)}
              className={`${base} ${sel(opt.value as string) ? active : inactive}`}>
              <span className="block text-sm font-medium">{opt.label}</span>
              {opt.subLabel && (
                <span className={`mt-0.5 block text-xs ${sel(opt.value as string) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Confidence */}
      {q.type === "confidence" && (
        <div className="grid gap-2 sm:grid-cols-3">
          {q.options.map((opt) => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as string)}
              className={`${base} ${sel(opt.value as string) ? active : inactive}`}>
              <span className="block text-sm font-medium">{opt.label}</span>
              {opt.subLabel && (
                <span className={`mt-0.5 block text-xs ${sel(opt.value as string) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>
              )}
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

export default function RentalPropertyDeductionAuditCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ situation: "", urgency: "", accountant: "" });
  const [email, setEmail]           = useState("");
  const [emailSent, setEmailSent]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const verdictRef                  = useRef<HTMLDivElement>(null);

  const verdict = useMemo(() => showVerdict ? calcVerdict(answers) : null, [showVerdict, answers]);

  const visibleQs = QUESTIONS.filter(q => q.step === step && (!q.showIf || q.showIf(answers)));

  // Step complete logic — multi_select needs explicit continue button
  const stepComplete = visibleQs.length === 0 || visibleQs
    .filter(q => q.required !== false && q.type !== "multi_select")
    .every(q => {
      const v = answers[q.id];
      return v !== undefined && v !== "" && v !== null;
    });

  // For multi_select — step advances via continue button, not auto
  const multiSelectStep = visibleQs.some(q => q.type === "multi_select");

  useEffect(() => {
    if (!stepComplete || multiSelectStep) return;
    const next = step + 1;
    const t = setTimeout(() => {
      if (next <= TOTAL_STEPS) setStep(next);
      else setVerdict(true);
    }, visibleQs.length ? 300 : 0);
    return () => clearTimeout(t);
  }, [stepComplete, step, visibleQs.length, multiSelectStep]);

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
        product_slug: "rental-property-deduction-audit",
        source_path: "/au/check/rental-property-deduction-audit",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: { status: verdict.status, risk_flags: verdict.riskFlags.length, tier: verdict.tier },
        recommended_tier: verdict.tier,
      }),
    }).then(r => r.json()).then(d => { if (d.id) setSessionId(d.id); }).catch(() => {});
  }, [showVerdict]);

  function answer(id: string, v: string | boolean | string[]) {
    setAnswers(p => ({ ...p, [id]: v }));
    // For multi_select continue button — advance step
    if (Array.isArray(v) && QUESTIONS.find(q => q.id === id)?.type === "multi_select") {
      const next = step + 1;
      setTimeout(() => {
        if (next <= TOTAL_STEPS) setStep(next);
        else setVerdict(true);
      }, 300);
    }
  }

  function back() {
    if (showVerdict) { setVerdict(false); return; }
    if (step > 1) setStep(s => s - 1);
  }

  async function handleSaveEmail() {
    if (!email) return;
    await fetch("/api/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "rental_property_deduction_audit", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `rental_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    // Save for success page
    sessionStorage.setItem("rental-property-deduction-audit_expense_types", JSON.stringify(answers.expense_types || []));
    sessionStorage.setItem("rental-property-deduction-audit_risk_flags", String(verdict.riskFlags.length));
    sessionStorage.setItem("rental-property-deduction-audit_status", verdict.status);
    sessionStorage.setItem("rental-property-deduction-audit_confidence", verdict.confidence);
    sessionStorage.setItem("rental-property-deduction-audit_tier", String(popupTier));

    if (sessionId) {
      fetch("/api/decision-sessions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sessionId, tier_intended: popupTier, product_key: key,
          questionnaire_payload: popupAnswers, email: email || undefined,
        }),
      }).catch(() => {});
    }

    try {
      const successPath = popupTier === 67 ? "assess" : "plan";
      const res = await fetch("/api/create-checkout-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision_session_id: sid, tier: popupTier, product_key: key,
          success_url: `${window.location.origin}/au/check/rental-property-deduction-audit/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/rental-property-deduction-audit`,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setError(data.error || "Checkout failed — please try again."); setLoading(false); }
    } catch {
      setError("Checkout failed — please try again.");
      setLoading(false);
    }
  }

  const maxStep = QUESTIONS.reduce((acc, q) => (!q.showIf || q.showIf(answers)) ? Math.max(acc, q.step) : acc, 1);
  const popupComplete = Object.values(popupAnswers).every(v => v !== "");

  return (
    <>
      <div className="space-y-6">
        {/* Form */}
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
              {visibleQs.map(q => <QuestionBlock key={q.id} q={q} value={answers[q.id]} onAnswer={answer} />)}
            </div>
          </div>
        )}

        {/* Verdict */}
        {showVerdict && verdict && (
          <div ref={verdictRef} className="space-y-4">
            <button onClick={back} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← Change my answers</button>

            <VerdictBlock verdict={verdict} onCheckout={openPopup} loading={loading ? popupTier : null} />

            {/* Email capture */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your result to show your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your deduction classification by email — free.</p>
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

      {/* Popup */}
      {showPopup && verdict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl my-auto">
            <div className="rounded-t-2xl bg-neutral-950 px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass.replace("700","400")}`}>{verdict.status}</p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">
                    {verdict.riskFlags.length > 0 ? `${verdict.riskFlags.length} classification risk${verdict.riskFlags.length > 1 ? "s" : ""} detected` : "Deductions reviewed"}
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
                      {popupTier === 67 ? "Your Rental Deduction Repair Pack™" : "Your ATO Audit-Ready Rental System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Expense classification memo, initial-repair flags, capital-works claim prompts, depreciation checklist, and 3 accountant questions — built around your exact expense mix."
                        : "Full expense map, evidence register, multi-year deduction calendar, and a document pack ready for your accountant to prepare amended or current-year claims."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic rental guide. A plan for your deductions.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Get My Rental Deduction Pack →" : "Get My Audit-Ready System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the essentials? — $67 instead" : "Want the full audit-ready system? — $147 instead"}
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
                    { label: "Property ownership", key: "situation", options: [["individual","Individual owner"],["joint","Joint / co-ownership"],["trust","Trust or SMSF"],["company","Company"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["before_return","Before lodging my return"],["amend","Want to amend prior year"],["planning","Planning ahead"]] },
                    { label: "Do you have an accountant?", key: "accountant", options: [["yes_active","Yes — meeting them soon"],["yes_inactive","Yes — not spoken recently"],["no","No — managing myself"]] },
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

      {/* Mobile sticky */}
      {showVerdict && verdict && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Rental Deduction Audit</p>
              <p className="text-sm font-bold text-neutral-950">
                {verdict.riskFlags.length > 0 ? `${verdict.riskFlags.length} risk${verdict.riskFlags.length > 1 ? "s" : ""} detected — get your plan` : "Review your deductions"}
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
