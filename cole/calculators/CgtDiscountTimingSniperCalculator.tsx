"use client";

/**
 * AU-04 — CGT Discount Timing Sniper
 * Pattern: Module B (Timeline) — contract date to contract date calculation
 * Brief: entity → acquisition date → disposal date → asset type → residency → rollover → losses
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;

interface TimingResult {
  daysHeld: number;
  qualifies: boolean;
  daysShort: number;
  discountRate: number;
  entityLabel: string;
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
  strongestRisk: string;
}

interface PopupAnswers {
  asset_value: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const DISCOUNT_RATES: Record<string, number> = {
  individual:  0.50,
  trust:       0.50,
  smsf:        0.333,
  company:     0,
};

const ENTITY_LABELS: Record<string, string> = {
  individual: "Individual",
  trust:      "Trust",
  smsf:       "SMSF",
  company:    "Company",
};

// ATO counting rule: exclude acquisition day AND disposal day
// So 12 months = 365 days minimum between the two dates
function calcDaysHeld(acquisitionDate: string, disposalDate: string): number {
  if (!acquisitionDate || !disposalDate) return 0;
  const acq  = new Date(acquisitionDate);
  const disp = new Date(disposalDate);
  if (isNaN(acq.getTime()) || isNaN(disp.getTime())) return 0;
  // ATO rule: exclude both acquisition day and disposal day
  // Days held = (disposal date - acquisition date) - 1 day
  const diff = Math.floor((disp.getTime() - acq.getTime()) / 86_400_000);
  return Math.max(0, diff - 1);
}

function calcTiming(answers: AnswerMap): TimingResult {
  const entityType      = String(answers.entity_type || "individual");
  const acquisitionDate = String(answers.acquisition_date || "");
  const disposalDate    = String(answers.disposal_date || "");

  const discountRate = DISCOUNT_RATES[entityType] ?? 0.50;
  const entityLabel  = ENTITY_LABELS[entityType] ?? "Individual";

  if (!acquisitionDate || !disposalDate) {
    return { daysHeld: 0, qualifies: false, daysShort: 365, discountRate, entityLabel };
  }

  const daysHeld  = calcDaysHeld(acquisitionDate, disposalDate);
  const qualifies = discountRate > 0 && daysHeld >= 365;
  const daysShort = Math.max(0, 365 - daysHeld);

  return { daysHeld, qualifies, daysShort, discountRate, entityLabel };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const timing        = calcTiming(answers);
  const entityType    = String(answers.entity_type || "individual");
  const assetType     = String(answers.asset_type || "");
  const residency     = answers.residency;
  const rollover      = answers.rollover;
  const capitalLosses = answers.capital_losses;
  const acquisitionDate = String(answers.acquisition_date || "");
  const disposalDate  = String(answers.disposal_date || "");

  const KEYS = {
    p67:  "au_67_cgt_discount_timing_sniper",
    p147: "au_147_cgt_discount_timing_sniper",
  };

  // ── Company — no discount available ──────────────────────────────────────
  if (entityType === "company") {
    return {
      status: "NO DISCOUNT — COMPANIES DO NOT QUALIFY",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "Companies are not entitled to the CGT discount — the full capital gain is taxed at the company tax rate regardless of how long the asset was held.",
      stats: [
        { label: "Entity type", value: "Company ✗", highlight: true },
        { label: "CGT discount", value: "0% — not available", highlight: true },
        { label: "Tax on gain", value: "25% or 30% company rate" },
      ],
      consequences: [
        "The CGT discount does not apply to companies — 100% of the capital gain is assessable",
        "The company tax rate is 25% (base rate entities) or 30% (others)",
        "Structuring assets outside a company before sale can unlock the 50% discount — but requires pre-sale planning",
        "Trust and individual ownership structures can access the discount — a restructure before sale may be worth modelling",
      ],
      confidence: "HIGH",
      confidenceNote: "Company ineligibility is a hard ATO rule — no exceptions.",
      tier: 147,
      ctaLabel: "Get My CGT Exit Timing System — $147 →",
      altTierLabel: "Just want the timing fix plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      timing,
      strongestRisk: "Company entity — CGT discount not available under any circumstances",
    };
  }

  // ── Non-resident — discount not available ─────────────────────────────────
  if (residency === false) {
    return {
      status: "NON-RESIDENT — DISCOUNT LIKELY NOT AVAILABLE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "Non-residents are generally not entitled to the CGT discount on Australian assets disposed of after 8 May 2012.",
      stats: [
        { label: "Residency status", value: "Non-resident ✗", highlight: true },
        { label: "CGT discount", value: "Not available post-2012", highlight: true },
        { label: "Days held", value: timing.daysHeld > 0 ? `${timing.daysHeld} days` : "Not calculated" },
      ],
      consequences: [
        "Non-residents lost access to the CGT discount on most assets from 8 May 2012",
        "A transitional rule may apply if the gain accrued partly before that date — professional advice required",
        "Temporary residents have different rules — confirm your residency status with your tax adviser",
        "Taxable Australian property (TAP) such as real property is still subject to CGT for non-residents",
      ],
      confidence: "HIGH",
      confidenceNote: "Non-resident ineligibility applies to most disposals post-8 May 2012.",
      tier: 147,
      ctaLabel: "Get My CGT Exit Timing System — $147 →",
      altTierLabel: "Just want the residency analysis? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      timing,
      strongestRisk: "Non-resident status — CGT discount not available for most post-2012 disposals",
    };
  }

  // ── Does not qualify — under 12 months ───────────────────────────────────
  if (!timing.qualifies && timing.daysHeld > 0 && timing.discountRate > 0) {
    return {
      status: `DISCOUNT LOST — ${timing.daysShort} DAYS SHORT`,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Your asset was held for ${timing.daysHeld} days — ${timing.daysShort} day${timing.daysShort === 1 ? "" : "s"} short of the 12-month minimum. You pay tax on 100% of the gain, not 50%.`,
      stats: [
        { label: "Days held (contract to contract)", value: `${timing.daysHeld} days`, highlight: true },
        { label: "Required", value: "365 days minimum", highlight: true },
        { label: "Days short", value: `${timing.daysShort} day${timing.daysShort === 1 ? "" : "s"} ✗`, highlight: true },
      ],
      consequences: [
        "The CGT discount is measured from contract date to contract date — not settlement to settlement",
        `Your acquisition contract: ${formatDate(acquisitionDate)}. Your disposal contract: ${formatDate(disposalDate)}.`,
        `You are ${timing.daysShort} day${timing.daysShort === 1 ? "" : "s"} short — the ATO excludes both the acquisition day and disposal day from the count`,
        "Paying tax on 100% of the gain vs 50% can be a significant difference — confirm the exact dates with your accountant",
        capitalLosses ? "Capital losses can be applied to reduce the gain before tax — but this does not restore the discount" : "",
      ].filter(Boolean),
      confidence: timing.daysShort <= 3 ? "MEDIUM" : "HIGH",
      confidenceNote: timing.daysShort <= 3
        ? "Very close to qualifying — confirm exact contract dates with your conveyancer or solicitor before assuming ineligibility."
        : "Clearly under the 12-month threshold based on provided dates.",
      tier: 147,
      ctaLabel: "Get My CGT Exit Timing System — $147 →",
      altTierLabel: "Just want the timing fix plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      timing,
      strongestRisk: `${timing.daysShort} days short — ATO excludes both contract dates from the holding period count`,
    };
  }

  // ── SMSF — reduced discount ───────────────────────────────────────────────
  if (entityType === "smsf" && timing.qualifies) {
    return {
      status: "ELIGIBLE — SMSF 33.33% DISCOUNT APPLIES",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your SMSF qualifies for the CGT discount — but the SMSF rate is 33.33%, not the 50% that applies to individuals and trusts.`,
      stats: [
        { label: "Days held", value: `${timing.daysHeld} days ✓` },
        { label: "SMSF discount rate", value: "33.33%", highlight: false },
        { label: "Individual discount", value: "50% (SMSF gets less)" },
      ],
      consequences: [
        "SMSFs are eligible for a one-third (33.33%) CGT discount — not the 50% available to individuals",
        "The SMSF rate applies to assets held for 12+ months measured from contract date to contract date",
        rollover ? "Rollover history may affect the discount eligibility — confirm with your SMSF auditor" : "",
        "Pension-phase assets may be fully exempt from CGT if the fund is paying a retirement income stream",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "SMSF discount confirmed — confirm with your SMSF auditor for pension-phase exemptions.",
      tier: 67,
      ctaLabel: "Get My CGT Timing Fix Plan — $67 →",
      altTierLabel: "Want exit timing scenarios and sequencing? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      timing,
      strongestRisk: "SMSF rate is 33.33% — not 50%. Pension-phase may be fully exempt.",
    };
  }

  // ── Fully qualifies — 50% discount ───────────────────────────────────────
  if (timing.qualifies) {
    return {
      status: "ELIGIBLE — 50% CGT DISCOUNT CONFIRMED",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your asset was held for ${timing.daysHeld} days — the 50% CGT discount applies. Only half your capital gain is assessable.`,
      stats: [
        { label: "Days held", value: `${timing.daysHeld} days ✓` },
        { label: "CGT discount", value: "50% ✓" },
        { label: "Taxable gain", value: "50% of total gain" },
      ],
      consequences: [
        `Contract to contract: ${formatDate(acquisitionDate)} → ${formatDate(disposalDate)} = ${timing.daysHeld} days (${timing.daysHeld - 365} days over the minimum)`,
        "The discount is applied after capital losses are offset — confirm your loss position with your accountant",
        capitalLosses ? "You have capital losses — apply them against the full gain first, then apply the 50% discount to the remainder" : "",
        rollover ? "A prior rollover may affect your cost base — confirm with your accountant that the original acquisition date carries through" : "",
        assetType === "crypto" ? "Cryptocurrency assets qualify for the CGT discount — confirm your cost base calculation method (FIFO, specific identification)" : "",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "Discount confirmed based on provided dates — verify exact contract dates with your conveyancer.",
      tier: 67,
      ctaLabel: "Get My CGT Timing Fix Plan — $67 →",
      altTierLabel: "Want exit timing scenarios and loss sequencing? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      timing,
      strongestRisk: capitalLosses
        ? "Apply capital losses before the 50% discount — order matters"
        : rollover
          ? "Prior rollover may affect cost base — confirm acquisition date carries through"
          : "None detected — confirm exact contract dates with conveyancer",
    };
  }

  // ── No dates provided — informational ────────────────────────────────────
  return {
    status: "DATES REQUIRED — ENTER CONTRACT DATES TO CHECK ELIGIBILITY",
    statusClass: "text-neutral-600",
    panelClass: "border-neutral-200 bg-neutral-50",
    headline: "Enter your acquisition and disposal contract dates above — the CGT discount turns on exact timing from contract to contract.",
    stats: [
      { label: "Required", value: "Contract dates" },
      { label: "Minimum", value: "365 days held" },
      { label: "Discount", value: timing.discountRate > 0 ? `${Math.round(timing.discountRate * 100)}%` : "Not available" },
    ],
    consequences: [
      "The 12-month holding period is measured from the date of your acquisition contract to the date of your disposal contract",
      "Settlement dates do not matter — only contract dates",
      "The ATO excludes both the acquisition day and disposal day from the count",
    ],
    confidence: "LOW",
    confidenceNote: "Contract dates required to calculate eligibility.",
    tier: 67,
    ctaLabel: "Get My CGT Timing Fix Plan — $67 →",
    altTierLabel: "Want exit timing scenarios? — $147",
    productKey67: KEYS.p67, productKey147: KEYS.p147,
    timing,
    strongestRisk: "Contract dates not yet entered",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

type Q = {
  id: string;
  step: number;
  type: "button_group" | "two_button" | "date_input";
  label: string;
  subLabel?: string;
  options?: { label: string; value: string | boolean; subLabel?: string }[];
  showIf?: (a: AnswerMap) => boolean;
  required?: boolean;
};

const QUESTIONS: Q[] = [
  {
    id: "entity_type", step: 1, type: "button_group",
    label: "Who owns the asset being sold?",
    subLabel: "Entity type determines both the discount rate and eligibility — companies get zero discount",
    options: [
      { label: "Individual", value: "individual", subLabel: "50% CGT discount available" },
      { label: "Trust", value: "trust", subLabel: "50% CGT discount available if distributed to individuals" },
      { label: "SMSF", value: "smsf", subLabel: "33.33% discount — not 50%" },
      { label: "Company", value: "company", subLabel: "No CGT discount — ever" },
    ],
    required: true,
  },
  {
    id: "acquisition_date", step: 2, type: "date_input",
    label: "When was the acquisition contract signed?",
    subLabel: "Use the CONTRACT date — not settlement. This is when the CGT clock starts.",
    required: true,
  },
  {
    id: "disposal_date", step: 3, type: "date_input",
    label: "When was the disposal contract signed?",
    subLabel: "Use the CONTRACT date — not settlement. This is when the CGT event occurs.",
    required: true,
  },
  {
    id: "asset_type", step: 4, type: "button_group",
    label: "What type of asset is being sold?",
    subLabel: "Different asset types have different CGT rules and exclusions",
    options: [
      { label: "Property", value: "property", subLabel: "Investment property or land" },
      { label: "Shares", value: "shares", subLabel: "Listed or unlisted shares" },
      { label: "Business asset", value: "business", subLabel: "Goodwill, equipment, or business interests" },
      { label: "Cryptocurrency", value: "crypto", subLabel: "Bitcoin, ETH, or other digital assets" },
      { label: "Other", value: "other" },
    ],
    required: true,
  },
  {
    id: "residency", step: 5, type: "two_button",
    label: "Were you an Australian tax resident throughout the ownership and at the time of sale?",
    subLabel: "Non-residents lost access to the CGT discount on most Australian assets from 8 May 2012",
    options: [
      { label: "Yes — Australian resident throughout", value: true },
      { label: "No — non-resident or uncertain", value: false },
    ],
    showIf: (a) => a.entity_type !== "company",
    required: true,
  },
  {
    id: "rollover", step: 6, type: "two_button",
    label: "Was this asset acquired as part of a rollover from another CGT event?",
    subLabel: "Rollovers can carry through the original acquisition date — which may affect your holding period",
    options: [
      { label: "No — acquired directly", value: false },
      { label: "Yes — acquired via rollover", value: true, subLabel: "E.g. scrip-for-scrip, marriage breakdown, or small business rollover" },
    ],
    showIf: (a) => a.entity_type !== "company",
  },
  {
    id: "capital_losses", step: 7, type: "two_button",
    label: "Do you have capital losses (current year or carried forward)?",
    subLabel: "Losses are applied against the full gain first — then the 50% discount applies to the remainder",
    options: [
      { label: "No — no capital losses", value: false },
      { label: "Yes — have capital losses", value: true },
    ],
    showIf: (a) => a.entity_type !== "company",
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
  const t = verdict.timing;

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

      {/* Timing visual */}
      {t.daysHeld > 0 && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
            Your CGT holding period — contract to contract
          </p>
          <div className="flex items-center gap-2 text-xs text-neutral-600 mb-2">
            <span className="shrink-0 font-mono font-bold">ATO rule:</span>
            <span>Exclude acquisition day + exclude disposal day = {t.daysHeld} days held</span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full transition-all ${t.qualifies ? "bg-emerald-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(100, (t.daysHeld / 365) * 100)}%` }}
            />
            {/* 365-day marker */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-neutral-950" style={{ left: "100%" }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-neutral-400">
            <span>0 days</span>
            <span className={`font-bold ${t.qualifies ? "text-emerald-600" : "text-red-600"}`}>
              {t.daysHeld} days {t.qualifies ? "✓" : `(${t.daysShort} short)`}
            </span>
            <span>365 days minimum</span>
          </div>
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
          One day can be the difference between paying tax on 100% of your gain — or only 50%.
          <strong className="text-neutral-950"> This check shows your exact timing position.</strong>
        </p>
      </div>

      {/* What you get */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What's in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Contract-date memo — exact holding period calculation with ATO counting rules applied</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Entity-specific discount summary — individual, trust, SMSF, or company rules</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Residency caution notes — impact on discount eligibility</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Loss sequencing guide — apply losses before discount for maximum benefit</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>3 accountant questions specific to your timing and entity structure</span></li>
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

  if (q.type === "date_input") {
    return (
      <div>
        <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">{q.label}</h2>
        {q.subLabel && <p className="mb-4 text-sm text-neutral-500">{q.subLabel}</p>}
        <input
          type="date"
          value={String(value || "")}
          onChange={e => onAnswer(q.id, e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-950 outline-none focus:border-neutral-950 transition"
        />
        <p className="mt-2 text-xs text-neutral-400">
          Use the contract exchange date — not settlement date
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">{q.label}</h2>
      {q.subLabel && <p className="mb-4 text-sm text-neutral-500">{q.subLabel}</p>}
      {q.type === "two_button" ? (
        <div className="grid grid-cols-2 gap-3">
          {q.options?.map(opt => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as string | boolean)}
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition text-center ${sel(opt.value as string | boolean) ? active : inactive}`}>
              <span className="block">{opt.label}</span>
              {opt.subLabel && <span className={`mt-0.5 block text-xs ${sel(opt.value as string | boolean) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options?.map(opt => (
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

export default function CgtDiscountTimingSniperCalculator() {
  const [answers, setAnswers]     = useState<AnswerMap>({});
  const [step, setStep]           = useState(1);
  const [showVerdict, setVerdict] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showQuestions, setShowQ] = useState(false);
  const [popupTier, setPopupTier] = useState<Tier>(147);
  const [popupAnswers, setPopupA] = useState<PopupAnswers>({ asset_value: "", urgency: "", accountant: "" });
  const [email, setEmail]         = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const verdictRef                = useRef<HTMLDivElement>(null);

  const verdict   = useMemo(() => showVerdict ? calcVerdict(answers) : null, [showVerdict, answers]);
  const visibleQs = QUESTIONS.filter(q => q.step === step && (!q.showIf || q.showIf(answers)));

  // Date inputs advance on change, not on timer
  const isDateStep = visibleQs.some(q => q.type === "date_input");
  const stepComplete = !visibleQs.length || visibleQs.filter(q => q.required !== false).every(q => {
    const v = answers[q.id];
    return v !== undefined && v !== "" && v !== null;
  });

  useEffect(() => {
    if (!stepComplete || isDateStep) return;
    const t = setTimeout(() => {
      const next = step + 1;
      if (next <= TOTAL_STEPS) setStep(next);
      else setVerdict(true);
    }, 300);
    return () => clearTimeout(t);
  }, [stepComplete, step, isDateStep]);

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
        product_slug: "cgt-discount-timing-sniper",
        source_path: "/au/check/cgt-discount-timing-sniper",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          days_held: verdict.timing.daysHeld,
          qualifies: verdict.timing.qualifies,
          days_short: verdict.timing.daysShort,
          tier: verdict.tier,
        },
        recommended_tier: verdict.tier,
      }),
    }).then(r => r.json()).then(d => { if (d.id) setSessionId(d.id); }).catch(() => {});
  }, [showVerdict]);

  function answer(id: string, v: string | boolean) {
    setAnswers(p => ({ ...p, [id]: v }));
    // Date inputs: advance on next click of continue
  }

  function advanceFromDate() {
    const next = step + 1;
    if (next <= TOTAL_STEPS) setStep(next);
    else setVerdict(true);
  }

  function back() {
    if (showVerdict) { setVerdict(false); return; }
    if (step > 1) setStep(s => s - 1);
  }

  async function handleSaveEmail() {
    if (!email) return;
    await fetch("/api/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "cgt_discount_timing_sniper", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `cgt_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("cgt-discount-timing-sniper_entity_type", String(answers.entity_type || ""));
    sessionStorage.setItem("cgt-discount-timing-sniper_days_held", String(verdict.timing.daysHeld));
    sessionStorage.setItem("cgt-discount-timing-sniper_qualifies", String(verdict.timing.qualifies));
    sessionStorage.setItem("cgt-discount-timing-sniper_days_short", String(verdict.timing.daysShort));
    sessionStorage.setItem("cgt-discount-timing-sniper_status", verdict.status);
    sessionStorage.setItem("cgt-discount-timing-sniper_asset_type", String(answers.asset_type || ""));
    sessionStorage.setItem("cgt-discount-timing-sniper_tier", String(popupTier));

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
          success_url: `${window.location.origin}/au/check/cgt-discount-timing-sniper/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/cgt-discount-timing-sniper`,
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
  const dateValue = visibleQs[0]?.type === "date_input" ? String(answers[visibleQs[0].id] || "") : "";

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
            {/* Date step — manual advance */}
            {isDateStep && dateValue && (
              <button onClick={advanceFromDate}
                className="mt-4 w-full rounded-xl bg-neutral-950 py-3 text-sm font-bold text-white hover:bg-neutral-800 transition">
                Continue →
              </button>
            )}
          </div>
        )}

        {showVerdict && verdict && (
          <div ref={verdictRef} className="space-y-4">
            <button onClick={back} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← Change my answers</button>
            <VerdictBlock verdict={verdict} onCheckout={openPopup} loading={loading} />
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your CGT timing result.</p>
              <p className="mb-2 text-xs text-neutral-500">Email yourself the exact holding period calculation.</p>
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
                  <p className={`font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass.replace("700","400")}`}>CGT Discount Timing</p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">
                    {verdict.timing.daysHeld > 0
                      ? verdict.timing.qualifies
                        ? `${verdict.timing.daysHeld} days — discount confirmed`
                        : `${verdict.timing.daysShort} days short — discount lost`
                      : "Your CGT timing position"}
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
                      {popupTier === 67 ? "Your CGT Timing Fix Plan™" : "Your CGT Exit Timing System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Contract-date memo with exact holding period, entity-specific discount rules, residency notes, loss sequencing, and accountant questions — built for your exact dates and entity."
                        : "Tax-optimised sale timing scenarios, loss/discount sequencing strategy, trust or ownership structuring notes, and full implementation questions for your tax adviser."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic CGT guide. Built around your exact dates and entity.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Get My Timing Fix Plan →" : "Get My Exit Timing System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the timing fix plan? — $67 instead" : "Want exit timing scenarios and sequencing? — $147 instead"}
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
                    { label: "Approximate asset value", key: "asset_value", options: [["under_100k","Under $100,000"],["100k_500k","$100,000–$500,000"],["500k_1m","$500,000–$1 million"],["over_1m","Over $1 million"]] },
                    { label: "Where are you in the process?", key: "urgency", options: [["considering_sale","Considering the sale now"],["contract_signed","Contract already signed"],["post_settlement","Settlement completed"]] },
                    { label: "Do you have a tax adviser?", key: "accountant", options: [["yes_active","Yes — speaking with them soon"],["yes_inactive","Yes — not recently"],["no","No — managing myself"]] },
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

      {showVerdict && verdict && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">CGT Discount Timing</p>
              <p className="text-sm font-bold text-neutral-950 truncate">
                {verdict.timing.daysHeld > 0
                  ? verdict.timing.qualifies
                    ? "Discount confirmed — get your memo"
                    : `${verdict.timing.daysShort} days short — get your fix plan`
                  : "Check your CGT timing position"}
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
