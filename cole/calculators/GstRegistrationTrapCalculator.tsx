"use client";

/**
 * AU-08 — GST Registration Trap Calculator
 * Pattern: Module G (ThresholdTest) + business-type routing
 * Brief: business type → turnover band → projected turnover → invoiced without GST → start timing → voluntary intent → BAS setup
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
  backdatingRisk: boolean;
  exposureNote: string;
}

interface PopupAnswers {
  business_structure: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GST LOGIC
// ─────────────────────────────────────────────────────────────────────────────

const GST_THRESHOLD       = 75000;
const RIDESHARE_THRESHOLD = 0;     // ride-share/taxi — no threshold, must register immediately
const ACCOMMODATION_THRESHOLD = 75000;

function calcVerdict(answers: AnswerMap): VerdictResult {
  const businessType    = String(answers.business_type || "general");
  const currentTurnover = String(answers.current_turnover || "");
  const projectedTurnover = String(answers.projected_turnover || "");
  const invoicedWithoutGst = answers.invoiced_without_gst;
  const startTiming     = String(answers.start_timing || "");
  const voluntaryIntent = answers.voluntary_intent;
  const basSetup        = String(answers.bas_setup || "");

  const KEYS = {
    p67:  "au_67_gst_registration_trap",
    p147: "au_147_gst_registration_trap",
  };

  // ── Ride-share / taxi — no threshold, must register day 1 ─────────────────
  if (businessType === "rideshare") {
    return {
      status: "REGISTRATION REQUIRED — NO THRESHOLD FOR RIDE-SHARE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "Ride-share and taxi drivers must register for GST from day one — there is no $75,000 threshold for this sector.",
      stats: [
        { label: "GST threshold", value: "No threshold ✗", highlight: true },
        { label: "Register from", value: "Day one of operation", highlight: true },
        { label: "Penalty exposure", value: "All unremitted GST + interest" },
      ],
      consequences: [
        "The ATO exempts ride-share and taxi operators from the $75,000 threshold — you must register regardless of income",
        "Every fare you have charged without GST is potentially unremitted GST — backdating exposure applies from your first trip",
        "Uber, DiDi, and other platforms report driver income directly to the ATO — unregistered operators are identifiable",
        invoicedWithoutGst ? "You have already invoiced without GST — this creates backdating liability that needs urgent attention" : "",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "Ride-share registration requirement is absolute — no threshold applies.",
      tier: 147,
      ctaLabel: "Get My GST Compliance Launch System — $147 →",
      altTierLabel: "Just want the catch-up plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      backdatingRisk: true,
      exposureNote: "All ride-share income since first trip",
    };
  }

  // ── Map turnover bands to numbers ─────────────────────────────────────────
  const turnoverMap: Record<string, number> = {
    under_50k: 40000,
    band_50_75: 62500,
    band_75_150: 100000,
    over_150k: 200000,
  };
  const projectedMap: Record<string, number> = {
    under_75k: 50000,
    will_cross: 85000,
    already_over: 100000,
  };

  const currentAmount  = turnoverMap[currentTurnover] ?? 0;
  const projectedAmount = projectedMap[projectedTurnover] ?? 0;

  // ── Voluntary registration — under threshold but wants to claim GST credits
  if (voluntaryIntent === true && currentAmount < GST_THRESHOLD && projectedAmount < GST_THRESHOLD) {
    return {
      status: "VOLUNTARY REGISTRATION — AVAILABLE BUT NOT REQUIRED",
      statusClass: "text-blue-700",
      panelClass: "border-blue-200 bg-blue-50",
      headline: "You are under the $75,000 threshold and not required to register — but voluntary registration may allow you to claim GST credits on business costs.",
      stats: [
        { label: "Registration status", value: "Not required" },
        { label: "Voluntary option", value: "Available ✓" },
        { label: "GST threshold", value: "$75,000" },
      ],
      consequences: [
        "Voluntary registration means you must charge GST on all sales AND lodge BAS returns",
        "The benefit: you can claim GST credits on purchases (inputs) — valuable if you have high business costs",
        "Once registered, you must stay registered until your turnover drops for 12 consecutive months",
        "Consider the admin cost of BAS lodgement vs the GST credits you would recover",
      ],
      confidence: "HIGH",
      confidenceNote: "Under threshold — voluntary registration is an informed choice, not a compliance issue.",
      tier: 67,
      ctaLabel: "Get My GST Registration Guide — $67 →",
      altTierLabel: "Want the full GST compliance setup? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      backdatingRisk: false,
      exposureNote: "No mandatory exposure — voluntary decision",
    };
  }

  // ── Clearly under threshold, not projecting to cross ──────────────────────
  if (currentAmount < GST_THRESHOLD && projectedAmount < GST_THRESHOLD) {
    return {
      status: "NOT REQUIRED — UNDER $75,000 THRESHOLD",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: "Your current and projected GST turnover is below the $75,000 threshold — registration is not mandatory at this stage.",
      stats: [
        { label: "GST threshold", value: "$75,000" },
        { label: "Your turnover", value: currentTurnover === "under_50k" ? "Under $50k" : "$50k–$75k" },
        { label: "Registration", value: "Not required" },
      ],
      consequences: [
        "Monitor your turnover closely — if you cross $75,000 in any 12-month period you must register within 21 days",
        "The test is projected GST turnover — if you expect to cross $75,000 in the next 12 months, registration is required now",
        "Voluntary registration is available if you want to claim GST credits on business costs",
      ],
      confidence: "HIGH",
      confidenceNote: "Below threshold on both current and projected basis.",
      tier: 67,
      ctaLabel: "Get My GST Position Confirmed — $67 →",
      altTierLabel: "Want full GST compliance setup? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      backdatingRisk: false,
      exposureNote: "No current exposure — monitor threshold",
    };
  }

  // ── Approaching threshold — projected to cross ─────────────────────────────
  if (currentAmount < GST_THRESHOLD && projectedAmount >= GST_THRESHOLD) {
    return {
      status: "REGISTRATION REQUIRED SOON — PROJECTED TO CROSS THRESHOLD",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: "You are below the $75,000 threshold now but projected to cross it — registration is required within 21 days of crossing.",
      stats: [
        { label: "Current turnover", value: currentTurnover === "under_50k" ? "Under $50k" : "$50k–$75k" },
        { label: "Projected turnover", value: "Over $75,000" },
        { label: "Register within", value: "21 days of crossing", highlight: true },
      ],
      consequences: [
        "The ATO test is projected GST turnover — if you expect to cross $75,000 in the next 12 months, you must register now",
        "Failure to register on time means you owe GST on sales from the date you should have registered — even if you haven't collected it",
        "You need to update pricing, invoices, and bookkeeping before you cross the threshold — not after",
        invoicedWithoutGst ? "You have already invoiced without GST — review whether any of those invoices should have included GST" : "",
      ].filter(Boolean),
      confidence: "MEDIUM",
      confidenceNote: "Projected turnover estimate — confirm with your actual revenue trajectory.",
      tier: 147,
      ctaLabel: "Get My GST Compliance Launch System — $147 →",
      altTierLabel: "Just want the catch-up plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      backdatingRisk: false,
      exposureNote: "Register within 21 days of crossing $75,000",
    };
  }

  // ── Already over threshold — mandatory registration ────────────────────────
  const backdating = invoicedWithoutGst === true;
  const earlyStart = startTiming === "over_12_months" || startTiming === "over_6_months";

  return {
    status: backdating
      ? "OVERDUE — GST BACKDATING EXPOSURE LIKELY"
      : "REGISTRATION REQUIRED — OVER $75,000 THRESHOLD",
    statusClass: "text-red-700",
    panelClass: "border-red-200 bg-red-50",
    headline: backdating
      ? `You have crossed the $75,000 GST threshold and invoiced without GST — you likely owe GST on past sales you have not collected.`
      : `Your turnover exceeds the $75,000 GST threshold — registration is required and may be overdue.`,
    stats: [
      { label: "GST threshold", value: "$75,000" },
      { label: "Your turnover", value: currentTurnover === "band_75_150" ? "$75k–$150k" : "Over $150k" },
      { label: "Backdating risk", value: backdating ? "YES — invoiced without GST ✗" : earlyStart ? "Possible — check timing" : "Low", highlight: backdating || earlyStart },
    ],
    consequences: [
      "You are required to register — the 21-day registration window from crossing $75,000 applies",
      backdating
        ? "You have invoiced customers without GST — the ATO treats the GST as embedded in your prices, meaning you owe it from your own revenue"
        : "All sales from your registration date must include GST — your pricing needs to be updated",
      earlyStart
        ? `You crossed the threshold ${startTiming === "over_12_months" ? "more than 12 months" : "6–12 months"} ago — backdated GST liability may be significant`
        : "Register now to limit further exposure",
      "Your BAS lodgement cycle will be determined by your turnover — monthly, quarterly, or annual",
    ].filter(Boolean),
    confidence: backdating ? "HIGH" : "MEDIUM",
    confidenceNote: backdating
      ? "Backdating risk confirmed — you have invoiced without GST above the threshold."
      : "Confirm exact date you crossed $75,000 to determine registration deadline.",
    tier: 147,
    ctaLabel: "Get My GST Compliance Launch System — $147 →",
    altTierLabel: "Just want the catch-up plan? — $67 instead",
    productKey67: KEYS.p67, productKey147: KEYS.p147,
    backdatingRisk: backdating || earlyStart,
    exposureNote: backdating
      ? "GST embedded in past invoices — owed from date threshold was crossed"
      : "Register immediately to stop further unremitted GST accumulating",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

type Q = {
  id: string;
  step: number;
  type: "button_group" | "two_button" | "band_input" | "intent";
  label: string;
  subLabel?: string;
  options: { label: string; value: string | boolean; subLabel?: string }[];
  showIf?: (a: AnswerMap) => boolean;
  required?: boolean;
};

const QUESTIONS: Q[] = [
  // Step 1: Business type — routes the entire logic tree
  {
    id: "business_type", step: 1, type: "button_group",
    label: "What type of business or income do you have?",
    subLabel: "Some sectors have special GST rules — ride-share has no threshold at all",
    options: [
      { label: "General business", value: "general", subLabel: "Products, services, consulting, trade" },
      { label: "Contractor / freelancer", value: "contractor", subLabel: "Invoicing clients for services" },
      { label: "Short-term accommodation", value: "accommodation", subLabel: "Airbnb, holiday rentals" },
      { label: "Ride-share or taxi", value: "rideshare", subLabel: "Uber, DiDi, Ola, traditional taxi — NO threshold" },
      { label: "Mixed income sources", value: "mixed", subLabel: "Multiple income types — need to aggregate" },
    ],
    required: true,
  },

  // Step 2: Current turnover
  {
    id: "current_turnover", step: 2, type: "band_input",
    label: "What is your GST turnover in the last 12 months?",
    subLabel: "Rolling 12 months — NOT financial year. GST turnover = gross revenue, not profit. Include all business income.",
    options: [
      { label: "Under $50,000", value: "under_50k", subLabel: "Well below the $75k threshold" },
      { label: "$50,000 – $75,000", value: "band_50_75", subLabel: "Approaching the threshold" },
      { label: "$75,000 – $150,000", value: "band_75_150", subLabel: "Over the threshold" },
      { label: "Over $150,000", value: "over_150k", subLabel: "Significantly over threshold" },
    ],
    showIf: (a) => a.business_type !== "rideshare",
    required: true,
  },

  {
    id: "projected_turnover", step: 3, type: "button_group",
    label: "What do you EXPECT your turnover to be in the next 12 months?",
    subLabel: "The ATO tests EXPECTED turnover — if you expect to cross $75,000, you must register NOW before you hit it",
    options: [
      { label: "Under $75,000", value: "under_75k", subLabel: "Not expecting to cross the threshold" },
      { label: "Will likely cross $75,000", value: "will_cross", subLabel: "Growing — expect to hit threshold" },
      { label: "Already over $75,000", value: "already_over", subLabel: "Currently above threshold" },
    ],
    showIf: (a) => a.business_type !== "rideshare" && (a.current_turnover === "under_50k" || a.current_turnover === "band_50_75"),
    required: true,
  },

  // Step 4: Invoiced without GST
  {
    id: "invoiced_without_gst", step: 4, type: "two_button",
    label: "Have you already invoiced customers without charging GST?",
    subLabel: "If yes and you should have been registered, the GST is treated as embedded in your price — you owe it from your own revenue",
    options: [
      { label: "Yes — invoiced without GST", value: true },
      { label: "No — not invoiced or not yet trading", value: false },
    ],
    showIf: (a) => a.business_type !== "rideshare",
  },

  // Step 5: Start timing — backdating exposure
  {
    id: "start_timing", step: 5, type: "button_group",
    label: "When did you first expect to cross or approach the $75,000 threshold?",
    subLabel: "Needed to estimate how far back your registration obligation may run",
    options: [
      { label: "Just now — crossing threshold now", value: "just_now", subLabel: "Minimal backdating risk" },
      { label: "3–6 months ago", value: "recent", subLabel: "Some backdating exposure" },
      { label: "6–12 months ago", value: "over_6_months", subLabel: "Significant backdating exposure" },
      { label: "More than 12 months ago", value: "over_12_months", subLabel: "Serious backdating — urgent action needed", },
    ],
    showIf: (a) => a.business_type !== "rideshare" && (a.current_turnover === "band_75_150" || a.current_turnover === "over_150k"),
  },

  // Step 6: Voluntary registration intent
  {
    id: "voluntary_intent", step: 6, type: "two_button",
    label: "Even if under the threshold — are you trying to claim GST credits on business costs?",
    subLabel: "Voluntary registration lets you claim GST on inputs but requires BAS lodgement",
    options: [
      { label: "Yes — want to claim GST credits", value: true },
      { label: "No — prefer to stay unregistered", value: false },
    ],
    showIf: (a) => a.business_type !== "rideshare" && (a.current_turnover === "under_50k" || a.current_turnover === "band_50_75"),
  },

  // Step 7: BAS setup
  {
    id: "bas_setup", step: 7, type: "button_group",
    label: "Do you know your BAS reporting basis and lodgement cycle?",
    subLabel: "Supports implementation planning in the paid product",
    options: [
      { label: "Yes — cash basis, know my cycle", value: "cash_known" },
      { label: "Yes — accruals basis, know my cycle", value: "accrual_known" },
      { label: "Not sure — need to set this up", value: "unknown", subLabel: "Common for new registrants" },
    ],
    showIf: (a) => a.business_type !== "rideshare",
  },
];

const TOTAL_STEPS = 7;

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

      {verdict.backdatingRisk && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1">Backdating exposure</p>
          <p className="text-xs text-red-900">→ {verdict.exposureNote}</p>
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
          Most people don't realise they needed to register until it's too late — and end up paying GST on money they've already spent.
          <strong className="text-neutral-950"> This check shows your exact position.</strong>
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What's in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>GST threshold memo — projected vs historical turnover analysis</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Trigger-date estimate — when registration obligation started</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Invoice cleanup checklist — what to do about past invoices without GST</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Voluntary vs mandatory registration guide for your business type</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>3 accountant questions written for your exact GST situation</span></li>
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

export default function GstRegistrationTrapCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ business_structure: "", urgency: "", accountant: "" });
  const [email, setEmail]           = useState("");
  const [emailSent, setEmailSent]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const verdictRef                  = useRef<HTMLDivElement>(null);

  const verdict = useMemo(() => showVerdict ? calcVerdict(answers) : null, [showVerdict, answers]);
  const visibleQs = QUESTIONS.filter(q => q.step === step && (!q.showIf || q.showIf(answers)));
  const stepComplete = !visibleQs.length || visibleQs.filter(q => q.required !== false).every(q => answers[q.id] !== undefined && answers[q.id] !== "");

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
        product_slug: "gst-registration-trap",
        source_path: "/au/check/gst-registration-trap",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: { status: verdict.status, backdating: verdict.backdatingRisk, tier: verdict.tier },
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
      body: JSON.stringify({ email, source: "gst_registration_trap", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `gst_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("gst-registration-trap_business_type", String(answers.business_type || ""));
    sessionStorage.setItem("gst-registration-trap_current_turnover", String(answers.current_turnover || ""));
    sessionStorage.setItem("gst-registration-trap_backdating", String(verdict.backdatingRisk));
    sessionStorage.setItem("gst-registration-trap_status", verdict.status);
    sessionStorage.setItem("gst-registration-trap_tier", String(popupTier));

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
          success_url: `${window.location.origin}/au/check/gst-registration-trap/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/gst-registration-trap`,
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

  const maxStep = QUESTIONS.reduce((acc, q) => (!q.showIf || q.showIf(answers)) ? Math.max(acc, q.step) : acc, 1);
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your result to show your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your GST position by email — free.</p>
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
                    {verdict.backdatingRisk ? "Backdated GST liability — act now" : "Your GST registration position"}
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
                      {popupTier === 67 ? "Your GST Catch-Up Plan™" : "Your GST Compliance Launch System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "GST threshold memo, trigger-date estimate, invoice cleanup checklist, voluntary-vs-mandatory registration guide, and accountant questions — built around your business type and turnover."
                        : "BAS setup recommendations, pricing transition guide, bookkeeping classification template, and a full backfill/remediation pack for your adviser or BAS agent."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic GST guide. A plan for your GST position.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Get My GST Catch-Up Plan →" : "Get My GST Launch System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the catch-up plan? — $67 instead" : "Want the full compliance launch system? — $147 instead"}
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
                    { label: "Business structure", key: "business_structure", options: [["sole_trader","Sole trader"],["company","Company / Pty Ltd"],["trust","Trust"],["partnership","Partnership"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["immediate","Urgent — need to register now"],["planning","Planning — preparing ahead"],["checking","Just checking my position"]] },
                    { label: "Do you have an accountant or BAS agent?", key: "accountant", options: [["yes_active","Yes — speaking with them soon"],["yes_inactive","Yes — not spoken recently"],["no","No — managing myself"]] },
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

      {showVerdict && verdict && verdict.tier === 147 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">GST Registration</p>
              <p className="text-sm font-bold text-neutral-950">
                {verdict.backdatingRisk ? "Backdating risk — get your plan now" : "Action required — get your GST plan"}
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
