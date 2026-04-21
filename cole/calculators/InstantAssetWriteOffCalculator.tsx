"use client";

/**
 * AU-07 — Instant Asset Write-Off Deadline Engine
 * Pattern: Module G (ThresholdTest) + EOFY deadline urgency
 * Brief: business eligibility → asset cost → readiness date → GST → delivery risk → pool
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean | number>;
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
  deductionAmount: number;
  fallbackAmount: number;
  cliffRisk: boolean;
}

interface PopupAnswers {
  business_structure: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const IAWO_THRESHOLD    = 20000;
const FALLBACK_THRESHOLD = 1000;
const EOFY              = new Date("2026-06-30T23:59:59.000+10:00");
const DAYS_TO_EOFY      = Math.max(0, Math.floor((EOFY.getTime() - Date.now()) / 86_400_000));
const CAR_LIMIT_2026    = 69674; // ATO car limit 2025-26

function formatAUD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-AU");
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const eligible        = answers.business_eligible;
  const assetCost       = Number(answers.asset_cost_band === "under_20k" ? 15000 : answers.asset_cost_band === "over_20k" ? 35000 : 15000);
  const assetCostBand   = String(answers.asset_cost_band || "under_20k");
  const businessUse     = Number(answers.business_use || 100);
  const assetStatus     = String(answers.asset_status || "new");
  const readinessDate   = String(answers.readiness_date || "");
  const gstRegistered   = answers.gst_registered;
  const deliveryRisk    = answers.delivery_risk;
  const hasPool         = answers.has_pool;
  const isPassengerCar  = answers.is_passenger_car;

  const KEYS = {
    p67:  "au_67_instant_asset_write_off",
    p147: "au_147_instant_asset_write_off",
  };

  // Effective cost for threshold (GST-exclusive if registered)
  const effectiveCost = assetCostBand === "under_20k" ? 15000 : 35000;
  const businessCost  = Math.round(effectiveCost * (businessUse / 100));
  const deductionAmount = Math.min(businessCost, IAWO_THRESHOLD * (businessUse / 100));

  // Fallback depreciation year 1 (15% in year of purchase under general pool)
  const fallbackAmount = Math.round(businessCost * 0.15);

  // ── Not eligible — wrong entity / turnover ────────────────────────────────
  if (eligible === false) {
    return {
      status: "NOT ELIGIBLE — BUSINESS DOES NOT QUALIFY",
      statusClass: "text-neutral-600",
      panelClass: "border-neutral-200 bg-neutral-50",
      headline: "The instant asset write-off only applies to small businesses using simplified depreciation with turnover under $10 million.",
      stats: [
        { label: "IAWO threshold", value: formatAUD(IAWO_THRESHOLD) },
        { label: "Turnover cap", value: "Under $10 million" },
        { label: "Your eligibility", value: "Not met ✗", highlight: true },
      ],
      consequences: [
        "The IAWO is not available to businesses over $10M turnover or those not using simplified depreciation",
        "Assets would instead go into your general depreciation pool at 15% in year one and 30% thereafter",
        hasPool ? "Your existing pool will continue to depreciate at the standard rate" : "",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "Eligibility is a hard gate — check with your accountant if you are borderline.",
      tier: 67,
      ctaLabel: "Get My Asset Depreciation Strategy — $67 →",
      altTierLabel: "Want the full multi-asset system? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      deductionAmount: 0, fallbackAmount, cliffRisk: false,
    };
  }

  // ── Passenger car over car limit ──────────────────────────────────────────
  if (isPassengerCar === true && effectiveCost > CAR_LIMIT_2026) {
    const carLimitDeduction = Math.round(CAR_LIMIT_2026 * (businessUse / 100));
    return {
      status: "CAR LIMIT APPLIES — DEDUCTION CAPPED",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Passenger vehicles over the $${CAR_LIMIT_2026.toLocaleString()} car limit cannot be fully written off — deduction is capped regardless of the $20,000 threshold.`,
      stats: [
        { label: "Car limit 2025–26", value: formatAUD(CAR_LIMIT_2026) },
        { label: "Your deduction cap", value: formatAUD(carLimitDeduction), highlight: true },
        { label: "EOFY deadline", value: `${DAYS_TO_EOFY} days` },
      ],
      consequences: [
        "The ATO car limit ($69,674 for 2025–26) caps the cost base for passenger vehicles — the $20,000 IAWO threshold does not override this",
        "The deductible amount is the car limit × your business-use percentage — not the purchase price",
        "Commercial vehicles (utes, vans, trucks) are generally not subject to the car limit — check your vehicle classification",
      ],
      confidence: "HIGH",
      confidenceNote: "Car limit is a hard ATO rule — applies to passenger vehicles regardless of cost.",
      tier: 147,
      ctaLabel: "Get My Asset Timing & Depreciation System — $147 →",
      altTierLabel: "Just want the EOFY deadline plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      deductionAmount: carLimitDeduction, fallbackAmount, cliffRisk: false,
    };
  }

  // ── Over $20,000 threshold ────────────────────────────────────────────────
  if (assetCostBand === "over_20k") {
    return {
      status: "OVER THRESHOLD — POOL DEPRECIATION APPLIES",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `At over $20,000, this asset cannot use the instant write-off — it goes into your small business depreciation pool at 15% in year one.`,
      stats: [
        { label: "IAWO threshold", value: formatAUD(IAWO_THRESHOLD) },
        { label: "Year 1 pool deduction", value: formatAUD(fallbackAmount), highlight: true },
        { label: "Full write-off", value: "Not available ✗" },
      ],
      consequences: [
        "Assets over $20,000 enter the small business depreciation pool — 15% deduction in year of purchase, 30% in subsequent years",
        "Consider whether the asset could be split or staged to bring it under $20,000 per item",
        deliveryRisk ? "Delivery timing risk noted — pool entry also requires installation before 30 June" : "",
        hasPool ? "This asset will combine with your existing pool balance" : "",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "Over threshold — pool treatment applies.",
      tier: 147,
      ctaLabel: "Get My Asset Timing & Depreciation System — $147 →",
      altTierLabel: "Just want the depreciation strategy? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      deductionAmount: 0, fallbackAmount, cliffRisk: false,
    };
  }

  // ── Delivery risk — may miss deadline ─────────────────────────────────────
  if (deliveryRisk === true || readinessDate === "after_eofy" || readinessDate === "uncertain") {
    return {
      status: "DEADLINE RISK — INSTALL BY 30 JUNE IS NOT GUARANTEED",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Your ${formatAUD(deductionAmount)} deduction is at risk — the asset must be installed and ready for use by 30 June 2026, not just ordered or paid for.`,
      stats: [
        { label: "Potential deduction", value: formatAUD(deductionAmount), highlight: true },
        { label: "If deadline missed", value: formatAUD(fallbackAmount) + " (year 1 only)", highlight: true },
        { label: "Days remaining", value: `${DAYS_TO_EOFY} days`, highlight: DAYS_TO_EOFY < 14 },
      ],
      consequences: [
        "Ordering or paying before 30 June is NOT enough — the ATO requires the asset to be first used or installed ready for use by that date",
        `Miss the deadline by one day and your deduction drops from ${formatAUD(deductionAmount)} to approximately ${formatAUD(fallbackAmount)} in year one`,
        "Get written confirmation from your supplier of the delivery and installation date — this is your audit evidence",
        readinessDate === "uncertain" ? "Uncertain delivery timing is the most common reason businesses lose the write-off — confirm with supplier now" : "",
      ].filter(Boolean),
      confidence: "MEDIUM",
      confidenceNote: "Delivery timing is the critical variable — confirm with supplier before proceeding.",
      tier: 147,
      ctaLabel: "Get My Asset Timing & Depreciation System — $147 →",
      altTierLabel: "Just want the EOFY deadline plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      deductionAmount, fallbackAmount, cliffRisk: true,
    };
  }

  // ── Eligible and on track ─────────────────────────────────────────────────
  if (readinessDate === "before_eofy") {
    return {
      status: "ELIGIBLE — DEDUCTION CONFIRMED IF INSTALLED BY 30 JUNE",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your ${formatAUD(deductionAmount)} instant asset write-off is within reach — provided the asset is installed and ready for use by 30 June 2026.`,
      stats: [
        { label: "Estimated deduction", value: formatAUD(deductionAmount), highlight: true },
        { label: "Business use", value: `${businessUse}%` },
        { label: "Days to EOFY", value: `${DAYS_TO_EOFY} days`, highlight: DAYS_TO_EOFY < 14 },
      ],
      consequences: [
        "The asset must be first used or installed ready for use by 30 June 2026 — not just purchased or deposited",
        `After 30 June the threshold drops to approximately ${formatAUD(FALLBACK_THRESHOLD)} — your ${formatAUD(deductionAmount)} deduction may be lost entirely`,
        assetStatus === "second_hand" ? "Second-hand assets qualify under the 2025–26 rules — confirm the asset has not previously been depreciated by a connected entity" : "",
        gstRegistered ? "As a GST-registered business, the threshold applies to the GST-exclusive cost" : "As a non-GST business, the threshold applies to the GST-inclusive cost",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "On track — confirm installation date in writing with your supplier.",
      tier: 67,
      ctaLabel: "Get My EOFY Asset Deadline Plan — $67 →",
      altTierLabel: "Want multi-asset sequencing and pool strategy? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      deductionAmount, fallbackAmount, cliffRisk: false,
    };
  }

  // ── Default — not confirmed ready ─────────────────────────────────────────
  return {
    status: "CHECK READINESS — INSTALLATION DATE NOT CONFIRMED",
    statusClass: "text-amber-700",
    panelClass: "border-amber-200 bg-amber-50",
    headline: `You may qualify for a ${formatAUD(deductionAmount)} instant write-off — but only if the asset is installed and ready for use by 30 June 2026.`,
    stats: [
      { label: "Potential deduction", value: formatAUD(deductionAmount) },
      { label: "If deadline missed", value: formatAUD(fallbackAmount) + " (year 1)", highlight: true },
      { label: "Days to EOFY", value: `${DAYS_TO_EOFY} days`, highlight: DAYS_TO_EOFY < 14 },
    ],
    consequences: [
      "Confirm your installation date with your supplier — in writing — before proceeding",
      "Paying a deposit or placing an order does not qualify — the asset must be operational by 30 June",
      `The threshold drops to approximately $1,000 from 1 July 2026 — a ${formatAUD(deductionAmount - fallbackAmount)} difference`,
    ],
    confidence: "LOW",
    confidenceNote: "Installation date not confirmed — this is the critical variable.",
    tier: 147,
    ctaLabel: "Get My Asset Timing & Depreciation System — $147 →",
    altTierLabel: "Just want the EOFY deadline plan? — $67 instead",
    productKey67: KEYS.p67, productKey147: KEYS.p147,
    deductionAmount, fallbackAmount, cliffRisk: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

type Q = {
  id: string;
  step: number;
  type: "two_button" | "button_group";
  label: string;
  subLabel?: string;
  options: { label: string; value: string | boolean; subLabel?: string }[];
  showIf?: (a: AnswerMap) => boolean;
  required?: boolean;
};

const QUESTIONS: Q[] = [
  {
    id: "business_eligible", step: 1, type: "two_button",
    label: "Is your business using simplified depreciation with annual turnover under $10 million?",
    subLabel: "The instant asset write-off only applies to small businesses using the simplified depreciation rules",
    options: [
      { label: "Yes — small business, simplified depreciation", value: true },
      { label: "No — over $10M or not using simplified rules", value: false },
    ],
    required: true,
  },
  {
    id: "asset_cost_band", step: 2, type: "two_button",
    label: "What is the cost of the asset (GST-exclusive if registered, GST-inclusive if not)?",
    subLabel: "The $20,000 threshold is per asset — not total spend. Multiple assets can each qualify.",
    options: [
      { label: "Under $20,000", value: "under_20k", subLabel: "Qualifies for instant write-off" },
      { label: "Over $20,000", value: "over_20k", subLabel: "Goes into pool — different rules" },
    ],
    showIf: (a) => a.business_eligible === true,
    required: true,
  },
  {
    id: "is_passenger_car", step: 3, type: "two_button",
    label: "Is this a passenger vehicle (sedan, SUV, hatchback)?",
    subLabel: "Passenger vehicles over the $69,674 car limit cannot be fully written off — commercial vehicles are different",
    options: [
      { label: "No — equipment, tools, or commercial vehicle", value: false },
      { label: "Yes — passenger car or SUV", value: true },
    ],
    showIf: (a) => a.business_eligible === true,
    required: true,
  },
  {
    id: "business_use", step: 4, type: "button_group",
    label: "What percentage of the asset is used for business purposes?",
    subLabel: "The write-off applies to the business-use portion only — private use is excluded",
    options: [
      { label: "100% business", value: "100", subLabel: "Exclusively for business" },
      { label: "75% business", value: "75", subLabel: "Mostly business, some private" },
      { label: "50% business", value: "50", subLabel: "Split evenly" },
      { label: "Less than 50%", value: "25", subLabel: "Mostly private — IAWO value limited" },
    ],
    showIf: (a) => a.business_eligible === true,
    required: true,
  },
  {
    id: "asset_status", step: 5, type: "two_button",
    label: "Is the asset new or second-hand?",
    subLabel: "Both new and second-hand assets can qualify — but second-hand assets have additional rules",
    options: [
      { label: "New asset", value: "new" },
      { label: "Second-hand asset", value: "second_hand", subLabel: "Check connected entity rules" },
    ],
    showIf: (a) => a.business_eligible === true && a.asset_cost_band === "under_20k",
    required: true,
  },
  {
    id: "readiness_date", step: 6, type: "button_group",
    label: "Will the asset be first used or installed ready for use by 30 June 2026?",
    subLabel: "This is the actual legal test — ordering or paying is NOT enough. The asset must be operational.",
    options: [
      { label: "Yes — confirmed before 30 June", value: "before_eofy", subLabel: "Have written confirmation from supplier" },
      { label: "Likely — but not confirmed", value: "uncertain", subLabel: "No written confirmation yet" },
      { label: "No — delivery after 30 June", value: "after_eofy", subLabel: "Write-off will be lost" },
    ],
    showIf: (a) => a.business_eligible === true && a.asset_cost_band === "under_20k",
    required: true,
  },
  {
    id: "delivery_risk", step: 7, type: "two_button",
    label: "Is there any risk that delivery or installation could slip past 30 June?",
    subLabel: "Supply chain delays, installer availability, or customs clearance can all push past EOFY",
    options: [
      { label: "No — supplier confirmed the date", value: false },
      { label: "Yes — timing is not guaranteed", value: true },
    ],
    showIf: (a) => a.business_eligible === true && a.asset_cost_band === "under_20k" && a.readiness_date === "before_eofy",
  },
  {
    id: "gst_registered", step: 8, type: "two_button",
    label: "Is your business registered for GST?",
    subLabel: "GST-registered businesses use the GST-exclusive cost for the threshold — non-registered use the GST-inclusive cost",
    options: [
      { label: "Yes — registered for GST", value: true },
      { label: "No — not registered", value: false },
    ],
    showIf: (a) => a.business_eligible === true && a.asset_cost_band === "under_20k",
  },
  {
    id: "has_pool", step: 9, type: "two_button",
    label: "Do you already have a small business depreciation pool from prior years?",
    subLabel: "Existing pool balances interact with the write-off rules at EOFY",
    options: [
      { label: "Yes — have an existing pool", value: true },
      { label: "No — no existing pool", value: false },
    ],
    showIf: (a) => a.business_eligible === true,
  },
];

const TOTAL_STEPS = 9;

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

      {/* Cliff risk panel */}
      {verdict.cliffRisk && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1">Deadline cliff — 1 July 2026</p>
          <p className="text-xs text-red-900">
            → Miss the deadline by one day and your deduction drops from {formatAUD(verdict.deductionAmount)} to approximately {formatAUD(verdict.fallbackAmount)} in year one — a {formatAUD(verdict.deductionAmount - verdict.fallbackAmount)} difference.
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

      {/* Conversion line — ChatGPT recommended */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-sm text-neutral-700 leading-relaxed">
          Miss the deadline by one day, and your deduction drops from {formatAUD(IAWO_THRESHOLD)} to around {formatAUD(FALLBACK_THRESHOLD)}.
          <strong className="text-neutral-950"> This check shows exactly where you stand.</strong>
        </p>
      </div>

      {/* What you get */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What's in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Install-ready checklist — what the ATO requires as evidence of readiness</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Supplier timing worksheet — confirm dates in writing before 30 June</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>GST treatment note — exclusive vs inclusive threshold for your registration status</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Deduction calculation — your exact write-off based on cost and business use</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>3 accountant questions written for your exact asset situation</span></li>
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
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as string | boolean)}
              className={`rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${sel(opt.value as string | boolean) ? active : inactive}`}>
              <span className="block">{opt.label}</span>
              {opt.subLabel && <span className={`mt-0.5 block text-xs ${sel(opt.value as string | boolean) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>}
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

export default function InstantAssetWriteOffCalculator() {
  const [answers, setAnswers]     = useState<AnswerMap>({});
  const [step, setStep]           = useState(1);
  const [showVerdict, setVerdict] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showQuestions, setShowQ] = useState(false);
  const [popupTier, setPopupTier] = useState<Tier>(147);
  const [popupAnswers, setPopupA] = useState<PopupAnswers>({ business_structure: "", urgency: "", accountant: "" });
  const [email, setEmail]         = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const verdictRef                = useRef<HTMLDivElement>(null);

  const verdict    = useMemo(() => showVerdict ? calcVerdict(answers) : null, [showVerdict, answers]);
  const visibleQs  = QUESTIONS.filter(q => q.step === step && (!q.showIf || q.showIf(answers)));
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
        product_slug: "instant-asset-write-off",
        source_path: "/au/check/instant-asset-write-off",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: { status: verdict.status, deduction: verdict.deductionAmount, cliff: verdict.cliffRisk, tier: verdict.tier },
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
      body: JSON.stringify({ email, source: "instant_asset_write_off", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `iawo_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("instant-asset-write-off_asset_cost", String(answers.asset_cost_band || ""));
    sessionStorage.setItem("instant-asset-write-off_business_use", String(answers.business_use || "100"));
    sessionStorage.setItem("instant-asset-write-off_readiness_date", String(answers.readiness_date || ""));
    sessionStorage.setItem("instant-asset-write-off_cliff_risk", String(verdict.cliffRisk));
    sessionStorage.setItem("instant-asset-write-off_deduction_amount", String(verdict.deductionAmount));
    sessionStorage.setItem("instant-asset-write-off_status", verdict.status);
    sessionStorage.setItem("instant-asset-write-off_tier", String(popupTier));

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
          success_url: `${window.location.origin}/au/check/instant-asset-write-off/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/instant-asset-write-off`,
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
      {/* EOFY urgency banner */}
      <div className={`mb-4 flex items-center justify-between rounded-xl px-4 py-2.5 ${DAYS_TO_EOFY <= 14 ? "bg-red-700" : "bg-neutral-950"}`}>
        <span className="text-sm font-bold text-white">
          {DAYS_TO_EOFY <= 0 ? "⚠ EOFY deadline has passed" : `🔴 ${DAYS_TO_EOFY} days to 30 June 2026 — EOFY deadline`}
        </span>
        <span className="font-mono text-sm font-bold text-white/70">30 Jun 2026</span>
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Get your install-ready checklist by email.</p>
              <p className="mb-2 text-xs text-neutral-500">Free — shows exactly what you need before 30 June.</p>
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
                  <p className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400">{DAYS_TO_EOFY} days to 30 June 2026</p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">
                    {verdict.deductionAmount > 0 ? `${formatAUD(verdict.deductionAmount)} deduction at stake` : "Your depreciation strategy"}
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
                      {popupTier === 67 ? "Your EOFY Asset Deadline Plan™" : "Your Asset Timing & Depreciation System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Install-ready checklist, supplier timing worksheet, GST treatment note, deduction calculation, and accountant questions — built around your asset and business use percentage."
                        : "Multi-asset purchase sequencing, fallback depreciation strategy, pool interaction analysis, and decision matrix for buy now / stage / defer — full implementation layer."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic EOFY guide. A plan for your asset.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Get My EOFY Deadline Plan →" : "Get My Depreciation System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the EOFY deadline plan? — $67 instead" : "Want multi-asset sequencing and pool strategy? — $147 instead"}
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
                    { label: "How urgent is this?", key: "urgency", options: [["this_month","Buying asset this month"],["planning","Planning — not yet purchased"],["already_bought","Already bought — need to confirm"]] },
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

      {/* Mobile sticky */}
      {showVerdict && verdict && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">{DAYS_TO_EOFY} days to EOFY</p>
              <p className="text-sm font-bold text-neutral-950">
                {verdict.deductionAmount > 0 ? `${formatAUD(verdict.deductionAmount)} at stake — get your plan` : "Asset depreciation strategy"}
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
